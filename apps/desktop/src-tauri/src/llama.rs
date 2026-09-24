//! Llama server lifecycle and local model management for 100% local semantic RAG.
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

pub const EXPECTED_MODEL_FILE_NAME: &str = "bge-m3-Q8_0.gguf";
pub const EXPECTED_MODEL_SIZE_BYTES: u64 = 634_553_760;
pub const EXPECTED_MODEL_SHA256: &str =
    "950f4a8e5e19477a6d3c26d2f162233c20002c601f75e4b002e3239997821167";
pub const EXPECTED_EMBEDDINGS_DIMENSIONS: usize = 1024;
pub const MODEL_DOWNLOAD_URL: &str =
    "https://huggingface.co/gpustack/bge-m3-GGUF/resolve/main/bge-m3-Q8_0.gguf";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelReport {
    pub installed: bool,
    pub path: String,
    pub bytes: u64,
    pub sha256_ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalServerReport {
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
struct RunningState {
    child: Option<Child>,
    port: u16,
    adopted_pid: Option<u32>,
    owned_pid: Option<u32>,
    model_path: PathBuf,
    binary_path: Option<PathBuf>,
    last_error: Option<String>,
    crash_count: u32,
    auto_start_failed: bool,
    auto_start_failure_reason: Option<String>,
    starting: bool,
    start_owner: Option<u64>,
}

#[derive(Clone, Default)]
pub struct LlamaServerState(Arc<Mutex<RunningState>>);

use std::sync::atomic::{AtomicU64, Ordering};

pub static MODEL_SHA256_COMPUTE_COUNT: AtomicU64 = AtomicU64::new(0);
pub static START_TOKEN_GEN: AtomicU64 = AtomicU64::new(1);

pub fn next_start_token() -> u64 {
    START_TOKEN_GEN.fetch_add(1, Ordering::SeqCst)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelVerificationCache {
    pub path: String,
    pub bytes: u64,
    pub mtime_ms: u64,
    pub sha256: String,
    pub sha256_ok: bool,
    pub verified_at: String,
}

pub fn get_local_model_timing_log_path() -> PathBuf {
    if let Ok(override_path) = std::env::var("LIMEN_LOCAL_MODEL_TIMING_LOG") {
        if !override_path.trim().is_empty() {
            return PathBuf::from(override_path);
        }
    }
    if let Ok(timing_dir) = std::env::var("LIMEN_TIMING_LOG_DIR") {
        if !timing_dir.trim().is_empty() {
            return PathBuf::from(timing_dir).join("local_model_timing.log");
        }
    }
    #[cfg(test)]
    {
        return std::env::temp_dir().join("limen_test_local_model_timing.log");
    }
    #[allow(unreachable_code)]
    {
        let base = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".into());
        PathBuf::from(base).join(".limen-vault").join("local_model_timing.log")
    }
}

pub fn log_local_model_timing_meta(
    event: &str,
    elapsed_ms: u64,
    service_binary: Option<&Path>,
    service_pid: Option<u32>,
    service_port: Option<u16>,
    details: &str,
) {
    let log_path = get_local_model_timing_log_path();
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

    let app_exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "sconosciuto".to_string());
    let app_pid = std::process::id();

    let s_bin = service_binary
        .map(|p| p.to_string_lossy().to_string())
        .or_else(|| service_pid.and_then(get_process_exe_path).map(|p| p.to_string_lossy().to_string()))
        .or_else(|| {
            if service_pid.is_none() && service_port.is_none() {
                detect_llama_server_binary().map(|p| p.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "non_rilevato".to_string());
    let s_pid = service_pid.map(|p| p.to_string()).unwrap_or_else(|| "none".to_string());
    let s_port = service_port.map(|p| p.to_string()).unwrap_or_else(|| "none".to_string());

    let line = format!(
        "{} | event={} | elapsed_ms={} | app_exe={} | app_pid={} | service_exe={} | service_pid={} | service_port={} | details={}\n",
        now, event, elapsed_ms, app_exe, app_pid, s_bin, s_pid, s_port, details
    );
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = f.write_all(line.as_bytes());
    }
}

pub fn log_local_model_timing(event: &str, elapsed_ms: u64, details: &str) {
    log_local_model_timing_meta(event, elapsed_ms, None, None, None, details);
}

pub fn rotate_llama_server_logs(logs_dir: &Path, max_files: usize) {
    if let Ok(entries) = fs::read_dir(logs_dir) {
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.is_file()
                    && p.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.starts_with("llama-server_") && n.ends_with(".log"))
                        .unwrap_or(false)
            })
            .collect();

        files.sort();

        if files.len() > max_files {
            let to_remove = files.len() - max_files;
            for p in files.iter().take(to_remove) {
                let _ = fs::remove_file(p);
            }
        }
    }
}

pub fn get_models_dir() -> Result<PathBuf, String> {
    let base = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .or_else(|_| std::env::var("APPDATA"))
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    let dir = Path::new(&base).join("Library/Application Support/LIMEN Vault/models");
    #[cfg(not(target_os = "macos"))]
    let dir = Path::new(&base).join("LIMEN Vault/models");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

pub fn get_target_model_path() -> Result<PathBuf, String> {
    Ok(get_models_dir()?.join(EXPECTED_MODEL_FILE_NAME))
}

pub fn get_model_cache_meta_path() -> Result<PathBuf, String> {
    Ok(get_models_dir()?.join("bge-m3-Q8_0.gguf.sha256.json"))
}

pub fn read_model_cache(cache_file: &Path) -> Option<ModelVerificationCache> {
    if !cache_file.exists() {
        return None;
    }
    let content = fs::read_to_string(cache_file).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn save_model_cache(cache_file: &Path, cache: &ModelVerificationCache) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cache).map_err(|e| e.to_string())?;
    fs::write(cache_file, json).map_err(|e| e.to_string())
}

pub fn compute_file_sha256(path: &Path) -> Result<String, String> {
    MODEL_SHA256_COMPUTE_COUNT.fetch_add(1, Ordering::Relaxed);
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Parametric verification function for production and unit testing.
pub fn model_status_for_paths(
    target: &Path,
    cache_file: &Path,
    expected_size: u64,
    expected_sha256: &str,
    force_recheck: bool,
) -> LocalModelReport {
    // If target does not exist, check common local huggingface snapshot location
    if !target.exists() {
        if let Ok(home) = std::env::var("HOME") {
            let hf_candidate = Path::new(&home)
                .join(".cache/huggingface/hub/models--gpustack--bge-m3-GGUF/snapshots/2d48f1737679ad900d5c26c5aad5410e9c70fdca/bge-m3-Q8_0.gguf");
            if hf_candidate.exists() {
                if let Ok(meta) = fs::metadata(&hf_candidate) {
                    if meta.len() == expected_size {
                        #[cfg(unix)]
                        let _ = std::os::unix::fs::symlink(&hf_candidate, target);
                        #[cfg(windows)]
                        let _ = std::os::windows::fs::symlink_file(&hf_candidate, target);
                    }
                }
            }
        }
    }

    if !target.exists() {
        return LocalModelReport {
            installed: false,
            path: target.to_string_lossy().to_string(),
            bytes: 0,
            sha256_ok: false,
        };
    }

    let meta = match fs::metadata(target) {
        Ok(m) => m,
        Err(_) => {
            return LocalModelReport {
                installed: false,
                path: target.to_string_lossy().to_string(),
                bytes: 0,
                sha256_ok: false,
            };
        }
    };
    let bytes = meta.len();
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let target_str = target.to_string_lossy().to_string();

    // Se la dimensione su disco non coincide con quella attesa per il modello, non è il modello atteso.
    if bytes != expected_size {
        eprintln!("[llama] File size mismatch on {}: {} vs expected {}", target.display(), bytes, expected_size);
        let _ = fs::remove_file(cache_file);
        return LocalModelReport {
            installed: false,
            path: target_str,
            bytes,
            sha256_ok: false,
        };
    }

    // 1. Fast path: verifica tramite cache dei metadati (se non è richiesto force_recheck)
    if !force_recheck {
        if let Some(cache) = read_model_cache(cache_file) {
            let is_ntfs = crate::ai::is_high_precision_fs(target);
            let mtime_matches = if is_ntfs {
                cache.mtime_ms == mtime_ms
            } else {
                cache.mtime_ms.abs_diff(mtime_ms) <= 2000
            };

            let path_matches = Path::new(&cache.path) == target || cache.path == target_str;
            let sha256_matches = cache.sha256.eq_ignore_ascii_case(expected_sha256);
            let size_matches = cache.bytes == expected_size && bytes == expected_size;

            if size_matches && path_matches && sha256_matches && mtime_matches && cache.sha256_ok {
                return LocalModelReport {
                    installed: true,
                    path: target_str,
                    bytes,
                    sha256_ok: true,
                };
            }
        }
    }

    // 2. Slow path: verifica completa SHA-256 su disco
    let sha256_ok = match compute_file_sha256(target) {
        Ok(hash) => {
            let ok = hash.eq_ignore_ascii_case(expected_sha256);
            if ok {
                let _ = save_model_cache(cache_file, &ModelVerificationCache {
                    path: target_str.clone(),
                    bytes,
                    mtime_ms,
                    sha256: hash,
                    sha256_ok: true,
                    verified_at: chrono::Utc::now().to_rfc3339(),
                });
            } else {
                eprintln!("[llama] Hash mismatch on {}: {} vs expected {}", target.display(), hash, expected_sha256);
                let _ = fs::remove_file(cache_file);
            }
            ok
        }
        Err(_) => {
            let _ = fs::remove_file(cache_file);
            false
        }
    };

    LocalModelReport {
        installed: sha256_ok,
        path: target_str,
        bytes,
        sha256_ok,
    }
}

/// Install model from source file with SINGLE I/O pass (streaming copy + simultaneous hash computation).
pub fn install_model_for_paths(
    source_path: &Path,
    target: &Path,
    cache_file: &Path,
    expected_size: u64,
    expected_sha256: &str,
) -> Result<LocalModelReport, String> {
    let t0 = Instant::now();
    if !source_path.is_file() {
        return Err(format!("File non trovato: {:?}", source_path));
    }
    let meta = fs::metadata(source_path).map_err(|e| e.to_string())?;
    let bytes = meta.len();
    if bytes != expected_size {
        return Err(format!(
            "Dimensione file non corretta: {} byte (richiesti esattamente {} byte)",
            bytes,
            expected_size
        ));
    }

    // Copia e calcolo hash in UN'UNICA passata di I/O (singola lettura del file sorgente)
    let temp_target = target.with_extension("installing");
    let _ = fs::remove_file(&temp_target);

    let mut source_file = fs::File::open(source_path).map_err(|e| e.to_string())?;
    let mut dest_file = fs::File::create(&temp_target).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];

    loop {
        let count = source_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        dest_file.write_all(&buffer[..count]).map_err(|e| e.to_string())?;
        hasher.update(&buffer[..count]);
    }
    dest_file.flush().map_err(|e| e.to_string())?;
    drop(dest_file);
    drop(source_file);

    MODEL_SHA256_COMPUTE_COUNT.fetch_add(1, Ordering::Relaxed);

    let hash = format!("{:x}", hasher.finalize());
    if hash.to_lowercase() != expected_sha256.to_lowercase() {
        let _ = fs::remove_file(&temp_target);
        return Err(format!(
            "Verifica SHA-256 fallita: calcolato {} vs atteso {}",
            hash, expected_sha256
        ));
    }

    if target.exists() {
        let _ = fs::remove_file(target);
    }
    fs::rename(&temp_target, target).or_else(|_| {
        fs::copy(&temp_target, target).map(|_| ())?;
        let _ = fs::remove_file(&temp_target);
        Ok::<(), std::io::Error>(())
    }).map_err(|e| e.to_string())?;

    let dest_meta = fs::metadata(target).map_err(|e| e.to_string())?;
    let dest_mtime_ms = dest_meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let target_str = target.to_string_lossy().to_string();

    save_model_cache(cache_file, &ModelVerificationCache {
        path: target_str.clone(),
        bytes,
        mtime_ms: dest_mtime_ms,
        sha256: hash,
        sha256_ok: true,
        verified_at: chrono::Utc::now().to_rfc3339(),
    })?;

    let elapsed = t0.elapsed().as_millis() as u64;
    log_local_model_timing("FILE_SELECTION", elapsed, &format!("path={}, bytes={}", target_str, bytes));

    Ok(LocalModelReport {
        installed: true,
        path: target_str,
        bytes,
        sha256_ok: true,
    })
}

pub fn local_model_status() -> LocalModelReport {
    local_model_status_with_recheck(false)
}

pub fn local_model_status_with_recheck(force_recheck: bool) -> LocalModelReport {
    let target = match get_target_model_path() {
        Ok(p) => p,
        Err(_) => {
            return LocalModelReport {
                installed: false,
                path: "".into(),
                bytes: 0,
                sha256_ok: false,
            };
        }
    };
    let cache_file = match get_model_cache_meta_path() {
        Ok(p) => p,
        Err(_) => return model_status_for_paths(&target, Path::new(""), EXPECTED_MODEL_SIZE_BYTES, EXPECTED_MODEL_SHA256, force_recheck),
    };
    model_status_for_paths(&target, &cache_file, EXPECTED_MODEL_SIZE_BYTES, EXPECTED_MODEL_SHA256, force_recheck)
}

pub fn install_model_from_file(source_path: &Path) -> Result<LocalModelReport, String> {
    let target = get_target_model_path()?;
    let cache_file = get_model_cache_meta_path()?;
    install_model_for_paths(source_path, &target, &cache_file, EXPECTED_MODEL_SIZE_BYTES, EXPECTED_MODEL_SHA256)
}

pub async fn download_model_with_progress<F>(on_progress: F) -> Result<LocalModelReport, String>
where
    F: Fn(u64, u64, f64) + Send + 'static,
{
    let target = get_target_model_path()?;
    let temp_target = target.with_extension("downloading");
    let _ = fs::remove_file(&temp_target);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(1800))
        .build()
        .map_err(|e| e.to_string())?;

    let mut resp = client
        .get(MODEL_DOWNLOAD_URL)
        .send()
        .await
        .map_err(|e| format!("Richiesta download fallita: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download fallito con stato HTTP: {}", resp.status()));
    }

    let total_bytes = resp
        .content_length()
        .unwrap_or(EXPECTED_MODEL_SIZE_BYTES);

    let mut out = fs::File::create(&temp_target).map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let mut hasher = Sha256::new();
    let mut last_emit = Instant::now();

    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("Errore lettura chunk: {}", e))? {
        out.write_all(&chunk).map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        downloaded += chunk.len() as u64;

        if last_emit.elapsed() >= Duration::from_millis(200) || (total_bytes > 0 && downloaded == total_bytes) {
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
    if final_hash.to_lowercase() != EXPECTED_MODEL_SHA256.to_lowercase() {
        let _ = fs::remove_file(&temp_target);
        return Err(format!(
            "Verifica SHA-256 fallita sul file scaricato: calcolato {} vs atteso {}",
            final_hash, EXPECTED_MODEL_SHA256
        ));
    }

    fs::rename(&temp_target, &target).map_err(|e| e.to_string())?;

    let dest_meta = fs::metadata(&target).map_err(|e| e.to_string())?;
    let dest_mtime_ms = dest_meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let target_str = target.to_string_lossy().to_string();

    if let Ok(cache_file) = get_model_cache_meta_path() {
        let _ = save_model_cache(&cache_file, &ModelVerificationCache {
            path: target_str.clone(),
            bytes: dest_meta.len(),
            mtime_ms: dest_mtime_ms,
            sha256: final_hash,
            sha256_ok: true,
            verified_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    Ok(LocalModelReport {
        installed: true,
        path: target_str,
        bytes: dest_meta.len(),
        sha256_ok: true,
    })
}

#[cfg(windows)]
pub fn get_process_exe_path(pid: u32) -> Option<PathBuf> {
    use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows_sys::Win32::Foundation::CloseHandle;
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle != 0 as _ {
            let mut buf = [0u16; 1024];
            let mut size = buf.len() as u32;
            let success = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
            CloseHandle(handle);
            if success != 0 && size > 0 {
                use std::os::windows::ffi::OsStringExt;
                let os_str = std::ffi::OsString::from_wide(&buf[..size as usize]);
                let p = PathBuf::from(os_str);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }

    // Fallback con PowerShell
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut cmd = std::process::Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", &format!("(Get-Process -Id {} -ErrorAction SilentlyContinue).Path", pid)])
        .creation_flags(CREATE_NO_WINDOW);
    if let Some(out) = run_command_with_timeout(cmd, Duration::from_secs(2)) {
        let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !path_str.is_empty() {
            let p = PathBuf::from(path_str);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

#[cfg(unix)]
pub fn get_process_exe_path(pid: u32) -> Option<PathBuf> {
    if let Ok(p) = fs::read_link(format!("/proc/{}/exe", pid)) {
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

pub fn detect_llama_server_binary() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("LLAMA_SERVER_PATH") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
        return None;
    }

    let names = if cfg!(windows) {
        vec!["llama-server.exe", "llama-server"]
    } else {
        vec!["llama-server"]
    };

    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            for name in &names {
                let candidate = parent.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
                let native_candidate = parent.join(format!("native/{}", name));
                if native_candidate.is_file() {
                    return Some(native_candidate);
                }
                let resources_candidate = parent.join(format!("Resources/native/{}", name));
                if resources_candidate.is_file() {
                    return Some(resources_candidate);
                }
            }
        }
    }

    let cand_dev = [
        "apps/desktop/src-tauri/resources/native/llama-server.exe",
        "apps/desktop/src-tauri/resources/native/llama-server",
        "resources/native/llama-server.exe",
        "resources/native/llama-server",
    ];
    for c in &cand_dev {
        let pb = PathBuf::from(c);
        if pb.is_file() {
            return Some(pb);
        }
    }

    None
}

// ---------------------------------------------------------------------------------------------
// Processi orfani. Il figlio llama-server vive in un proprio process group: se l'app viene uccisa
// (kill -9, crash) il figlio non riceve nulla, passa a launchd (ppid 1) e resta in memoria con il
// modello caricato (caso reale del 20/09/2026: pid 21212 attivo per 3 ore dopo la fine dell'app).
// L'app registra il pid del figlio in un file accanto al modello e, all'avvio e prima di ogni nuovo
// avvio del servizio, termina SOLO un server registrato che risulti orfano: mai un server con
// genitore vivo (altra istanza dell'app) e mai un processo diverso che abbia riusato il pid.
// ---------------------------------------------------------------------------------------------

/// File con il pid dell'ultimo llama-server avviato da questa app.
pub fn pid_file_path() -> Option<PathBuf> {
    get_models_dir().ok().map(|d| d.join("llama-server.pid"))
}

/// File con la porta dell'ultimo llama-server avviato da questa app.
pub fn port_file_path() -> Option<PathBuf> {
    get_models_dir().ok().map(|d| d.join("llama-server.port"))
}

pub fn write_pid_file(path: &Path, pid: u32) {
    let _ = fs::write(path, pid.to_string());
}

pub fn read_pid_file(path: &Path) -> Option<u32> {
    fs::read_to_string(path).ok()?.trim().parse::<u32>().ok()
}

pub fn write_port_file(path: &Path, port: u16) {
    let _ = fs::write(path, port.to_string());
}

pub fn read_port_file(path: &Path) -> Option<u16> {
    fs::read_to_string(path).ok()?.trim().parse::<u16>().ok()
}

/// Timeout massimo vincolante per ciascun singolo comando esterno di scoperta/ispezione (PowerShell, pgrep, lsof).
/// Evita qualsiasi hang indefinito su chiamate a processi di sistema operativo.
pub const DISCOVERY_COMMAND_TIMEOUT: Duration = Duration::from_millis(2000);

pub fn discovery_command_timeout() -> Duration {
    if let Ok(val) = std::env::var("LIMEN_DISCOVERY_COMMAND_TIMEOUT_MS") {
        if let Ok(ms) = val.trim().parse::<u64>() {
            return Duration::from_millis(ms);
        }
    }
    DISCOVERY_COMMAND_TIMEOUT
}

/// Timeout massimo complessivo per la fase di preparazione del servizio locale durante ai_preview (scoperta, adozione, eventuale avvio).
/// Se il servizio non è pronto entro questo limite, la preparazione ripiega immediatamente e in modo trasparente
/// sulla ricerca per sole parole chiave, indicando la causa in ask_timing.log e nell'interfaccia utente.
pub const SERVICE_PREPARATION_TIMEOUT: Duration = Duration::from_secs(5);

pub fn service_preparation_timeout() -> Duration {
    if let Ok(val) = std::env::var("LIMEN_SERVICE_PREP_TIMEOUT_MS") {
        if let Ok(ms) = val.trim().parse::<u64>() {
            return Duration::from_millis(ms);
        }
    }
    SERVICE_PREPARATION_TIMEOUT
}

/// Esegue un comando esterno con limite di tempo garantito, terminando il processo in caso di scadenza.
pub fn run_command_with_timeout(
    mut cmd: std::process::Command,
    timeout: Duration,
) -> Option<std::process::Output> {
    let mut child = cmd
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .ok()?;

    let t_start = Instant::now();
    let poll_interval = Duration::from_millis(30);
    while t_start.elapsed() < timeout {
        match child.try_wait() {
            Ok(Some(_status)) => {
                return child.wait_with_output().ok();
            }
            Ok(None) => {
                std::thread::sleep(poll_interval);
            }
            Err(_) => {
                let _ = child.kill();
                return None;
            }
        }
    }

    // Timeout scaduto: termina forzatamente il processo
    let _ = child.kill();
    #[cfg(windows)]
    {
        let pid = child.id();
        unsafe {
            let handle = windows_sys::Win32::System::Threading::OpenProcess(
                windows_sys::Win32::System::Threading::PROCESS_TERMINATE,
                0,
                pid,
            );
            if !handle.is_null() {
                windows_sys::Win32::System::Threading::TerminateProcess(handle, 1);
                windows_sys::Win32::Foundation::CloseHandle(handle);
            }
        }
    }
    let _ = child.try_wait();
    None
}

/// Verifica se un processo con il PID specificato è attualmente vivo nel sistema operativo.
pub fn is_process_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", &format!("Get-Process -Id {} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id", pid)])
            .creation_flags(CREATE_NO_WINDOW);
        if let Some(o) = run_command_with_timeout(cmd, discovery_command_timeout()) {
            let s = String::from_utf8_lossy(&o.stdout);
            s.trim().parse::<u32>().ok() == Some(pid)
        } else {
            false
        }
    }
    #[cfg(unix)]
    {
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
}

/// Scrittura consistente della coppia (llama-server.pid e llama-server.port).
/// Se esiste già una registrazione per un PID attivo e sano (healthy), NON sovrascrive.
pub fn write_service_registration(pid: u32, port: u16) -> Result<(), String> {
    let pid_path = pid_file_path().ok_or("Impossibile determinare il percorso di llama-server.pid")?;
    let port_path = port_file_path().ok_or("Impossibile determinare il percorso di llama-server.port")?;
    write_service_registration_to_paths(&pid_path, &port_path, pid, port)
}

/// Scrittura consistente atomica su percorsi espliciti con protezione da sovrascrittura di istanze attive.
pub fn write_service_registration_to_paths(
    pid_path: &Path,
    port_path: &Path,
    pid: u32,
    port: u16,
) -> Result<(), String> {
    if let Some(existing_pid) = read_pid_file(pid_path) {
        if existing_pid != pid && is_process_alive(existing_pid) {
            let existing_port = read_port_file(port_path).unwrap_or(0);
            if existing_port > 0 && check_health(existing_port) {
                return Err(format!(
                    "Registrazione non sovrascritta: appartiene a un'altra istanza attiva (PID {}, porta {})",
                    existing_pid, existing_port
                ));
            }
        }
    }

    let dir = pid_path.parent().ok_or("Parent directory assente")?;
    let _ = fs::create_dir_all(dir);
    let pid_tmp = dir.join(format!("llama-server.pid.tmp.{}", pid));
    let port_tmp = dir.join(format!("llama-server.port.tmp.{}", pid));

    fs::write(&pid_tmp, pid.to_string()).map_err(|e| e.to_string())?;
    fs::write(&port_tmp, port.to_string()).map_err(|e| e.to_string())?;

    let _ = fs::rename(&pid_tmp, pid_path);
    let _ = fs::rename(&port_tmp, port_path);

    Ok(())
}

/// Rimuove la registrazione (llama-server.pid e llama-server.port) SOLO se appartiene al PID specificato.
/// Se il file contiene un PID diverso o appartiene ad altra istanza attiva, NON cancella.
pub fn remove_service_registration_if_owned(owned_pid: u32) {
    if let (Some(pid_path), Some(port_path)) = (pid_file_path(), port_file_path()) {
        remove_service_registration_from_paths_if_owned(&pid_path, &port_path, owned_pid);
    }
}

/// Rimuove la registrazione su percorsi espliciti SOLO se appartiene al PID specificato.
pub fn remove_service_registration_from_paths_if_owned(
    pid_path: &Path,
    port_path: &Path,
    owned_pid: u32,
) {
    if owned_pid == 0 {
        return;
    }
    if let Some(current_pid) = read_pid_file(pid_path) {
        if current_pid == owned_pid {
            let _ = fs::remove_file(pid_path);
            let _ = fs::remove_file(port_path);
        }
    }
}

/// Trova la porta TCP su cui un dato PID è in ascolto.
pub fn find_port_for_pid(pid: u32) -> Option<u16> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", &format!("Get-NetTCPConnection -OwningProcess {} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort", pid)])
            .creation_flags(CREATE_NO_WINDOW);
        let out = run_command_with_timeout(cmd, discovery_command_timeout())?;
        let text = String::from_utf8_lossy(&out.stdout);
        text.lines().find_map(|l| l.trim().parse::<u16>().ok())
    }
    #[cfg(unix)]
    {
        let mut cmd = std::process::Command::new("lsof");
        cmd.args(["-Pan", "-p", &pid.to_string(), "-iTCP", "-sTCP:LISTEN"]);
        let out = run_command_with_timeout(cmd, discovery_command_timeout())?;
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if let Some(idx) = line.rfind(':') {
                let rest = &line[idx + 1..];
                if let Some(port_str) = rest.split_whitespace().next() {
                    if let Ok(port) = port_str.parse::<u16>() {
                        return Some(port);
                    }
                }
            }
        }
        None
    }
}

/// Rileva la porta del servizio llama-server attivo verificando modello (bge-m3) e dimensioni (1024).
/// Rileva la porta e il PID del servizio llama-server attivo verificando modello (bge-m3) e dimensioni (1024).
/// Cerca nell'ordine:
/// 1. Variabile d'ambiente LIMEN_LOCAL_PORT
/// 2. File llama-server.port e llama-server.pid
/// 3. File llama-server.pid (interrogando la porta del PID)
/// 4. Processi llama-server attivi sul sistema
pub fn find_active_bge_m3_service_with_pid() -> Result<(u16, Option<u32>), String> {
    if std::env::var("LIMEN_TEST_DISABLE_ADOPTION").is_ok() {
        return Err("Adozione disabilitata per il test".into());
    }

    // 1. Variabile d'ambiente
    if let Ok(env_val) = std::env::var("LIMEN_LOCAL_PORT") {
        if let Ok(env_port) = env_val.trim().parse::<u16>() {
            if check_health(env_port) && verify_dimensions(env_port).is_ok() {
                let pid = pid_file_path().and_then(|p| read_pid_file(&p));
                return Ok((env_port, pid));
            } else {
                return Err(format!("Porta configurata in LIMEN_LOCAL_PORT ({}) non pronta o non valida", env_port));
            }
        }
    }

    // 2. File llama-server.port e llama-server.pid
    if let Some(p_path) = port_file_path() {
        if let Some(port) = read_port_file(&p_path) {
            if check_health(port) && verify_dimensions(port).is_ok() {
                let pid = pid_file_path().and_then(|p| read_pid_file(&p));
                return Ok((port, pid));
            }
        }
    }

    // 3. File llama-server.pid
    if let Some(p_path) = pid_file_path() {
        if let Some(pid) = read_pid_file(&p_path) {
            if let Some(port) = find_port_for_pid(pid) {
                if check_health(port) && verify_dimensions(port).is_ok() {
                    return Ok((port, Some(pid)));
                }
            }
        }
    }

    // 4. Processi llama-server attivi sul sistema
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", "Get-Process -Name 'llama-server' -ErrorAction SilentlyContinue | ForEach-Object { $p = $_.Id; Get-NetTCPConnection -OwningProcess $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { [string]$p + ':' + [string]$_.LocalPort } }"])
            .creation_flags(CREATE_NO_WINDOW);
        let out = run_command_with_timeout(cmd, discovery_command_timeout());
        if let Some(o) = out {
            let text = String::from_utf8_lossy(&o.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.trim().split(':').collect();
                if parts.len() == 2 {
                    if let (Ok(pid), Ok(port)) = (parts[0].parse::<u32>(), parts[1].parse::<u16>()) {
                        if check_health(port) && verify_dimensions(port).is_ok() {
                            return Ok((port, Some(pid)));
                        }
                    }
                }
            }
        }
    }
    #[cfg(unix)]
    {
        let mut cmd = std::process::Command::new("pgrep");
        cmd.arg("llama-server");
        let out = run_command_with_timeout(cmd, discovery_command_timeout());
        if let Some(o) = out {
            let text = String::from_utf8_lossy(&o.stdout);
            for line in text.lines() {
                if let Ok(pid) = line.trim().parse::<u32>() {
                    if let Some(port) = find_port_for_pid(pid) {
                        if check_health(port) && verify_dimensions(port).is_ok() {
                            return Ok((port, Some(pid)));
                        }
                    }
                }
            }
        }
    }

    Err("Nessun servizio locale llama-server con modello bge-m3 (1024d) trovato attivo.".to_string())
}

pub fn find_active_bge_m3_service() -> Result<u16, String> {
    find_active_bge_m3_service_with_pid().map(|(port, _)| port)
}


/// Decisione pura: orfano = genitore launchd (ppid 1) e riga di comando di un llama-server in modalita' embedding.
pub fn is_orphan_llama_server(ppid: i32, command: &str) -> bool {
    ppid == 1 && command.contains("llama-server") && command.contains("--embedding")
}

/// (ppid, riga di comando) del processo, oppure None se non esiste.
fn process_parent_and_command(pid: u32) -> Option<(i32, String)> {
    #[cfg(unix)]
    {
        let mut cmd = Command::new("/bin/ps");
        cmd.args(["-o", "ppid=,command=", "-p", &pid.to_string()]);
        let out = run_command_with_timeout(cmd, discovery_command_timeout())?;
        if !out.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&out.stdout);
        let line = text.lines().find(|l| !l.trim().is_empty())?;
        let mut parts = line.trim().splitn(2, char::is_whitespace);
        let ppid = parts.next()?.trim().parse::<i32>().ok()?;
        let command = parts.next().unwrap_or("").trim().to_string();
        Some((ppid, command))
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", &format!("Get-CimInstance Win32_Process -Filter 'ProcessId = {}' | Select-Object -ExpandProperty ParentProcessId", pid)])
            .creation_flags(CREATE_NO_WINDOW);
        let out = run_command_with_timeout(cmd, discovery_command_timeout())?;
        if !out.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&out.stdout);
        let ppid = text.trim().parse::<i32>().ok()?;
        Some((ppid, format!("llama-server --embedding pid {}", pid)))
    }
}

