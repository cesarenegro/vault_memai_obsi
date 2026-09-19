use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct A05Query {
    #[serde(rename = "queryId")]
    query_id: String,
    text: String,
    #[serde(rename = "relevantDocumentIds")]
    relevant_document_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
struct C9QueryDuplicateReport {
    query_id: String,
    expected_document: String,
    top10_total_rows: usize,
    top10_distinct_docs_count: usize,
    top10_duplicate_rows_count: usize,
    has_duplicates: bool,
    duplicate_doc_paths: Vec<String>,
    top10_details: Vec<Top10ItemDetail>,
}

#[derive(Debug, Serialize)]
struct Top10ItemDetail {
    rank: usize,
    id: String,
    relative_path: String,
    title: String,
    score: f64,
    is_duplicate: bool,
    is_target: bool,
}

#[derive(Debug, Serialize)]
struct C9SummaryReport {
    benchmark: String,
    timestamp_utc8: String,
    total_queries: usize,
    queries_with_duplicates_count: usize,
    queries_with_full_10_distinct_count: usize,
    total_duplicate_rows_in_top10_all_queries: usize,
    queries_with_duplicates_list: Vec<String>,
}

#[derive(Debug, Serialize)]
struct CounterfactualQueryDetail {
    query_id: String,
    target_doc: String,
    uncoalesced_hybrid_rank: Option<usize>,
    uncoalesced_fused_score: f64,
    counterfactual_coalesced_rank: usize,
    counterfactual_fused_score: f64,
    entered_top_10: bool,
    competitors_ahead: Vec<CounterfactualCompetitor>,
}

#[derive(Debug, Serialize)]
struct CounterfactualCompetitor {
    rank: usize,
    doc_path: String,
    title: String,
    raw_lex: f64,
    raw_sem: f64,
    lex_norm: f64,
    sem_norm: f64,
    fused_score: f64,
    is_target: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let root = if std::path::Path::new("tests/scratch/a05_v2_context_vault").exists() {
        std::path::PathBuf::from(".")
    } else if std::path::Path::new("../../tests/scratch/a05_v2_context_vault").exists() {
        std::path::PathBuf::from("../..")
    } else {
        std::path::PathBuf::from("/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN")
    };

    let vault_path = if args.len() > 1 {
        std::path::PathBuf::from(&args[1])
    } else {
        root.join("tests/scratch/a05_v2_context_vault")
    };
    let queries_path = if args.len() > 2 {
        std::path::PathBuf::from(&args[2])
    } else {
        root.join("tests/gold/A05_QUERIES.json")
    };
    let out_dir = if args.len() > 3 {
        std::path::PathBuf::from(&args[3])
    } else {
        root.join("IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/C9_DUPLICATI")
    };
    fs::create_dir_all(&out_dir)?;

    let vault_path = fs::canonicalize(&vault_path)?;
    let queries_path = fs::canonicalize(&queries_path)?;
    let out_dir = fs::canonicalize(&out_dir)?;

    println!("=== LIMEN Vault — Diagnostica C8/C9 e Misura Duplicati Top 10 ===");
    println!("Vault: {:?}", vault_path);
    println!("Queries: {:?}", queries_path);
    println!("Output dir: {:?}", out_dir);

    let catalog = limen_vault::catalog::load_catalog(&vault_path)?;
    let cache = limen_vault::embeddings::load_embeddings_cache(&vault_path)?;
    limen_vault::search::index_vault_search(&vault_path)?;

    let api_key = {
        let mut key = String::new();
        let output = std::process::Command::new("/usr/bin/security")
            .args(["find-generic-password", "-s", "dev.arkai.limenvault.openai", "-a", "api-key", "-w"])
            .output();
        if let Ok(out) = output {
            if out.status.success() {
                let k = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !k.is_empty() {
                    key = k;
                }
            }
        }
        if key.is_empty() {
            if let Ok(Some(k)) = limen_vault::keychain::load() {
                if !k.trim().is_empty() {
                    key = k.trim().to_string();
                }
            }
        }
        if key.is_empty() {
            panic!("API key not found in keychain");
        }
        key
    };
    println!("OpenAI API key acquired securely from Keychain.");

    let q_content = fs::read_to_string(queries_path)?;
    let all_queries: Vec<A05Query> = serde_json::from_str(&q_content)?;
    println!("Caricate {} query gold.", all_queries.len());

    let query_texts: Vec<String> = all_queries.iter().map(|q| q.text.clone()).collect();
    println!("Fetching embeddings for {} gold queries in single batch from OpenAI...", query_texts.len());
    let query_vectors = limen_vault::embeddings::fetch_openai_embeddings(
        &api_key,
        &cache.model,
        &query_texts,
    ).await?;
    println!("Embedding vettori ricevuti: {}", query_vectors.len());

    // =========================================================================
    // SEZIONE 1: Misura di C9 su tutte le 40 query gold
    // =========================================================================
    println!("\n--- Misura duplicati C9 su tutte le 40 query gold ---");
    let mut c9_reports: Vec<C9QueryDuplicateReport> = Vec::new();
    let mut queries_with_dups = Vec::new();
    let mut total_dup_rows = 0;

    for (idx, q) in all_queries.iter().enumerate() {
        let q_vec = &query_vectors[idx];
        let term = q.text.trim();
        let expected_doc = q.relevant_document_ids.first().cloned().unwrap_or_default();

        let sq = limen_vault::search::SearchQuery {
            term: Some(term.to_string()),
            limit: Some(10),
            offset: Some(0),
            ..Default::default()
        };

        let res = limen_vault::embeddings::hybrid_search_vault_with_vector(
            &vault_path,
            sq,
            Some(q_vec.clone()),
            true,
        ).await?;

        let mut seen_paths: BTreeSet<String> = BTreeSet::new();
        let mut duplicate_paths: Vec<String> = Vec::new();
        let mut item_details: Vec<Top10ItemDetail> = Vec::new();

        for (rank_0, item) in res.iter().enumerate() {
            let is_dup = seen_paths.contains(&item.relative_path);
            if is_dup {
                duplicate_paths.push(item.relative_path.clone());
            } else {
                seen_paths.insert(item.relative_path.clone());
            }

            let is_target = q.relevant_document_ids.iter().any(|rel| item.relative_path.contains(rel) || &item.id == rel);

            item_details.push(Top10ItemDetail {
                rank: rank_0 + 1,
                id: item.id.clone(),
                relative_path: item.relative_path.clone(),
                title: item.title.clone(),
                score: item.score,
                is_duplicate: is_dup,
                is_target,
            });
        }

        let distinct_count = seen_paths.len();
        let dup_count = duplicate_paths.len();
        let has_dups = dup_count > 0;

        if has_dups {
            queries_with_dups.push(q.query_id.clone());
            total_dup_rows += dup_count;
        }

        c9_reports.push(C9QueryDuplicateReport {
            query_id: q.query_id.clone(),
            expected_document: expected_doc,
            top10_total_rows: res.len(),
            top10_distinct_docs_count: distinct_count,
            top10_duplicate_rows_count: dup_count,
            has_duplicates: has_dups,
            duplicate_doc_paths: duplicate_paths,
            top10_details: item_details,
        });
    }

    let c9_summary = C9SummaryReport {
        benchmark: "Misura Rilievo C9 — Duplicati in Top 10 su 40 Query Gold".to_string(),
        timestamp_utc8: "2026-09-20T07:00:00+08:00".to_string(),
        total_queries: all_queries.len(),
        queries_with_duplicates_count: queries_with_dups.len(),
        queries_with_full_10_distinct_count: all_queries.len() - queries_with_dups.len(),
        total_duplicate_rows_in_top10_all_queries: total_dup_rows,
        queries_with_duplicates_list: queries_with_dups.clone(),
    };

    let c9_json_path = out_dir.join("c9_duplicates_summary.json");
    fs::write(&c9_json_path, serde_json::to_string_pretty(&c9_summary)?)?;
    println!("Sintesi duplicati C9 salvata in {:?}", c9_json_path);

    let c9_per_query_path = out_dir.join("c9_duplicates_per_query.jsonl");
    let mut pq_file = fs::File::create(&c9_per_query_path)?;
    use std::io::Write;
    for rep in &c9_reports {
        writeln!(pq_file, "{}", serde_json::to_string(rep)?)?;
    }
    println!("Dettaglio duplicati C9 per query salvato in {:?}", c9_per_query_path);

    println!("\nRISULTATO MISURA C9 SU GOLD (40 query):");
    println!("- Query con duplicati in Top 10: {} su 40 ({:.1}%)", queries_with_dups.len(), (queries_with_dups.len() as f64 / 40.0) * 100.0);
    println!("- Query con esattamente 10 documenti distinti: {} su 40", all_queries.len() - queries_with_dups.len());
    println!("- Righe duplicate complessive in Top 10: {}", total_dup_rows);
    println!("- Elenco query con duplicati in Top 10: {:?}", queries_with_dups);

    // =========================================================================
    // SEZIONE 2: Diagnosi Q21 e Q26 e Calcolo Controfattuale
    // =========================================================================
    println!("\n--- Diagnosi Dettagliata e Calcolo Controfattuale per Q21 e Q26 ---");
    let target_qids = vec!["Q21", "Q26"];
    let mut counterfactual_results: Vec<CounterfactualQueryDetail> = Vec::new();

    for qid in target_qids {
        let q_idx = all_queries.iter().position(|q| q.query_id == qid).unwrap();
        let q = &all_queries[q_idx];
        let q_vec = &query_vectors[q_idx];
        let term = q.text.trim();
        let _term_lower = term.to_lowercase();
        let expected_doc = q.relevant_document_ids.first().cloned().unwrap_or_default();

        let _is_exact_code = (term.contains('-') || term.contains('_') || term.chars().any(|c| c.is_ascii_digit()))
            && term.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            && term.len() >= 3;

        // 1. Lexical search
        let lex_query = limen_vault::search::SearchQuery {
            term: Some(term.to_string()),
            limit: Some(200),
            offset: Some(0),
            ..Default::default()
        };
        let lexical_results = limen_vault::search::search_vault(&vault_path, lex_query)?;

        // 2. Semantic search
        let mut semantic_scores: BTreeMap<String, (f32, Option<String>, Option<String>, Option<String>)> = BTreeMap::new();
        for doc in catalog.documents.values() {
            let (sim, pid, loc, snip) = limen_vault::embeddings::rank_document_semantic(
                &doc.document_id,
                &doc.passages,
                q_vec,
                &cache,
            );
            if sim > 0.25 {
                semantic_scores.insert(doc.document_id.clone(), (sim, pid, loc, snip));
            }
        }

        // --- Calcolo Prodotto Attuale (Disallineato, C9) ---
        let mut all_ids: BTreeSet<String> = BTreeSet::new();
        all_ids.extend(lexical_results.iter().map(|it| it.id.clone()));
        all_ids.extend(semantic_scores.keys().cloned());

        #[allow(dead_code)]
        struct UncoalescedCand {
            id: String,
            path: String,
            title: String,
            base_score: f64,
            sem_sim: f64,
            fused_score: f64,
            is_expected: bool,
        }

        let mut uncoalesced = Vec::new();
        for id in &all_ids {
            let (item, base_score) = if let Some(lex_item) = lexical_results.iter().find(|it| &it.id == id) {
                (lex_item.clone(), lex_item.score)
            } else if let Some(doc) = catalog.documents.get(id) {
                let (_, pid, loc, snip) = semantic_scores.get(id).cloned().unwrap_or((0.0, None, None, None));
                let preview = snip.unwrap_or_else(|| doc.passages.first().map(|p| p.text.clone()).unwrap_or_default());
                (
                    limen_vault::search::SearchResultItem {
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

            let sem_sim = semantic_scores.get(id).map(|s| s.0 as f64).unwrap_or(0.0);
            let is_expected = q.relevant_document_ids.iter().any(|rel| item.relative_path.contains(rel) || &item.id == rel);
            uncoalesced.push((id.clone(), item.relative_path.clone(), item.title.clone(), base_score, sem_sim, is_expected));
        }

        let min_lex_unc = uncoalesced.iter().map(|c| c.3).fold(f64::INFINITY, f64::min);
        let max_lex_unc = uncoalesced.iter().map(|c| c.3).fold(f64::NEG_INFINITY, f64::max);
        let min_sem_unc = uncoalesced.iter().map(|c| c.4).fold(f64::INFINITY, f64::min);
        let max_sem_unc = uncoalesced.iter().map(|c| c.4).fold(f64::NEG_INFINITY, f64::max);

        let mut uncoalesced_scored: Vec<UncoalescedCand> = uncoalesced.into_iter().map(|(id, path, title, base_score, sem_sim, is_expected)| {
            let lex_norm = if max_lex_unc > min_lex_unc { (base_score - min_lex_unc) / (max_lex_unc - min_lex_unc) } else { 0.0 };
            let sem_norm = if max_sem_unc > min_sem_unc { (sem_sim - min_sem_unc) / (max_sem_unc - min_sem_unc) } else { 0.0 };
            let fused_score = 0.5 * lex_norm + 0.5 * sem_norm;
            UncoalescedCand { id, path, title, base_score, sem_sim, fused_score, is_expected }
        }).collect();
        uncoalesced_scored.sort_by(|a, b| b.fused_score.partial_cmp(&a.fused_score).unwrap_or(std::cmp::Ordering::Equal));
        let unc_target_pos = uncoalesced_scored.iter().position(|c| c.is_expected);
        let unc_target_rank = unc_target_pos.map(|p| p + 1);
        let unc_target_score = unc_target_pos.map(|p| uncoalesced_scored[p].fused_score).unwrap_or(0.0);

        // --- Calcolo Controfattuale Coalescente (Unione per Documento) ---
        // Per ogni documento nel catalogo (120 documenti unici):
        // si estraggono base_score (dal lessicale) e sem_sim (dalla semantica) dello STESSO documento!
        struct CoalescedDoc {
            cat_id: String,
            path: String,
            title: String,
            raw_lex: f64,
            raw_sem: f64,
            lex_norm: f64,
            sem_norm: f64,
            fused_score: f64,
            is_target: bool,
        }

        let mut coalesced_docs: Vec<CoalescedDoc> = Vec::new();
        for doc in catalog.documents.values() {
            let path = doc.original_path.clone();
            let cat_id = doc.document_id.clone();
            let is_target = q.relevant_document_ids.iter().any(|rel| path.contains(rel) || &cat_id == rel);

            // Trova score lessicale corrispondente per percorso
            let raw_lex = lexical_results.iter().find(|li| li.relative_path == path).map(|li| li.score).unwrap_or(0.0);
            // Trova score semantico corrispondente per catalog id
            let raw_sem = semantic_scores.get(&cat_id).map(|s| s.0 as f64).unwrap_or(0.0);

            // Includi se presente in almeno uno dei due motori
            if raw_lex > 0.0 || raw_sem > 0.0 {
                coalesced_docs.push(CoalescedDoc {
                    cat_id,
                    path,
                    title: doc.file_name.clone(),
                    raw_lex,
                    raw_sem,
                    lex_norm: 0.0,
                    sem_norm: 0.0,
                    fused_score: 0.0,
                    is_target,
                });
            }
        }

        // Calcola estremi sui soli documenti candidati coalescenti (escursione identica a min=0)
        let max_lex_cf = coalesced_docs.iter().map(|d| d.raw_lex).fold(f64::NEG_INFINITY, f64::max);
        let max_sem_cf = coalesced_docs.iter().map(|d| d.raw_sem).fold(f64::NEG_INFINITY, f64::max);

        for d in &mut coalesced_docs {
            d.lex_norm = if max_lex_cf > 0.0 { d.raw_lex / max_lex_cf } else { 0.0 };
            d.sem_norm = if max_sem_cf > 0.0 { d.raw_sem / max_sem_cf } else { 0.0 };
            d.fused_score = 0.5 * d.lex_norm + 0.5 * d.sem_norm;
        }

        // Ordina discendente
        coalesced_docs.sort_by(|a, b| b.fused_score.partial_cmp(&a.fused_score).unwrap_or(std::cmp::Ordering::Equal));

        let cf_target_pos = coalesced_docs.iter().position(|d| d.is_target).unwrap();
        let cf_target_rank = cf_target_pos + 1;
        let cf_target = &coalesced_docs[cf_target_pos];

        println!("\n=== RISULTATO CONTROFATTUALE PER {} ===", qid);
        println!("Documento Target: {} ({})", expected_doc, cf_target.path);
        println!("Punteggi grezzi target: Raw Lex = {:.4}, Raw Sem = {:.4}", cf_target.raw_lex, cf_target.raw_sem);
        println!("Normalizzati target: Lex Norm = {:.4} (diviso max {:.4}), Sem Norm = {:.4} (diviso max {:.4})",
            cf_target.lex_norm, max_lex_cf, cf_target.sem_norm, max_sem_cf);
        println!("Punteggio Fuso Controfattuale Target: {:.4}", cf_target.fused_score);
        println!("Punteggio Fuso Attuale (Disallineato): {:.4}", unc_target_score);
        println!("Rango Attuale Disallineato (C9): {:?}", unc_target_rank);
        println!("Rango Controfattuale Coalescente: {}", cf_target_rank);
        println!("Entra in Top 10? {}", if cf_target_rank <= 10 { "SI (RECUPERATO!)" } else { "NO" });

        let mut competitors_ahead = Vec::new();
        println!("\nDocumenti posizionati prima del target (o top 10):");
        println!("{:<4} | {:<12} | {:<9} | {:<9} | {:<8} | {:<8} | {:<9} | {}",
            "Rank", "Doc ID", "Raw Lex", "Raw Sem", "Lex Norm", "Sem Norm", "Fused", "Path / Title");
        println!("{:-<100}", "");

        for (r, d) in coalesced_docs.iter().take(cf_target_rank.max(10)).enumerate() {
            let flag = if d.is_target { " <== TARGET" } else { "" };
            println!("{:<4} | {:<12} | {:<9.4} | {:<9.4} | {:<8.4} | {:<8.4} | {:<9.4} | {}{}",
                r + 1, d.cat_id, d.raw_lex, d.raw_sem, d.lex_norm, d.sem_norm, d.fused_score, d.path, flag);

            competitors_ahead.push(CounterfactualCompetitor {
                rank: r + 1,
                doc_path: d.path.clone(),
                title: d.title.clone(),
                raw_lex: d.raw_lex,
                raw_sem: d.raw_sem,
                lex_norm: d.lex_norm,
                sem_norm: d.sem_norm,
                fused_score: d.fused_score,
                is_target: d.is_target,
            });
        }

        counterfactual_results.push(CounterfactualQueryDetail {
            query_id: qid.to_string(),
            target_doc: expected_doc,
            uncoalesced_hybrid_rank: unc_target_rank,
            uncoalesced_fused_score: unc_target_score,
            counterfactual_coalesced_rank: cf_target_rank,
            counterfactual_fused_score: cf_target.fused_score,
            entered_top_10: cf_target_rank <= 10,
            competitors_ahead,
        });
    }

    let cf_json_path = out_dir.join("c9_counterfactual_diagnosis.json");
    fs::write(&cf_json_path, serde_json::to_string_pretty(&counterfactual_results)?)?;
    println!("\nDettaglio controfattuale salvato in {:?}", cf_json_path);

    Ok(())
}
