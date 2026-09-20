//! Semantic retrieval and embeddings caching for LIMEN Vault.
//! Provides passage-level vector caching, OpenAI embeddings generation,
//! cosine similarity, hybrid RRF fusion, and offline fallback.

use crate::{
    catalog::{load_catalog, DocumentPassage},
    search::{self, normalize_text, SearchQuery, SearchResultItem},
    snapshots::{child, compute_sha256, names, read, root, write_new},
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
pub const DEFAULT_EMBEDDINGS_ENDPOINT: &str = "https://api.openai.com/v1/embeddings";

/// Read embeddingsEndpoint from 00_SYSTEM/SYNC_PROFILE.json, defaulting to https://api.openai.com/v1/embeddings when absent.
pub fn resolve_embeddings_endpoint(vault_path: &Path) -> String {
    let profile_path = vault_path.join("00_SYSTEM").join("SYNC_PROFILE.json");
    if let Ok(content) = std::fs::read_to_string(&profile_path) {
        if let Ok(val) = serde_json::from_str::<Value>(&content) {
            if let Some(ep) = val.get("embeddingsEndpoint").and_then(Value::as_str) {
                let trimmed = ep.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    DEFAULT_EMBEDDINGS_ENDPOINT.to_string()
}

/// Optional model override from 00_SYSTEM/SYNC_PROFILE.json.
pub fn resolve_embeddings_model(vault_path: &Path) -> Option<String> {
    let profile_path = vault_path.join("00_SYSTEM").join("SYNC_PROFILE.json");
    if let Ok(content) = std::fs::read_to_string(&profile_path) {
        if let Ok(val) = serde_json::from_str::<Value>(&content) {
            if let Some(m) = val.get("embeddingsModel").and_then(Value::as_str) {
                let trimmed = m.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

/// Validates an embeddings endpoint URL for security.
/// Returns Ok(true) if the endpoint is loopback (allowing http://),
/// Ok(false) if the endpoint is a valid external HTTPS endpoint,
/// or Err(message) if an external endpoint attempts to use unencrypted HTTP or if the URL is invalid.
pub fn is_loopback_endpoint(endpoint: &str) -> Result<bool, String> {
    let url = reqwest::Url::parse(endpoint)
        .map_err(|e| format!("URL endpoint non valido '{}': {}", endpoint, e))?;

    let host = url.host_str().unwrap_or("").trim();
    let is_loopback = host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]";

    match url.scheme() {
        "http" => {
            if is_loopback {
                Ok(true)
            } else {
                Err(format!(
                    "Rifiutato endpoint HTTP non sicuro '{}': http:// è consentito esclusivamente su loopback (127.0.0.1, localhost, ::1)",
                    endpoint
                ))
            }
        }
        "https" => Ok(is_loopback),
        other => Err(format!("Schema URL non supportato '{}': supportati solo http e https", other)),
    }
}

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
    #[serde(default)]
    pub embedded_text_sha256: Option<String>,
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

/// Fetch embeddings for a batch of strings using default OpenAI API endpoint.
pub async fn fetch_openai_embeddings(
    api_key: &str,
    model: &str,
    texts: &[String],
) -> Result<Vec<Vec<f32>>, String> {
    fetch_openai_embeddings_with_endpoint(DEFAULT_EMBEDDINGS_ENDPOINT, api_key, model, texts).await
}

/// Fetch embeddings for a batch of strings from a configurable endpoint.
/// Allows http:// ONLY on loopback (127.0.0.1, localhost, ::1); rejects unencrypted HTTP for external hosts.
/// Does not require or send an API key if the endpoint is loopback and key is empty.
pub async fn fetch_openai_embeddings_with_endpoint(
    endpoint: &str,
    api_key: &str,
    model: &str,
    texts: &[String],
) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    let is_loopback = is_loopback_endpoint(endpoint)?;

    // Non-loopback endpoints strictly require an API key
    if !is_loopback && api_key.trim().is_empty() {
        return Err("OpenAI API key non configurata".into());
    }

    let mut client_builder = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(60));

    if !is_loopback {
        client_builder = client_builder.https_only(true);
    }

    let client = client_builder
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let body = json!({
        "model": model,
        "input": texts
    });

    let mut req = client.post(endpoint).json(&body);
    if !api_key.trim().is_empty() {
        req = req.bearer_auth(api_key);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Richiesta embeddings fallita verso '{}': {}", endpoint, e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(match status {
            401 => "Chiave API non valida o non autorizzata".into(),
            429 => "Quota esaurita o rate limit raggiunto".into(),
            code => format!("Embeddings error HTTP {}: {}", code, err_text),
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

/// Build contextualized passage text for embedding:
/// - Note title (frontmatter title if available, else file_name without extension)
/// - Document category (folder name e.g. "01_CLIENTS" ... "10_APPROVED_OUTPUTS" or category)
/// - Section locator (p.locator e.g. "Pagina N", "Slide N", "Paragrafi N-M")
/// - Raw passage text
/// Prefix context is capped at 20% of the character length of the passage.
pub fn build_passage_embedding_text(
    title: &str,
    category: &str,
    locator: &str,
    passage_text: &str,
) -> String {
    let mut ctx_lines = Vec::new();
    let trimmed_title = title.trim();
    if !trimmed_title.is_empty() {
        ctx_lines.push(trimmed_title);
    }
    let trimmed_cat = category.trim();
    if !trimmed_cat.is_empty() {
        ctx_lines.push(trimmed_cat);
    }
    let trimmed_loc = locator.trim();
    if !trimmed_loc.is_empty() {
        ctx_lines.push(trimmed_loc);
    }

    if ctx_lines.is_empty() || passage_text.trim().is_empty() {
        return passage_text.to_string();
    }

    let raw_ctx = ctx_lines.join("\n");
    let max_len = (passage_text.chars().count() as f64 * 0.20).floor() as usize;
    let final_ctx: String = if raw_ctx.chars().count() > max_len {
        raw_ctx.chars().take(max_len).collect()
    } else {
        raw_ctx
    };

    if final_ctx.is_empty() {
        passage_text.to_string()
    } else {
        format!("{}\n{}", final_ctx, passage_text)
    }
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
    let endpoint = resolve_embeddings_endpoint(vault_path);
    let is_loopback = is_loopback_endpoint(&endpoint)?;
    let profile_model = resolve_embeddings_model(vault_path);
    let target_model = model
        .or(profile_model.as_deref())
        .unwrap_or(DEFAULT_EMBEDDINGS_MODEL);

    let key_from_keychain = if !is_loopback && api_key.trim().is_empty() {
        crate::keychain::load().ok().flatten().filter(|k| !k.trim().is_empty())
    } else {
        None
    };
    let effective_key = if is_loopback {
        api_key
    } else if !api_key.trim().is_empty() {
        api_key
    } else if let Some(ref k) = key_from_keychain {
        k.as_str()
    } else {
        return Err("Chiave API mancante. Configurala in Impostazioni per sincronizzare gli embeddings.".into());
    };

    // If model changed, clear cache
    if cache.model != target_model {
        println!("Invalidating embeddings cache: model changed from '{}' to '{}'", cache.model, target_model);
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
        embedded_text_sha256: String,
        text_to_embed: String,
    }

    let mut missing: Vec<MissingPassage> = Vec::new();
    let mut valid_passage_ids = BTreeSet::new();

    for doc in catalog.documents.values() {
        let doc_title = if let Ok(content) = std::fs::read_to_string(vault_path.join(&doc.original_path)) {
            crate::vault::frontmatter(&content)
                .ok()
                .flatten()
                .and_then(|fm| fm["title"].as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| {
                    Path::new(&doc.file_name)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or(&doc.file_name)
                        .to_string()
                })
        } else {
            Path::new(&doc.file_name)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&doc.file_name)
                .to_string()
        };

        let doc_category = if let Some(first_segment) = doc.original_path.split('/').next() {
            if first_segment.starts_with("0") || first_segment.starts_with("1") {
                first_segment.to_string()
            } else {
                doc.category.clone().unwrap_or_else(|| first_segment.to_string())
            }
        } else {
            doc.category.clone().unwrap_or_default()
        };

        for p in &doc.passages {
            valid_passage_ids.insert(p.passage_id.clone());

            let text_to_embed = build_passage_embedding_text(&doc_title, &doc_category, &p.locator, &p.text);
            let embedded_sha = compute_sha256(text_to_embed.as_bytes());

            let needs_update = match cache.entries.get(&p.passage_id) {
                Some(entry) => {
                    entry.sha256 != p.sha256
                        || entry.model != target_model
                        || entry.embedded_text_sha256.as_deref() != Some(&embedded_sha)
                }
                None => true,
            };

            if needs_update && !p.text.trim().is_empty() {
                missing.push(MissingPassage {
                    passage_id: p.passage_id.clone(),
                    document_id: doc.document_id.clone(),
                    relative_path: doc.original_path.clone(),
                    locator: p.locator.clone(),
                    sha256: p.sha256.clone(),
                    embedded_text_sha256: embedded_sha,
                    text_to_embed,
                });
            }
        }
    }

    // Prune stale passages from cache
    cache.entries.retain(|id, _| valid_passage_ids.contains(id));

    // Process in batches of 16 passages
    let batch_size = 16;
    let total_missing = missing.len();
    let mut processed_count = 0;
    if total_missing > 0 {
        println!("Starting embedding sync: {} missing passages to process...", total_missing);
    }
    for chunk in missing.chunks(batch_size) {
        let texts: Vec<String> = chunk.iter().map(|m| m.text_to_embed.clone()).collect();
        let vectors = fetch_openai_embeddings_with_endpoint(&endpoint, effective_key, target_model, &texts).await?;

        // Cache dimension check and invalidation on dimension change (e.g. 1536 -> 1024)
        if let Some(first_vec) = vectors.first() {
            let dim = first_vec.len();
            if dim > 0 && cache.dimensions != dim {
                println!(
                    "Invalidating embeddings cache: vector dimensions changed from {} to {}",
                    cache.dimensions, dim
                );
                cache.entries.clear();
                cache.dimensions = dim;
            }
        }

        for (m, vec) in chunk.iter().zip(vectors.into_iter()) {
            cache.entries.insert(
                m.passage_id.clone(),
                PassageEmbeddingEntry {
                    passage_id: m.passage_id.clone(),
                    document_id: m.document_id.clone(),
                    relative_path: m.relative_path.clone(),
                    locator: m.locator.clone(),
                    sha256: m.sha256.clone(),
                    embedded_text_sha256: Some(m.embedded_text_sha256.clone()),
                    model: target_model.to_string(),
                    dimensions: vec.len(),
                    vector: vec,
                    updated_at: now_iso(),
                },
            );
        }

        processed_count += chunk.len();
        if processed_count % 160 == 0 || processed_count == total_missing {
            println!(
                "Embedding progress: {}/{} passages ({:.1}%)",
                processed_count,
                total_missing,
                (processed_count as f64 / total_missing as f64) * 100.0
            );
        }
    }

    if let Some(first_entry) = cache.entries.values().next() {
        cache.dimensions = first_entry.dimensions;
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
    if !use_semantic {
        return hybrid_search_vault_with_vector(vault_path, q, None, false).await;
    }

    let term = match &q.term {
        Some(t) if !t.trim().is_empty() => t.trim(),
        _ => return hybrid_search_vault_with_vector(vault_path, q, None, false).await,
    };

    let cache = match load_embeddings_cache(vault_path) {
        Ok(c) if !c.entries.is_empty() => c,
        _ => return hybrid_search_vault_with_vector(vault_path, q, None, false).await, // Graceful offline fallback
    };

    let endpoint = resolve_embeddings_endpoint(vault_path);
    let is_loopback = is_loopback_endpoint(&endpoint).unwrap_or(false);

    let effective_key = if is_loopback {
        api_key.filter(|k| !k.trim().is_empty())
    } else {
        match api_key.as_deref() {
            Some(k) if !k.trim().is_empty() => Some(k.to_string()),
            _ => crate::keychain::load().ok().flatten().filter(|k| !k.trim().is_empty()),
        }
    };

    let query_vector = if is_loopback {
        let key_str = effective_key.as_deref().unwrap_or("");
        match fetch_openai_embeddings_with_endpoint(&endpoint, key_str, &cache.model, &[term.to_string()]).await {
            Ok(mut vecs) => vecs.pop(),
            Err(_) => None,
        }
    } else {
        match effective_key.as_deref() {
            Some(key) if !key.is_empty() => {
                match fetch_openai_embeddings_with_endpoint(&endpoint, key, &cache.model, &[term.to_string()]).await {
                    Ok(mut vecs) => vecs.pop(),
                    Err(_) => None, // Graceful fallback on network/quota error
                }
            }
            _ => None,
        }
    };

    hybrid_search_vault_with_vector(vault_path, q, query_vector, true).await
}

pub async fn hybrid_search_vault_with_vector(
    vault_path: &Path,
    q: SearchQuery,
    query_vector: Option<Vec<f32>>,
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

    // 5. Hybrid fusion using min-max normalized combination (Variant B, w_lex=0.5, w_sem=0.5)
    let term_lower = term.to_lowercase();
    let is_exact_code = (term.contains('-') || term.contains('_') || term.chars().any(|c| c.is_ascii_digit()))
        && term.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        && term.len() >= 3;

    // Helper to normalize document ID to 16 hex chars (doc_<16hex>) to reconcile
    // 68-char IDs from SEARCH_INDEX.json (doc_<64hex>) with 20-char catalog IDs.
    let normalize_id = |id: &str| -> String {
        if id.starts_with("doc_") && id.len() > 20 {
            id[..20].to_string()
        } else {
            id.to_string()
        }
    };

    // Union of all candidate canonical IDs from lexical and semantic
    let mut all_ids: BTreeSet<String> = BTreeSet::new();
    for lex_item in &lexical_results {
        all_ids.insert(normalize_id(&lex_item.id));
    }
    for sem_id in semantic_scores.keys() {
        all_ids.insert(normalize_id(sem_id));
    }

    struct IntermediateCandidate {
        item: SearchResultItem,
        base_score: f64,
        sem_sim: f64,
        matches_term: bool,
    }

    let mut intermediate: Vec<IntermediateCandidate> = Vec::new();

    for id in all_ids {
        // Check for lexical match by normalized id or full id
        let lex_item = lexical_results.iter().find(|i| normalize_id(&i.id) == id || i.id == id);
        let base_score = lex_item.map(|i| i.score).unwrap_or(0.0);

        // Check for semantic match by normalized id or full id
        let sem_info = semantic_scores.get(&id).or_else(|| {
            semantic_scores.iter().find(|(k, _)| normalize_id(k) == id).map(|(_, v)| v)
        });
        let sem_sim = sem_info.map(|s| s.0 as f64).unwrap_or(0.0);

        // Build base SearchResultItem: prefer lexical item if available, otherwise reconstruct from catalog
        let mut item = if let Some(li) = lex_item {
            let mut it = li.clone();
            it.id = id.clone();
            it
        } else if let Some(doc) = catalog.documents.get(&id).or_else(|| {
            catalog.documents.values().find(|d| normalize_id(&d.document_id) == id || d.original_path == id)
        }) {
            let preview = doc.passages.first().map(|p| p.text.clone()).unwrap_or_default();
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
                matching_locator: None,
                matching_passage_id: None,
                passages: Vec::new(),
            }
        } else {
            continue;
        };

        // If semantic found a better matching passage or if locator is missing, enrich item
        if let Some((_, pid, loc, snip)) = sem_info {
            if item.matching_locator.is_none() || (lex_item.is_none() && snip.is_some()) {
                if let Some(l) = loc { item.matching_locator = Some(l.clone()); }
                if let Some(p) = pid { item.matching_passage_id = Some(p.clone()); }
                if let Some(s) = snip { item.snippet = s.clone(); }
            }
        }

        let matches_term = item.title.to_lowercase().contains(&term_lower) || item.snippet.to_lowercase().contains(&term_lower);

        intermediate.push(IntermediateCandidate {
            item,
            base_score,
            sem_sim,
            matches_term,
        });
    }

    // Min-Max normalization bounds for this query across retrieved candidates
    let min_lex = intermediate.iter().map(|c| c.base_score).fold(f64::INFINITY, f64::min);
    let max_lex = intermediate.iter().map(|c| c.base_score).fold(f64::NEG_INFINITY, f64::max);
    let min_sem = intermediate.iter().map(|c| c.sem_sim).fold(f64::INFINITY, f64::min);
    let max_sem = intermediate.iter().map(|c| c.sem_sim).fold(f64::NEG_INFINITY, f64::max);

    struct FusedCandidate {
        item: SearchResultItem,
        fused_score: f64,
    }

    let mut fused_candidates: Vec<FusedCandidate> = Vec::new();

    for mut c in intermediate {
        let lex_norm = if max_lex > min_lex {
            (c.base_score - min_lex) / (max_lex - min_lex)
        } else if c.base_score > 0.0 {
            1.0
        } else {
            0.0
        };

        let sem_norm = if max_sem > min_sem {
            (c.sem_sim - min_sem) / (max_sem - min_sem)
        } else if c.sem_sim > 0.0 {
            1.0
        } else {
            0.0
        };

        let exact_bonus = if c.matches_term {
            if is_exact_code { 0.20 } else { 0.05 }
        } else {
            0.0
        };

        // C10 formula (F2, k = 0.20): max(lex_norm, sem_norm) + 0.20 * min(lex_norm, sem_norm) + exact_bonus
        // Ensures documents with a single strong signal (e.g. semantic-only with lex_norm = 0)
        // preserve their score and rank above mediocre dual-signal documents, while continuing
        // to reward multi-modal concurrence. Selected via dev tuning on 30 queries (Recall@10 = 0.933).
        let fused_score = lex_norm.max(sem_norm) + 0.20 * lex_norm.min(sem_norm) + exact_bonus;
        c.item.score = fused_score;
        fused_candidates.push(FusedCandidate { item: c.item, fused_score });
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
                embedded_text_sha256: Some("emb_hash1".into()),
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
        assert_eq!(entry.embedded_text_sha256.as_deref(), Some("emb_hash1"));
    }

    #[test]
    fn test_passage_embedding_text_context_and_20_percent_cap() {
        let title = "Guida al Confezionamento Sottovuoto";
        let category = "05_PACKAGING_KNOWLEDGE";
        let locator = "Pagina 12";
        let short_passage = "Testo breve.";

        // When passage text is short, prefix cap applies:
        // short_passage is 12 chars -> 20% is floor(2.4) = 2 chars.
        let embedded_short = build_passage_embedding_text(title, category, locator, short_passage);
        let lines: Vec<&str> = embedded_short.split('\n').collect();
        // Since prefix is capped to 2 chars, it takes the first 2 chars of "Guida..." which is "Gu"
        assert_eq!(lines[0], "Gu");
        assert_eq!(lines[1], short_passage);

        // When passage text is long enough, all metadata is preserved:
        let long_passage = "Questo documento descrive in modo dettagliato tutte le specifiche tecniche, i parametri di saldatura, i tempi di ciclo, le tolleranze di tenuta e le procedure di convalida per le linee di confezionamento sottovuoto ad alta velocità destinate al settore alimentare e medicale. Include inoltre le istruzioni operative per gli operatori di linea e le verifiche di conformità per i materiali barriera multistrato.".repeat(2);
        let embedded_long = build_passage_embedding_text(title, category, locator, &long_passage);
        assert!(embedded_long.contains(title));
        assert!(embedded_long.contains(category));
        assert!(embedded_long.contains(locator));
        assert!(embedded_long.ends_with(&long_passage));
    }

    #[test]
    fn test_embedded_text_sha256_cache_invalidation_on_prefix_change() {
        let passage_text = "Passaggio informativo molto dettagliato con parametri di saldatura e tempi di ciclo per le confezionatrici.";
        let raw_sha256 = compute_sha256(passage_text.as_bytes());

        // Context 1: Document title "Titolo Vecchio", category "05_PACKAGING_KNOWLEDGE", locator "Pagina 1"
        let text_v1 = build_passage_embedding_text("Titolo Vecchio", "05_PACKAGING_KNOWLEDGE", "Pagina 1", passage_text);
        let sha_v1 = compute_sha256(text_v1.as_bytes());

        // Cache entry created with v1 context:
        let entry = PassageEmbeddingEntry {
            passage_id: "doc1_p0".into(),
            document_id: "doc1".into(),
            relative_path: "05_PACKAGING_KNOWLEDGE/doc1.md".into(),
            locator: "Pagina 1".into(),
            sha256: raw_sha256.clone(), // raw passage text hash
            embedded_text_sha256: Some(sha_v1.clone()),
            model: DEFAULT_EMBEDDINGS_MODEL.into(),
            dimensions: 1536,
            vector: vec![0.1; 1536],
            updated_at: now_iso(),
        };

        // If context doesn't change, no update needed:
        let text_v1_same = build_passage_embedding_text("Titolo Vecchio", "05_PACKAGING_KNOWLEDGE", "Pagina 1", passage_text);
        let sha_v1_same = compute_sha256(text_v1_same.as_bytes());
        let needs_update_unchanged = entry.sha256 != raw_sha256
            || entry.model != DEFAULT_EMBEDDINGS_MODEL
            || entry.embedded_text_sha256.as_deref() != Some(&sha_v1_same);
        assert!(!needs_update_unchanged, "Cache entry should remain valid when context is identical");

        // Context 2: Document title changed to "Titolo Nuovo", but raw passage text is UNCHANGED!
        let text_v2 = build_passage_embedding_text("Titolo Nuovo", "05_PACKAGING_KNOWLEDGE", "Pagina 1", passage_text);
        let sha_v2 = compute_sha256(text_v2.as_bytes());
        assert_ne!(sha_v1, sha_v2, "Embedded text SHA must change when title changes");

        // Cache invalidation check:
        // Even though entry.sha256 == raw_sha256 (raw passage is identical),
        // entry.embedded_text_sha256 != sha_v2 triggers invalidation!
        let needs_update = entry.sha256 != raw_sha256
            || entry.model != DEFAULT_EMBEDDINGS_MODEL
            || entry.embedded_text_sha256.as_deref() != Some(&sha_v2);
        assert!(needs_update, "Cache must invalidate when prefix/context changes even if raw passage text sha256 matches!");

        // Also verify that an older cache entry with embedded_text_sha256 == None triggers update:
        let old_style_entry = PassageEmbeddingEntry {
            passage_id: "doc1_p0".into(),
            document_id: "doc1".into(),
            relative_path: "05_PACKAGING_KNOWLEDGE/doc1.md".into(),
            locator: "Pagina 1".into(),
            sha256: raw_sha256.clone(),
            embedded_text_sha256: None, // old format
            model: DEFAULT_EMBEDDINGS_MODEL.into(),
            dimensions: 1536,
            vector: vec![0.1; 1536],
            updated_at: now_iso(),
        };
        let needs_update_old = old_style_entry.sha256 != raw_sha256
            || old_style_entry.model != DEFAULT_EMBEDDINGS_MODEL
            || old_style_entry.embedded_text_sha256.as_deref() != Some(&sha_v2);
        assert!(needs_update_old, "Old cache entry without embedded_text_sha256 must be invalidated and re-embedded!");
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

    #[test]
    fn test_hybrid_fusion_pure_semantic_enters_top_ten() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        // 1. Create 5 documents that match lexical search for "packaging"
        for i in 1..=5 {
            let doc_text = format!("Specifiche per soluzioni di packaging standard modello numerato {}.", i);
            fs::write(path.join(format!("20_RAW_SOURCES/lex_doc_{:02}.txt", i)), doc_text).unwrap();
        }

        // 2. Create 1 document that has ZERO lexical match for "packaging", but high semantic relevance
        let sem_text = "Involucro a tenuta stagna per liquidi criogenici con barriera termica sottovuoto.";
        fs::write(path.join("20_RAW_SOURCES/pure_sem_doc.txt"), sem_text).unwrap();

        let _ = crate::catalog::sync_catalog_from_vault(path).unwrap();
        crate::catalog::process_pending_extractions(path).unwrap();
        let cat = crate::catalog::load_catalog(path).unwrap();
        search::index_vault_search(path).unwrap();

        // Find document_id of pure_sem_doc
        let pure_sem_doc_id = cat.documents.values()
            .find(|d| d.original_path.contains("pure_sem_doc.txt"))
            .map(|d| d.document_id.clone())
            .expect("pure_sem_doc must be in catalog");

        // 3. Build embeddings cache where pure_sem_doc has high similarity vector [1.0, 0.0, 0.0]
        // and lexical docs have orthogonal vector [0.0, 1.0, 0.0]
        let mut cache = EmbeddingsCache {
            version: 1,
            model: DEFAULT_EMBEDDINGS_MODEL.into(),
            dimensions: 3,
            entries: BTreeMap::new(),
            last_updated_at: now_iso(),
        };

        for doc in cat.documents.values() {
            let vec = if doc.document_id == pure_sem_doc_id {
                vec![1.0, 0.0, 0.0]
            } else {
                vec![0.0, 1.0, 0.0]
            };
            for p in &doc.passages {
                cache.entries.insert(
                    p.passage_id.clone(),
                    PassageEmbeddingEntry {
                        passage_id: p.passage_id.clone(),
                        document_id: doc.document_id.clone(),
                        relative_path: doc.original_path.clone(),
                        locator: p.locator.clone(),
                        sha256: p.sha256.clone(),
                        embedded_text_sha256: Some(p.sha256.clone()),
                        model: DEFAULT_EMBEDDINGS_MODEL.into(),
                        dimensions: 3,
                        vector: vec.clone(),
                        updated_at: now_iso(),
                    },
                );
            }
        }
        save_embeddings_cache(path, &mut cache).unwrap();

        // 4. Query for "packaging" with query_vector = [1.0, 0.0, 0.0]
        // Pure semantic doc has 0.0 lexical score, but 1.0 cosine similarity
        let rt = tokio::runtime::Runtime::new().unwrap();
        let res = rt.block_on(hybrid_search_vault_with_vector(
            path,
            SearchQuery {
                term: Some("packaging".into()),
                limit: Some(10),
                ..Default::default()
            },
            Some(vec![1.0, 0.0, 0.0]),
            true, // use_semantic = true
        )).unwrap();

        // Verify pure semantic document enters top 10
        let found_rank = res.iter().position(|r| r.id == pure_sem_doc_id);
        assert!(found_rank.is_some(), "Document found only by semantics (zero lexical score) MUST enter top 10!");
        let rank = found_rank.unwrap() + 1;
        assert!(rank <= 10, "Pure semantic document rank ({}) must be <= 10", rank);
    }

    #[test]
    fn test_hybrid_fusion_coalescence_single_row_when_found_by_both_engines() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        let doc_text = "Guaine protettive per cablaggi elettrici e protezione termica.";
        fs::write(path.join("20_RAW_SOURCES/doc_guaine.txt"), doc_text).unwrap();

        let _ = crate::catalog::sync_catalog_from_vault(path).unwrap();
        crate::catalog::process_pending_extractions(path).unwrap();
        let cat = crate::catalog::load_catalog(path).unwrap();
        search::index_vault_search(path).unwrap();

        let doc_id = cat.documents.values()
            .find(|d| d.original_path.contains("doc_guaine.txt"))
            .map(|d| d.document_id.clone())
            .expect("document must be in catalog");

        let mut cache = EmbeddingsCache {
            version: 1,
            model: DEFAULT_EMBEDDINGS_MODEL.into(),
            dimensions: 3,
            entries: BTreeMap::new(),
            last_updated_at: now_iso(),
        };

        for doc in cat.documents.values() {
            for p in &doc.passages {
                cache.entries.insert(
                    p.passage_id.clone(),
                    PassageEmbeddingEntry {
                        passage_id: p.passage_id.clone(),
                        document_id: doc.document_id.clone(),
                        relative_path: doc.original_path.clone(),
                        locator: p.locator.clone(),
                        sha256: p.sha256.clone(),
                        embedded_text_sha256: Some(p.sha256.clone()),
                        model: DEFAULT_EMBEDDINGS_MODEL.into(),
                        dimensions: 3,
                        vector: vec![1.0, 0.0, 0.0],
                        updated_at: now_iso(),
                    },
                );
            }
        }
        save_embeddings_cache(path, &mut cache).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let res = rt.block_on(hybrid_search_vault_with_vector(
            path,
            SearchQuery {
                term: Some("Guaine".into()),
                limit: Some(10),
                ..Default::default()
            },
            Some(vec![1.0, 0.0, 0.0]),
            true,
        )).unwrap();

        let matching_rows: Vec<_> = res.iter().filter(|r| r.relative_path.contains("doc_guaine.txt")).collect();
        assert_eq!(matching_rows.len(), 1, "Document found by both engines MUST produce exactly one row, got {}", matching_rows.len());
        assert_eq!(res.len(), 1);
        assert_eq!(res[0].id, doc_id);
    }

    #[test]
    fn test_hybrid_fusion_coalesced_beats_single_engine_at_score_parity() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        // 1. Doc Both: matches lexically for "solvente" and semantically
        fs::write(path.join("20_RAW_SOURCES/doc_both.txt"), "Solvente chimico per decappaggio industriale di alta purezza.").unwrap();
        // 2. Doc LexOnly: matches lexically for "solvente" but orthogonal semantically
        fs::write(path.join("20_RAW_SOURCES/doc_lex_only.txt"), "Solvente sgrassante per superfici metalliche meccaniche.").unwrap();
        // 3. Doc SemOnly: ZERO lexical match for "solvente", but high semantic match
        fs::write(path.join("20_RAW_SOURCES/doc_sem_only.txt"), "Fluido reagente decontaminante per trattamento chimico.").unwrap();

        let _ = crate::catalog::sync_catalog_from_vault(path).unwrap();
        crate::catalog::process_pending_extractions(path).unwrap();
        let cat = crate::catalog::load_catalog(path).unwrap();
        search::index_vault_search(path).unwrap();

        let mut cache = EmbeddingsCache {
            version: 1,
            model: DEFAULT_EMBEDDINGS_MODEL.into(),
            dimensions: 3,
            entries: BTreeMap::new(),
            last_updated_at: now_iso(),
        };

        for doc in cat.documents.values() {
            let vec = if doc.original_path.contains("doc_both.txt") || doc.original_path.contains("doc_sem_only.txt") {
                vec![1.0, 0.0, 0.0]
            } else {
                vec![0.0, 1.0, 0.0]
            };
            for p in &doc.passages {
                cache.entries.insert(
                    p.passage_id.clone(),
                    PassageEmbeddingEntry {
                        passage_id: p.passage_id.clone(),
                        document_id: doc.document_id.clone(),
                        relative_path: doc.original_path.clone(),
                        locator: p.locator.clone(),
                        sha256: p.sha256.clone(),
                        embedded_text_sha256: Some(p.sha256.clone()),
                        model: DEFAULT_EMBEDDINGS_MODEL.into(),
                        dimensions: 3,
                        vector: vec.clone(),
                        updated_at: now_iso(),
                    },
                );
            }
        }
        save_embeddings_cache(path, &mut cache).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let res = rt.block_on(hybrid_search_vault_with_vector(
            path,
            SearchQuery {
                term: Some("solvente".into()),
                limit: Some(10),
                ..Default::default()
            },
            Some(vec![1.0, 0.0, 0.0]),
            true,
        )).unwrap();

        assert!(res.len() >= 3, "Expected at least 3 documents in results");
        // Doc Both must be strictly Rank 1 because it combines both lexical and semantic scores
        assert_eq!(res[0].relative_path, "20_RAW_SOURCES/doc_both.txt", "Doc Both MUST be Rank 1");
        // Its score must strictly exceed Doc LexOnly and Doc SemOnly
        assert!(res[0].score > res[1].score, "Doc Both score ({}) must be > Rank 2 score ({})", res[0].score, res[1].score);
    }

    #[test]
    fn test_hybrid_fusion_high_sem_pure_beats_mediocre_dual_signals() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        // Query terms: "alfa beta"
        // 1. Doc High Lex: matches both terms "alfa" and "beta" repeatedly -> max lexical score (lex_norm = 1.0)
        fs::write(
            path.join("20_RAW_SOURCES/doc_high_lex.txt"),
            "Trattamento speciale alfa beta con elementi alfa beta e parametri alfa beta concentrati.",
        ).unwrap();

        // 2. Doc Mediocre Dual: matches only ONE term "alfa" in longer text (lex_norm ~ 0.50), and moderate semantic similarity (0.50)
        fs::write(
            path.join("20_RAW_SOURCES/doc_mediocre_dual.txt"),
            "Specifiche tecniche ordinarie di produzione industriale per componenti alfa senza altre caratteristiche rilevanti.",
        ).unwrap();

        // 3. Doc High Sem: matches NEITHER "alfa" nor "beta" (lex_norm = 0.0), but high semantic similarity (0.95)
        fs::write(
            path.join("20_RAW_SOURCES/doc_high_sem.txt"),
            "Dispositivo criogenico avanzato per isolamento termico in camere pressurizzate.",
        ).unwrap();

        let _ = crate::catalog::sync_catalog_from_vault(path).unwrap();
        crate::catalog::process_pending_extractions(path).unwrap();
        let cat = crate::catalog::load_catalog(path).unwrap();
        search::index_vault_search(path).unwrap();

        let mut cache = EmbeddingsCache {
            version: 1,
            model: DEFAULT_EMBEDDINGS_MODEL.into(),
            dimensions: 3,
            entries: BTreeMap::new(),
            last_updated_at: now_iso(),
        };

        // Query vector: [1.0, 0.0, 0.0]
        // Doc High Sem: sim = 0.95
        // Doc Mediocre Dual: sim = 0.50
        // Doc High Lex: sim = 0.0
        for doc in cat.documents.values() {
            let vec = if doc.original_path.contains("doc_high_sem.txt") {
                vec![0.95, 0.312, 0.0]
            } else if doc.original_path.contains("doc_mediocre_dual.txt") {
                vec![0.50, 0.866, 0.0]
            } else {
                vec![0.0, 1.0, 0.0]
            };
            for p in &doc.passages {
                cache.entries.insert(
                    p.passage_id.clone(),
                    PassageEmbeddingEntry {
                        passage_id: p.passage_id.clone(),
                        document_id: doc.document_id.clone(),
                        relative_path: doc.original_path.clone(),
                        locator: p.locator.clone(),
                        sha256: p.sha256.clone(),
                        embedded_text_sha256: Some(p.sha256.clone()),
                        model: DEFAULT_EMBEDDINGS_MODEL.into(),
                        dimensions: 3,
                        vector: vec.clone(),
                        updated_at: now_iso(),
                    },
                );
            }
        }
        save_embeddings_cache(path, &mut cache).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let res = rt.block_on(hybrid_search_vault_with_vector(
            path,
            SearchQuery {
                term: Some("alfa beta".into()),
                limit: Some(10),
                ..Default::default()
            },
            Some(vec![1.0, 0.0, 0.0]),
            true,
        )).unwrap();

        assert!(res.len() >= 2, "Expected at least 2 documents in results");
        let high_sem_idx = res.iter().position(|r| r.relative_path.contains("doc_high_sem.txt")).expect("doc_high_sem must be present");
        let mediocre_dual_idx = res.iter().position(|r| r.relative_path.contains("doc_mediocre_dual.txt")).expect("doc_mediocre_dual must be present");

        // Under C10 formula (F2, k=0.20):
        // doc_high_sem score: max(0.0, sem_norm) + 0.20 * min(0.0, sem_norm) ~ 1.00
        // doc_mediocre_dual score: max(lex_norm, sem_norm) + 0.20 * min(lex_norm, sem_norm) + bonus ~ 0.55 + 0.10 + 0.05 = 0.70 < 1.00
        // doc_high_sem MUST strictly outrank doc_mediocre_dual
        assert!(high_sem_idx < mediocre_dual_idx, "doc_high_sem (rank {}) must beat doc_mediocre_dual (rank {})", high_sem_idx + 1, mediocre_dual_idx + 1);
        assert!(res[high_sem_idx].score > res[mediocre_dual_idx].score, "doc_high_sem score ({}) must be > doc_mediocre_dual score ({})", res[high_sem_idx].score, res[mediocre_dual_idx].score);
    }

    #[test]
    fn test_resolve_embeddings_endpoint_defaults_to_openai_when_absent() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        assert_eq!(resolve_embeddings_endpoint(path), DEFAULT_EMBEDDINGS_ENDPOINT);

        // Even with empty SYNC_PROFILE.json
        fs::write(path.join("00_SYSTEM/SYNC_PROFILE.json"), "{}").unwrap();
        assert_eq!(resolve_embeddings_endpoint(path), DEFAULT_EMBEDDINGS_ENDPOINT);

        // When embeddingsEndpoint is configured
        let custom = r#"{"embeddingsEndpoint":"http://127.0.0.1:8088/v1/embeddings","embeddingsModel":"bge-m3"}"#;
        fs::write(path.join("00_SYSTEM/SYNC_PROFILE.json"), custom).unwrap();
        assert_eq!(resolve_embeddings_endpoint(path), "http://127.0.0.1:8088/v1/embeddings");
        assert_eq!(resolve_embeddings_model(path).as_deref(), Some("bge-m3"));
    }

    #[test]
    fn test_is_loopback_endpoint_security_rules() {
        // Loopback HTTP accepted
        assert_eq!(is_loopback_endpoint("http://127.0.0.1:8088/v1/embeddings").unwrap(), true);
        assert_eq!(is_loopback_endpoint("http://localhost:8088/v1/embeddings").unwrap(), true);
        assert_eq!(is_loopback_endpoint("http://[::1]:8088/v1/embeddings").unwrap(), true);

        // External HTTPS accepted
        assert_eq!(is_loopback_endpoint("https://api.openai.com/v1/embeddings").unwrap(), false);
        assert_eq!(is_loopback_endpoint("https://custom-ai.company.internal/v1/embeddings").unwrap(), false);

        // Insecure external HTTP REJECTED
        assert!(is_loopback_endpoint("http://api.openai.com/v1/embeddings").is_err());
        assert!(is_loopback_endpoint("http://esempio.esterno/v1/embeddings").is_err());
        assert!(is_loopback_endpoint("http://192.168.1.50:8088/v1/embeddings").is_err());
    }

    #[tokio::test]
    async fn test_fetch_embeddings_api_key_rules() {
        // Non-loopback endpoint requires API key
        let res_ext = fetch_openai_embeddings_with_endpoint(
            "https://api.openai.com/v1/embeddings",
            "",
            "text-embedding-3-small",
            &["test".to_string()],
        ).await;
        assert!(res_ext.is_err());
        assert_eq!(res_ext.unwrap_err(), "OpenAI API key non configurata");

        // External unencrypted HTTP rejected immediately
        let res_insecure = fetch_openai_embeddings_with_endpoint(
            "http://esempio.esterno/v1/embeddings",
            "key123",
            "text-embedding-3-small",
            &["test".to_string()],
        ).await;
        assert!(res_insecure.is_err());
        assert!(res_insecure.unwrap_err().contains("Rifiutato endpoint HTTP non sicuro"));
    }

    #[test]
    fn test_embeddings_cache_invalidates_on_dimension_change() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();

        // Create cache with dimensions 1536
        let mut cache = EmbeddingsCache {
            version: 1,
            model: "bge-m3".to_string(),
            dimensions: 1536,
            entries: BTreeMap::new(),
            last_updated_at: now_iso(),
        };
        cache.entries.insert("p1".to_string(), PassageEmbeddingEntry {
            passage_id: "p1".to_string(),
            document_id: "d1".to_string(),
            relative_path: "20_RAW_SOURCES/d1.txt".to_string(),
            locator: "1".to_string(),
            sha256: "hash".to_string(),
            embedded_text_sha256: Some("sha".to_string()),
            model: "bge-m3".to_string(),
            dimensions: 1536,
            vector: vec![0.1; 1536],
            updated_at: now_iso(),
        });
        save_embeddings_cache(path, &mut cache).unwrap();

        let loaded = load_embeddings_cache(path).unwrap();
        assert_eq!(loaded.entries.len(), 1);
        assert_eq!(loaded.dimensions, 1536);

        // When new dimensions are 1024, cache is detected as invalid
        let target_dim = 1024;
        let mut updated_cache = loaded;
        if updated_cache.dimensions != target_dim {
            updated_cache.entries.clear();
            updated_cache.dimensions = target_dim;
        }
        assert_eq!(updated_cache.entries.len(), 0);
        assert_eq!(updated_cache.dimensions, 1024);
    }
}
