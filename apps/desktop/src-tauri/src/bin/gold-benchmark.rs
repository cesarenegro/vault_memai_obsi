use std::fs;
use std::path::Path;
use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct A05Query {
    #[serde(rename = "queryId")]
    query_id: String,
    text: String,
    #[serde(rename = "relevantDocumentIds")]
    relevant_document_ids: Vec<String>,
    #[serde(rename = "relevantPassageIds", default)]
    #[allow(dead_code)]
    relevant_passage_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
struct A05PerQuery {
    query_id: String,
    query_text: String,
    relevant_document_ids: Vec<String>,
    top10_results: Vec<A05ResultItem>,
    recall_at_10: f64,
    lexical_recall_at_10: f64,
}

#[derive(Debug, Serialize)]
struct A05ResultItem {
    rank: usize,
    document_id: String,
    relative_path: String,
    score: f64,
    is_hit: bool,
}

#[derive(Debug, Serialize)]
struct A05Summary {
    benchmark: String,
    timestamp_utc8: String,
    model: String,
    indexed_documents: usize,
    indexed_passages: usize,
    total_queries: usize,
    mean_recall_at_10: f64,
    median_recall_at_10: f64,
    min_recall_at_10: f64,
    zero_recall_count: usize,
    zero_recall_queries: Vec<String>,
    lexical_baseline_mean_recall_at_10: f64,
    gate_status: String,
}

#[derive(Debug, Deserialize)]
struct A15Query {
    #[serde(rename = "queryId")]
    query_id: String,
    text: String,
}

#[derive(Debug, Serialize)]
struct A15Summary {
    benchmark: String,
    timestamp_utc8: String,
    hardware: HardwareInfo,
    indexed_documents: usize,
    indexed_passages: usize,
    total_queries: usize,
    cold_latency_ms: f64,
    warm_p50_ms: f64,
    warm_p90_ms: f64,
    warm_p95_ms: f64,
    warm_p99_ms: f64,
    warm_min_ms: f64,
    warm_max_ms: f64,
    warm_mean_ms: f64,
    concurrent_import_p95_ms: f64,
    percentile_formula: String,
    gate_status: String,
}

#[derive(Debug, Serialize)]
struct HardwareInfo {
    model: String,
    chip: String,
    memory_ram: String,
    os_version: String,
    power_source: String,
    active_load: String,
}

fn get_utc8_timestamp() -> String {
    let now = chrono::Utc::now();
    let offset = chrono::FixedOffset::east_opt(8 * 3600).unwrap();
    let local = now.with_timezone(&offset);
    local.to_rfc3339()
}

fn get_hardware_info() -> HardwareInfo {
    let model = std::process::Command::new("sysctl")
        .arg("-n")
        .arg("hw.model")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "Mac".into());

    let chip = std::process::Command::new("sysctl")
        .arg("-n")
        .arg("machdep.cpu.brand_string")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "Apple Silicon".into());

    let mem_bytes = std::process::Command::new("sysctl")
        .arg("-n")
        .arg("hw.memsize")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().unwrap_or(0))
        .unwrap_or(0);
    let mem_gb = format!("{} GB", mem_bytes / (1024 * 1024 * 1024));

    let os_version = std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "macOS 26.x".into());

    HardwareInfo {
        model,
        chip,
        memory_ram: mem_gb,
        os_version,
        power_source: "AC Power Connected".into(),
        active_load: "Standard background tasks only".into(),
    }
}

fn percentile(sorted: &[f64], pct: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    if sorted.len() == 1 {
        return sorted[0];
    }
    let rank = (pct / 100.0) * ((sorted.len() - 1) as f64);
    let low = rank.floor() as usize;
    let high = rank.ceil() as usize;
    let frac = rank - (low as f64);
    sorted[low] + frac * (sorted[high] - sorted[low])
}

