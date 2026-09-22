use std::{
    fs,
    path::Path,
    time::Instant,
};

async fn run_bench(
    vault_path: &Path,
    port: u16,
    query_text: String,
    label: String,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let mut results = Vec::new();
    println!("\n--- Query: {} ({}) ---", query_text, label);
    results.push(format!("--- QUERY: \"{}\" ({}) ---", query_text, label));
    results.push(format!(
        "{:<6} | {:<22} | {:<25} | {:<20} | {:<28} | {:<12}",
        "Rep #",
        "SEARCH_INDEX load (ms)",
        "EMBEDDINGS_CACHE load (ms)",
        "Query Embedding (ms)",
        "Search Computation (ms)",
        "Total Real (ms)"
    ));
    results.push("-------------------------------------------------------------------------------------------------------------------------".into());

    for i in 1..=10 {
        let t_start = Instant::now();

        // a) Measure SEARCH_INDEX load (uses in-memory Arc cache on rep 2-10)
        let t_idx_start = Instant::now();
        let _idx_data = limen_vault::search::load_index_for_vault(vault_path)?;
        let t_idx_ms = t_idx_start.elapsed().as_secs_f64() * 1000.0;

        // b) Measure EMBEDDINGS_CACHE load (uses in-memory Arc cache on rep 2-10)
        let t_emb_start = Instant::now();
        let _emb_data = limen_vault::embeddings::load_embeddings_cache(vault_path)?;
        let t_emb_ms = t_emb_start.elapsed().as_secs_f64() * 1000.0;

        // c) Measure Query Embedding via llama-server
        let t_vec_start = Instant::now();
        let endpoint = format!("http://127.0.0.1:{}/v1/embeddings", port);
        let client = reqwest::Client::new();
        let body = serde_json::json!({
            "input": [query_text.clone()],
            "model": "bge-m3"
        });
        let resp = client.post(&endpoint).json(&body).send().await?.error_for_status()?;
        let vec_json: serde_json::Value = resp.json().await?;
        let t_vec_ms = t_vec_start.elapsed().as_secs_f64() * 1000.0;

        let q_vec: Option<Vec<f32>> = vec_json["data"][0]["embedding"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect());

        // d) Measure Search Computation (BM25 + Cosine similarity + RRF fusion)
        let t_calc_start = Instant::now();
        let calc_res = limen_vault::embeddings::hybrid_search_vault_with_vector(
            vault_path,
            limen_vault::search::SearchQuery {
                term: Some(query_text.clone()),
                ..Default::default()
            },
            q_vec,
            true,
        )
        .await;

        let t_calc_ms = t_calc_start.elapsed().as_secs_f64() * 1000.0;
        let t_total_ms = t_start.elapsed().as_secs_f64() * 1000.0;

        if let Err(ref e) = calc_res {
            println!("Rep {} calculation error: {}", i, e);
        }

        let line = format!(
            "{:<6} | {:<22.2} | {:<25.2} | {:<20.2} | {:<28.2} | {:<12.2}",
            i, t_idx_ms, t_emb_ms, t_vec_ms, t_calc_ms, t_total_ms
        );
        println!("{}", line);
        results.push(line);
    }
    Ok(results)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let vault_path = Path::new(r"E:\VAULT WIN TEST DEV");
    let port: u16 = 62021; // Active running llama-server port

    let q1 = "posizionamento brand strategie marketing".to_string();
    let q2 = "trasformazione digitale dell'esperienza utente nelle aziende".to_string();

    println!("=== BENCHMARK SEARCH TIMING AFTER OPTIMIZATION A2 (ZERO-COPY) ===");
    println!("Vault: {:?}", vault_path);
    println!("Llama Port: {}", port);

    let mut output_lines = Vec::new();

    output_lines.push("=========================================================================".into());
    output_lines.push("HEADER: E:\\VAULT WIN TEST DEV\\00_SYSTEM files".into());
    output_lines.push("=========================================================================".into());
    output_lines.push("Name                     Length".into());
    output_lines.push("----                     ------".into());
    output_lines.push("EMBEDDINGS_CACHE.json 311247199".into());
    output_lines.push("SEARCH_INDEX.json     129047124".into());
    output_lines.push("VAULT_CATALOG.json     31605698".into());
    output_lines.push("VAULT_RULES.md             1332".into());
    output_lines.push("HOME.md                    1159".into());
    output_lines.push("=========================================================================\n".into());

    let res1 = run_bench(
        vault_path,
        port,
        q1,
        "Parole presenti nei documenti".to_string(),
    )
    .await?;
    output_lines.extend(res1);

    let res2 = run_bench(
        vault_path,
        port,
        q2,
        "Query concettuale senza parole in comune".to_string(),
    )
    .await?;
    output_lines.extend(res2);

    let out_dir = Path::new(r"E:\Projects\vault_memai_obsi\IMPLEMENTATION\WINDOWS_BUILD_EVIDENCE");
    fs::create_dir_all(out_dir)?;
    let out_path = out_dir.join("search-timing-after-A2.txt");
    fs::write(&out_path, output_lines.join("\n"))?;

    println!("\nRisultati salvati in: {:?}", out_path);
    Ok(())
}
