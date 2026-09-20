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
pub const DEFAULT_LOCAL_PORT: u16 = 8088;
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
    model_path: PathBuf,
    binary_path: Option<PathBuf>,
    last_error: Option<String>,
    crash_count: u32,
}

#[derive(Clone, Default)]
pub struct LlamaServerState(Arc<Mutex<RunningState>>);

pub fn get_models_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let dir = Path::new(&home).join("Library/Application Support/LIMEN Vault/models");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

pub fn get_target_model_path() -> Result<PathBuf, String> {
    Ok(get_models_dir()?.join(EXPECTED_MODEL_FILE_NAME))
}

pub fn compute_file_sha256(path: &Path) -> Result<String, String> {
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

/// Detects if model exists at target path or in local caches.
/// If found in existing HuggingFace cache and valid, links or copies it to target path.
pub fn local_model_status() -> LocalModelReport {
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

    // If target does not exist, check common local huggingface snapshot location
    if !target.exists() {
        if let Ok(home) = std::env::var("HOME") {
            let hf_candidate = Path::new(&home)
                .join(".cache/huggingface/hub/models--gpustack--bge-m3-GGUF/snapshots/2d48f1737679ad900d5c26c5aad5410e9c70fdca/bge-m3-Q8_0.gguf");
            if hf_candidate.exists() {
                if let Ok(meta) = fs::metadata(&hf_candidate) {
                    if meta.len() == EXPECTED_MODEL_SIZE_BYTES {
                        // Create symlink or copy to target
                        let _ = std::os::unix::fs::symlink(&hf_candidate, &target);
                    }
                }
            }
        }
    }

    if target.exists() {
        let meta = match fs::metadata(&target) {
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

        let sha256_ok = if bytes == EXPECTED_MODEL_SIZE_BYTES {
            match compute_file_sha256(&target) {
                Ok(hash) => {
                    let ok = hash.to_lowercase() == EXPECTED_MODEL_SHA256.to_lowercase();
                    if !ok {
                        eprintln!("[llama] Hash mismatch on {}: {} vs expected {}", target.display(), hash, EXPECTED_MODEL_SHA256);
                        let _ = fs::remove_file(&target);
                    }
                    ok
                }
                Err(_) => false,
            }
        } else {
            eprintln!("[llama] File size mismatch on {}: {} vs expected {}", target.display(), bytes, EXPECTED_MODEL_SIZE_BYTES);
            let _ = fs::remove_file(&target);
            false
        };

        LocalModelReport {
            installed: sha256_ok,
            path: target.to_string_lossy().to_string(),
            bytes,
            sha256_ok,
        }
    } else {
        LocalModelReport {
            installed: false,
            path: target.to_string_lossy().to_string(),
            bytes: 0,
            sha256_ok: false,
        }
    }
}

pub fn install_model_from_file(source_path: &Path) -> Result<LocalModelReport, String> {
    if !source_path.is_file() {
        return Err(format!("File non trovato: {:?}", source_path));
    }
    let target = get_target_model_path()?;
    let meta = fs::metadata(source_path).map_err(|e| e.to_string())?;
    if meta.len() != EXPECTED_MODEL_SIZE_BYTES {
        return Err(format!(
            "Dimensione file non corretta: {} byte (richiesti esattamente {} byte)",
            meta.len(),
            EXPECTED_MODEL_SIZE_BYTES
        ));
    }

    let hash = compute_file_sha256(source_path)?;
    if hash.to_lowercase() != EXPECTED_MODEL_SHA256.to_lowercase() {
        return Err(format!(
            "Verifica SHA-256 fallita: calcolato {} vs atteso {}",
            hash, EXPECTED_MODEL_SHA256
        ));
    }

    fs::copy(source_path, &target).map_err(|e| e.to_string())?;
    Ok(local_model_status())
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
    Ok(local_model_status())
}

pub fn detect_llama_server_binary() -> Option<PathBuf> {
    // 1. Packaged application bundle helper
    if let Ok(executable) = std::env::current_exe() {
        if let Some(bundle_contents) = executable
            .parent()
            .filter(|p| p.file_name().is_some_and(|n| n == "MacOS"))
            .and_then(|p| p.parent())
        {
            let helper = bundle_contents.join("Resources/native/llama-server");
            if helper.is_file() {
                return Some(helper);
            }
        }
    }

    // 2. Packaged development resources
    let cand_dev = [
        "apps/desktop/src-tauri/resources/native/llama-server",
        "resources/native/llama-server",
    ];
    for c in &cand_dev {
        let pb = PathBuf::from(c);
        if pb.is_file() {
            return Some(pb);
        }
    }

    // 3. Custom environment variable
    if let Ok(p) = std::env::var("LLAMA_SERVER_PATH") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
    }

    // 4. Fallback: system homebrew
    for c in &[
        "/opt/homebrew/bin/llama-server",
        "/usr/local/bin/llama-server",
        "/usr/bin/llama-server",
    ] {
        let pb = PathBuf::from(c);
        if pb.is_file() {
            return Some(pb);
        }
    }

    None
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

    let body_part = if let Some(idx) = response_str.find("\r\n\r\n") {
        &response_str[idx + 4..]
    } else {
        &response_str
    };

    let val: serde_json::Value = serde_json::from_str(body_part).map_err(|e| {
        format!(
            "Risposta JSON non valida: {} (corpo: {})",
            e,
            body_part.chars().take(200).collect::<String>()
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
        let _ = c.wait();
    }
    s.port = 0;
}

impl LlamaServerState {
    pub fn get_port(&self) -> u16 {
        let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
        s.port
    }

    pub fn status(&self) -> LocalServerReport {
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

        let running = s.child.is_some() || (s.port > 0 && check_health(s.port));
        let healthy = s.port > 0 && check_health(s.port);
        let pid = s.child.as_ref().map(|c| c.id());

        LocalServerReport {
            running,
            port: s.port,
            pid,
            model: "bge-m3-Q8_0.gguf".to_string(),
            healthy,
            last_error: s.last_error.clone(),
        }
    }

    pub fn start(&self) -> Result<LocalServerReport, String> {
        // 1. Verify model is installed
        let model_rep = local_model_status();
        if !model_rep.installed || !model_rep.sha256_ok {
            return Err("Modello locale bge-m3-Q8_0.gguf non installato o non integro. Esegui il download dalle impostazioni.".into());
        }
        let model_path = PathBuf::from(model_rep.path);

        // 2. Check if already healthy
        {
            let s = self.0.lock().unwrap_or_else(|e| e.into_inner());
            if s.port > 0 && check_health(s.port) {
                drop(s);
                return Ok(self.status());
            }
        }

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

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());

        let child = cmd
            .spawn()
            .map_err(|e| format!("Impossibile avviare il processo llama-server: {}", e))?;

        s.child = Some(child);
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
                    guard.last_error = Some(format!("llama-server uscito con codice {}", code));
                    return Err(format!("Avvio llama-server fallito (codice {})", code));
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

        Ok(self.status())
    }

    pub fn ensure_running(&self) -> Result<u16, String> {
        let s = self.0.lock().map_err(|e| e.to_string())?;
        if s.port > 0 && check_health(s.port) {
            return Ok(s.port);
        }
        drop(s);

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
        let mut s = self.0.lock().map_err(|e| e.to_string())?;
        stop_child(&mut s);
        s.last_error = None;
        drop(s);
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
    fn test_detect_llama_server_binary() {
        let bin = detect_llama_server_binary();
        assert!(bin.is_some(), "llama-server binary should be detectable");
    }

    #[test]
    fn test_find_free_port() {
        let port = find_free_port().unwrap();
        assert!(port > 1024);
    }
}