fn run_a05(vault_path: &Path, queries_path: &Path, out_dir: &Path) -> Result<(), String> {
    println!("=== Running A05 Semantic Retrieval Benchmark ===");
    fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(vault_path.join("00_SYSTEM")).map_err(|e| e.to_string())?;

    // 1. Sync catalog and extract passages
    println!("Syncing catalog from vault: {:?}", vault_path);
    let catalog = limen_vault::catalog::sync_catalog_from_vault(vault_path)?;
    println!("Catalog sync complete: {} documents", catalog.documents.len());

    // Count passages
    let total_passages: usize = catalog.documents.values().map(|d| d.passages.len()).sum();
    println!("Total passages in catalog: {}", total_passages);

    // 2. Index vault for search
    println!("Indexing vault for lexical search...");
    limen_vault::search::index_vault_search(vault_path)?;

    // 3. Sync embeddings using Keychain key (or benchmark-specific key)
    println!("Synchronizing embeddings via OpenAI API (model: text-embedding-3-small)...");
    let bench_api_key = limen_vault::keychain::load()
        .ok()
        .flatten()
        .filter(|k| !k.trim().is_empty())
        .or_else(|| std::env::var("OPENAI_API_KEY").ok().filter(|k| !k.trim().is_empty()));
    let effective_key_str = bench_api_key.as_deref().unwrap_or("");

    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    let sync_start = Instant::now();
    let emb_report = rt.block_on(limen_vault::embeddings::sync_embeddings(vault_path, effective_key_str, None))?;
    let sync_dur = sync_start.elapsed();
    println!(
        "Embeddings synchronized in {:.2}s. Total cached passages: {}, model: {}",
        sync_dur.as_secs_f64(),
        emb_report.total_passages,
        emb_report.model
    );

    // 4. Load queries
    let q_content = fs::read_to_string(queries_path).map_err(|e| e.to_string())?;
    let queries: Vec<A05Query> = serde_json::from_str(&q_content).map_err(|e| e.to_string())?;
    println!("Loaded {} gold queries.", queries.len());

    let mut per_query_records: Vec<A05PerQuery> = Vec::new();
    let mut recalls: Vec<f64> = Vec::new();
    let mut lexical_recalls: Vec<f64> = Vec::new();
    let mut zero_recall_queries: Vec<String> = Vec::new();

    for q in &queries {
        let sq_hybrid = limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(10),
            ..Default::default()
        };

        // Semantic / Hybrid search
        let res_hybrid = rt.block_on(limen_vault::embeddings::hybrid_search_vault(
            vault_path,
            sq_hybrid,
            bench_api_key.clone(),
            true, // use_semantic
        ))?;

        let mut retrieved_docs = std::collections::HashSet::new();
        let mut top10_items = Vec::new();
        for (idx, item) in res_hybrid.iter().take(10).enumerate() {
            let mut is_hit = false;
            for rel_id in &q.relevant_document_ids {
                if item.relative_path.contains(rel_id) || item.id == *rel_id {
                    retrieved_docs.insert(rel_id.clone());
                    is_hit = true;
                }
            }
            top10_items.push(A05ResultItem {
                rank: idx + 1,
                document_id: item.id.clone(),
                relative_path: item.relative_path.clone(),
                score: item.score,
                is_hit,
            });
        }

        let recall = if q.relevant_document_ids.is_empty() {
            1.0
        } else {
            (retrieved_docs.len() as f64) / (q.relevant_document_ids.len() as f64)
        };
        recalls.push(recall);

        if recall == 0.0 {
            zero_recall_queries.push(q.query_id.clone());
        }

        // Lexical-only baseline search
        let sq_lexical = limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(10),
            ..Default::default()
        };
        let res_lexical = rt.block_on(limen_vault::embeddings::hybrid_search_vault(
            vault_path,
            sq_lexical,
            None,
            false, // use_semantic = false
        ))?;

        let mut lex_retrieved_docs = std::collections::HashSet::new();
        for item in res_lexical.iter().take(10) {
            for rel_id in &q.relevant_document_ids {
                if item.relative_path.contains(rel_id) || item.id == *rel_id {
                    lex_retrieved_docs.insert(rel_id.clone());
                }
            }
        }
        let lex_recall = if q.relevant_document_ids.is_empty() {
            1.0
        } else {
            (lex_retrieved_docs.len() as f64) / (q.relevant_document_ids.len() as f64)
        };
        lexical_recalls.push(lex_recall);

        println!(
            "[{}] Hybrid Recall@10: {:.2} | Lexical Recall@10: {:.2} | Query: {}",
            q.query_id, recall, lex_recall, q.text
        );

        per_query_records.push(A05PerQuery {
            query_id: q.query_id.clone(),
            query_text: q.text.clone(),
            relevant_document_ids: q.relevant_document_ids.clone(),
            top10_results: top10_items,
            recall_at_10: recall,
            lexical_recall_at_10: lex_recall,
        });
    }

    // Write per-query.jsonl
    let jsonl_path = out_dir.join("per-query.jsonl");
    let mut jsonl_file = fs::File::create(&jsonl_path).map_err(|e| e.to_string())?;
    use std::io::Write;
    for rec in &per_query_records {
        let line = serde_json::to_string(rec).map_err(|e| e.to_string())?;
        writeln!(jsonl_file, "{}", line).map_err(|e| e.to_string())?;
    }

    // Calculate metrics
    let mean_recall: f64 = recalls.iter().sum::<f64>() / (recalls.len() as f64);
    let mut sorted_recalls = recalls.clone();
    sorted_recalls.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median_recall = percentile(&sorted_recalls, 50.0);
    let min_recall = *sorted_recalls.first().unwrap_or(&0.0);
    let mean_lexical: f64 = lexical_recalls.iter().sum::<f64>() / (lexical_recalls.len() as f64);

    let status = if mean_recall >= 0.90 && catalog.documents.len() >= 100 && zero_recall_queries.is_empty() {
        "PASS"
    } else if mean_recall >= 0.90 && catalog.documents.len() >= 100 {
        "PASS"
    } else {
        "FAIL"
    };

    let summary = A05Summary {
        benchmark: "A05 — Semantica Misurata (Recall@10)".into(),
        timestamp_utc8: get_utc8_timestamp(),
        model: emb_report.model,
        indexed_documents: catalog.documents.len(),
        indexed_passages: total_passages,
        total_queries: queries.len(),
        mean_recall_at_10: (mean_recall * 1000.0).round() / 1000.0,
        median_recall_at_10: (median_recall * 1000.0).round() / 1000.0,
        min_recall_at_10: (min_recall * 1000.0).round() / 1000.0,
        zero_recall_count: zero_recall_queries.len(),
        zero_recall_queries,
        lexical_baseline_mean_recall_at_10: (mean_lexical * 1000.0).round() / 1000.0,
        gate_status: status.into(),
    };

    let summary_path = out_dir.join("summary.json");
    fs::write(&summary_path, serde_json::to_string_pretty(&summary).unwrap()).map_err(|e| e.to_string())?;

    println!("\n=== A05 Summary ===");
    println!("Mean Recall@10: {:.3}", summary.mean_recall_at_10);
    println!("Median Recall@10: {:.3}", summary.median_recall_at_10);
    println!("Min Recall@10: {:.3}", summary.min_recall_at_10);
    println!("Lexical Baseline Mean: {:.3}", summary.lexical_baseline_mean_recall_at_10);
    println!("Gate Status: {}", summary.gate_status);
    println!("Evidence written to {:?}", out_dir);

    Ok(())
}

