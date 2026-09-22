use crate::{
    snapshots::{child, compute_sha256 as hash, names, publish, read_path, root, write_new},
    vault,
};
use cap_std::fs::{Dir, OpenOptions};
#[cfg(unix)]
use cap_std::fs::OpenOptionsExt;
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
#[cfg(unix)]
use std::os::fd::AsRawFd;
use unicode_normalization::UnicodeNormalization;
const SERVICE: &str = "dev.arkai.limenvault.sync";
const LIMIT: usize = 8 * 1024 * 1024;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn random() -> String {
    let mut b = [0u8; 16];
    getrandom::fill(&mut b).unwrap();
    b.iter().map(|x| format!("{x:02x}")).collect()
}
fn id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 150
        && s.bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str, String> {
    v[key].as_str().ok_or(format!("Missing {key}"))
}
fn canonical(v: &Value) -> Vec<u8> {
    serde_json::to_vec(v).unwrap()
}
fn manifest_hash(m: &Value) -> String {
    let mut v = m.clone();
    let Some(object) = v.as_object_mut() else {
        return String::new();
    };
    object.remove("manifestHash");
    hash(&canonical(&v))
}
fn path_ok(s: &str) -> bool {
    !s.contains(['\\', '\0'])
        && s.len() < 1024
        && s.split('/').count() <= 32
        && s.split('/').all(|x| !x.is_empty() && !x.starts_with('.'))
}
#[derive(Clone)]
struct Plan {
    manifest: Value,
    bytes: BTreeMap<String, Vec<u8>>,
    vault: PathBuf,
    download: bool,
}
#[derive(Default)]
pub struct State {
    plans: Mutex<BTreeMap<String, Plan>>,
    cancel: Mutex<BTreeMap<String, Arc<AtomicBool>>>,
    busy: Mutex<()>,
    progress: Mutex<Value>,
}
fn key() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        security_framework::passwords::get_generic_password(SERVICE, "token")
            .map_err(|_| "AUTH_REQUIRED".to_string())
            .and_then(|v| String::from_utf8(v).map_err(err))
    }
    #[cfg(target_os = "windows")]
    {
        crate::keychain::win_load(SERVICE)?
            .ok_or_else(|| "AUTH_REQUIRED".to_string())
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Err("AUTH_REQUIRED".to_string())
    }
}
pub fn save_key(token: String) -> Result<(), String> {
    if token.len() < 24 || token.len() > 2048 || token.chars().any(char::is_whitespace) {
        return Err("Invalid connection token".into());
    }
    #[cfg(target_os = "macos")]
    {
        security_framework::passwords::set_generic_password(SERVICE, "token", token.as_bytes())
            .map_err(|_| "Keychain unavailable".into())
    }
    #[cfg(target_os = "windows")]
    {
        crate::keychain::win_save(SERVICE, "token", &token)
            .map_err(|_| "Windows Credential Manager unavailable".into())
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Err("Keychain unavailable".into())
    }
}
fn persist(data: &Path, operation: &str, p: &Plan) -> Result<(), String> {
    std::fs::create_dir_all(data).map_err(err)?;
    let d = root(data)?;
    let name = format!("sync-operation-{operation}");
    d.create_dir(&name).map_err(err)?;
    let op = child(&d, &name)?;
    #[cfg(unix)]
    if unsafe { libc::fchmod(op.as_raw_fd(), 0o700) } != 0 {
        return Err("Cannot protect transfer capture".into());
    }
    for (path, bytes) in &p.bytes {
        let h = hash(bytes);
        if !names(&op)?.contains(&h) {
            write_new(&op, &h, bytes)?;
        }
        if p.manifest["documents"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| v["relativePath"] == *path)
            .is_none()
        {
            return Err("Invalid capture".into());
        }
    }
    write_new(
        &op,
        "plan.json",
        &canonical(&json!({"manifest":p.manifest,"vaultPath":p.vault,"download":p.download})),
    )?;
    let tmp = format!("sync-pending-{}.tmp", random());
    write_new(
        &d,
        &tmp,
        &canonical(&json!({"operationId":operation,"vaultPath":p.vault})),
    )?;
    d.rename(&tmp, &d, "sync-pending.json").map_err(err)
}
fn restore(data: &Path, operation: &str) -> Result<Plan, String> {
    if !id(operation) {
        return Err("Invalid operation".into());
    }
    let d = root(data)?;
    let op = child(&d, &format!("sync-operation-{operation}"))?;
    let v: Value = serde_json::from_slice(&read_path(&op, "plan.json")?).map_err(err)?;
    let m = v["manifest"].clone();
    let download = v["download"] == true;
    if manifest_hash(&m) != text(&m, "manifestHash")? {
        return Err("Stored plan corrupted".into());
    }
    let mut bytes = BTreeMap::new();
    if !download {
        for doc in m["documents"].as_array().ok_or("Invalid plan")? {
            let h = text(doc, "sha256")?;
            let b = read_path(&op, h)?;
            if hash(&b) != h {
                return Err("Stored capture corrupted".into());
            }
            bytes.insert(text(doc, "relativePath")?.into(), b);
        }
    }
    Ok(Plan {
        manifest: m,
        bytes,
        vault: PathBuf::from(text(&v, "vaultPath")?),
        download,
    })
}
fn finished(data: &Path, operation: &str) {
    let pending = data.join("sync-pending.json");
    if std::fs::read(&pending)
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .is_some_and(|v| v["operationId"] == operation)
    {
        let _ = std::fs::remove_file(pending);
    }
}
fn config(data: &Path) -> Result<Value, String> {
    let bytes =
        std::fs::read(data.join("sync-config.json")).map_err(|_| "NOT_CONFIGURED".to_string())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(err)?;
    if v["enabled"] != true {
        return Err("DISABLED".into());
    }
    Ok(v)
}
pub fn save_config(data: &Path, v: Value) -> Result<(), String> {
    let endpoint = text(&v, "endpoint")?;
    let url = reqwest::Url::parse(endpoint).map_err(err)?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || url.username() != ""
        || url.password().is_some()
        || url.query().is_some()
    {
        return Err("HTTPS service endpoint required".into());
    }
    std::fs::create_dir_all(data).map_err(err)?;
    let d = root(data)?;
    let tmp = format!("sync-{}.tmp", random());
    write_new(
        &d,
        &tmp,
        &canonical(
            &json!({"enabled":v["enabled"]==true,"endpoint":endpoint.trim_end_matches('/'),"bucketName":v["bucketName"]}),
        ),
    )?;
    d.rename(&tmp, &d, "sync-config.json").map_err(err)
}
pub fn disconnect(data: &Path) -> Result<(), String> {
    if data.join("sync-config.json").exists() {
        std::fs::remove_file(data.join("sync-config.json")).map_err(err)?;
    }
    #[cfg(target_os = "macos")]
    {
        match security_framework::passwords::delete_generic_password(SERVICE, "token") {
            Ok(()) => Ok(()),
            Err(e) if e.code() == -25300 => Ok(()),
            Err(_) => Err("Keychain unavailable".into()),
        }
    }
    #[cfg(target_os = "windows")]
    {
        crate::keychain::win_delete(SERVICE)
            .map_err(|_| "Windows Credential Manager unavailable".into())
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Ok(())
    }
}
fn request(
    data: &Path,
    method: reqwest::Method,
    path: &str,
    body: Option<Vec<u8>>,
) -> Result<Vec<u8>, String> {
    let c = config(data)?;
    let endpoint = text(&c, "endpoint")?;
    let token = key()?;
    let client = reqwest::blocking::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(err)?;
    for attempt in 0..3 {
        let mut req = client
            .request(method.clone(), format!("{endpoint}/v1/{path}"))
            .bearer_auth(&token);
        if let Some(b) = &body {
            req = req.body(b.clone());
        }
        match req.send() {
            Ok(mut response) => {
                let code = response.status().as_u16();
                if response.status().is_success() {
                    use std::io::Read;
                    let mut bytes = Vec::new();
                    response
                        .by_ref()
                        .take((LIMIT + 1) as u64)
                        .read_to_end(&mut bytes)
                        .map_err(err)?;
                    if bytes.len() > LIMIT {
                        return Err("Response exceeds limit".into());
                    }
                    return Ok(bytes);
                }
                if code == 401 || code == 403 {
                    return Err("AUTH_REQUIRED".into());
                }
                if code == 409 {
                    return Err("CONFLICT".into());
                }
                if code != 429 && code < 500 {
                    return Err("Transfer request rejected".into());
                }
            }
            Err(_) => {}
        }
        if attempt < 2 {
            std::thread::sleep(Duration::from_millis(200 * (attempt + 1)));
        }
    }
    Err("OFFLINE: service unavailable after three attempts".into())
}
fn get(data: &Path, path: &str) -> Result<Value, String> {
    serde_json::from_slice(&request(data, reqwest::Method::GET, path, None)?).map_err(err)
}
pub fn status(data: &Path) -> Value {
    let pending = std::fs::read(data.join("sync-pending.json"))
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .unwrap_or(Value::Null);
    match config(data) {
        Ok(c) => {
            json!({"status":"READY","endpoint":c["endpoint"],"bucket":c["bucketName"],"pendingOperationId":pending["operationId"],"pendingVaultPath":pending["vaultPath"]})
        }
        Err(e) => json!({"status":if e=="DISABLED"{"DISABLED"}else{"NOT_CONFIGURED"}}),
    }
}
pub fn list_releases(data: &Path) -> Result<Value, String> {
    get(data, "private/releases")
}
pub fn test_connection(data: &Path) -> Result<Value, String> {
    let t = std::time::Instant::now();
    let remote = get(data, "status")?;
    let mut c = config(data)?;
    c["bucketName"] = remote["bucket"].clone();
    save_config(data, c)?;
    Ok(json!({"success":true,"latencyMs":t.elapsed().as_millis()}))
}
fn inspect(
    dir: &Dir,
    prefix: &str,
    published: bool,
    bytes: &mut BTreeMap<String, Vec<u8>>,
    docs: &mut Vec<Value>,
    excluded: &mut Vec<String>,
) -> Result<(), String> {
    if prefix.split('/').count() > 32 {
        return Err("Directory depth exceeded".into());
    }
    for name in names(dir)? {
        let rel = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };
        if name.starts_with('.')
            || [
                "SNAPSHOTS",
                "SEARCH_INDEX.json",
                "SYNC_PROFILE.json",
                "LOCK",
                "M7_PENDING.json",
            ]
            .contains(&name.as_str())
        {
            excluded.push(rel);
            continue;
        }
        let metadata = dir.symlink_metadata(&name).map_err(err)?;
        if metadata.file_type().is_symlink() {
            return Err("Symlink in Vault".into());
        }
        let category = rel.split('/').next().unwrap();
        if published && !vault::REQUIRED_VAULT_FOLDERS[1..11].contains(&category) {
            excluded.push(rel);
            continue;
        }
        if metadata.is_dir() {
            inspect(&child(dir, &name)?, &rel, published, bytes, docs, excluded)?;
            continue;
        }
        if !metadata.is_file() || metadata.len() > LIMIT as u64 {
            return Err("Invalid file or file too large".into());
        }
        if !path_ok(&rel) {
            return Err("Unsafe path".into());
        }
        let b = read_path(dir, &name)?;
        let fm = if name.ends_with(".md") {
            vault::frontmatter(std::str::from_utf8(&b).map_err(err)?)?
        } else {
            None
        };
        if published
            && (fm
                .as_ref()
                .is_none_or(|f| f["status"] != "approved" || !vault::valid_frontmatter(f)))
        {
            excluded.push(rel);
            continue;
        }
        let f = fm.unwrap_or(json!({}));
        let sha = hash(&b);
        let mut doc = json!({"id":rel,"relativePath":rel,"sha256":sha,"objectRef":sha,"sizeBytes":b.len(),"category":category,"status":if published{"approved"}else{"private"},"title":f["title"].as_str().unwrap_or(&name)});
        for k in ["client", "project", "updated_at"] {
            if let Some(v) = f[k].as_str() {
                doc[if k == "updated_at" { "updatedAt" } else { k }] = json!(v)
            }
        }
        bytes.insert(rel, b);
        docs.push(doc);
        if docs.len() > 1000 || bytes.values().map(|b| b.len()).sum::<usize>() > 256 * 1024 * 1024 {
            return Err("Release capacity exceeded".into());
        }
    }
    Ok(())
}
fn validate(m: &Value, scope: &Value, channel: &str) -> Result<(), String> {
    if m["tenantId"] != scope["tenantId"]
        || m["vaultId"] != scope["vaultId"]
        || m["channel"] != channel
        || m["schemaVersion"] != 1
        || manifest_hash(m) != text(m, "manifestHash")?
    {
        return Err("Invalid manifest".into());
    }
    let docs = m["documents"].as_array().ok_or("Invalid documents")?;
    let mut seen = BTreeSet::new();
    let mut total = 0u64;
    for d in docs {
        let p = text(d, "relativePath")?;
        if !path_ok(p)
            || !seen.insert(p.nfc().collect::<String>().to_lowercase())
            || d["sizeBytes"].as_u64().is_none_or(|v| v > LIMIT as u64)
            || text(d, "sha256")?.len() != 64
        {
            return Err("Invalid path/object".into());
        }
        total += d["sizeBytes"].as_u64().unwrap();
    }
    if docs.len() > 1000 || total > 256 * 1024 * 1024 {
        return Err("Release limit".into());
    }
    Ok(())
}
pub fn revoke_publication(data:&Path)->Result<Value,String>{
    serde_json::from_slice(&request(data,reqwest::Method::POST,"published/revoke",None)?).map_err(err)
}
impl State {
    pub fn progress(&self)->Value {self.progress.lock().unwrap().clone()}
    fn advance(&self, done:usize, total:usize, bytes:u64) {
        *self.progress.lock().unwrap()=json!({"status":"TRANSFERRING","completedFiles":done,"totalFiles":total,"completedBytes":bytes});
    }