pub fn reap_orphan_server() -> Option<u32> {
    let path = pid_file_path()?;
    let pid = read_pid_file(&path)?;
    let Some((ppid, command)) = process_parent_and_command(pid) else {
        let _ = fs::remove_file(&path);
        return None;
    };
    if !is_orphan_llama_server(ppid, &command) {
        return None;
    }
    #[cfg(unix)]
    unsafe {
        libc::kill(pid as i32, libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(50));
        if process_parent_and_command(pid).is_none() {
            break;
        }
    }
    #[cfg(unix)]
    unsafe {
        if process_parent_and_command(pid).is_some() {
            libc::kill(pid as i32, libc::SIGKILL);
        }
    }
    let _ = fs::remove_file(&path);
    eprintln!("[llama] llama-server orfano (pid {}) terminato", pid);
    Some(pid)
}

pub fn find_free_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Impossibile trovare una porta libera su 127.0.0.1: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    drop(listener);
    Ok(port)
}

pub fn check_health(port: u16) -> bool {
    if port == 0 {
        return false;
    }
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpStream};
    let addr: SocketAddr = match format!("127.0.0.1:{}", port).parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(400)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    let req = format!(
        "GET /health HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        port
    );
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut resp = [0u8; 512];
    match stream.read(&mut resp) {
        Ok(n) if n > 0 => {
            let s = String::from_utf8_lossy(&resp[..n]);
            s.starts_with("HTTP/1.1 200")
                || s.starts_with("HTTP/1.0 200")
                || s.contains("\"ok\"")
                || s.contains("status\":\"ok")
        }
        _ => false,
    }
}

