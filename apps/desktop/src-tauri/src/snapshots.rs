use cap_std::{
    ambient_authority,
    fs::{Dir, OpenOptions},
};
#[cfg(unix)]
use cap_std::fs::OpenOptionsExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    ffi::CString,
    io::{Read, Write},
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};
#[cfg(unix)]
use std::os::fd::AsRawFd;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct VaultIntegrityReportResponse {
    pub is_integrity_valid: bool,
    pub manifest_present: bool,
    pub total_manifested_files: usize,
    pub verified_files_count: usize,
    pub modified_files: Vec<String>,
    pub missing_files: Vec<String>,
    pub added_files: Vec<String>,
    pub errors: Vec<String>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SnapshotItemResponse {
    pub id: String,
    pub vault_path: String,
    pub snapshot_path: String,
    pub created_at: String,
    pub note: Option<String>,
    pub manifest_file_count: usize,
    pub integrity_status: String,
}
#[derive(Clone, Debug, PartialEq)]
struct Entry {
    sha: String,
    size: u64,
}
type Files = BTreeMap<String, Entry>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
pub fn compute_sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn component(s: &str) -> Result<(), String> {
    if s.is_empty() || s == "." || s == ".." || s.contains(['/', '\\', '\0']) {
        Err("Unsafe path component".into())
    } else {
        Ok(())
    }
}
fn relative(s: &str) -> Result<(), String> {
    for p in s.split('/') {
        component(p)?;
    }
    Ok(())
}
pub(crate) fn root(path: &Path) -> Result<Dir, String> {
    if !path.is_absolute() {
        return Err("Absolute vault path required".into());
    }
    let p = path.canonicalize().map_err(err)?;
    #[cfg(windows)]
    let p = {
        let s = p.to_string_lossy();
        if let Some(stripped) = s.strip_prefix(r"\\?\") {
            std::path::PathBuf::from(stripped)
        } else {
            p
        }
    };
    Dir::open_ambient_dir(&p, ambient_authority()).map_err(err)
}
pub(crate) fn child(dir: &Dir, name: &str) -> Result<Dir, String> {
    component(name)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut opts = OpenOptions::new();
        opts.read(true);
        opts.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK | libc::O_DIRECTORY);
        let f = dir.open_with(name, &opts).map_err(err)?;
        Ok(Dir::from_std_file(f.into_std()))
    }
    #[cfg(not(unix))]
    {
        dir.open_dir(name).map_err(err)
    }
}
pub(crate) fn read(dir: &Dir, name: &str) -> Result<Vec<u8>, String> {
    component(name)?;
    let mut opts = OpenOptions::new();
    opts.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
    }
    let mut f = dir.open_with(name, &opts).map_err(err)?;
    let before = f.metadata().map_err(err)?;
    if !before.is_file() {
        return Err("Not a regular file".into());
    }
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes).map_err(err)?;
    let after = f.metadata().map_err(err)?;
    drop(f);
    if before.len() != after.len()
        || before.modified().map_err(err)? != after.modified().map_err(err)?
    {
        return Err("File changed while reading".into());
    }
    Ok(bytes)
}
pub(crate) fn read_path(dir: &Dir, path: &str) -> Result<Vec<u8>, String> {
    relative(path)?;
    let parts: Vec<_> = path.split('/').collect();
    let mut d = dir.try_clone().map_err(err)?;
    for p in &parts[..parts.len() - 1] {
        d = child(&d, p)?;
    }
    read(&d, parts[parts.len() - 1])
}
pub(crate) fn names(d: &Dir) -> Result<Vec<String>, String> {
    let mut result = Vec::new();
    for e in d.entries().map_err(err)? {
        result.push(
            e.map_err(err)?
                .file_name()
                .into_string()
                .map_err(|_| "Non UTF-8 filename")?,
        );
    }
    result.sort();
    Ok(result)
}
pub const RECONSTRUCTIBLE_SYSTEM_FILES: &[&str] = &[
    "00_SYSTEM/VAULT_CATALOG.json",
    "00_SYSTEM/VAULT_CATALOG.bak.json",
    "00_SYSTEM/SEARCH_INDEX.json",
    "00_SYSTEM/EMBEDDINGS_CACHE.json",
    "00_SYSTEM/.m7-lock",
];

