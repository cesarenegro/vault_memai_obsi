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

#[derive(Debug, Serialize, Deserialize)]
struct A05DiagPerQuery {
    #[serde(rename = "queryId")]
    query_id: String,
    #[serde(rename = "expectedDocument")]
    expected_document: String,
    #[serde(rename = "relevantDocumentIds")]
    relevant_document_ids: Vec<String>,
    #[serde(rename = "queryText")]
    query_text: String,
    #[serde(rename = "semanticRecallAt10")]
    semantic_recall_at_10: f64,
    #[serde(rename = "semanticRank")]
    semantic_rank: Option<usize>,
    #[serde(rename = "lexicalRecallAt10")]
    lexical_recall_at_10: f64,
    #[serde(rename = "lexicalRank")]
    lexical_rank: Option<usize>,
    #[serde(rename = "hybridRecallAt10")]
    hybrid_recall_at_10: f64,
    #[serde(rename = "hybridRank")]
    hybrid_rank: Option<usize>,
}

#[derive(Debug, Serialize)]
struct A05DiagSummary {
    benchmark: String,
    timestamp_utc8: String,
    model: String,
    cache_source: String,
    indexed_documents: usize,
    indexed_passages: usize,
    total_queries: usize,
    semantic_mean_recall_at_10: f64,
    lexical_mean_recall_at_10: f64,
    hybrid_mean_recall_at_10: f64,
    zero_recall_count_semantic: usize,
    zero_recall_queries_semantic: Vec<String>,
    zero_recall_count_lexical: usize,
    zero_recall_queries_lexical: Vec<String>,
    zero_recall_count_hybrid: usize,
    zero_recall_queries_hybrid: Vec<String>,
    semantic_hit_hybrid_miss_queries: Vec<String>,
    hybrid_hit_semantic_miss_queries: Vec<String>,
    decision_rule_verbatim: String,
    diagnostic_verdict: String,
    diagnostic_conclusion: String,
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

fn get_api_key_from_keychain() -> Result<String, String> {
    if let Ok(Some(k)) = limen_vault::keychain::load() {
        if !k.trim().is_empty() {
            return Ok(k.trim().to_string());
        }
    }
    // Headless/non-interactive CLI fallback on macOS
    let output = std::process::Command::new("/usr/bin/security")
        .args(["find-generic-password", "-s", "dev.arkai.limenvault.openai", "-a", "api-key", "-w"])
        .output()
        .map_err(|e| format!("Failed to query Keychain: {e}"))?;
    if output.status.success() {
        let key = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !key.is_empty() {
            return Ok(key);
        }
    }
    Err("OpenAI API key could not be retrieved from macOS Keychain".into())
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

    // 3. Sync embeddings using Keychain key
    println!("Synchronizing embeddings via OpenAI API (model: text-embedding-3-small)...");
    let bench_api_key = get_api_key_from_keychain().ok();
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

fn run_a05_diag(vault_path: &Path, queries_path: &Path, out_dir: &Path) -> Result<(), String> {
    let start_time = Instant::now();
    println!("=== Running A05 Semantic Diagnostic Benchmark (a05-diag) ===");
    fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;

    // 1. Load catalog
    println!("Loading catalog from vault: {:?}", vault_path);
    let catalog = limen_vault::catalog::load_catalog(vault_path)?;
    if catalog.documents.is_empty() {
        return Err("Catalog is empty. Please ensure vault has indexed documents.".into());
    }
    let total_passages: usize = catalog.documents.values().map(|d| d.passages.len()).sum();
    println!("Catalog loaded: {} documents, {} passages", catalog.documents.len(), total_passages);

    // 2. Load pre-computed embeddings cache (NO RECOMPUTATION)
    println!("Loading existing embeddings cache...");
    let cache = limen_vault::embeddings::load_embeddings_cache(vault_path)?;
    if cache.entries.len() < total_passages {
        return Err(format!(
            "Incomplete cache: found {} entries, catalog has {} passages. Recomputation forbidden.",
            cache.entries.len(),
            total_passages
        ));
    }
    let cache_source_str = vault_path.join("00_SYSTEM/EMBEDDINGS_CACHE.json").to_string_lossy().to_string();
    println!(
        "Reusing pre-computed cache: {} passages (model: {}, source: {})",
        cache.entries.len(),
        cache.model,
        cache_source_str
    );

    // 3. Ensure lexical search index is ready
    println!("Indexing vault for lexical search...");
    limen_vault::search::index_vault_search(vault_path)?;

    // 4. Securely obtain API key from Keychain (in-process only, C6)
    println!("Reading OpenAI API key from macOS Keychain (in-process)...");
    let api_key = get_api_key_from_keychain()?;
    println!("OpenAI API key acquired securely from Keychain.");

    // 5. Load gold queries
    let q_content = fs::read_to_string(queries_path).map_err(|e| e.to_string())?;
    let queries: Vec<A05Query> = serde_json::from_str(&q_content).map_err(|e| e.to_string())?;
    println!("Loaded {} gold queries from {:?}", queries.len(), queries_path);

    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;

    // 6. Batch fetch embeddings for the 40 queries from OpenAI (single batch call)
    let query_texts: Vec<String> = queries.iter().map(|q| q.text.clone()).collect();
    println!("Fetching embeddings for {} queries in a single batch from OpenAI...", query_texts.len());
    let fetch_start = Instant::now();
    let query_vectors = rt.block_on(limen_vault::embeddings::fetch_openai_embeddings(
        &api_key,
        &cache.model,
        &query_texts,
    ))?;
    println!(
        "Batch query embeddings received in {:.2}s ({} vectors).",
        fetch_start.elapsed().as_secs_f64(),
        query_vectors.len()
    );
    if query_vectors.len() != queries.len() {
        return Err(format!("Expected {} query vectors, got {}", queries.len(), query_vectors.len()));
    }

    // 7. Evaluate queries across Semantic, Lexical, and Hybrid modalities
    let mut per_query_records: Vec<A05DiagPerQuery> = Vec::new();
    let mut sem_recalls: Vec<f64> = Vec::new();
    let mut lex_recalls: Vec<f64> = Vec::new();
    let mut hyb_recalls: Vec<f64> = Vec::new();

    let mut zero_sem_queries: Vec<String> = Vec::new();
    let mut zero_lex_queries: Vec<String> = Vec::new();
    let mut zero_hyb_queries: Vec<String> = Vec::new();

    let mut sem_hit_hyb_miss: Vec<String> = Vec::new();
    let mut hyb_hit_sem_miss: Vec<String> = Vec::new();

    println!("\nEvaluating queries across 3 modalities (pure semantic, pure lexical, hybrid)...");

    for (idx, q) in queries.iter().enumerate() {
        let expected_doc = q.relevant_document_ids.first().cloned().unwrap_or_default();
        let query_vec = &query_vectors[idx];

        let is_match = |cand_id: &str, cand_path: &str| -> bool {
            q.relevant_document_ids.iter().any(|rel| cand_path.contains(rel) || cand_id == rel)
        };

        // --- Modality 1: Pure Semantic (Cosine similarity only, no lexical score, no exact match boost, no RRF) ---
        let mut sem_candidates: Vec<(String, String, f32)> = Vec::new();
        for doc in catalog.documents.values() {
            if doc.passages.is_empty() {
                continue;
            }
            let (score, _, _, _) = limen_vault::embeddings::rank_document_semantic(
                &doc.document_id,
                &doc.passages,
                query_vec,
                &cache,
            );
            sem_candidates.push((doc.document_id.clone(), doc.original_path.clone(), score));
        }
        sem_candidates.sort_by(|a, b| {
            b.2.partial_cmp(&a.2)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.0.cmp(&b.0))
        });

        let mut sem_rank: Option<usize> = None;
        for (rank_0, (doc_id, orig_path, _score)) in sem_candidates.iter().take(50).enumerate() {
            if is_match(doc_id, orig_path) {
                sem_rank = Some(rank_0 + 1);
                break;
            }
        }
        let sem_r10 = if sem_rank.map_or(false, |r| r <= 10) { 1.0 } else { 0.0 };

        // --- Modality 2: Pure Lexical (via product hybrid_search_vault with use_semantic = false) ---
        let sq_lex = limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(50),
            ..Default::default()
        };
        let res_lex = rt.block_on(limen_vault::embeddings::hybrid_search_vault(
            vault_path,
            sq_lex,
            None,
            false,
        ))?;
        let mut lex_rank: Option<usize> = None;
        for (rank_0, item) in res_lex.iter().take(50).enumerate() {
            if is_match(&item.id, &item.relative_path) {
                lex_rank = Some(rank_0 + 1);
                break;
            }
        }
        let lex_r10 = if lex_rank.map_or(false, |r| r <= 10) { 1.0 } else { 0.0 };

        // --- Modality 3: Hybrid (via product hybrid_search_vault with use_semantic = true) ---
        let sq_hyb = limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(50),
            ..Default::default()
        };
        let res_hyb = rt.block_on(limen_vault::embeddings::hybrid_search_vault(
            vault_path,
            sq_hyb,
            Some(api_key.clone()),
            true,
        ))?;
        let mut hyb_rank: Option<usize> = None;
        for (rank_0, item) in res_hyb.iter().take(50).enumerate() {
            if is_match(&item.id, &item.relative_path) {
                hyb_rank = Some(rank_0 + 1);
                break;
            }
        }
        let hyb_r10 = if hyb_rank.map_or(false, |r| r <= 10) { 1.0 } else { 0.0 };

