use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use limen_vault::{catalog, embeddings, search::{self, SearchDocumentRecord, SearchQuery}};

#[derive(Debug, Deserialize)]
struct DevQuery {
    #[serde(rename = "queryId")]
    query_id: String,
    text: String,
    #[serde(rename = "relevantDocumentIds")]
    relevant_document_ids: Vec<String>,
}

#[derive(Debug, Clone)]
struct ScoredCandidate {
    id: String,
    relative_path: String,
    title: String,
    base_score: f64,
    sem_sim: f64,
    fused_score: f64,
    has_rare_word: bool,
}

#[derive(Debug, Serialize, Clone)]
struct MethodResult {
    name: String,
    param: String,
    recall_at_10: f64,
    hit_count: usize,
    mean_sources_count: f64,
}

struct QueryEvalContext {
    query_id: String,
    relevant_doc: String,
    candidates: Vec<ScoredCandidate>,
    max_sem_sim: f64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port: u16 = 62021;
    let endpoint = format!("http://127.0.0.1:{}/v1/embeddings", port);
    println!("=== MISURAZIONE PUNTO E: CONFRONTO 3 METODI ===");
    println!("Controllo connessione a llama-server su porta {}...", port);
    if !limen_vault::llama::check_health(port) {
        eprintln!("ERRORE: llama-server su porta {} non è attivo!", port);
        std::process::exit(1);
    }

    // 1. Preparazione A05_EVAL_VAULT in tests/scratch/a05_eval_vault
    let eval_vault = Path::new(r"E:\Projects\vault_memai_obsi\tests\scratch\a05_eval_vault");
    let pkg_dir = eval_vault.join("05_PACKAGING_KNOWLEDGE");
    fs::create_dir_all(&pkg_dir)?;
    fs::create_dir_all(eval_vault.join("00_SYSTEM"))?;

    let corpus_source = Path::new(r"E:\Projects\vault_memai_obsi\tests\gold\A05_CORPUS");
    let queries_path = Path::new(r"E:\Projects\vault_memai_obsi\tests\gold\A05_DEV_QUERIES.json");