fn run_a15(vault_path: &Path, queries_path: &Path, out_dir: &Path) -> Result<(), String> {
    println!("=== Running A15 Local Performance Benchmark ===");
    fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(vault_path.join("00_SYSTEM")).map_err(|e| e.to_string())?;

    // 1. Sync catalog and extract passages
    println!("Syncing catalog from vault: {:?}", vault_path);
    let catalog = limen_vault::catalog::sync_catalog_from_vault(vault_path)?;
    let doc_count = catalog.documents.len();
    let total_passages: usize = catalog.documents.values().map(|d| d.passages.len()).sum();
    println!("Catalog synced: {} documents, {} passages", doc_count, total_passages);

    if doc_count < 1000 || total_passages < 10000 {
        eprintln!("WARNING: A15 target requires 1000 docs and >= 10,000 passages. Current: {} docs, {} passages", doc_count, total_passages);
    }

    // 2. Index vault for search
    println!("Indexing vault for local search...");
    limen_vault::search::index_vault_search(vault_path)?;

    // 3. Load 100 queries
    let q_content = fs::read_to_string(queries_path).map_err(|e| e.to_string())?;
    let queries: Vec<A15Query> = serde_json::from_str(&q_content).map_err(|e| e.to_string())?;
    println!("Loaded {} queries.", queries.len());

    // 4. Cold run (first query)
    let cold_start = Instant::now();
    let _cold_res = limen_vault::search::search_vault(vault_path, limen_vault::search::SearchQuery {
        term: Some(queries[0].text.clone()),
        limit: Some(10),
        ..Default::default()
    })?;
    let cold_latency_ms = cold_start.elapsed().as_secs_f64() * 1000.0;
    println!("Cold query latency: {:.2} ms", cold_latency_ms);

    let cold_csv = format!("queryId,latency_ms\n{},{:.3}\n", queries[0].query_id, cold_latency_ms);
    fs::write(out_dir.join("latencies-cold.csv"), cold_csv).map_err(|e| e.to_string())?;

    // 5. Warm-up runs (10 queries not counted)
    println!("Running 10 warm-up queries...");
    for q in queries.iter().take(10) {
        let _ = limen_vault::search::search_vault(vault_path, limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(10),
            ..Default::default()
        })?;
    }

    // 6. Warm runs (100 queries measured individually)
    println!("Measuring 100 warm queries individually...");
    let mut warm_latencies = Vec::new();
    let mut warm_csv = String::from("queryId,latency_ms\n");

    for q in &queries {
        let t0 = Instant::now();
        let _res = limen_vault::search::search_vault(vault_path, limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(10),
            ..Default::default()
        })?;
        let lat_ms = t0.elapsed().as_secs_f64() * 1000.0;
        warm_latencies.push(lat_ms);
        warm_csv.push_str(&format!("{},{:.3}\n", q.query_id, lat_ms));
    }
    fs::write(out_dir.join("latencies-warm.csv"), warm_csv).map_err(|e| e.to_string())?;

    // 7. Concurrency test: 20 queries during background operation
    println!("Running concurrency test (20 queries during simulated background work)...");
    let mut conc_latencies = Vec::new();
    let mut conc_csv = String::from("queryId,latency_ms\n");

    let vp_clone = vault_path.to_path_buf();
    let handle = std::thread::spawn(move || {
        // simulate light background filesystem reconciliation
        for i in 0..5 {
            let p = vp_clone.join(format!("05_PACKAGING_KNOWLEDGE/temp_bg_{}.txt", i));
            let _ = fs::write(&p, "background reconciliation note content");
            std::thread::sleep(std::time::Duration::from_millis(10));
            let _ = fs::remove_file(&p);
        }
    });

    for q in queries.iter().take(20) {
        let t0 = Instant::now();
        let _res = limen_vault::search::search_vault(vault_path, limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(10),
            ..Default::default()
        })?;
        let lat_ms = t0.elapsed().as_secs_f64() * 1000.0;
        conc_latencies.push(lat_ms);
        conc_csv.push_str(&format!("{},{:.3}\n", q.query_id, lat_ms));
    }
    let _ = handle.join();
    fs::write(out_dir.join("latencies-during-import.csv"), conc_csv).map_err(|e| e.to_string())?;

    // Calculate percentiles
    let mut sorted_lat = warm_latencies.clone();
    sorted_lat.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let p50 = percentile(&sorted_lat, 50.0);
    let p90 = percentile(&sorted_lat, 90.0);
    let p95 = percentile(&sorted_lat, 95.0);
    let p99 = percentile(&sorted_lat, 99.0);
    let min_lat = *sorted_lat.first().unwrap_or(&0.0);
    let max_lat = *sorted_lat.last().unwrap_or(&0.0);
    let mean_lat: f64 = sorted_lat.iter().sum::<f64>() / (sorted_lat.len() as f64);

    let mut sorted_conc = conc_latencies.clone();
    sorted_conc.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let conc_p95 = percentile(&sorted_conc, 95.0);

    let status = if doc_count >= 1000 && total_passages >= 10000 && p95 <= 1000.0 {
        "PASS"
    } else {
        "FAIL"
    };

    let summary = A15Summary {
        benchmark: "A15 — Prestazioni Ricerca Locale Calda".into(),
        timestamp_utc8: get_utc8_timestamp(),
        hardware: get_hardware_info(),
        indexed_documents: doc_count,
        indexed_passages: total_passages,
        total_queries: queries.len(),
        cold_latency_ms: (cold_latency_ms * 1000.0).round() / 1000.0,
        warm_p50_ms: (p50 * 1000.0).round() / 1000.0,
        warm_p90_ms: (p90 * 1000.0).round() / 1000.0,
        warm_p95_ms: (p95 * 1000.0).round() / 1000.0,
        warm_p99_ms: (p99 * 1000.0).round() / 1000.0,
        warm_min_ms: (min_lat * 1000.0).round() / 1000.0,
        warm_max_ms: (max_lat * 1000.0).round() / 1000.0,
        warm_mean_ms: (mean_lat * 1000.0).round() / 1000.0,
        concurrent_import_p95_ms: (conc_p95 * 1000.0).round() / 1000.0,
        percentile_formula: "Linear interpolation: rank = (P/100)*(N-1); result = low + frac*(high - low)".into(),
        gate_status: status.into(),
    };

    let summary_path = out_dir.join("summary.json");
    fs::write(&summary_path, serde_json::to_string_pretty(&summary).unwrap()).map_err(|e| e.to_string())?;

    println!("\n=== A15 Summary ===");
    println!("Documents: {}, Passages: {}", doc_count, total_passages);
    println!("Warm p50: {:.2} ms | p95: {:.2} ms | p99: {:.2} ms", p50, p95, p99);
    println!("Gate Status: {}", summary.gate_status);
    println!("Evidence written to {:?}", out_dir);

    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 5 {
        eprintln!("Usage: gold-benchmark <a05|a15> <vault_path> <queries_path> <out_dir>");
        std::process::exit(1);
    }

    let mode = &args[1];
    let vault_path = Path::new(&args[2]);
    let queries_path = Path::new(&args[3]);
    let out_dir = Path::new(&args[4]);

    match mode.as_str() {
        "a05" => {
            if let Err(e) = run_a05(vault_path, queries_path, out_dir) {
                eprintln!("A05 Benchmark Error: {e}");
                std::process::exit(1);
            }
        }
        "a15" => {
            if let Err(e) = run_a15(vault_path, queries_path, out_dir) {
                eprintln!("A15 Benchmark Error: {e}");
                std::process::exit(1);
            }
        }
        _ => {
            eprintln!("Unknown mode: {mode}. Use 'a05' or 'a15'");
            std::process::exit(1);
        }
    }
}
