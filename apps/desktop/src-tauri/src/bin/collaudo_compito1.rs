use chrono::Utc;
use limen_vault::{
    catalog::{load_catalog, process_pending_extractions, sync_catalog_from_vault, ExtractionStatus},
    embeddings::{
        get_embeddings_provider, hybrid_search_vault_with_port, load_embeddings_cache,
        set_embeddings_provider, sync_embeddings_with_port,
    },
    llama::{local_model_status, LlamaServerState},
    search::{index_vault_search, SearchQuery},
};
use serde_json::json;
use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let started_at = now_iso();
    println!("============================================================");
    println!("COLLAUDO END-TO-END COMPITO 1 (V2): RAG LOCALE NEL PRODOTTO");
    println!("Avvio: {}", started_at);
    println!("============================================================");

    let vault_path = PathBuf::from(
        "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/scratch/vault_collaudo_local_rag_v2",
    );
    assert!(vault_path.exists(), "La copia fresca del vault deve esistere: {:?}", vault_path);

    let evidence_dir = PathBuf::from(
        "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/COLLAUDO_COMPITO_1_V2",
    );
    fs::create_dir_all(&evidence_dir)?;

    // 1. SINCRONIZZAZIONE CATALOGO ED ESTRAZIONE DOCUMENTI 20_RAW_SOURCES
    println!("\n[1/10] Sincronizzazione catalogo da vault...");
    let synced_cat = sync_catalog_from_vault(&vault_path)?;
    println!("  Documenti catalogati inizialmente: {}", synced_cat.documents.len());

    println!("  Estrazione sorgenti grezze (20_RAW_SOURCES) completamente offline...");
    let extracted_count = process_pending_extractions(&vault_path)?;
    println!("  Documenti estratti: {}", extracted_count);

    let cat_after = load_catalog(&vault_path)?;
    let raw_sources: Vec<_> = cat_after
        .documents
        .values()
        .filter(|d| d.original_path.starts_with("20_RAW_SOURCES/"))
        .collect();
    println!("  Totale sorgenti 20_RAW_SOURCES nel catalogo: {}", raw_sources.len());
    assert_eq!(raw_sources.len(), 56, "Devono esserci esattamente 56 sorgenti in 20_RAW_SOURCES");

    let pending_raw = raw_sources
        .iter()
        .filter(|d| d.extraction_status == ExtractionStatus::Pending)
        .count();
    let ready_raw = raw_sources
        .iter()
        .filter(|d| d.extraction_status == ExtractionStatus::Ready)
        .count();
    println!("  Sorgenti 20_RAW_SOURCES con stato 'ready': {}", ready_raw);
    println!("  Sorgenti 20_RAW_SOURCES con stato 'pending': {}", pending_raw);
    assert_eq!(pending_raw, 0, "Nessun documento 20_RAW_SOURCES deve rimanere 'pending'!");
    assert_eq!(ready_raw, 56, "Tutti i 56 documenti 20_RAW_SOURCES devono essere 'ready'!");

    let mut total_catalog_passages = 0;
    let mut catalog_passage_ids = HashSet::new();
    for doc in cat_after.documents.values() {
        for p in &doc.passages {
            total_catalog_passages += 1;
            catalog_passage_ids.insert(p.passage_id.clone());
        }
    }
    println!("  Totale passaggi nel catalogo: {}", total_catalog_passages);
    assert!(total_catalog_passages > 0, "Il catalogo deve contenere passaggi estratti");

    // Aggiornamento indice lessicale con le nuove estrazioni
    println!("  Aggiornamento indice lessicale...");
    index_vault_search(&vault_path)?;

    // 2. VERIFICA STATO INIZIALE E CALCOLO REALE DI needsReindex
    println!("\n[2/10] Verifica stato iniziale e calcolo reale di needsReindex...");
    let cache_file = vault_path.join("00_SYSTEM/EMBEDDINGS_CACHE.json");
    let cache_bak = vault_path.join("00_SYSTEM/EMBEDDINGS_CACHE.json.bak");
    if cache_file.exists() {
        let _ = fs::rename(&cache_file, &cache_bak);
    }
    let initial_rep = get_embeddings_provider(&vault_path, 0);
    println!("  Fornitore iniziale: {}", initial_rep.provider);
    println!("  needsReindex senza cache vettoriale: {}", initial_rep.needs_reindex);
    assert!(
        initial_rep.needs_reindex,
        "needsReindex deve essere true quando il catalogo ha passaggi ma la cache è assente!"
    );
    if cache_bak.exists() {
        let _ = fs::rename(&cache_bak, &cache_file);
    }

    // 3. IMPOSTAZIONE FORNITORE LOCALE DALL'INTERFACCIA (simulazione IPC atomica)
    println!("\n[3/10] Impostazione fornitore 'local' in SYNC_PROFILE.json...");
    let set_rep = set_embeddings_provider(&vault_path, "local", 0)?;
    println!("  Fornitore impostato: {}", set_rep.provider);
    println!("  Modello: {}", set_rep.model);
    println!("  Dimensioni attese: {}", set_rep.dimensions);
    println!("  Endpoint a riposo (servizio spento): '{}'", set_rep.endpoint);
    assert_eq!(set_rep.provider, "local");
    assert_eq!(set_rep.dimensions, 1024);
    assert_eq!(set_rep.endpoint, "", "A riposo (porta 0) l'endpoint non deve essere cablato a 8088");

    let sync_profile_content = fs::read_to_string(vault_path.join("00_SYSTEM/SYNC_PROFILE.json"))?;
    println!("  Contenuto SYNC_PROFILE.json:\n{}", sync_profile_content);
    let parsed_profile: serde_json::Value = serde_json::from_str(&sync_profile_content)?;
    assert!(parsed_profile.get("embeddingsEndpoint").is_none(), "embeddingsEndpoint NON deve essere persistito in SYNC_PROFILE.json");
    assert!(parsed_profile.get("embeddingsModel").is_none(), "embeddingsModel NON deve essere persistito in SYNC_PROFILE.json");
    assert_eq!(parsed_profile.get("embeddingsProvider").and_then(|v| v.as_str()), Some("local"));

    // 4. VERIFICA INTEGRITÀ MODELLO LOCALE
    println!("\n[4/10] Verifica modello locale (bge-m3-Q8_0.gguf)...");
    let model_status = local_model_status();
    println!("  Installato: {}", model_status.installed);
    println!("  Percorso: {}", model_status.path);
    println!("  Dimensione byte: {}", model_status.bytes);
    println!("  SHA-256 Integro: {}", model_status.sha256_ok);
    assert!(model_status.installed, "Il modello locale deve essere installato");
    assert_eq!(model_status.bytes, 634_553_760, "Dimensione byte errata");
    assert!(model_status.sha256_ok, "SHA-256 errato");

    // 5. AVVIO SERVIZIO LOCALE (porta dinamica, bind 127.0.0.1)
    println!("\n[5/10] Avvio del servizio locale llama-server...");
    let server_state = LlamaServerState::default();
    let srv_status = server_state.start()?;
    println!("  In esecuzione: {}", srv_status.running);
    println!("  Porta dinamica viva: {}", srv_status.port);
    println!("  PID: {:?}", srv_status.pid);
    println!("  Salute (/health): {}", srv_status.healthy);
    assert!(srv_status.running);
    assert!(srv_status.healthy);
    let active_port = srv_status.port;
    let pid = srv_status.pid.expect("PID non presente");

    // 6. PROVA DI RETE A RIPOSO E MONITORAGGIO DURANTE IL CALCOLO DEI VETTORI
    println!("\n[6/10] Prova di rete: monitoraggio continuo con lsof durante il calcolo vettoriale...");
    let lsof_at_rest = Command::new("lsof")
        .args(&["-nP", "-i", "-a", "-p", &pid.to_string()])
        .output()?;
    let lsof_at_rest_str = String::from_utf8_lossy(&lsof_at_rest.stdout).to_string();
    println!("  lsof a riposo per PID {}:\n{}", pid, lsof_at_rest_str);
    assert!(lsof_at_rest_str.contains("127.0.0.1"), "Binding non loopback");
    assert!(!lsof_at_rest_str.contains("*:"), "Binding 0.0.0.0 non ammesso");

    // Thread di campionamento rete durante embedding sync
    let stop_monitor = Arc::new(AtomicBool::new(false));
    let stop_monitor_clone = stop_monitor.clone();
    let pid_str = pid.to_string();
    let monitor_handle = thread::spawn(move || {
        let mut samples = Vec::new();
        while !stop_monitor_clone.load(Ordering::SeqCst) {
            if let Ok(out) = Command::new("lsof")
                .args(&["-nP", "-i", "-a", "-p", &pid_str])
                .output()
            {
                let s = String::from_utf8_lossy(&out.stdout).to_string();
                if !s.is_empty() {
                    samples.push(s);
                }
            }
            thread::sleep(Duration::from_secs(2));
        }
        samples
    });

    println!("  Calcolo di tutti gli embedding sul catalogo reale con llama-server su porta viva {}...", active_port);
    let sync_rep = sync_embeddings_with_port(&vault_path, "", Some("bge-m3"), Some(active_port)).await?;
    stop_monitor.store(true, Ordering::SeqCst);
    let network_samples = monitor_handle.join().unwrap();
    println!("  Sincronizzazione completata: {} passaggi calcolati su {}", sync_rep.cached_passages, sync_rep.total_passages);
    println!("  Campioni di rete raccolti durante il calcolo: {}", network_samples.len());

    // Verifica che in TUTTI i campioni di rete NON ci siano connessioni esterne
    for (idx, sample) in network_samples.iter().enumerate() {
        assert!(
            !sample.contains("api.openai.com"),
            "Rilevata connessione ad api.openai.com durante il calcolo! Campione #{}:\n{}",
            idx, sample
        );
        for line in sample.lines() {
            if line.contains("TCP") {
                assert!(
                    line.contains("127.0.0.1") || line.contains("localhost"),
                    "Rilevato socket non-loopback durante il calcolo: {}",
                    line
                );
            }
        }
    }
    println!("  VERIFICA DI RETE SUPERATA: 100% traffico confinato a 127.0.0.1!");

    // 7. DIMOSTRAZIONE INTERSEZIONE PASSAGGI CATOLOGO E CHIAVI CACHE = 100%
    println!("\n[7/10] Dimostrazione intersezione catalogo vs cache...");
    let cache = load_embeddings_cache(&vault_path)?;
    println!("  Passaggi nel catalogo: {}", total_catalog_passages);
    println!("  Vettori in EMBEDDINGS_CACHE.json: {}", cache.entries.len());
    println!("  Dimensioni vettore cache: {}", cache.dimensions);
    assert_eq!(cache.dimensions, 1024);

    let mut intersection_count = 0;
    for pid in &catalog_passage_ids {
        if cache.entries.contains_key(pid) {
            intersection_count += 1;
        }
    }
    let intersection_pct = (intersection_count as f64 / total_catalog_passages as f64) * 100.0;
    println!("  Intersezione (passaggi catalogo, chiavi cache): {} / {} ({:.2}%)",
        intersection_count, total_catalog_passages, intersection_pct);
    assert_eq!(
        intersection_count, total_catalog_passages,
        "L'intersezione deve essere ESATTAMENTE il 100% dei passaggi del catalogo!"
    );

    let post_sync_provider = get_embeddings_provider(&vault_path, active_port);
    println!("  needsReindex dopo sincronizzazione vettoriale: {}", post_sync_provider.needs_reindex);
    assert!(!post_sync_provider.needs_reindex, "needsReindex deve essere false ora che tutti i passaggi sono indicizzati!");

    // 8. ESECUZIONE DELLE 3 DOMANDE REALI DAI TITOLI DELLE SESSIONI FACTORY
    println!("\n[8/10] Esecuzione delle 3 query reali con semantico locale ATTIVO...");
    let queries = [
        "posizionamento di marca",
        "marca privata e distribuzione",
        "naming",
    ];

    let mut active_query_results = Vec::new();

    for query_text in &queries {
        println!("\n  >>> Query: \"{}\"", query_text);
        let (results, degraded) = hybrid_search_vault_with_port(
            &vault_path,
            SearchQuery {
                term: Some(query_text.to_string()),
                limit: Some(10),
                ..Default::default()
            },
            None,
            true,
            Some(active_port),
        ).await?;

        assert!(!degraded, "La ricerca non deve risultare degradata con servizio attivo");
        println!("      Risultati restituiti: {} (degraded: {})", results.len(), degraded);

        let query_tokens: Vec<String> = query_text
            .to_lowercase()
            .split_whitespace()
            .filter(|w| w.len() > 2)
            .map(String::from)
            .collect();

        let mut semantic_only_hits = Vec::new();
        for (i, r) in results.iter().enumerate() {
            let full_text = format!("{} {}", r.title.to_lowercase(), r.snippet.to_lowercase());
            let has_literal = query_tokens.iter().any(|token| full_text.contains(token));
            println!("      [{:2}] score: {:.4} | literal: {:5} | {} ({})",
                i + 1, r.score, has_literal, r.title, r.relative_path);
            if !has_literal {
                semantic_only_hits.push((i + 1, r.title.clone(), r.relative_path.clone(), r.score));
            }
        }

        println!("      Candidati semantici senza parole esatte nella top 10: {}", semantic_only_hits.len());
        for (rank, t, p, sc) in &semantic_only_hits {
            println!("        -> Rank #{}: '{}' ({}) score={:.4}", rank, t, p, sc);
        }

        active_query_results.push(json!({
            "query": query_text,
            "degraded": degraded,
            "top10": results,
            "semantic_only_candidates": semantic_only_hits,
        }));
    }

    // 9. PROVA DEL DISTACCO: ARRESTO DEL SERVIZIO E RIPETIZIONE DELLE 3 QUERY
    println!("\n[9/10] PROVA DEL DISTACCO: arresto forzato del servizio e ripetizione delle 3 query...");
    let stop_rep = server_state.stop()?;
    println!("  Stato dopo arresto: running={}, healthy={}", stop_rep.running, stop_rep.healthy);
    assert!(!stop_rep.running);
    assert!(!stop_rep.healthy);

    let mut detached_query_results = Vec::new();

    for (q_idx, query_text) in queries.iter().enumerate() {
        println!("\n  >>> Query a servizio spento: \"{}\"", query_text);
        let (results, degraded) = hybrid_search_vault_with_port(
            &vault_path,
            SearchQuery {
                term: Some(query_text.to_string()),
                limit: Some(10),
                ..Default::default()
            },
            None,
            true,
            Some(active_port), // Even if port is provided, service is stopped, so check_health will fail!
        ).await?;

        println!("      Risultati restituiti: {} (degraded: {})", results.len(), degraded);
        assert!(degraded, "La ricerca DEVE risultare degradata a servizio spento!");

        for (i, r) in results.iter().take(5).enumerate() {
            println!("      [{:2}] score: {:.4} | {} ({})", i + 1, r.score, r.title, r.relative_path);
        }

        // Confronto tra risultati attivi e risultati degradati
        let active_top = active_query_results[q_idx]["top10"].as_array().unwrap();
        let active_first_doc = active_top.first().and_then(|d| d["relative_path"].as_str()).unwrap_or("");
        let active_first_score = active_top.first().and_then(|d| d["score"].as_f64()).unwrap_or(0.0);

        let detached_first_doc = results.first().map(|d| d.relative_path.as_str()).unwrap_or("");
        let detached_first_score = results.first().map(|d| d.score).unwrap_or(0.0);

        println!("      Confronto #1 con attivo: doc='{}' score={:.4} vs doc='{}' score={:.4}",
            active_first_doc, active_first_score, detached_first_doc, detached_first_score);

        // Verifica che il semantico ha cambiato punteggi o ordinamento rispetto al solo lessicale
        let mut differences_detected = false;
        if active_top.len() != results.len() {
            differences_detected = true;
        } else {
            for (act, det) in active_top.iter().zip(results.iter()) {
                let act_path = act["relative_path"].as_str().unwrap_or("");
                let act_score = act["score"].as_f64().unwrap_or(0.0);
                if act_path != det.relative_path || (act_score - det.score).abs() > 1e-4 {
                    differences_detected = true;
                    break;
                }
            }
        }
        println!("      Differenza rilevata rispetto al ranking semantico attivo: {}", differences_detected);
        assert!(
            differences_detected,
            "I risultati con servizio spento DEVONO cambiare rispetto al servizio attivo, dimostrando l'apporto effettivo del ramo semantico!"
        );

        detached_query_results.push(json!({
            "query": query_text,
            "degraded": degraded,
            "top10": results,
            "ranking_changed_from_active": differences_detected,
        }));
    }

    // 10. GENERAZIONE REPORT DI COLLAUDO COMPLETO
    println!("\n[10/10] Generazione report di collaudo...");
    let finished_at = now_iso();
    let collaudo_report = json!({
        "timestamp_start": started_at,
        "timestamp_end": finished_at,
        "status": "PASS",
        "vault_path": vault_path.to_string_lossy(),
        "total_catalog_passages": total_catalog_passages,
        "cached_embeddings_passages": cache.entries.len(),
        "intersection_percentage": intersection_pct,
        "raw_sources_total": raw_sources.len(),
        "raw_sources_ready": ready_raw,
        "raw_sources_pending": pending_raw,
        "local_model": model_status,
        "server_status_active": srv_status,
        "network_samples_count": network_samples.len(),
        "network_at_rest_lsof": lsof_at_rest_str,
        "active_queries": active_query_results,
        "detached_queries": detached_query_results,
    });

    let report_file = evidence_dir.join("collaudo_compito1_v2_report.json");
    fs::write(&report_file, serde_json::to_string_pretty(&collaudo_report)?)?;
    println!("  Report salvato con successo in: {}", report_file.display());

    println!("\n============================================================");
    println!("COLLAUDO COMPITO 1 (V2) SUPERATO AL 100% (PASS)");
    println!("============================================================");

    Ok(())
}