pub fn verify_dimensions(port: u16) -> Result<(), String> {
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpStream};
    let addr: SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| format!("Impossibile connettersi a 127.0.0.1:{}: {}", port, e))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;

    let body = r#"{"input":"test","model":"bge-m3"}"#;
    let req = format!(
        "POST /v1/embeddings HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        port,
        body.len(),
        body
    );
    stream
        .write_all(req.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut response_bytes = Vec::new();
    stream
        .read_to_end(&mut response_bytes)
        .map_err(|e| e.to_string())?;
    let response_str = String::from_utf8_lossy(&response_bytes);

    if !response_str.starts_with("HTTP/1.1 200") && !response_str.starts_with("HTTP/1.0 200") {
        return Err(format!(
            "Status HTTP non 200 durante la verifica embeddings: {}",
            response_str.lines().next().unwrap_or("")
        ));
    }

    let body_part = if let Some(idx) = response_str.find("\r\n\r\n") {
        &response_str[idx + 4..]
    } else {
        &response_str
    };

    let json_slice = if let (Some(first_brace), Some(last_brace)) = (body_part.find('{'), body_part.rfind('}')) {
        if first_brace <= last_brace {
            &body_part[first_brace..=last_brace]
        } else {
            body_part
        }
    } else {
        body_part
    };

    let val: serde_json::Value = serde_json::from_str(json_slice).map_err(|e| {
        format!(
            "Risposta JSON non valida: {} (corpo: {})",
            e,
            json_slice.chars().take(200).collect::<String>()
        )
    })?;

    let dim = val
        .get("data")
        .and_then(|d| d.get(0))
        .and_then(|i| i.get("embedding"))
        .and_then(|e| e.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    if dim != EXPECTED_EMBEDDINGS_DIMENSIONS {
        return Err(format!(
            "Dimensioni vettore errate: attese {} componenti, ricevute {}",
            EXPECTED_EMBEDDINGS_DIMENSIONS, dim
        ));
    }

    Ok(())
}

pub struct StartingGuard(pub LlamaServerState, pub Option<u64>);

impl Drop for StartingGuard {
    fn drop(&mut self) {
        if let Some(token) = self.1 {
            let mut s = self.0.0.lock().unwrap_or_else(|e| e.into_inner());
            if s.start_owner == Some(token) {
                s.starting = false;
                s.start_owner = None;
            }
        }
    }
}

impl LlamaServerState {
    pub fn get_port(&self) -> u16 {
        let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.port
    }

    pub fn status(&self) -> LocalServerReport {
        // Estrae lo stato rilasciando IMMEDIATAMENTE il mutex: non tiene il lock durante check_health di rete
        let (port, has_child, pid, last_error, is_starting) = {
            let mut s = match self.0.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };

            if let Some(c) = s.child.as_mut() {
                if let Ok(Some(exit_status)) = c.try_wait() {
                    s.child = None;
                    s.last_error = Some(format!("llama-server terminato con stato: {}", exit_status));
                }
            }

            let pid = s.child.as_ref().map(|c| c.id()).or(s.adopted_pid);
            (s.port, s.child.is_some(), pid, s.last_error.clone(), s.starting)
        };

        // check_health viene eseguito FUORI DAL MUTEX
        let healthy = port > 0 && check_health(port);
        let running = has_child || healthy;

        LocalServerReport {
            running,
            port,
            pid,
            model: "bge-m3-Q8_0.gguf".to_string(),
            healthy,
            last_error,
            starting: is_starting,
        }
    }

    pub fn adopt_service(&self, port: u16, pid: Option<u32>) {
        let real_exe = pid.and_then(get_process_exe_path);
        let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.port = port;
        s.adopted_pid = pid;
        s.owned_pid = None;
        s.binary_path = real_exe;
        s.starting = false;
        s.start_owner = None;
        s.auto_start_failed = false;
        s.auto_start_failure_reason = None;
        s.last_error = None;
    }

    pub fn get_binary_path(&self) -> Option<PathBuf> {
        let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if s.binary_path.is_some() {
            return s.binary_path.clone();
        }
        if let Some(pid) = s.child.as_ref().map(|c| c.id()).or(s.adopted_pid) {
            return get_process_exe_path(pid);
        }
        None
    }

    pub fn reset_auto_start_failure(&self) {
        let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.auto_start_failed = false;
        s.auto_start_failure_reason = None;
    }

    pub fn is_auto_start_failed(&self) -> bool {
        let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.auto_start_failed
    }

    pub fn is_starting(&self) -> bool {
        let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.starting
    }

    pub fn service_state(&self) -> &'static str {
        let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if s.port > 0 && check_health(s.port) {
            if s.adopted_pid.is_some() {
                "esterno adottato"
            } else {
                "pronto"
            }
        } else if s.auto_start_failed {
            "fallito"
        } else if s.starting || (s.child.is_some() && s.port > 0) {
            "in avvio"
        } else {
            "non avviato"
        }
    }

    pub fn trigger_background_start(&self) -> bool {
        self.trigger_background_start_with_binary(None)
    }

    pub fn trigger_background_start_with_binary(&self, custom_binary: Option<PathBuf>) -> bool {
        let (already_port, already_starting, already_failed) = {
            let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            (s.port, s.starting, s.auto_start_failed)
        };
        if already_starting || already_failed {
            return false;
        }
        // check_health eseguito FUORI DAL BLOCCO MUTEX (Difetto minore Fase 5g)
        if already_port > 0 && check_health(already_port) {
            return false;
        }

        let token = next_start_token();
        {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            if s.starting || s.auto_start_failed {
                return false;
            }
            s.starting = true;
            s.start_owner = Some(token);
            s.last_error = None;
        }

        let state = self.clone();
        std::thread::spawn(move || {
            let mut bg_guard = StartingGuard(state.clone(), Some(token));
            let t0 = Instant::now();
            log_local_model_timing_meta(
                "BACKGROUND_START_BEGIN",
                0,
                None,
                None,
                None,
                "Avvio del servizio locale in background richiesto all'apertura",
            );

            // 1. Prima controlla se c'è un servizio esterno attivo bge-m3
            if let Ok((port, pid)) = find_active_bge_m3_service_with_pid() {
                state.adopt_service(port, pid);
                bg_guard.1 = None; // Disarma la guardia, adopt_service azzera starting e start_owner
                let elapsed = t0.elapsed().as_millis() as u64;
                let real_exe = pid.and_then(get_process_exe_path);
                log_local_model_timing_meta(
                    "BACKGROUND_ADOPT_SUCCESS",
                    elapsed,
                    real_exe.as_deref(),
                    pid,
                    Some(port),
                    &format!("port={}, pid={:?}", port, pid),
                );
                return;
            }

            // 2. Altrimenti avvia il proprio servizio mantenendo l'attesa di /health a 25 s
            // Passiamo il token di proprietà: start_internal riconosce che siamo noi i proprietari dell'avvio!
            bg_guard.1 = None;
            let detected_bin = custom_binary.clone().or_else(detect_llama_server_binary);
            match state.start_internal_with_token_and_binary(Duration::from_secs(25), Some(token), custom_binary.as_deref()) {
                Ok(rep) if rep.healthy => {
                    let elapsed = t0.elapsed().as_millis() as u64;
                    log_local_model_timing_meta(
                        "BACKGROUND_START_SUCCESS",
                        elapsed,
                        detected_bin.as_deref(),
                        rep.pid,
                        Some(rep.port),
                        &format!("port={}, pid={:?}", rep.port, rep.pid),
                    );
                }
                Ok(rep) => {
                    let mut s = state.0.lock().unwrap_or_else(|e| e.into_inner());
                    s.starting = false;
                    s.start_owner = None;
                    s.auto_start_failed = true;
                    s.auto_start_failure_reason = rep.last_error.clone();
                    let elapsed = t0.elapsed().as_millis() as u64;
                    log_local_model_timing_meta(
                        "BACKGROUND_START_FAILED",
                        elapsed,
                        detected_bin.as_deref(),
                        rep.pid,
                        Some(rep.port),
                        &format!("non pronto su porta {}: {:?}", rep.port, rep.last_error),
                    );
                }
                Err(err) => {
                    let mut s = state.0.lock().unwrap_or_else(|e| e.into_inner());
                    s.starting = false;
                    s.start_owner = None;
                    s.auto_start_failed = true;
                    s.auto_start_failure_reason = Some(err.clone());
                    let elapsed = t0.elapsed().as_millis() as u64;
                    log_local_model_timing_meta(
                        "BACKGROUND_START_FAILED",
                        elapsed,
                        None,
                        None,
                        None,
                        &format!("errore: {}", err),
                    );
                }
            }
        });
        true
    }

    pub fn on_app_startup(&self) {
        let model_rep = local_model_status();
        if !model_rep.installed || !model_rep.sha256_ok {
            return;
        }
        if !crate::ai::is_local_provider_configured() {
            return;
        }
        self.trigger_background_start();
    }

    pub fn get_or_adopt_or_start_service(&self) -> (Option<u16>, Option<u32>, bool, String, Option<String>) {
        let timeout = service_preparation_timeout();
        self.get_or_adopt_or_start_service_with_timeout(timeout)
    }

    pub fn get_or_adopt_or_start_service_with_timeout(
        &self,
        timeout: Duration,
    ) -> (Option<u16>, Option<u32>, bool, String, Option<String>) {
        let t_start = Instant::now();

        // 1. Servizio già attivo e pronto nell'istanza corrente
        let s = self.status();
        if s.healthy && s.port > 0 {
            let state_str = if self.0.lock().unwrap_or_else(|e| e.into_inner()).adopted_pid.is_some() {
                "esterno adottato"
            } else {
                "pronto"
            };
            return (Some(s.port), s.pid, true, state_str.to_string(), None);
        }

        // Se avevamo registrato un servizio adottato ma ora non risponde più, azzeriamo l'adozione stantia (C06)
        {
            let mut guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
            if guard.adopted_pid.is_some() && (!s.healthy || s.port == 0) {
                guard.adopted_pid = None;
                guard.port = 0;
            }
        }

        // 2. Controllo se l'avvio è già fallito per un guasto vero nella sessione (Regola 3)
        let (auto_start_failed, prev_reason, is_already_starting) = {
            let guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
            (guard.auto_start_failed, guard.auto_start_failure_reason.clone(), guard.starting)
        };
        if auto_start_failed {
            let reason = format!(
                "Avvio automatico del servizio locale fallito ({}): ripiego sulla ricerca per parole. Per riprovare, premi AVVIA SERVIZIO LOCALE.",
                prev_reason.unwrap_or_else(|| "errore precedente".to_string())
            );
            return (None, None, false, "fallito".to_string(), Some(reason));
        }

        // 3. Scoperta servizio esterno (se il nostro servizio non è già in avvio)
        if !is_already_starting {
            let discover_res = find_active_bge_m3_service_with_pid();
            if let Ok((port, pid)) = discover_res {
                self.adopt_service(port, pid);
                let real_exe = pid.and_then(get_process_exe_path);
                log_local_model_timing_meta(
                    "EXTERNAL_SERVICE_ADOPTED",
                    t_start.elapsed().as_millis() as u64,
                    real_exe.as_deref(),
                    pid,
                    Some(port),
                    &format!("port={}, pid={:?}", port, pid),
                );
                return (Some(port), pid, true, "esterno adottato".to_string(), None);
            }
        }

        // 4. Se il servizio non è già in avvio, avvia in background (senza bloccare la sessione)
        if !is_already_starting {
            let model_rep = local_model_status();
            if !model_rep.installed || !model_rep.sha256_ok {
                let mut guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
                guard.auto_start_failed = true;
                let err = "Modello locale bge-m3 non installato o non integro".to_string();
                guard.auto_start_failure_reason = Some(err.clone());
                return (
                    None,
                    None,
                    false,
                    "fallito".to_string(),
                    Some(format!("{}: ripiego sulla ricerca per parole.", err)),
                );
            }
            if detect_llama_server_binary().is_none() {
                let mut guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
                guard.auto_start_failed = true;
                let err = "Binario llama-server non trovato".to_string();
                guard.auto_start_failure_reason = Some(err.clone());
                return (
                    None,
                    None,
                    false,
                    "fallito".to_string(),
                    Some(format!("{}: ripiego sulla ricerca per parole.", err)),
                );
            }

            self.trigger_background_start();
        }

        // 5. Attesa attiva di salute fino al tempo limite di preparazione della domanda
        let deadline = t_start + timeout;
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(50));
            let (port, pid, failed, fail_reason, adopted) = {
                let guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
                let pid = guard.child.as_ref().map(|c| c.id()).or(guard.adopted_pid);
                (guard.port, pid, guard.auto_start_failed, guard.auto_start_failure_reason.clone(), guard.adopted_pid.is_some())
            };

            let healthy = port > 0 && check_health(port);
            if healthy {
                let st = if adopted { "esterno adottato" } else { "pronto" };
                return (Some(port), pid, true, st.to_string(), None);
            }
            if failed {
                let reason = format!(
                    "Avvio servizio locale fallito ({}): ripiego sulla ricerca per parole.",
                    fail_reason.unwrap_or_else(|| "errore durante l'avvio".to_string())
                );
                return (None, None, false, "fallito".to_string(), Some(reason));
            }
        }

        // 6. Timeout di preparazione della domanda scaduto (Regola 2):
        // NON chiude il servizio in avvio! L'avvio prosegue in background.
        // Questa domanda ripiega sulla ricerca per parole con motivo visibile.
        (
            None,
            None,
            false,
            "in avvio".to_string(),
            Some("Servizio locale in avvio: ripiego temporaneo sulla ricerca per parole per questa domanda.".to_string()),
        )
    }

    pub fn start(&self) -> Result<LocalServerReport, String> {
        self.reset_auto_start_failure();
        self.start_internal_with_token_and_binary(Duration::from_secs(25), None, None)
    }

    pub fn start_with_timeout(&self, timeout: Duration) -> Result<LocalServerReport, String> {
        self.start_internal_with_token_and_binary(timeout, None, None)
    }

    pub fn start_with_custom_binary(&self, binary: &Path, timeout: Duration) -> Result<LocalServerReport, String> {
        self.start_internal_with_token_and_binary(timeout, None, Some(binary))
    }

    pub fn start_internal(&self, timeout: Duration) -> Result<LocalServerReport, String> {
        self.start_internal_with_token_and_binary(timeout, None, None)
    }

    pub fn start_internal_with_token(
        &self,
        timeout: Duration,
        caller_token: Option<u64>,
    ) -> Result<LocalServerReport, String> {
        self.start_internal_with_token_and_binary(timeout, caller_token, None)
    }

    pub fn start_internal_with_token_and_binary(
        &self,
        timeout: Duration,
        caller_token: Option<u64>,
        custom_binary: Option<&Path>,
    ) -> Result<LocalServerReport, String> {
        let t_start = Instant::now();

        // 0. Controllo concorrenza e proprietà dell'avvio (N1):
        // Se un avvio è già in corso e caller_token NON corrisponde al proprietario attivo,
        // NON avviare un secondo processo: attendi invece il completamento dell'avvio già attivo.
        let active_token = {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            if s.starting {
                if caller_token.is_some() && s.start_owner == caller_token {
                    // Questo chiamante è il proprietario dell'avvio: procede direttamente!
                    caller_token.unwrap()
                } else {
                    // Un altro thread possiede l'avvio: attendiamo il suo completamento
                    drop(s);
                    let deadline = t_start + timeout;
                    while Instant::now() < deadline {
                        std::thread::sleep(Duration::from_millis(50));
                        let (port, starting, failed, fail_reason) = {
                            let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                            (s.port, s.starting, s.auto_start_failed, s.auto_start_failure_reason.clone())
                        };
                        if port > 0 && check_health(port) {
                            return Ok(self.status());
                        }
                        if !starting {
                            if port > 0 && check_health(port) {
                                return Ok(self.status());
                            }
                            if failed {
                                return Err(fail_reason.unwrap_or_else(|| "Avvio del servizio locale fallito".to_string()));
                            }
                            break;
                        }
                    }
                    let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                    if s.starting {
                        return Err(format!("Timeout attesa avvio del servizio in corso ({:.1}s).", timeout.as_secs_f32()));
                    }
                    if s.port > 0 && check_health(s.port) {
                        return Ok(self.status());
                    }
                    let tok = next_start_token();
                    let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                    s.starting = true;
                    s.start_owner = Some(tok);
                    tok
                }
            } else {
                let tok = caller_token.unwrap_or_else(next_start_token);
                s.starting = true;
                s.start_owner = Some(tok);
                tok
            }
        };

        let mut starting_guard = StartingGuard(self.clone(), Some(active_token));

        // 1. Verify model is installed
        let model_rep = local_model_status();
        if !model_rep.installed || !model_rep.sha256_ok {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            s.starting = false;
            s.start_owner = None;
            s.auto_start_failed = true;
            let err = "Modello locale bge-m3-Q8_0.gguf non installato o non integro. Esegui il download dalle impostazioni.".to_string();
            s.auto_start_failure_reason = Some(err.clone());
            return Err(err);
        }
        let model_path = PathBuf::from(model_rep.path);

        // 2. Check if already healthy (verifica di rete eseguita FUORI dal mutex)
        let already_port = {
            let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            s.port
        };
        if already_port > 0 && check_health(already_port) {
            {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                s.start_owner = None;
            }
            return Ok(self.status());
        }

        // 2b. Un server orfano di un'istanza precedente (app uccisa) va terminato prima di avviarne un altro
        let _ = reap_orphan_server();

        // 3. Find standalone or system binary
        let binary = match custom_binary.map(PathBuf::from).or_else(detect_llama_server_binary) {
            Some(b) => b,
            None => {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                s.start_owner = None;
                s.auto_start_failed = true;
                let err = "Binario llama-server non disponibile nel pacchetto o nel sistema.".to_string();
                s.auto_start_failure_reason = Some(err.clone());
                return Err(err);
            }
        };

        // 4. Choose free port
        let free_port = match find_free_port() {
            Ok(p) => p,
            Err(e) => {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                s.start_owner = None;
                s.auto_start_failed = true;
                s.auto_start_failure_reason = Some(e.clone());
                return Err(e);
            }
        };

        // 5. Spawn llama-server with exact arguments
        let mut cmd = Command::new(&binary);
        cmd.args([
            "-m", &model_path.to_string_lossy(),
            "--embedding",
            "--host", "127.0.0.1",
            "--port", &free_port.to_string(),
            "-ub", "2048",
            "-b", "2048",
        ]);

        if let Some(metal) = binary.parent().map(|d| d.join("libggml-metal.so")).filter(|p| p.is_file()) {
            cmd.env("GGML_BACKEND_PATH", metal);
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

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
                s.starting = false;
                s.start_owner = None;
                s.auto_start_failed = true;
                let err = format!("Impossibile avviare il processo llama-server: {}", e);
                s.auto_start_failure_reason = Some(err.clone());
                return Err(err);
            }
        };

        let child_pid = child.id();
        let stderr_opt = child.stderr.take();

        // 5b. Registri per avvio: file proprio con timestamp UTC e PID, conservando almeno gli ultimi 20 file (Item 1)
        if let Some(parent) = model_path.parent() {
            let logs_dir = parent.join("logs");
            let _ = fs::create_dir_all(&logs_dir);
            // Limita a 19 prima della creazione per garantire max 20 file totali dopo l'avvio (N5)
            rotate_llama_server_logs(&logs_dir, 19);

            let utc_now = chrono::Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
            let per_run_log_path = logs_dir.join(format!("llama-server_{}_{}.log", utc_now, child_pid));
            let legacy_log_path = parent.join("llama-server.log");

            if let Some(mut stderr) = stderr_opt {
                std::thread::spawn(move || {
                    use std::io::Read;
                    let mut file_per_run = fs::File::create(&per_run_log_path).ok();
                    let mut file_legacy = fs::File::create(&legacy_log_path).ok();
                    let mut buf = [0u8; 4096];
                    while let Ok(n) = stderr.read(&mut buf) {
                        if n == 0 {
                            break;
                        }
                        if let Some(ref mut f) = file_per_run {
                            let _ = f.write_all(&buf[..n]);
                        }
                        if let Some(ref mut f) = file_legacy {
                            let _ = f.write_all(&buf[..n]);
                        }
                    }
                });
            }
        }

        let _ = write_service_registration(child_pid, free_port);
        {
            let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            s.child = Some(child);
            s.owned_pid = Some(child_pid);
            s.port = free_port;
            s.model_path = model_path.clone();
            s.binary_path = Some(binary.clone());
            s.starting = true;
            s.start_owner = Some(active_token);
        }

        let port = free_port;

        // 6. Poll /health endpoint up to timeout
        let deadline = Instant::now() + timeout;
        let mut healthy = false;
        let log_path = model_path.parent().map(|p| p.join("llama-server.log"));
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(100));
            if check_health(port) {
                healthy = true;
                break;
            }

            // Check if crashed (guasto vero, Regola 3)
            let mut guard = self.0.lock().map_err(|e| e.to_string())?;
            if let Some(c) = guard.child.as_mut() {
                if let Ok(Some(code)) = c.try_wait() {
                    guard.child = None;
                    guard.starting = false;
                    guard.start_owner = None;
                    guard.auto_start_failed = true;
                    let tail = log_path
                        .as_ref()
                        .and_then(|p| std::fs::read_to_string(p).ok())
                        .map(|t| {
                            let mut last: Vec<&str> = t.lines().filter(|l| !l.trim().is_empty()).collect();
                            let keep = last.len().saturating_sub(3);
                            last.drain(..keep);
                            last.join(" | ")
                        })
                        .unwrap_or_default();
                    let detail = if tail.is_empty() { String::new() } else { format!(" — {}", tail) };
                    let err = format!("llama-server uscito con codice {}{}", code, detail);
                    guard.auto_start_failure_reason = Some(err.clone());
                    guard.last_error = Some(err.clone());
                    let elapsed = t_start.elapsed().as_millis() as u64;
                    log_local_model_timing_meta(
                        "SERVICE_START_FAILED",
                        elapsed,
                        Some(&binary),
                        Some(child_pid),
                        Some(port),
                        &err,
                    );
                    return Err(err);
                }
            }
        }

        if !healthy {
            self.stop()?;
            let mut guard = self.0.lock().map_err(|e| e.to_string())?;
            guard.starting = false;
            guard.start_owner = None;
            guard.auto_start_failed = true;
            let err = format!("Timeout: llama-server non ha risposto sull'endpoint /health entro {:.1}s.", timeout.as_secs_f32());
            guard.auto_start_failure_reason = Some(err.clone());
            guard.last_error = Some(err.clone());
            let elapsed = t_start.elapsed().as_millis() as u64;
            log_local_model_timing_meta(
                "SERVICE_START_FAILED",
                elapsed,
                Some(&binary),
                Some(child_pid),
                Some(port),
                &err,
            );
            return Err(err);
        }

        // 7. Verify dimensions are exactly 1024 (guasto vero, Regola 3)
        if let Err(e) = verify_dimensions(port) {
            let _ = self.stop();
            let mut guard = self.0.lock().map_err(|e| e.to_string())?;
            guard.starting = false;
            guard.start_owner = None;
            guard.auto_start_failed = true;
            let err = format!("Controllo dimensioni vettore fallito: {}", e);
            guard.auto_start_failure_reason = Some(err.clone());
            guard.last_error = Some(err.clone());
            let elapsed = t_start.elapsed().as_millis() as u64;
            log_local_model_timing_meta(
                "SERVICE_START_FAILED",
                elapsed,
                Some(&binary),
                Some(child_pid),
                Some(port),
                &err,
            );
            return Err(err);
        }

        starting_guard.1 = None; // Disarma StartingGuard: avvio completato con successo
        {
            let mut guard = self.0.lock().map_err(|e| e.to_string())?;
            guard.starting = false;
            guard.start_owner = None;
            guard.auto_start_failed = false;
            guard.auto_start_failure_reason = None;
        }

        let elapsed = t_start.elapsed().as_millis() as u64;
        log_local_model_timing_meta(
            "SERVICE_START",
            elapsed,
            Some(&binary),
            Some(child_pid),
            Some(port),
            &format!("port={}, pid={:?}", port, child_pid),
        );

        Ok(self.status())
    }

    pub fn ensure_running(&self) -> Result<u16, String> {
        let port = {
            let s = self.0.lock().map_err(|e| e.to_string())?;
            s.port
        };
        if port > 0 && check_health(port) {
            return Ok(port);
        }

        // Try restart up to 3 times (Gate A10 compliance)
        for attempt in 1..=3 {
            match self.start() {
                Ok(rep) if rep.healthy => {
                    let mut guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
                    guard.crash_count = 0;
                    return Ok(rep.port);
                }
                Ok(_) => {}
                Err(e) => {
                    eprintln!("[llama] Tentativo avvio {}/3 fallito: {}", attempt, e);
                    if attempt == 3 {
                        return Err(format!("Riavvio automatico fallito dopo 3 tentativi: {}", e));
                    }
                    std::thread::sleep(Duration::from_millis(500));
                }
            }
        }
        Err("Impossibile avviare il servizio llama-server dopo 3 tentativi".into())
    }

    pub fn stop(&self) -> Result<LocalServerReport, String> {
        let (child, owned_pid) = {
            let mut s = self.0.lock().map_err(|e| e.to_string())?;
            s.port = 0;
            s.adopted_pid = None;
            s.last_error = None;
            s.starting = false;
            s.start_owner = None;
            let owned = s.child.as_ref().map(|c| c.id()).or(s.owned_pid);
            s.owned_pid = None;
            (s.child.take(), owned)
        }; // Lock rilasciato IMMEDIATAMENTE: nessuna attesa su processi o I/O sotto lock!

        if let Some(mut c) = child {
            #[cfg(unix)]
            unsafe {
                let pid = c.id() as i32;
                libc::kill(-pid, libc::SIGTERM);
                libc::kill(pid, libc::SIGTERM);
            }
            #[cfg(windows)]
            {
                let _ = c.kill(); // Termina esplicitamente SOLO il figlio posseduto dall'app
            }
            for _ in 0..20 {
                if c.try_wait().ok().flatten().is_some() {
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            #[cfg(unix)]
            unsafe {
                let pid = c.id() as i32;
                libc::kill(-pid, libc::SIGKILL);
                libc::kill(pid, libc::SIGKILL);
            }
            #[cfg(windows)]
            {
                let _ = c.kill();
            }
            for _ in 0..10 {
                if c.try_wait().ok().flatten().is_some() {
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }

        if let Some(pid) = owned_pid {
            remove_service_registration_if_owned(pid);
        }

        Ok(self.status())
    }
}

impl Drop for LlamaServerState {
    fn drop(&mut self) {
        if Arc::strong_count(&self.0) == 1 {
            let _ = self.stop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    static ENV_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn test_model_expected_constants() {
        assert_eq!(EXPECTED_MODEL_SIZE_BYTES, 634_553_760);
        assert_eq!(
            EXPECTED_MODEL_SHA256,
            "950f4a8e5e19477a6d3c26d2f162233c20002c601f75e4b002e3239997821167"
        );
        assert_eq!(EXPECTED_EMBEDDINGS_DIMENSIONS, 1024);
    }

    #[test]
    fn test_local_model_status_returns_struct() {
        let rep = local_model_status();
        println!("Local model status: {:?}", rep);
        assert!(rep.bytes == 0 || rep.bytes == EXPECTED_MODEL_SIZE_BYTES);
    }

    #[test]
    fn test_second_status_call_uses_cache_zero_hash_recalculation() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("model.gguf");
        let cache_file = tmp.path().join("model.gguf.sha256.json");
        let content = b"dummy-model-content-for-test-cache";
        fs::write(&target, content).unwrap();
        let meta = fs::metadata(&target).unwrap();
        let size = meta.len();
        let expected_hash = compute_file_sha256(&target).unwrap();

        // 1. Prima chiamata: calcola lo SHA-256 e scrive la cache
        let rep1 = model_status_for_paths(&target, &cache_file, size, &expected_hash, false);
        assert!(rep1.installed);
        assert!(rep1.sha256_ok);
        assert!(cache_file.exists());

        let cache_meta1 = fs::metadata(&cache_file).unwrap();
        let cache_mtime1 = cache_meta1.modified().unwrap();

        // 2. Seconda chiamata: deve entrare nel fast-path della cache
        let rep2 = model_status_for_paths(&target, &cache_file, size, &expected_hash, false);
        assert!(rep2.installed);
        assert!(rep2.sha256_ok);

        let cache_meta2 = fs::metadata(&cache_file).unwrap();
        assert_eq!(
            cache_meta2.modified().unwrap(),
            cache_mtime1,
            "La seconda chiamata deve usare la cache esistente senza riscriverla né ricalcolare"
        );
    }

    #[test]
    fn test_model_modified_mtime_triggers_recomputation() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("model.gguf");
        let cache_file = tmp.path().join("model.gguf.sha256.json");
        let content = b"initial-valid-content";
        fs::write(&target, content).unwrap();
        let size = fs::metadata(&target).unwrap().len();
        let expected_hash = compute_file_sha256(&target).unwrap();

        // Popola la cache iniziale
        let rep1 = model_status_for_paths(&target, &cache_file, size, &expected_hash, false);
        assert!(rep1.sha256_ok);
        assert!(cache_file.exists());

        // Modifica del file (stessa dimensione ma contenuto diverso)
        std::thread::sleep(Duration::from_millis(50));
        fs::write(&target, b"altered-bytes-content").unwrap();

        // Su NTFS (confronto esatto mtime) la modifica dell'mtime invalida la cache e forza il ricalcolo
        let rep2 = model_status_for_paths(&target, &cache_file, size, &expected_hash, false);
        assert!(!rep2.sha256_ok, "Il file modificato deve fallire la verifica di integrità");
        assert!(!cache_file.exists(), "La cache non valida deve essere rimossa");
    }

    #[test]
    fn test_model_replaced_same_size_detected() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("model.gguf");
        let cache_file = tmp.path().join("model.gguf.sha256.json");
        let content = b"original-data-123";
        fs::write(&target, content).unwrap();
        let size = fs::metadata(&target).unwrap().len();
        let expected_hash = compute_file_sha256(&target).unwrap();

        // Crea cache valida iniziale
        let rep1 = model_status_for_paths(&target, &cache_file, size, &expected_hash, false);
        assert!(rep1.sha256_ok);

        // Sostituzione con contenuto differente di identica lunghezza (17 byte)
        std::thread::sleep(Duration::from_millis(50));
        fs::write(&target, b"replaced-data-456").unwrap();

        // 1. Verifica automatica tramite mtime
        let rep2 = model_status_for_paths(&target, &cache_file, size, &expected_hash, false);
        assert!(!rep2.sha256_ok, "Il file sostituito con stessa dimensione deve essere rilevato");

        // 2. Verifica forzata (pulsante 'Verifica integrità')
        let rep_forced = model_status_for_paths(&target, &cache_file, size, &expected_hash, true);
        assert!(!rep_forced.sha256_ok, "La verifica forzata deve rilevare l'impronta non valida");
    }

    #[test]
    fn test_install_from_file_single_io_pass() {
        let tmp = tempfile::tempdir().unwrap();
        let source = tmp.path().join("source.gguf");
        let target = tmp.path().join("installed.gguf");
        let cache_file = tmp.path().join("installed.gguf.sha256.json");
        let content = b"model-binary-stream-test";
        fs::write(&source, content).unwrap();
        let size = fs::metadata(&source).unwrap().len();
        let expected_hash = compute_file_sha256(&source).unwrap();

        let rep = install_model_for_paths(&source, &target, &cache_file, size, &expected_hash).unwrap();
        assert!(rep.installed);
        assert!(rep.sha256_ok);
        assert_eq!(rep.bytes, size);
        assert!(target.exists());
        assert!(cache_file.exists());
    }

    #[test]
    fn test_cache_with_unexpected_hash_triggers_recomputation() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("model.gguf");
        let cache_file = tmp.path().join("model.gguf.sha256.json");
        let content = b"real-model-content-abc";
        fs::write(&target, content).unwrap();
        let meta = fs::metadata(&target).unwrap();
        let size = meta.len();
        let mtime_ms = meta
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let real_hash = compute_file_sha256(&target).unwrap();

        // Scrive una cache con un hash vecchio o di un altro modello
        save_model_cache(
            &cache_file,
            &ModelVerificationCache {
                path: target.to_string_lossy().to_string(),
                bytes: size,
                mtime_ms,
                sha256: "0000000000000000000000000000000000000000000000000000000000000000".into(),
                sha256_ok: true,
                verified_at: chrono::Utc::now().to_rfc3339(),
            },
        ).unwrap();

        // Chiamata con l'hash atteso reale
        let rep = model_status_for_paths(&target, &cache_file, size, &real_hash, false);
        // Poiché la cache aveva un hash diverso, la via rapida NON deve accettarla;
        // passa alla verifica completa, riscontra l'hash reale e aggiorna la cache.
        assert!(rep.installed);
        assert!(rep.sha256_ok);
        let updated_cache = read_model_cache(&cache_file).unwrap();
        assert_eq!(updated_cache.sha256, real_hash);
    }

    #[test]
    fn test_unexpected_size_reports_not_installed() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("model.gguf");
        let cache_file = tmp.path().join("model.gguf.sha256.json");
        fs::write(&target, b"short-content").unwrap();
        let meta = fs::metadata(&target).unwrap();
        let actual_size = meta.len();

        // Chiamata con dimensione attesa diversa
        let rep = model_status_for_paths(
            &target,
            &cache_file,
            actual_size + 100, // dimensione attesa differente
            "any-sha256",
            false,
        );
        assert!(!rep.installed, "Dimensione diversa deve restituire non installato");
        assert!(!rep.sha256_ok);
        assert!(!cache_file.exists());
    }

    #[test]
    fn test_execution_does_not_modify_userprofile_limen_vault() {
        let test_log_path = get_local_model_timing_log_path();
        assert!(
            test_log_path.starts_with(std::env::temp_dir()),
            "Nei test il registro deve andare nella directory temporanea: {:?}",
            test_log_path
        );

        let user_vault_dir = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()))
            .join(".limen-vault");
        let user_log = user_vault_dir.join("local_model_timing.log");
        let before_mod = if user_log.exists() {
            fs::metadata(&user_log).ok().and_then(|m| m.modified().ok())
        } else {
            None
        };

        log_local_model_timing("TEST_EVENT", 42, "unit-test-verification");

        let after_mod = if user_log.exists() {
            fs::metadata(&user_log).ok().and_then(|m| m.modified().ok())
        } else {
            None
        };

        assert_eq!(
            before_mod, after_mod,
            "L'esecuzione dei test NON deve modificare o scrivere nel log reale in ~/.limen-vault"
        );
    }

    #[test]
    fn test_pid_file_roundtrip_and_orphan_decision() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("llama-server.pid");
        assert_eq!(read_pid_file(&p), None);
        write_pid_file(&p, 4242);
        assert_eq!(read_pid_file(&p), Some(4242));
        fs::write(&p, "non-un-pid").unwrap();
        assert_eq!(read_pid_file(&p), None);

        let ours = "/Applications/LIMEN Vault v3.app/Contents/Resources/native/llama-server -m m.gguf --embedding --host 127.0.0.1 --port 1";
        assert!(is_orphan_llama_server(1, ours), "genitore launchd + nostro server = orfano");
        assert!(!is_orphan_llama_server(4321, ours), "genitore vivo: appartiene a un'istanza attiva, non si tocca");
        assert!(!is_orphan_llama_server(1, "/usr/bin/python3 server.py"), "pid riusato da un altro processo");
        assert!(!is_orphan_llama_server(1, "/opt/homebrew/bin/llama-server -m chat.gguf --port 8080"), "llama-server non in modalita' embedding");
    }

    #[test]
    fn test_process_parent_and_command_reads_live_process_only() {
        std::env::set_var("LIMEN_DISCOVERY_COMMAND_TIMEOUT_MS", "6000");
        let me = std::process::id();
        let (ppid, cmd) = process_parent_and_command(me).expect("ps deve leggere il processo corrente");
        std::env::remove_var("LIMEN_DISCOVERY_COMMAND_TIMEOUT_MS");
        assert!(ppid > 0);
        assert!(!cmd.is_empty());
        assert_eq!(process_parent_and_command(u32::MAX - 7), None, "pid inesistente");
    }

    #[test]
    fn test_detect_llama_server_binary() {
        let bin = detect_llama_server_binary();
        assert!(bin.is_some(), "llama-server binary should be detectable");
    }

    #[test]
    fn test_find_free_port() {
        let port = find_free_port().unwrap();
        assert!(port > 1024);
    }

    #[test]
    fn test_p1_server_with_invalid_embeddings_fails_bounded_and_status_available() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        // 1. Avvia un mock HTTP server su 127.0.0.1 (porta libera casuale del sistema)
        let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind mock listener");
        let mock_port = listener.local_addr().unwrap().port();
        let running_flag = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let flag_clone = running_flag.clone();

        // Server thread che risponde /health = 200 OK, ma /v1/embeddings = risposta JSON non valida
        let server_thread = std::thread::spawn(move || {
            let _ = listener.set_nonblocking(true);
            while flag_clone.load(std::sync::atomic::Ordering::SeqCst) {
                if let Ok((mut socket, _)) = listener.accept() {
                    let mut buf = [0u8; 1024];
                    let mut read_bytes = 0;
                    while let Ok(n) = socket.read(&mut buf[read_bytes..]) {
                        if n == 0 { break; }
                        read_bytes += n;
                        if buf[..read_bytes].windows(4).any(|w| w == b"\r\n\r\n") {
                            break;
                        }
                    }
                    let req_str = String::from_utf8_lossy(&buf[..read_bytes]);
                    if req_str.contains("GET /health") {
                        let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}";
                        let _ = socket.write_all(resp.as_bytes());
                    } else if req_str.contains("POST /v1/embeddings") {
                        // Risposta HTTP valida ma payload JSON non contenente il vettore corretto
                        let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 29\r\nConnection: close\r\n\r\n{\"error\":\"mock_invalid_json\"}";
                        let _ = socket.write_all(resp.as_bytes());
                    }
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        });

        // 2. Avvia un mock child process posseduto da LlamaServerState
        #[cfg(windows)]
        let mut mock_child = Command::new("cmd")
            .args(["/c", "ping -n 30 127.0.0.1 > nul"])
            .spawn()
            .expect("Failed to spawn mock child process");
        #[cfg(unix)]
        let mut mock_child = Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("Failed to spawn mock child process");

        let mock_child_pid = mock_child.id();
        assert!(mock_child.try_wait().unwrap().is_none(), "Mock child must be alive initially");

        // 3. Inizializza LlamaServerState con il processo figlio posseduto e la porta del mock server
        let state = Arc::new(LlamaServerState::default());
        {
            let mut s = state.0.lock().unwrap();
            s.port = mock_port;
            s.child = Some(mock_child);
        }

        // Verifica che status() sia reattivo e non resti mai bloccato dal mutex (< 500ms)
        let t0 = Instant::now();
        let rep_before = state.status();
        assert!(t0.elapsed() < Duration::from_millis(500), "status() must return without deadlock");
        assert_eq!(rep_before.port, mock_port);
        assert!(rep_before.healthy, "/health mock server deve risultare healthy");
        assert!(rep_before.running);

        // 4. Esegui la verifica dimensioni: deve fallire a causa del payload non valido
        let verify_res = verify_dimensions(mock_port);
        assert!(verify_res.is_err(), "verify_dimensions must fail on mock invalid embeddings");

        // 5. Invocazione di stop(): deve terminare il figlio posseduto entro il limite dichiarato (< 3s)
        let t_stop = Instant::now();
        let stop_res = state.stop();
        let stop_duration = t_stop.elapsed();
        assert!(stop_res.is_ok(), "stop() must succeed");
        assert!(stop_duration < Duration::from_secs(3), "stop() must terminate within bounded timeout (took {:?})", stop_duration);

        // 6. Verifica che SOLO il figlio posseduto sia stato terminato
        std::thread::sleep(Duration::from_millis(200));
        let proc_info = process_parent_and_command(mock_child_pid);
        assert!(proc_info.is_none(), "Mock child PID {} must be dead after stop()", mock_child_pid);

        // 7. status() deve restare disponibile e non bloccato
        let t_stat = Instant::now();
        let rep_after = state.status();
        assert!(t_stat.elapsed() < Duration::from_millis(200), "status() must return immediately");
        assert_eq!(rep_after.port, 0);
        assert!(!rep_after.healthy);
        assert!(!rep_after.running);

        // Cleanup mock server thread
        running_flag.store(false, std::sync::atomic::Ordering::SeqCst);
        let _ = server_thread.join();
    }

    #[test]
    fn test_p2_registered_service_adoption_and_fallback() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::sync::atomic::{AtomicBool, Ordering};

        let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind mock listener");
        let mock_port = listener.local_addr().unwrap().port();
        let running_flag = Arc::new(AtomicBool::new(true));
        let flag_clone = running_flag.clone();
        let return_1024d = Arc::new(AtomicBool::new(true));
        let dim_clone = return_1024d.clone();

        let server_thread = std::thread::spawn(move || {
            listener.set_nonblocking(true).unwrap();
            while flag_clone.load(Ordering::SeqCst) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let mut req_buf = [0u8; 1024];
                    let n = stream.read(&mut req_buf).unwrap_or(0);
                    let req_str = String::from_utf8_lossy(&req_buf[..n]);

                    if req_str.contains("/health") {
                        let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}";
                        let _ = stream.write_all(resp.as_bytes());
                    } else if req_str.contains("/v1/embeddings") {
                        if dim_clone.load(Ordering::SeqCst) {
                            let floats_1024 = vec!["0.1"; 1024].join(",");
                            let json_body = format!("{{\"data\":[{{\"embedding\":[{}]}}]}}", floats_1024);
                            let resp = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                                json_body.len(),
                                json_body
                            );
                            let _ = stream.write_all(resp.as_bytes());
                        } else {
                            // Ritorna solo 768 dimensioni (modello errato)
                            let floats_768 = vec!["0.1"; 768].join(",");
                            let json_body = format!("{{\"data\":[{{\"embedding\":[{}]}}]}}", floats_768);
                            let resp = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                                json_body.len(),
                                json_body
                            );
                            let _ = stream.write_all(resp.as_bytes());
                        }
                    } else {
                        let resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
                        let _ = stream.write_all(resp.as_bytes());
                    }
                } else {
                    std::thread::sleep(Duration::from_millis(10));
                }
            }
        });

        // 1. Verifica che con 1024d e porta registrata venga adottato il servizio senza avviare nuovo processo
        std::env::set_var("LIMEN_LOCAL_PORT", mock_port.to_string());
        let verified = find_active_bge_m3_service_with_pid();
        assert!(verified.is_ok(), "find_active_bge_m3_service_with_pid deve rilevare il mock server a 1024d");
        let (port_found, _) = verified.unwrap();
        assert_eq!(port_found, mock_port);

        let state = LlamaServerState::default();
        let (port_opt, _pid_opt, is_ready, status, fallback_reason) = state.get_or_adopt_or_start_service();
        assert!(is_ready, "Servizio registrato valido deve risultare pronto");
        assert_eq!(port_opt, Some(mock_port));
        assert_eq!(status, "esterno adottato");
        assert!(fallback_reason.is_none());

        let rep = state.status();
        assert!(rep.running);
        assert!(rep.healthy);
        assert_eq!(rep.port, mock_port);

        // stop() rilascia l'adozione senza uccidere il mock server esterno
        let _ = state.stop();
        assert_eq!(state.status().port, 0);

        // 2. Verifica che se le dimensioni sono errate (768d), non adotti il servizio e segnali il fallback
        return_1024d.store(false, Ordering::SeqCst);
        let verified_wrong = find_active_bge_m3_service_with_pid();
        assert!(verified_wrong.is_err(), "find_active_bge_m3_service_with_pid deve rifiutare 768d");

        // Cleanup
        std::env::remove_var("LIMEN_LOCAL_PORT");
        running_flag.store(false, Ordering::SeqCst);
        let _ = server_thread.join();
    }

    #[test]
    fn test_p3_two_instances_service_registration_ownership() {
        let temp_dir = tempfile::tempdir().unwrap();
        let pid_path = temp_dir.path().join("llama-server.pid");
        let port_path = temp_dir.path().join("llama-server.port");

        let pid_a = 11111u32;
        let port_a = 8081u16;

        // 1. Scrittura consistente della coppia (pid_a, port_a)
        let res_a = write_service_registration_to_paths(&pid_path, &port_path, pid_a, port_a);
        assert!(res_a.is_ok(), "La scrittura iniziale della registrazione deve riuscire");
        assert_eq!(read_pid_file(&pid_path), Some(pid_a));
        assert_eq!(read_port_file(&port_path), Some(port_a));

        // 2. Istanza B (PID 22222) tenta di rimuovere la registrazione di A:
        // Poiché non ne possiede la titolarità, NON deve cancellare i file di A
        let pid_b = 22222u32;
        remove_service_registration_from_paths_if_owned(&pid_path, &port_path, pid_b);
        assert!(pid_path.exists(), "llama-server.pid non deve essere cancellato da istanza diversa");
        assert!(port_path.exists(), "llama-server.port non deve essere cancellato da istanza diversa");
        assert_eq!(read_pid_file(&pid_path), Some(pid_a));
        assert_eq!(read_port_file(&port_path), Some(port_a));

        // 3. Test con 2 istanze di LlamaServerState:
        // Istanza A avvia/possiede il servizio, Istanza B lo adotta
        let state_a = LlamaServerState::default();
        {
            let mut s = state_a.0.lock().unwrap();
            s.owned_pid = Some(pid_a);
            s.port = port_a;
        }

        let state_b = LlamaServerState::default();
        state_b.adopt_service(port_a, Some(pid_a));
        assert_eq!(state_b.status().port, port_a);

        // Quando Istanza B viene chiusa o esegue stop():
        // NON deve cancellare la registrazione su disco né terminare il processo di A
        let stop_b = state_b.stop();
        assert!(stop_b.is_ok());
        assert_eq!(state_b.status().port, 0);
        assert!(pid_path.exists(), "La chiusura dell'istanza B che ha adottato il servizio non cancella i file");
        assert!(port_path.exists(), "La chiusura dell'istanza B che ha adottato il servizio non cancella i file");

        // 4. Istanza A (titolare legittimo) esegue la rimozione:
        // Avendo la titolarità del proprio PID, rimuove consistentemente la coppia
        remove_service_registration_from_paths_if_owned(&pid_path, &port_path, pid_a);
        assert!(!pid_path.exists(), "llama-server.pid deve essere cancellato dal titolare legittimo");
        assert!(!port_path.exists(), "llama-server.port deve essere cancellato dal titolare legittimo");
    }

    #[test]
    fn test_fase5f_run_command_with_timeout_terminates_hanging_process() {
        #[cfg(windows)]
        let mut cmd = std::process::Command::new("powershell");
        #[cfg(windows)]
        cmd.args(["-NoProfile", "-Command", "Start-Sleep -Seconds 10"]);

        #[cfg(unix)]
        let mut cmd = std::process::Command::new("sleep");
        #[cfg(unix)]
        cmd.arg("10");

        let t0 = Instant::now();
        let out = run_command_with_timeout(cmd, Duration::from_millis(300));
        let elapsed = t0.elapsed();

        assert!(out.is_none(), "run_command_with_timeout deve restituire None se il comando supera il timeout");
        assert!(elapsed < Duration::from_millis(2500), "Il timeout deve arrestare il processo entro tempi contenuti (impiegati {:?})", elapsed);
    }

    #[test]
    fn test_fase5f_discovery_external_command_hang_terminates_within_timeout_with_fallback() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("LIMEN_TEST_DISABLE_ADOPTION", "1");
        let state = LlamaServerState::default();
        let timeout = Duration::from_millis(50);
        let t0 = Instant::now();
        let (port, pid, is_ready, status, fallback_reason) = state.get_or_adopt_or_start_service_with_timeout(timeout);
        let elapsed = t0.elapsed();
        std::env::remove_var("LIMEN_TEST_DISABLE_ADOPTION");

        assert!(!is_ready, "Il servizio non deve risultare pronto se il timeout di preparazione spira");
        assert!(port.is_none(), "Nessuna porta deve essere associata");
        assert!(pid.is_none());
        assert_eq!(status, "in avvio");
        assert!(elapsed < Duration::from_millis(3000), "La preparazione deve terminare entro il tempo massimo dichiarato (impiegati {:?})", elapsed);

        let reason = fallback_reason.expect("Deve essere presente il motivo del ripiego");
        assert!(
            reason.contains("ripiego"),
            "Il motivo deve esplicitare il ripiego sulla ricerca per parole: {}", reason
        );
    }

    #[test]
    fn test_fase5f_failed_auto_start_prevents_retry_on_subsequent_question() {
        let state = LlamaServerState::default();

        // 1. Simula la registrazione di un fallimento di avvio (come avviene quando start_with_timeout fallisce)
        {
            let mut guard = state.0.lock().unwrap();
            guard.auto_start_failed = true;
            guard.auto_start_failure_reason = Some("Avvio llama-server fallito: modello non presente".to_string());
        }

        assert!(state.is_auto_start_failed(), "Lo stato deve registrare auto_start_failed = true");

        // 2. Seconda richiesta (domanda successiva): NON deve tentare nuovamente start()!
        // Deve ritornare istantaneamente con il motivo del fallimento precedente
        let t_start2 = Instant::now();
        let (port2, pid2, is_ready2, status2, fallback_reason2) = state.get_or_adopt_or_start_service();
        let elapsed2 = t_start2.elapsed();

        assert!(!is_ready2);
        assert!(port2.is_none());
        assert!(pid2.is_none());
        assert_eq!(status2, "fallito");
        assert!(elapsed2 < Duration::from_millis(150), "La seconda domanda non deve ritentare l'avvio e deve terminare immediatamente (impiegati {:?})", elapsed2);

        let r2 = fallback_reason2.expect("Motivo fallback atteso alla seconda domanda");
        assert!(
            r2.contains("fallito"),
            "Il motivo deve indicare che l'avvio è già fallito nella sessione: {}", r2
        );
        assert!(r2.contains("ripiego sulla ricerca per parole"));

        // 3. L'utente clicca 'AVVIA SERVIZIO LOCALE': il blocco viene resettato
        state.reset_auto_start_failure();
        assert!(!state.is_auto_start_failed(), "reset_auto_start_failure deve riabilitare i tentativi");
    }

    #[test]
    fn test_fase5g_startup_in_progress_does_not_kill_and_subsequent_succeeds() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mock_port = listener.local_addr().unwrap().port();
        let is_ready_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let flag_clone = is_ready_flag.clone();
        let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stop_clone = stop_flag.clone();

        let server_thread = std::thread::spawn(move || {
            listener.set_nonblocking(true).unwrap();
            while !stop_clone.load(Ordering::SeqCst) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let mut buf = [0u8; 1024];
                    let _ = stream.read(&mut buf);
                    if flag_clone.load(Ordering::SeqCst) {
                        let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}";
                        let _ = stream.write_all(resp.as_bytes());
                    } else {
                        let resp = "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n";
                        let _ = stream.write_all(resp.as_bytes());
                    }
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        });

        let state = LlamaServerState::default();
        // Simula il servizio in fase di avvio con porta mock_port
        {
            let mut guard = state.0.lock().unwrap();
            guard.starting = true;
            guard.port = mock_port;
            guard.owned_pid = Some(99999);
        }

        // Prima domanda: timeout breve (80 ms), server non ancora pronto
        let (_port1, _pid1, is_ready1, status1, reason1) = state.get_or_adopt_or_start_service_with_timeout(Duration::from_millis(80));
        assert!(!is_ready1, "La prima domanda non deve risultare pronta");
        assert_eq!(status1, "in avvio", "Lo stato deve essere 'in avvio'");
        assert!(reason1.as_ref().unwrap().contains("in avvio"), "Il motivo deve indicare 'in avvio'");
        assert!(!state.is_auto_start_failed(), "Un timeout di preparazione domanda NON è un guasto e non deve impostare auto_start_failed");
        assert!(state.is_starting(), "Il processo deve continuare l'avvio in background");

        // Simula il completamento dell'avvio (server diventa pronto)
        is_ready_flag.store(true, Ordering::SeqCst);
        std::thread::sleep(Duration::from_millis(50));

        // Seconda domanda: il servizio è pronto e risponde a /health
        let (port2, _pid2, is_ready2, status2, reason2) = state.get_or_adopt_or_start_service_with_timeout(Duration::from_secs(1));
        assert!(is_ready2, "La seconda domanda deve trovare il servizio pronto");
        assert_eq!(port2, Some(mock_port));
        assert_eq!(status2, "pronto");
        assert!(reason2.is_none());

        stop_flag.store(true, Ordering::SeqCst);
        let _ = state.stop();
        let _ = server_thread.join();
    }

    #[test]
    fn test_fase5g_missing_binary_sets_auto_start_failed_until_button_reset() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("LIMEN_TEST_DISABLE_ADOPTION", "1");
        let state = LlamaServerState::default();
        // Imposta una variabile che fa fallire la scoperta del binario
        std::env::set_var("LLAMA_SERVER_PATH", "E:\\non_existent_llama_binary_path_fase5g.exe");

        let (_port, _pid, is_ready, status, reason) = state.get_or_adopt_or_start_service_with_timeout(Duration::from_millis(200));
        std::env::remove_var("LLAMA_SERVER_PATH");

        assert!(!is_ready);
        assert_eq!(status, "fallito");
        assert!(reason.unwrap().contains("ripiego"));
        assert!(state.is_auto_start_failed(), "Eseguibile mancante è un guasto vero e deve impostare auto_start_failed = true");

        // Domanda successiva non ritenta
        let t0 = Instant::now();
        let (_p2, _pid2, is_ready2, status2, reason2) = state.get_or_adopt_or_start_service();
        let elapsed = t0.elapsed();
        std::env::remove_var("LIMEN_TEST_DISABLE_ADOPTION");

        assert!(!is_ready2);
        assert_eq!(status2, "fallito");
        assert!(elapsed < Duration::from_millis(200));
        assert!(reason2.unwrap().contains("fallito"));

        // L'utente preme 'AVVIA SERVIZIO LOCALE': reset
        state.reset_auto_start_failure();
        assert!(!state.is_auto_start_failed());
    }

    #[test]
    fn test_fase5g_on_app_startup_starts_service_in_background_without_question() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempfile::tempdir().unwrap();
        let timing_log = temp_dir.path().join("local_model_timing.log");
        std::env::set_var("LIMEN_LOCAL_MODEL_TIMING_LOG", &timing_log);
        std::env::set_var("LIMEN_EMBEDDINGS_PROVIDER", "local");

        let state = LlamaServerState::default();
        // Simula la chiamata che l'app esegue all'avvio senza domande
        state.trigger_background_start();

        // Verifica che lo stato sia passato in avvio
        assert!(state.is_starting() || state.status().running || state.is_auto_start_failed());

        // Attendi che il thread registri l'evento di inizio
        std::thread::sleep(Duration::from_millis(100));

        let log_content = std::fs::read_to_string(&timing_log).unwrap_or_default();
        assert!(
            log_content.contains("BACKGROUND_START_BEGIN"),
            "Il registro local_model_timing.log deve contenere l'inizio dell'avvio in background all'apertura dell'app. Contenuto: {}",
            log_content
        );

        let _ = state.stop();
        std::env::remove_var("LIMEN_LOCAL_MODEL_TIMING_LOG");
        std::env::remove_var("LIMEN_EMBEDDINGS_PROVIDER");
    }

    #[test]
    fn test_fase5h_adoption_of_existing_instance_service_without_second_process() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mock_port = listener.local_addr().unwrap().port();
        let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stop_clone = stop_flag.clone();

        let server_thread = std::thread::spawn(move || {
            listener.set_nonblocking(true).unwrap();
            while !stop_clone.load(Ordering::SeqCst) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let mut buf = [0u8; 1024];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]);
                    if req.contains("GET /health") {
                        let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}";
                        let _ = stream.write_all(resp.as_bytes());
                    } else if req.contains("POST /v1/embeddings") {
                        // Risposta con 1024 float
                        let embedding: Vec<f32> = vec![0.01; 1024];
                        let emb_json = serde_json::to_string(&embedding).unwrap();
                        let body = format!("{{\"data\":[{{\"embedding\":{}}}]}}", emb_json);
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        let _ = stream.write_all(resp.as_bytes());
                    }
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        });

        std::env::set_var("LIMEN_LOCAL_PORT", mock_port.to_string());
        let state = LlamaServerState::default();

        let (port, _pid, is_ready, status, reason) = state.get_or_adopt_or_start_service();
        std::env::remove_var("LIMEN_LOCAL_PORT");

        assert!(is_ready, "Il servizio esistente verificato deve essere adottato e pronto");
        assert_eq!(port, Some(mock_port));
        assert_eq!(status, "esterno adottato", "Lo stato deve essere 'esterno adottato'");
        assert!(reason.is_none());
        assert!(!state.is_starting());
        assert!(!state.is_auto_start_failed());

        stop_flag.store(true, Ordering::SeqCst);
        let _ = server_thread.join();
    }

    #[test]
    fn test_fase5h_start_prevents_duplicate_process_while_starting() {
        let state = LlamaServerState::default();
        {
            let mut s = state.0.lock().unwrap();
            s.starting = true;
            s.start_owner = Some(888);
        }

        // Chiamata concorrente a start_internal con timeout breve: non deve avviare alcun processo,
        // ma deve attendere e fallire per timeout dell'avvio già in corso.
        let t0 = Instant::now();
        let res = state.start_internal(Duration::from_millis(150));
        let elapsed = t0.elapsed();

        assert!(res.is_err());
        assert!(elapsed >= Duration::from_millis(100));
        let err = res.unwrap_err();
        assert!(
            err.contains("in corso"),
            "L'errore deve segnalare l'avvio già in corso senza creare nuovi processi: {}",
            err
        );

        // Reset
        let mut s = state.0.lock().unwrap();
        s.starting = false;
        s.start_owner = None;
    }

    #[test]
    fn test_fase5i_n2_status_exposes_starting_state() {
        let state = LlamaServerState::default();
        let rep_init = state.status();
        assert!(!rep_init.starting, "Inizialmente starting deve essere false");

        {
            let mut s = state.0.lock().unwrap();
            s.starting = true;
        }

        let rep_starting = state.status();
        assert!(rep_starting.starting, "Durante l'avvio, status().starting deve essere true");
        assert!(!rep_starting.running, "Senza processo né salute, running deve essere false");

        {
            let mut s = state.0.lock().unwrap();
            s.starting = false;
        }
        let rep_ended = state.status();
        assert!(!rep_ended.starting, "Dopo la fine dell'avvio, status().starting deve tornare false");
    }

    #[test]
    fn test_fase5h_starting_guard_resets_flag_on_thread_panic() {
        let state = LlamaServerState::default();
        {
            let mut s = state.0.lock().unwrap();
            s.starting = true;
            s.start_owner = Some(777);
        }
        assert!(state.is_starting());

        let state_clone = state.clone();
        let handle = std::thread::spawn(move || {
            let _guard = StartingGuard(state_clone, Some(777));
            panic!("Simulated thread panic during startup");
        });

        assert!(handle.join().is_err(), "Il thread deve andare in panic");
        assert!(
            !state.is_starting(),
            "StartingGuard deve aver azzerato starting = false anche a fronte di un panic"
        );
    }

    #[test]
    fn test_fase5h_log_rotation_and_per_startup_files() {
        let tmp = tempfile::tempdir().unwrap();
        let logs_dir = tmp.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();

        // Crea 25 file di log simulati
        for i in 1..=25 {
            let filename = format!("llama-server_20260924T{:02}0000Z_1000{}.log", i, i);
            fs::write(logs_dir.join(filename), b"log content").unwrap();
        }

        // Ruota a max 20 file
        rotate_llama_server_logs(&logs_dir, 20);

        let remaining: Vec<_> = fs::read_dir(&logs_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(remaining.len(), 20, "Devono rimanere esattamente 20 file");

        // Verifica che i 5 file più vecchi (da 01 a 05) siano stati rimossi
        for i in 1..=5 {
            let filename = format!("llama-server_20260924T{:02}0000Z_1000{}.log", i, i);
            assert!(!logs_dir.join(filename).exists(), "I file più vecchi devono essere rimossi");
        }
        // Verifica che i file più recenti (da 06 a 25) siano presenti
        for i in 6..=25 {
            let filename = format!("llama-server_20260924T{:02}0000Z_1000{}.log", i, i);
            assert!(logs_dir.join(filename).exists(), "I file recenti devono essere conservati");
        }
    }

    #[test]
    fn test_fase5i_n5_20_existing_logs_remains_20_after_startup() {
        let tmp = tempfile::tempdir().unwrap();
        let logs_dir = tmp.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();

        // 1. Crea esattamente 20 file di log simulati preesistenti
        for i in 1..=20 {
            let filename = format!("llama-server_20260924T{:02}0000Z_1000{}.log", i, i);
            fs::write(logs_dir.join(filename), b"preexisting log").unwrap();
        }

        let initial_count = fs::read_dir(&logs_dir).unwrap().filter_map(|e| e.ok()).count();
        assert_eq!(initial_count, 20, "Devono esserci esattamente 20 file iniziali");

        // 2. Simula la rotazione prima dell'avvio e la creazione del nuovo file di log
        rotate_llama_server_logs(&logs_dir, 19);
        let new_run_file = logs_dir.join("llama-server_20260924T210000Z_99999.log");
        fs::write(&new_run_file, b"new run log").unwrap();

        // 3. Verifica che il conteggio finale sia ESATTAMENTE 20 (e non 21)
        let final_files: Vec<_> = fs::read_dir(&logs_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(
            final_files.len(),
            20,
            "Dopo l'avvio con 20 file preesistenti devono rimanere esattamente 20 file, ottenuti {}: {:?}",
            final_files.len(),
            final_files
        );

        // Il file più vecchio (01) deve essere stato rimosso per fare spazio al nuovo
        assert!(!logs_dir.join("llama-server_20260924T010000Z_10001.log").exists());
        // Il nuovo file (21) deve essere presente
        assert!(logs_dir.join("llama-server_20260924T210000Z_99999.log").exists());
    }

    #[test]
    fn test_fase5h_local_model_timing_log_includes_app_and_service_metadata() {
        let tmp = tempfile::tempdir().unwrap();
        let log_file = tmp.path().join("local_model_timing.log");
        std::env::set_var("LIMEN_LOCAL_MODEL_TIMING_LOG", &log_file);

        log_local_model_timing_meta(
            "SERVICE_START",
            4321,
            Some(Path::new("dummy/native/llama-server.exe")),
            Some(36844),
            Some(49950),
            "test_adoption_details",
        );

        let content = fs::read_to_string(&log_file).unwrap();
        assert!(content.contains("app_exe="), "Deve contenere app_exe: {}", content);
        assert!(content.contains("app_pid="), "Deve contenere app_pid: {}", content);
        assert!(content.contains("service_exe="), "Deve contenere service_exe: {}", content);
        assert!(content.contains("service_pid=36844"), "Deve contenere service_pid=36844: {}", content);
        assert!(content.contains("service_port=49950"), "Deve contenere service_port=49950: {}", content);

        std::env::remove_var("LIMEN_LOCAL_MODEL_TIMING_LOG");
    }

    #[test]
    fn test_fase5h_codex_fixture_acceptance() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        // 1. Usa cartella target separata (NON target/release/llama-server.exe)
        let separate_target = tempfile::tempdir().unwrap();
        let fixture_exe = separate_target.path().join(if cfg!(windows) { "invalid_embeddings.exe" } else { "invalid_embeddings" });

        // N6: Fixture nel repository (tests/fixtures/invalid_embeddings.rs), compilazione obbligatoria in cartella temporanea
        let source_candidates = [
            PathBuf::from("tests/fixtures/invalid_embeddings.rs"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/invalid_embeddings.rs"),
        ];
        let source_rs = source_candidates
            .iter()
            .find(|p| p.is_file())
            .unwrap_or_else(|| panic!("Sorgente fixture tests/fixtures/invalid_embeddings.rs NON trovato nel repository!"));

        let status = std::process::Command::new("rustc")
            .arg(source_rs)
            .arg("-o")
            .arg(&fixture_exe)
            .status()
            .expect("Esecuzione rustc per compilazione invalid_embeddings.rs");
        assert!(status.success(), "Compilazione del fixture invalid_embeddings.rs fallita con stato {:?}", status);
        assert!(fixture_exe.is_file(), "L'eseguibile compilato del fixture deve esistere: {}", fixture_exe.display());

        // Verifica che target/release/llama-server.exe NON sia toccato
        let release_target = PathBuf::from("apps/desktop/src-tauri/target/release/llama-server.exe");
        let release_exists_before = release_target.exists();

        let state = LlamaServerState::default();
        let start_time = Instant::now();

        // Esegui l'avvio passando il percorso del fixture come parametro esplicito (senza variabile d'ambiente globale)
        let prep_timeout = Duration::from_secs(5);
        let start_res = state.start_with_custom_binary(&fixture_exe, prep_timeout);

        let elapsed = start_time.elapsed();

        // Asserzioni fondamentali della prova di accettazione:
        // A) Deve terminare entro il tempo massimo dichiarato (senza bloccarsi)
        assert!(
            elapsed <= prep_timeout + Duration::from_secs(3),
            "La preparazione con fixture non deve bloccarsi né superare il timeout (impiegati {:?}, timeout {:?})",
            elapsed, prep_timeout
        );

        // B) L'avvio con vettori a 3 dimensioni deve fallire
        assert!(start_res.is_err(), "L'avvio con fixture a 3 dimensioni deve fallire");
        let start_err = start_res.unwrap_err();
        assert!(
            start_err.contains("Dimensioni vettore errate") || start_err.contains("Controllo dimensioni vettore fallito"),
            "L'errore restituito deve menzionare il fallimento del controllo dimensioni: '{}'",
            start_err
        );

        // C) Lo stato non deve rimanere 'in avvio' permanente né 'pronto'
        let (auto_start_failed, starting, auto_reason) = {
            let guard = state.0.lock().unwrap();
            (
                guard.auto_start_failed,
                guard.starting,
                guard.auto_start_failure_reason.clone().expect("auto_start_failure_reason presente"),
            )
        };
        assert!(auto_start_failed, "auto_start_failed deve essere true");
        assert!(!starting, "starting deve essere false (non 'in avvio' permanente)");

        let rep = state.status();
        assert!(!rep.healthy, "Il servizio con vettori invalidi non deve essere dichiarato pronto");
        assert_eq!(rep.port, 0, "Nessuna porta deve essere restituita come valida");

        assert!(
            auto_reason.contains("Dimensioni vettore errate") || auto_reason.contains("Controllo dimensioni vettore fallito"),
            "Il motivo mostrato deve indicare chiaramente l'errore di dimensioni vettori: '{}'",
            auto_reason
        );

        // D) Prova di preview: deve terminare con ripiego sulle parole e motivo visibile
        let vault_dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(vault_dir.path().join("00_SYSTEM")).unwrap();
        std::fs::create_dir(vault_dir.path().join("01_CLIENTS")).unwrap();
        std::fs::write(
            vault_dir.path().join("01_CLIENTS/approved.md"),
            "---\nid: approved\ntitle: Progetto BNXT\nstatus: approved\nclient: Acme\n---\nTesto del progetto BNXT con parole chiave.\n",
        ).unwrap();
        crate::search::index_vault_search(vault_dir.path()).unwrap();

        let ai_state = crate::ai::AiState::default();
        let preview_res = tokio::runtime::Runtime::new().unwrap().block_on(async {
            ai_state.preview_with_service_info(
                vault_dir.path().to_path_buf(),
                crate::ai::Options {
                    prompt: "test query".to_string(),
                    model: "gpt-4o".to_string(),
                    include_drafts: false,
                    source_ids: vec![],
                    category: None,
                    client: None,
                    project: None,
                    tags: None,
                },
                None,
                None,
                false,
                Some("fallito".to_string()),
                Some(auto_reason.clone()),
                Some(start_time),
                elapsed.as_millis() as u64,
            ).await
        });
        let prev = match preview_res {
            Ok(p) => p,
            Err(e) => panic!("La preview deve completarsi con ripiego sulle parole, ma ha fallito con: {}", e),
        };
        assert!(!prev.semantic_used, "La ricerca semantica non deve essere utilizzata");
        let sem_reason = prev.semantic_fallback_reason.expect("Motivo fallback semantico visibile");
        assert!(
            sem_reason.contains("Dimensioni vettore errate") || sem_reason.contains("Controllo dimensioni vettore fallito"),
            "Il motivo di ripiego visibile deve spiegare il fallimento del controllo dimensioni: '{}'",
            sem_reason
        );

        // E) Se c'era un PID, verifica che il processo figlio sia terminato
        if let Some(p) = rep.pid {
            #[cfg(windows)]
            {
                use std::process::Command;
                let out = Command::new("powershell")
                    .args(&["-NoProfile", "-Command", &format!("Get-Process -Id {} -ErrorAction SilentlyContinue", p)])
                    .output();
                if let Ok(output) = out {
                    assert!(!output.status.success() || output.stdout.is_empty(), "Il fixture PID {} non deve rimanere in esecuzione", p);
                }
            }
        }

        // F) Verifica che NON sia stato lasciato alcun file in apps/desktop/src-tauri/target/release/llama-server.exe
        if !release_exists_before {
            assert!(!release_target.exists(), "Il fixture NON deve essere lasciato in target/release/llama-server.exe");
        }
    }

    fn compile_test_mock_server(dest_dir: &Path) -> PathBuf {
        let out_exe = dest_dir.join(if cfg!(windows) { "valid_mock_server.exe" } else { "valid_mock_server" });
        if out_exe.is_file() {
            return out_exe;
        }
        let src = PathBuf::from("tests/fixtures/valid_mock_server.rs");
        let abs_src = if src.is_file() {
            src
        } else {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/valid_mock_server.rs")
        };
        assert!(abs_src.is_file(), "Sorgente valid_mock_server.rs non trovato in {}", abs_src.display());
        let status = std::process::Command::new("rustc")
            .arg(&abs_src)
            .arg("-o")
            .arg(&out_exe)
            .status()
            .expect("Esecuzione rustc per compilazione valid_mock_server");
        assert!(status.success(), "Compilazione valid_mock_server.rs fallita con stato: {:?}", status);
        out_exe
    }

    #[test]
    fn test_fase5i_n1_app_startup_auto_starts_single_process() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("LIMEN_TEST_DISABLE_ADOPTION", "1");
        let temp_dir = tempfile::tempdir().unwrap();
        let mock_exe = compile_test_mock_server(temp_dir.path());

        let state = LlamaServerState::default();
        let started = state.trigger_background_start_with_binary(Some(mock_exe));
        assert!(started, "trigger_background_start deve restituire true");

        // Attende che l'avvio e la verifica si completino (starting torna false)
        let t0 = Instant::now();
        let mut ready = false;
        while t0.elapsed() < Duration::from_secs(10) {
            let rep = state.status();
            if rep.healthy && rep.port > 0 && !state.is_starting() {
                ready = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }

        std::env::remove_var("LIMEN_TEST_DISABLE_ADOPTION");
        assert!(ready, "Il servizio deve risultare sano e pronto dopo l'avvio automatico");
        let rep = state.status();
        assert!(rep.running, "Il servizio deve essere running");
        assert!(rep.port > 0, "La porta del servizio deve essere valida");
        assert!(rep.pid.is_some(), "Il PID del processo deve essere presente");
        assert!(!state.is_starting(), "starting deve essere false al termine dell'avvio");

        let _ = state.stop();
    }

    #[test]
    fn test_fase5i_n1_button_pressed_during_background_start_waits_and_succeeds_single_process() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("LIMEN_TEST_DISABLE_ADOPTION", "1");
        let temp_dir = tempfile::tempdir().unwrap();
        let mock_exe = compile_test_mock_server(temp_dir.path());

        let state = LlamaServerState::default();
        let started = state.trigger_background_start_with_binary(Some(mock_exe.clone()));
        assert!(started);

        // Subito dopo, mentre l'avvio è in corso, un altro thread (simulazione click pulsante AVVIA) chiama start_with_custom_binary
        let state_clone = state.clone();
        let mock_exe_clone = mock_exe.clone();
        let manual_thread = std::thread::spawn(move || {
            state_clone.start_with_custom_binary(&mock_exe_clone, Duration::from_secs(15))
        });

        let manual_res = manual_thread.join().expect("Join thread manuale");
        std::env::remove_var("LIMEN_TEST_DISABLE_ADOPTION");
        assert!(manual_res.is_ok(), "L'avvio manuale durante l'avvio in background deve riuscire senza timeout: {:?}", manual_res);

        let rep_manual = manual_res.unwrap();
        assert!(rep_manual.healthy);
        assert!(rep_manual.port > 0);

        let rep_final = state.status();
        assert!(rep_final.healthy);
        assert_eq!(rep_manual.port, rep_final.port, "Deve essere stata usata la stessa porta senza secondo processo");
        assert_eq!(rep_manual.pid, rep_final.pid, "Deve essere presente lo stesso PID senza processi duplicati");

        let _ = state.stop();
    }

    #[test]
    fn test_fase5i_n1_adopted_service_dies_next_query_fallbacks_and_restarts() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempfile::tempdir().unwrap();
        let mock_exe = compile_test_mock_server(temp_dir.path());

        // 1. Avvia un mock server esterno temporaneo
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port1 = listener.local_addr().unwrap().port();
        let stop_ext = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stop_ext_clone = stop_ext.clone();

        let ext_thread = std::thread::spawn(move || {
            listener.set_nonblocking(true).unwrap();
            while !stop_ext_clone.load(Ordering::SeqCst) {
                if let Ok((mut s, _)) = listener.accept() {
                    let mut buf = [0u8; 1024];
                    let n = s.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]);
                    if req.contains("GET /health") {
                        let _ = s.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}");
                    }
                }
                std::thread::sleep(Duration::from_millis(5));
            }
        });

        let state = LlamaServerState::default();
        state.adopt_service(port1, Some(11111));
        assert!(state.status().healthy, "Il servizio adottato deve essere sano inizialmente");

        // 2. Il servizio esterno muore (simula chiusura esterna)
        stop_ext.store(true, Ordering::SeqCst);
        let _ = ext_thread.join();
        std::thread::sleep(Duration::from_millis(50));

        // 3. La domanda successiva rileva che il servizio è morto e ripiega senza blocco
        let (_port_q1, _pid_q1, is_ready_q1, status_q1, reason_q1) =
            state.get_or_adopt_or_start_service_with_timeout(Duration::from_millis(50));
        assert!(!is_ready_q1, "La domanda deve ripiegare perché il servizio adottato è morto");
        assert_eq!(status_q1, "in avvio", "Lo stato deve essere passato in avvio");
        assert!(reason_q1.is_some(), "Deve esserci un motivo visibile di ripiego");

        // 4. Nuovo avvio automatico del servizio proprio tramite trigger_background_start_with_binary
        std::env::set_var("LIMEN_TEST_DISABLE_ADOPTION", "1");
        state.trigger_background_start_with_binary(Some(mock_exe));

        let t0 = Instant::now();
        let mut recovered = false;
        while t0.elapsed() < Duration::from_secs(10) {
            let s = state.status();
            if s.healthy && s.port > 0 {
                recovered = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        assert!(recovered, "Un nuovo avvio automatico deve riuscire dopo la chiusura del servizio adottato");
        let (port_q2, _pid_q2, is_ready_q2, status_q2, _reason_q2) = state.get_or_adopt_or_start_service();
        std::env::remove_var("LIMEN_TEST_DISABLE_ADOPTION");
        assert!(is_ready_q2, "La domanda successiva al recupero deve trovare il servizio pronto");
        assert_eq!(status_q2, "pronto");
        assert!(port_q2.is_some());

        let _ = state.stop();
    }

    #[test]
    fn test_fase5i_n3_adopted_service_from_other_folder_logs_real_exe_and_panel_open_status() {
        let _env_lock = ENV_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let other_dir = tempfile::tempdir().unwrap();
        let other_exe = other_dir.path().join(if cfg!(windows) { "external_llama_server.exe" } else { "external_llama_server" });
        let base_mock = compile_test_mock_server(other_dir.path());
        if base_mock != other_exe {
            fs::copy(&base_mock, &other_exe).expect("Copia mock in altra cartella");
        }
        assert!(other_exe.is_file());

        let free_port = find_free_port().expect("Trova porta libera");
        let mut child = Command::new(&other_exe)
            .args(["--port", &free_port.to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("Avvio processo esterno in altra cartella");

        let child_pid = child.id();

        // Attendi che il server esterno sia attivo e risponda
        let t0 = Instant::now();
        let mut up = false;
        while t0.elapsed() < Duration::from_secs(5) {
            if check_health(free_port) {
                up = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(up, "Il processo esterno deve diventare sano");

        let log_dir = tempfile::tempdir().unwrap();
        let log_path = log_dir.path().join("local_model_timing.log");
        std::env::set_var("LIMEN_LOCAL_MODEL_TIMING_LOG", &log_path);

        let state = LlamaServerState::default();
        state.adopt_service(free_port, Some(child_pid));

        // 1. Verifica che state.get_binary_path() restituisca il percorso reale dell'eseguibile esterno
        let bin_path = state.get_binary_path();
        assert!(bin_path.is_some(), "Il percorso del binario adottato deve essere rilevato");
        let bin_str = bin_path.unwrap().to_string_lossy().to_lowercase();
        assert!(
            bin_str.contains("external_llama_server"),
            "Il percorso deve corrispondere all'eseguibile reale nella cartella esterna, ottenuto: {}",
            bin_str
        );

        // 2. Simula log di PANEL_OPEN_STATUS con il servizio adottato attivo
        let s_rep = state.status();
        let (srv_bin, srv_pid, srv_port) = if s_rep.running || s_rep.healthy {
            (state.get_binary_path(), s_rep.pid, if s_rep.port > 0 { Some(s_rep.port) } else { None })
        } else {
            (None, None, None)
        };
        log_local_model_timing_meta(
            "PANEL_OPEN_STATUS",
            123,
            srv_bin.as_deref(),
            srv_pid,
            srv_port,
            "installed=true, sha256_ok=true",
        );

        let content = fs::read_to_string(&log_path).expect("Lettura local_model_timing.log");

        assert!(content.contains("event=PANEL_OPEN_STATUS"), "Log deve contenere PANEL_OPEN_STATUS: {}", content);
        assert!(content.contains(&format!("service_pid={}", child_pid)), "PANEL_OPEN_STATUS deve riportare il PID del servizio: {}", content);
        assert!(content.contains(&format!("service_port={}", free_port)), "PANEL_OPEN_STATUS deve riportare la porta del servizio: {}", content);
        assert!(content.contains("service_exe=") && content.to_lowercase().contains("external_llama_server"), "service_exe deve contenere il percorso reale dell'eseguibile adottato: {}", content);

        std::env::remove_var("LIMEN_LOCAL_MODEL_TIMING_LOG");

        // Pulizia: terminazione del processo di test avviato da questo test
        let _ = child.kill();
        let _ = child.wait();
    }

    #[test]
    fn test_fase5i_n4_start_when_already_healthy_does_not_deadlock_and_returns_status() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stop_clone = stop_flag.clone();

        let server_thread = std::thread::spawn(move || {
            listener.set_nonblocking(true).unwrap();
            while !stop_clone.load(Ordering::SeqCst) {
                if let Ok((mut s, _)) = listener.accept() {
                    let mut buf = [0u8; 1024];
                    let _ = s.read(&mut buf);
                    let _ = s.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}");
                }
                std::thread::sleep(Duration::from_millis(5));
            }
        });

        let state = LlamaServerState::default();
        {
            let mut s = state.0.lock().unwrap();
            s.port = port;
        }

        // Chiamata a start_with_timeout: deve attraversare il ramo already_healthy (step 2)
        // e chiamare self.status() SENZA bloccarsi in deadlock sulla mutex
        let t0 = Instant::now();
        let res = state.start_with_timeout(Duration::from_secs(5));
        let elapsed = t0.elapsed();

        assert!(res.is_ok(), "L'avvio con servizio già sano deve riuscire: {:?}", res);
        assert!(elapsed < Duration::from_secs(2), "Non deve esserci deadlock né attesa timeout (impiegati {:?})", elapsed);

        let rep = res.unwrap();
        assert!(rep.healthy, "Il report restituito deve indicare servizio sano");
        assert_eq!(rep.port, port, "La porta restituita deve coincidere");
        assert!(!rep.starting, "starting deve essere false");

        stop_flag.store(true, Ordering::SeqCst);
        let _ = server_thread.join();
    }
}