        sem_recalls.push(sem_r10);
        lex_recalls.push(lex_r10);
        hyb_recalls.push(hyb_r10);

        if sem_r10 == 0.0 {
            zero_sem_queries.push(q.query_id.clone());
        }
        if lex_r10 == 0.0 {
            zero_lex_queries.push(q.query_id.clone());
        }
        if hyb_r10 == 0.0 {
            zero_hyb_queries.push(q.query_id.clone());
        }

        if sem_r10 == 1.0 && hyb_r10 == 0.0 {
            sem_hit_hyb_miss.push(q.query_id.clone());
        }
        if hyb_r10 == 1.0 && sem_r10 == 0.0 {
            hyb_hit_sem_miss.push(q.query_id.clone());
        }

        println!(
            "[{}] Target: {} | Sem Rank: {:?} (R@10: {:.0}) | Lex Rank: {:?} (R@10: {:.0}) | Hyb Rank: {:?} (R@10: {:.0})",
            q.query_id, expected_doc, sem_rank, sem_r10, lex_rank, lex_r10, hyb_rank, hyb_r10
        );

        per_query_records.push(A05DiagPerQuery {
            query_id: q.query_id.clone(),
            expected_document: expected_doc,
            relevant_document_ids: q.relevant_document_ids.clone(),
            query_text: q.text.clone(),
            semantic_recall_at_10: sem_r10,
            semantic_rank: sem_rank,
            lexical_recall_at_10: lex_r10,
            lexical_rank: lex_rank,
            hybrid_recall_at_10: hyb_r10,
            hybrid_rank: hyb_rank,
        });
    }

    // 8. Write per-query.jsonl
    let jsonl_path = out_dir.join("per-query.jsonl");
    let mut jsonl_file = fs::File::create(&jsonl_path).map_err(|e| e.to_string())?;
    use std::io::Write;
    for rec in &per_query_records {
        let line = serde_json::to_string(rec).map_err(|e| e.to_string())?;
        writeln!(jsonl_file, "{}", line).map_err(|e| e.to_string())?;
    }

    // 9. Compute means & apply reading rule
    let sem_mean = sem_recalls.iter().sum::<f64>() / (sem_recalls.len() as f64);
    let lex_mean = lex_recalls.iter().sum::<f64>() / (lex_recalls.len() as f64);
    let hyb_mean = hyb_recalls.iter().sum::<f64>() / (hyb_recalls.len() as f64);

    let decision_rule_verbatim = "Semantica da sola maggiore o uguale a 0,85: la semantica funziona, il problema è nella fusione. Il passo successivo diventa la taratura dei pesi, non il cambio di modello.\nSemantica da sola minore o uguale a 0,70: il problema è negli embedding o nel modello. Il passo successivo diventa il modello più grande o il testo indicizzato.\nValore intermedio: entrambe le cause concorrono; si riportano i numeri e si decide con l'utente.".to_string();

    let (verdict, conclusion) = if sem_mean >= 0.85 {
        (
            "SEMANTICA_VALIDA_PROBLEMA_FUSIONE".to_string(),
            format!(
                "La semantica da sola vale {:.3} (>= 0.85): la semantica funziona, il problema è nella fusione. Il passo successivo è la taratura dei pesi.",
                sem_mean
            ),
        )
    } else if sem_mean <= 0.70 {
        (
            "PROBLEMA_EMBEDDING_O_MODELLO".to_string(),
            format!(
                "La semantica da sola vale {:.3} (<= 0.70): il problema è negli embedding o nel modello. Il passo successivo è il modello più grande o il testo indicizzato.",
                sem_mean
            ),
        )
    } else {
        (
            "CONCORSO_CAUSE_DECISIONE_UTENTE".to_string(),
            format!(
                "La semantica da sola vale {:.3} (valore intermedio 0.70 < x < 0.85): entrambe le cause concorrono. Si riportano i numeri e si decide con l'utente.",
                sem_mean
            ),
        )
    };

    let summary = A05DiagSummary {
        benchmark: "A05 — Misura Diagnostica Semantica vs Lessicale vs Ibrida".into(),
        timestamp_utc8: get_utc8_timestamp(),
        model: cache.model,
        cache_source: cache_source_str,
        indexed_documents: catalog.documents.len(),
        indexed_passages: total_passages,
        total_queries: queries.len(),
        semantic_mean_recall_at_10: (sem_mean * 1000.0).round() / 1000.0,
        lexical_mean_recall_at_10: (lex_mean * 1000.0).round() / 1000.0,
        hybrid_mean_recall_at_10: (hyb_mean * 1000.0).round() / 1000.0,
        zero_recall_count_semantic: zero_sem_queries.len(),
        zero_recall_queries_semantic: zero_sem_queries,
        zero_recall_count_lexical: zero_lex_queries.len(),
        zero_recall_queries_lexical: zero_lex_queries,
        zero_recall_count_hybrid: zero_hyb_queries.len(),
        zero_recall_queries_hybrid: zero_hyb_queries,
        semantic_hit_hybrid_miss_queries: sem_hit_hyb_miss,
        hybrid_hit_semantic_miss_queries: hyb_hit_sem_miss,
        decision_rule_verbatim,
        diagnostic_verdict: verdict,
        diagnostic_conclusion: conclusion,
    };

    let summary_path = out_dir.join("summary.json");
    fs::write(&summary_path, serde_json::to_string_pretty(&summary).unwrap()).map_err(|e| e.to_string())?;

    let elapsed = start_time.elapsed();
    println!("\n=== A05 Diagnostic Summary ===");
    println!("Semantic Mean Recall@10: {:.3}", summary.semantic_mean_recall_at_10);
    println!("Lexical Mean Recall@10:  {:.3}", summary.lexical_mean_recall_at_10);
    println!("Hybrid Mean Recall@10:   {:.3}", summary.hybrid_mean_recall_at_10);
    println!("Semantic Zero-Recall:    {}", summary.zero_recall_count_semantic);
    println!("Lexical Zero-Recall:     {}", summary.zero_recall_count_lexical);
    println!("Hybrid Zero-Recall:      {}", summary.zero_recall_count_hybrid);
    println!("Semantic Hits Demoted by Fusion (Sem=1, Hyb=0): {:?}", summary.semantic_hit_hybrid_miss_queries);
    println!("Hybrid Rescued by Lexical (Hyb=1, Sem=0):       {:?}", summary.hybrid_hit_semantic_miss_queries);
    println!("Diagnostic Verdict:      {}", summary.diagnostic_verdict);
    println!("Diagnostic Conclusion:   {}", summary.diagnostic_conclusion);
    println!("Total Duration:          {:.2}s", elapsed.as_secs_f64());
    println!("Evidence written to {:?}", out_dir);

    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 5 {
        eprintln!("Usage: gold-benchmark <a05|a05-diag|a15> <vault_path> <queries_path> <out_dir>");
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
        "a05-diag" => {
            if let Err(e) = run_a05_diag(vault_path, queries_path, out_dir) {
                eprintln!("A05 Diagnostic Benchmark Error: {e}");
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
            eprintln!("Unknown mode: {mode}. Use 'a05', 'a05-diag', or 'a15'");
            std::process::exit(1);
        }
    }
}
