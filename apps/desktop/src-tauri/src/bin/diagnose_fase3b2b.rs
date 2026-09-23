// E:\Projects\vault_memai_obsi\apps\desktop\src-tauri\src\bin\diagnose_fase3b2b.rs
// Diagnostica comparativa offline per il Passo 3b-2b.
// Esegue select_with_port_timed sulle tre domande di Cesare senza chiamare OpenAI.
// Misura puntualmente t_doc_read_ms, t_passage_extract_ms, t_search_ms, e verifica l'assenza di sovrapposizioni.

use limen_vault::ai::{self, Options};
use limen_vault::llama;
use std::path::Path;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let vault_dir = Path::new(r"E:\VAULT WIN TEST DEV");
    println!("================================================================================");
    println!("DIAGNOSTICA COMPARATIVA PASSO 3b-2b — PRESTAZIONI E ZERO SOVRAPPOSIZIONI");
    println!("Vault: {:?}", vault_dir);
    println!("================================================================================");

    // Rileva eventuale servizio locale bge-m3 già avviato
    let candidate_ports = [59722, 62021, 8080];
    let mut active_port: Option<u16> = None;
    for &p in &candidate_ports {
        if llama::check_health(p) {
            println!("Servizio locale bge-m3 rilevato attivo sulla porta {}", p);
            active_port = Some(p);
            break;
        }
    }

    if active_port.is_none() {
        println!("Nessun server locale rilevato; select_with_port_timed eseguirà ricerca ibrida/lessicale con fallback.");
    }

    let queries = [
        "Cosa è il progetto BNXT?",
        "ARKAI è un'azienda o un marchio? Di cosa si occupa?",
        "Cos'è il progetto SCENA e quali app comprende?",
    ];

    for (idx, q) in queries.iter().enumerate() {
        println!("\n--------------------------------------------------------------------------------");
        println!("DOMANDA #{}: \"{}\"", idx + 1, q);
        println!("--------------------------------------------------------------------------------");

        let options = Options {
            prompt: q.to_string(),
            model: "gpt-4o".to_string(),
            include_drafts: false,
            source_ids: vec![],
            category: None,
            client: None,
            project: None,
            tags: None,
        };

        match ai::select_with_port_timed(vault_dir, &options, active_port).await {
            Ok((sources, timings)) => {
                let total_content_bytes: usize = sources.iter().map(|s| s.content.len()).sum();
                let serialized_bytes = serde_json::to_string(&sources).map(|s| s.len()).unwrap_or(0);
                println!("Fonti selezionate da select_with_port_timed: {} fonti", sources.len());
                println!("Volume testo contenuti (s.content): {} byte (su 24.000 byte budget)", total_content_bytes);
                println!("Volume payload serializzato JSON: {} byte", serialized_bytes);
                println!(
                    "Tempi Preview: totale: {} ms | search: {} ms | doc_read: {} ms | passage_extract: {} ms",
                    timings.t_preview_total_ms,
                    timings.t_search_ms,
                    timings.t_doc_read_ms,
                    timings.t_passage_extract_ms
                );

                // Verifica automatica assenza di sovrapposizioni
                for s in &sources {
                    if let Some(ref loc) = s.locator {
                        let parts: Vec<&str> = loc.split(", ").collect();
                        for i in 0..parts.len() {
                            for j in (i + 1)..parts.len() {
                                if ai::locators_overlap(parts[i], parts[j]) {
                                    eprintln!("ATTENZIONE: Trovata sovrapposizione tra '{}' e '{}' in {}", parts[i], parts[j], s.relative_path);
                                }
                            }
                        }
                    }
                }

                println!("\nDettaglio Fonti Inviate:");
                println!("{:<6}| {:<70} | {:<8} | {:<9} | {:<30}", "ID", "Percorso Relativo", "Byte", "Passaggi", "Localizzatore");
                println!("{:-<6}+{:-<72}+{:-<10}+{:-<11}+{:-<31}", "", "", "", "", "");

                for (s_idx, s) in sources.iter().enumerate() {
                    let id_tag = format!("S{}", s_idx + 1);
                    let num_p = if !s.passage_hashes.is_empty() {
                        s.passage_hashes.len()
                    } else {
                        1
                    };
                    let loc_str = s.locator.as_deref().unwrap_or("-");
                    println!(
                        "[{:<4}] | {:<70} | {:>6} B | {:>7} p | {}",
                        id_tag,
                        s.relative_path,
                        s.content.len(),
                        num_p,
                        loc_str
                    );
                }
            }
            Err(e) => {
                eprintln!("ERRORE durante select_with_port_timed: {}", e);
            }
        }
    }

    println!("\n================================================================================");
    println!("DIAGNOSTICA PASSO 3b-2b COMPLETATA CON SUCCESSO");
    println!("================================================================================\n");
    Ok(())
}
