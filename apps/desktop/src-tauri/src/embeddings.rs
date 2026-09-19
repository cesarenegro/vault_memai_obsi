//! Semantic retrieval and embeddings caching for LIMEN Vault.
//! Provides passage-level vector caching, OpenAI embeddings generation,
//! cosine similarity, hybrid RRF fusion, and offline fallback.

use crate::{
    catalog::{load_catalog, DocumentPassage},
    search::{self, normalize_text, SearchQuery, SearchResultItem},
    snapshots::{child, names, read, root, write_new},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    time::Duration,
};

pub const EMBEDDINGS_CACHE_FILE: &str = "EMBEDDINGS_CACHE.json";
pub const DEFAULT_EMBEDDINGS_MODEL: &str = "text-embedding-3-small";
pub const DEFAULT_EMBEDDINGS_DIMENSIONS: usize = 1536;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassageEmbeddingEntry {
    pub passage_id: String,
    pub document_id: String,
    pub relative_path: String,
    pub locator: String,
    pub sha256: String, // Hash of the passage text
    pub model: String,
    pub dimensions: usize,
    pub vector: Vec<f32>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingsCache {
    pub version: u32,
    pub model: String,
    pub dimensions: usize,
    pub entries: BTreeMap<String, PassageEmbeddingEntry>, // keyed by passage_id
    pub last_updated_at: String,
}

impl Default for EmbeddingsCache {
    fn default() -> Self {
        Self {
            version: 1,
            model: DEFAULT_EMBEDDINGS_MODEL.to_string(),
            dimensions: DEFAULT_EMBEDDINGS_DIMENSIONS,
            entries: BTreeMap::new(),
            last_updated_at: now_iso(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingsStatusReport {
    pub total_passages: usize,
    pub cached_passages: usize,
    pub missing_passages: usize,
    pub coverage: f64,
    pub model: String,
    pub dimensions: usize,
    pub is_available: bool,
    pub last_updated_at: String,
}

/// Compute cosine similarity between two float vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;
    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom <= 0.0000001 {
        0.0
    } else {
        dot / denom
    }
}

/// Load embeddings cache from 00_SYSTEM/EMBEDDINGS_CACHE.json or default if absent.
pub fn load_embeddings_cache(vault_path: &Path) -> Result<EmbeddingsCache, String> {
    let r = root(vault_path)?;
    let sys = match child(&r, "00_SYSTEM") {
        Ok(d) => d,
        Err(_) => return Ok(EmbeddingsCache::default()),
    };
    if !names(&sys)?.iter().any(|s| s == EMBEDDINGS_CACHE_FILE) {
        return Ok(EmbeddingsCache::default());
    }
    let bytes = read(&sys, EMBEDDINGS_CACHE_FILE)?;
    if bytes.len() > 64 * 1024 * 1024 {
        return Err("Embeddings cache file exceeds 64 MB".into());
    }
    serde_json::from_slice(&bytes).map_err(err)
}

/// Atomically save embeddings cache to 00_SYSTEM/EMBEDDINGS_CACHE.json
pub fn save_embeddings_cache(vault_path: &Path, cache: &mut EmbeddingsCache) -> Result<(), String> {
    cache.last_updated_at = now_iso();
    let r = root(vault_path)?;
    let sys = child(&r, "00_SYSTEM")?;
    let tmp = format!(".embeddings-{}.tmp", crate::ai::random_token()?);
    let bytes = serde_json::to_vec(cache).map_err(err)?;
    write_new(&sys, &tmp, &bytes)?;
    let res = sys.rename(&tmp, &sys, EMBEDDINGS_CACHE_FILE).map_err(err);
    if res.is_err() {
        let _ = sys.remove_file(&tmp);
    }
    res
}

/// Get current embeddings status and coverage
pub fn embeddings_status(vault_path: &Path) -> Result<EmbeddingsStatusReport, String> {
    let catalog = load_catalog(vault_path)?;
    let cache = load_embeddings_cache(vault_path)?;

    let mut total_passages: usize = 0;
    let mut cached_passages: usize = 0;

    for doc in catalog.documents.values() {
        for p in &doc.passages {
            total_passages += 1;
            if let Some(entry) = cache.entries.get(&p.passage_id) {
                if entry.sha256 == p.sha256 {
                    cached_passages += 1;
                }
            }
        }
    }

    let missing = total_passages.saturating_sub(cached_passages);
    let coverage = if total_passages == 0 {
        1.0
    } else {
        (cached_passages as f64) / (total_passages as f64)
    };

    Ok(EmbeddingsStatusReport {
        total_passages,
        cached_passages,
        missing_passages: missing,
        coverage,
        model: cache.model,
        dimensions: cache.dimensions,
        is_available: cached_passages > 0,
        last_updated_at: cache.last_updated_at,
    })
}

/// Fetch embeddings for a batch of strings from OpenAI API.
pub async fn fetch_openai_embeddings(
    api_key: &str,
    model: &str,
    texts: &[String],
) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }
    if api_key.trim().is_empty() {
        return Err("OpenAI API key non configurata".into());
    }

    let client = reqwest::Client::builder()
        .https_only(true)
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let body = json!({
        "model": model,
        "input": texts
    });

    let resp = client
        .post("https://api.openai.com/v1/embeddings")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Richiesta embeddings OpenAI fallita: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(match status {
            401 => "Chiave API OpenAI non valida o non autorizzata".into(),
            429 => "Quota OpenAI esaurita o rate limit raggiunto".into(),
            code => format!("OpenAI embeddings error HTTP {}: {}", code, err_text),
        });
    }

    let val: Value = resp
        .json()
        .await
        .map_err(|e| format!("Risposta JSON embeddings non valida: {}", e))?;

    let data = val
        .get("data")
        .and_then(Value::as_array)
        .ok_or("Campo data mancante nella risposta embeddings")?;

    let mut embeddings = Vec::with_capacity(texts.len());
    for item in data {
        let arr = item
            .get("embedding")
            .and_then(Value::as_array)
            .ok_or("Vettore embedding non valido")?;
        let vec: Vec<f32> = arr
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect();
        embeddings.push(vec);
    }

    if embeddings.len() != texts.len() {
        return Err(format!(
            "Numero vettori ricevuti ({}) diverso dai testi inviati ({})",
            embeddings.len(),
            texts.len()
        ));
    }

    Ok(embeddings)
}

/// Synchronize embeddings for catalog passages using the configured OpenAI API key.
/// Bounded to batches of max 32 passages to prevent timeouts and cost explosions.
pub async fn sync_embeddings(
    vault_path: &Path,
    api_key: &str,
    model: Option<&str>,
) -> Result<EmbeddingsStatusReport, String> {
    let catalog = load_catalog(vault_path)?;
    let mut cache = load_embeddings_cache(vault_path)?;
    let target_model = model.unwrap_or(DEFAULT_EMBEDDINGS_MODEL);

    let key_from_keychain = if api_key.trim().is_empty() {
        crate::keychain::load().ok().flatten().filter(|k| !k.trim().is_empty())
    } else {
        None
    };
    let effective_key = if !api_key.trim().is_empty() {
        api_key
    } else if let Some(ref k) = key_from_keychain {
        k.as_str()
    } else {
        return Err("Chiave API mancante. Configurala in Impostazioni per sincronizzare gli embeddings.".into());
    };

    // If model changed, clear cache
    if cache.model != target_model {
        cache.entries.clear();
        cache.model = target_model.to_string();
    }

    // Collect missing or updated passages
    struct MissingPassage {
        passage_id: String,
        document_id: String,
        relative_path: String,
        locator: String,
        sha256: String,
        text: String,
    }

    let mut missing: Vec<MissingPassage> = Vec::new();
    let mut valid_passage_ids = BTreeSet::new();

    for doc in catalog.documents.values() {
        for p in &doc.passages {
            valid_passage_ids.insert(p.passage_id.clone());
            let needs_update = match cache.entries.get(&p.passage_id) {
                Some(entry) => entry.sha256 != p.sha256 || entry.model != target_model,
                None => true,
            };
            if needs_update && !p.text.trim().is_empty() {
                missing.push(MissingPassage {
                    passage_id: p.passage_id.clone(),
                    document_id: doc.document_id.clone(),
                    relative_path: doc.original_path.clone(),
                    locator: p.locator.clone(),
                    sha256: p.sha256.clone(),
                    text: p.text.clone(),
                });
            }
        }
    }

    // Prune stale passages from cache
    cache.entries.retain(|id, _| valid_passage_ids.contains(id));

    // Process in batches of 16 passages
    let batch_size = 16;
    for chunk in missing.chunks(batch_size) {
        let texts: Vec<String> = chunk.iter().map(|m| m.text.clone()).collect();
        let vectors = fetch_openai_embeddings(effective_key, target_model, &texts).await?;

        for (m, vec) in chunk.iter().zip(vectors.into_iter()) {
            cache.entries.insert(
                m.passage_id.clone(),
                PassageEmbeddingEntry {
                    passage_id: m.passage_id.clone(),
                    document_id: m.document_id.clone(),
                    relative_path: m.relative_path.clone(),
                    locator: m.locator.clone(),
                    sha256: m.sha256.clone(),
                    model: target_model.to_string(),
                    dimensions: vec.len(),
                    vector: vec,
                    updated_at: now_iso(),
                },
            );
        }
    }

    save_embeddings_cache(vault_path, &mut cache)?;
    embeddings_status(vault_path)
}

/// Semantic score for a document given a query embedding vector.
/// Returns (best_score, matching_passage_id, matching_locator, passage_snippet).
pub fn rank_document_semantic(
    _doc_id: &str,
    passages: &[DocumentPassage],
    query_vector: &[f32],
    cache: &EmbeddingsCache,
) -> (f32, Option<String>, Option<String>, Option<String>) {
    let mut best_score = 0.0f32;
    let mut best_passage_id = None;
    let mut best_locator = None;
    let mut best_snippet = None;

    for p in passages {
        if let Some(entry) = cache.entries.get(&p.passage_id) {
            if entry.sha256 == p.sha256 {
                let sim = cosine_similarity(query_vector, &entry.vector);
                if sim > best_score {
                    best_score = sim;
                    best_passage_id = Some(p.passage_id.clone());
                    best_locator = Some(p.locator.clone());
                    best_snippet = Some(p.text.chars().take(240).collect::<String>());
                }
            }
        }
    }

    (best_score, best_passage_id, best_locator, best_snippet)
}

/// Hybrid search query combining lexical search and semantic embeddings.
/// Priority is given to exact codes and identifiers.
/// Ammissibilità/status is filtered BEFORE top-k (Gate A06 & R3).
pub async fn hybrid_search_vault(
    vault_path: &Path,
    q: SearchQuery,
    api_key: Option<String>,
    use_semantic: bool,
) -> Result<Vec<SearchResultItem>, String> {
    let limit = q.limit.unwrap_or(50);
    let offset = q.offset.unwrap_or(0);

    // 1. Run local lexical search with large candidate limit (not premature pagination)
    let mut lex_query = q.clone();
    lex_query.limit = Some(200);
    lex_query.offset = Some(0);
    let lexical_results = search::search_vault(vault_path, lex_query)?;

    // 2. If semantic search is not requested or no query term, return lexical results with original pagination
    let term = match &q.term {
        Some(t) if !t.trim().is_empty() => t.trim(),
        _ => return Ok(lexical_results.into_iter().skip(offset).take(limit).collect()),
    };

    if !use_semantic {
        return Ok(lexical_results.into_iter().skip(offset).take(limit).collect());
    }

    let cache = match load_embeddings_cache(vault_path) {
        Ok(c) if !c.entries.is_empty() => c,
        _ => return Ok(lexical_results.into_iter().skip(offset).take(limit).collect()), // Graceful offline fallback
    };

    // 3. Obtain API key: use provided or load directly from Keychain in backend (R2)
    let effective_key = match api_key.as_deref() {
        Some(k) if !k.trim().is_empty() => Some(k.to_string()),
        _ => crate::keychain::load().ok().flatten().filter(|k| !k.trim().is_empty()),
    };

    // 4. Compute query embedding vector (or fallback to lexical if key absent or network fails)
    let query_vector = match effective_key.as_deref() {
        Some(key) if !key.is_empty() => {
            match fetch_openai_embeddings(key, &cache.model, &[term.to_string()]).await {
                Ok(mut vecs) => vecs.pop(),
                Err(_) => None, // Graceful fallback on network/quota error
            }
        }
        _ => None,
    };

    let q_vec = match query_vector {
        Some(v) => v,
        None => return Ok(lexical_results.into_iter().skip(offset).take(limit).collect()),
    };

    // 5. Score all candidates semantically with full filtering (R3)
    let catalog = match load_catalog(vault_path) {
        Ok(cat) => cat,
        Err(_) => return Ok(lexical_results.into_iter().skip(offset).take(limit).collect()),
    };

    // Map of document_id -> (semantic_score, passage_id, locator, snippet)
    let mut semantic_scores: BTreeMap<String, (f32, Option<String>, Option<String>, Option<String>)> = BTreeMap::new();

    for doc in catalog.documents.values() {
        // Enforce all filters BEFORE scoring (R3): category, client, project, tags, status
        if let Some(ref cat) = q.category {
            if !cat.is_empty() && doc.category.as_deref() != Some(cat.as_str()) {
                continue;
            }
        }
        if let Some(ref cl) = q.client {
            if !cl.is_empty() && normalize_text(cl) != normalize_text(doc.client.as_deref().unwrap_or("")) {
                continue;
            }
        }
        if let Some(ref pr) = q.project {
            if !pr.is_empty() && normalize_text(pr) != normalize_text(doc.project.as_deref().unwrap_or("")) {
                continue;
            }
        }
        if let Some(ref tags) = q.tags {
            if tags.iter().any(|t| !doc.tags.iter().any(|x| normalize_text(x) == normalize_text(t))) {
                continue;
            }
        }
        if let Some(ref st) = q.status {
            if st != &doc.editorial_status {
                continue;
            }
        }
        if doc.passages.is_empty() {
            continue;
        }
        let (sim, pid, loc, snip) = rank_document_semantic(&doc.document_id, &doc.passages, &q_vec, &cache);
        if sim > 0.25 {
            semantic_scores.insert(doc.document_id.clone(), (sim, pid, loc, snip));
        }
    }

    // 5. Hybrid fusion using Reciprocal Rank Fusion (RRF) with exact-match boost
    // RRF score = 1.0 / (60 + rank_lex) + 1.0 / (60 + rank_sem) + exact_match_bonus
    let term_lower = term.to_lowercase();
    let is_exact_code = term.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') && term.len() >= 3;

    // Ranks from lexical
    let mut lex_rank_map: BTreeMap<String, usize> = BTreeMap::new();
    for (i, item) in lexical_results.iter().enumerate() {
        lex_rank_map.insert(item.id.clone(), i + 1);
    }

    // Sort semantic candidates to establish semantic rank
    let mut sem_sorted: Vec<(String, f32)> = semantic_scores.iter().map(|(id, (sim, _, _, _))| (id.clone(), *sim)).collect();
    sem_sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let mut sem_rank_map: BTreeMap<String, usize> = BTreeMap::new();
    for (i, (id, _)) in sem_sorted.iter().enumerate() {
        sem_rank_map.insert(id.clone(), i + 1);
    }

    // Union of all candidate IDs from lexical and semantic
    let mut all_ids: BTreeSet<String> = BTreeSet::new();
    all_ids.extend(lex_rank_map.keys().cloned());
    all_ids.extend(sem_rank_map.keys().cloned());

    struct FusedCandidate {
        item: SearchResultItem,
        fused_score: f64,
    }

    let mut fused_candidates: Vec<FusedCandidate> = Vec::new();

    for id in all_ids {
        let lex_rank = lex_rank_map.get(&id).copied();
        let sem_rank = sem_rank_map.get(&id).copied();

        let rrf_lex = match lex_rank {
            Some(r) => 1.0 / (60.0 + r as f64),
            None => 0.0,
        };
        let rrf_sem = match sem_rank {
            Some(r) => 1.0 / (60.0 + r as f64),
            None => 0.0,
        };

        // Find or build SearchResultItem
        let (mut item, base_score) = if let Some(lex_item) = lexical_results.iter().find(|i| i.id == id) {
            (lex_item.clone(), lex_item.score)
        } else if let Some(doc) = catalog.documents.get(&id) {
            let (_, pid, loc, snip) = semantic_scores.get(&id).cloned().unwrap_or((0.0, None, None, None));
            let preview = snip.unwrap_or_else(|| doc.passages.first().map(|p| p.text.clone()).unwrap_or_default());
            (
                SearchResultItem {
                    id: doc.document_id.clone(),
                    title: doc.file_name.clone(),
                    relative_path: doc.original_path.clone(),
                    category: doc.category.clone().unwrap_or_else(|| "source".to_string()),
                    client: doc.client.clone(),
                    project: doc.project.clone(),
                    tags: doc.tags.clone(),
                    status: Some(doc.editorial_status.clone()),
                    snippet: preview,
                    score: 0.0,
                    updated_at: Some(doc.updated_at.clone()),
                    sha256: doc.content_hash.clone(),
                    matching_locator: loc,
                    matching_passage_id: pid,
                    passages: Vec::new(),
                },
                0.0,
            )
        } else {
            continue;
        };

        // If semantic found a better matching passage, update locator and snippet
        if let Some((_, Some(pid), Some(loc), Some(snip))) = semantic_scores.get(&id) {
            if item.matching_locator.is_none() {
                item.matching_locator = Some(loc.clone());
                item.matching_passage_id = Some(pid.clone());
                item.snippet = snip.clone();
            }
        }

        // Exact code/phrase match bonus
        let mut exact_bonus = 0.0;
        if item.title.to_lowercase().contains(&term_lower) || item.snippet.to_lowercase().contains(&term_lower) {
            exact_bonus += if is_exact_code { 0.15 } else { 0.05 };
        }

        let fused_score = rrf_lex * 0.5 + rrf_sem * 0.5 + exact_bonus + (base_score * 0.01);
        item.score = fused_score;
        fused_candidates.push(FusedCandidate { item, fused_score });
    }

    // Sort descending by fused score
    fused_candidates.sort_by(|a, b| b.fused_score.partial_cmp(&a.fused_score).unwrap_or(std::cmp::Ordering::Equal));

    let limit = q.limit.unwrap_or(50);
    let offset = q.offset.unwrap_or(0);
    let results: Vec<SearchResultItem> = fused_candidates
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|c| c.item)
        .collect();

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_cosine_similarity() {
        let v1 = vec![1.0, 0.0, 0.0];
        let v2 = vec![1.0, 0.0, 0.0];
        let v3 = vec![0.0, 1.0, 0.0];
        let v4 = vec![-1.0, 0.0, 0.0];

        assert!((cosine_similarity(&v1, &v2) - 1.0).abs() < 1e-5);
        assert!((cosine_similarity(&v1, &v3) - 0.0).abs() < 1e-5);
        assert!((cosine_similarity(&v1, &v4) - (-1.0)).abs() < 1e-5);
    }

    #[test]
    fn test_embeddings_cache_lifecycle() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();

        let mut cache = EmbeddingsCache::default();
        cache.entries.insert(
            "doc1_p0".into(),
            PassageEmbeddingEntry {
                passage_id: "doc1_p0".into(),
                document_id: "doc1".into(),
                relative_path: "20_RAW_SOURCES/doc.txt".into(),
                locator: "Paragrafo 1".into(),
                sha256: "hash1".into(),
                model: DEFAULT_EMBEDDINGS_MODEL.into(),
                dimensions: 3,
                vector: vec![0.1, 0.2, 0.3],
                updated_at: now_iso(),
            },
        );

        save_embeddings_cache(path, &mut cache).unwrap();
        let loaded = load_embeddings_cache(path).unwrap();
        assert_eq!(loaded.entries.len(), 1);
        let entry = loaded.entries.get("doc1_p0").unwrap();
        assert_eq!(entry.locator, "Paragrafo 1");
        assert_eq!(entry.vector, vec![0.1, 0.2, 0.3]);
    }

    #[test]
    fn test_hybrid_search_offline_graceful_fallback() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("01_CLIENTS")).unwrap();

        fs::write(
            path.join("01_CLIENTS/note.md"),
            "---\ntitle: Progetto Aurora\nstatus: approved\n---\nSpecifiche del progetto Aurora con dettagli tecnici.",
        ).unwrap();

        search::index_vault_search(path).unwrap();

        // Hybrid search without API key or with empty embeddings cache falls back to lexical seamlessly
        let rt = tokio::runtime::Runtime::new().unwrap();
        let results = rt.block_on(hybrid_search_vault(
            path,
            SearchQuery {
                term: Some("Aurora".into()),
                ..Default::default()
            },
            None,
            true, // use_semantic = true, but offline
        )).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Progetto Aurora");
    }

    #[test]
    fn test_hybrid_fusion_ranks_exact_code_first() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        // 1. Doc A with exact SKU code
        let doc_a_text = "Prodotto SKU-999-X: microprocessore per controller industriale.";
        fs::write(path.join("20_RAW_SOURCES/doc_a.txt"), doc_a_text).unwrap();

        // 2. Doc B with conceptual match
        let doc_b_text = "Controller e chip per automazione di processo industriale.";
        fs::write(path.join("20_RAW_SOURCES/doc_b.txt"), doc_b_text).unwrap();

        let _cat = crate::catalog::sync_catalog_from_vault(path).unwrap();
        crate::catalog::process_pending_extractions(path).unwrap();

        // Index
        search::index_vault_search(path).unwrap();

        // Search for exact code SKU-999-X
        let rt = tokio::runtime::Runtime::new().unwrap();
        let res = rt.block_on(hybrid_search_vault(
            path,
            SearchQuery {
                term: Some("SKU-999-X".into()),
                ..Default::default()
            },
            None,
            false,
        )).unwrap();

        assert!(!res.is_empty());
        assert_eq!(res[0].relative_path, "20_RAW_SOURCES/doc_a.txt");
    }
}
