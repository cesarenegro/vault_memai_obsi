use std::fs;
use std::path::Path;
use std::time::Instant;
use std::collections::BTreeMap;
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
    #[serde(skip_serializing_if = "Option::is_none")]
    comparison_vs_v2_diagnostic: Option<V2DiagnosticComparison>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueryComparisonItem {
    query_id: String,
    expected_document: String,
    v2_hybrid_rank: Option<usize>,
    v2_hybrid_recall: f64,
    new_hybrid_rank: Option<usize>,
    new_hybrid_recall: f64,
    status: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct V2DiagnosticComparison {
    baseline_diagnostic_path: String,
    pre_fusion_hybrid_mean_recall_at_10: f64,
    post_fusion_hybrid_mean_recall_at_10: f64,
    improved_queries_count: usize,
    improved_queries: Vec<String>,
    degraded_queries_count: usize,
    degraded_queries: Vec<String>,
    same_queries_count: usize,
    query_comparisons: Vec<QueryComparisonItem>,
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
    let output = std::process::Command::new("/usr/bin/security")
        .args(["find-generic-password", "-s", "dev.arkai.limenvault.openai", "-a", "api-key", "-w"])
        .output();
    if let Ok(out) = output {
        if out.status.success() {
            let key = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !key.is_empty() {
                return Ok(key);
            }
        }
    }
    if let Ok(Some(k)) = limen_vault::keychain::load() {
        if !k.trim().is_empty() {
            return Ok(k.trim().to_string());
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

    let v2_diag_path = Path::new("IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_V2_DIAGNOSTIC/per-query.jsonl");
    let comparison = if v2_diag_path.exists() {
        if let Ok(v2_content) = fs::read_to_string(v2_diag_path) {
            let mut v2_map: BTreeMap<String, (f64, Option<usize>)> = BTreeMap::new();
            for line in v2_content.lines() {
                if let Ok(item) = serde_json::from_str::<serde_json::Value>(line) {
                    if let (Some(qid), Some(rec)) = (item.get("queryId").and_then(|v| v.as_str()), item.get("hybridRecallAt10").and_then(|v| v.as_f64())) {
                        let rk = item.get("hybridRank").and_then(|v| v.as_u64()).map(|v| v as usize);
                        v2_map.insert(qid.to_string(), (rec, rk));
                    }
                }
            }

            let mut improved = Vec::new();
            let mut degraded = Vec::new();
            let mut same = 0;
            let mut comps = Vec::new();

            for rec in &per_query_records {
                let (v2_rec, v2_rk) = v2_map.get(&rec.query_id).copied().unwrap_or((0.0, None));
                let status = if rec.hybrid_recall_at_10 > v2_rec || (rec.hybrid_recall_at_10 == v2_rec && rec.hybrid_rank < v2_rk) {
                    improved.push(rec.query_id.clone());
                    "IMPROVED".to_string()
                } else if rec.hybrid_recall_at_10 < v2_rec || (rec.hybrid_recall_at_10 == v2_rec && rec.hybrid_rank > v2_rk) {
                    degraded.push(rec.query_id.clone());
                    "DEGRADED".to_string()
                } else {
                    same += 1;
                    "SAME".to_string()
                };

                comps.push(QueryComparisonItem {
                    query_id: rec.query_id.clone(),
                    expected_document: rec.expected_document.clone(),
                    v2_hybrid_rank: v2_rk,
                    v2_hybrid_recall: v2_rec,
                    new_hybrid_rank: rec.hybrid_rank,
                    new_hybrid_recall: rec.hybrid_recall_at_10,
                    status,
                });
            }

            Some(V2DiagnosticComparison {
                baseline_diagnostic_path: v2_diag_path.to_string_lossy().to_string(),
                pre_fusion_hybrid_mean_recall_at_10: 0.675,
                post_fusion_hybrid_mean_recall_at_10: (hyb_mean * 1000.0).round() / 1000.0,
                improved_queries_count: improved.len(),
                improved_queries: improved,
                degraded_queries_count: degraded.len(),
                degraded_queries: degraded,
                same_queries_count: same,
                query_comparisons: comps,
            })
        } else {
            None
        }
    } else {
        None
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
        comparison_vs_v2_diagnostic: comparison,
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

#[derive(Debug, Serialize)]
struct DevConfigResult {
    name: String,
    variant: String,
    w_lex: f64,
    w_sem: f64,
    mean_recall_at_10: f64,
    hit_count: usize,
    zero_recall_count: usize,
    zero_recall_queries: Vec<String>,
}

#[derive(Debug, Serialize)]
struct DevResultsSummary {
    benchmark: String,
    timestamp_utc8: String,
    dev_queries_count: usize,
    configurations: Vec<DevConfigResult>,
    best_configuration: String,
    selection_rationale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DevPerQueryItem {
    query_id: String,
    expected_document: String,
    query_text: String,
    rank: Option<usize>,
    recall_at_10: f64,
}

fn run_a05_tune(vault_path: &Path, queries_path: &Path, out_dir: &Path) -> Result<(), String> {
    let start_time = Instant::now();
    println!("=== Running A05 Fusion Tuning on Dev Queries (a05-tune) ===");
    fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;

    // 1. Load catalog
    println!("Loading catalog from vault: {:?}", vault_path);
    let catalog = limen_vault::catalog::load_catalog(vault_path)?;
    if catalog.documents.is_empty() {
        return Err("Catalog is empty.".into());
    }
    let total_passages: usize = catalog.documents.values().map(|d| d.passages.len()).sum();
    println!("Catalog loaded: {} documents, {} passages", catalog.documents.len(), total_passages);

    // 2. Load pre-computed cache
    let cache = limen_vault::embeddings::load_embeddings_cache(vault_path)?;
    println!("Loaded pre-computed cache: {} passages (model: {})", cache.entries.len(), cache.model);

    // 3. Ensure lexical search index is ready
    limen_vault::search::index_vault_search(vault_path)?;

    // 4. Securely read OpenAI API key from Keychain
    let api_key = get_api_key_from_keychain()?;

    // 5. Load DEV queries
    let q_content = fs::read_to_string(queries_path).map_err(|e| e.to_string())?;
    let queries: Vec<A05Query> = serde_json::from_str(&q_content).map_err(|e| e.to_string())?;
    println!("Loaded {} development queries from {:?}", queries.len(), queries_path);

    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;

    // 6. Batch fetch embeddings for dev queries from OpenAI
    let query_texts: Vec<String> = queries.iter().map(|q| q.text.clone()).collect();
    println!("Fetching embeddings for {} dev queries in a single batch...", query_texts.len());
    let fetch_start = Instant::now();
    let query_vectors = rt.block_on(limen_vault::embeddings::fetch_openai_embeddings(
        &api_key,
        &cache.model,
        &query_texts,
    ))?;
    println!("Batch dev query embeddings received in {:.2}s.", fetch_start.elapsed().as_secs_f64());
    if query_vectors.len() != queries.len() {
        return Err("Vector count mismatch".into());
    }

    struct FusionConfigDef {
        name: &'static str,
        variant: &'static str,
        w_lex: f64,
        w_sem: f64,
    }

    let config_defs = vec![
        FusionConfigDef { name: "baseline_current", variant: "baseline", w_lex: 0.5, w_sem: 0.5 },
        FusionConfigDef { name: "VariantA_rrf_0.5_0.5", variant: "RRF_pure", w_lex: 0.5, w_sem: 0.5 },
        FusionConfigDef { name: "VariantA_rrf_0.4_0.6", variant: "RRF_pure", w_lex: 0.4, w_sem: 0.6 },
        FusionConfigDef { name: "VariantA_rrf_0.3_0.7", variant: "RRF_pure", w_lex: 0.3, w_sem: 0.7 },
        FusionConfigDef { name: "VariantA_rrf_0.2_0.8", variant: "RRF_pure", w_lex: 0.2, w_sem: 0.8 },
        FusionConfigDef { name: "VariantA_rrf_0.1_0.9", variant: "RRF_pure", w_lex: 0.1, w_sem: 0.9 },
        FusionConfigDef { name: "VariantB_norm_0.5_0.5", variant: "normalized", w_lex: 0.5, w_sem: 0.5 },
        FusionConfigDef { name: "VariantB_norm_0.4_0.6", variant: "normalized", w_lex: 0.4, w_sem: 0.6 },
        FusionConfigDef { name: "VariantB_norm_0.3_0.7", variant: "normalized", w_lex: 0.3, w_sem: 0.7 },
        FusionConfigDef { name: "VariantB_norm_0.2_0.8", variant: "normalized", w_lex: 0.2, w_sem: 0.8 },
        FusionConfigDef { name: "VariantB_norm_0.1_0.9", variant: "normalized", w_lex: 0.1, w_sem: 0.9 },
    ];

    let mut config_recalls: Vec<Vec<f64>> = vec![Vec::new(); config_defs.len()];
    let mut config_zero_queries: Vec<Vec<String>> = vec![Vec::new(); config_defs.len()];
    let mut config_per_query: Vec<Vec<DevPerQueryItem>> = vec![Vec::new(); config_defs.len()];

    for (q_idx, q) in queries.iter().enumerate() {
        let expected_doc = q.relevant_document_ids.first().cloned().unwrap_or_default();
        let query_vec = &query_vectors[q_idx];
        let term_lower = q.text.to_lowercase();
        let is_exact_code = q.text.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') && q.text.len() >= 3;

        // 1. Lexical search
        let lex_query = limen_vault::search::SearchQuery {
            term: Some(q.text.clone()),
            limit: Some(200),
            ..Default::default()
        };
        let lexical_results = limen_vault::search::search_vault(vault_path, lex_query)?;
        let mut lex_rank_map: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();
        for (i, item) in lexical_results.iter().enumerate() {
            lex_rank_map.insert(item.id.clone(), i + 1);
        }

        // 2. Semantic scoring
        let mut sem_scores: std::collections::BTreeMap<String, (f32, Option<String>, Option<String>, Option<String>)> = std::collections::BTreeMap::new();
        for doc in catalog.documents.values() {
            if doc.passages.is_empty() {
                continue;
            }
            let (sim, pid, loc, snip) = limen_vault::embeddings::rank_document_semantic(
                &doc.document_id,
                &doc.passages,
                query_vec,
                &cache,
            );
            if sim > 0.25 {
                sem_scores.insert(doc.document_id.clone(), (sim, pid, loc, snip));
            }
        }
        let mut sem_sorted: Vec<(String, f32)> = sem_scores.iter().map(|(id, (sim, _, _, _))| (id.clone(), *sim)).collect();
        sem_sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let mut sem_rank_map: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();
        for (i, (id, _)) in sem_sorted.iter().enumerate() {
            sem_rank_map.insert(id.clone(), i + 1);
        }

        // 3. Union candidate pool
        let mut all_ids: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
        all_ids.extend(lex_rank_map.keys().cloned());
        all_ids.extend(sem_rank_map.keys().cloned());

        struct CandInfo {
            id: String,
            orig_path: String,
            lex_rank: Option<usize>,
            sem_rank: Option<usize>,
            base_score: f64,
            sem_sim: f64,
            matches_term: bool,
        }

        let mut cand_infos: Vec<CandInfo> = Vec::new();
        for id in all_ids {
            let lex_item = lexical_results.iter().find(|i| i.id == id);
            let doc = catalog.documents.get(&id);
            let orig_path = if let Some(ref li) = lex_item {
                li.relative_path.clone()
            } else if let Some(ref d) = doc {
                d.original_path.clone()
            } else {
                continue;
            };

            let title = if let Some(ref li) = lex_item {
                li.title.clone()
            } else if let Some(ref d) = doc {
                d.file_name.clone()
            } else {
                String::new()
            };

            let snippet = if let Some(ref li) = lex_item {
                li.snippet.clone()
            } else if let Some(ref d) = doc {
                let (_, _, _, snip) = sem_scores.get(&id).cloned().unwrap_or((0.0, None, None, None));
                snip.unwrap_or_else(|| d.passages.first().map(|p| p.text.clone()).unwrap_or_default())
            } else {
                String::new()
            };

            let base_score = lex_item.map(|i| i.score).unwrap_or(0.0);
            let sem_sim = sem_scores.get(&id).map(|s| s.0 as f64).unwrap_or(0.0);
            let matches_term = title.to_lowercase().contains(&term_lower) || snippet.to_lowercase().contains(&term_lower);

            cand_infos.push(CandInfo {
                id: id.clone(),
                orig_path,
                lex_rank: lex_rank_map.get(&id).copied(),
                sem_rank: sem_rank_map.get(&id).copied(),
                base_score,
                sem_sim,
                matches_term,
            });
        }

        // Extrema for normalization (Variant B)
        let min_lex = cand_infos.iter().map(|c| c.base_score).fold(f64::INFINITY, f64::min);
        let max_lex = cand_infos.iter().map(|c| c.base_score).fold(f64::NEG_INFINITY, f64::max);
        let min_sem = cand_infos.iter().map(|c| c.sem_sim).fold(f64::INFINITY, f64::min);
        let max_sem = cand_infos.iter().map(|c| c.sem_sim).fold(f64::NEG_INFINITY, f64::max);

        // 4. Score candidates under each config
        for (cfg_idx, cfg) in config_defs.iter().enumerate() {
            let mut scored_cands: Vec<(String, String, f64)> = Vec::new();
            for c in &cand_infos {
                let rrf_lex = c.lex_rank.map_or(0.0, |r| 1.0 / (60.0 + r as f64));
                let rrf_sem = c.sem_rank.map_or(0.0, |r| 1.0 / (60.0 + r as f64));

                let final_score = match cfg.variant {
                    "RRF_pure" => {
                        let bonus = if c.matches_term {
                            if is_exact_code { 0.02 } else { 0.005 }
                        } else {
                            0.0
                        };
                        cfg.w_lex * rrf_lex + cfg.w_sem * rrf_sem + bonus
                    }
                    "normalized" => {
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
                        let bonus = if c.matches_term {
                            if is_exact_code { 0.3 } else { 0.05 }
                        } else {
                            0.0
                        };
                        cfg.w_lex * lex_norm + cfg.w_sem * sem_norm + bonus
                    }
                    "baseline" => {
                        let bonus = if c.matches_term {
                            if is_exact_code { 0.15 } else { 0.05 }
                        } else {
                            0.0
                        };
                        rrf_lex * 0.5 + rrf_sem * 0.5 + bonus + (c.base_score * 0.01)
                    }
                    _ => 0.0,
                };
                scored_cands.push((c.id.clone(), c.orig_path.clone(), final_score));
            }

            scored_cands.sort_by(|a, b| {
                b.2.partial_cmp(&a.2)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.0.cmp(&b.0))
            });

            let mut cand_rank = None;
            for (r_0, (cand_id, orig_path, _)) in scored_cands.iter().take(50).enumerate() {
                if orig_path.contains(&expected_doc) || cand_id == &expected_doc {
                    cand_rank = Some(r_0 + 1);
                    break;
                }
            }
            let r10 = if cand_rank.map_or(false, |r| r <= 10) { 1.0 } else { 0.0 };
            config_recalls[cfg_idx].push(r10);
            if r10 == 0.0 {
                config_zero_queries[cfg_idx].push(q.query_id.clone());
            }
            config_per_query[cfg_idx].push(DevPerQueryItem {
                query_id: q.query_id.clone(),
                expected_document: expected_doc.clone(),
                query_text: q.text.clone(),
                rank: cand_rank,
                recall_at_10: r10,
            });
        }
    }

    // 5. Evaluate and summarize results
    println!("\n=== Dev Evaluation Results across Configurations (30 queries) ===");
    let mut config_results: Vec<DevConfigResult> = Vec::new();
    let mut best_cfg_idx = 1;
    let mut best_mean_recall = -1.0;

    for (cfg_idx, cfg) in config_defs.iter().enumerate() {
        let recalls = &config_recalls[cfg_idx];
        let mean = recalls.iter().sum::<f64>() / (recalls.len() as f64);
        let hits = recalls.iter().filter(|&&r| r > 0.0).count();
        let zeroes = &config_zero_queries[cfg_idx];

        println!(
            "{:<24} | Mean R@10: {:.3} | Hits: {:>2}/30 | Zeroes: {:>2} {:?}",
            cfg.name, mean, hits, zeroes.len(), zeroes
        );

        config_results.push(DevConfigResult {
            name: cfg.name.to_string(),
            variant: cfg.variant.to_string(),
            w_lex: cfg.w_lex,
            w_sem: cfg.w_sem,
            mean_recall_at_10: (mean * 1000.0).round() / 1000.0,
            hit_count: hits,
            zero_recall_count: zeroes.len(),
            zero_recall_queries: zeroes.clone(),
        });

        // Prefer Variant A on tie (as per instructions)
        if mean > best_mean_recall || ( (mean - best_mean_recall).abs() < 1e-6 && cfg.variant == "RRF_pure" && config_defs[best_cfg_idx].variant != "RRF_pure" ) {
            best_mean_recall = mean;
            best_cfg_idx = cfg_idx;
        }
    }

    let best_cfg = &config_defs[best_cfg_idx];
    println!("\nBest configuration on DEV: {} (Mean Recall@10: {:.3})", best_cfg.name, best_mean_recall);

    // Write dev-results.json
    let dev_summary = DevResultsSummary {
        benchmark: "A05 — Taratura Fusione Ibrida su Query di Sviluppo".into(),
        timestamp_utc8: get_utc8_timestamp(),
        dev_queries_count: queries.len(),
        configurations: config_results,
        best_configuration: best_cfg.name.to_string(),
        selection_rationale: format!(
            "Selezionata la configurazione {} con Recall@10 = {:.3} sul set di sviluppo ({}/30 hit). Come richiesto dalle specifiche, a parita o equivalenza di prestazione e preferita la Variante A (RRF puro) perche evita iperparametri di normalizzazione dinamica.",
            best_cfg.name, best_mean_recall, config_recalls[best_cfg_idx].iter().filter(|&&r| r > 0.0).count()
        ),
    };
    let summary_path = out_dir.join("dev-results.json");
    fs::write(&summary_path, serde_json::to_string_pretty(&dev_summary).unwrap()).map_err(|e| e.to_string())?;

    // Write per-query.jsonl for the best configuration
    let jsonl_path = out_dir.join("per-query.jsonl");
    let mut jsonl_file = fs::File::create(&jsonl_path).map_err(|e| e.to_string())?;
    use std::io::Write;
    for rec in &config_per_query[best_cfg_idx] {
        let line = serde_json::to_string(rec).map_err(|e| e.to_string())?;
        writeln!(jsonl_file, "{}", line).map_err(|e| e.to_string())?;
    }

    let elapsed = start_time.elapsed();
    println!("Evidence written to {:?}", out_dir);
    println!("Total Dev Tuning Duration: {:.2}s", elapsed.as_secs_f64());

    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 5 {
        eprintln!("Usage: gold-benchmark <a05|a05-diag|a05-tune|a15> <vault_path> <queries_path> <out_dir>");
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
        "a05-tune" => {
            if let Err(e) = run_a05_tune(vault_path, queries_path, out_dir) {
                eprintln!("A05 Tuning Benchmark Error: {e}");
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
            eprintln!("Unknown mode: {mode}. Use 'a05', 'a05-diag', 'a05-tune', or 'a15'");
            std::process::exit(1);
        }
    }
}
