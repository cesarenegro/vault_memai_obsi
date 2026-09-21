use crate::snapshots::{child, compute_sha256, names, read, read_path, root, write_new};
use cap_std::fs::{Dir, OpenOptions, OpenOptionsExt};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::Read,
    path::Path,
    sync::{
        atomic::{AtomicU64, Ordering},
        OnceLock,
    },
};
use unicode_normalization::UnicodeNormalization;
const VERSION: u32 = 2;
static COUNTER: AtomicU64 = AtomicU64::new(0);
#[derive(Deserialize)]
struct Spec {
    categories: BTreeMap<String, String>,
    stop_words: BTreeSet<String>,
}
fn spec() -> &'static Spec {
    static S: OnceLock<Spec> = OnceLock::new();
    S.get_or_init(|| {
        serde_json::from_str(include_str!(
            "../../../../packages/search-engine/src/search-spec.json"
        ))
        .expect("Built-in search spec")
    })
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SearchQuery {
    pub term: Option<String>,
    pub category: Option<String>,
    pub client: Option<String>,
    pub project: Option<String>,
    pub tags: Option<Vec<String>>,
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchPassageRecord {
    pub passage_id: String,
    pub locator: String,
    pub sha256: String,
    pub text: String,
    pub tokens: Vec<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchMatchingPassage {
    pub passage_id: String,
    pub locator: String,
    pub snippet: String,
    pub score: f64,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResultItem {
    pub id: String,
    pub title: String,
    pub relative_path: String,
    pub category: String,
    pub client: Option<String>,
    pub project: Option<String>,
    pub tags: Vec<String>,
    pub status: Option<String>,
    pub snippet: String,
    pub score: f64,
    pub updated_at: Option<String>,
    pub sha256: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub matching_locator: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub matching_passage_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub passages: Vec<SearchMatchingPassage>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IndexStatusReport {
    pub state: String,
    pub total_indexed: usize,
    pub last_indexed_at: String,
    pub version: u32,
    pub indexed_categories: BTreeMap<String, usize>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchDocumentRecord {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_id: Option<String>,
    pub relative_path: String,
    pub sha256: String,
    pub mtime_ms: u64,
    pub title: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brand: Option<String>,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub tokens: Vec<String>,
    pub content_preview: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub passages: Vec<SearchPassageRecord>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchIndexData {
    pub version: u32,
    pub last_indexed_at: String,
    pub documents: BTreeMap<String, SearchDocumentRecord>,
}
fn id(p: &str) -> String {
    format!("doc_{}", compute_sha256(p.as_bytes()))
}
fn relative(p: &str) -> Result<(), String> {
    let parts: Vec<_> = p.split('/').collect();
    if parts.len() < 2
        || (!spec().categories.contains_key(parts[0]) && parts[0] != "20_RAW_SOURCES")
        || parts
            .iter()
            .any(|s| s.is_empty() || *s == "." || *s == ".." || s.contains(['\\', '\0']))
    {
        return Err("Invalid indexed path".into());
    }
    Ok(())
}
fn valid_status(s: &str) -> bool {
    ["draft", "review", "approved", "archived", "auto", "legacy_draft"].contains(&s)
}
fn valid_category(s: &str) -> bool {
    spec().categories.values().any(|v| v == s) || s == "raw_source"
}
fn validate(data: &SearchIndexData) -> Result<(), String> {
    if data.version != VERSION {
        return Err("Unsupported search index version".into());
    }
    for (p, d) in &data.documents {
        relative(p)?;
        if (d.id != id(p) && !d.id.starts_with("doc_"))
            || d.relative_path != *p
            || d.sha256.len() != 64
            || !d
                .sha256
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            || d.mtime_ms > 9_007_199_254_740_991
            || !valid_category(&d.category)
            || d.status.as_ref().is_some_and(|s| !valid_status(s))
        {
            return Err("Invalid search document".into());
        }
    }
    Ok(())
}
// Legacy v1 is identifiable but cannot be queried or used as an incremental cache.
fn load(system: &Dir) -> Result<Option<SearchIndexData>, String> {
    if !names(system)?.iter().any(|n| n == "SEARCH_INDEX.json") {
        return Ok(None);
    }
    let value: Value = serde_json::from_slice(&read(system, "SEARCH_INDEX.json")?).map_err(err)?;
    if value["version"] == 1 && value["documents"].is_object() {
        return Ok(Some(SearchIndexData {
            version: 1,
            last_indexed_at: value["last_indexed_at"].as_str().unwrap_or("").into(),
            documents: BTreeMap::new(),
        }));
    }
    let data: SearchIndexData = serde_json::from_value(value).map_err(err)?;
    validate(&data)?;
    Ok(Some(data))
}
fn status(data: Option<&SearchIndexData>) -> IndexStatusReport {
    let state = match data {
        None => "missing",
        Some(d) if d.version != VERSION => "outdated",
        _ => "ready",
    };
    let mut cats = BTreeMap::new();
    let mut total = 0;
    if state == "ready" {
        for d in data.unwrap().documents.values() {
            *cats.entry(d.category.clone()).or_insert(0) += 1;
            total += 1;
        }
    }
    IndexStatusReport {
        state: state.into(),
        total_indexed: total,
        last_indexed_at: data.map(|d| d.last_indexed_at.clone()).unwrap_or_default(),
        version: data.map(|d| d.version).unwrap_or(VERSION),
        indexed_categories: cats,
    }
}
pub fn get_search_index_status(path: &Path) -> Result<IndexStatusReport, String> {
    let r = root(path)?;
    Ok(status(load(&child(&r, "00_SYSTEM")?)?.as_ref()))
}
struct Lock<'a> {
    system: &'a Dir,
    opened: Dir,
}
impl Drop for Lock<'_> {
    fn drop(&mut self) {
        use cap_std::fs::MetadataExt;
        if let Ok(d) = child(self.system, ".search-lock") {
            if let (Ok(a), Ok(b)) = (d.dir_metadata(), self.opened.dir_metadata()) {
                if a.ino() == b.ino() && a.dev() == b.dev() {
                    let _ = self.opened.remove_file("owner.json");
                    let _ = self.system.remove_dir(".search-lock");
                }
            }
        }
    }
}
fn save(system: &Dir, data: &SearchIndexData) -> Result<(), String> {
    validate(data)?;
    let temp = format!(
        ".search-index-{}-{}-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default(),
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    );
    if let Err(e) = write_new(
        system,
        &temp,
        &serde_json::to_vec_pretty(data).map_err(err)?,
    ) {
        let _ = system.remove_file(&temp);
        return Err(e);
    }
    if let Err(e) = system.rename(&temp, system, "SEARCH_INDEX.json") {
        let _ = system.remove_file(&temp);
        return Err(err(e));
    }
    Ok(())
}
pub fn normalize_text(s: &str) -> String {
    s.nfd()
        .filter(|c| !('\u{0300}'..='\u{036f}').contains(c))
        .collect::<String>()
        .to_lowercase()
}
fn patterns() -> &'static Vec<(Regex, &'static str)> {
    static R: OnceLock<Vec<(Regex, &str)>> = OnceLock::new();
    R.get_or_init(|| {
        vec![
            (
                Regex::new(r"^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)").unwrap(),
                "",
            ),
            (Regex::new(r"```[\s\S]*?```").unwrap(), " "),
            (Regex::new(r"\[([^\]]+)\]\([^)]+\)").unwrap(), "$1"),
            (Regex::new(r"(?m)^#{1,6}[ \t]+").unwrap(), ""),
            (Regex::new(r"(?m)^>[ \t]*").unwrap(), ""),
            (Regex::new(r"[`*_]").unwrap(), ""),
        ]
    })
}
pub fn strip_markdown(raw: &str) -> String {
    let mut s = raw.to_string();
    for (r, rep) in patterns() {
        s = r.replace_all(&s, *rep).into_owned();
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}
pub fn tokenize_text(raw: &str) -> Vec<String> {
    static SEP: OnceLock<Regex> = OnceLock::new();
    let lower = normalize_text(&strip_markdown(raw));
    SEP.get_or_init(|| Regex::new(r"[^\p{L}\p{N}]+").unwrap())
        .split(&lower)
        .filter(|t| t.chars().count() >= 2 && !spec().stop_words.contains(*t))
        .map(str::to_string)
        .collect()
}
/// Vero se `needle` compare in `hay` delimitato da caratteri non alfanumerici (o dai bordi), cioe' come
/// parola o sequenza di parole intere: "personal" non e' contenuto in "personale", "lead" non in "leader".
/// Entrambe le stringhe devono essere gia' normalizzate con `normalize_text`.
pub fn contains_whole_words(hay: &str, needle: &str) -> bool {
    let needle = needle.trim();
    if needle.is_empty() {
        return false;
    }
    let h: Vec<char> = hay.chars().collect();
    let n: Vec<char> = needle.chars().collect();
    if n.len() > h.len() {
        return false;
    }
    let is_word = |c: char| c.is_alphanumeric();
    let mut i = 0;
    while i + n.len() <= h.len() {
        if h[i..i + n.len()] == n[..] {
            let before_ok = i == 0 || !is_word(h[i - 1]);
            let after_ok = i + n.len() == h.len() || !is_word(h[i + n.len()]);
            if before_ok && after_ok {
                return true;
            }
        }
        i += 1;
    }
    false
}

pub fn extract_snippet(content: &str, terms: &[String], max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    let chars: Vec<_> = strip_markdown(content).chars().collect();
    let mut folded = Vec::new();
    let mut map = Vec::new();
    for (i, c) in chars.iter().enumerate() {
        for n in normalize_text(&c.to_string()).chars() {
            folded.push(n);
            map.push(i);
        }
    }
    let mut found = 0;
    for t in terms {
        let q: Vec<_> = normalize_text(t).chars().collect();
        if !q.is_empty() {
            if let Some(i) = folded.windows(q.len()).position(|w| w == q.as_slice()) {
                found = map[i];
                break;
            }
        }
    }
    let mut from = found.saturating_sub(max / 2);
    if chars.len() - from < max {
        from = chars.len().saturating_sub(max);
    }
    let to = chars.len().min(from.saturating_add(max));
    format!(
        "{}{}{}",
        if from > 0 { "..." } else { "" },
        chars[from..to].iter().collect::<String>(),
        if to < chars.len() { "..." } else { "" }
    )
}
fn read_file(d: &Dir, name: &str) -> Result<(Vec<u8>, u64), String> {
    use cap_std::fs::MetadataExt;
    let mut f = d
        .open_with(
            name,
            OpenOptions::new()
                .read(true)
                .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK),
        )
        .map_err(err)?;
    let a = f.metadata().map_err(err)?;
    if !a.is_file() || a.len() > 4 * 1024 * 1024 {
        return Err("Not a regular file or exceeds 4 MiB".into());
    }
    let mut bytes = Vec::new();
    (&mut f).take(4*1024*1024+1).read_to_end(&mut bytes).map_err(err)?;
    if bytes.len()>4*1024*1024{return Err("Source exceeds 4 MiB".into())}
    let b = f.metadata().map_err(err)?;
    if a.len() != b.len()
        || a.modified().map_err(err)? != b.modified().map_err(err)?
        || a.ctime() != b.ctime()
        || a.ctime_nsec() != b.ctime_nsec()
    {
        return Err("Source changed while reading".into());
    }
    let time = a
        .modified()
        .map_err(err)?
        .into_std()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok((bytes, time))
}
fn parse(
    content: &str,
    p: &str,
    category: &str,
    mtime: u64,
    sha: String,
) -> Result<SearchDocumentRecord, String> {
    let content = content.strip_prefix('\u{feff}').unwrap_or(content);
    let normalized = content.replace("\r\n", "\n");
    let fm = if normalized.starts_with("---\n") || normalized == "---" {
        let rest = normalized
            .strip_prefix("---\n")
            .ok_or("Unclosed frontmatter")?;
        let end = rest
            .match_indices("\n---")
            .find(|(i, _)| {
                rest.get(i + 4..)
                    .is_some_and(|s| s.is_empty() || s.starts_with('\n'))
            })
            .map(|(i, _)| i)
            .ok_or("Unclosed frontmatter")?;
        let v: Value = serde_yaml::from_str(&rest[..end]).map_err(err)?;
        if !v.is_object() {
            return Err("Frontmatter must be a mapping".into());
        }
        v
    } else {
        json!({})
    };
    let body = patterns()[0].0.replace(content, "").trim().to_string();
    for k in [
        "id",
        "title",
        "type",
        "client",
        "project",
        "brand",
        "status",
        "created_at",
        "updated_at",
    ] {
        if fm.get(k).is_some_and(|v| !v.is_string()) {
            return Err(format!("{p}: Invalid {k}"));
        }
    }
    let tags: Vec<String> = match fm.get("tags") {
        Some(v) => serde_json::from_value(v.clone()).map_err(err)?,
        None => Vec::new(),
    };
    let val = |k: &str| fm.get(k).and_then(Value::as_str).map(str::to_string);
    let cat = val("type").unwrap_or_else(|| category.into());
    if !valid_category(&cat) || val("status").is_some_and(|s| !valid_status(&s)) {
        return Err(format!("{p}: Invalid category/status"));
    }
    let fallback = Path::new(p)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .replace(['-', '_'], " ");
    let title = val("title").unwrap_or_else(|| {
        body.lines()
            .find_map(|l| l.strip_prefix("# "))
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(&fallback)
            .into()
    });
    let date = chrono::DateTime::from_timestamp_millis(mtime as i64)
        .ok_or("Invalid mtime")?
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let doc_id = id(p);
    let chunked = crate::catalog::chunk_text_to_passages(&doc_id, &body);
    let passages: Vec<SearchPassageRecord> = chunked
        .into_iter()
        .map(|cp| {
            let tokens = tokenize_text(&cp.text);
            SearchPassageRecord {
                passage_id: cp.passage_id,
                locator: cp.locator,
                sha256: cp.sha256,
                text: cp.text,
                tokens,
            }
        })
        .collect();

    Ok(SearchDocumentRecord {
        id: doc_id,
        note_id: val("id"),
        relative_path: p.into(),
        sha256: sha,
        mtime_ms: mtime,
        title: title.clone(),
        category: cat,
        client: val("client"),
        project: val("project"),
        brand: val("brand"),
        tags: tags.clone(),
        status: val("status"),
        created_at: val("created_at").unwrap_or_else(|| date.clone()),
        updated_at: val("updated_at").unwrap_or(date),
        tokens: tokenize_text(&format!("{title} {body} {}", tags.join(" "))),
        content_preview: body,
        passages,
    })
}
fn walk(
    d: &Dir,
    rel: &str,
    cat: &str,
    depth: usize,
    old: Option<&SearchIndexData>,
    docs: &mut BTreeMap<String, SearchDocumentRecord>,
) -> Result<(), String> {
    if depth > 64 {
        return Err("Directory depth exceeds 64".into());
    }
    for n in names(d)? {
        if n.starts_with('.') {
            continue;
        }
        let p = format!("{rel}/{n}");
        let m = d.symlink_metadata(&n).map_err(err)?;
        if m.is_symlink() {
            return Err(format!("{p}: Symlinks are not allowed"));
        }
        if m.is_dir() {
            walk(&child(d, &n)?, &p, cat, depth + 1, old, docs)?;
        } else if !m.is_file() {
            return Err(format!("{p}: Not a regular file"));
        } else if ["md", "markdown"].contains(
            &Path::new(&n)
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase()
                .as_str(),
        ) {
            let (bytes, mtime) = read_file(d, &n)?;
            let sha = compute_sha256(&bytes);
            let cached = old
                .filter(|i| i.version == VERSION)
                .and_then(|i| i.documents.get(&p));
            let doc = if let Some(c) = cached.filter(|c| c.sha256 == sha && c.mtime_ms == mtime) {
                c.clone()
            } else {
                parse(&String::from_utf8(bytes).map_err(err)?, &p, cat, mtime, sha)?
            };
            docs.insert(p, doc);
        }
    }
    Ok(())
}
pub fn index_vault_search(path: &Path) -> Result<IndexStatusReport, String> {
    let r = root(path)?;
    let s = child(&r, "00_SYSTEM")?;
    if s.create_dir(".search-lock").is_err() {
        let previous=child(&s,".search-lock")?;
        let owner:Value=serde_json::from_slice(&read(&previous,"owner.json")?).map_err(err)?;
        let pid=owner["pid"].as_u64().filter(|p|*p>1&&*p<=i32::MAX as u64).ok_or("Search lock owner invalid")? as i32;
        if unsafe{libc::kill(pid,0)}==0||std::io::Error::last_os_error().raw_os_error()!=Some(libc::ESRCH){return Err("Search lock held by an active process".into())}
        previous.remove_file("owner.json").map_err(err)?;
        s.remove_dir(".search-lock").map_err(err)?;
        s.create_dir(".search-lock").map_err(err)?;
    }
    let _lock = Lock {system:&s,opened:child(&s,".search-lock")?};
    write_new(&_lock.opened,"owner.json",json!({"pid":std::process::id()}).to_string().as_bytes())?;
    let old = load(&s)?;
    let mut docs = BTreeMap::new();
    let entries = names(&r)?;
    for (cat, kind) in &spec().categories {
        if entries.contains(cat) {
            walk(&child(&r, cat)?, cat, kind, 0, old.as_ref(), &mut docs)?;
        }
    }

    // Sync catalog so new, modified, or removed raw sources are updated
    let _ = crate::catalog::sync_catalog(path);

    // Index catalog raw sources (20_RAW_SOURCES) if VAULT_CATALOG.json exists
    if let Ok(catalog) = crate::catalog::load_catalog(path) {
        for doc in catalog.documents.values() {
            if doc.original_path.starts_with("20_RAW_SOURCES/") && doc.extraction_status == crate::catalog::ExtractionStatus::Ready && !doc.passages.is_empty() {
                let p = doc.original_path.clone();
                let cached = old
                    .as_ref()
                    .filter(|i| i.version == VERSION)
                    .and_then(|i| i.documents.get(&p));
                let search_doc = if let Some(c) = cached.filter(|c| c.sha256 == doc.content_hash) {
                    c.clone()
                } else {
                    let passages: Vec<SearchPassageRecord> = doc.passages.iter().map(|pass| {
                        SearchPassageRecord {
                            passage_id: pass.passage_id.clone(),
                            locator: pass.locator.clone(),
                            sha256: pass.sha256.clone(),
                            text: pass.text.clone(),
                            tokens: tokenize_text(&pass.text),
                        }
                    }).collect();

                    let mut all_tokens = tokenize_text(&format!("{} {}", doc.file_name, doc.tags.join(" ")));
                    for pass in &passages {
                        all_tokens.extend(pass.tokens.clone());
                    }
                    // C11 fix: do not deduplicate tokens so term frequency (tf) accurately reflects occurrences.
                    // tokens is never used via binary_search, so full bag-of-words ordering is preserved identically to knowledge documents (line 455).

                    let preview = passages.first().map(|pass| pass.text.chars().take(500).collect::<String>()).unwrap_or_default();

                    SearchDocumentRecord {
                        id: doc.document_id.clone(),
                        note_id: None,
                        relative_path: p.clone(),
                        sha256: doc.content_hash.clone(),
                        mtime_ms: 0,
                        title: doc.file_name.clone(),
                        category: doc.category.clone().unwrap_or_else(|| "raw_source".to_string()),
                        client: doc.client.clone(),
                        project: doc.project.clone(),
                        brand: None,
                        tags: doc.tags.clone(),
                        status: Some(doc.editorial_status.clone()),
                        created_at: doc.imported_at.clone(),
                        updated_at: doc.updated_at.clone(),
                        tokens: all_tokens,
                        content_preview: preview,
                        passages,
                    }
                };
                docs.insert(p, search_doc);
            }
        }
    }

    let data = SearchIndexData {
        version: VERSION,
        last_indexed_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        documents: docs,
    };
    save(&s, &data)?;
    Ok(status(Some(&data)))
}
pub fn search_vault(path: &Path, q: SearchQuery) -> Result<Vec<SearchResultItem>, String> {
    search_vault_filtered::<fn(&SearchDocumentRecord) -> bool>(path, q, None)
}

pub fn search_vault_filtered<F>(
    path: &Path,
    q: SearchQuery,
    filter_fn: Option<F>,
) -> Result<Vec<SearchResultItem>, String>
where
    F: Fn(&SearchDocumentRecord) -> bool,
{
    let limit = q.limit.unwrap_or(50);
    let offset = q.offset.unwrap_or(0);
    if limit > 200
        || offset > 1_000_000
        || q.term
            .as_ref()
            .is_some_and(|t| t.encode_utf16().count() > 2000)
    {
        return Err("Invalid search query/pagination".into());
    }
    let r = root(path)?;
    let _sys = child(&r, "00_SYSTEM")?;
    let data = load(&child(&r, "00_SYSTEM")?)?
        .filter(|d| d.version == VERSION)
        .ok_or("Search index missing or outdated; re-index required")?;
    let terms: Vec<_> = tokenize_text(q.term.as_deref().unwrap_or(""))
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    if !q.term.as_deref().unwrap_or("").trim().is_empty() && terms.is_empty() {
        return Ok(Vec::new());
    }
    let df: BTreeMap<_, _> = terms
        .iter()
        .map(|t| {
            (
                t,
                data.documents
                    .values()
                    .filter(|d| d.tokens.contains(t))
                    .count(),
            )
        })
        .collect();
    // BM25 (C11, seconda meta'): normalizzazione sulla lunghezza del documento.
    // Senza questo fattore, con tf reale i documenti lunghi dominano per costruzione
    // (misurato: il file piu' grande del corpus al rango 1 in 47 query su 82).
    const BM25_K1: f64 = 1.2;
    const BM25_B: f64 = 0.75;
    let avgdl = {
        let n = data.documents.len().max(1) as f64;
        (data.documents.values().map(|d| d.tokens.len() as f64).sum::<f64>() / n).max(1.0)
    };
    let mut results = Vec::new();
    for d in data.documents.values() {
        if crate::automation::managed(&d.relative_path) && !crate::automation::is_current(path,&d.relative_path,&d.sha256){continue;}
        if let Some(ref f) = filter_fn {
            if !f(d) {
                continue;
            }
        }
        if q.category
            .as_ref()
            .is_some_and(|c| !c.is_empty() && *c != d.category)
        {
            continue;
        }
        if [
            (&q.client, &d.client),
            (&q.project, &d.project),
            (&q.status, &d.status),
        ]
        .iter()
        .any(|(a, b)| {
            a.as_ref().is_some_and(|s| {
                !s.is_empty() && normalize_text(s) != normalize_text(b.as_deref().unwrap_or(""))
            })
        }) {
            continue;
        }
        if q.tags.as_ref().is_some_and(|ts| {
            ts.iter().any(|t| {
                !d.tags
                    .iter()
                    .any(|x| normalize_text(x) == normalize_text(t))
            })
        }) {
            continue;
        }
        let mut score = if terms.is_empty() { 1.0 } else { 0.0 };
        let title_tokens = tokenize_text(&d.title);
        let tags_tokens = tokenize_text(&d.tags.join(" "));
        let dl = d.tokens.len() as f64;
        let length_norm = 1.0 - BM25_B + BM25_B * dl / avgdl;
        for t in &terms {
            let tf = d.tokens.iter().filter(|x| *x == t).count() as f64;
            let idf =
                ((data.documents.len() + 1) as f64 / (*df.get(t).unwrap_or(&0) + 1) as f64).ln() + 1.0;
            if tf > 0.0 {
                score += idf * (tf * (BM25_K1 + 1.0)) / (tf + BM25_K1 * length_norm);
            }
            if title_tokens.contains(t) {
                score += 10.0;
            }
            if tags_tokens.contains(t) {
                score += 5.0;
            }
        }

        // Passages matching and locator detection
        let mut matching_passages = Vec::new();
        let mut best_passage_locator = None;
        let mut best_passage_id = None;
        let mut best_passage_snippet = None;
        let mut best_passage_score = 0.0;

        let dynamic_passages: Vec<SearchPassageRecord>;
        let passages_ref = if !d.passages.is_empty() {
            &d.passages
        } else {
            dynamic_passages = crate::catalog::chunk_text_to_passages(&d.id, &d.content_preview)
                .into_iter()
                .map(|p| SearchPassageRecord {
                    passage_id: p.passage_id,
                    locator: p.locator,
                    sha256: p.sha256,
                    text: p.text.clone(),
                    tokens: tokenize_text(&p.text),
                })
                .collect();
            &dynamic_passages
        };

        for p in passages_ref {
            let mut p_score = 0.0;
            for t in &terms {
                let p_tf = p.tokens.iter().filter(|x| *x == t).count() as f64;
                if p_tf > 0.0 {
                    let idf = ((data.documents.len() + 1) as f64 / (*df.get(t).unwrap_or(&0) + 1) as f64).ln() + 1.0;
                    p_score += p_tf * idf;
                }
            }
            if let Some(ref term) = q.term {
                let norm_term = normalize_text(term);
                let norm_p = normalize_text(&p.text);
                // C12 (21/09/2026): confronto a parola intera. Con `contains` un termine breve prendeva il bonus
                // anche come sottostringa di altre parole ("personal" in "personale", "lead" in "leader") e,
                // poiche' il bonus vale solo per i documenti con BM25 zero ed e' piu' alto di qualsiasi BM25,
                // i documenti con la sola sottostringa superavano quelli con il termine vero: misurato sul
                // corpus reale, 50 documenti a pari merito con punteggio 15,0 per "personal", "cita", "lead".
                if contains_whole_words(&norm_p, &norm_term) {
                    p_score += 15.0;
                }
            }
            if p_score > 0.0 {
                let snippet = extract_snippet(&p.text, &terms, 180);
                matching_passages.push(SearchMatchingPassage {
                    passage_id: p.passage_id.clone(),
                    locator: p.locator.clone(),
                    snippet: snippet.clone(),
                    score: (p_score * 100.0).round() / 100.0,
                });
                if p_score > best_passage_score {
                    best_passage_score = p_score;
                    best_passage_locator = Some(p.locator.clone());
                    best_passage_id = Some(p.passage_id.clone());
                    best_passage_snippet = Some(snippet);
                }
            }
        }

        if score <= 0.0 {
            if best_passage_score > 0.0 {
                score = best_passage_score;
            } else {
                continue;
            }
        }

        if compute_sha256(&read_path(&r, &d.relative_path)?) != d.sha256 {
            return Err(format!(
                "Search index stale: {}; re-index required",
                d.relative_path
            ));
        }

        let snippet = best_passage_snippet.unwrap_or_else(|| {
            extract_snippet(&d.content_preview, &terms, 180)
        });

        matching_passages.sort_by(|a, b| b.score.total_cmp(&a.score));

        results.push(SearchResultItem {
            id: d.id.clone(),
            title: d.title.clone(),
            relative_path: d.relative_path.clone(),
            category: d.category.clone(),
            client: d.client.clone(),
            project: d.project.clone(),
            tags: d.tags.clone(),
            status: d.status.clone(),
            snippet,
            score: (score * 100.0).round() / 100.0,
            updated_at: Some(d.updated_at.clone()),
            sha256: d.sha256.clone(),
            matching_locator: best_passage_locator,
            matching_passage_id: best_passage_id,
            passages: matching_passages,
        });
    }
    results.sort_by(|a, b| {
        b.score
            .total_cmp(&a.score)
            .then_with(|| b.updated_at.cmp(&a.updated_at))
            .then_with(|| a.relative_path.cmp(&b.relative_path))
    });
    Ok(results.into_iter().skip(offset).take(limit).collect())
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[test]
    fn metadata_filters_unicode_and_readonly() {
        let t = tempfile::tempdir().unwrap();
        for d in ["00_SYSTEM", "01_CLIENTS"] {
            fs::create_dir(t.path().join(d)).unwrap();
        }
        let raw="---\ntitle: Metadata\nclient: Acme\nproject: Apollo\nstatus: draft\ntags: [tech]\n---\n# Heading\nCaffè software";
        fs::write(t.path().join("01_CLIENTS/doc.md"), raw).unwrap();
        assert_eq!(index_vault_search(t.path()).unwrap().total_indexed, 1);
        assert_eq!(
            search_vault(
                t.path(),
                SearchQuery {
                    client: Some("Acme".into()),
                    term: Some("caffe".into()),
                    ..Default::default()
                }
            )
            .unwrap()
            .len(),
            1
        );
        assert_eq!(
            search_vault(
                t.path(),
                SearchQuery {
                    status: Some("approved".into()),
                    ..Default::default()
                }
            )
            .unwrap()
            .len(),
            0
        );
        assert_eq!(
            fs::read_to_string(t.path().join("01_CLIENTS/doc.md")).unwrap(),
            raw
        );
        assert!(!extract_snippet(&format!("{}è😀tail", "a".repeat(179)), &[], 180).is_empty());
    }
    #[test]
    fn index_symlink_never_overwrites_note() {
        use std::os::unix::fs::symlink;
        let t = tempfile::tempdir().unwrap();
        fs::create_dir(t.path().join("00_SYSTEM")).unwrap();
        fs::write(t.path().join("note.md"), "# SAFE").unwrap();
        symlink(
            t.path().join("note.md"),
            t.path().join("00_SYSTEM/SEARCH_INDEX.json"),
        )
        .unwrap();
        assert!(index_vault_search(t.path()).is_err());
        assert_eq!(
            fs::read_to_string(t.path().join("note.md")).unwrap(),
            "# SAFE"
        );
    }
    #[test]
    fn search_passages_and_catalog_indexing() {
        let t = tempfile::tempdir().unwrap();
        for d in ["00_SYSTEM", "01_CLIENTS", "20_RAW_SOURCES"] {
            fs::create_dir(t.path().join(d)).unwrap();
        }
        let note = "---\ntitle: Multi Paragraph Note\nclient: BetaCorp\nstatus: approved\n---\n# Introduzione\nPrimo paragrafo con informazioni generali.\n\nSecondo paragrafo con specifiche su algoritmo QuantumLeap e architettura distribuita.";
        fs::write(t.path().join("01_CLIENTS/note.md"), note).unwrap();

        // Index note
        let rep = index_vault_search(t.path()).unwrap();
        assert_eq!(rep.total_indexed, 1);

        // Search for QuantumLeap
        let res = search_vault(t.path(), SearchQuery {
            term: Some("QuantumLeap".into()),
            ..Default::default()
        }).unwrap();
        assert_eq!(res.len(), 1);
        assert!(res[0].matching_locator.is_some());
        assert!(res[0].matching_passage_id.is_some());
        assert!(res[0].snippet.contains("QuantumLeap"));
        assert!(!res[0].passages.is_empty());
    }

    #[test]
    fn test_search_detects_removed_and_modified_files_without_blocking() {
        let t = tempfile::tempdir().unwrap();
        fs::create_dir(t.path().join("00_SYSTEM")).unwrap();
        fs::create_dir(t.path().join("01_CLIENTS")).unwrap();

        let file_path = t.path().join("01_CLIENTS/doc.md");
        fs::write(&file_path, "---\ntitle: Progetto Alfa\nstatus: approved\n---\nVersione Iniziale di prova Alfa.").unwrap();

        index_vault_search(t.path()).unwrap();
        let res1 = search_vault(t.path(), SearchQuery {
            term: Some("Iniziale".into()),
            ..Default::default()
        }).unwrap();
        assert_eq!(res1.len(), 1);

        // 1. Modify content on disk -> reindexing updates search without blocking
        fs::write(&file_path, "---\ntitle: Progetto Alfa\nstatus: approved\n---\nVersione Rinnovata con dettagli Delta.").unwrap();
        index_vault_search(t.path()).unwrap();
        let res2 = search_vault(t.path(), SearchQuery {
            term: Some("Delta".into()),
            ..Default::default()
        }).unwrap();
        assert_eq!(res2.len(), 1);

        // 2. Remove file from disk -> reindexing detects removal
        fs::remove_file(&file_path).unwrap();
        index_vault_search(t.path()).unwrap();
        let res3 = search_vault(t.path(), SearchQuery {
            term: Some("Delta".into()),
            ..Default::default()
        }).unwrap();
        assert_eq!(res3.len(), 0);
    }

    #[test]
    fn test_c11_raw_sources_term_frequency_not_deduped() {
        let t = tempfile::tempdir().unwrap();
        let path = t.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        // Doc 1: term "benchmark" appears 1 time
        let content_single = "benchmark termine comune per test";
        fs::write(path.join("20_RAW_SOURCES/doc_single.txt"), content_single).unwrap();

        // Doc 2: term "benchmark" appears 5 times
        let content_multi = "benchmark benchmark benchmark benchmark benchmark termine comune per test";
        fs::write(path.join("20_RAW_SOURCES/doc_multi.txt"), content_multi).unwrap();

        // Sync catalog and process extractions
        crate::catalog::sync_catalog(path).unwrap();
        let _ = crate::catalog::process_pending_extractions(path).unwrap();

        // Index vault search
        index_vault_search(path).unwrap();

        // Verify SEARCH_INDEX.json tokens
        let root_dir = root(path).unwrap();
        let sys_dir = child(&root_dir, "00_SYSTEM").unwrap();
        let index_data = load(&sys_dir).unwrap().unwrap();

        let doc_single = index_data.documents.get("20_RAW_SOURCES/doc_single.txt").expect("doc_single missing");
        let doc_multi = index_data.documents.get("20_RAW_SOURCES/doc_multi.txt").expect("doc_multi missing");

        let tf_single = doc_single.tokens.iter().filter(|x| *x == "benchmark").count();
        let tf_multi = doc_multi.tokens.iter().filter(|x| *x == "benchmark").count();

        // Crucial C11 assertions: tf must be N, not 1
        assert_eq!(tf_single, 1, "tf for doc_single must be exactly 1");
        assert_eq!(tf_multi, 5, "tf for doc_multi must be exactly 5, not deduplicated to 1");

        // Search for "benchmark"
        let results = search_vault(path, SearchQuery {
            term: Some("benchmark".into()),
            ..Default::default()
        }).unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].relative_path, "20_RAW_SOURCES/doc_multi.txt");
        assert_eq!(results[1].relative_path, "20_RAW_SOURCES/doc_single.txt");
        assert!(
            results[0].score > results[1].score,
            "Document with 5 occurrences (score {}) must strictly outrank document with 1 occurrence (score {})",
            results[0].score,
            results[1].score
        );
    }

    #[test]
    fn test_contains_whole_words_rejects_substrings_of_other_words() {
        assert!(contains_whole_words("parliamo di personal branding", "personal"));
        assert!(!contains_whole_words("il posizionamento a livello personale", "personal"));
        assert!(!contains_whole_words("il leader del mercato", "lead"));
        assert!(contains_whole_words("genera un lead qualificato", "lead"));
        assert!(contains_whole_words("marca privata e distribuzione", "marca privata"));
        assert!(!contains_whole_words("marca privatamente gestita", "marca privata"));
        assert!(contains_whole_words("codice sku-999-x in listino", "sku-999-x"));
        assert!(!contains_whole_words("qualsiasi", ""));
    }

    #[test]
    fn test_c12_exact_token_document_outranks_substring_only_document() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();
        // A contiene il token esatto "personal"; B contiene solo "personale"/"personalmente" (sottostringhe).
        fs::write(path.join("20_RAW_SOURCES/a.txt"), "Oggi parliamo di personal branding e di come costruire il personal brand di un consulente.").unwrap();
        fs::write(path.join("20_RAW_SOURCES/b.txt"), "Il posizionamento a livello personale conta molto, personalmente credo che la personalizzazione sia decisiva.").unwrap();
        crate::catalog::sync_catalog_from_vault(path).unwrap();
        crate::catalog::process_pending_extractions(path).unwrap();
        index_vault_search(path).unwrap();
        let res = search_vault(path, SearchQuery { term: Some("personal".into()), ..Default::default() }).unwrap();
        assert!(!res.is_empty());
        assert!(res[0].relative_path.ends_with("a.txt"), "il documento con il termine esatto deve essere primo, trovato {}", res[0].relative_path);
        assert!(res.iter().all(|r| !r.relative_path.ends_with("b.txt")), "un documento con la sola sottostringa non deve entrare tramite il bonus di frase esatta");
    }

    #[test]
    fn test_c11_bm25_short_exact_document_beats_long_document_with_common_words() {
        // C11, seconda meta': con tf reale ma senza normalizzazione sulla lunghezza,
        // un documento lungo che ripete una parola comune batteva un documento breve
        // che contiene la frase cercata (misurato sul corpus reale: il file piu' grande
        // al rango 1 in 47 query su 82). BM25 deve invertire l'ordine.
        let t = tempfile::tempdir().unwrap();
        let path = t.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        // Documento breve e mirato: contiene la frase esatta una sola volta.
        let short = "Nota tecnica. Confezione termosaldata per salumi affettati con barriera ossigeno.";
        fs::write(path.join("20_RAW_SOURCES/breve.txt"), short).unwrap();

        // Documento lungo: ripete "confezione" centinaia di volte in un mare di parole di riempimento,
        // senza mai contenere gli altri termini della frase.
        let mut long = String::new();
        for i in 0..500 {
            long.push_str("confezione ");
            long.push_str(&format!("parola{} riempimento{} testo{} ", i % 37, i % 53, i % 71));
        }
        fs::write(path.join("20_RAW_SOURCES/lungo.txt"), long).unwrap();

        crate::catalog::sync_catalog(path).unwrap();
        let _ = crate::catalog::process_pending_extractions(path).unwrap();
        index_vault_search(path).unwrap();

        let results = search_vault(path, SearchQuery {
            term: Some("confezione termosaldata per salumi affettati".into()),
            ..Default::default()
        }).unwrap();

        assert_eq!(results.len(), 2, "entrambi i documenti contengono almeno un termine");
        assert_eq!(
            results[0].relative_path, "20_RAW_SOURCES/breve.txt",
            "il documento breve con la frase esatta deve stare al rango 1 (punteggi: breve {} / lungo {})",
            results.iter().find(|r| r.relative_path.ends_with("breve.txt")).map(|r| r.score).unwrap_or(0.0),
            results.iter().find(|r| r.relative_path.ends_with("lungo.txt")).map(|r| r.score).unwrap_or(0.0)
        );
        assert!(
            results[0].score > results[1].score,
            "il punteggio del documento breve ({}) deve superare strettamente quello del documento lungo ({})",
            results[0].score,
            results[1].score
        );
    }
}

