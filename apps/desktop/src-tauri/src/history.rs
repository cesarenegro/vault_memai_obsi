use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

pub fn record_ai_completion(
    vault_path: &Path,
    prompt: &str,
    requested_model: &str,
    response_model: &str,
    answer: &str,
    status_str: &str,
    duration_ms: u64,
    sources: &[crate::ai::Source],
) {
    let history_sources: Vec<HistorySourceRef> = sources
        .iter()
        .enumerate()
        .map(|(idx, s)| {
            let passages = s
                .passage_hashes
                .iter()
                .map(|(pid, p_sha)| HistoryPassageRef {
                    passage_id: pid.clone(),
                    passage_sha256: p_sha.clone(),
                })
                .collect();
            HistorySourceRef {
                document_id: s.document_id.clone(),
                relative_path: s.relative_path.clone(),
                title: s.title.clone(),
                locator: s.locator.clone(),
                doc_sha256: s.sha256.clone(),
                passages,
                citation_index: idx + 1,
            }
        })
        .collect();

    let now_local = chrono::Local::now();
    let utc_offset = now_local.offset().local_minus_utc();
    let now_utc = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let entry_id = format!(
        "qa_{}_{}",
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        &crate::snapshots::compute_sha256(
            format!("{}_{}", prompt, chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)).as_bytes()
        )[..8]
    );
    let conv_id = format!(
        "conv_{}",
        &crate::snapshots::compute_sha256(prompt.as_bytes())[..12]
    );
    let entry_status = if status_str == "incomplete" {
        "incomplete"
    } else {
        "complete"
    };

    let entry = HistoryEntry {
        id: entry_id,
        conversation_id: conv_id,
        turn_index: 1,
        parent_entry_id: None,
        created_at_utc: now_utc,
        utc_offset_seconds: utc_offset,
        requested_model: requested_model.to_string(),
        response_model: response_model.to_string(),
        prompt: prompt.to_string(),
        answer: answer.to_string(),
        status: entry_status.to_string(),
        duration_ms,
        sources: history_sources,
        pid: Some(std::process::id()),
    };
    let _ = save_history_entry(vault_path, entry);
}

#[cfg(test)]
thread_local! {
    static TEST_HISTORY_DIR: std::cell::RefCell<Option<PathBuf>> = std::cell::RefCell::new(None);
}

