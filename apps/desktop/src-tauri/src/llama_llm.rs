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

pub const MINISTRAL_8B_MODEL_FILE_NAME: &str = "Ministral-3-8B-Instruct-2512-Q5_K_M.gguf";
pub const MINISTRAL_8B_MODEL_SIZE_BYTES: u64 = 6_059_268_512;
pub const MINISTRAL_8B_MODEL_SHA256: &str =
    "7a5454127ec772e2389f0e71a77fedb88b83d4366d8a69facd0cfd0898f04d35";
pub const MINISTRAL_8B_DOWNLOAD_URL: &str =
    "https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512-GGUF/resolve/main/Ministral-3-8B-Instruct-2512-Q5_K_M.gguf";

pub const MINISTRAL_3B_MODEL_FILE_NAME: &str = "Ministral-3-3B-Instruct-2512-Q5_K_M.gguf";
pub const MINISTRAL_3B_MODEL_SIZE_BYTES: u64 = 2_474_178_720;
pub const MINISTRAL_3B_MODEL_SHA256: &str =
    "e23dd88b0e0951d3f5784d6d4092210cda2b006b251f33b226b283a6c9d1f6bb";
pub const MINISTRAL_3B_DOWNLOAD_URL: &str =
    "https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF/resolve/main/Ministral-3-3B-Instruct-2512-Q5_K_M.gguf";

// Alias per retrocompatibilità
pub const MINISTRAL_MODEL_FILE_NAME: &str = MINISTRAL_8B_MODEL_FILE_NAME;
pub const MINISTRAL_MODEL_SIZE_BYTES: u64 = MINISTRAL_8B_MODEL_SIZE_BYTES;
pub const MINISTRAL_MODEL_SHA256: &str = MINISTRAL_8B_MODEL_SHA256;
pub const MINISTRAL_DOWNLOAD_URL: &str = MINISTRAL_8B_DOWNLOAD_URL;

pub const SIXTEEN_GB_BYTES: u64 = 16 * 1024 * 1024 * 1024;
pub const MINISTRAL_STARTUP_TIMEOUT_SECS: u64 = 90;

pub fn is_sub_16gb_system() -> bool {
    let ram = get_physical_ram_bytes();
    ram > 0 && ram < SIXTEEN_GB_BYTES
}

pub fn get_active_model_file_name() -> &'static str {
    if is_sub_16gb_system() {
        MINISTRAL_3B_MODEL_FILE_NAME
    } else {
        MINISTRAL_8B_MODEL_FILE_NAME
    }
}

pub fn get_active_model_size_bytes() -> u64 {
    if is_sub_16gb_system() {
        MINISTRAL_3B_MODEL_SIZE_BYTES
    } else {
        MINISTRAL_8B_MODEL_SIZE_BYTES
    }
}

pub fn get_active_model_sha256() -> &'static str {
    if is_sub_16gb_system() {
        MINISTRAL_3B_MODEL_SHA256
    } else {
        MINISTRAL_8B_MODEL_SHA256
    }
}

pub fn get_active_download_url() -> &'static str {
    if is_sub_16gb_system() {
        MINISTRAL_3B_DOWNLOAD_URL
    } else {
        MINISTRAL_8B_DOWNLOAD_URL
    }
}