/// Read the exact indexed bytes or extracted text through a pinned directory, for AI/MCP citations.
pub fn read_indexed_document(path: &Path, document_id: &str, expected: &str) -> Result<(SearchDocumentRecord, String), String> {
    let r=root(path)?;
    let data=load(&child(&r,"00_SYSTEM")?)?.filter(|d|d.version==VERSION).ok_or("Search index missing or outdated")?;
    let d=data.documents.values().find(|d|d.id==document_id).ok_or("Unknown document")?;
    if d.sha256!=expected {return Err("Source changed; select again".into())}
    relative(&d.relative_path)?;
    let parts:Vec<_>=d.relative_path.split('/').collect();

    // SPECIAL HANDLING FOR 20_RAW_SOURCES (PDF, DOCX, binary sources)
    if parts[0] == "20_RAW_SOURCES" {
        let mut dir=r;
        for part in &parts[..parts.len()-1]{dir=child(&dir,part)?;}
        let (bytes,_)=read_file(&dir,parts[parts.len()-1])?;
        if compute_sha256(&bytes)!=expected{return Err("Source changed; re-index required".into())}

        // Return extracted plain text rather than binary bytes
        let content = if !d.passages.is_empty() {
            d.passages.iter().map(|p| p.text.as_str()).collect::<Vec<_>>().join("\n\n")
        } else {
            crate::catalog::read_document_text(path, &d.id).unwrap_or_else(|_| d.content_preview.clone())
        };
        if content.trim().is_empty() {
            return Err("Extracted text empty for raw source".into());
        }
        return Ok((d.clone(), content));
    }

    let mut dir=r;
    for part in &parts[..parts.len()-1]{dir=child(&dir,part)?;}
    let (bytes,_)=read_file(&dir,parts[parts.len()-1])?;
    if bytes.len()>256*1024{return Err("AI document exceeds 256 KiB".into())}
    if compute_sha256(&bytes)!=expected{return Err("Source changed; re-index required".into())}
    let content=String::from_utf8(bytes).map_err(|_|"Invalid UTF-8")?;
    let category=spec().categories.get(parts[0]).ok_or("Invalid category directory")?;
    let actual=parse(&content,&d.relative_path,category,d.mtime_ms,d.sha256.clone())?;
    if actual.status!=d.status||actual.category!=d.category||actual.client!=d.client||actual.project!=d.project||actual.tags!=d.tags||actual.title!=d.title{return Err("Indexed metadata differs from source; re-index required".into())}
    Ok((actual,content))
}
