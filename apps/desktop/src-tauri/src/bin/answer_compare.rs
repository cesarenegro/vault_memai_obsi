use limen_vault::ai::{self, Options};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::time::Instant;

struct ModelResult {
    name: String,
    answer: String,
    citations: Vec<String>,
    time_ms: u128,
    tokens: Option<u64>,
    error: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let vault_path = Path::new(r"E:\VAULT WIN TEST DEV");
    if !vault_path.exists() {
        eprintln!("Vault path {:?} does not exist!", vault_path);
        std::process::exit(1);
    }

    let openai_key = std::env::var("OPENAI_API_KEY").unwrap_or_else(|_| {
        let key_path = Path::new(r"C:\Users\user\.config\openai_key.txt");
        if key_path.exists() {
            fs::read_to_string(key_path).unwrap_or_default().trim().to_string()
        } else {
            String::new()
        }
    });

    let ministral_port: u16 = std::env::var("MINISTRAL_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8088);

    let gemma_port: u16 = std::env::var("GEMMA_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8089);

    println!("===============================================================");
    println!("LIMEN Vault — Multi-Model Answer Comparison Benchmark");
    println!("Vault: {:?}", vault_path);
    println!("Ministral Port: {}", ministral_port);
    println!("Gemma Port: {}", gemma_port);
    println!("OpenAI Key present: {}", !openai_key.is_empty());
    println!("===============================================================\n");

    let questions = vec![
        "Cosa è il progetto BNXT?",
        "Cos'è il progetto SCENA e quali app comprende?",
        "Cosa riguarda il progetto Packaging in Italy?",
        "Cos'è MARKAI?",
        "Quali problemi sono emersi negli audit di LIMEN Vault?",
    ];

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(180))
        .build()?;

    let mut report_md = String::new();
    report_md.push_str("# LIMEN Vault — Confronto Risposte: OpenAI vs Modelli Locali\n\n");
    report_md.push_str(&format!("- **Data/Ora**: {}\n", chrono::Local::now().format("%Y-%m-%d %H:%M:%S")));
    report_md.push_str(&format!("- **Vault**: `{}`\n", vault_path.display()));
    report_md.push_str("- **Modelli confrontati**:\n");
    report_md.push_str("  1. OpenAI `gpt-6-sol` (API remota)\n");
    report_md.push_str(&format!("  2. `Ministral 3 8B Instruct` (Porta {})\n", ministral_port));
    report_md.push_str(&format!("  3. `Gemma 4 12B Instruct` (Porta {})\n", gemma_port));
    report_md.push_str("  4. `Qwen3.5 9B Instruct`: *Non eseguito* (llama-server v1 ec2b787 non supporta l'architettura Gated DeltaNet `qwen35`)\n\n");
    report_md.push_str("---\n\n");

    for (idx, q) in questions.iter().enumerate() {
        let q_num = idx + 1;
        println!("[{}/5] Processing question: \"{}\"", q_num, q);

        let options = Options {
            prompt: q.to_string(),
            model: "gpt-6-sol".to_string(),
            include_drafts: false,
            source_ids: vec![],
            category: None,
            client: None,
            project: None,
            tags: None,
        };

        // 1. Select passages ONCE using hybrid search & eligibility filter
        let select_start = Instant::now();
        let sources = ai::select(vault_path, &options).await?;
        let select_elapsed = select_start.elapsed();

        println!("  Selected {} sources in {:.2?}", sources.len(), select_elapsed);

        report_md.push_str(&format!("## Domanda {}: \"{}\"\n\n", q_num, q));

        // Passages details
        report_md.push_str("### Passaggi inviati ai modelli (Sezione Fonti)\n\n");
        for (s_idx, s) in sources.iter().enumerate() {
            let id_tag = format!("S{}", s_idx + 1);
            let loc_str = s.locator.as_deref().unwrap_or("N/A");
            report_md.push_str(&format!(
                "#### **[{}]** {} (`{}`)\n",
                id_tag, s.title, s.relative_path
            ));
            report_md.push_str(&format!(
                "- **ID Documento**: `{}` | **Passage ID**: `{}` | **Locator**: `{}` | **Categoria**: `{}` | **Stato**: `{}`\n\n",
                s.document_id,
                s.passage_id.as_deref().unwrap_or("N/A"),
                loc_str,
                s.category,
                s.status.as_deref().unwrap_or("N/A")
            ));
            report_md.push_str("```text\n");
            report_md.push_str(&s.content);
            report_md.push_str("\n```\n\n");
        }

        let mut results = Vec::new();

        // A. OpenAI (gpt-6-sol)
        if !openai_key.is_empty() {
            println!("  [1/3] Querying OpenAI (gpt-6-sol)...");
            let req_body = ai::request_body(&options, &sources);
            let start = Instant::now();
            let res = client
                .post("https://api.openai.com/v1/responses")
                .bearer_auth(&openai_key)
                .json(&req_body)
                .send()
                .await;
            let time_ms = start.elapsed().as_millis();

            match res {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let json_val: Value = resp.json().await.unwrap_or(Value::Null);
                        match ai::parse_response(json_val.clone(), &sources) {
                            Ok(parsed) => {
                                let ans = parsed["answer"].as_str().unwrap_or("").to_string();
                                let mut cites = Vec::new();
                                if let Some(c_arr) = parsed["citations"].as_array() {
                                    for c in c_arr {
                                        cites.push(c["citationString"].as_str().unwrap_or("").to_string());
                                    }
                                }
                                results.push(ModelResult {
                                    name: "OpenAI gpt-6-sol".into(),
                                    answer: ans,
                                    citations: cites,
                                    time_ms,
                                    tokens: parsed["tokensUsed"].as_u64(),
                                    error: None,
                                });
                            }
                            Err(e) => results.push(ModelResult {
                                name: "OpenAI gpt-6-sol".into(),
                                answer: String::new(),
                                citations: vec![],
                                time_ms,
                                tokens: None,
                                error: Some(format!("Parse error: {}", e)),
                            }),
                        }
                    } else {
                        results.push(ModelResult {
                            name: "OpenAI gpt-6-sol".into(),
                            answer: String::new(),
                            citations: vec![],
                            time_ms,
                            tokens: None,
                            error: Some(format!("HTTP {}", resp.status())),
                        });
                    }
                }
                Err(e) => results.push(ModelResult {
                    name: "OpenAI gpt-6-sol".into(),
                    answer: String::new(),
                    citations: vec![],
                    time_ms,
                    tokens: None,
                    error: Some(format!("Network error: {}", e)),
                }),
            }
        } else {
            results.push(ModelResult {
                name: "OpenAI gpt-6-sol".into(),
                answer: String::new(),
                citations: vec![],
                time_ms: 0,
                tokens: None,
                error: Some("OPENAI_API_KEY non fornita".into()),
            });
        }

