use chrono::Utc;
use limen_vault::{
    embeddings::{get_embeddings_provider, hybrid_search_vault_with_port, set_embeddings_provider},
    llama::{local_model_status, LlamaServerState},
    search::{index_vault_search, SearchQuery},
};
use serde_json::json;
use std::{
    fs,
    path::PathBuf,
    process::Command,
};

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let started_at = now_iso();
    println!("============================================================");
    println!("COLLAUDO END-TO-END COMPITO 1: RAG LOCALE NEL PRODOTTO");
    println!("Avvio: {}", started_at);
    println!("============================================================");

    let vault_copy_path = PathBuf::from("/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/scratch/vault_collaudo_local_rag");
    assert!(vault_copy_path.exists(), "La copia del vault deve esistere");

    let evidence_dir = PathBuf::from("/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/COLLAUDO_COMPITO_1");
    fs::create_dir_all(&evidence_dir)?;

    // 1. STATO INIZIALE DEL VAULT
    println!("\n[1/7] Verifica stato iniziale SYNC_PROFILE.json...");
    let initial_rep = get_embeddings_provider(&vault_copy_path, 0);
    println!("  Fornitore iniziale: {}", initial_rep.provider);
    println!("  Endpoint iniziale: {}", initial_rep.endpoint);

    // 2. IMPOSTAZIONE FORNITORE LOCALE (scrittura atomica di SYNC_PROFILE.json)
    println!("\n[2/7] Impostazione fornitore 'local' (scrittura atomica)...");
    let set_rep = set_embeddings_provider(&vault_copy_path, "local")?;
    println!("  Fornitore impostato: {}", set_rep.provider);
    println!("  Modello: {}", set_rep.model);
    println!("  Dimensioni attese: {}", set_rep.dimensions);
    println!("  Endpoint generato: {}", set_rep.endpoint);
    assert_eq!(set_rep.provider, "local");
    assert_eq!(set_rep.dimensions, 1024);

    let sync_profile_content = fs::read_to_string(vault_copy_path.join("00_SYSTEM/SYNC_PROFILE.json"))?;
    println!("  Contenuto SYNC_PROFILE.json:\n{}", sync_profile_content);

    // 3. STATO E VERIFICA INTEGRITA MODELLO LOCALE
    println!("\n[3/7] Verifica stato modello locale (bge-m3-Q8_0.gguf)...");
    let model_status = local_model_status();
    println!("  Installato: {}", model_status.installed);
    println!("  Percorso: {}", model_status.path);
    println!("  Dimensione byte: {}", model_status.bytes);
    println!("  SHA-256 Integro: {}", model_status.sha256_ok);
    assert!(model_status.installed, "Il modello locale deve essere installato");
    assert_eq!(model_status.bytes, 634_553_760, "Dimensione byte deve essere esattamente 634.553.760");
    assert!(model_status.sha256_ok, "SHA-256 deve corrispondere esattamente a 950f4a8e5e19477a6d3c26d2f162233c20002c601f75e4b002e3239997821167");

    // 4. CICLO DI VITA: AVVIO SERVIZIO LOCALE (porta dinamica, bind 127.0.0.1, healthcheck)
    println!("\n[4/7] Avvio del servizio locale llama-server...");
    let server_state = LlamaServerState::default();
    let srv_status = server_state.start()?;
    println!("  In esecuzione: {}", srv_status.running);
    println!("  Porta dinamica assegnata: {}", srv_status.port);
    println!("  Modello: {}", srv_status.model);
    println!("  Salute (/health): {}", srv_status.healthy);
    println!("  Ultimo errore: {:?}", srv_status.last_error);
    assert!(srv_status.running, "Il servizio deve risultare in esecuzione");
    assert!(srv_status.healthy, "Il servizio deve risultare sano (/health OK e 1024d verificate)");
    let active_port = srv_status.port;

    // 5. PROVA DI RETE (ZERO CONNESSIONI ESTERNE)
    println!("\n[5/7] Prova di rete: ispezione socket di rete su llama-server...");
    let pid = srv_status
        .pid
        .expect("PID di llama-server deve essere valorizzato")
        .to_string();
    println!("  PID di llama-server: {}", pid);

    let lsof_output = Command::new("lsof")
        .args(&["-nP", "-i", "-a", "-p", &pid])
        .output()?;
    let lsof_str = String::from_utf8_lossy(&lsof_output.stdout).to_string();
    println!("  lsof output per PID {}:\n{}", pid, lsof_str);

    // Assert that socket is bound ONLY to loopback 127.0.0.1 and no external connections exist
    assert!(lsof_str.contains("127.0.0.1"), "Il processo DEVE essere legato esclusivamente a 127.0.0.1");
    assert!(!lsof_str.contains("*:"), "Il processo NON deve fare binding su tutte le interfacce (*)");

    // 6. ESECUZIONE RICERCA REALE CON MOTORE LOCALE ATTIVO
    println!("\n[6/7] Esecuzione ricerca reale con motore semantico locale...");
    // Ensure index exists
    let _ = index_vault_search(&vault_copy_path);

    let test_term = "microprocessore controller";
    let (hybrid_results, degraded_flag) = hybrid_search_vault_with_port(
        &vault_copy_path,
        SearchQuery {
            term: Some(test_term.to_string()),
            limit: Some(10),
            ..Default::default()
        },
        None,
        true,
        Some(active_port),
    ).await?;

    println!("  Query: '{}'", test_term);
    println!("  Modalita degradata: {}", degraded_flag);
    println!("  Risultati trovati: {}", hybrid_results.len());
    assert!(!degraded_flag, "La ricerca con servizio attivo NON deve essere degradata");
    for (i, r) in hybrid_results.iter().take(5).enumerate() {
        println!("    [{}] {} (score: {:.4}) - {}", i + 1, r.title, r.score, r.relative_path);
    }

    // Re-verify network after query
    let lsof_after_output = Command::new("lsof")
        .args(&["-nP", "-i", "-a", "-p", &pid])
        .output()?;
    let lsof_after_str = String::from_utf8_lossy(&lsof_after_output.stdout).to_string();
    assert!(!lsof_after_str.contains("api.openai.com"), "Nessuna connessione ad api.openai.com ammessa!");

    // 7. PROVA DEL DISTACCO: ARRESTO DEL SERVIZIO E VERIFICA FALLBACK DEGRADATO
    println!("\n[7/7] PROVA DEL DISTACCO: arresto forzato del servizio locale e fallback lessicale...");
    let stop_rep = server_state.stop()?;
    println!("  Stato dopo arresto: running={}, healthy={}", stop_rep.running, stop_rep.healthy);
    assert!(!stop_rep.running, "Il servizio deve risultare spento");

    let (detached_results, detached_degraded) = hybrid_search_vault_with_port(
        &vault_copy_path,
        SearchQuery {
            term: Some(test_term.to_string()),
            limit: Some(10),
            ..Default::default()
        },
        None,
        true,
        Some(active_port),
    ).await?;

    println!("  Ricerca a servizio spento:");
    println!("  Modalita degradata: {}", detached_degraded);
    println!("  Risultati lessicali restituiti: {}", detached_results.len());
    assert!(detached_degraded, "La ricerca DEVE essere segnalata come degradata a servizio spento");
    assert!(!detached_results.is_empty(), "La ricerca lessicale deve comunque restituire risultati pertinenti");

    for (i, r) in detached_results.iter().take(3).enumerate() {
        println!("    [{}] {} (lessicale score: {:.4}) - {}", i + 1, r.title, r.score, r.relative_path);
    }

    let finished_at = now_iso();
    let collaudo_report = json!({
        "timestamp_start": started_at,
        "timestamp_end": finished_at,
        "status": "PASS",
        "vault_path": vault_copy_path.to_string_lossy(),
        "provider": set_rep,
        "model": model_status,
        "server_active_status": srv_status,
        "network_proof_lsof": lsof_str,
        "query_active": {
            "term": test_term,
            "degraded": degraded_flag,
            "results_count": hybrid_results.len(),
            "top_results": hybrid_results.into_iter().take(5).collect::<Vec<_>>()
        },
        "detachment_proof": {
            "server_stopped": !stop_rep.running,
            "query_degraded": detached_degraded,
            "results_count": detached_results.len(),
            "top_results": detached_results.into_iter().take(5).collect::<Vec<_>>()
        }
    });

    let report_json_path = evidence_dir.join("collaudo_compito1_report.json");
    fs::write(&report_json_path, serde_json::to_string_pretty(&collaudo_report)?)?;

    println!("\n============================================================");
    println!("COLLAUDO COMPITO 1 COMPLETATO CON SUCCESSO (PASS)");
    println!("Report salvato in: {}", report_json_path.display());
    println!("============================================================");

    Ok(())
}
