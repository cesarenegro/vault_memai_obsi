use cap_std::{
    ambient_authority,
    fs::{Dir, OpenOptions},
};
#[cfg(unix)]
use cap_std::fs::OpenOptionsExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::Path,
};

pub const REQUIRED_VAULT_FOLDERS: [&str; 15] = [
    "00_SYSTEM",
    "01_CLIENTS",
    "02_PROJECTS",
    "03_BRANDS",
    "04_POSITIONING",
    "05_PACKAGING_KNOWLEDGE",
    "06_METHODS",
    "07_CASE_STUDIES",
    "08_MARKET_RESEARCH",
    "09_COMPETITORS",
    "10_APPROVED_OUTPUTS",
    "20_RAW_SOURCES",
    "80_AI_OUTPUTS",
    "90_PROPOSALS",
    "99_ARCHIVE",
];
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ValidationResultResponse {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub checked_folders_count: usize,
    pub checked_files_count: usize,
    pub system_files_valid: bool,
    #[serde(skip)]
    pub manifest: Option<Value>,
    pub page_count: usize,
    pub source_count: usize,
    pub proposal_count: usize,
    pub state: String,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultStatusResponse {
    pub state: String,
    pub path: Option<String>,
    pub name: Option<String>,
    pub page_count: usize,
    pub source_count: usize,
    pub proposal_count: usize,
    pub snapshot_id: Option<String>,
    pub snapshot_age: Option<String>,
    pub integrity_status: String,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OpenVaultResponse {
    pub status: VaultStatusResponse,
    pub validation: ValidationResultResponse,
}

fn string(v: &Value, key: &str) -> bool {
    v.get(key).is_some_and(Value::is_string)
}
fn optional_string(v: &Value, key: &str) -> bool {
    v.get(key).is_none_or(Value::is_string)
}
fn strings(v: &Value, key: &str) -> bool {
    v.get(key)
        .is_none_or(|a| a.as_array().is_some_and(|a| a.iter().all(Value::is_string)))
}
fn integer(v: &Value) -> bool {
    v.as_f64()
        .is_some_and(|n| n.is_finite() && n.fract() == 0.0)
}
fn datetime(v: &Value, key: &str) -> bool {
    v.get(key)
        .and_then(Value::as_str)
        .is_some_and(|s| s.ends_with('Z') && chrono::DateTime::parse_from_rfc3339(s).is_ok())
}
pub fn valid_manifest(v: &Value) -> bool {
    v.is_object()
        && v.get("schema_version")
            .is_some_and(|n| integer(n) && n.as_f64().unwrap_or(0.0) > 0.0)
        && string(v, "vault_id")
        && string(v, "vault_name")
        && datetime(v, "created_at")
        && datetime(v, "updated_at")
        && optional_string(v, "snapshot_id")
        && v.get("files")
            .and_then(Value::as_array)
            .is_some_and(|files| {
                files.iter().all(|f| {
                    string(f, "path")
                        && f.get("sha256")
                            .and_then(Value::as_str)
                            .is_some_and(|s| s.encode_utf16().count() == 64)
                        && f.get("size")
                            .and_then(Value::as_f64)
                            .is_some_and(|n| n.is_finite() && n >= 0.0)
                        && (f.get("updated_at").is_none() || datetime(f, "updated_at"))
                })
            })
}
pub fn valid_frontmatter(v: &Value) -> bool {
    const TYPES: [&str; 13] = [
        "client",
        "project",
        "brand",
        "positioning",
        "packaging",
        "method",
        "case_study",
        "research",
        "competitor",
        "approved_output",
        "raw_source",
        "ai_output",
        "proposal",
    ];
    v.is_object()
        && ["id", "title", "created_at", "updated_at"]
            .iter()
            .all(|k| string(v, k))
        && v.get("schema_version").is_none_or(integer)
        && v.get("type")
            .and_then(Value::as_str)
            .is_some_and(|t| TYPES.contains(&t))
        && v.get("status").is_none_or(|s| {
            s.as_str()
                .is_some_and(|s| ["draft", "review", "approved", "archived"].contains(&s))
        })
        && ["client", "project", "brand", "snapshot_id"]
            .iter()
            .all(|k| optional_string(v, k))
        && strings(v, "tags")
        && strings(v, "source_ids")
}
pub fn frontmatter(content: &str) -> Result<Option<Value>, String> {
    frontmatter_with_validation(content, true)
}
pub fn frontmatter_unvalidated(content: &str) -> Result<Option<Value>, String> {
    frontmatter_with_validation(content, false)
}
pub fn frontmatter_with_validation(content: &str, validate_schema: bool) -> Result<Option<Value>, String> {
    let normalized = content.replace("\r\n", "\n");
    if !normalized.starts_with("---\n") && normalized != "---" {
        return Ok(None);
    }
    let rest = normalized
        .strip_prefix("---\n")
        .ok_or("Invalid YAML syntax: Unclosed YAML frontmatter")?;
    let end = rest
        .match_indices("\n---")
        .find(|(i, _)| {
            rest.get(i + 4..)
                .is_some_and(|s| s.is_empty() || s.starts_with('\n'))
        })
        .map(|(i, _)| i)
        .ok_or("Invalid YAML syntax: Unclosed YAML frontmatter")?;
    let value: Value =
        serde_yaml::from_str(&rest[..end]).map_err(|e| format!("Invalid YAML syntax: {e}"))?;
    if !value.is_object() {
        return Err("Invalid YAML syntax: frontmatter must be a mapping".into());
    }
    if validate_schema && !valid_frontmatter(&value) {
        return Err("Invalid frontmatter schema".into());
    }
    Ok(Some(value))
}
fn readable_file(root: &Dir, relative: &Path) -> Result<String, String> {
    let meta = root.symlink_metadata(relative).map_err(|e| e.to_string())?;
    if meta.file_type().is_symlink() || !meta.is_file() {
        return Err("Not a regular file (symlinks are not allowed)".into());
    }
    // cap-std resolves all components relative to the opened capability, including during races.
    let mut opts = OpenOptions::new();
    opts.read(true);
    #[cfg(unix)]
    opts.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
    let mut file = root
        .open_with(relative, &opts)
        .map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("Not a regular file".into());
    }
    let mut text = String::new();
    file.read_to_string(&mut text).map_err(|e| e.to_string())?;
    Ok(text)
}
fn walk(
    root: &Dir,
    rel: &Path,
    depth: usize,
    result: &mut ValidationResultResponse,
    system: &mut BTreeMap<String, String>,
) -> Result<(), String> {
    if depth > 64 {
        return Err("Directory depth exceeds 64".into());
    }
    let mut names = root
        .read_dir(rel)
        .map_err(|e| e.to_string())?
        .map(|e| e.map(|e| e.file_name()))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    names.sort();
    for name in names {
        let child_path = rel.join(&name);
        let raw_label = child_path.to_string_lossy().replace('\\', "/");
        let label = raw_label
            .trim_start_matches("./")
            .trim_start_matches('/')
            .to_string();
        let operation = (|| -> Result<(), String> {
            let meta = root.symlink_metadata(&child_path).map_err(|e| e.to_string())?;
            if meta.file_type().is_symlink() {
                return Err("Symlinks inside the Vault are not allowed".into());
            }
            if meta.is_dir() {
                if label != "00_SYSTEM/SNAPSHOTS"
                    && !name.to_string_lossy().starts_with('.')
                    && name != "node_modules"
                {
                    walk(root, &child_path, depth + 1, result, system)?;
                }
            } else if meta.is_file() {
                let mut opts = OpenOptions::new();
                opts.read(true);
                #[cfg(unix)]
                opts.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
                let mut opened = root
                    .open_with(&child_path, &opts)
                    .map_err(|e| e.to_string())?;
                if !opened.metadata().map_err(|e| e.to_string())?.is_file() {
                    return Err("Not a regular file".into());
                }
                result.checked_files_count += 1;
                if label.ends_with(".md") || label == "00_SYSTEM/VAULT_MANIFEST.json" {
                    let mut content = String::new();
                    opened
                        .read_to_string(&mut content)
                        .map_err(|e| e.to_string())?;
                    if label.starts_with("00_SYSTEM/") {
                        system.insert(label.clone(), content.clone());
                    }
                    if label.ends_with(".md") {
                        result.page_count += 1;
                        if label.starts_with("20_RAW_SOURCES/") {
                            result.source_count += 1;
                            let _ = frontmatter_unvalidated(&content);
                        } else {
                            if label.starts_with("90_PROPOSALS/") {
                                result.proposal_count += 1;
                            }
                            if frontmatter(&content)?.is_none() && !label.starts_with("00_SYSTEM/") {
                                result
                                    .warnings
                                    .push(format!("Markdown file missing YAML frontmatter: {label}"));
                            }
                        }
                    }
                }
            } else {
                return Err("Not a regular file or directory".into());
            }
            Ok(())
        })();
        if let Err(e) = operation {
            result.errors.push(format!("{label}: {e}"));
        }
    }
    Ok(())
}
pub fn perform_vault_validation(path: &Path) -> ValidationResultResponse {
    let mut result = ValidationResultResponse::default();
    if path.as_os_str().is_empty() {
        result.state = "NO_VAULT".into();
        result.errors.push("No vault path specified".into());
        return result;
    }
    let root = match Dir::open_ambient_dir(path, ambient_authority()) {
        Ok(root) => root,
        Err(e) => {
            result.state = "NOT_ACCESSIBLE".into();
            result.errors.push(format!(
                "Vault path does not exist or is not accessible: {e}"
            ));
            return result;
        }
    };
    if let Err(e) = root.entries() {
        result.state = "NOT_ACCESSIBLE".into();
        result.errors.push(e.to_string());
        return result;
    }
    validate_dir(&root)
}
fn validate_dir(root: &Dir) -> ValidationResultResponse {
    let mut result = ValidationResultResponse::default();
    let mut missing = false;
    let mut invalid = false;
    for folder in REQUIRED_VAULT_FOLDERS {
        match root.symlink_metadata(folder) {
            Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => {
                match root.read_dir(folder) {
                    Ok(_) => result.checked_folders_count += 1,
                    Err(e) => {
                        invalid = true;
                        result.errors.push(format!("{folder}: {e}"));
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                missing = true;
                result
                    .errors
                    .push(format!("Missing required vault folder: {folder}"));
            }
            _ => {
                invalid = true;
                result
                    .errors
                    .push(format!("Invalid required vault folder: {folder}"));
            }
        }
    }
    let mut system = BTreeMap::new();
    let previous = result.errors.len();
    if let Err(e) = walk(root, Path::new("."), 0, &mut result, &mut system) {
        result.errors.push(e);
    }
    if result.errors.len() > previous {
        invalid = true;
    }
    for file in ["HOME.md", "VAULT_RULES.md", "VAULT_MANIFEST.json"] {
        if !system.contains_key(&format!("00_SYSTEM/{file}")) {
            missing = true;
            result.errors.push(format!(
                "Required system path is missing, unreadable or not a regular file: {file}"
            ));
        }
    }
    if let Some(raw) = system.get("00_SYSTEM/VAULT_MANIFEST.json") {
        match serde_json::from_str::<Value>(raw) {
            Ok(manifest) if valid_manifest(&manifest) => result.manifest = Some(manifest),
            _ => {
                invalid = true;
                result.errors.push("Invalid manifest".into());
            }
        }
    }
    result.system_files_valid = result.manifest.is_some()
        && system.contains_key("00_SYSTEM/HOME.md")
        && system.contains_key("00_SYSTEM/VAULT_RULES.md");
    result.is_valid = result.errors.is_empty();
    result.state = if result.is_valid {
        "READY"
    } else if invalid {
        "INVALID"
    } else if missing {
        "INCOMPLETE"
    } else {
        "INVALID"
    }
    .into();
    if !result.is_valid {
        result.manifest = None;
    }
    result
}
pub fn response(path: &Path, validation: ValidationResultResponse) -> OpenVaultResponse {
    let manifest = validation.manifest.as_ref();
    let name = manifest
        .and_then(|v| v.get("vault_name"))
        .and_then(Value::as_str)
        .map(String::from)
        .or_else(|| path.file_name().map(|s| s.to_string_lossy().into()));
    let status = VaultStatusResponse {
        state: validation.state.clone(),
        path: if path.as_os_str().is_empty() {
            None
        } else {
            Some(path.to_string_lossy().into())
        },
        name,
        page_count: validation.page_count,
        source_count: validation.source_count,
        proposal_count: validation.proposal_count,
        snapshot_id: manifest
            .and_then(|v| v.get("snapshot_id"))
            .and_then(Value::as_str)
            .map(String::from),
        snapshot_age: None,
        integrity_status: "unverified".into(),
    };
    OpenVaultResponse { status, validation }
}
pub fn open(path: &Path) -> OpenVaultResponse {
    response(path, perform_vault_validation(path))
}

pub fn create(
    target: &Path,
    name: Option<String>,
    template_path: &Path,
) -> Result<VaultStatusResponse, String> {
    if !target.is_absolute()
        || target.file_name().is_none()
        || target
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("INVALID_ARGUMENT: absolute Vault path required, without traversal".into());
    }
    let template = Dir::open_ambient_dir(template_path, ambient_authority())
        .map_err(|e| format!("TEMPLATE_UNAVAILABLE: {e}"))?;
    let mut files = BTreeMap::new();
    for file in ["HOME.md", "VAULT_RULES.md", "VAULT_MANIFEST.json"] {
        let content = readable_file(&template, Path::new(&format!("00_SYSTEM/{file}")))?;
        let content = if file.ends_with(".md") { content.replace("\r\n", "\n") } else { content };
        files.insert(file, content);
    }
    let mut manifest: Value =
        serde_json::from_str(&files["VAULT_MANIFEST.json"]).map_err(|e| e.to_string())?;
    if !valid_manifest(&manifest) {
        return Err("Invalid template manifest".into());
    }
    for file in ["HOME.md", "VAULT_RULES.md"] {
        frontmatter(&files[file])?;
    }
    manifest["vault_name"] = Value::String(
        name.filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| target.file_name().unwrap().to_string_lossy().into()),
    );
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    manifest["created_at"] = Value::String(now.clone());
    manifest["updated_at"] = Value::String(now);
    files.insert(
        "VAULT_MANIFEST.json",
        serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
    );
    // Canonicalize the existing ancestor once (macOS /var -> /private/var is legitimate).
    // All new descendants are then created relative to the opened directory capability.
    let mut ancestor = target.to_path_buf();
    let mut missing = Vec::new();
    while !ancestor.exists() {
        missing.push(
            ancestor
                .file_name()
                .ok_or("Invalid ancestor")?
                .to_os_string(),
        );
        ancestor = ancestor.parent().ok_or("Invalid ancestor")?.to_path_buf();
    }
    let mut root =
        Dir::open_ambient_dir(&ancestor, ambient_authority()).map_err(|e| e.to_string())?;
    for component in missing.into_iter().rev() {
        root.create_dir(&component).map_err(|e| e.to_string())?;
        root = root.open_dir(&component).map_err(|e| e.to_string())?;
    }
    if root.entries().map_err(|e| e.to_string())?.next().is_some() {
        return Err("ALREADY_EXISTS: target directory is not empty".into());
    }
    // Exclusive directory claim; a second creator cannot proceed past 00_SYSTEM.
    for folder in REQUIRED_VAULT_FOLDERS {
        root.create_dir(folder)
            .map_err(|e| format!("CREATE_FAILED: {folder}: {e}"))?;
    }
    let system = root.open_dir("00_SYSTEM").map_err(|e| e.to_string())?;
    for (file, content) in files {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        let mut output = system
            .open_with(file, &options)
            .map_err(|e| e.to_string())?;
        output
            .write_all(content.as_bytes())
            .map_err(|e| e.to_string())?;
        output.sync_all().map_err(|e| e.to_string())?;
    }
    // Preserve partial files on failure; never delete concurrent or pre-existing data.
    let validation = validate_dir(&root);
    if !validation.is_valid {
        return Err(format!(
            "VALIDATION_FAILED: {}",
            validation.errors.join("; ")
        ));
    }
    Ok(response(target, validation).status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    #[test]
    fn shared_frontmatter_fixtures() {
        let fixtures: Value = serde_json::from_str(include_str!(
            "../../../../tests/fixtures/m2/frontmatter.json"
        ))
        .unwrap();
        for fixture in fixtures.as_array().unwrap() {
            let ok = frontmatter(fixture["content"].as_str().unwrap()).is_ok();
            assert_eq!(ok, fixture["state"] == "READY", "{}", fixture["name"]);
        }
    }
    #[test]
    fn manifest_is_consumed_without_reopening() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("vault");
        create(
            &p,
            Some("Original".into()),
            &PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../vault-template"),
        )
        .unwrap();
        let validation = perform_vault_validation(&p);
        std::fs::write(p.join("00_SYSTEM/VAULT_MANIFEST.json"), "{}").unwrap();
        assert_eq!(
            response(&p, validation).status.name.as_deref(),
            Some("Original")
        );
        assert_eq!(open(&p).status.state, "INVALID");
    }
    #[test]
    fn exclusive_creation_preserves_existing_bytes() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("vault");
        let template = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../vault-template");
        create(&p, None, &template).unwrap();
        let before = std::fs::read(p.join("00_SYSTEM/VAULT_MANIFEST.json")).unwrap();
        assert!(create(&p, None, &template).is_err());
        assert_eq!(
            before,
            std::fs::read(p.join("00_SYSTEM/VAULT_MANIFEST.json")).unwrap()
        );
    }
    #[test]
    fn concurrent_creation_has_one_winner() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("vault");
        std::fs::create_dir(&target).unwrap();
        let template = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../vault-template");
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let handles: Vec<_> = (0..2)
            .map(|_| {
                let p = target.clone();
                let t = template.clone();
                let b = barrier.clone();
                std::thread::spawn(move || {
                    b.wait();
                    create(&p, None, &t).is_ok()
                })
            })
            .collect();
        let wins = handles
            .into_iter()
            .map(|h| usize::from(h.join().unwrap()))
            .sum::<usize>();
        assert_eq!(wins, 1);
        assert_eq!(open(&target).status.state, "READY");
    }
    #[test]
    fn capability_blocks_external_symlinks_and_broken_links() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("vault");
        let template = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../vault-template");
        create(&p, None, &template).unwrap();
        std::fs::write(t.path().join("outside"), "external data must never be read").unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(t.path(), p.join("01_CLIENTS/link")).unwrap();
            assert_eq!(open(&p).status.state, "INVALID");
            let dir = Dir::open_ambient_dir(&p, ambient_authority()).unwrap();
            assert!(dir.read("01_CLIENTS/link/outside").is_err());
        }
    }
    #[cfg(windows)]
    #[test]
    fn capability_blocks_external_junctions() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("vault");
        let template = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../vault-template");
        create(&p, None, &template).unwrap();
        let outside = t.path().join("outside_dir");
        std::fs::create_dir(&outside).unwrap();
        std::fs::write(outside.join("data.txt"), "external data").unwrap();
        let target_link = p.join("01_CLIENTS/jlink");
        let status = std::process::Command::new("cmd")
            .args(["/c", "mklink", "/J", target_link.to_str().unwrap(), outside.to_str().unwrap()])
            .output();
        if let Ok(out) = status {
            if out.status.success() {
                assert_eq!(open(&p).status.state, "INVALID");
                let dir = Dir::open_ambient_dir(&p, ambient_authority()).unwrap();
                assert!(dir.read("01_CLIENTS/jlink/data.txt").is_err());
            }
        }
    }
    #[test]
    fn raw_sources_foreign_yaml_frontmatter_allows_vault_opening() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("vault");
        let template = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../vault-template");
        create(&p, None, &template).unwrap();

        let foreign_yaml = "---\nforeign_key: 123\ncustom_meta: test\n---\nRaw imported document body\n";
        std::fs::write(p.join("20_RAW_SOURCES/raw_doc.md"), foreign_yaml).unwrap();

        let res = open(&p);
        assert_eq!(res.status.state, "READY", "Vault with foreign YAML frontmatter in 20_RAW_SOURCES must be READY");

        std::fs::write(p.join("01_CLIENTS/bad_doc.md"), foreign_yaml).unwrap();
        let res_outside = open(&p);
        assert_eq!(res_outside.status.state, "INVALID", "Vault with foreign YAML frontmatter in 01_CLIENTS must be INVALID");
    }
}
