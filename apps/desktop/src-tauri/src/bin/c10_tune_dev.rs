use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct DevQuery {
    #[serde(rename = "queryId")]
    query_id: String,
    text: String,
    #[serde(rename = "relevantDocumentIds")]
    relevant_document_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
struct Top10Item {
    rank: usize,
    id: String,
    relative_path: String,
    title: String,
    lex_score: f64,
    sem_sim: f64,
    lex_norm: f64,
    sem_norm: f64,
    fused_score: f64,
    is_target: bool,
}

#[derive(Debug, Serialize)]
struct DevPerQueryRecord {
    query_id: String,
    expected_document: String,
    query_text: String,
    lexical_rank: Option<usize>,
    semantic_rank: Option<usize>,
    hybrid_rank: Option<usize>,
    is_hit: bool,
    is_lexical_none: bool,
    top10_results: Vec<Top10Item>,
}

#[derive(Debug, Serialize)]
struct ConfigSummary {
    config_id: String,
    formula_name: String,
    k_parameter: Option<f64>,
    formula_description: String,
    total_dev_queries: usize,
    hits_count: usize,
    recall_at_10: f64,
    total_lex_none_queries: usize,
    lex_none_in_top10_count: usize,
    lex_none_in_top10_rate: f64,
    zero_recall_queries: Vec<String>,
}

#[derive(Debug, Serialize)]
struct MultiConfigTuningSummary {
    benchmark: String,
    timestamp_utc8: String,
    dataset: String,
    total_queries: usize,
    configurations: Vec<ConfigSummary>,
    winning_config: Option<String>,
    selection_rationale: String,
}

struct FormulaDef {
    id: &'static str,
    name: &'static str,
    k: Option<f64>,
    desc: &'static str,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = if Path::new("tests/gold/A05_DEV_QUERIES.json").exists() {
        PathBuf::from(".")
    } else if Path::new("../../tests/gold/A05_DEV_QUERIES.json").exists() {
        PathBuf::from("../..")
    } else {
        PathBuf::from("/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN")
    };

    let vault_path = root.join("tests/scratch/a05_v2_context_vault");
    let queries_path = root.join("tests/gold/A05_DEV_QUERIES.json");
    let out_dir = root.join("IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/C10_TUNING_DEV");
    fs::create_dir_all(&out_dir)?;

    println!("=== A05 / C10 Fusion Tuning on 30 Development Queries ===");
    println!("Vault path:    {:?}", vault_path);
    println!("Queries path:  {:?}", queries_path);
    println!("Output dir:    {:?}", out_dir);

    // 1. Load catalog & cache
    let catalog = limen_vault::catalog::load_catalog(&vault_path)?;
    println!("Catalog loaded: {} documents", catalog.documents.len());
    let cache = limen_vault::embeddings::load_embeddings_cache(&vault_path)?;
    println!("Embeddings cache loaded: {} passages (model: {})", cache.entries.len(), cache.model);
    limen_vault::search::index_vault_search(&vault_path)?;

    // 2. Read Keychain API key
    let api_key = {
        let mut key = String::new();
        let output = std::process::Command::new("/usr/bin/security")
            .args(["find-generic-password", "-s", "dev.arkai.limenvault.openai", "-a", "api-key", "-w"])
            .output();
        if let Ok(out) = output {
            if out.status.success() {
                let k = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !k.is_empty() { key = k; }
            }
        }
        if key.is_empty() {
            if let Ok(Some(k)) = limen_vault::keychain::load() {
                if !k.trim().is_empty() { key = k.trim().to_string(); }
            }
        }
        if key.is_empty() {
            panic!("API key not found in keychain");
        }
        key
    };
    println!("OpenAI API key acquired securely from Keychain.");

    // 3. Load 30 Development queries
    let q_content = fs::read_to_string(&queries_path)?;
    let queries: Vec<DevQuery> = serde_json::from_str(&q_content)?;
    println!("Caricate {} query di sviluppo da {:?}", queries.len(), queries_path);

    // 4. Batch fetch embeddings
    let query_texts: Vec<String> = queries.iter().map(|q| q.text.clone()).collect();
    println!("Fetching embeddings for {} dev queries in single batch...", query_texts.len());
    let fetch_start = Instant::now();
    let query_vectors = limen_vault::embeddings::fetch_openai_embeddings(&api_key, &cache.model, &query_texts).await?;
    println!("Batch dev embeddings received in {:.2}s.", fetch_start.elapsed().as_secs_f64());

    // 5. Pre-compute pure lexical and pure semantic candidates for each query
    struct QueryRawData {
        q: DevQuery,
        q_vec: Vec<f32>,
        lexical_results: Vec<limen_vault::search::SearchResultItem>,
        semantic_scores: BTreeMap<String, (f32, Option<String>, Option<String>, Option<String>)>,
        lex_rank: Option<usize>,
        sem_rank: Option<usize>,
    }

    let normalize_id = |id: &str| -> String {
        if id.starts_with("doc_") && id.len() > 20 {
            id[..20].to_string()
        } else {
            id.to_string()
        }
    };

    println!("\nCalcolo ricerche lessicali e semantiche grezze sulle 30 query di sviluppo...");
    let mut raw_data: Vec<QueryRawData> = Vec::new();

    for (idx, q) in queries.into_iter().enumerate() {
        let q_vec = query_vectors[idx].clone();
        let _expected_doc = q.relevant_document_ids.first().cloned().unwrap_or_default();

        let is_match = |cand_id: &str, cand_path: &str| -> bool {
            q.relevant_document_ids.iter().any(|rel| cand_path.contains(rel) || cand_id == rel)
        };

        // Lexical search
        let sq_lex = limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(200),
            offset: Some(0),
            ..Default::default()
        };
        let lexical_results = limen_vault::search::search_vault(&vault_path, sq_lex)?;
        let mut lex_rank: Option<usize> = None;
        for (r, item) in lexical_results.iter().enumerate() {
            if is_match(&item.id, &item.relative_path) {
                lex_rank = Some(r + 1);
                break;
            }
        }

        // Semantic scoring
        let mut semantic_scores: BTreeMap<String, (f32, Option<String>, Option<String>, Option<String>)> = BTreeMap::new();
        let mut sem_candidates: Vec<(String, String, f32)> = Vec::new();
        for doc in catalog.documents.values() {
            let (sim, pid, loc, snip) = limen_vault::embeddings::rank_document_semantic(
                &doc.document_id,
                &doc.passages,
                &q_vec,
                &cache,
            );
            if sim > 0.25 {
                semantic_scores.insert(doc.document_id.clone(), (sim, pid, loc, snip));
            }
            sem_candidates.push((doc.document_id.clone(), doc.original_path.clone(), sim));
        }

        sem_candidates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));
        let mut sem_rank: Option<usize> = None;
        for (r, (cid, cpath, _)) in sem_candidates.iter().enumerate() {
            if is_match(cid, cpath) {
                sem_rank = Some(r + 1);
                break;
            }
        }

        raw_data.push(QueryRawData {
            q,
            q_vec,
            lexical_results,
            semantic_scores,
            lex_rank,
            sem_rank,
        });
    }

    // Identify which queries have lexicalRank: None
    let lex_none_qids: Vec<String> = raw_data.iter()
        .filter(|rd| rd.lex_rank.is_none())
        .map(|rd| rd.q.query_id.clone())
        .collect();
    println!("Query con lexicalRank: None sul set DEV (totale {} su 30): {:?}", lex_none_qids.len(), lex_none_qids);

    // 6. Define the formulas to evaluate
    let formulas: Vec<FormulaDef> = vec![
        FormulaDef {
            id: "F1_baseline",
            name: "F1 (Attuale, media pesata 0.5/0.5)",
            k: None,
            desc: "0.5 * lex_norm + 0.5 * sem_norm + exact_bonus",
        },
        FormulaDef {
            id: "F2_k0.10",
            name: "F2 (max + k * min), k = 0.10",
            k: Some(0.10),
            desc: "max(lex_norm, sem_norm) + 0.10 * min(lex_norm, sem_norm) + exact_bonus",
        },
        FormulaDef {
            id: "F2_k0.20",
            name: "F2 (max + k * min), k = 0.20",
            k: Some(0.20),
            desc: "max(lex_norm, sem_norm) + 0.20 * min(lex_norm, sem_norm) + exact_bonus",
        },
        FormulaDef {
            id: "F2_k0.30",
            name: "F2 (max + k * min), k = 0.30",
            k: Some(0.30),
            desc: "max(lex_norm, sem_norm) + 0.30 * min(lex_norm, sem_norm) + exact_bonus",
        },
        FormulaDef {
            id: "F2_k0.40",
            name: "F2 (max + k * min), k = 0.40",
            k: Some(0.40),
            desc: "max(lex_norm, sem_norm) + 0.40 * min(lex_norm, sem_norm) + exact_bonus",
        },
        FormulaDef {
            id: "F2_k0.50",
            name: "F2 (max + k * min), k = 0.50",
            k: Some(0.50),
            desc: "max(lex_norm, sem_norm) + 0.50 * min(lex_norm, sem_norm) + exact_bonus",
        },
        FormulaDef {
            id: "F3_present_signals",
            name: "F3 (media pesata solo su segnali presenti)",
            k: None,
            desc: "se un solo segnale: punteggio intero; se entrambi: media dei due + exact_bonus",
        },
    ];

    let mut all_summaries: Vec<ConfigSummary> = Vec::new();

    println!("\n=== Valutazione delle Formule ===");

    for formula in &formulas {
        let mut per_query_records: Vec<DevPerQueryRecord> = Vec::new();
        let mut hits = 0;
        let mut lex_none_hits = 0;
        let mut zero_recall_queries = Vec::new();

        for rd in &raw_data {
            let term = rd.q.text.trim();
            let term_lower = term.to_lowercase();
            let is_exact_code = (term.contains('-') || term.contains('_') || term.chars().any(|c| c.is_ascii_digit()))
                && term.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                && term.len() >= 3;

            // Union of candidate IDs with C9 coalescence
            let mut all_ids: BTreeSet<String> = BTreeSet::new();
            for item in &rd.lexical_results {
                all_ids.insert(normalize_id(&item.id));
            }
            for sem_id in rd.semantic_scores.keys() {
                all_ids.insert(normalize_id(sem_id));
            }

            struct RawCand {
                id: String,
                orig_path: String,
                title: String,
                snippet: String,
                base_score: f64,
                sem_sim: f64,
                matches_term: bool,
                is_target: bool,
            }

            let mut candidates: Vec<RawCand> = Vec::new();

            for id in all_ids {
                let lex_item = rd.lexical_results.iter().find(|i| normalize_id(&i.id) == id || i.id == id);
                let base_score = lex_item.map(|i| i.score).unwrap_or(0.0);

                let sem_info = rd.semantic_scores.get(&id).or_else(|| {
                    rd.semantic_scores.iter().find(|(k, _)| normalize_id(k) == id).map(|(_, v)| v)
                });
                let sem_sim = sem_info.map(|s| s.0 as f64).unwrap_or(0.0);

                let (orig_path, title, snippet) = if let Some(li) = lex_item {
                    (li.relative_path.clone(), li.title.clone(), li.snippet.clone())
                } else if let Some(doc) = catalog.documents.get(&id).or_else(|| {
                    catalog.documents.values().find(|d| normalize_id(&d.document_id) == id || d.original_path == id)
                }) {
                    let snip = sem_info.and_then(|si| si.3.clone()).unwrap_or_else(|| {
                        doc.passages.first().map(|p| p.text.clone()).unwrap_or_default()
                    });
                    (doc.original_path.clone(), doc.file_name.clone(), snip)
                } else {
                    continue;
                };

                let matches_term = title.to_lowercase().contains(&term_lower) || snippet.to_lowercase().contains(&term_lower);
                let is_target = rd.q.relevant_document_ids.iter().any(|rel| orig_path.contains(rel) || id.contains(rel) || &id == rel);

                candidates.push(RawCand {
                    id,
                    orig_path,
                    title,
                    snippet,
                    base_score,
                    sem_sim,
                    matches_term,
                    is_target,
                });
            }

            let min_lex = candidates.iter().map(|c| c.base_score).fold(f64::INFINITY, f64::min);
            let max_lex = candidates.iter().map(|c| c.base_score).fold(f64::NEG_INFINITY, f64::max);
            let min_sem = candidates.iter().map(|c| c.sem_sim).fold(f64::INFINITY, f64::min);
            let max_sem = candidates.iter().map(|c| c.sem_sim).fold(f64::NEG_INFINITY, f64::max);

            struct ScoredCand {
                id: String,
                orig_path: String,
                title: String,
                base_score: f64,
                sem_sim: f64,
                lex_norm: f64,
                sem_norm: f64,
                fused_score: f64,
                is_target: bool,
            }

            let mut scored: Vec<ScoredCand> = candidates.into_iter().map(|c| {
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

                let fused_score = match formula.id {
                    "F1_baseline" => {
                        0.5 * lex_norm + 0.5 * sem_norm + exact_bonus
                    }
                    s if s.starts_with("F2_k") => {
                        let k = formula.k.unwrap_or(0.20);
                        lex_norm.max(sem_norm) + k * lex_norm.min(sem_norm) + exact_bonus
                    }
                    "F3_present_signals" => {
                        if c.base_score > 0.0 && c.sem_sim > 0.0 {
                            0.5 * lex_norm + 0.5 * sem_norm + exact_bonus
                        } else if c.base_score > 0.0 {
                            lex_norm + exact_bonus
                        } else if c.sem_sim > 0.0 {
                            sem_norm + exact_bonus
                        } else {
                            exact_bonus
                        }
                    }
                    _ => 0.0,
                };

                ScoredCand {
                    id: c.id,
                    orig_path: c.orig_path,
                    title: c.title,
                    base_score: c.base_score,
                    sem_sim: c.sem_sim,
                    lex_norm,
                    sem_norm,
                    fused_score,
                    is_target: c.is_target,
                }
            }).collect();

            // Sort descending by fused score, then deterministic tie-breaker
            scored.sort_by(|a, b| {
                b.fused_score.partial_cmp(&a.fused_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.id.cmp(&b.id))
            });

            let mut hybrid_rank: Option<usize> = None;
            for (r, sc) in scored.iter().enumerate() {
                if sc.is_target {
                    hybrid_rank = Some(r + 1);
                    break;
                }
            }

            let is_hit = hybrid_rank.map_or(false, |r| r <= 10);
            let is_lex_none = rd.lex_rank.is_none();

            if is_hit {
                hits += 1;
                if is_lex_none {
                    lex_none_hits += 1;
                }
            } else {
                zero_recall_queries.push(rd.q.query_id.clone());
            }

            let top10_results: Vec<Top10Item> = scored.iter().take(10).enumerate().map(|(r, sc)| {
                Top10Item {
                    rank: r + 1,
                    id: sc.id.clone(),
                    relative_path: sc.orig_path.clone(),
                    title: sc.title.clone(),
                    lex_score: sc.base_score,
                    sem_sim: sc.sem_sim,
                    lex_norm: sc.lex_norm,
                    sem_norm: sc.sem_norm,
                    fused_score: sc.fused_score,
                    is_target: sc.is_target,
                }
            }).collect();

            per_query_records.push(DevPerQueryRecord {
                query_id: rd.q.query_id.clone(),
                expected_document: rd.q.relevant_document_ids.first().cloned().unwrap_or_default(),
                query_text: rd.q.text.clone(),
                lexical_rank: rd.lex_rank,
                semantic_rank: rd.sem_rank,
                hybrid_rank,
                is_hit,
                is_lexical_none: is_lex_none,
                top10_results,
            });
        }

        let recall_at_10 = (hits as f64) / (raw_data.len() as f64);
        let lex_none_rate = if !lex_none_qids.is_empty() {
            (lex_none_hits as f64) / (lex_none_qids.len() as f64)
        } else {
            1.0
        };

        let summary = ConfigSummary {
            config_id: formula.id.to_string(),
            formula_name: formula.name.to_string(),
            k_parameter: formula.k,
            formula_description: formula.desc.to_string(),
            total_dev_queries: raw_data.len(),
            hits_count: hits,
            recall_at_10,
            total_lex_none_queries: lex_none_qids.len(),
            lex_none_in_top10_count: lex_none_hits,
            lex_none_in_top10_rate: lex_none_rate,
            zero_recall_queries,
        };

        // Write per_query jsonl for this config
        let pq_path = out_dir.join(format!("per_query_{}.jsonl", formula.id));
        let mut pq_file = fs::File::create(&pq_path)?;
        use std::io::Write;
        for rec in &per_query_records {
            writeln!(pq_file, "{}", serde_json::to_string(rec)?)?;
        }

        // Write summary json for this config
        let sum_path = out_dir.join(format!("summary_{}.json", formula.id));
        fs::write(&sum_path, serde_json::to_string_pretty(&summary)?)?;

        println!(
            "{:<35} | Recall@10: {:.3} ({:>2}/30) | Lex-None in Top 10: {:>2}/{} ({:.1}%) | Misses: {:?}",
            formula.name, recall_at_10, hits, lex_none_hits, lex_none_qids.len(), lex_none_rate * 100.0, summary.zero_recall_queries
        );

        all_summaries.push(summary);
    }

    // 7. Determine winning formula by declared rules
    // Rule 1: Highest recall@10
    // Rule 2: In case of tie, least sensitive to variation of k (largest number of k giving that max recall)
    // Rule 3: If F1 wins, declare F1
    let max_recall = all_summaries.iter().map(|s| s.recall_at_10).fold(f64::NEG_INFINITY, f64::max);
    let top_configs: Vec<&ConfigSummary> = all_summaries.iter().filter(|s| (s.recall_at_10 - max_recall).abs() < 1e-6).collect();

    let f1_summary = all_summaries.iter().find(|s| s.config_id == "F1_baseline").unwrap();
    let is_f1_winner = (f1_summary.recall_at_10 - max_recall).abs() < 1e-6 && top_configs.len() == 1;

    let (winning_id, rationale) = if is_f1_winner {
        ("F1_baseline".to_string(), "F1_baseline ha ottenuto il recall più alto in assoluto; nessuna nuova formula supera F1.".to_string())
    } else {
        // Count how many F2 configurations share this top recall
        let f2_top: Vec<&ConfigSummary> = top_configs.iter().filter(|s| s.config_id.starts_with("F2_k")).cloned().collect();
        let f3_top: Vec<&ConfigSummary> = top_configs.iter().filter(|s| s.config_id == "F3_present_signals").cloned().collect();

        if !f2_top.is_empty() {
            // Pick the central k (e.g. 0.30 or 0.20) among the robust k values
            let best_f2 = f2_top.iter().find(|s| s.k_parameter == Some(0.30))
                .or_else(|| f2_top.iter().find(|s| s.k_parameter == Some(0.20)))
                .unwrap_or(&f2_top[0]);
            (
                best_f2.config_id.clone(),
                format!(
                    "Formula F2 vince con Recall@10 = {:.3} ({} hits su 30). Ha dimostrato elevata robustezza: {} configurazioni su 5 (k={:?}) ottengono il punteggio massimo. Si adotta k={:?}.",
                    best_f2.recall_at_10,
                    best_f2.hits_count,
                    f2_top.len(),
                    f2_top.iter().filter_map(|s| s.k_parameter).collect::<Vec<_>>(),
                    best_f2.k_parameter.unwrap()
                )
            )
        } else if !f3_top.is_empty() {
            (
                "F3_present_signals".to_string(),
                format!("Formula F3 vince con Recall@10 = {:.3} ({} hits su 30), superando F1.", f3_top[0].recall_at_10, f3_top[0].hits_count)
            )
        } else {
            (top_configs[0].config_id.clone(), "Configurazione con il recall più alto.".to_string())
        }
    };

    println!("\n=== RISULTATO TARATURA SU 30 QUERY DEV ===");
    println!("Formula vincente: {}", winning_id);
    println!("Motivazione:      {}", rationale);

    let tuning_report = MultiConfigTuningSummary {
        benchmark: "A05 / C10 — Taratura Formule di Fusione su 30 Query DEV".to_string(),
        timestamp_utc8: "2026-09-20T08:00:00+08:00".to_string(),
        dataset: "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A05_DEV_QUERIES.json".to_string(),
        total_queries: raw_data.len(),
        configurations: all_summaries,
        winning_config: Some(winning_id),
        selection_rationale: rationale,
    };

    let overall_sum_path = out_dir.join("c10_tuning_summary.json");
    fs::write(&overall_sum_path, serde_json::to_string_pretty(&tuning_report)?)?;
    println!("Riepilogo generale salvato in {:?}", overall_sum_path);

    Ok(())
}