pub const STATE_SYSTEM_FILES: &[&str] = &[
    "00_SYSTEM/VAULT_ID.json",
    "00_SYSTEM/OPENAI_CONSENT.json",
    "00_SYSTEM/SYNC_PROFILE.json",
    "00_SYSTEM/AUTO_KNOWLEDGE.json",
    "00_SYSTEM/AUTO_KNOWLEDGE_CONFIG.json",
    "00_SYSTEM/M7_STATE.json",
    "00_SYSTEM/M7_PENDING.json",
    "00_SYSTEM/COMPILER_INDEX.json",
];

fn is_technical_exclusion(rel: &str) -> bool {
    rel == "00_SYSTEM/SNAPSHOTS"
        || rel.starts_with("00_SYSTEM/SNAPSHOTS/")
        || rel
            .split('/')
            .any(|n| [".git", "node_modules", ".DS_Store", ".gitkeep", ".obsidian"].contains(&n))
}

pub fn is_excluded_from_integrity(rel: &str) -> bool {
    if is_technical_exclusion(rel) {
        return true;
    }
    RECONSTRUCTIBLE_SYSTEM_FILES.contains(&rel) || STATE_SYSTEM_FILES.contains(&rel)
}

pub fn is_excluded_from_snapshots(rel: &str) -> bool {
    if is_technical_exclusion(rel) {
        return true;
    }
    RECONSTRUCTIBLE_SYSTEM_FILES.contains(&rel)
}
pub(crate) fn write_new(d: &Dir, name: &str, bytes: &[u8]) -> Result<(), String> {
    component(name)?;
    let mut opts = OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.custom_flags(libc::O_NOFOLLOW);
    }
    let mut f = d.open_with(name, &opts).map_err(err)?;
    f.write_all(bytes).map_err(err)?;
    f.sync_all().map_err(err)
}
// Descendants are opened one component at a time. Never follow a symlink.
fn walk(
    d: &Dir,
    dst: Option<&Dir>,
    rel: &str,
    depth: usize,
    snapshot: bool,
    files: &mut Files,
) -> Result<(), String> {
    if depth > 64 {
        return Err("Directory depth exceeds 64".into());
    }
    for name in names(d)? {
        let label = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };
        // Exclusions:
        // - In snapshot verification: skip only snapshot_manifest.json
        // - In snapshot creation (dst.is_some()): exclude reconstructible files (state files are copied!)
        // - In live vault verification: exclude reconstructible files AND state files
        let skip = if snapshot {
            label == "snapshot_manifest.json"
        } else if dst.is_some() {
            is_excluded_from_snapshots(&label)
        } else {
            is_excluded_from_integrity(&label)
        };
        if skip {
            continue;
        }
        let meta = d.symlink_metadata(&name).map_err(err)?;
        if meta.file_type().is_symlink() {
            return Err(format!("Symlink rejected: {label}"));
        }
        if meta.is_dir() {
            let src = child(d, &name)?;
            let target = if let Some(dst) = dst {
                dst.create_dir(&name).map_err(err)?;
                Some(child(dst, &name)?)
            } else {
                None
            };
            walk(&src, target.as_ref(), &label, depth + 1, snapshot, files)?;
        } else if meta.is_file() {
            let bytes = read(d, &name).map_err(|e| format!("{label}: {e}"))?;
            if let Some(dst) = dst {
                write_new(dst, &name, &bytes)?;
            }
            files.insert(
                label,
                Entry {
                    sha: compute_sha256(&bytes),
                    size: bytes.len() as u64,
                },
            );
        } else {
            return Err(format!("Not a regular file: {label}"));
        }
    }
    Ok(())
}
fn manifest(d: &Dir, snapshot: bool, id: Option<&str>) -> Result<Value, String> {
    let label = if snapshot {
        "snapshot_manifest.json"
    } else {
        "00_SYSTEM/VAULT_MANIFEST.json"
    };
    let v: Value = serde_json::from_slice(&read_path(d, label)?).map_err(err)?;
    if !crate::vault::valid_manifest(&v) {
        return Err("Invalid manifest schema".into());
    }
    if snapshot
        && (v.get("snapshot_id").and_then(Value::as_str) != id
            || !v.get("note").is_none_or(Value::is_string))
    {
        return Err("Invalid snapshot identity or note".into());
    }
    let mut seen = BTreeSet::new();
    for f in v["files"].as_array().unwrap() {
        let p = f["path"].as_str().unwrap();
        relative(p)?;
        let hash = f["sha256"].as_str().unwrap();
        if hash.len() != 64
            || !hash
                .bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
            || f["size"].as_u64().is_none()
            || !seen.insert(p)
        {
            return Err("Invalid or duplicate manifest entry".into());
        }
        if (snapshot && (p == "snapshot_manifest.json" || is_excluded_from_snapshots(p)))
            || (!snapshot && is_excluded_from_integrity(p))
        {
            return Err("Excluded path in manifest".into());
        }
    }
    Ok(v)
}
fn verify(d: &Dir, snapshot: bool, id: Option<&str>) -> VaultIntegrityReportResponse {
    let mut r = VaultIntegrityReportResponse::default();
    let v = match manifest(d, snapshot, id) {
        Ok(v) => {
            r.manifest_present = true;
            v
        }
        Err(e) => {
            r.errors.push(e);
            return r;
        }
    };
    let mut actual = Files::new();
    if let Err(e) = walk(d, None, "", 0, snapshot, &mut actual) {
        r.errors.push(e);
        return r;
    }
    let self_path = if snapshot {
        "snapshot_manifest.json"
    } else {
        "00_SYSTEM/VAULT_MANIFEST.json"
    };
    actual.remove(self_path);
    for f in v["files"].as_array().unwrap() {
        let p = f["path"].as_str().unwrap();
        if p == self_path {
            continue;
        }
        r.total_manifested_files += 1;
        match actual.remove(p) {
            None => r.missing_files.push(p.into()),
            Some(a)
                if a.sha == f["sha256"].as_str().unwrap()
                    && a.size == f["size"].as_u64().unwrap() =>
            {
                r.verified_files_count += 1
            }
            Some(_) => r.modified_files.push(p.into()),
        }
    }
    r.added_files = actual.keys().cloned().collect();
    r.modified_files.sort();
    r.missing_files.sort();
    r.is_integrity_valid = r.errors.is_empty()
        && r.modified_files.is_empty()
        && r.missing_files.is_empty()
        && r.added_files.is_empty();
    r
}
pub fn verify_manifest_integrity(path: &Path) -> VaultIntegrityReportResponse {
    match root(path) {
        Ok(d) => verify(&d, false, None),
        Err(e) => VaultIntegrityReportResponse {
            errors: vec![e],
            ..Default::default()
        },
    }
}
fn container(d: &Dir, create: bool) -> Result<Option<Dir>, String> {
    let system = child(d, "00_SYSTEM")?;
    match system.symlink_metadata("SNAPSHOTS") {
        Ok(_) => child(&system, "SNAPSHOTS").map(Some),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            if !create {
                return Ok(None);
            }
            match system.create_dir("SNAPSHOTS") {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(e) => return Err(err(e)),
            }
            child(&system, "SNAPSHOTS").map(Some)
        }
        Err(e) => Err(err(e)),
    }
}
pub fn verify_snapshot_integrity(path: &Path, id: &str) -> VaultIntegrityReportResponse {
    let run = || {
        component(id)?;
        if !id.starts_with("snap-") {
            return Err("Invalid snapshot id".into());
        }
        let r = root(path)?;
        let c = container(&r, false)?.ok_or("No snapshots directory")?;
        let d = child(&c, id)?;
        Ok(verify(&d, true, Some(id)))
    };
    run().unwrap_or_else(|e| VaultIntegrityReportResponse {
        errors: vec![e],
        ..Default::default()
    })
}
pub(crate) fn publish(c: &Dir, from: &str, to: &str) -> Result<(), String> {
    component(from)?;
    component(to)?;
    #[cfg(unix)]
    {
        let a = CString::new(from).map_err(err)?;
        let b = CString::new(to).map_err(err)?;
        #[cfg(target_os = "macos")]
        let result = unsafe {
            libc::renameatx_np(
                c.as_raw_fd(),
                a.as_ptr(),
                c.as_raw_fd(),
                b.as_ptr(),
                libc::RENAME_EXCL,
            )
        };
        #[cfg(target_os = "linux")]
        let result = unsafe {
            libc::renameat2(
                c.as_raw_fd(),
                a.as_ptr(),
                c.as_raw_fd(),
                b.as_ptr(),
                libc::RENAME_NOREPLACE,
            )
        };
        if result != 0 {
            return Err(err(std::io::Error::last_os_error()));
        }
        Ok(())
    }
    #[cfg(not(unix))]
    {
        if c.symlink_metadata(to).is_ok() {
            return Err("Destination already exists".into());
        }
        c.rename(from, c, to).map_err(err)
    }
}
static SEQUENCE: AtomicU64 = AtomicU64::new(0);
pub fn create_snapshot(path: &Path, note: Option<String>) -> Result<SnapshotItemResponse, String> {
    let d = root(path)?;
    manifest(&d, false, None)?;
    let c = container(&d, true)?.unwrap();
    let now = chrono::Utc::now();
    let id = format!(
        "snap-{}-{}-{}",
        now.format("%Y%m%dT%H%M%S%9fZ"),
        std::process::id(),
        SEQUENCE.fetch_add(1, Ordering::Relaxed)
    );
    create_in(
        &d,
        &c,
        path,
        &id,
        note,
        now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    )
}
fn create_in(
    d: &Dir,
    c: &Dir,
    path: &Path,
    id: &str,
    note: Option<String>,
    date: String,
) -> Result<SnapshotItemResponse, String> {
    component(id)?;
    let pending = format!(".pending-{id}");
    c.create_dir(&pending).map_err(err)?;
    let stage = child(c, &pending)?;
    let result = (|| {
        let mut files = Files::new();
        walk(d, Some(&stage), "", 0, false, &mut files)?;
        let rows: Vec<_> = files
            .iter()
            .map(|(p, e)| json!({"path":p,"sha256":e.sha,"size":e.size}))
            .collect();
        let v = json!({"schema_version":1,"vault_id":format!("snapshot-{id}"),"vault_name":format!("Snapshot {id}"),"snapshot_id":id,"created_at":date,"updated_at":date,"note":note.clone().unwrap_or_default(),"files":rows});
        write_new(
            &stage,
            "snapshot_manifest.json",
            &serde_json::to_vec_pretty(&v).map_err(err)?,
        )?;
        let check = verify(&stage, true, Some(id));
        if !check.is_integrity_valid {
            return Err(format!("Snapshot verification failed: {check:?}"));
        }
        drop(stage);
        publish(c, &pending, id)?;
        Ok(SnapshotItemResponse {
            id: id.into(),
            vault_path: path.to_string_lossy().into(),
            snapshot_path: path
                .join("00_SYSTEM/SNAPSHOTS")
                .join(id)
                .to_string_lossy()
                .into(),
            created_at: date,
            note,
            manifest_file_count: files.len(),
            integrity_status: "valid".into(),
        })
    })();
    if result.is_err() {
        let _ = c.remove_dir_all(&pending);
    }
    result
}
pub fn list_snapshots(path: &Path) -> Result<Vec<SnapshotItemResponse>, String> {
    let d = root(path)?;
    let Some(c) = container(&d, false)? else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for id in names(&c)? {
        if !id.starts_with("snap-") {
            continue;
        }
        let mut item = SnapshotItemResponse {
            id: id.clone(),
            vault_path: path.to_string_lossy().into(),
            snapshot_path: path
                .join("00_SYSTEM/SNAPSHOTS")
                .join(&id)
                .to_string_lossy()
                .into(),
            created_at: String::new(),
            note: None,
            manifest_file_count: 0,
            integrity_status: "corrupted".into(),
        };
        match child(&c, &id) {
            Ok(s) => {
                if let Ok(v) = manifest(&s, true, Some(&id)) {
                    item.created_at = v["created_at"].as_str().unwrap().into();
                    item.note = v["note"].as_str().map(String::from);
                    item.manifest_file_count = v["files"].as_array().unwrap().len();
                }
                let check = verify(&s, true, Some(&id));
                if check.is_integrity_valid {
                    item.integrity_status = "valid".into();
                } else if s
                    .symlink_metadata("snapshot_manifest.json")
                    .is_err_and(|e| e.kind() == std::io::ErrorKind::NotFound)
                {
                    item.integrity_status = "incomplete".into();
                }
            }
            Err(e) => item.note = Some(e),
        }
        out.push(item);
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at).then(b.id.cmp(&a.id)));
    Ok(out)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SnapshotRestoreReport {
    pub snapshot_id: String,
    pub destination_path: String,
    pub files_restored: usize,
    pub bytes_restored: u64,
    pub integrity_verified: bool,
    pub restored_at: String,
}