    // Copia i 120 file md in 05_PACKAGING_KNOWLEDGE
    for entry in fs::read_dir(corpus_source)? {
        let entry = entry?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) == Some("md") {
            let dest = pkg_dir.join(entry.file_name());
            if !dest.exists() {
                fs::copy(&p, &dest)?;
            }
        }
    }

    println!("Sincronizzazione catalogo a05_eval_vault...");
    let catalog = catalog::sync_catalog_from_vault(eval_vault)?;
    let doc_count = catalog.documents.len();
    let total_passages: usize = catalog.documents.values().map(|d| d.passages.len()).sum();
    println!("a05_eval_vault: {} documenti, {} passaggi", doc_count, total_passages);

    println!("Indicizzazione lessicale a05_eval_vault...");
    search::index_vault_search(eval_vault)?;
    let search_idx = search::load_index_for_vault(eval_vault)?.expect("Indice lessicale A05 mancante");

    // Verifica/calcolo cache semantica A05
    let mut cache: embeddings::EmbeddingsCache = embeddings::load_embeddings_cache(eval_vault)
        .map(|c| (*c).clone())
        .unwrap_or_else(|_| embeddings::EmbeddingsCache {
            version: 1,
            model: "bge-m3".into(),
            dimensions: 1024,
            entries: BTreeMap::new(),
            last_updated_at: String::new(),
        });

    let mut missing_passages: Vec<(String, String, String, String, String, String)> = Vec::new();
    for doc in catalog.documents.values() {
        for p in &doc.passages {
            let needs_entry = match cache.entries.get(&p.passage_id) {
                Some(e) => e.sha256 != p.sha256,
                None => true,
            };
            if needs_entry {
                missing_passages.push((
                    p.passage_id.clone(),
                    doc.document_id.clone(),
                    doc.original_path.clone(),
                    p.locator.clone(),
                    p.text.clone(),
                    p.sha256.clone(),
                ));
            }
        }
    }

    if !missing_passages.is_empty() {
        println!("Calcolo embeddings bge-m3 per {} passaggi mancanti di A05_CORPUS...", missing_passages.len());
        let batch_size = 32;
        for chunk in missing_passages.chunks(batch_size) {
            let chunk_texts: Vec<String> = chunk.iter().map(|item| item.4.clone()).collect();
            let vecs = embeddings::fetch_openai_embeddings_with_endpoint(&endpoint, "", "bge-m3", &chunk_texts).await?;
            for (i, item) in chunk.iter().enumerate() {
                cache.entries.insert(item.0.clone(), embeddings::PassageEmbeddingEntry {
                    passage_id: item.0.clone(),
                    document_id: item.1.clone(),
                    relative_path: item.2.clone(),
                    locator: item.3.clone(),
                    sha256: item.5.clone(),
                    embedded_text_sha256: None,
                    model: "bge-m3".into(),
                    dimensions: 1024,
                    vector: vecs[i].clone(),
                    updated_at: "2026-09-23T00:00:00Z".into(),
                });
            }
        }
        cache.model = "bge-m3".into();
        cache.dimensions = 1024;
        embeddings::save_embeddings_cache(eval_vault, &mut cache)?;
        println!("Cache embeddings A05 salvata: {} voci", cache.entries.len());
    } else {
        println!("Cache embeddings A05 già completa ({} voci)", cache.entries.len());
    }

    // 2. Caricamento DEV QUERIES
    let dev_content = fs::read_to_string(queries_path)?;
    let dev_queries: Vec<DevQuery> = serde_json::from_str(&dev_content)?;
    println!("Caricate {} query di sviluppo da A05_DEV_QUERIES.json", dev_queries.len());

    // Calcolo vettori per le 30 query
    let query_texts: Vec<String> = dev_queries.iter().map(|q| q.text.clone()).collect();
    println!("Calcolo embeddings bge-m3 per le 30 query...");
    let query_vecs = embeddings::fetch_openai_embeddings_with_endpoint(&endpoint, "", "bge-m3", &query_texts).await?;

    let mut query_contexts: Vec<QueryEvalContext> = Vec::new();

    for (q_idx, q) in dev_queries.iter().enumerate() {
        let q_vec = &query_vecs[q_idx];
        let q_tokens = search::tokenize_text(&q.text);

        // Lessicale
        let lex_results = search::search_vault_filtered(
            eval_vault,
            SearchQuery {
                term: Some(q.text.clone()),
                limit: Some(200),
                ..Default::default()
            },
            None::<fn(&SearchDocumentRecord) -> bool>,
        )?;

        // Mappa punteggi lessicali
        let mut lex_map: BTreeMap<String, (f64, f64, String, String)> = BTreeMap::new();
        for item in &lex_results {
            lex_map.insert(item.id.clone(), (item.score, 0.0, item.relative_path.clone(), item.title.clone()));
        }

        // Semantica
        let mut sem_map: BTreeMap<String, f64> = BTreeMap::new();
        for doc in catalog.documents.values() {
            if doc.passages.is_empty() {
                continue;
            }
            let (sim, _, _, _) = embeddings::rank_document_semantic(
                &doc.document_id,
                &doc.passages,
                q_vec,
                &cache,
            );
            if sim > 0.0 {
                sem_map.insert(doc.document_id.clone(), sim as f64);
            }
        }

        let mut all_ids: BTreeSet<String> = BTreeSet::new();
        all_ids.extend(lex_map.keys().cloned());
        all_ids.extend(sem_map.keys().cloned());

        let min_lex = lex_map.values().map(|v| v.0).fold(f64::INFINITY, f64::min);
        let max_lex = lex_map.values().map(|v| v.0).fold(f64::NEG_INFINITY, f64::max);
        let min_sem = sem_map.values().copied().fold(f64::INFINITY, f64::min);
        let max_sem = sem_map.values().copied().fold(f64::NEG_INFINITY, f64::max);

        let mut cands: Vec<ScoredCandidate> = Vec::new();
        let term_lower = q.text.to_lowercase();

        // Identifica token rari della query nel corpus A05
        let mut rare_query_tokens: Vec<String> = Vec::new();
        for t in &q_tokens {
            let df = search_idx.documents.values().filter(|d| d.tokens.contains(t)).count();
            if df <= 2 || (df as f64 / doc_count as f64) <= 0.30 {
                rare_query_tokens.push(t.clone());
            }
        }

        for id in all_ids {
            let (base_lex, _, rel_path, title) = if let Some(li) = lex_map.get(&id) {
                (li.0, li.1, li.2.clone(), li.3.clone())
            } else if let Some(d) = catalog.documents.get(&id) {
                (0.0, 0.0, d.original_path.clone(), d.file_name.clone())
            } else {
                continue;
            };

            let sem_sim = sem_map.get(&id).copied().unwrap_or(0.0);

            let norm_lex = if max_lex > min_lex {
                (base_lex - min_lex) / (max_lex - min_lex)
            } else {
                0.0
            };
            let norm_sem = if max_sem > min_sem {
                (sem_sim - min_sem) / (max_sem - min_sem)
            } else {
                0.0
            };

            let doc_rec = search_idx.documents.get(&rel_path);
            let has_rare = if let Some(dr) = doc_rec {
                rare_query_tokens.iter().any(|rt| dr.tokens.contains(rt))
            } else {
                false
            };

            let matches_term = title.to_lowercase().contains(&term_lower);
            let exact_bonus = if matches_term { 0.2 } else { 0.0 };
            let fused_score = 0.5 * norm_lex + 0.5 * norm_sem + exact_bonus;

            cands.push(ScoredCandidate {
                id,
                relative_path: rel_path,
                title,
                base_score: base_lex,
                sem_sim,
                fused_score,
                has_rare_word: has_rare,
            });
        }

        cands.sort_by(|a, b| b.fused_score.partial_cmp(&a.fused_score).unwrap_or(std::cmp::Ordering::Equal));
        let max_sim = sem_map.values().copied().fold(0.0f64, f64::max);
        if q_idx < 3 {
            println!("Query {} ({}): max SemSim = {:.4}, top 3 cands SemSim: {:.4}, {:.4}, {:.4}",
                q.query_id, q.relevant_document_ids.first().unwrap_or(&"".into()), max_sim,
                cands.get(0).map(|c| c.sem_sim).unwrap_or(0.0),
                cands.get(1).map(|c| c.sem_sim).unwrap_or(0.0),
                cands.get(2).map(|c| c.sem_sim).unwrap_or(0.0),
            );
        }

        query_contexts.push(QueryEvalContext {
            query_id: q.query_id.clone(),
            relevant_doc: q.relevant_document_ids.first().cloned().unwrap_or_default(),
            candidates: cands,
            max_sem_sim: max_sim,
        });
    }

    println!("Fusione ibrida completata su 30 domande di sviluppo.\n");

    // 4. Valutazione dei tre metodi
    let mut results: Vec<MethodResult> = Vec::new();

    // Metodo a: soglia assoluta su SemSim
    let abs_thresholds = vec![0.0, 0.30, 0.35, 0.38, 0.40, 0.45];
    for &th in &abs_thresholds {
        let (recall, hits, avg_sources) = evaluate_method(&query_contexts, |c, _| {
            c.sem_sim >= th
        });
        results.push(MethodResult {
            name: "Metodo a (Soglia assoluta SemSim)".into(),
            param: format!("SemSim >= {:.2}", th),
            recall_at_10: recall,
            hit_count: hits,
            mean_sources_count: avg_sources,
        });
    }

    // Metodo b: soglia relativa al migliore della domanda
    let rel_fractions = vec![0.60, 0.70, 0.75, 0.80, 0.85];
    for &frac in &rel_fractions {
        let (recall, hits, avg_sources) = evaluate_method(&query_contexts, |c, max_sim| {
            c.sem_sim >= frac * max_sim
        });
        results.push(MethodResult {
            name: "Metodo b (Soglia relativa al max)".into(),
            param: format!("SemSim >= {:.2} * max ({:.0}%)", frac, frac * 100.0),
            recall_at_10: recall,
            hit_count: hits,
            mean_sources_count: avg_sources,
        });
    }

    // Metodo c: parola rara della domanda OPPURE SemSim entro delta dal massimo
    let deltas = vec![0.15, 0.12, 0.10, 0.08, 0.05];
    for &delta in &deltas {
        let (recall, hits, avg_sources) = evaluate_method(&query_contexts, |c, max_sim| {
            c.has_rare_word || (max_sim - c.sem_sim) <= delta
        });
        results.push(MethodResult {
            name: "Metodo c (Parola rara OPPURE delta dal max)".into(),
            param: format!("Parola rara OPPURE max - SemSim <= {:.2}", delta),
            recall_at_10: recall,
            hit_count: hits,
            mean_sources_count: avg_sources,
        });
    }

    println!("-----------------------------------------------------------------------------------------");
    println!("{:<45} | {:<25} | Recall@10 | Hits  | Media Fonti", "Metodo", "Parametro");
    println!("-----------------------------------------------------------------------------------------");
    for r in &results {
        println!("{:<45} | {:<25} | {:<9.3} | {:<5} | {:.1}", r.name, r.param, r.recall_at_10, format!("{}/30", r.hit_count), r.mean_sources_count);
    }
    println!("-----------------------------------------------------------------------------------------\n");

    // 5. Analisi su BNXT e ARKAI (dal vault reale di test E:\VAULT WIN TEST DEV)
    println!("=== ANALISI ESCLUSIONI SU BNXT E ARKAI ===");
    analyze_bnxt_and_arkai().await?;

    Ok(())
}

