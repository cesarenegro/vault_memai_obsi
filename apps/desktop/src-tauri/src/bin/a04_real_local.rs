use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;
use serde::{Deserialize, Serialize};
use serde_json::json;

use limen_vault::catalog::load_catalog;
use limen_vault::embeddings::{
    fetch_openai_embeddings_with_endpoint,
    hybrid_search_vault_with_vector,
    load_embeddings_cache,
    rank_document_semantic,
    resolve_embeddings_endpoint,
    sync_embeddings_with_port,
};
use limen_vault::search::{index_vault_search, SearchQuery, SearchResultItem};

#[derive(Debug, Deserialize)]
struct A04Query {
    #[serde(rename = "queryId")]
    query_id: String,
    text: String,
    #[serde(rename = "relevantDocumentIds")]
    relevant_document_ids: Vec<String>,
    #[serde(default)]
    _sessione: Option<String>,
    #[serde(default)]
    _origine: Option<String>,
}

#[derive(Debug, Serialize)]
struct ModalityEval {
    rank: Option<usize>,
    score: f32,
    hit_at_1: bool,
    hit_at_10: bool,
    is_tie_at_1: bool,
    tie_group_size_at_1: usize,
    top10: Vec<Top10Item>,
}

#[derive(Debug, Serialize)]
struct Top10Item {
    rank: usize,
    relative_path: String,
    title: String,
    score: f32,
}

#[derive(Debug, Serialize)]
struct PerQueryRecord {
    #[serde(rename = "queryId")]
    query_id: String,
    text: String,
    sessione: Option<String>,
    origine: Option<String>,
    #[serde(rename = "relevantDocumentIds")]
    relevant_document_ids: Vec<String>,
    lexical: ModalityEval,
    semantic: ModalityEval,
    hybrid: ModalityEval,
}

