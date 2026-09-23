use limen_vault::search::{self, SearchQuery};
use std::path::Path;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let vault_path = Path::new(r"E:\VAULT WIN TEST DEV");
    if !vault_path.exists() {
        eprintln!("Vault path does not exist: {:?}", vault_path);
        std::process::exit(1);
    }

    let srv = limen_vault::llama::LlamaServerState::default().status();
    let port = if srv.running && srv.healthy { Some(srv.port) } else { None };

    let query_str = "cosa e' il progetto bnxt ?";
    println!("===========================================================");
    println!("DIAGNOSTICA RICERCA IBRIDA PER: \"{}\"", query_str);
    println!("Vault: {:?}", vault_path);
    println!("Porta bge-m3: {:?}", port);
    println!("===========================================================\n");

    // 1. Tokenization Analysis
    let tokens = search::tokenize_text(query_str);
    println!("1. TOKEN DI RICERCA ESTRATTI DALLA DOMANDA:");
    println!("   Query grezza: \"{}\"", query_str);
    println!("   Token estratti: {:?}\n", tokens);

    // 2. Perform Hybrid Search
    let (rows, degraded) = limen_vault::embeddings::hybrid_search_vault_with_port_filtered::<fn(&search::SearchDocumentRecord) -> bool>(
        vault_path,
        SearchQuery {
            term: Some(query_str.to_string()),
            category: None,
            client: None,
            project: None,
            tags: None,
            status: None,
            limit: Some(200),
            offset: None,
        },
        None,
        true,
        port,
        None,
    ).await?;

    println!("2. RISULTATI RICERCA IBRIDA (Degradata: {}):", degraded);
    println!("   Totale candidati trovati: {}\n", rows.len());

    println!("{:<4} | {:<60} | {:<10}", "Rango", "Relative Path / Titolo", "Score");
    println!("-----------------------------------------------------------------------------------------");
    for (idx, r) in rows.iter().enumerate().take(25) {
        println!("{:<5} | {:<60} | {:.4}", idx + 1, r.relative_path, r.score);
    }

    // 3. Check Rank for the 9 Target BNXT Files
    let target_files = vec![
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

    println!("\n3. POSIZIONE IN CLASSIFICA DEI 9 DOCUMENTI BNXT RISCONTRATI DA CESARE:");
    println!("{:<4} | {:<65} | {:<10} | {:<15}", "#", "Nome File", "Rango", "Score");
    println!("----------------------------------------------------------------------------------------------------");

    for (i, target) in target_files.iter().enumerate() {
        let pos = rows.iter().position(|r| r.relative_path.contains(target));
        match pos {
            Some(p) => {
                let r = &rows[p];
                println!("{:<4} | {:<65} | {:<10} | {:.4}", i + 1, target, p + 1, r.score);
            }
            None => {
                println!("{:<4} | {:<65} | {:<10} | N/A", i + 1, target, "FUORI TOP 200");
            }
        }
    }

    // 4. Test select() behavior and byte budget
    let options = limen_vault::ai::Options {
        prompt: query_str.to_string(),
        model: "gpt-4o".to_string(),
        include_drafts: true,
        source_ids: vec![],
        category: None,
        client: None,
        project: None,
        tags: None,
    };

    let selected_sources = limen_vault::ai::select(vault_path, &options).await?;
    println!("\n4. SELEZIONE FINALE DELLE FONTI DA select():");
    println!("   Totale fonti selezionate: {}", selected_sources.len());
    let mut total_bytes = 0;
    for (idx, s) in selected_sources.iter().enumerate() {
        let b = serde_json::to_vec(s)?.len();
        total_bytes += b;
        println!("   [{}] {} ({}) — {} byte (Cumulativi: {} byte)", idx + 1, s.title, s.relative_path, b, total_bytes);
    }

    Ok(())
}