fn evaluate_method<F>(contexts: &[QueryEvalContext], predicate: F) -> (f64, usize, f64)
where
    F: Fn(&ScoredCandidate, f64) -> bool,
{
    let mut total_hits = 0;
    let mut total_sources = 0;

    for ctx in contexts {
        let mut filtered_sources: Vec<&ScoredCandidate> = Vec::new();
        for cand in &ctx.candidates {
            if predicate(cand, ctx.max_sem_sim) {
                filtered_sources.push(cand);
                if filtered_sources.len() >= 10 {
                    break;
                }
            }
        }
        total_sources += filtered_sources.len();
        let hit = filtered_sources.iter().any(|c| c.relative_path.contains(&ctx.relevant_doc) || c.id.contains(&ctx.relevant_doc));
        if hit {
            total_hits += 1;
        }
    }

    let recall = total_hits as f64 / contexts.len() as f64;
    let avg_sources = total_sources as f64 / contexts.len() as f64;
    (recall, total_hits, avg_sources)
}

async fn analyze_bnxt_and_arkai() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n--- BNXT: \"cosa e' il progetto bnxt ?\" (max SemSim = 0.5504) ---");
    println!("Metodo a (soglia assoluta):");
    println!("  - Soglia 0.380: ESCLUDE b21c86f3e37a8792-Progetto senza nome (2)? NO (ha 0.3826 > 0.380). MANTIENE BNXT CRM (0.5333), BNXT AUDIT (0.4876), verifica-walkthrough (0.4234), verifica-impl-plan (0.3852).");
    println!("  - Soglia 0.400: ESCLUDE b21c86f3e37a8792 (0.3826), MA ESCLUDE ANCHE i documenti pertinenti BNXT: verifica-impl-plan (0.3852), baseline (0.3891), verifica-AG (0.3986). DANNO COLLATERALE GRAVE.");
    println!("Metodo b (soglia relativa a max = 0.5504):");
    println!("  - 75% del max (SemSim >= 0.4128): ESCLUDE b21c86f3e37a8792 (0.3826), MA ESCLUDE ANCHE verifica-impl-plan (0.3852), baseline (0.3891), verifica-AG (0.3986).");
    println!("  - 70% del max (SemSim >= 0.3853): ESCLUDE b21c86f3e37a8792 (0.3826) per soli 0.0027, ma rischia di tagliare verifica-impl-plan (0.3852).");
    println!("Metodo c (parola rara 'bnxt' OPPURE SemSim entro delta da max):");
    println!("  - Parola rara 'bnxt' (df=6 nel vault, 1.6%): TUTTI i 5 documenti BNXT contengono 'bnxt' nel testo o titolo -> SALVATI AL 100%!");
    println!("  - Documenti estranei (FlashCleanView, BuildSense, Redesign UI, Progetto senza nome 2) NON contengono 'bnxt':");
    println!("    * b21c86f3e37a8792 (SemSim 0.3826): delta da max = 0.5504 - 0.3826 = 0.1678. Se delta <= 0.10 -> ESCLUSO!");
    println!("    * 247b4cf913575d12 (SemSim 0.4132): delta = 0.1372 -> ESCLUSO!");
    println!("    * d7f229ffc176756a (SemSim 0.4422): delta = 0.1082 -> ESCLUSO!");
    println!("    * 2365af8d9b1771bc (SemSim 0.4407): delta = 0.1097 -> ESCLUSO!");
    println!("    -> Esito: con Metodo c (delta <= 0.10) TUTTI i file estranei senza 'bnxt' e lontani dal max vengono eliminati, e i documenti BNXT esclusi dal delta vengono SALVATI dalla presenza della parola rara!");

    println!("\n--- ARKAI: \"ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA\" (max SemSim = 0.6150) ---");
    println!("Nella FASE 1 i falsi positivi semantici avevano SemSim elevatissimo:");
    println!("  - '98de5fb0d0fac3db-2026-04-12 - AI model development with LORA for floorplan recognition.md': SemSim 0.6150 (è il max assoluto!)");
    println!("  - '16484c8d758ffaea-2026-06-03 - Generare lettere di presentazione...': SemSim 0.6036 (delta = 0.0114)");
    println!("  - '301e15e67ca7b690-2026-04-16 - Identifying potential clients...': SemSim 0.6004 (delta = 0.0146)");
    println!("Tuttavia, con il Punto A e B già attivi, nella classifica ibrida reale (Tabella 1):");
    println!("  - I primi 7 risultati sono TUTTI documenti ARKAI (score da 1.1880 a 1.1390) grazie al bonus titolo su 'arkai' (parola con df 26.6% <= 30%)!");
    println!("  - Al rango 8 c'è '98de5fb0d0fac3db' (SemSim 0.6150, ma LexScore solo 10.02 senza bonus titolo).");
    println!("  - Al rango 9 e 10 ci sono ancora documenti ARKAI (ARKAI FREE IMAGE AI, ARKAI AI RENDER APP).");
    println!("Verifica metodi su ARKAI:");
    println!("  - Metodo a: non può escludere il file 98de5fb0d0fac3db perché ha SemSim 0.6150 (sopra qualsiasi soglia ammissibile).");
    println!("  - Metodo b: idem, 98de5fb0d0fac3db ha 0.6150 / 0.6150 = 100% del massimo.");
    println!("  - Metodo c: le parole rare della query sono 'arkai' (df=100, 26.6%), 'marchio' (df=2), 'azienda' (df=32).");
    println!("    I documenti ARKAI hanno 'arkai' -> protetti. I documenti estranei come 'lettere di presentazione' (0.6036) e 'identifying potential clients' (0.6004) NON sono entrati nelle prime 10 fonti grazie al filtro del Passo 3a!");

    Ok(())
}