        // B. Local Models (Ministral & Gemma)
        let local_configs = vec![
            ("Ministral 3 8B Instruct", ministral_port),
            ("Gemma 4 12B Instruct", gemma_port),
        ];

        let formatted_sources: Vec<Value> = sources
            .iter()
            .enumerate()
            .map(|(idx, s)| {
                json!({
                    "source_id": format!("S{}", idx + 1),
                    "title": s.title,
                    "relative_path": s.relative_path,
                    "locator": s.locator,
                    "category": s.category,
                    "content": s.content,
                })
            })
            .collect();

        let system_instruction = "Sei un assistente AI avanzato integrato in LIMEN Vault.\nRispondi sempre nella stessa lingua della domanda dell'utente (di default in italiano), con prosa scorrevole, completa, ragionata e con lessico curato.\nBasa la tua risposta ESCLUSIVAMENTE sui documenti forniti.\nNon inventare informazioni non presenti nelle fonti.\nSe le fonti fornite non contengono informazioni sufficienti per rispondere alla domanda, dichiaralo in modo esplicito, semplice e diretto.\nNON inserire mai nel testo della risposta identificativi tecnici, hash, SHA256 o nomi di file (es. doc_..., S1, S2, .md).\nRestituisci un oggetto JSON valido con la struttura: {\"answer\": \"...\", \"citation_ids\": [\"S1\", \"S2\"]}.\nIndica le citazioni delle fonti utilizzate compilando l'array 'citation_ids' con gli identificativi forniti (es. S1, S2).";

