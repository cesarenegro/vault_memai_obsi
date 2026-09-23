use limen_vault::{
    ai, catalog, embeddings,
    search::{self, SearchDocumentRecord, SearchQuery},
};
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let vault_path = Path::new(r"E:\VAULT WIN TEST DEV");
    if !vault_path.exists() {
        eprintln!("Vault path does not exist: {:?}", vault_path);
        std::process::exit(1);
    }

    let port: u16 = 62021;
    println!("Checking llama-server on port {}...", port);
    let healthy = limen_vault::llama::check_health(port);
    println!("llama-server healthy: {}", healthy);
    if !healthy {
        eprintln!("Warning: llama-server on port {} is not healthy!", port);
    }

    // Queries to test
    let queries = vec![
        "cosa e' il progetto bnxt ?",
        "ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA",
    ];

    for query_str in queries {
        run_diagnosis_for_query(vault_path, query_str, port).await?;
    }

    Ok(())
}

async fn run_diagnosis_for_query(
    vault_path: &Path,
    query_str: &str,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n================================================================================");
    println!("DIAGNOSI SELEZIONE PER: \"{}\"", query_str);
    println!("================================================================================\n");

    let t0 = std::time::Instant::now();
    let tokens = search::tokenize_text(query_str);
    println!("Token estratti: {:?}\n", tokens);

    // 1. Load Index, Cache, Catalog
    let t_load_start = std::time::Instant::now();
    let cache = embeddings::load_embeddings_cache(vault_path)?;
    let cat = catalog::load_catalog(vault_path)?;
    let t_load_ms = t_load_start.elapsed().as_millis();
    let total_cat_passages: usize = cat.documents.values().map(|d| d.passages.len()).sum();
    println!("Tempo caricamento cache/catalogo: {} ms (cache model: {})", t_load_ms, cache.model);
    println!("Documenti nel catalogo: {}", cat.documents.len());
    println!("Passaggi totali nel catalogo: {}", total_cat_passages);
    println!("Passaggi nella cache semantica (cache.entries): {}", cache.entries.len());

    // 2. Fetch Query Vector
    let t_embed_start = std::time::Instant::now();
    let endpoint = format!("http://127.0.0.1:{}/v1/embeddings", port);
    let mut vecs = embeddings::fetch_openai_embeddings_with_endpoint(
        &endpoint,
        "",
        &cache.model,
        &[query_str.to_string()],
    ).await?;
    let query_vector = vecs.pop().expect("query vector missing");
    let t_embed_ms = t_embed_start.elapsed().as_millis();
    println!("Tempo calcolo vettore query (bge-m3 su :{}): {} ms", port, t_embed_ms);

    // 3. Lexical Search
    let t_search_start = std::time::Instant::now();
    let lex_results = search::search_vault_filtered(
        vault_path,
        SearchQuery {
            term: Some(query_str.to_string()),
            limit: Some(200),
            offset: Some(0),
            ..Default::default()
        },
        None::<fn(&SearchDocumentRecord) -> bool>,
    )?;

    // Map document id -> lexical score and title bonus
    let mut lex_scores: BTreeMap<String, (f64, f64)> = BTreeMap::new(); // doc_id -> (score, title_bonus)
    for item in &lex_results {
        // Calculate title bonus specifically
        let title_tokens = search::tokenize_text(&item.title);
        let mut title_bonus = 0.0f64;
        for t in &tokens {
            if title_tokens.contains(t) {
                title_bonus += 10.0;
            }
        }
        lex_scores.insert(item.id.clone(), (item.score, title_bonus));
    }

    // 4. Semantic Scoring
    let mut semantic_scores: BTreeMap<String, (f32, Option<String>, Option<String>, Option<String>)> = BTreeMap::new();
    for doc in cat.documents.values() {
        if doc.passages.is_empty() {
            continue;
        }
        let (sim, pid, loc, snip) = embeddings::rank_document_semantic(
            &doc.document_id,
            &doc.passages,
            &query_vector,
            &cache,
        );
        if sim > 0.25 {
            semantic_scores.insert(doc.document_id.clone(), (sim, pid, loc, snip));
        }
    }

    // 5. Hybrid Fusion
    let term_lower = query_str.to_lowercase();
    let is_exact_code = (query_str.contains('-') || query_str.contains('_') || query_str.chars().any(|c| c.is_ascii_digit()))
        && query_str.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        && query_str.len() >= 3;

    let normalize_id = |id: &str| -> String {
        if id.starts_with("doc_") && id.len() > 20 {
            id[..20].to_string()
        } else {
            id.to_string()
        }
    };

    let mut all_ids: BTreeSet<String> = BTreeSet::new();
    for lex_item in &lex_results {
        all_ids.insert(normalize_id(&lex_item.id));
    }
    for sem_id in semantic_scores.keys() {
        all_ids.insert(normalize_id(sem_id));
    }

    struct IntermediateCandidate {
        id: String,
        relative_path: String,
        title: String,
        category: String,
        editorial_status: String,
        matching_locator: Option<String>,
        matching_passage_id: Option<String>,
        base_score: f64,
        title_bonus: f64,
        sem_sim: f64,
        matches_term: bool,
    }

    let mut intermediate: Vec<IntermediateCandidate> = Vec::new();

    for id in all_ids {
        let lex_item = lex_results.iter().find(|i| normalize_id(&i.id) == id || i.id == id);
        let (base_score, title_bonus) = lex_item
            .and_then(|i| lex_scores.get(&i.id))
            .copied()
            .unwrap_or((0.0, 0.0));

        let sem_info = semantic_scores.get(&id).or_else(|| {
            semantic_scores.iter().find(|(k, _)| normalize_id(k) == id).map(|(_, v)| v)
        });
        let sem_sim = sem_info.map(|s| s.0 as f64).unwrap_or(0.0);

        let (relative_path, title, category, editorial_status, loc, pid) = if let Some(li) = lex_item {
            (
                li.relative_path.clone(),
                li.title.clone(),
                li.category.clone(),
                li.status.clone().unwrap_or_else(|| "approved".to_string()),
                li.matching_locator.clone(),
                li.matching_passage_id.clone(),
            )
        } else if let Some(doc) = cat.documents.get(&id).or_else(|| {
            cat.documents.values().find(|d| normalize_id(&d.document_id) == id || d.original_path == id)
        }) {
            (
                doc.original_path.clone(),
                doc.file_name.clone(),
                doc.category.clone().unwrap_or_else(|| "source".to_string()),
                doc.editorial_status.clone(),
                None,
                None,
            )
        } else {
            continue;
        };

        let matches_term = title.to_lowercase().contains(&term_lower);

        intermediate.push(IntermediateCandidate {
            id,
            relative_path,
            title,
            category,
            editorial_status,
            matching_locator: loc,
            matching_passage_id: pid,
            base_score,
            title_bonus,
            sem_sim,
            matches_term,
        });
    }

    let min_lex = intermediate.iter().map(|c| c.base_score).fold(f64::INFINITY, f64::min);
    let max_lex = intermediate.iter().map(|c| c.base_score).fold(f64::NEG_INFINITY, f64::max);
    let min_sem = intermediate.iter().map(|c| c.sem_sim).fold(f64::INFINITY, f64::min);
    let max_sem = intermediate.iter().map(|c| c.sem_sim).fold(f64::NEG_INFINITY, f64::max);

    struct FusedRecord {
        id: String,
        relative_path: String,
        title: String,
        category: String,
        editorial_status: String,
        matching_locator: Option<String>,
        matching_passage_id: Option<String>,
        lex_score: f64,
        title_bonus: f64,
        lex_norm: f64,
        sem_sim: f64,
        sem_norm: f64,
        exact_bonus: f64,
        fused_score: f64,
    }

    let mut fused: Vec<FusedRecord> = Vec::new();
    for c in intermediate {
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

        let fused_score = lex_norm.max(sem_norm) + 0.20 * lex_norm.min(sem_norm) + exact_bonus;

        fused.push(FusedRecord {
            id: c.id,
            relative_path: c.relative_path,
            title: c.title,
            category: c.category,
            editorial_status: c.editorial_status,
            matching_locator: c.matching_locator,
            matching_passage_id: c.matching_passage_id,
            lex_score: c.base_score,
            title_bonus: c.title_bonus,
            lex_norm,
            sem_sim: c.sem_sim,
            sem_norm,
            exact_bonus,
            fused_score,
        });
    }

    fused.sort_by(|a, b| b.fused_score.partial_cmp(&a.fused_score).unwrap_or(std::cmp::Ordering::Equal));
    let t_search_ms = t_search_start.elapsed().as_millis();
    println!("Tempo calcolo ricerca ibrida: {} ms (totale candidati: {})\n", t_search_ms, fused.len());

    // Report Table 1: Top 30
    println!("--- TABELLA 1: PRIMI 30 RISULTATI (FUSIONE IBRIDA) ---");
    println!(
        "{:<4} | {:<55} | {:<9} | {:<9} | {:<9} | {:<9} | {:<9} | {:<9}",
        "Pos", "Documento", "ScoreFin", "LexScore", "TitleBns", "LexNorm", "SemSim", "SemNorm"
    );
    println!("{:-<135}", "");
    for (idx, r) in fused.iter().enumerate().take(30) {
        let doc_display = &r.relative_path;
        println!(
            "{:<4} | {:<55} | {:<9.4} | {:<9.2} | {:<9.1} | {:<9.4} | {:<9.4} | {:<9.4}",
            idx + 1,
            doc_display,
            r.fused_score,
            r.lex_score,
            r.title_bonus,
            r.lex_norm,
            r.sem_sim,
            r.sem_norm,
        );
    }
    println!();

    // Check Targets
    let is_bnxt = query_str.contains("bnxt");
    if is_bnxt {
        println!("--- POSIZIONE DEI 9 DOCUMENTI BNXT IN CLASSIFICA IBRIDA ---");
        let target_bnxt = vec![
            "112bf7d370012490-audit-localizzazione-EN-verifica-AG-2026-09-10.md",
            "1e755ab82023a095-verifica-impl-plan-ux-email-whatsapp-2026-09-10.md",
            "32f2a4081d13410e-BNXT CRM.md",
            "4245a51312c5c1f2-2026-04-07 - Workflow app iPhone nativa con Xcode.md",
            "5a54c2ce2f581cf2-verifica-walkthrough-ux-email-whatsapp-2026-09-10.md",
            "957b10627e45aa38-_INDICE.md",
            "a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md",
            "abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md",
            "d70f1c7b1d36f912-STEFANO APP.md",
        ];
        println!(
            "{:<4} | {:<60} | {:<9} | {:<9} | {:<9} | {:<9}",
            "Rango", "Documento", "ScoreFin", "LexScore", "TitleBns", "SemSim"
        );
        println!("{:-<110}", "");
        for t in &target_bnxt {
            let pos = fused.iter().position(|r| r.relative_path.ends_with(t) || r.title.contains(t));
            match pos {
                Some(p) => {
                    let r = &fused[p];
                    println!(
                        "{:<4} | {:<60} | {:<9.4} | {:<9.2} | {:<9.1} | {:<9.4}",
                        p + 1, t, r.fused_score, r.lex_score, r.title_bonus, r.sem_sim
                    );
                }
                None => {
                    println!("{:<4} | {:<60} | NON PRESENTE NEI CANDIDATI", "-", t);
                }
            }
        }
        println!();
    } else {
        println!("--- POSIZIONE DEI 12 DOCUMENTI ARKAI IN CLASSIFICA IBRIDA ---");
        let target_arkai = vec![
            "ca804c2d899aa19b-ARKAI AI RENDER APP.md",
            "86e2218e7ed905f1-ARKAI FLOORPLAN NICE.md",
            "89ed4d8455f40767-ARKAI FREE IMAGE AI.md",
            "f4fd17ebca858f34-ARKAI.DEV Software Developer.md",
            "76c1cadeb9e7f5e0-BOQ ARKAI COMPUTO METRICO.md",
            "b3f8add2793aa3b3-CONTRATTI ARKAI ITALIA.md",
            "7254c793dd89f65d-2026-03-19 - Analisi icona app ARKAI STAGER.md",
            "0bc92121a0ad46f7-2026-03-26 - Arkai.Dev expansion into Italian market.md",
            "540e37c638dd2045-2026-03-31 - Presentazione investitori Arkai.archi.md",
            "2e9471848e17f686-2026-04-06 - ARKAI AI Free Render Engine Xcode project.md",
            "2ff8773ddf4229e7-2026-04-06 - Building ARKAI free image generation web app.md",
            "aa217245dfd86aeb-nuovo LLM AI Arkai.md",
        ];
        println!(
            "{:<4} | {:<65} | {:<9} | {:<9} | {:<9} | {:<9}",
            "Rango", "Documento", "ScoreFin", "LexScore", "TitleBns", "SemSim"
        );
        println!("{:-<115}", "");
        for t in &target_arkai {
            let pos = fused.iter().position(|r| r.relative_path.ends_with(t) || r.title.contains(t));
            match pos {
                Some(p) => {
                    let r = &fused[p];
                    println!(
                        "{:<4} | {:<65} | {:<9.4} | {:<9.2} | {:<9.1} | {:<9.4}",
                        p + 1, t, r.fused_score, r.lex_score, r.title_bonus, r.sem_sim
                    );
                }
                None => {
                    println!("{:<4} | {:<65} | NON PRESENTE NEI CANDIDATI", "-", t);
                }
            }
        }
        println!();
    }

    // 6. Detailed Simulation of select()
    println!("--- SIMULAZIONE DETTAGLIATA DI select() IN ai.rs ---");
    println!("Budget massimo contesto: 24.000 byte | Limite fonti: 10\n");

    let mut sources = Vec::new();
    let mut total_size = 0usize;
    let mut selected_count = 0usize;

    // Filter closure matching ai.rs
    let include_drafts = false;
    let path_buf = vault_path.to_path_buf();

    for (idx, r) in fused.iter().enumerate() {
        let is_eligible = ai::eligible(&r.relative_path, &r.category, Some(&r.editorial_status), include_drafts)
            || limen_vault::automation::is_current(&path_buf, &r.relative_path, "");

        if !is_eligible {
            println!(
                "Rango {:<3} | {:<55} | ESCLUSO: Filtro eligibilità (cat: {}, status: {})",
                idx + 1, r.relative_path, r.category, r.editorial_status
            );
            continue;
        }

        // Try reading source
        let sha = match cat.documents.get(&r.id).or_else(|| cat.documents.values().find(|d| d.original_path == r.relative_path)) {
            Some(d) => d.content_hash.clone(),
            None => {
                println!("Rango {:<3} | {:<55} | ESCLUSO: Non trovato nel catalogo", idx + 1, r.relative_path);
                continue;
            }
        };

        let mut s = match ai::read_source(vault_path, &r.id, &sha, include_drafts) {
            Ok(src) => src,
            Err(e) => {
                println!("Rango {:<3} | {:<55} | ESCLUSO: Errore lettura source ({})", idx + 1, r.relative_path, e);
                continue;
            }
        };

        s.locator = r.matching_locator.clone();
        s.passage_id = r.matching_passage_id.clone();

        let raw_len = s.content.len();
        let mut passage_extracted = false;

        // Passage budget: if content > 3000, extract passage
        if s.content.len() > 3000 {
            if let Some(ref pid) = r.matching_passage_id {
                if let Ok(p) = catalog::read_passage(vault_path, &r.id, pid) {
                    s.content = format!("[{}] {}", p.locator, p.text);
                    s.locator = Some(p.locator);
                    passage_extracted = true;
                } else {
                    s.content.truncate(3000);
                }
            } else {
                s.content.truncate(3000);
            }
        }

        let item_bytes = serde_json::to_vec(&s).unwrap().len();

        if total_size + item_bytes > 24000 {
            println!(
                "Rango {:<3} | {:<55} | SCARTATO PER BUDGET: item={:>5} B (raw: {:>5} B, estratto: {}), cumulativo={:>5} B > 24000 B",
                idx + 1, r.relative_path, item_bytes, raw_len, passage_extracted, total_size + item_bytes
            );
            continue;
        }

        total_size += item_bytes;
        selected_count += 1;
        println!(
            "Rango {:<3} | {:<55} | SELEZIONATO [#{:>2}]: item={:>5} B (raw: {:>5} B, estratto: {}), cumulativo={:>5} B",
            idx + 1, r.relative_path, selected_count, item_bytes, raw_len, passage_extracted, total_size
        );
        sources.push(s);

        if sources.len() == 10 {
            println!("\n--> Limite di 10 fonti raggiunto. Selezione terminata.");
            break;
        }
    }

    println!("\nTotale fonti selezionate: {} | Byte totali: {} / 24000", sources.len(), total_size);
    Ok(())
}
