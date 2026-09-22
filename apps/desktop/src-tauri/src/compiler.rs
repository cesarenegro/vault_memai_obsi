use crate::snapshots::{child, compute_sha256, names, publish, read, read_path, root, write_new};
use crate::vault::{frontmatter, valid_frontmatter};
use cap_std::fs::Dir;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};
const COMPILER_VERSION: &str = "0.2.0";
static COUNTER: AtomicU64 = AtomicU64::new(0);
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn parts(relative: &str) -> Result<Vec<&str>, String> {
    let p: Vec<_> = relative.split('/').collect();
    if p.iter()
        .any(|s| s.is_empty() || *s == "." || *s == ".." || s.contains(['\\', '\0']))
    {
        return Err("Unsafe relative path".into());
    }
    Ok(p)
}
fn source_path(p: &str) -> Result<(), String> {
    if parts(p)?.len() < 2 || !p.starts_with("20_RAW_SOURCES/") {
        return Err("Source must be inside 20_RAW_SOURCES".into());
    }
    Ok(())
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawSourceItem {
    pub relative_path: String,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub is_compiled: bool,
    pub status: String,
    pub first_compiled_at: Option<String>,
    pub error: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProvenanceRecord {
    pub source_relative_path: String,
    pub source_id: String,
    pub sha256: String,
    #[serde(alias = "imported_at")]
    pub first_compiled_at: String,
    pub last_compiled_at: String,
    pub compiler_version: String,
    pub draft_relative_path: String,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompilerIndex {
    pub version: u32,
    pub records: BTreeMap<String, ProvenanceRecord>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompilationItemResult {
    pub source_relative_path: String,
    pub status: String,
    pub draft_relative_path: Option<String>,
    pub error: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchCompilerReport {
    pub compiled_count: usize,
    pub unchanged_count: usize,
    pub unsupported_count: usize,
    pub error_count: usize,
    pub items: Vec<CompilationItemResult>,
}
#[derive(Debug, Serialize)]
pub struct ProposalItem {
    pub relative_path: String,
    pub title: String,
    pub status: String,
    pub markdown: String,
}
fn result(
    rel: &str,
    status: &str,
    draft: Option<String>,
    error: Option<String>,
) -> CompilationItemResult {
    CompilationItemResult {
        source_relative_path: rel.into(),
        status: status.into(),
        draft_relative_path: draft,
        error,
    }
}
fn load_index(system: &Dir) -> Result<CompilerIndex, String> {
    if !names(system)?.iter().any(|s| s == "COMPILER_INDEX.json") {
        return Ok(CompilerIndex {
            version: 1,
            records: BTreeMap::new(),
        });
    }
    let index: CompilerIndex =
        serde_json::from_slice(&read(system, "COMPILER_INDEX.json")?).map_err(err)?;
    if index.version != 1 {
        return Err("Invalid compiler index version".into());
    }
    for (key, r) in &index.records {
        source_path(key)?;
        if r.source_relative_path != *key
            || !r.source_id.starts_with("src_")
            || r.source_id.len() <= 4
            || !r.source_id[4..].bytes().all(|b| b.is_ascii_hexdigit())
            || r.sha256.len() != 64
            || !r.sha256.bytes().all(|b| b.is_ascii_hexdigit())
            || r.first_compiled_at.is_empty()
            || r.last_compiled_at.is_empty()
            || r.compiler_version.is_empty()
            || parts(&r.draft_relative_path)?.len() != 2
            || !r.draft_relative_path.starts_with("90_PROPOSALS/")
        {
            return Err("Invalid compiler record".into());
        }
    }
    Ok(index)
}
fn nonce() -> String {
    format!(
        "{}-{}-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default(),
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}
fn save_index(system: &Dir, index: &CompilerIndex) -> Result<(), String> {
    let name = format!(".compiler-index-{}", nonce());
    let res = (|| {
        write_new(
            system,
            &name,
            &serde_json::to_vec_pretty(index).map_err(err)?,
        )?;
        system
            .rename(&name, system, "COMPILER_INDEX.json")
            .map_err(err)
    })();
    if res.is_err() {
        let _ = system.remove_file(&name);
    }
    res
}
// Cooperative cross-runtime lock. A lock left by process termination is deliberately not stolen.
struct Lock<'a> {
    system: &'a Dir,
    opened: Option<Dir>,
}
impl Drop for Lock<'_> {
    fn drop(&mut self) {
        #[cfg(unix)]
        {
            use cap_std::fs::MetadataExt;
            if let Some(opened) = &self.opened {
                if let Ok(current) = child(self.system, ".compiler-lock") {
                    if let (Ok(a), Ok(b)) = (current.dir_metadata(), opened.dir_metadata()) {
                        if a.ino() == b.ino() && a.dev() == b.dev() {
                            let _ = self.system.remove_dir(".compiler-lock");
                        }
                    }
                }
            }
        }
        #[cfg(not(unix))]
        {
            let _ = self.opened.take();
            let _ = self.system.remove_dir(".compiler-lock");
        }
    }
}
fn lock(system: &Dir) -> Result<Lock<'_>, String> {
    system.create_dir(".compiler-lock").map_err(|e| {
        format!("Compiler lock unavailable; another operation or interrupted run: {e}")
    })?;
    Ok(Lock {
        system,
        opened: Some(child(system, ".compiler-lock")?),
    })
}
pub fn sanitize_html(raw: &str) -> String {
    let chars: Vec<char> = raw.chars().collect();
    let mut i = 0;
    let mut out = String::new();
    let mut blocked: Vec<String> = Vec::new();
    while i < chars.len() {
        if chars[i] != '<' {
            if blocked.is_empty() {
                out.push(chars[i]);
            }
            i += 1;
            continue;
        }
        let mut j = i + 1;
        let mut quote = None;
        while j < chars.len() {
            let c = chars[j];
            if let Some(q) = quote {
                if c == q {
                    quote = None;
                }
            } else if c == '"' || c == '\'' {
                quote = Some(c);
            } else if c == '>' {
                break;
            }
            j += 1;
        }
        if j == chars.len() {
            break;
        }
        let token: String = chars[i + 1..j].iter().collect();
        let lower = token.trim().to_ascii_lowercase();
        let closing = lower.starts_with('/');
        let token = if closing {
            lower[1..].trim_start()
        } else {
            &lower
        };
        let tag: String = token
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric())
            .collect();
        if [
            "script", "style", "iframe", "object", "template", "noscript",
        ]
        .contains(&tag.as_str())
        {
            if closing {
                if blocked.last() == Some(&tag) {
                    blocked.pop();
                }
            } else {
                blocked.push(tag);
            }
        }
        if blocked.is_empty() {
            out.push(' ');
        }
        i = j + 1;
    }
    out.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .replace('&', "&amp;")
        .replace('>', "&gt;")
}
fn extract(raw: &str, relative: &str) -> (String, String, String, bool) {
    let p = Path::new(relative);
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    let html = ext == "html" || ext == "htm";
    let title = if html {
        stem
    } else {
        raw.lines()
            .find_map(|l| l.strip_prefix("# ").map(str::trim))
            .filter(|s| !s.is_empty())
            .unwrap_or(stem)
    }
    .to_string();
    (
        title,
        if html {
            sanitize_html(raw)
        } else {
            raw.trim().into()
        },
        ext.clone(),
        ["md", "markdown", "txt", "html", "htm"].contains(&ext.as_str()),
    )
}
fn compile(root: &Dir, relative: &str) -> Result<CompilationItemResult, String> {
    source_path(relative)?;
    let system = child(root, "00_SYSTEM")?;
    let _lock = lock(&system)?;
    let mut index = load_index(&system)?;
    let bytes = read_path(root, relative)?;
    let ext = Path::new(relative)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !["md", "markdown", "txt", "html", "htm"].contains(&ext.as_str()) {
        return Ok(result(relative, "unsupported", None, None));
    }
    let raw = String::from_utf8(bytes.clone()).map_err(err)?;
    let (title, body, ext, _) = extract(&raw, relative);
    let sha = compute_sha256(&bytes);
    let proposals = child(root, "90_PROPOSALS")?;
    let old = index.records.get(relative);
    if let Some(r) = old {
        if r.sha256 == sha && r.compiler_version == COMPILER_VERSION {
            let name = parts(&r.draft_relative_path)?[1];
            if names(&proposals)?.iter().any(|n| n == name) {
                read(&proposals, name)?;
                return Ok(result(
                    relative,
                    "unchanged",
                    Some(r.draft_relative_path.clone()),
                    None,
                ));
            }
        }
    }
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let first = old
        .map(|r| r.first_compiled_at.clone())
        .unwrap_or_else(|| now.clone());
    let id = format!("src_{}", compute_sha256(relative.as_bytes()));
    let revision = nonce();
    let name = format!("{id}-{}-{revision}.md", &sha[..16]);
    let draft = format!("90_PROPOSALS/{name}");
    let fm = serde_json::json!({"schema_version":1,"id":format!("prop_{id}_{revision}"),"title":title,"type":"proposal","status":"draft","source_ids":[id],"created_at":now,"updated_at":now,"tags":["compiled",ext]});
    if !valid_frontmatter(&fm) {
        return Err("Invalid generated frontmatter".into());
    }
    let yaml = serde_yaml::to_string(&fm).map_err(err)?;
    let text=format!("---\n{yaml}---\n\n# {title}\n\n> Source: {relative}\n> SHA-256: {sha}\n> Compiler: {COMPILER_VERSION}\n\n{body}\n");
    if frontmatter(&text)?.is_none() {
        return Err("Missing generated frontmatter".into());
    }
    let stage = format!(".compiler-{revision}");
    if let Err(e) = write_new(&proposals, &stage, text.as_bytes()) {
        let _ = proposals.remove_file(&stage);
        return Err(e);
    }
    if let Err(e) = publish(&proposals, &stage, &name) {
        let _ = proposals.remove_file(&stage);
        return Err(e);
    }
    index.records.insert(
        relative.into(),
        ProvenanceRecord {
            source_relative_path: relative.into(),
            source_id: id,
            sha256: sha,
            first_compiled_at: first,
            last_compiled_at: now,
            compiler_version: COMPILER_VERSION.into(),
            draft_relative_path: draft.clone(),
        },
    );
    if let Err(e) = save_index(&system, &index) {
        proposals
            .remove_file(&name)
            .map_err(|cleanup| format!("{e}; rollback failed: {cleanup}"))?;
        return Err(e);
    }
    Ok(result(relative, "compiled", Some(draft), None))
}
pub fn compile_source(vault_root: &Path, relative: &str) -> Result<CompilationItemResult, String> {
    let root = root(vault_root)?;
    Ok(compile(&root, relative).unwrap_or_else(|e| result(relative, "error", None, Some(e))))
}
fn collect(
    dir: &Dir,
    rel: &str,
    depth: usize,
    items: &mut Vec<(String, Option<String>)>,
) -> Result<(), String> {
    if depth > 64 {
        return Err("Directory depth exceeds 64".into());
    }
    for name in names(dir)? {
        if name.starts_with('.') {
            continue;
        }
        let label = format!("{rel}/{name}");
        let res = (|| {
            let m = dir.symlink_metadata(&name).map_err(err)?;
            if m.is_symlink() {
                return Err("Symlinks are not allowed".into());
            }
            if m.is_dir() {
                collect(&child(dir, &name)?, &label, depth + 1, items)?;
            } else if m.is_file() {
                items.push((label.clone(), None));
            } else {
                return Err("Not a regular file".into());
            }
            Ok(())
        })();
        if let Err(e) = res {
            items.push((label, Some(e)));
        }
    }
    Ok(())
}
pub fn list_raw_sources(vault_root: &Path) -> Result<Vec<RawSourceItem>, String> {
    let root = root(vault_root)?;
    let index = load_index(&child(&root, "00_SYSTEM")?)?;
    let mut paths = Vec::new();
    collect(
        &child(&root, "20_RAW_SOURCES")?,
        "20_RAW_SOURCES",
        0,
        &mut paths,
    )?;
    let mut items = Vec::new();
    for (rel, scan_error) in paths {
        let r = index.records.get(&rel);
        let mut error = scan_error;
        let mut size = 0;
        let mut status = "UNCOMPILED";
        if error.is_none() {
            match read_path(&root, &rel) {
                Ok(b) => {
                    size = b.len() as u64;
                    if let Some(r) = r {
                        match read_path(&root, &r.draft_relative_path) {
                            Ok(_) => {
                                status = if r.sha256 == compute_sha256(&b)
                                    && r.compiler_version == COMPILER_VERSION
                                {
                                    "COMPILED"
                                } else {
                                    "CHANGED"
                                }
                            }
                            Err(e) => error = Some(format!("Draft unavailable: {e}")),
                        }
                    }
                }
                Err(e) => error = Some(e),
            }
        }
        if error.is_some() {
            status = "ERROR";
        }
        let p = Path::new(&rel);
        items.push(RawSourceItem {
            name: p.file_name().unwrap().to_string_lossy().into(),
            extension: p.extension().unwrap_or_default().to_string_lossy().into(),
            relative_path: rel.clone(),
            size_bytes: size,
            is_compiled: status == "COMPILED" || status == "CHANGED",
            status: status.into(),
            first_compiled_at: r.map(|r| r.first_compiled_at.clone()),
            error,
        });
    }
    Ok(items)
}
pub fn batch_compile_sources(vault_root: &Path) -> Result<BatchCompilerReport, String> {
    let root = root(vault_root)?;
    let mut paths = Vec::new();
    collect(
        &child(&root, "20_RAW_SOURCES")?,
        "20_RAW_SOURCES",
        0,
        &mut paths,
    )?;
    let items: Vec<_> = paths
        .into_iter()
        .map(|(p, e)| {
            if let Some(e) = e {
                result(&p, "error", None, Some(e))
            } else {
                compile(&root, &p).unwrap_or_else(|e| result(&p, "error", None, Some(e)))
            }
        })
        .collect();
    Ok(BatchCompilerReport {
        compiled_count: items.iter().filter(|i| i.status == "compiled").count(),
        unchanged_count: items.iter().filter(|i| i.status == "unchanged").count(),
        unsupported_count: items.iter().filter(|i| i.status == "unsupported").count(),
        error_count: items.iter().filter(|i| i.status == "error").count(),
        items,
    })
}
pub fn list_proposals(vault_root: &Path) -> Result<Vec<ProposalItem>, String> {
    let root = root(vault_root)?;
    let dir = child(&root, "90_PROPOSALS")?;
    let mut items = Vec::new();
    for name in names(&dir)? {
        if name.starts_with('.') || !name.ends_with(".md") {
            continue;
        }
        let text = String::from_utf8(read(&dir, &name)?).map_err(err)?;
        let fm = frontmatter(&text)?.ok_or("Missing proposal frontmatter")?;
        if !valid_frontmatter(&fm) {
            return Err(format!("Invalid proposal frontmatter: {name}"));
        }
        items.push(ProposalItem {
            relative_path: format!("90_PROPOSALS/{name}"),
            title: fm["title"].as_str().unwrap().into(),
            status: fm
                .get("status")
                .and_then(|s| s.as_str())
                .unwrap_or("approved")
                .into(),
            markdown: text,
        });
    }
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn create_test_vault() -> (tempfile::TempDir, PathBuf) {
        let tmp = tempdir().unwrap();
        let vault_root = tmp.path().canonicalize().unwrap();
        fs::create_dir_all(vault_root.join("20_RAW_SOURCES")).unwrap();
        fs::create_dir_all(vault_root.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(vault_root.join("90_PROPOSALS")).unwrap();
        (tmp, vault_root)
    }

    #[test]
    fn test_rust_compiler_compiles_draft_with_status_draft() {
        let (_tmp, vault_root) = create_test_vault();
        let raw_rel = "20_RAW_SOURCES/test_doc.md";
        fs::write(vault_root.join(raw_rel), "# Test Title\nContent body").unwrap();

        let res = compile_source(&vault_root, raw_rel).unwrap();
        assert_eq!(res.status, "compiled");
        assert!(res
            .draft_relative_path
            .as_ref()
            .unwrap()
            .starts_with("90_PROPOSALS/src_"));

        let draft_path = vault_root.join(res.draft_relative_path.unwrap());
        assert!(draft_path.exists());
        let draft_content = fs::read_to_string(&draft_path).unwrap();

        assert!(draft_content.contains("status: draft"));
        assert!(draft_content.contains("type: proposal"));
        assert!(draft_content.contains("# Test Title"));

        // Raw source must be untouched
        assert_eq!(
            fs::read_to_string(vault_root.join(raw_rel)).unwrap(),
            "# Test Title\nContent body"
        );
    }

    #[test]
    fn test_rust_compiler_deduplication() {
        let (_tmp, vault_root) = create_test_vault();
        let raw_rel = "20_RAW_SOURCES/spec.txt";
        fs::write(vault_root.join(raw_rel), "Spec content").unwrap();

        let res1 = compile_source(&vault_root, raw_rel).unwrap();
        assert_eq!(res1.status, "compiled");

        let res2 = compile_source(&vault_root, raw_rel).unwrap();
        assert_eq!(res2.status, "unchanged");
    }

    #[test]
    fn test_rust_compiler_sanitizes_html() {
        let (_tmp, vault_root) = create_test_vault();
        let raw_rel = "20_RAW_SOURCES/page.html";
        let html = "<html><body><script>alert(1)</script><p>Text</p></body></html>";
        fs::write(vault_root.join(raw_rel), html).unwrap();

        let res = compile_source(&vault_root, raw_rel).unwrap();
        assert_eq!(res.status, "compiled");

        let draft = fs::read_to_string(vault_root.join(res.draft_relative_path.unwrap())).unwrap();
        assert!(!draft.contains("<script>"));
        assert!(draft.contains("Text"));
    }
}