pub fn restore_snapshot(
    vault_path: &Path,
    snapshot_id: &str,
    destination_path: Option<&Path>,
) -> Result<SnapshotRestoreReport, String> {
    component(snapshot_id)?;
    let check = verify_snapshot_integrity(vault_path, snapshot_id);
    if !check.is_integrity_valid {
        return Err(format!(
            "Impossibile ripristinare: la copia locale è corrotta o incompleta ({:?})",
            check.errors
        ));
    }

    let default_dest = vault_path
        .parent()
        .unwrap_or(vault_path)
        .join(format!("{}_RECUPERO_{}", vault_path.file_name().unwrap_or_default().to_string_lossy(), snapshot_id));
    let target_dest = destination_path.unwrap_or(&default_dest);

    if target_dest == vault_path {
        return Err("Il ripristino richiede una cartella di destinazione separata per evitare sovrascritture distruttive".into());
    }

    let snap_dir = vault_path.join("00_SYSTEM/SNAPSHOTS").join(snapshot_id);
    let manifest_bytes = std::fs::read(snap_dir.join("snapshot_manifest.json"))
        .map_err(|e| format!("Lettura manifesto snapshot fallita: {e}"))?;
    let manifest_val: Value = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| format!("Parsing manifesto snapshot fallito: {e}"))?;
    let files = manifest_val["files"]
        .as_array()
        .ok_or("Formato file nel manifesto non valido")?;

    std::fs::create_dir_all(target_dest)
        .map_err(|e| format!("Creazione cartella di destinazione fallita: {e}"))?;

    let mut files_restored = 0;
    let mut bytes_restored = 0u64;

    for file_entry in files {
        let rel_path = file_entry["path"].as_str().ok_or("Percorso file mancante")?;
        let expected_sha = file_entry["sha256"].as_str().ok_or("Hash mancante")?;

        let src_file = snap_dir.join(rel_path);
        let dst_file = target_dest.join(rel_path);

        if let Some(parent) = dst_file.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let content = std::fs::read(&src_file).map_err(|e| format!("Lettura da snapshot fallita: {e}"))?;
        let actual_sha = compute_sha256(&content);
        if actual_sha != expected_sha {
            return Err(format!("Corruzione file rilevata durante il recupero: {rel_path}"));
        }

        std::fs::write(&dst_file, &content).map_err(|e| format!("Scrittura file recuperato fallita: {e}"))?;
        files_restored += 1;
        bytes_restored += content.len() as u64;
    }

    // Create a valid 00_SYSTEM/VAULT_MANIFEST.json in restored vault
    let sys_dir = target_dest.join("00_SYSTEM");
    std::fs::create_dir_all(&sys_dir).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let recovered_manifest = json!({
        "schema_version": 1,
        "vault_id": format!("recovered-{}", snapshot_id),
        "vault_name": format!("Vault recuperato da {}", snapshot_id),
        "created_at": now,
        "updated_at": now,
        "files": files
    });
    std::fs::write(
        sys_dir.join("VAULT_MANIFEST.json"),
        serde_json::to_vec_pretty(&recovered_manifest).map_err(|e| e.to_string())?,
    ).map_err(|e| e.to_string())?;

    Ok(SnapshotRestoreReport {
        snapshot_id: snapshot_id.to_string(),
        destination_path: target_dest.to_string_lossy().to_string(),
        files_restored,
        bytes_restored,
        integrity_verified: true,
        restored_at: now,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault;
    use tempfile::tempdir;

    #[test]
    fn test_rust_snapshot_creation_and_integrity() {
        let temp = tempdir().unwrap();
        let vault_path = temp.path().join("vault");
        std::fs::create_dir_all(vault_path.join("00_SYSTEM")).unwrap();
        std::fs::create_dir_all(vault_path.join("01_CLIENTS")).unwrap();

        let home_content = "# Home Document";
        let home_sha = compute_sha256(home_content.as_bytes());
        std::fs::write(vault_path.join("00_SYSTEM/HOME.md"), home_content).unwrap();
        std::fs::write(vault_path.join("00_SYSTEM/VAULT_RULES.md"), "# Rules").unwrap();

        let manifest = serde_json::json!({
            "schema_version": 1,
            "vault_id": "test",
            "vault_name": "Test Vault",
            "created_at": "2026-09-11T00:00:00Z",
            "updated_at": "2026-09-11T00:00:00Z",
            "files": [
                {"path": "00_SYSTEM/HOME.md", "sha256": home_sha, "size": home_content.len()},
                {"path":"00_SYSTEM/VAULT_RULES.md","sha256":compute_sha256(b"# Rules"),"size":7}
            ]
        });
        std::fs::write(
            vault_path.join("00_SYSTEM/VAULT_MANIFEST.json"),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();

        // 1. Test SHA-256 manifest integrity verification
        let report = verify_manifest_integrity(&vault_path);
        assert!(
            report.is_integrity_valid,
            "Report errors: {:?}",
            report.errors
        );
        // Both HOME and VAULT_RULES are now correctly manifested in this fixture.
        assert_eq!(report.verified_files_count, 2);

        // 2. Test Snapshot Creation
        let snap = create_snapshot(&vault_path, Some("Test Snapshot".into())).unwrap();
        assert!(snap.id.starts_with("snap-"));
        assert_eq!(snap.integrity_status, "valid");

        // 3. Test Snapshot List
        let snapshots = list_snapshots(&vault_path).unwrap();
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].id, snap.id);
        assert_eq!(snapshots[0].note.as_deref(), Some("Test Snapshot"));

        // 4. Test Anti-Recursion
        let snapshots_in_snap = Path::new(&snap.snapshot_path).join("00_SYSTEM/SNAPSHOTS");
        assert!(
            !snapshots_in_snap.exists(),
            "Snapshot directory must not recursively contain 00_SYSTEM/SNAPSHOTS"
        );
    }

    fn fixture() -> (tempfile::TempDir, std::path::PathBuf) {
        let t = tempdir().unwrap();
        let p = t.path().join("vault");
        vault::create(
            &p,
            Some("M3 fixture".into()),
            &Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../vault-template"),
        )
        .unwrap();
        (t, p)
    }
    #[test]
    fn snapshot_corruption_and_readonly() {
        let (_t, p) = fixture();
        let home = p.join("00_SYSTEM/HOME.md");
        let before = std::fs::metadata(&home).unwrap().modified().unwrap();
        assert!(verify_manifest_integrity(&p).is_integrity_valid);
        let snap = create_snapshot(&p, Some("hello".into())).unwrap();
        assert!(verify_snapshot_integrity(&p, &snap.id).is_integrity_valid);
        assert_eq!(vault::open(&p).status.page_count, 2);
        let s = Path::new(&snap.snapshot_path);
        std::fs::write(s.join("00_SYSTEM/HOME.md"), "tampered").unwrap();
        assert_eq!(list_snapshots(&p).unwrap()[0].integrity_status, "corrupted");
        assert_eq!(
            verify_snapshot_integrity(&p, &snap.id).modified_files,
            vec!["00_SYSTEM/HOME.md"]
        );
        std::fs::remove_file(s.join("00_SYSTEM/VAULT_RULES.md")).unwrap();
        std::fs::write(s.join("extra.txt"), "extra").unwrap();
        let r = verify_snapshot_integrity(&p, &snap.id);
        assert_eq!(r.missing_files, vec!["00_SYSTEM/VAULT_RULES.md"]);
        assert_eq!(r.added_files, vec!["extra.txt"]);
        std::fs::write(s.join("snapshot_manifest.json"), "{}").unwrap();
        assert_eq!(list_snapshots(&p).unwrap()[0].integrity_status, "corrupted");
        assert!(!verify_snapshot_integrity(&p, "../escape").is_integrity_valid);
        assert_eq!(std::fs::metadata(home).unwrap().modified().unwrap(), before);
    }
    #[test]
    #[cfg(unix)]
    fn links_and_rollback_cannot_touch_outside() {
        use std::os::unix::fs::symlink;
        let (t, p) = fixture();
        let outside = t.path().join("outside");
        std::fs::create_dir(&outside).unwrap();
        std::fs::write(outside.join("keep"), "keep").unwrap();
        symlink(&outside, p.join("00_SYSTEM/SNAPSHOTS")).unwrap();
        assert!(create_snapshot(&p, None).is_err());
        assert!(list_snapshots(&p).is_err());
        assert_eq!(std::fs::read_dir(&outside).unwrap().count(), 1);
        std::fs::remove_file(p.join("00_SYSTEM/SNAPSHOTS")).unwrap();
        symlink(&outside, p.join("01_CLIENTS/link")).unwrap();
        assert!(create_snapshot(&p, None).is_err());
        assert_eq!(
            std::fs::read_dir(p.join("00_SYSTEM/SNAPSHOTS"))
                .unwrap()
                .count(),
            0,
            "owned staging cleaned"
        );
        assert_eq!(
            std::fs::read_to_string(outside.join("keep")).unwrap(),
            "keep"
        );
    }
    #[test]
    fn failure_at_manifest_write_cleans_only_staging() {
        let (_t, p) = fixture();
        let snap = create_snapshot(&p, None).unwrap();
        let old =
            std::fs::read(Path::new(&snap.snapshot_path).join("snapshot_manifest.json")).unwrap();
        // A live root file of this name occupies the staging manifest target after copying.
        std::fs::write(p.join("snapshot_manifest.json"), "user data").unwrap();
        assert!(create_snapshot(&p, None).is_err());
        assert_eq!(
            std::fs::read_dir(p.join("00_SYSTEM/SNAPSHOTS"))
                .unwrap()
                .count(),
            1
        );
        assert_eq!(
            std::fs::read(Path::new(&snap.snapshot_path).join("snapshot_manifest.json")).unwrap(),
            old
        );
        assert_eq!(
            std::fs::read_to_string(p.join("snapshot_manifest.json")).unwrap(),
            "user data"
        );
    }

    #[test]
    fn concurrent_publication_and_collision() {
        let (_t, p) = fixture();
        let handles: Vec<_> = (0..4)
            .map(|_| {
                let p = p.clone();
                std::thread::spawn(move || create_snapshot(&p, None).unwrap())
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }
        let listed = list_snapshots(&p).unwrap();
        assert_eq!(listed.len(), 4);
        assert!(listed.iter().all(|s| s.integrity_status == "valid"));
        let d = root(&p).unwrap();
        let c = container(&d, false).unwrap().unwrap();
        let id = &listed[0].id;
        let original =
            std::fs::read(Path::new(&listed[0].snapshot_path).join("snapshot_manifest.json"))
                .unwrap();
        assert!(create_in(&d, &c, &p, id, None, listed[0].created_at.clone()).is_err());
        assert_eq!(
            std::fs::read(Path::new(&listed[0].snapshot_path).join("snapshot_manifest.json"))
                .unwrap(),
            original
        );
        assert_eq!(names(&c).unwrap().len(), 4);
    }

    #[test]
    fn test_snapshot_restore_to_separate_folder_verifies_hashes() {
        let (t, p) = fixture();
        let snap = create_snapshot(&p, Some("Pre-restore test".into())).unwrap();
        assert_eq!(snap.integrity_status, "valid");

        // Target separate directory
        let dest = t.path().join("recovered_vault");
        let rep = restore_snapshot(&p, &snap.id, Some(&dest)).unwrap();
        assert!(rep.integrity_verified);
        assert!(rep.files_restored >= 2);
        assert!(dest.join("00_SYSTEM/HOME.md").exists());
        assert!(dest.join("00_SYSTEM/VAULT_MANIFEST.json").exists());

        // Verify recovered vault has valid manifest and matching files
        let rec_integrity = verify_manifest_integrity(&dest);
        assert!(rec_integrity.is_integrity_valid);

        // Verify restoring to the same active vault folder is refused (no destructive overwrite)
        assert!(restore_snapshot(&p, &snap.id, Some(&p)).is_err());
    }

    #[test]
    fn test_vault_integrity_and_snapshot_exclusions() {
        let (_temp, vault_path) = fixture();

        // Write all reconstructible and state files into 00_SYSTEM
        let sys_dir = vault_path.join("00_SYSTEM");
        std::fs::create_dir_all(&sys_dir).unwrap();

        for rel in RECONSTRUCTIBLE_SYSTEM_FILES {
            let p = vault_path.join(rel);
            std::fs::write(&p, b"{\"cache\": true}").unwrap();
        }
        for rel in STATE_SYSTEM_FILES {
            let p = vault_path.join(rel);
            std::fs::write(&p, b"{\"state\": true}").unwrap();
        }

        // Live vault integrity must be valid despite app system files
        let rep = verify_manifest_integrity(&vault_path);
        assert!(rep.is_integrity_valid, "Integrity should be valid with C3 system files: added={:?}, missing={:?}, mod={:?}", rep.added_files, rep.missing_files, rep.modified_files);
        assert!(rep.added_files.is_empty(), "No added files expected: {:?}", rep.added_files);

        // Create snapshot
        let snap = create_snapshot(&vault_path, Some("Test C3 snapshot".into())).unwrap();
        assert_eq!(snap.integrity_status, "valid");

        let snap_dir = Path::new(&snap.snapshot_path);
        // State files must be copied into snapshot
        assert!(snap_dir.join("00_SYSTEM/VAULT_ID.json").exists());
        assert!(snap_dir.join("00_SYSTEM/OPENAI_CONSENT.json").exists());
        assert!(snap_dir.join("00_SYSTEM/COMPILER_INDEX.json").exists());

        // Reconstructible files must NOT be in snapshot
        assert!(!snap_dir.join("00_SYSTEM/EMBEDDINGS_CACHE.json").exists());
        assert!(!snap_dir.join("00_SYSTEM/SEARCH_INDEX.json").exists());
        assert!(!snap_dir.join("00_SYSTEM/VAULT_CATALOG.json").exists());
        assert!(!snap_dir.join("00_SYSTEM/.m7-lock").exists());

        // An unexpected temporary file left in 00_SYSTEM must invalidate integrity
        let tmp_file = sys_dir.join(".catalog-crash-leftover.tmp");
        std::fs::write(&tmp_file, b"temp").unwrap();
        let rep_corrupted = verify_manifest_integrity(&vault_path);
        assert!(!rep_corrupted.is_integrity_valid, "Temporary file should invalidate integrity");
        assert!(rep_corrupted.added_files.contains(&"00_SYSTEM/.catalog-crash-leftover.tmp".to_string()));
        let _ = std::fs::remove_file(&tmp_file);
    }
}