    pub fn plan(
        &self,
        data: &Path,
        vault_path: &Path,
        operation: &str,
        selected_release: Option<&str>,
    ) -> Result<Value, String> {
        let _busy = self.busy.try_lock().map_err(|_| "Transfer busy")?;
        let scope = get(data, "status")?;
        let channel = if operation == "PUBLISH_APPROVED" {
            "published"
        } else {
            "private"
        };
        if !["UPLOAD_PRIVATE", "PUBLISH_APPROVED", "DOWNLOAD_COPY"].contains(&operation) {
            return Err("Unknown operation".into());
        }
        let current = get(data, &format!("{channel}/current"))?;
        let operation_id = random();
        let mut bytes = BTreeMap::new();
        let mut docs = vec![];
        let mut excluded = vec![];
        let download = operation == "DOWNLOAD_COPY";
        let manifest = if download {
            let release = selected_release.unwrap_or(text(&current, "releaseId")?);
            if !id(release) {
                return Err("Invalid release".into());
            }
            let m = get(data, &format!("private/release/{release}"))?;
            validate(&m, &scope, "private")?;
            if (selected_release.is_none() && m["manifestHash"] != current["manifestHash"])
                || m["releaseId"] != release
            {
                return Err("Release mismatch".into());
            }
            docs = m["documents"].as_array().unwrap().clone();
            m
        } else {
            let d = root(vault_path)?;
            let sys = child(&d, "00_SYSTEM")?;
            let mut lock_opts = OpenOptions::new();
            lock_opts.read(true).write(true).create(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                lock_opts.custom_flags(libc::O_NOFOLLOW);
            }
            let lock = sys.open_with(".m7-lock", &lock_opts).map_err(err)?;
            #[cfg(unix)]
            if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_SH | libc::LOCK_NB) } != 0 {
                return Err("M7 operation active".into());
            }
            if names(&sys)?.iter().any(|n| {
                ["M7_PENDING.json", "LOCK", ".compiler-lock", ".search-lock"].contains(&n.as_str())
            }) {
                return Err("Vault operation pending".into());
            }
            inspect(
                &d,
                "",
                channel == "published",
                &mut bytes,
                &mut docs,
                &mut excluded,
            )?;
            docs.sort_by(|a, b| a["relativePath"].as_str().cmp(&b["relativePath"].as_str()));
            let mut check = BTreeMap::new();
            let mut ignored = vec![];
            inspect(
                &d,
                "",
                channel == "published",
                &mut check,
                &mut ignored,
                &mut vec![],
            )?;
            if bytes != check {
                return Err("Vault changed during capture".into());
            }
            let now = chrono::Utc::now().to_rfc3339();
            let profile = if names(&sys)?.contains(&"SYNC_PROFILE.json".into()) {
                serde_json::from_slice::<Value>(&read_path(&sys, "SYNC_PROFILE.json")?)
                    .map_err(err)?
            } else {
                let p = json!({"schemaVersion":1,"vaultId":scope["vaultId"],"deviceId":random()});
                write_new(&sys, "SYNC_PROFILE.json", &canonical(&p))?;
                p
            };
            if profile["vaultId"] != scope["vaultId"] {
                return Err("Connection belongs to a different Vault".into());
            }
            let mut m = json!({"schemaVersion":1,"formatVersion":1,"tenantId":scope["tenantId"],"vaultId":scope["vaultId"],"channel":channel,"releaseId":format!("rel-{}",operation_id),"parentReleaseId":current["releaseId"],"deviceId":profile["deviceId"],"createdAt":now,"documents":docs});
            m["manifestHash"] = json!(manifest_hash(&m));
            m
        };
        let result = json!({"operationId":operation_id,"operation":operation,"channel":channel,"eligibleDocuments":docs,"excludedPaths":excluded,"totalBytes":docs.iter().map(|d|d["sizeBytes"].as_u64().unwrap_or(0)).sum::<u64>(),"baseReleaseId":manifest["parentReleaseId"]});
        let prepared = Plan {
            manifest,
            bytes,
            vault: vault_path.to_path_buf(),
            download,
        };
        persist(data, &operation_id, &prepared)?;
        self.plans.lock().unwrap().clear();
        self.plans
            .lock()
            .unwrap()
            .insert(operation_id.clone(), prepared);
        self.cancel
            .lock()
            .unwrap()
            .insert(operation_id, Arc::new(AtomicBool::new(false)));
        Ok(result)
    }
    pub fn select(&self, data: &Path, operation: &str, selected: &[String]) -> Result<String, String> {
        let _busy = self.busy.try_lock().map_err(|_| "Transfer busy")?;
        let mut p = restore(data, operation)?;
        if p.download || p.manifest["channel"] != "published" { return Err("Selection requires a publication plan".into()); }
        let selected: BTreeSet<_> = selected.iter().cloned().collect();
        let docs = p.manifest["documents"].as_array().ok_or("Invalid plan")?;
        if selected.iter().any(|path| !docs.iter().any(|d| d["relativePath"] == *path)) { return Err("Unknown selected note".into()); }
        p.manifest["documents"] = json!(docs.iter().filter(|d| selected.contains(d["relativePath"].as_str().unwrap_or(""))).cloned().collect::<Vec<_>>());
        p.bytes.retain(|path,_| selected.contains(path));
        let operation = random();
        p.manifest["releaseId"] = json!(format!("rel-{operation}"));
        p.manifest["manifestHash"] = json!(manifest_hash(&p.manifest));
        persist(data, &operation, &p)?;
        self.plans.lock().unwrap().insert(operation.clone(),p);
        Ok(operation)
    }
    pub fn cancel(&self, operation: &str) {
        if let Some(c) = self.cancel.lock().unwrap().get(operation) {
            c.store(true, Ordering::SeqCst);
        }
    }
    pub fn execute(&self,data:&Path,operation:&str,vault_path:&Path)->Result<Value,String>{
        let result=self.execute_inner(data,operation,vault_path);
        *self.progress.lock().unwrap()=Value::Null;
        result
    }
    fn execute_inner(
        &self,
        data: &Path,
        operation: &str,
        vault_path: &Path,
    ) -> Result<Value, String> {
        let _busy = self.busy.try_lock().map_err(|_| "Transfer busy")?;
        let plan = match self.plans.lock().unwrap().get(operation).cloned() {
            Some(p) => p,
            None => restore(data, operation)?,
        };
        if plan.vault != vault_path {
            return Err("Vault changed".into());
        }
        let cancel = self
            .cancel
            .lock()
            .unwrap()
            .entry(operation.to_string())
            .or_insert_with(|| Arc::new(AtomicBool::new(false)))
            .clone();
        cancel.store(false, Ordering::SeqCst);
        let channel = text(&plan.manifest, "channel")?;
        let release = text(&plan.manifest, "releaseId")?;
        let total=plan.manifest["documents"].as_array().unwrap().len();
        let mut completed_bytes=0u64;
        self.advance(0,total,0);
        if !plan.download {
            for (index,d) in plan.manifest["documents"].as_array().unwrap().iter().enumerate() {
                if cancel.load(Ordering::SeqCst) {
                    return Err("CANCELLED".into());
                }
                request(
                    data,
                    reqwest::Method::PUT,
                    &format!("{channel}/object/{}", text(d, "sha256")?),
                    Some(plan.bytes[text(d, "relativePath")?].clone()),
                )?;
                completed_bytes+=d["sizeBytes"].as_u64().unwrap_or(0);
                self.advance(index+1,total,completed_bytes);
            }
            if cancel.load(Ordering::SeqCst) {
                return Err("CANCELLED".into());
            }
            let result = request(
                data,
                reqwest::Method::POST,
                &format!("{channel}/commit"),
                Some(canonical(&plan.manifest)),
            )?;
            finished(data, operation);
            return serde_json::from_slice(&result).map_err(err);
        }
        let parent_path = vault_path.parent().ok_or("Invalid destination")?;
        let parent = root(parent_path)?;
        let name = format!("LIMEN-copy-{operation}");
        if names(&parent)?.contains(&name) {
            let existing = child(&parent, &name)?;
            verify_import(&existing, operation, &plan.manifest)?;
            finished(data, operation);
            return Ok(json!({"status":"IMPORTED","releaseId":release,"targetVaultPath":parent_path.join(&name)}));
        }
        let stage = format!(".limen-download-{operation}-{}", random());
        parent.create_dir(&stage).map_err(err)?;
        let staging = child(&parent, &stage)?;
        for (index,d) in plan.manifest["documents"].as_array().unwrap().iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                return Err("CANCELLED: partial staging retained".into());
            }
            let relative = text(d, "relativePath")?;
            let sha = text(d, "sha256")?;
            let bytes = request(
                data,
                reqwest::Method::GET,
                &format!("private/release/{release}/{sha}"),
                None,
            )?;
            if hash(&bytes) != sha || bytes.len() as u64 != d["sizeBytes"].as_u64().unwrap() {
                return Err("Object integrity mismatch".into());
            }
            let mut directory = staging.try_clone().map_err(err)?;
            let parts: Vec<_> = relative.split('/').collect();
            for part in &parts[..parts.len() - 1] {
                if !names(&directory)?.contains(&part.to_string()) {
                    directory.create_dir(part).map_err(err)?;
                }
                directory = child(&directory, part)?;
            }
            write_new(&directory, parts.last().unwrap(), &bytes)?;
            completed_bytes+=bytes.len() as u64;
            self.advance(index+1,total,completed_bytes);
        }
        for folder in vault::REQUIRED_VAULT_FOLDERS {
            if !names(&staging)?.contains(&folder.to_string()) {
                staging.create_dir(folder).map_err(err)?;
            }
        }
        let sys = child(&staging, "00_SYSTEM")?;
        write_new(
            &sys,
            "SYNC_PROFILE.json",
            &canonical(
                &json!({"schemaVersion":1,"vaultId":plan.manifest["vaultId"],"deviceId":random()}),
            ),
        )?;
        let staged = parent_path.join(&stage);
        let validation = vault::perform_vault_validation(&staged);
        if !validation.is_valid {
            return Err(format!(
                "Invalid downloaded Vault: {}",
                validation.errors.join("; ")
            ));
        }
        write_new(&staging,".m10-import.json",&canonical(&json!({"operationId":operation,"manifestHash":plan.manifest["manifestHash"]})))?;
        publish(&parent, &stage, &name)?;
        finished(data, operation);
        Ok(
            json!({"status":"IMPORTED","releaseId":release,"targetVaultPath":parent_path.join(name)}),
        )
    }
}