        for (m_name, port) in local_configs {
            println!("  Querying {} (port {})...", m_name, port);
            let local_url = format!("http://127.0.0.1:{}/v1/chat/completions", port);

            let local_prompt_json = json!({
                "model": m_name,
                "messages": [
                    {
                        "role": "system",
                        "content": system_instruction
                    },
                    {
                        "role": "user",
                        "content": json!({
                            "question": q,
                            "untrusted_documents": formatted_sources
                        }).to_string()
                    }
                ],
                "temperature": 0.2,
                "max_tokens": 1500
            });

            let start = Instant::now();
            let res = client.post(&local_url).json(&local_prompt_json).send().await;
            let time_ms = start.elapsed().as_millis();

            match res {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let json_val: Value = resp.json().await.unwrap_or(Value::Null);
                        let mut ans = String::new();
                        let mut cites = Vec::new();
                        let mut tok = None;

                        if let Some(choices) = json_val["choices"].as_array() {
                            if let Some(first) = choices.get(0) {
                                let text = first["message"]["content"].as_str().unwrap_or("").trim();
                                if let Ok(parsed_json) = serde_json::from_str::<Value>(text) {
                                    ans = parsed_json["answer"].as_str().unwrap_or(text).to_string();
                                    if let Some(c_arr) = parsed_json["citation_ids"].as_array() {
                                        for id_val in c_arr {
                                            if let Some(id_str) = id_val.as_str() {
                                                cites.push(id_str.to_string());
                                            }
                                        }
                                    }
                                } else {
                                    ans = text.to_string();
                                }
                            }
                        }
                        if let Some(total_tok) = json_val["usage"]["total_tokens"].as_u64() {
                            tok = Some(total_tok);
                        }

                        results.push(ModelResult {
                            name: m_name.into(),
                            answer: ans,
                            citations: cites,
                            time_ms,
                            tokens: tok,
                            error: None,
                        });
                    } else {
                        results.push(ModelResult {
                            name: m_name.into(),
                            answer: String::new(),
                            citations: vec![],
                            time_ms,
                            tokens: None,
                            error: Some(format!("HTTP {}", resp.status())),
                        });
                    }
                }
                Err(e) => results.push(ModelResult {
                    name: m_name.into(),
                    answer: String::new(),
                    citations: vec![],
                    time_ms,
                    tokens: None,
                    error: Some(format!("Server error: {}", e)),
                }),
            }
        }

        // Summary table & side-by-side comparison
        report_md.push_str("### Confronto Risposte per Modello\n\n");
        report_md.push_str("| Modello | Tempo (s) | Token Totali | Citazioni |\n");
        report_md.push_str("| :--- | :--- | :--- | :--- |\n");
        for r in &results {
            let time_s = format!("{:.2} s", r.time_ms as f64 / 1000.0);
            let tok_str = r.tokens.map_or("N/A".into(), |t| t.to_string());
            let cite_str = if r.citations.is_empty() { "Nessuna".into() } else { r.citations.join(", ") };
            report_md.push_str(&format!("| **{}** | `{}` | `{}` | {} |\n", r.name, time_s, tok_str, cite_str));
        }
        report_md.push_str("\n");

        for r in &results {
            report_md.push_str(&format!("#### Risposta: {}\n\n", r.name));
            if let Some(ref err) = r.error {
                report_md.push_str(&format!("*Errore:* `{}`\n\n", err));
            } else {
                report_md.push_str(&r.answer);
                report_md.push_str("\n\n");
            }
        }

        report_md.push_str("---\n\n");
    }

    let output_path = Path::new(r"E:\Projects\vault_memai_obsi\IMPLEMENTATION\WINDOWS_BUILD_EVIDENCE\answer-compare.md");
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, report_md)?;
    println!("\nSaved multi-model comparison report to {:?}", output_path);
    Ok(())
}
