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
}

#[derive(Clone, Default)]
pub struct LlamaServerState(Arc<Mutex<RunningState>>);

use std::sync::atomic::{AtomicU64, Ordering};

pub static MODEL_SHA256_COMPUTE_COUNT: AtomicU64 = AtomicU64::new(0);

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

pub fn log_local_model_timing(event: &str, elapsed_ms: u64, details: &str) {
    let log_path = get_local_model_timing_log_path();
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let line = format!("{} | event={} | elapsed_ms={} | details={}\n", now, event, elapsed_ms, details);
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = f.write_all(line.as_bytes());
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

pub fn detect_llama_server_binary() -> Option<PathBuf> {
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

    if let Ok(p) = std::env::var("LLAMA_SERVER_PATH") {
        let pb = PathBuf::from(p);
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

/// Verifica se un processo con il PID specificato è attualmente vivo nel sistema operativo.
pub fn is_process_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("Get-Process -Id {} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id", pid)])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok();
        if let Some(o) = out {
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
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("Get-NetTCPConnection -OwningProcess {} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort", pid)])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        text.lines().find_map(|l| l.trim().parse::<u16>().ok())
    }
    #[cfg(unix)]
    {
        let out = std::process::Command::new("lsof")
            .args(["-Pan", "-p", &pid.to_string(), "-iTCP", "-sTCP:LISTEN"])
            .output()
            .ok()?;
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
    // 1. Variabile d'ambiente
    if let Ok(env_val) = std::env::var("LIMEN_LOCAL_PORT") {
        if let Ok(env_port) = env_val.trim().parse::<u16>() {
            if check_health(env_port) && verify_dimensions(env_port).is_ok() {
                let pid = pid_file_path().and_then(|p| read_pid_file(&p));
                return Ok((env_port, pid));
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
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-Process -Name 'llama-server' -ErrorAction SilentlyContinue | ForEach-Object { $p = $_.Id; Get-NetTCPConnection -OwningProcess $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { \"$p:$($_.LocalPort)\" } }"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok();
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
        let out = std::process::Command::new("pgrep")
            .arg("llama-server")
            .output()
            .ok();
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
        let out = Command::new("/bin/ps")
            .args(["-o", "ppid=,command=", "-p", &pid.to_string()])
            .output()
            .ok()?;
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
        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("Get-CimInstance Win32_Process -Filter 'ProcessId = {}' | Select-Object -ExpandProperty ParentProcessId", pid)])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
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

fn stop_child(s: &mut RunningState) {
    if let Some(mut c) = s.child.take() {
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
        // Attesa con limite massimo (max 500ms aggiuntivi), MAI c.wait() indefinito
        for _ in 0..10 {
            if c.try_wait().ok().flatten().is_some() {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }
    let owned = s.child.as_ref().map(|c| c.id()).or(s.owned_pid);
    if let Some(pid) = owned {
        remove_service_registration_if_owned(pid);
    }
    s.owned_pid = None;
    s.adopted_pid = None;
    s.port = 0;
}

impl LlamaServerState {
    pub fn get_port(&self) -> u16 {
        let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.port
    }

    pub fn status(&self) -> LocalServerReport {
        // Estrae lo stato rilasciando IMMEDIATAMENTE il mutex: non tiene il lock durante check_health di rete
        let (port, has_child, pid, last_error) = {
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
            (s.port, s.child.is_some(), pid, s.last_error.clone())
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
        }
    }

    pub fn adopt_service(&self, port: u16, pid: Option<u32>) {
        let mut s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.port = port;
        s.adopted_pid = pid;
        s.owned_pid = None;
        s.last_error = None;
    }

    pub fn get_or_adopt_or_start_service(&self) -> (Option<u16>, Option<u32>, bool, Option<String>) {
        let s = self.status();
        if s.healthy && s.port > 0 {
            return (Some(s.port), s.pid, true, None);
        }

        match find_active_bge_m3_service_with_pid() {
            Ok((port, pid)) => {
                self.adopt_service(port, pid);
                (Some(port), pid, true, None)
            }
            Err(discover_err) => {
                match self.start() {
                    Ok(rep) if rep.healthy => {
                        (Some(rep.port), rep.pid, true, None)
                    }
                    Ok(rep) => {
                        let reason = format!(
                            "Servizio locale avviato ma non pronto (porta {}): ripiego sulla ricerca per parole. {}",
                            rep.port,
                            rep.last_error.unwrap_or_default()
                        );
                        (None, None, false, Some(reason))
                    }
                    Err(start_err) => {
                        let reason = format!(
                            "Nessun servizio esterno verificato ({}) e avvio del proprio servizio fallito ({}): ripiego sulla ricerca per parole.",
                            discover_err, start_err
                        );
                        (None, None, false, Some(reason))
                    }
                }
            }
        }
    }

    pub fn start(&self) -> Result<LocalServerReport, String> {
        let t_start = Instant::now();
        // 1. Verify model is installed
        let model_rep = local_model_status();
        if !model_rep.installed || !model_rep.sha256_ok {
            return Err("Modello locale bge-m3-Q8_0.gguf non installato o non integro. Esegui il download dalle impostazioni.".into());
        }
        let model_path = PathBuf::from(model_rep.path);

        // 2. Check if already healthy (verifica di rete eseguita FUORI dal mutex)
        let already_port = {
            let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            s.port
        };
        if already_port > 0 && check_health(already_port) {
            return Ok(self.status());
        }

        // 2b. Un server orfano di un'istanza precedente (app uccisa) va terminato prima di avviarne un altro
        let _ = reap_orphan_server();

        // 3. Find standalone or system binary
        let binary = detect_llama_server_binary().ok_or_else(|| {
            "Binario llama-server non disponibile nel pacchetto o nel sistema.".to_string()
        })?;

        let mut s = self.0.lock().map_err(|e| e.to_string())?;
        stop_child(&mut s);
        s.last_error = None;

        // 4. Choose free port
        let port = find_free_port()?;

        // 5. Spawn llama-server with exact arguments
        let mut cmd = Command::new(&binary);
        cmd.args([
            "-m", &model_path.to_string_lossy(),
            "--embedding",
            "--host", "127.0.0.1",
            "--port", &port.to_string(),
            "-ub", "2048",
            "-b", "2048",
        ]);

        // Backend Metal. ggml cerca i backend nella cartella compilata nel binario
        // (/opt/homebrew/Cellar/ggml/<ver>/libexec): se su questo Mac esiste, trova li' le librerie
        // Homebrew firmate ad-hoc, che il runtime indurito rifiuta ("different Team IDs"), e NON ripiega
        // su quelle incluse nell'app: il server parte con la sola CPU. Verificato il 20/09/2026 con
        // `--list-devices`: "(none)" con la cartella visibile, "BLAS + MTL0" con la cartella nascosta;
        // 0,65 s/passaggio su CPU contro 0,09 s con Metal. GGML_BACKEND_PATH carica esplicitamente la
        // libreria Metal inclusa e non duplica il dispositivo quando e' gia' stato trovato.
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
        // stderr su file accanto al modello: senza, un avvio fallito non lascia alcuna causa
        // leggibile (caso reale: "no backends are loaded" nascosto dietro un semplice "exit status 1").
        let log_path = model_path.parent().map(|p| p.join("llama-server.log"));
        match log_path.as_ref().and_then(|p| std::fs::File::create(p).ok()) {
            Some(f) => { cmd.stderr(Stdio::from(f)); }
            None => { cmd.stderr(Stdio::null()); }
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Impossibile avviare il processo llama-server: {}", e))?;

        let child_pid = child.id();
        let _ = write_service_registration(child_pid, port);
        s.child = Some(child);
        s.owned_pid = Some(child_pid);
        s.port = port;
        s.model_path = model_path;
        s.binary_path = Some(binary);
        drop(s);

        // 6. Poll /health endpoint up to 25 seconds
        let deadline = Instant::now() + Duration::from_secs(25);
        let mut healthy = false;
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(200));
            if check_health(port) {
                healthy = true;
                break;
            }

            // Check if crashed
            let mut guard = self.0.lock().map_err(|e| e.to_string())?;
            if let Some(c) = guard.child.as_mut() {
                if let Ok(Some(code)) = c.try_wait() {
                    guard.child = None;
                    // Ultime righe dello stderr: e' la causa reale, va mostrata all'utente.
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
                    guard.last_error = Some(format!("llama-server uscito con codice {}{}", code, detail));
                    return Err(format!("Avvio llama-server fallito (codice {}){}", code, detail));
                }
            }
        }

        if !healthy {
            self.stop()?;
            return Err("Timeout: llama-server non ha risposto sull'endpoint /health entro 25s.".into());
        }

        // 7. Verify dimensions are exactly 1024
        if let Err(e) = verify_dimensions(port) {
            self.stop()?;
            return Err(format!("Controllo dimensioni vettore fallito: {}", e));
        }

        let elapsed = t_start.elapsed().as_millis() as u64;
        let child_pid = {
            let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            s.child.as_ref().map(|c| c.id())
        };
        log_local_model_timing(
            "SERVICE_START",
            elapsed,
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
        let me = std::process::id();
        let (ppid, cmd) = process_parent_and_command(me).expect("ps deve leggere il processo corrente");
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
        let (port_opt, _pid_opt, is_ready, fallback_reason) = state.get_or_adopt_or_start_service();
        assert!(is_ready, "Servizio registrato valido deve risultare pronto");
        assert_eq!(port_opt, Some(mock_port));
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
}