fn verify_import(dir:&Dir, operation:&str, manifest:&Value)->Result<(),String>{
    let receipt:Value=serde_json::from_slice(&read_path(dir,".m10-import.json")?).map_err(err)?;
    if receipt["operationId"]!=operation || receipt["manifestHash"]!=manifest["manifestHash"] {return Err("Destination belongs to another operation".into());}
    for doc in manifest["documents"].as_array().ok_or("Invalid manifest")? {
        let bytes=read_path(dir,text(doc,"relativePath")?)?;
        if hash(&bytes)!=text(doc,"sha256")? || Some(bytes.len() as u64)!=doc["sizeBytes"].as_u64(){return Err("Recovered destination was modified".into());}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sync_rejects_paths_and_collisions() {
        assert!(!path_ok("../outside"));
        assert!(!path_ok("/absolute"));
        assert!(!path_ok("a/../b"));
        assert!(!path_ok("a\\b"));
        let scope = json!({"tenantId":"t","vaultId":"v"});
        let mut m = json!({"schemaVersion":1,"tenantId":"t","vaultId":"v","channel":"private","documents":[{"relativePath":"A.md","sizeBytes":1,"sha256":"a".repeat(64)},{"relativePath":"a.md","sizeBytes":1,"sha256":"a".repeat(64)}]});
        m["manifestHash"] = json!(manifest_hash(&m));
        assert!(validate(&m, &scope, "private").is_err());
    }
    #[test]
    fn sync_capture_rejects_symlink_and_freezes_bytes() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir(tmp.path().join("01_CLIENTS")).unwrap();
        std::fs::write(tmp.path().join("01_CLIENTS/a.txt"), "first").unwrap();
        let dir = root(tmp.path()).unwrap();
        let mut bytes = BTreeMap::new();
        inspect(&dir, "", false, &mut bytes, &mut vec![], &mut vec![]).unwrap();
        std::fs::write(tmp.path().join("01_CLIENTS/a.txt"), "second").unwrap();
        assert_eq!(bytes["01_CLIENTS/a.txt"], b"first");
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(tmp.path(), tmp.path().join("link")).unwrap();
            assert!(inspect(
                &dir,
                "",
                false,
                &mut BTreeMap::new(),
                &mut vec![],
                &mut vec![]
            )
            .is_err());
        }
    }
    #[test]
    fn sync_config_rejects_insecure_endpoints() {
        let t = tempfile::tempdir().unwrap();
        assert!(save_config(
            t.path(),
            json!({"enabled":true,"endpoint":"http://insecure.example"})
        )
        .is_err());
        assert!(save_config(
            t.path(),
            json!({"enabled":true,"endpoint":"https://user:password@example.com"})
        )
        .is_err());
        assert!(save_config(
            t.path(),
            json!({"enabled":false,"endpoint":"https://example.com"})
        )
        .is_ok());
        assert_eq!(status(t.path())["status"], "DISABLED");
    }
    #[test]
    fn sync_persisted_capture_survives_state_restart_and_detects_corruption() {
        let tmp = tempfile::tempdir().unwrap();
        let b = b"frozen".to_vec();
        let h = hash(&b);
        let mut m = json!({"channel":"private","documents":[{"relativePath":"01_CLIENTS/a.txt","sha256":h}]});
        m["manifestHash"] = json!(manifest_hash(&m));
        let p = Plan {
            manifest: m,
            bytes: BTreeMap::from([("01_CLIENTS/a.txt".into(), b.clone())]),
            vault: tmp.path().join("vault"),
            download: false,
        };
        persist(tmp.path(), "op1", &p).unwrap();
        assert_eq!(
            restore(tmp.path(), "op1").unwrap().bytes["01_CLIENTS/a.txt"],
            b
        );
        std::fs::write(tmp.path().join("sync-operation-op1").join(h), "corrupted").unwrap();
        assert!(restore(tmp.path(), "op1").is_err());
        assert_eq!(manifest_hash(&Value::Null), "");
    }
    #[test]
    fn sync_selection_persists_only_selected_frozen_notes() {
        let tmp=tempfile::tempdir().unwrap();
        let bytes=BTreeMap::from([("01_CLIENTS/a.md".to_string(),b"a".to_vec()),("01_CLIENTS/b.md".to_string(),b"b".to_vec())]);
        let docs:Vec<_>=bytes.iter().map(|(p,b)|json!({"relativePath":p,"sha256":hash(b)})).collect();
        let mut m=json!({"channel":"published","documents":docs});m["manifestHash"]=json!(manifest_hash(&m));
        persist(tmp.path(),"original",&Plan{manifest:m,bytes,vault:tmp.path().join("vault"),download:false}).unwrap();
        let state=State::default();
        assert!(state.select(tmp.path(),"original",&["../unknown".into()]).is_err());
        let op=state.select(tmp.path(),"original",&["01_CLIENTS/a.md".into()]).unwrap();
        let selected=restore(tmp.path(),&op).unwrap();
        assert_eq!(selected.bytes.len(),1);assert_eq!(selected.bytes["01_CLIENTS/a.md"],b"a");
        assert_eq!(selected.manifest["documents"].as_array().unwrap().len(),1);
        assert_eq!(restore(tmp.path(),"original").unwrap().bytes.len(),2);
    }

    #[test]
    fn sync_import_receipt_recovers_commit_window_without_overwrite() {
        let tmp=tempfile::tempdir().unwrap();let dir=root(tmp.path()).unwrap();
        write_new(&dir,"note.md",b"original").unwrap();
        let m=json!({"manifestHash":"fixture","documents":[{"relativePath":"note.md","sha256":hash(b"original"),"sizeBytes":8}]});
        assert!(verify_import(&dir,"op1",&m).is_err());
        write_new(&dir,".m10-import.json",&canonical(&json!({"operationId":"op1","manifestHash":"fixture"}))).unwrap();
        verify_import(&dir,"op1",&m).unwrap();assert!(verify_import(&dir,"other",&m).is_err());
        std::fs::write(tmp.path().join("note.md"),b"changed!").unwrap();assert!(verify_import(&dir,"op1",&m).is_err());
    }

}