#[cfg(test)]
pub fn set_test_history_dir(dir: PathBuf) {
    TEST_HISTORY_DIR.with(|cell| {
        *cell.borrow_mut() = Some(dir);
    });
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPassageRef {
    pub passage_id: String,
    pub passage_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySourceRef {
    pub document_id: String,
    pub relative_path: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locator: Option<String>,
    pub doc_sha256: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub passages: Vec<HistoryPassageRef>,
    pub citation_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub conversation_id: String,
    pub turn_index: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_entry_id: Option<String>,
    pub created_at_utc: String,
    pub utc_offset_seconds: i32,
    pub requested_model: String,
    pub response_model: String,
    pub prompt: String,
    pub answer: String,
    pub status: String, // "complete" | "incomplete"
    pub duration_ms: u64,
    pub sources: Vec<HistorySourceRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntryHeader {
    pub id: String,
    pub conversation_id: String,
    pub turn_index: usize,
    pub created_at_utc: String,
    pub utc_offset_seconds: i32,
    pub requested_model: String,
    pub response_model: String,
    pub prompt: String,
    pub answer_preview: String,
    pub status: String,
    pub duration_ms: u64,
    pub sources_count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SourceVerificationStatus {
    Fresh,
    Modified,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedSourceResult {
    pub document_id: String,
    pub relative_path: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locator: Option<String>,
    pub citation_index: usize,
    pub status: SourceVerificationStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultIdInfo {
    pub vault_id: String,
    pub duplicate_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VaultIdFile {
    schema_version: u32,
    vault_id: String,
    created_at_utc: String,
}

pub fn get_history_base_dir() -> Result<PathBuf, String> {
    #[cfg(test)]
    {
        if let Some(p) = TEST_HISTORY_DIR.with(|cell| cell.borrow().clone()) {
            let _ = fs::create_dir_all(&p);
            return Ok(p);
        }
        if let Ok(override_dir) = std::env::var("LIMEN_HISTORY_DIR") {
            if !override_dir.trim().is_empty() {
                let p = PathBuf::from(override_dir);
                let _ = fs::create_dir_all(&p);
                return Ok(p);
            }
        }
        let dir = std::env::temp_dir().join("limen_test_history_isolated_default");
        let _ = fs::create_dir_all(&dir);
        return Ok(dir);
    }
    #[allow(unreachable_code)]
    {
        let base = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".into());
        let dir = PathBuf::from(base).join(".limen-vault").join("history");
        if !dir.exists() {
            let _ = fs::create_dir_all(&dir);
        }
        Ok(dir)
    }
}

fn normalize_path(p: &Path) -> String {
    let s = p.canonicalize().unwrap_or_else(|_| p.to_path_buf()).to_string_lossy().to_string();
    let stripped = s.strip_prefix(r"\?").unwrap_or(&s);
    stripped.replace('\\', "/").to_lowercase()
}

fn read_existing_vault_id(file_path: &Path) -> Result<String, String> {
    let bytes = fs::read(file_path)
        .map_err(|e| format!("Impossibile leggere VAULT_ID.json: {e}"))?;
    if bytes.is_empty() {
        return Err("File VAULT_ID.json corrotto (file vuoto): nessuna sovrascrittura automatica.".into());
    }
    let parsed: VaultIdFile = serde_json::from_slice(&bytes)
        .map_err(|e| format!("File VAULT_ID.json corrotto ({e}): nessuna sovrascrittura automatica."))?;
    if parsed.schema_version != 1 || parsed.vault_id.trim().is_empty() {
        return Err("File VAULT_ID.json non valido: schema non supportato o vault_id assente.".into());
    }
    Ok(parsed.vault_id)
}

pub fn get_or_create_vault_id(vault_path: &Path) -> Result<VaultIdInfo, String> {
    let sys_dir = vault_path.join("00_SYSTEM");
    let file_path = sys_dir.join("VAULT_ID.json");

    let vault_id = if file_path.exists() {
        read_existing_vault_id(&file_path)?
    } else {
        fs::create_dir_all(&sys_dir).map_err(|e| format!("Impossibile creare 00_SYSTEM: {e}"))?;
        let mut random_bytes = [0u8; 16];
        getrandom::fill(&mut random_bytes)
            .map_err(|e| format!("Errore generazione ID casuale: {e}"))?;
        let id_hex = random_bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>();
        let vault_id = format!("vlt_{}", id_hex);
        let now_utc = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let file_data = VaultIdFile {
            schema_version: 1,
            vault_id: vault_id.clone(),
            created_at_utc: now_utc,
        };
        let json_bytes = serde_json::to_vec_pretty(&file_data)
            .map_err(|e| format!("Serializzazione VAULT_ID.json fallita: {e}"))?;

        let tmp_path = sys_dir.join(format!(".vault-id-{}.tmp", std::process::id()));
        fs::write(&tmp_path, json_bytes)
            .map_err(|e| format!("Scrittura temporanea VAULT_ID fallita: {e}"))?;

        if file_path.exists() {
            let _ = fs::remove_file(&tmp_path);
            read_existing_vault_id(&file_path)?
        } else {
            match fs::rename(&tmp_path, &file_path) {
                Ok(_) => vault_id,
                Err(_) if file_path.exists() => {
                    let _ = fs::remove_file(&tmp_path);
                    read_existing_vault_id(&file_path)?
                }
                Err(e) => {
                    let _ = fs::remove_file(&tmp_path);
                    return Err(format!("Salvataggio atomico VAULT_ID.json fallito: {e}"));
                }
            }
        }
    };

    let duplicate_warning = check_and_register_vault_path(vault_path, &vault_id);

    Ok(VaultIdInfo {
        vault_id,
        duplicate_warning,
    })
}

fn check_and_register_vault_path(vault_path: &Path, vault_id: &str) -> Option<String> {
    let base_dir = get_history_base_dir().ok()?;
    let registry_file = base_dir.join("vault_registry.json");
    let current_norm = normalize_path(vault_path);

    let mut map: BTreeMap<String, String> = if registry_file.exists() {
        fs::read(&registry_file)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    } else {
        BTreeMap::new()
    };

    let mut warning = None;
    if let Some(existing_path) = map.get(vault_id) {
        if existing_path != &current_norm {
            warning = Some(format!(
                "Avviso: identificativo vault duplicato. Stesso identificativo '{}' già associato al percorso '{}'",
                vault_id, existing_path
            ));
        }
    } else {
        map.insert(vault_id.to_string(), current_norm);
        if let Ok(data) = serde_json::to_vec_pretty(&map) {
            let tmp = base_dir.join(format!(".vault_registry-{}.tmp", std::process::id()));
            if fs::write(&tmp, data).is_ok() {
                let _ = fs::rename(&tmp, &registry_file);
            }
        }
    }
    warning
}

pub fn save_history_entry(vault_path: &Path, entry: HistoryEntry) -> Result<(), String> {
    let info = get_or_create_vault_id(vault_path)?;
    let vault_id = info.vault_id;

    let base_dir = get_history_base_dir()?;
    let entries_dir = base_dir.join(&vault_id).join("entries");
    fs::create_dir_all(&entries_dir)
        .map_err(|e| format!("Impossibile creare cartella entries: {e}"))?;

    let target_file = entries_dir.join(format!("{}.json", entry.id));
    let tmp_file = entries_dir.join(format!("{}-{}.tmp", entry.id, std::process::id()));

    let json_bytes = serde_json::to_vec_pretty(&entry)
        .map_err(|e| format!("Serializzazione entry fallita: {e}"))?;

    let res = (|| {
        let mut f = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp_file)
            .map_err(|e| format!("Creazione file tmp fallita: {e}"))?;
        f.write_all(&json_bytes)
            .map_err(|e| format!("Scrittura file tmp fallita: {e}"))?;
        f.sync_all()
            .map_err(|e| format!("Sync file tmp fallito: {e}"))?;
        drop(f);
        fs::rename(&tmp_file, &target_file)
            .map_err(|e| format!("Rinomina atomica in {target_file:?} fallita: {e}"))?;
        Ok::<(), String>(())
    })();

    if res.is_err() {
        let _ = fs::remove_file(&tmp_file);
    }
    res
}

pub fn list_history_entries(vault_path: &Path) -> Result<Vec<HistoryEntryHeader>, String> {
    let info = get_or_create_vault_id(vault_path)?;
    let base_dir = get_history_base_dir()?;
    let entries_dir = base_dir.join(&info.vault_id).join("entries");
    if !entries_dir.exists() {
        return Ok(Vec::new());
    }

    let read_dir = fs::read_dir(&entries_dir)
        .map_err(|e| format!("Lettura cartella entries fallita: {e}"))?;

    let mut headers = Vec::new();
    for entry_res in read_dir {
        let dir_entry = match entry_res {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = dir_entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let bytes = match fs::read(&path) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let entry: HistoryEntry = match serde_json::from_slice(&bytes) {
            Ok(item) => item,
            Err(_) => continue,
        };

        let answer_preview = if entry.answer.chars().count() > 140 {
            let preview: String = entry.answer.chars().take(140).collect();
            format!("{}...", preview)
        } else {
            entry.answer.clone()
        };

        headers.push(HistoryEntryHeader {
            id: entry.id,
            conversation_id: entry.conversation_id,
            turn_index: entry.turn_index,
            created_at_utc: entry.created_at_utc,
            utc_offset_seconds: entry.utc_offset_seconds,
            requested_model: entry.requested_model,
            response_model: entry.response_model,
            prompt: entry.prompt,
            answer_preview,
            status: entry.status,
            duration_ms: entry.duration_ms,
            sources_count: entry.sources.len(),
            pid: entry.pid,
        });
    }

    headers.sort_by(|a, b| b.created_at_utc.cmp(&a.created_at_utc));
    Ok(headers)
}

pub fn get_history_entry(vault_path: &Path, entry_id: &str) -> Result<HistoryEntry, String> {
    validate_entry_id(entry_id)?;
    let info = get_or_create_vault_id(vault_path)?;
    let base_dir = get_history_base_dir()?;
    let file = base_dir.join(&info.vault_id).join("entries").join(format!("{}.json", entry_id));
    if !file.exists() {
        return Err(format!("Voce storico non trovata: {entry_id}"));
    }
    let bytes = fs::read(&file).map_err(|e| format!("Lettura file fallita: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Parsing voce storico fallito: {e}"))
}

pub fn delete_history_entry(vault_path: &Path, entry_id: &str) -> Result<(), String> {
    validate_entry_id(entry_id)?;
    let info = get_or_create_vault_id(vault_path)?;
    let base_dir = get_history_base_dir()?;
    let file = base_dir.join(&info.vault_id).join("entries").join(format!("{}.json", entry_id));
    if file.exists() {
        fs::remove_file(&file).map_err(|e| format!("Cancellazione voce fallita: {e}"))?;
    }
    Ok(())
}

pub fn clear_vault_history(vault_path: &Path) -> Result<usize, String> {
    let info = get_or_create_vault_id(vault_path)?;
    let base_dir = get_history_base_dir()?;
    let entries_dir = base_dir.join(&info.vault_id).join("entries");
    if !entries_dir.exists() {
        return Ok(0);
    }
    let mut count = 0;
    for entry in fs::read_dir(&entries_dir).map_err(|e| format!("Lettura entries fallita: {e}"))? {
        if let Ok(entry) = entry {
            let p = entry.path();
            if p.extension().and_then(|s| s.to_str()) == Some("json") {
                if fs::remove_file(&p).is_ok() {
                    count += 1;
                }
            }
        }
    }
    Ok(count)
}

fn validate_entry_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 128
        || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Identificativo voce storico non valido".into());
    }
    Ok(())
}

pub fn verify_history_sources(
    vault_path: &Path,
    sources: &[HistorySourceRef],
) -> Result<Vec<VerifiedSourceResult>, String> {
    let mut results = Vec::new();

    for s in sources {
        let full_path = vault_path.join(&s.relative_path);
        if !full_path.exists() {
            results.push(VerifiedSourceResult {
                document_id: s.document_id.clone(),
                relative_path: s.relative_path.clone(),
                title: s.title.clone(),
                locator: s.locator.clone(),
                citation_index: s.citation_index,
                status: SourceVerificationStatus::Missing,
                text: None,
                warning: Some(format!(
                    "La nota '{}' non è più presente nel Vault.",
                    s.relative_path
                )),
            });
            continue;
        }

        let file_bytes = match fs::read(&full_path) {
            Ok(b) => b,
            Err(e) => {
                results.push(VerifiedSourceResult {
                    document_id: s.document_id.clone(),
                    relative_path: s.relative_path.clone(),
                    title: s.title.clone(),
                    locator: s.locator.clone(),
                    citation_index: s.citation_index,
                    status: SourceVerificationStatus::Missing,
                    text: None,
                    warning: Some(format!("Impossibile leggere la nota: {e}")),
                });
                continue;
            }
        };

        let current_doc_sha = crate::snapshots::compute_sha256(&file_bytes);
        if current_doc_sha != s.doc_sha256 {
            results.push(VerifiedSourceResult {
                document_id: s.document_id.clone(),
                relative_path: s.relative_path.clone(),
                title: s.title.clone(),
                locator: s.locator.clone(),
                citation_index: s.citation_index,
                status: SourceVerificationStatus::Modified,
                text: None,
                warning: Some(format!(
                    "La nota '{}' è stata modificata dopo la generazione di questa risposta. Il contenuto attuale del Vault potrebbe differire da quello su cui il modello si è basato.",
                    s.relative_path
                )),
            });
            continue;
        }

        let mut passage_texts = Vec::new();
        let mut passage_modified = false;

        for p_ref in &s.passages {
            match crate::catalog::read_passage(vault_path, &s.document_id, &p_ref.passage_id) {
                Ok(doc_p) => {
                    let actual_p_sha = crate::snapshots::compute_sha256(doc_p.text.as_bytes());
                    if actual_p_sha != p_ref.passage_sha256 {
                        passage_modified = true;
                        break;
                    }
                    passage_texts.push(doc_p.text);
                }
                Err(_) => {}
            }
        }

        if passage_modified {
            results.push(VerifiedSourceResult {
                document_id: s.document_id.clone(),
                relative_path: s.relative_path.clone(),
                title: s.title.clone(),
                locator: s.locator.clone(),
                citation_index: s.citation_index,
                status: SourceVerificationStatus::Modified,
                text: None,
                warning: Some(format!(
                    "Uno o più passaggi citati nella nota '{}' risultano modificati.",
                    s.relative_path
                )),
            });
            continue;
        }

        let displayed_text = if !passage_texts.is_empty() {
            passage_texts.join("

---

")
        } else {
            String::from_utf8_lossy(&file_bytes).to_string()
        };

        results.push(VerifiedSourceResult {
            document_id: s.document_id.clone(),
            relative_path: s.relative_path.clone(),
            title: s.title.clone(),
            locator: s.locator.clone(),
            citation_index: s.citation_index,
            status: SourceVerificationStatus::Fresh,
            text: Some(displayed_text),
            warning: None,
        });
    }

    Ok(results)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn history_subproc_worker() {
        let history_dir = match std::env::var("LIMEN_HISTORY_DIR") {
            Ok(d) if !d.is_empty() => d,
            _ => return,
        };
        let prefix = std::env::var("LIMEN_WORKER_PREFIX").unwrap_or_else(|_| "w".into());
        let vault_path = PathBuf::from(&history_dir).join("test_vault");
        let pid = std::process::id();

        for i in 0..50 {
            let entry = HistoryEntry {
                id: format!("qa_{}_{:03}", prefix, i),
                conversation_id: format!("conv_{}", prefix),
                turn_index: i + 1,
                parent_entry_id: None,
                created_at_utc: format!("2026-09-24T00:{:02}:{:02}.000Z", i / 60, i % 60),
                utc_offset_seconds: 28800,
                requested_model: "gpt-4o".into(),
                response_model: "gpt-4o-2024-08-06".into(),
                prompt: format!("Prompt {} from {}", i, prefix),
                answer: format!("Answer {} from {}", i, prefix),
                status: "complete".into(),
                duration_ms: 1000 + i as u64,
                sources: vec![],
                pid: Some(pid),
            };
            save_history_entry(&vault_path, entry).unwrap();
        }
    }

    #[test]
    fn test_multi_process_concurrent_writes() {
        let temp = tempdir().unwrap();
        let history_dir = temp.path().to_string_lossy().to_string();
        let vault_path = temp.path().join("test_vault");
        fs::create_dir_all(&vault_path.join("00_SYSTEM")).unwrap();
        let _ = get_or_create_vault_id(&vault_path).unwrap();

        let current_exe = std::env::current_exe().unwrap();

        let mut child1 = std::process::Command::new(&current_exe)
            .arg("--exact")
            .arg("history::tests::history_subproc_worker")
            .arg("--nocapture")
            .env("LIMEN_HISTORY_DIR", &history_dir)
            .env("LIMEN_WORKER_PREFIX", "proc1")
            .spawn()
            .expect("Failed to spawn worker 1");

        let mut child2 = std::process::Command::new(&current_exe)
            .arg("--exact")
            .arg("history::tests::history_subproc_worker")
            .arg("--nocapture")
            .env("LIMEN_HISTORY_DIR", &history_dir)
            .env("LIMEN_WORKER_PREFIX", "proc2")
            .spawn()
            .expect("Failed to spawn worker 2");

        let st1 = child1.wait().expect("Worker 1 wait failed");
        let st2 = child2.wait().expect("Worker 2 wait failed");
        assert!(st1.success(), "Worker 1 failed");
        assert!(st2.success(), "Worker 2 failed");

        set_test_history_dir(temp.path().to_path_buf());
        let list = list_history_entries(&vault_path).unwrap();
        assert_eq!(list.len(), 100, "Expected exactly 100 entries, got {}", list.len());

        let info = get_or_create_vault_id(&vault_path).unwrap();
        let entries_dir = temp.path().join(&info.vault_id).join("entries");
        for file in fs::read_dir(&entries_dir).unwrap() {
            let p = file.unwrap().path();
            assert!(!p.to_string_lossy().ends_with(".tmp"), "Found leftover tmp file: {:?}", p);
        }

        let pids: std::collections::HashSet<u32> = list.iter().filter_map(|e| e.pid).collect();
        assert!(pids.len() >= 2, "Expected at least 2 distinct PIDs, got {:?}", pids);
    }

    #[test]
    fn test_save_conditions_matrix() {
        let temp = tempdir().unwrap();
        set_test_history_dir(temp.path().to_path_buf());
        let vault_path = temp.path().join("vault");
        fs::create_dir_all(&vault_path.join("00_SYSTEM")).unwrap();

        // 1. Complete -> saved
        let entry_complete = HistoryEntry {
            id: "qa_complete_1".into(),
            conversation_id: "conv_1".into(),
            turn_index: 1,
            parent_entry_id: None,
            created_at_utc: "2026-09-24T00:00:00.000Z".into(),
            utc_offset_seconds: 28800,
            requested_model: "gpt-4o".into(),
            response_model: "gpt-4o-2024-08-06".into(),
            prompt: "Test complete".into(),
            answer: "Answer complete".into(),
            status: "complete".into(),
            duration_ms: 1200,
            sources: vec![],
            pid: Some(std::process::id()),
        };
        save_history_entry(&vault_path, entry_complete).unwrap();
        let fetched_comp = get_history_entry(&vault_path, "qa_complete_1").unwrap();
        assert_eq!(fetched_comp.status, "complete");

        // 2. Incomplete -> saved with status "incomplete"
        let entry_incomplete = HistoryEntry {
            id: "qa_incomplete_1".into(),
            conversation_id: "conv_1".into(),
            turn_index: 2,
            parent_entry_id: Some("qa_complete_1".into()),
            created_at_utc: "2026-09-24T00:01:00.000Z".into(),
            utc_offset_seconds: 28800,
            requested_model: "gpt-4o".into(),
            response_model: "gpt-4o-2024-08-06".into(),
            prompt: "Test incomplete".into(),
            answer: "Answer truncated".into(),
            status: "incomplete".into(),
            duration_ms: 1500,
            sources: vec![],
            pid: Some(std::process::id()),
        };
        save_history_entry(&vault_path, entry_incomplete).unwrap();
        let fetched_incomp = get_history_entry(&vault_path, "qa_incomplete_1").unwrap();
        assert_eq!(fetched_incomp.status, "incomplete");

        // 3. Condizioni di esclusione (verify_post fallito, errore OpenAI, rifiuto begin, annullamento):
        // In ask (ai.rs:1990) e ask_stream (ai.rs:2558), record_ai_completion è invocata tassativamente
        // dopo verify_post (linea 2081 / 3221) e dopo la validazione delle citazioni.
        // Qualsiasi errore precedente (verify_post fallito per documento mutato, errore HTTP/OpenAI,
        // rifiuto 'already running' da begin, annullamento cancel.load()) interrompe l'esecuzione
        // con Err(...) prima della registrazione, lasciando inalterato lo storico.
        let list = list_history_entries(&vault_path).unwrap();
        assert_eq!(list.len(), 2, "Nessuna entry addizionale deve risultare salvata per richieste fallite o annullate");
    }

    #[test]
    fn test_source_with_multiple_passages_saved() {
        let temp = tempdir().unwrap();
        set_test_history_dir(temp.path().to_path_buf());
        let vault_path = temp.path().join("vault");
        fs::create_dir_all(&vault_path.join("00_SYSTEM")).unwrap();

        let doc_bytes = b"# Titolo Multi-Passaggio\n\nPrimo blocco di testo.\n\nSecondo blocco di testo.";
        let doc_sha = crate::snapshots::compute_sha256(doc_bytes);
        let p1_bytes = b"Primo blocco di testo.";
        let p1_sha = crate::snapshots::compute_sha256(p1_bytes);
        let p2_bytes = b"Secondo blocco di testo.";
        let p2_sha = crate::snapshots::compute_sha256(p2_bytes);

        let source = HistorySourceRef {
            document_id: "20_RAW_SOURCES/multi.md".into(),
            relative_path: "20_RAW_SOURCES/multi.md".into(),
            title: "Multi Passaggio".into(),
            locator: Some("Paragrafi 1-13, Paragrafi 52-68".into()),
            doc_sha256: doc_sha,
            passages: vec![
                HistoryPassageRef {
                    passage_id: "p_1".into(),
                    passage_sha256: p1_sha.clone(),
                },
                HistoryPassageRef {
                    passage_id: "p_2".into(),
                    passage_sha256: p2_sha.clone(),
                },
            ],
            citation_index: 1,
        };

        let entry = HistoryEntry {
            id: "qa_multipass".into(),
            conversation_id: "conv_multi".into(),
            turn_index: 1,
            parent_entry_id: None,
            created_at_utc: "2026-09-24T00:00:00.000Z".into(),
            utc_offset_seconds: 28800,
            requested_model: "gpt-4o".into(),
            response_model: "gpt-4o-2024-08-06".into(),
            prompt: "Prompt multi pass".into(),
            answer: "Answer multi pass".into(),
            status: "complete".into(),
            duration_ms: 800,
            sources: vec![source],
            pid: Some(std::process::id()),
        };

        save_history_entry(&vault_path, entry).unwrap();
        let loaded = get_history_entry(&vault_path, "qa_multipass").unwrap();
        assert_eq!(loaded.sources.len(), 1);
        let loaded_source = &loaded.sources[0];
        assert_eq!(loaded_source.passages.len(), 2);
        assert_eq!(loaded_source.passages[0].passage_sha256, p1_sha);
        assert_eq!(loaded_source.passages[1].passage_sha256, p2_sha);
    }

    #[test]
    fn test_vault_id_lifecycle_and_duplicate_warning() {
        let temp = tempdir().unwrap();
        set_test_history_dir(temp.path().to_path_buf());

        // 1. Vault without VAULT_ID.json -> created
        let vault1 = temp.path().join("vault1");
        fs::create_dir_all(&vault1.join("00_SYSTEM")).unwrap();
        let info1 = get_or_create_vault_id(&vault1).unwrap();
        assert!(info1.vault_id.starts_with("vlt_"));
        assert!(info1.duplicate_warning.is_none());
        assert!(vault1.join("00_SYSTEM/VAULT_ID.json").exists());

        // Calling again on vault1 returns same ID
        let info1_again = get_or_create_vault_id(&vault1).unwrap();
        assert_eq!(info1_again.vault_id, info1.vault_id);
        assert!(info1_again.duplicate_warning.is_none());

        // 2. Corrupted file -> error without overwrite
        let vault_corrupted = temp.path().join("vault_corrupted");
        let sys_corr = vault_corrupted.join("00_SYSTEM");
        fs::create_dir_all(&sys_corr).unwrap();
        let id_file = sys_corr.join("VAULT_ID.json");
        fs::write(&id_file, b"corrupted non-json content").unwrap();

        let err = get_or_create_vault_id(&vault_corrupted).unwrap_err();
        assert!(err.contains("corrotto"), "Expected corruption error: {}", err);
        // Verify file was NOT overwritten
        assert_eq!(fs::read(&id_file).unwrap(), b"corrupted non-json content");

        // 3. Same VAULT_ID from two distinct paths -> warning
        let vault2 = temp.path().join("vault2");
        let sys2 = vault2.join("00_SYSTEM");
        fs::create_dir_all(&sys2).unwrap();
        // Copy vault1's VAULT_ID.json into vault2
        let v1_bytes = fs::read(vault1.join("00_SYSTEM/VAULT_ID.json")).unwrap();
        fs::write(sys2.join("VAULT_ID.json"), v1_bytes).unwrap();

        let info2 = get_or_create_vault_id(&vault2).unwrap();
        assert_eq!(info2.vault_id, info1.vault_id);
        assert!(info2.duplicate_warning.is_some(), "Expected duplicate warning");
        let warn_msg = info2.duplicate_warning.unwrap();
        assert!(warn_msg.contains("duplicato"), "Warning message: {}", warn_msg);
    }

    #[test]
    fn test_source_reopen_fresh_modified_missing() {
        let temp = tempdir().unwrap();
        set_test_history_dir(temp.path().to_path_buf());
        let vault_path = temp.path().join("vault");
        let raw_dir = vault_path.join("20_RAW_SOURCES");
        fs::create_dir_all(&raw_dir).unwrap();

        let note1_path = raw_dir.join("note1.md");
        let note1_content = b"# Note 1 Content\n\nSample text.";
        fs::write(&note1_path, note1_content).unwrap();
        let note1_sha = crate::snapshots::compute_sha256(note1_content);

        let note2_path = raw_dir.join("note2.md");
        let note2_content = b"# Note 2 Content\n\nOriginal text.";
        fs::write(&note2_path, note2_content).unwrap();
        let note2_sha = crate::snapshots::compute_sha256(note2_content);

        let note3_sha = "0000000000000000000000000000000000000000000000000000000000000000".to_string();

        // Now modify note2 on disk
        fs::write(&note2_path, b"# Note 2 Content\n\nModified text!").unwrap();

        let sources = vec![
            // 1. Fresh / unchanged
            HistorySourceRef {
                document_id: "20_RAW_SOURCES/note1.md".into(),
                relative_path: "20_RAW_SOURCES/note1.md".into(),
                title: "Note 1".into(),
                locator: None,
                doc_sha256: note1_sha,
                passages: vec![],
                citation_index: 1,
            },
            // 2. Modified
            HistorySourceRef {
                document_id: "20_RAW_SOURCES/note2.md".into(),
                relative_path: "20_RAW_SOURCES/note2.md".into(),
                title: "Note 2".into(),
                locator: None,
                doc_sha256: note2_sha,
                passages: vec![],
                citation_index: 2,
            },
            // 3. Missing (never created on disk)
            HistorySourceRef {
                document_id: "20_RAW_SOURCES/note3_missing.md".into(),
                relative_path: "20_RAW_SOURCES/note3_missing.md".into(),
                title: "Note 3".into(),
                locator: None,
                doc_sha256: note3_sha,
                passages: vec![],
                citation_index: 3,
            },
        ];

        let results = verify_history_sources(&vault_path, &sources).unwrap();
        assert_eq!(results.len(), 3);

        // Source 1: Fresh
        assert_eq!(results[0].status, SourceVerificationStatus::Fresh);
        assert!(results[0].text.is_some());
        assert!(results[0].warning.is_none());

        // Source 2: Modified
        assert_eq!(results[1].status, SourceVerificationStatus::Modified);
        assert!(results[1].text.is_none());
        assert!(results[1].warning.is_some());

        // Source 3: Missing
        assert_eq!(results[2].status, SourceVerificationStatus::Missing);
        assert!(results[2].text.is_none());
        assert!(results[2].warning.is_some());
    }

    #[test]
    fn test_single_delete_and_clear_vault_history() {
        let temp = tempdir().unwrap();
        set_test_history_dir(temp.path().to_path_buf());
        let vault_path = temp.path().join("vault");
        fs::create_dir_all(&vault_path.join("00_SYSTEM")).unwrap();

        for i in 1..=5 {
            let entry = HistoryEntry {
                id: format!("entry_{}", i),
                conversation_id: "c1".into(),
                turn_index: i,
                parent_entry_id: None,
                created_at_utc: format!("2026-09-24T00:0{:02}:00.000Z", i),
                utc_offset_seconds: 0,
                requested_model: "gpt-4o".into(),
                response_model: "gpt-4o-2024-08-06".into(),
                prompt: format!("P{}", i),
                answer: format!("A{}", i),
                status: "complete".into(),
                duration_ms: 100,
                sources: vec![],
                pid: Some(std::process::id()),
            };
            save_history_entry(&vault_path, entry).unwrap();
        }

        assert_eq!(list_history_entries(&vault_path).unwrap().len(), 5);

        // Delete single entry
        delete_history_entry(&vault_path, "entry_3").unwrap();
        let list_after_delete = list_history_entries(&vault_path).unwrap();
        assert_eq!(list_after_delete.len(), 4);
        assert!(get_history_entry(&vault_path, "entry_3").is_err());

        // Clear all history for this vault
        let cleared = clear_vault_history(&vault_path).unwrap();
        assert_eq!(cleared, 4);
        assert_eq!(list_history_entries(&vault_path).unwrap().len(), 0);
    }
}
