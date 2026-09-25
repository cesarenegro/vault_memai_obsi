//! Llama LLM server lifecycle and local generative model management for 100% local text generation (Ministral 3 8B Instruct).
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use crate::llama::{check_health, detect_llama_server_binary, find_free_port, get_models_dir};

pub const MINISTRAL_MODEL_FILE_NAME: &str = "Ministral-3-8B-Instruct-2512-Q5_K_M.gguf";
pub const MINISTRAL_MODEL_SIZE_BYTES: u64 = 6_059_268_512;
pub const MINISTRAL_MODEL_SHA256: &str =
    "7a5454127ec772e2389f0e71a77fedb88b83d4366d8a69facd0cfd0898f04d35";
pub const MINISTRAL_DOWNLOAD_URL: &str =
    "https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512-GGUF/resolve/main/Ministral-3-8B-Instruct-2512-Q5_K_M.gguf";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmReport {
    pub installed: bool,
    pub path: String,
    pub bytes: u64,
    pub sha256_ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmServerReport {
    pub running: bool,
    pub port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    pub model: String,
    pub healthy: bool,
    pub last_error: Option<String>,
    #[serde(default)]
    pub starting: bool,
}

#[derive(Default)]
struct LlmRunningState {
    child: Option<Child>,
    port: u16,
    owned_pid: Option<u32>,
    model_path: PathBuf,
    binary_path: Option<PathBuf>,
    last_error: Option<String>,
    starting: bool,
}

#[derive(Clone, Default)]
pub struct LlamaLlmServerState(Arc<Mutex<LlmRunningState>>);

pub fn get_target_ministral_path() -> Result<PathBuf, String> {
    let dir = get_models_dir()?;
    Ok(dir.join(MINISTRAL_MODEL_FILE_NAME))
}

pub fn get_ministral_verification_cache_path() -> Result<PathBuf, String> {
    let dir = get_models_dir()?;
    Ok(dir.join(format!("{}.verified.json", MINISTRAL_MODEL_FILE_NAME)))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinistralVerificationCache {
    pub path: String,
    pub bytes: u64,
    pub mtime_ms: u64,
    pub sha256: String,
    pub sha256_ok: bool,
    pub verified_at: String,
}

pub fn compute_file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Impossibile aprire il file per hash: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024]; // 1MB buffer for fast streaming hash
    loop {
        let n = file.read(&mut buffer).map_err(|e| format!("Errore lettura hash: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn local_llm_status() -> LocalLlmReport {
    local_llm_status_with_recheck(false)
}

pub fn local_llm_status_with_recheck(force_recompute_hash: bool) -> LocalLlmReport {
    let path = match get_target_ministral_path() {
        Ok(p) => p,
        Err(_) => {
            return LocalLlmReport {
                installed: false,
                path: String::new(),
                bytes: 0,
                sha256_ok: false,
            };
        }
    };

    if !path.is_file() {
        return LocalLlmReport {
            installed: false,
            path: path.to_string_lossy().to_string(),
            bytes: 0,
            sha256_ok: false,
        };
    }

    let meta = match fs::metadata(&path) {
        Ok(m) => m,
        Err(_) => {
            return LocalLlmReport {
                installed: false,
                path: path.to_string_lossy().to_string(),
                bytes: 0,
                sha256_ok: false,
            };
        }
    };

    let bytes = meta.len();
    if bytes == 0 {
        return LocalLlmReport {
            installed: false,
            path: path.to_string_lossy().to_string(),
            bytes: 0,
            sha256_ok: false,
        };
    }

    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let cache_file = get_ministral_verification_cache_path().ok();
    if !force_recompute_hash {
        if let Some(ref cf) = cache_file {
            if cf.is_file() {
                if let Ok(content) = fs::read_to_string(cf) {
                    if let Ok(cached) = serde_json::from_str::<MinistralVerificationCache>(&content) {
                        if cached.path == path.to_string_lossy()
                            && cached.bytes == bytes
                            && cached.mtime_ms == mtime_ms
                        {
                            return LocalLlmReport {
                                installed: true,
                                path: path.to_string_lossy().to_string(),
                                bytes,
                                sha256_ok: cached.sha256_ok,
                            };
                        }
                    }
                }
            }
        }
    }

    // Calcolo SHA-256 e salvataggio cache
    let hash = match compute_file_sha256(&path) {
        Ok(h) => h,
        Err(_) => {
            return LocalLlmReport {
                installed: true,
                path: path.to_string_lossy().to_string(),
                bytes,
                sha256_ok: false,
            };
        }
    };

    let sha256_ok = hash.to_lowercase() == MINISTRAL_MODEL_SHA256.to_lowercase();

    if let Some(cf) = cache_file {
        let entry = MinistralVerificationCache {
            path: path.to_string_lossy().to_string(),
            bytes,
            mtime_ms,
            sha256: hash,
            sha256_ok,
            verified_at: chrono::Utc::now().to_rfc3339(),
        };
        if let Ok(serialized) = serde_json::to_string_pretty(&entry) {
            let _ = fs::write(cf, serialized);
        }
    }

    LocalLlmReport {
        installed: true,
        path: path.to_string_lossy().to_string(),
        bytes,
        sha256_ok,
    }
}

pub async fn download_ministral_with_progress<F>(on_progress: F) -> Result<LocalLlmReport, String>
where
    F: Fn(u64, u64, f64) + Send + 'static,
{
    let target = get_target_ministral_path()?;
    let temp_target = target.with_extension("downloading");
    let _ = fs::remove_file(&temp_target);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(7200)) // 2 ore per file da 6 GB
        .build()
        .map_err(|e| e.to_string())?;

    let mut resp = client
        .get(MINISTRAL_DOWNLOAD_URL)
        .send()
        .await
        .map_err(|e| format!("Richiesta download fallita: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download fallito con stato HTTP: {}", resp.status()));
    }

    let total_bytes = resp
        .content_length()
        .unwrap_or(MINISTRAL_MODEL_SIZE_BYTES);

    let mut out = fs::File::create(&temp_target).map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let mut hasher = Sha256::new();
    let mut last_emit = Instant::now();

    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("Errore lettura chunk: {}", e))? {
        out.write_all(&chunk).map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        downloaded += chunk.len() as u64;

        if last_emit.elapsed() >= Duration::from_millis(250) || (total_bytes > 0 && downloaded == total_bytes) {
            let pct = if total_bytes > 0 {
                (downloaded as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };
            on_progress(downloaded, total_bytes, pct);
            last_emit = Instant::now();
        }
    }

    out.flush().map_err(|e| e.to_string())?;
    drop(out);

    let final_hash = format!("{:x}", hasher.finalize());
    if final_hash.to_lowercase() != MINISTRAL_MODEL_SHA256.to_lowercase() {
        let _ = fs::remove_file(&temp_target);
        return Err(format!(
            "Verifica SHA-256 fallita su Ministral: calcolato {} vs atteso {}",
            final_hash, MINISTRAL_MODEL_SHA256
        ));
    }

    fs::rename(&temp_target, &target).map_err(|e| e.to_string())?;

    Ok(local_llm_status_with_recheck(true))
}

impl LlamaLlmServerState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(LlmRunningState::default())))
    }

    pub fn ensure_running(&self) -> Result<u16, String> {
        let rep = self.start()?;
        if rep.running && rep.healthy && rep.port > 0 {
            Ok(rep.port)
        } else {
            Err(rep.last_error.unwrap_or_else(|| "Impossibile avviare il servizio LLM locale Ministral".to_string()))
        }
    }

    pub fn status(&self) -> LocalLlmServerReport {
        let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());

        if s.owned_pid.is_some() {
            if let Some(ref mut child) = s.child {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let code = status.code().unwrap_or(-1);
                        s.child = None;
                        s.owned_pid = None;
                        s.last_error = Some(format!("Il processo LLM locale è terminato con codice: {}", code));
                        s.port = 0;
                    }
                    Ok(None) => {}
                    Err(e) => {
                        s.last_error = Some(format!("Errore controllo processo LLM: {}", e));
                    }
                }
            }
        }

        let is_running = s.port > 0 && s.owned_pid.is_some();
        let healthy = is_running && check_health(s.port);

        LocalLlmServerReport {
            running: is_running,
            port: s.port,
            pid: s.owned_pid,
            model: MINISTRAL_MODEL_FILE_NAME.to_string(),
            healthy,
            last_error: s.last_error.clone(),
            starting: s.starting,
        }
    }

    pub fn start(&self) -> Result<LocalLlmServerReport, String> {
        let current = self.status();
        if current.running && current.healthy {
            return Ok(current);
        }

        {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            if s.starting {
                return Ok(LocalLlmServerReport {
                    running: false,
                    port: 0,
                    pid: None,
                    model: MINISTRAL_MODEL_FILE_NAME.to_string(),
                    healthy: false,
                    last_error: None,
                    starting: true,
                });
            }
            s.starting = true;
            s.last_error = None;
        }

        let model_path = match get_target_ministral_path() {
            Ok(p) => {
                if !p.is_file() {
                    let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                    s.starting = false;
                    s.last_error = Some("Modello Ministral non trovato su disco. Eseguire prima il download.".into());
                    return Err("Modello Ministral non trovato su disco. Eseguire prima il download.".into());
                }
                p
            }
            Err(e) => {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                s.last_error = Some(e.clone());
                return Err(e);
            }
        };

        let binary = match detect_llama_server_binary() {
            Some(b) => b,
            None => {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                let err = "Binario llama-server non disponibile nel pacchetto o nel sistema.".to_string();
                s.last_error = Some(err.clone());
                return Err(err);
            }
        };

        let free_port = match find_free_port() {
            Ok(p) => p,
            Err(e) => {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                s.last_error = Some(e.clone());
                return Err(e);
            }
        };

        // Parametri per Ministral 3 8B Instruct (generazione testo, Metal GPU, contesto 8k)
        let mut cmd = Command::new(&binary);
        cmd.args([
            "-m", &model_path.to_string_lossy(),
            "--host", "127.0.0.1",
            "--port", &free_port.to_string(),
            "-c", "8192",
            "-ngl", "99",
            "-ub", "512",
            "-b", "512",
        ]);

        if let Some(parent) = binary.parent() {
            cmd.current_dir(parent);
            let metal = parent.join("libggml-metal.so");
            if metal.is_file() {
                cmd.env("GGML_BACKEND_PATH", metal);
            }
        }

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::piped());

        let child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                let err = format!("Impossibile avviare il processo LLM locale: {}", e);
                s.last_error = Some(err.clone());
                return Err(err);
            }
        };

        let pid = child.id();

        {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            s.child = Some(child);
            s.owned_pid = Some(pid);
            s.port = free_port;
            s.model_path = model_path;
            s.binary_path = Some(binary);
        }

        // Attesa /health fino a 30 secondi (caricamento modello 6GB in memoria Metal)
        let t_deadline = Instant::now() + Duration::from_secs(35);
        let mut is_healthy = false;

        while Instant::now() < t_deadline {
            std::thread::sleep(Duration::from_millis(300));
            if check_health(free_port) {
                is_healthy = true;
                break;
            }

            // Controllo se è crashato
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(ref mut c) = s.child {
                if let Ok(Some(st)) = c.try_wait() {
                    s.starting = false;
                    s.child = None;
                    s.owned_pid = None;
                    s.port = 0;
                    let err = format!("Il processo LLM è uscito prematuramente con codice: {}", st);
                    s.last_error = Some(err.clone());
                    return Err(err);
                }
            }
        }

        {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            s.starting = false;
        }

        if !is_healthy {
            self.stop()?;
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            let err = "Timeout attesa salute (/health) del servizio LLM locale.".to_string();
            s.last_error = Some(err.clone());
            return Err(err);
        }

        Ok(self.status())
    }

    pub fn stop(&self) -> Result<LocalLlmServerReport, String> {
        let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());

        if let Some(mut child) = s.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        s.owned_pid = None;
        s.port = 0;
        s.starting = false;

        Ok(LocalLlmServerReport {
            running: false,
            port: 0,
            pid: None,
            model: MINISTRAL_MODEL_FILE_NAME.to_string(),
            healthy: false,
            last_error: None,
            starting: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ministral_constants() {
        assert_eq!(MINISTRAL_MODEL_FILE_NAME, "Ministral-3-8B-Instruct-2512-Q5_K_M.gguf");
        assert_eq!(MINISTRAL_MODEL_SIZE_BYTES, 6_059_268_512);
        assert_eq!(MINISTRAL_MODEL_SHA256.len(), 64);
        assert!(MINISTRAL_DOWNLOAD_URL.starts_with("https://huggingface.co/"));
    }

    #[test]
    fn test_llama_llm_state_initial_status() {
        let state = LlamaLlmServerState::new();
        let rep = state.status();
        assert!(!rep.running);
        assert!(!rep.healthy);
        assert_eq!(rep.port, 0);
        assert!(rep.pid.is_none());
        assert_eq!(rep.model, MINISTRAL_MODEL_FILE_NAME);
        assert!(!rep.starting);
    }

    #[test]
    fn test_llama_llm_report_serialization() {
        let rep = LocalLlmReport {
            installed: true,
            path: "/path/to/Ministral.gguf".to_string(),
            bytes: 6_059_268_512,
            sha256_ok: true,
        };
        let json = serde_json::to_string(&rep).unwrap();
        assert!(json.contains("\"installed\":true"));
        assert!(json.contains("\"sha256Ok\":true"));
        assert!(json.contains("\"bytes\":6059268512"));
    }

    #[test]
    fn test_compute_file_sha256() {
        let tmp = tempfile::tempdir().unwrap();
        let file_path = tmp.path().join("test.bin");
        fs::write(&file_path, b"hello limen vault local llm ministral").unwrap();

        let hash = compute_file_sha256(&file_path).unwrap();
        assert_eq!(hash.len(), 64);

        // Verifica consistenza con sha2::Sha256
        let mut hasher = Sha256::new();
        hasher.update(b"hello limen vault local llm ministral");
        let expected = format!("{:x}", hasher.finalize());
        assert_eq!(hash, expected);
    }
}