fn get_git_sha() -> String {
    Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn evaluate_candidates(
    candidates: &[(String, String, String, f32)], // (id, relative_path, title, score)
    rel_doc_ids: &[String],
) -> ModalityEval {
    let is_match = |cand_id: &str, cand_path: &str, cand_title: &str| -> bool {
        rel_doc_ids.iter().any(|rel| {
            cand_path.ends_with(rel)
                || cand_title == rel
                || cand_id == rel
                || cand_path.strip_prefix("20_RAW_SOURCES/").unwrap_or(cand_path) == rel
        })
    };

    let mut rank = None;
    for (idx, (doc_id, path, title, _score)) in candidates.iter().take(50).enumerate() {
        if is_match(doc_id, path, title) {
            rank = Some(idx + 1);
            break;
        }
    }

    let top10: Vec<Top10Item> = candidates
        .iter()
        .take(10)
        .enumerate()
        .map(|(idx, (_, path, title, score))| Top10Item {
            rank: idx + 1,
            relative_path: path.clone(),
            title: title.clone(),
            score: (score * 10000.0).round() / 10000.0,
        })
        .collect();

    let hit_at_1 = rank.map_or(false, |r| r == 1);
    let hit_at_10 = rank.map_or(false, |r| r <= 10);

    let mut is_tie_at_1 = false;
    let mut tie_group_size_at_1 = 1;

    if candidates.len() >= 2 {
        let s0 = candidates[0].3;
        let s1 = candidates[1].3;
        if (s0 - s1).abs() < 1e-4 {
            is_tie_at_1 = true;
            tie_group_size_at_1 = candidates
                .iter()
                .filter(|c| (c.3 - s0).abs() < 1e-4)
                .count();
        }
    }

    let best_score = candidates.first().map(|c| c.3).unwrap_or(0.0);

    ModalityEval {
        rank,
        score: (best_score * 10000.0).round() / 10000.0,
        hit_at_1,
        hit_at_10,
        is_tie_at_1,
        tie_group_size_at_1,
        top10,
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let git_sha = get_git_sha();
    let runtime_start_iso = chrono::Utc::now().to_rfc3339();

    println!("================================================================================");
    println!("A04 BENCHMARK: RAG 100% LOCALE SU CORPUS REALE (56 DOCUMENTI, 4.633 PASSAGGI)");
    println!("Commit SHA: {}", git_sha);
    println!("Runtime Timestamp: {}", runtime_start_iso);
    println!("================================================================================");

    let vault_path = PathBuf::from("/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/scratch/real_vault_v1");
    let queries_path = PathBuf::from("/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A04_REAL_QUERIES.json");
    // Cartella delle evidenze: da LIMEN_EVIDENCE_DIR, altrimenti la corsa V3 (BM25).
    let evidence_dir = PathBuf::from(
        std::env::var("LIMEN_EVIDENCE_DIR").unwrap_or_else(|_| "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A04_REAL_LOCAL_V3_BM25".to_string()),
    );
    // Porta del llama-server locale gia' avviato (obbligatoria): l'endpoint non e' persistito, va fornito.
    let local_port: u16 = std::env::var("LIMEN_LOCAL_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .ok_or("Variabile LIMEN_LOCAL_PORT mancante: indicare la porta del llama-server locale in ascolto su 127.0.0.1")?;

    fs::create_dir_all(&evidence_dir)?;

    // 1. Re-index search index with C11 fix (remove old cache to re-tokenize with tf)
    let search_index_file = vault_path.join("00_SYSTEM/SEARCH_INDEX.json");
    if search_index_file.exists() {
        println!("Removing existing SEARCH_INDEX.json to ensure fresh indexing without token deduplication...");
        fs::remove_file(&search_index_file)?;
    }

    println!("Reindexing vault lexical search with C11 fix...");
    let index_start = Instant::now();
    let index_rep = index_vault_search(&vault_path)?;
    println!(
        "Vault indexed: {} documents in {:.2}s",
        index_rep.total_indexed,
        index_start.elapsed().as_secs_f64()
    );

    // Verify token deduplication is eliminated in the new index
    let catalog = load_catalog(&vault_path)?;
    println!("Catalog loaded: {} documents", catalog.documents.len());

    let endpoint = format!("http://127.0.0.1:{}/v1/embeddings", local_port);
    let _ = resolve_embeddings_endpoint(&vault_path);
    println!("Embeddings endpoint (porta fornita): {}", endpoint);

    let rt = tokio::runtime::Runtime::new()?;

    // 2. Synchronize embeddings via local llama-server (bge-m3)
    println!("Calculating local embeddings via llama-server (model bge-m3, 1024d)...");
    let emb_calc_start = Instant::now();
    let status_rep = rt.block_on(sync_embeddings_with_port(&vault_path, "", Some("bge-m3"), Some(local_port)))?;
    let elapsed = emb_calc_start.elapsed();
    // Tempo REALE misurato in questa corsa (con cache completa e' quasi zero: nessun ricalcolo).
    let emb_calc_duration_secs = (elapsed.as_secs_f64() * 100.0).round() / 100.0;
    println!(
        "Embeddings synchronization complete: {}/{} passages cached (measured calculation time: {:.2}s)",
        status_rep.cached_passages,
        status_rep.total_passages,
        emb_calc_duration_secs
    );
    println!("Model: {}, Dimensions: {}", status_rep.model, status_rep.dimensions);

    let cache = load_embeddings_cache(&vault_path)?;
    println!("Loaded cache with {} entries, dimensions {}", cache.entries.len(), cache.dimensions);

    // 3. Load queries
    let q_content = fs::read_to_string(&queries_path)?;
    let queries: Vec<A04Query> = serde_json::from_str(&q_content)?;
    println!("Loaded {} evaluation queries from {:?}", queries.len(), queries_path);

    // 4. Batch fetch embeddings for evaluation queries
    let query_texts: Vec<String> = queries.iter().map(|q| q.text.clone()).collect();
    println!("Fetching embeddings for {} query texts from {}...", query_texts.len(), endpoint);
    let q_fetch_start = Instant::now();
    let query_vectors = rt.block_on(fetch_openai_embeddings_with_endpoint(
        &endpoint,
        "",
        "bge-m3",
        &query_texts,
    ))?;
    println!(
        "Received {} query vectors in {:.2}s",
        query_vectors.len(),
        q_fetch_start.elapsed().as_secs_f64()
    );

    // 5. Evaluate queries across Lexical, Pure Semantic, and Hybrid
    let mut records: Vec<PerQueryRecord> = Vec::new();

    let mut lex_hits_at_1 = 0;
    let mut lex_hits_at_10 = 0;
    let mut lex_strict_hits_at_1 = 0;
    let mut lex_ties_at_1 = 0;
    let mut lex_max_tie_size = 0;

    let mut sem_hits_at_1 = 0;
    let mut sem_hits_at_10 = 0;
    let mut sem_strict_hits_at_1 = 0;
    let mut sem_ties_at_1 = 0;
    let mut sem_max_tie_size = 0;

    let mut hyb_hits_at_1 = 0;
    let mut hyb_hits_at_10 = 0;
    let mut hyb_strict_hits_at_1 = 0;
    let mut hyb_ties_at_1 = 0;
    let mut hyb_max_tie_size = 0;

    for (idx, q) in queries.iter().enumerate() {
        let q_vec = &query_vectors[idx];

        // --- Modality 1: Lexical ---
        let sq_lex = SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(50),
            ..Default::default()
        };
        let res_lex: Vec<SearchResultItem> = rt.block_on(hybrid_search_vault_with_vector(
            &vault_path,
            sq_lex,
            None,
            false,
        ))?;
        let lex_cands: Vec<(String, String, String, f32)> = res_lex
            .into_iter()
            .map(|r| (r.id, r.relative_path, r.title, r.score as f32))
            .collect();
        let eval_lex = evaluate_candidates(&lex_cands, &q.relevant_document_ids);

        // --- Modality 2: Pure Semantic ---
        let mut sem_cands: Vec<(String, String, String, f32)> = Vec::new();
        for doc in catalog.documents.values() {
            if doc.passages.is_empty() {
                continue;
            }
            let (score, _, _, _) = rank_document_semantic(
                &doc.document_id,
                &doc.passages,
                q_vec,
                &cache,
            );
            sem_cands.push((doc.document_id.clone(), doc.original_path.clone(), doc.file_name.clone(), score));
        }
        sem_cands.sort_by(|a, b| {
            b.3.partial_cmp(&a.3)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.0.cmp(&b.0))
        });
        let eval_sem = evaluate_candidates(&sem_cands, &q.relevant_document_ids);

        // --- Modality 3: Hybrid (F2 k=0.20) ---
        let sq_hyb = SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(50),
            ..Default::default()
        };
        let res_hyb: Vec<SearchResultItem> = rt.block_on(hybrid_search_vault_with_vector(
            &vault_path,
            sq_hyb,
            Some(q_vec.clone()),
            true,
        ))?;
        let hyb_cands: Vec<(String, String, String, f32)> = res_hyb
            .into_iter()
            .map(|r| (r.id, r.relative_path, r.title, r.score as f32))
            .collect();
        let eval_hyb = evaluate_candidates(&hyb_cands, &q.relevant_document_ids);

        // Aggregate stats
        if eval_lex.hit_at_1 { lex_hits_at_1 += 1; }
        if eval_lex.hit_at_10 { lex_hits_at_10 += 1; }
        if eval_lex.is_tie_at_1 {
            lex_ties_at_1 += 1;
            lex_max_tie_size = lex_max_tie_size.max(eval_lex.tie_group_size_at_1);
        } else if eval_lex.hit_at_1 {
            lex_strict_hits_at_1 += 1;
        }

        if eval_sem.hit_at_1 { sem_hits_at_1 += 1; }
        if eval_sem.hit_at_10 { sem_hits_at_10 += 1; }
        if eval_sem.is_tie_at_1 {
            sem_ties_at_1 += 1;
            sem_max_tie_size = sem_max_tie_size.max(eval_sem.tie_group_size_at_1);
        } else if eval_sem.hit_at_1 {
            sem_strict_hits_at_1 += 1;
        }

        if eval_hyb.hit_at_1 { hyb_hits_at_1 += 1; }
        if eval_hyb.hit_at_10 { hyb_hits_at_10 += 1; }
        if eval_hyb.is_tie_at_1 {
            hyb_ties_at_1 += 1;
            hyb_max_tie_size = hyb_max_tie_size.max(eval_hyb.tie_group_size_at_1);
        } else if eval_hyb.hit_at_1 {
            hyb_strict_hits_at_1 += 1;
        }

        records.push(PerQueryRecord {
            query_id: q.query_id.clone(),
            text: q.text.clone(),
            sessione: q._sessione.clone(),
            origine: q._origine.clone(),
            relevant_document_ids: q.relevant_document_ids.clone(),
            lexical: eval_lex,
            semantic: eval_sem,
            hybrid: eval_hyb,
        });
    }

    let n = queries.len() as f64;

    let summary = json!({
        "benchmark": "A04 — RAG 100% Locale su Corpus Reale (56 documenti, 4.633 passaggi)",
        "timestamp": runtime_start_iso,
        "completed_at": chrono::Utc::now().to_rfc3339(),
        "git_commit": git_sha,
        "vault": vault_path.to_string_lossy(),
        "queries_file": queries_path.to_string_lossy(),
        "total_cases": queries.len(),
        "model": status_rep.model,
        "dimensions": status_rep.dimensions,
        "embeddings_endpoint": endpoint,
        "embedding_calculation_time_seconds": emb_calc_duration_secs,
        "total_passages": status_rep.total_passages,
        "cached_passages": status_rep.cached_passages,
        "modalities": {
            "lexical": {
                "precision_at_1_apparent": lex_hits_at_1 as f64 / n,
                "precision_at_1_net": lex_strict_hits_at_1 as f64 / n,
                "recall_at_10": lex_hits_at_10 as f64 / n,
                "hits_at_1": lex_hits_at_1,
                "strict_hits_at_1": lex_strict_hits_at_1,
                "hits_at_10": lex_hits_at_10,
                "ties_at_rank_1_count": lex_ties_at_1,
                "ties_at_rank_1_pct": (lex_ties_at_1 as f64 / n) * 100.0,
                "max_tie_group_size": lex_max_tie_size
            },
            "semantic": {
                "precision_at_1_apparent": sem_hits_at_1 as f64 / n,
                "precision_at_1_net": sem_strict_hits_at_1 as f64 / n,
                "recall_at_10": sem_hits_at_10 as f64 / n,
                "hits_at_1": sem_hits_at_1,
                "strict_hits_at_1": sem_strict_hits_at_1,
                "hits_at_10": sem_hits_at_10,
                "ties_at_rank_1_count": sem_ties_at_1,
                "ties_at_rank_1_pct": (sem_ties_at_1 as f64 / n) * 100.0,
                "max_tie_group_size": sem_max_tie_size
            },
            "hybrid": {
                "precision_at_1_apparent": hyb_hits_at_1 as f64 / n,
                "precision_at_1_net": hyb_strict_hits_at_1 as f64 / n,
                "recall_at_10": hyb_hits_at_10 as f64 / n,
                "hits_at_1": hyb_hits_at_1,
                "strict_hits_at_1": hyb_strict_hits_at_1,
                "hits_at_10": hyb_hits_at_10,
                "ties_at_rank_1_count": hyb_ties_at_1,
                "ties_at_rank_1_pct": (hyb_ties_at_1 as f64 / n) * 100.0,
                "max_tie_group_size": hyb_max_tie_size
            }
        }
    });

    // Write summary.json
    let summary_path = evidence_dir.join("summary.json");
    fs::write(&summary_path, serde_json::to_string_pretty(&summary)?)?;
    println!("Saved summary to {:?}", summary_path);

    // Write per-query.jsonl
    let per_query_path = evidence_dir.join("per-query.jsonl");
    let mut f_lines = Vec::new();
    for r in &records {
        f_lines.push(serde_json::to_string(r)?);
    }
    fs::write(&per_query_path, f_lines.join("\n") + "\n")?;
    println!("Saved per-query records to {:?}", per_query_path);

    // Print readable summary
    println!("\n================================================================================");
    println!("RISULTATI BENCHMARK A04 (CORPUS REALE, 82 CASI):");
    println!("Embedding model: {}, Dimensions: {}, Calcolato in: {:.2}s", status_rep.model, status_rep.dimensions, emb_calc_duration_secs);
    println!("--------------------------------------------------------------------------------");
    println!(
        "LESSICALE (con C11 corretto): P@1 apparente = {:.3} ({}/{}), P@1 netta = {:.3} ({}/{}), R@10 = {:.3} ({}/{}), Pari merito rango 1 = {} ({:.1}%), Max tie size = {}",
        lex_hits_at_1 as f64 / n, lex_hits_at_1, queries.len(),
        lex_strict_hits_at_1 as f64 / n, lex_strict_hits_at_1, queries.len(),
        lex_hits_at_10 as f64 / n, lex_hits_at_10, queries.len(),
        lex_ties_at_1, (lex_ties_at_1 as f64 / n) * 100.0,
        lex_max_tie_size
    );
    println!(
        "SEMANTICO (bge-m3 100% locale): P@1 apparente = {:.3} ({}/{}), P@1 netta = {:.3} ({}/{}), R@10 = {:.3} ({}/{}), Pari merito rango 1 = {} ({:.1}%), Max tie size = {}",
        sem_hits_at_1 as f64 / n, sem_hits_at_1, queries.len(),
        sem_strict_hits_at_1 as f64 / n, sem_strict_hits_at_1, queries.len(),
        sem_hits_at_10 as f64 / n, sem_hits_at_10, queries.len(),
        sem_ties_at_1, (sem_ties_at_1 as f64 / n) * 100.0,
        sem_max_tie_size
    );
    println!(
        "IBRIDO (F2 k=0.20 locale): P@1 apparente = {:.3} ({}/{}), P@1 netta = {:.3} ({}/{}), R@10 = {:.3} ({}/{}), Pari merito rango 1 = {} ({:.1}%), Max tie size = {}",
        hyb_hits_at_1 as f64 / n, hyb_hits_at_1, queries.len(),
        hyb_strict_hits_at_1 as f64 / n, hyb_strict_hits_at_1, queries.len(),
        hyb_hits_at_10 as f64 / n, hyb_hits_at_10, queries.len(),
        hyb_ties_at_1, (hyb_ties_at_1 as f64 / n) * 100.0,
        hyb_max_tie_size
    );
    println!("================================================================================");

    Ok(())
}