/// Legge la memoria RAM fisica del sistema in byte (macOS sysctl hw.memsize).
#[cfg(target_os = "macos")]
pub fn get_physical_ram_bytes() -> u64 {
    let mut mib = [libc::CTL_HW, libc::HW_MEMSIZE];
    let mut mem_size: u64 = 0;
    let mut len = std::mem::size_of::<u64>();
    unsafe {
        if libc::sysctl(
            mib.as_mut_ptr(),
            2,
            &mut mem_size as *mut u64 as *mut libc::c_void,
            &mut len,
            std::ptr::null_mut(),
            0,
        ) == 0
        {
            mem_size
        } else {
            0
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn get_physical_ram_bytes() -> u64 {
    SIXTEEN_GB_BYTES
}

/// Restituisce l'avviso RAM se la memoria fisica è inferiore a 16 GB.
pub fn ram_warning_for_bytes(bytes: u64) -> Option<String> {
    if bytes > 0 && bytes < SIXTEEN_GB_BYTES {
        Some(
            "Questo Mac ha meno di 16 GB di RAM: viene utilizzato Ministral 3 3B Instruct Q5_K_M (2.47 GB) ottimizzato per memoria unificata."
                .to_string(),
        )
    } else {
        None
    }
}

/// Legge l'ultima riga non vuota da un file di log (es. stderr di llama-server).
pub fn read_last_log_line(path: &Path) -> Option<String> {
    if let Ok(content) = fs::read_to_string(path) {
        content
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .map(|l| l.trim().to_string())
    } else {
        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmReport {
    pub installed: bool,
    pub path: String,
    pub bytes: u64,
    pub sha256_ok: bool,
    #[serde(default)]
    pub model_name: String,
    #[serde(default)]
    pub physical_ram_bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ram_warning: Option<String>,
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
    #[serde(default)]
    pub physical_ram_bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ram_warning: Option<String>,
}

#[derive(Default)]
struct LlmRunningState {
    child: Option<Child>,
    port: u16,
    owned_pid: Option<u32>,
    model_path: PathBuf,
    binary_path: Option<PathBuf>,
    log_path: Option<PathBuf>,
    last_error: Option<String>,
    starting: bool,
}

#[derive(Clone, Default)]
pub struct LlamaLlmServerState(Arc<Mutex<LlmRunningState>>);

pub fn get_target_ministral_path() -> Result<PathBuf, String> {
    let dir = get_models_dir()?;
    Ok(dir.join(get_active_model_file_name()))
}

pub fn get_ministral_verification_cache_path() -> Result<PathBuf, String> {
    let dir = get_models_dir()?;
    Ok(dir.join(format!("{}.verified.json", get_active_model_file_name())))
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
    let mut file =
        fs::File::open(path).map_err(|e| format!("Impossibile aprire il file per hash: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024]; // 1MB buffer for fast streaming hash
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("Errore lettura hash: {}", e))?;
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
    let ram = get_physical_ram_bytes();
    let ram_warning = ram_warning_for_bytes(ram);

    let path = match get_target_ministral_path() {
        Ok(p) => p,
        Err(_) => {
            return LocalLlmReport {
                installed: false,
                path: String::new(),
                bytes: 0,
                sha256_ok: false,
                model_name: get_active_model_file_name().to_string(),
                physical_ram_bytes: ram,
                ram_warning,
            };
        }
    };

    if !path.is_file() {
        return LocalLlmReport {
            installed: false,
            path: path.to_string_lossy().to_string(),
            bytes: 0,
            sha256_ok: false,
            model_name: get_active_model_file_name().to_string(),
            physical_ram_bytes: ram,
            ram_warning,
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
                model_name: get_active_model_file_name().to_string(),
                physical_ram_bytes: ram,
                ram_warning,
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
            model_name: get_active_model_file_name().to_string(),
            physical_ram_bytes: ram,
            ram_warning,
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
                    if let Ok(cached) = serde_json::from_str::<MinistralVerificationCache>(&content)
                    {
                        if cached.path == path.to_string_lossy()
                            && cached.bytes == bytes
                            && cached.mtime_ms == mtime_ms
                        {
                            return LocalLlmReport {
                                installed: true,
                                path: path.to_string_lossy().to_string(),
                                bytes,
                                sha256_ok: cached.sha256_ok,
                                model_name: get_active_model_file_name().to_string(),
                                physical_ram_bytes: ram,
                                ram_warning,
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
                model_name: get_active_model_file_name().to_string(),
                physical_ram_bytes: ram,
                ram_warning,
            };
        }
    };

    let target_hash = get_active_model_sha256();
    let sha256_ok = hash.to_lowercase() == target_hash.to_lowercase();

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
        model_name: get_active_model_file_name().to_string(),
        physical_ram_bytes: ram,
        ram_warning,
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

    let download_url = get_active_download_url();
    let expected_size = get_active_model_size_bytes();
    let expected_sha256 = get_active_model_sha256();

    let mut resp = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Richiesta download fallita: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download fallito con stato HTTP: {}", resp.status()));
    }

    let total_bytes = resp
        .content_length()
        .unwrap_or(expected_size);

    let mut out = fs::File::create(&temp_target).map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let mut hasher = Sha256::new();
    let mut last_emit = Instant::now();

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Errore lettura chunk: {}", e))?
    {
        out.write_all(&chunk).map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        downloaded += chunk.len() as u64;

        if last_emit.elapsed() >= Duration::from_millis(250)
            || (total_bytes > 0 && downloaded == total_bytes)
        {
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
    if final_hash.to_lowercase() != expected_sha256.to_lowercase() {
        let _ = fs::remove_file(&temp_target);
        return Err(format!(
            "Verifica SHA-256 fallita su Ministral: calcolato {} vs atteso {}",
            final_hash, expected_sha256
        ));
    }

    fs::rename(&temp_target, &target).map_err(|e| e.to_string())?;

    Ok(local_llm_status_with_recheck(true))
}

impl LlamaLlmServerState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(LlmRunningState::default())))
    }

    /// Attende che il server sia avviato e pronto entro il limite configurato (90s).
    /// Se un avvio è già in corso (starting == true), non fallisce ma attende
    /// che l'avvio si completi o che scada il timeout di 90 secondi.
    pub fn ensure_running(&self) -> Result<u16, String> {
        let t_deadline = Instant::now() + Duration::from_secs(MINISTRAL_STARTUP_TIMEOUT_SECS);
        loop {
            let rep = self.start()?;
            if rep.running && rep.healthy && rep.port > 0 {
                return Ok(rep.port);
            }
            if rep.starting {
                // Avvio già in corso da parte di un altro thread/task: attendi
                while Instant::now() < t_deadline {
                    std::thread::sleep(Duration::from_millis(250));
                    let status = self.status();
                    if status.running && status.healthy && status.port > 0 {
                        return Ok(status.port);
                    }
                    if !status.starting {
                        // L'avvio in corso è terminato
                        if let Some(err) = status.last_error {
                            return Err(err);
                        }
                        break;
                    }
                }
                if Instant::now() >= t_deadline {
                    return Err(
                        "Timeout attesa avvio in corso del servizio LLM locale Ministral."
                            .to_string(),
                    );
                }
            } else {
                return Err(rep.last_error.unwrap_or_else(|| {
                    "Impossibile avviare il servizio LLM locale Ministral".to_string()
                }));
            }
        }
    }

    pub fn status(&self) -> LocalLlmServerReport {
        let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        let ram = get_physical_ram_bytes();
        let ram_warning = ram_warning_for_bytes(ram);

        if s.owned_pid.is_some() {
            if let Some(ref mut child) = s.child {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let code = status.code().unwrap_or(-1);
                        s.child = None;
                        s.owned_pid = None;
                        let last_line = s
                            .log_path
                            .as_deref()
                            .and_then(read_last_log_line)
                            .unwrap_or_default();
                        s.last_error = Some(if !last_line.is_empty() {
                            format!("Il processo LLM locale è terminato: {}", last_line)
                        } else {
                            format!("Il processo LLM locale è terminato con codice: {}", code)
                        });
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
            model: get_active_model_file_name().to_string(),
            healthy,
            last_error: s.last_error.clone(),
            starting: s.starting,
            physical_ram_bytes: ram,
            ram_warning,
        }
    }

    pub fn start(&self) -> Result<LocalLlmServerReport, String> {
        let current = self.status();
        if current.running && current.healthy {
            return Ok(current);
        }

        let ram = get_physical_ram_bytes();
        let ram_warning = ram_warning_for_bytes(ram);

        {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            if s.starting {
                return Ok(LocalLlmServerReport {
                    running: false,
                    port: 0,
                    pid: None,
                    model: get_active_model_file_name().to_string(),
                    healthy: false,
                    last_error: None,
                    starting: true,
                    physical_ram_bytes: ram,
                    ram_warning,
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
                    let err =
                        "Modello Ministral non trovato su disco. Eseguire prima il download."
                            .to_string();
                    s.last_error = Some(err.clone());
                    return Err(err);
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
                let err =
                    "Binario llama-server non disponibile nel pacchetto o nel sistema.".to_string();
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

        // File di log dedicato per stderr di llama-server (troncato ad ogni avvio)
        // Evita il blocco deadlock del pipe stderr (Punto 2)
        let log_path = match model_path.parent() {
            Some(dir) => dir.join("llama-llm.log"),
            None => PathBuf::from("llama-llm.log"),
        };
        let stderr_file = match fs::File::create(&log_path) {
            Ok(f) => Stdio::from(f),
            Err(_) => Stdio::null(),
        };

        // Parametri per Ministral Instruct (generazione testo, Metal GPU, contesto 8k)
        let mut cmd = Command::new(&binary);
        cmd.args([
            "-m",
            &model_path.to_string_lossy(),
            "--host",
            "127.0.0.1",
            "--port",
            &free_port.to_string(),
            "-c",
            "8192",
            "-np",
            "1",
            "-ctk",
            "q8_0",
            "-ctv",
            "q8_0",
            "-ngl",
            "99",
            "-ub",
            "512",
            "-b",
            "512",
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
        cmd.stderr(stderr_file);

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
            s.log_path = Some(log_path.clone());
        }

        // Attesa /health fino a 90 secondi (caricamento modello 6GB in memoria Metal, specialmente con swap su Mac 8GB)
        let t_deadline = Instant::now() + Duration::from_secs(MINISTRAL_STARTUP_TIMEOUT_SECS);
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
                    let last_line = read_last_log_line(&log_path).unwrap_or_default();
                    let err = if !last_line.is_empty() {
                        format!("Il processo LLM è uscito prematuramente: {}", last_line)
                    } else {
                        format!("Il processo LLM è uscito prematuramente con codice: {}", st)
                    };
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
            let last_line = read_last_log_line(&log_path).unwrap_or_default();
            self.stop()?;
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            let err = if !last_line.is_empty() {
                format!(
                    "Timeout attesa salute (/health) del servizio LLM locale: {}",
                    last_line
                )
            } else {
                "Timeout attesa salute (/health) del servizio LLM locale.".to_string()
            };
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

        let ram = get_physical_ram_bytes();
        let ram_warning = ram_warning_for_bytes(ram);

        Ok(LocalLlmServerReport {
            running: false,
            port: 0,
            pid: None,
            model: MINISTRAL_MODEL_FILE_NAME.to_string(),
            healthy: false,
            last_error: None,
            starting: false,
            physical_ram_bytes: ram,
            ram_warning,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ministral_constants() {
        assert_eq!(
            MINISTRAL_MODEL_FILE_NAME,
            "Ministral-3-8B-Instruct-2512-Q5_K_M.gguf"
        );
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
        assert_eq!(rep.model, get_active_model_file_name());
        assert!(!rep.starting);
        assert!(rep.physical_ram_bytes > 0);
    }

    #[test]
    fn test_llama_llm_report_serialization() {
        let rep = LocalLlmReport {
            installed: true,
            path: "/path/to/Ministral.gguf".to_string(),
            bytes: 6_059_268_512,
            sha256_ok: true,
            model_name: "Ministral-3-8B-Instruct-2512-Q5_K_M.gguf".to_string(),
            physical_ram_bytes: 8589934592,
            ram_warning: Some("Mac sotto i 16 GB".to_string()),
        };
        let json = serde_json::to_string(&rep).unwrap();
        assert!(json.contains("\"installed\":true"));
        assert!(json.contains("\"sha256Ok\":true"));
        assert!(json.contains("\"bytes\":6059268512"));
        assert!(json.contains("\"physicalRamBytes\":8589934592"));
        assert!(json.contains("\"ramWarning\":\"Mac sotto i 16 GB\""));
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

    #[test]
    fn test_physical_ram_and_warning() {
        let ram = get_physical_ram_bytes();
        assert!(ram > 0, "RAM fisica deve essere maggiore di 0");
        if ram < SIXTEEN_GB_BYTES {
            let warn = ram_warning_for_bytes(ram);
            assert!(warn.is_some());
            assert!(warn.unwrap().contains("16 GB"));
        } else {
            let warn = ram_warning_for_bytes(ram);
            assert!(warn.is_none());
        }
    }

    #[test]
    fn test_read_last_log_line() {
        let tmp = tempfile::tempdir().unwrap();
        let log_file = tmp.path().join("test-llama.log");
        fs::write(
            &log_file,
            "line 1\nline 2 info\nllama-server: error: unable to allocate metal memory\n\n",
        )
        .unwrap();

        let last = read_last_log_line(&log_file);
        assert_eq!(
            last,
            Some("llama-server: error: unable to allocate metal memory".to_string())
        );
    }

    #[test]
    fn test_ensure_running_with_already_starting_eventually_resolves() {
        let state = LlamaLlmServerState::new();
        // Simula starting == true impostato da un altro thread
        {
            let mut s = state.0.lock().unwrap();
            s.starting = true;
        }
        let state_clone = state.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(150));
            let mut s = state_clone.0.lock().unwrap();
            s.starting = false;
            s.last_error = Some("Errore simulato terminazione avvio".to_string());
        });

        let res = state.ensure_running();
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "Errore simulato terminazione avvio");
    }
}
