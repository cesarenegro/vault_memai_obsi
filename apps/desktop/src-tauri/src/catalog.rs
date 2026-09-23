//! Transactional local catalog for LIMEN Vault documents and passages.
//! Single source of truth for raw sources, extracted text, chunked passages, and AI enrichment phases.

use crate::{
    extraction,
    snapshots::{child, compute_sha256, names, read, read_path, root, write_new},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    path::Path,
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
    sync::{Arc, Mutex},
    time::SystemTime,
};

pub const CATALOG_FILE: &str = "VAULT_CATALOG.json";
pub const CATALOG_SCHEMA_VERSION: u32 = 1;

pub static CATALOG_REVISION: AtomicU64 = AtomicU64::new(1);
pub static CATALOG_DISK_READ_COUNT: AtomicU64 = AtomicU64::new(0);

#[derive(Clone)]
struct CatalogCacheEntry {
    vault_path: std::path::PathBuf,
    size: u64,
    mtime: SystemTime,
    revision: u64,
    data: Arc<CatalogState>,
}

static CATALOG_CACHE: Mutex<BTreeMap<std::path::PathBuf, CatalogCacheEntry>> =
    Mutex::new(BTreeMap::new());

pub fn bump_catalog_revision() {
    CATALOG_REVISION.fetch_add(1, Ordering::SeqCst);
}

pub fn get_catalog_disk_read_count() -> u64 {
    CATALOG_DISK_READ_COUNT.load(Ordering::SeqCst)
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ExtractionStatus {
    Pending,
    Processing,
    Ready,
    Unsupported,
    Protected,
    Failed,
}

impl Default for ExtractionStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PhaseState {
    Pending,
    Processing,
    Ready,
    Skipped,
    Failed,
}

impl Default for PhaseState {
    fn default() -> Self {
        Self::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseInfo {
    pub status: PhaseState,
    pub attempts: u8,
    pub error: Option<String>,
    pub updated_at: String,
}

impl Default for PhaseInfo {
    fn default() -> Self {
        Self {
            status: PhaseState::Pending,
            attempts: 0,
            error: None,
            updated_at: now_iso(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPassage {
    pub passage_id: String,
    pub locator: String,
    pub text: String,
    pub char_count: usize,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    pub document_id: String,
    pub revision: u64,
    pub content_hash: String,
    pub original_path: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub file_name: String,
    pub extension: String,
    pub file_size: u64,
    pub mime_type: String,
    pub imported_at: String,
    pub updated_at: String,

    pub extraction_status: ExtractionStatus,
    pub extraction_error: Option<String>,
    pub extracted_text_path: Option<String>,
    pub extracted_text_hash: Option<String>,
    pub passages: Vec<DocumentPassage>,

    pub lexical_status: PhaseInfo,
    pub semantic_status: PhaseInfo,
    pub classification_status: PhaseInfo,
    pub wiki_status: PhaseInfo,

    pub category: Option<String>,
    pub client: Option<String>,
    pub project: Option<String>,
    pub tags: Vec<String>,
    pub evidence_type: String, // "source", "wiki", "human_note", "legacy_draft"
    pub editorial_status: String, // "approved", "draft", "auto"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogState {
    pub schema_version: u32,
    pub catalog_revision: u64,
    pub documents: BTreeMap<String, DocumentRecord>,
    pub last_updated_at: String,
}

impl Default for CatalogState {
    fn default() -> Self {
        Self {
            schema_version: CATALOG_SCHEMA_VERSION,
            catalog_revision: 0,
            documents: BTreeMap::new(),
            last_updated_at: now_iso(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CatalogListOptions {
    pub filter: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub format: Option<String>,
    pub client: Option<String>,
    pub project: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogListResponse {
    pub total: usize,
    pub filtered_total: usize,
    pub catalog_revision: u64,
    pub documents: Vec<DocumentRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSummary {
    pub total_documents: usize,
    pub total_raw_sources: usize,
    pub ready_documents: usize,
    pub processing_documents: usize,
    pub attention_documents: usize,
    pub total_passages: usize,
    pub catalog_revision: u64,
}

/// Load the catalog as an Arc<CatalogState>, using thread-safe in-memory caching.
pub fn load_catalog_arc(vault_path: &Path) -> Result<Arc<CatalogState>, String> {
    let r = root(vault_path)?;
    let sys = match child(&r, "00_SYSTEM") {
        Ok(d) => d,
        Err(_) => return Ok(Arc::new(CatalogState::default())),
    };
    if !names(&sys)?.iter().any(|s| s == CATALOG_FILE) {
        return Ok(Arc::new(CatalogState::default()));
    }

    let cat_file = vault_path.join("00_SYSTEM").join(CATALOG_FILE);
    let rev = CATALOG_REVISION.load(Ordering::SeqCst);

    if let Ok(meta) = std::fs::metadata(&cat_file) {
        let size = meta.len();
        let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        if let Ok(guard) = CATALOG_CACHE.lock() {
            if let Some(entry) = guard.get(vault_path) {
                let is_mtime_match = entry.mtime == mtime
                    || entry.mtime.duration_since(mtime).map(|d| d.as_millis() < 100).unwrap_or(false)
                    || mtime.duration_since(entry.mtime).map(|d| d.as_millis() < 100).unwrap_or(false);
                if entry.size == size && is_mtime_match {
                    return Ok(entry.data.clone());
                }
            }
        }
    }

    CATALOG_DISK_READ_COUNT.fetch_add(1, Ordering::SeqCst);
    let bytes = read(&sys, CATALOG_FILE)?;
    if bytes.len() > 32 * 1024 * 1024 {
        return Err("Catalog file exceeds 32 MB".into());
    }
    let catalog: CatalogState = serde_json::from_slice(&bytes).map_err(err)?;
    let data_arc = Arc::new(catalog);

    if let Ok(meta) = std::fs::metadata(&cat_file) {
        let size = meta.len();
        let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        if let Ok(mut guard) = CATALOG_CACHE.lock() {
            guard.insert(
                vault_path.to_path_buf(),
                CatalogCacheEntry {
                    vault_path: vault_path.to_path_buf(),
                    size,
                    mtime,
                    revision: rev,
                    data: data_arc.clone(),
                },
            );
        }
    }

    Ok(data_arc)
}

/// Load the catalog from 00_SYSTEM/VAULT_CATALOG.json or return Default if missing (cloned from cache).
pub fn load_catalog(vault_path: &Path) -> Result<CatalogState, String> {
    load_catalog_arc(vault_path).map(|arc| (*arc).clone())
}

/// Atomically save the catalog to 00_SYSTEM/VAULT_CATALOG.json
pub fn save_catalog(vault_path: &Path, catalog: &mut CatalogState) -> Result<(), String> {
    catalog.catalog_revision += 1;
    catalog.last_updated_at = now_iso();
    let r = root(vault_path)?;
    let sys = child(&r, "00_SYSTEM")?;
    let tmp = format!(".catalog-{}.tmp", crate::ai::random_token()?);
    let bytes = serde_json::to_vec_pretty(&catalog).map_err(err)?;
    write_new(&sys, &tmp, &bytes)?;
    let res = sys.rename(&tmp, &sys, CATALOG_FILE).map_err(err);
    if res.is_err() {
        let _ = sys.remove_file(&tmp);
        return res;
    }
    bump_catalog_revision();
    let rev = CATALOG_REVISION.load(Ordering::SeqCst);
    let arc_cat = Arc::new(catalog.clone());
    let cat_file = vault_path.join("00_SYSTEM").join(CATALOG_FILE);
    if let Ok(meta) = std::fs::metadata(&cat_file) {
        let size = meta.len();
        let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        if let Ok(mut guard) = CATALOG_CACHE.lock() {
            guard.insert(
                vault_path.to_path_buf(),
                CatalogCacheEntry {
                    vault_path: vault_path.to_path_buf(),
                    size,
                    mtime,
                    revision: rev,
                    data: arc_cat,
                },
            );
        }
    }
    Ok(())
}

/// Helper to generate stable document ID from relative path
pub fn make_document_id(relative_path: &str) -> String {
    format!("doc_{}", &compute_sha256(relative_path.as_bytes())[..16])
}

/// Chunk text into overlapping passages with locators
pub fn chunk_text_to_passages(document_id: &str, text: &str) -> Vec<DocumentPassage> {
    let mut passages = Vec::new();
    if text.trim().is_empty() {
        return passages;
    }

    let target_chunk: usize = 1200;
    let overlap_chars_count: usize = 150;

    let raw_paragraphs: Vec<&str> = text.split("\n\n").filter(|p| !p.trim().is_empty()).collect();

    struct Segment {
        text: String,
        locator: Option<String>,
        paragraph_num: usize,
    }

    let mut segments: Vec<Segment> = Vec::new();
    let mut current_page_or_slide: Option<String> = None;

    for (p_idx, p) in raw_paragraphs.iter().enumerate() {
        let trimmed = p.trim();
        if trimmed.starts_with("## Pagina ") {
            let page_num = trimmed.trim_start_matches("## Pagina ").trim();
            current_page_or_slide = Some(format!("Pagina {}", page_num));
        } else if trimmed.starts_with("## Slide ") {
            let slide_num = trimmed.trim_start_matches("## Slide ").trim();
            current_page_or_slide = Some(format!("Slide {}", slide_num));
        }

        // If a single paragraph is longer than target_chunk - overlap, split into smaller non-overlapping segments
        let max_seg_len = target_chunk.saturating_sub(overlap_chars_count);
        if p.chars().count() > max_seg_len {
            let chars: Vec<char> = p.chars().collect();
            let mut start = 0;
            while start < chars.len() {
                let mut end = if start + max_seg_len < chars.len() {
                    start + max_seg_len
                } else {
                    chars.len()
                };

                // Try to find a sentence boundary (. or \n or ! or ?)
                if end < chars.len() {
                    let min_bound = start + max_seg_len / 2;
                    let mut found = false;
                    for i in (min_bound..=end).rev() {
                        if chars[i] == '.' || chars[i] == '\n' || chars[i] == '!' || chars[i] == '?' {
                            end = i + 1;
                            found = true;
                            break;
                        }
                    }
                    if !found {
                        for i in (min_bound..=end).rev() {
                            if chars[i] == ' ' {
                                end = i + 1;
                                break;
                            }
                        }
                    }
                }

                let slice: String = chars[start..end].iter().collect();
                if !slice.trim().is_empty() {
                    segments.push(Segment {
                        text: slice,
                        locator: current_page_or_slide.clone(),
                        paragraph_num: p_idx + 1,
                    });
                }

                if end >= chars.len() {
                    break;
                }
                start = end;
            }
        } else {
            segments.push(Segment {
                text: p.to_string(),
                locator: current_page_or_slide.clone(),
                paragraph_num: p_idx + 1,
            });
        }
    }

    if segments.is_empty() {
        return passages;
    }

    let mut current_chunk = String::new();
    let mut cur_locator: Option<String> = None;
    let mut start_p_num = 1;
    let mut end_p_num = 1;
    let mut p_idx = 0;

    for seg in &segments {
        if current_chunk.is_empty() {
            start_p_num = seg.paragraph_num;
            end_p_num = seg.paragraph_num;
            cur_locator = seg.locator.clone();
        }

        let page_or_slide_changed = seg.locator.is_some() && cur_locator.is_some() && seg.locator != cur_locator;
        let chunk_oversized = current_chunk.chars().count() + seg.text.chars().count() > target_chunk;

        if (page_or_slide_changed || chunk_oversized) && !current_chunk.is_empty() {
            let chunk_str = current_chunk.trim().to_string();
            let hash = compute_sha256(chunk_str.as_bytes());
            let locator = if let Some(ref loc) = cur_locator {
                loc.clone()
            } else if start_p_num == end_p_num {
                format!("Paragrafo {}", start_p_num)
            } else {
                format!("Paragrafi {}-{}", start_p_num, end_p_num)
            };

            passages.push(DocumentPassage {
                passage_id: format!("{}_p{}", document_id, p_idx),
                locator,
                char_count: chunk_str.chars().count(),
                sha256: hash,
                text: chunk_str.clone(),
            });
            p_idx += 1;

            // Carry over overlap only if within the same page/slide section
            let chunk_chars: Vec<char> = chunk_str.chars().collect();
            let overlap_chars = if !page_or_slide_changed && chunk_chars.len() > overlap_chars_count {
                chunk_chars[chunk_chars.len() - overlap_chars_count..].iter().collect::<String>()
            } else {
                String::new()
            };
            current_chunk = overlap_chars;
            start_p_num = seg.paragraph_num;
            cur_locator = seg.locator.clone();
        }

        if !current_chunk.is_empty() {
            current_chunk.push_str("\n\n");
        }
        current_chunk.push_str(&seg.text);
        end_p_num = seg.paragraph_num;
        if cur_locator.is_none() && seg.locator.is_some() {
            cur_locator = seg.locator.clone();
        }
    }

    if !current_chunk.trim().is_empty() {
        let chunk_str = current_chunk.trim().to_string();
        let hash = compute_sha256(chunk_str.as_bytes());
        let locator = if let Some(ref loc) = cur_locator {
            loc.clone()
        } else if start_p_num == end_p_num {
            format!("Paragrafo {}", start_p_num)
        } else {
            format!("Paragrafi {}-{}", start_p_num, end_p_num)
        };

        passages.push(DocumentPassage {
            passage_id: format!("{}_p{}", document_id, p_idx),
            locator,
            char_count: chunk_str.chars().count(),
            sha256: hash,
            text: chunk_str,
        });
    }

    passages
}

fn collect_entries_recursive(
    d: &cap_std::fs::Dir,
    prefix: &str,
    depth: usize,
    out: &mut Vec<(String, String, Vec<u8>)>,
) -> Result<(), String> {
    if depth > 32 {
        return Ok(());
    }
    for name in names(d)? {
        if name.starts_with('.') {
            continue;
        }
        let rel = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", prefix, name)
        };
        let m = d.symlink_metadata(&name).map_err(err)?;
        if m.is_symlink() {
            continue;
        }
        if m.is_dir() {
            if let Ok(sub) = child(d, &name) {
                let _ = collect_entries_recursive(&sub, &rel, depth + 1, out);
            }
        } else if m.is_file() {
            if let Ok(bytes) = read(d, &name) {
                out.push((rel, name, bytes));
            }
        }
    }
    Ok(())
}

/// Scan RAW sources, migrate existing AUTO_KNOWLEDGE jobs if any, and reconcile the catalog.
/// Does not delete original files or alter legacy proposal status.
pub fn sync_catalog_from_vault(vault_path: &Path) -> Result<CatalogState, String> {
    let mut catalog = load_catalog(vault_path)?;
    let r = root(vault_path)?;
    let mut discovered_paths = std::collections::BTreeSet::new();

    // 1. Scan 20_RAW_SOURCES with content-hash deduplication and alias preservation
    if let Ok(raw_dir) = child(&r, "20_RAW_SOURCES") {
        let mut raw_entries = Vec::new();
        let _ = collect_entries_recursive(&raw_dir, "", 0, &mut raw_entries);
        for (sub_rel, name, bytes) in raw_entries {
            let rel_path = format!("20_RAW_SOURCES/{}", sub_rel);
            let hash = compute_sha256(&bytes);
            discovered_paths.insert(rel_path.clone());

            let doc_id = make_document_id(&rel_path);
            let existing_match = catalog
                .documents
                .values_mut()
                .find(|d| d.original_path == rel_path || d.document_id == doc_id);

            if let Some(existing) = existing_match {
                if existing.content_hash != hash {
                    // Content changed: keep stable identity, increment revision, reset extraction
                    existing.content_hash = hash;
                    existing.file_size = bytes.len() as u64;
                    existing.revision += 1;
                    existing.updated_at = now_iso();
                    existing.extraction_status = ExtractionStatus::Pending;
                    existing.extraction_error = None;
                    existing.extracted_text_path = None;
                    existing.extracted_text_hash = None;
                    existing.passages.clear();
                    existing.lexical_status = PhaseInfo::default();
                    existing.semantic_status = PhaseInfo::default();
                    existing.classification_status = PhaseInfo::default();
                    existing.wiki_status = PhaseInfo::default();
                }
                continue;
            }

            // Deduplication: if another document has identical content hash, record alias
            let alias_match = catalog
                .documents
                .values_mut()
                .find(|d| d.content_hash == hash);

            if let Some(existing_alias) = alias_match {
                if existing_alias.original_path != rel_path && !existing_alias.aliases.contains(&rel_path) {
                    existing_alias.aliases.push(rel_path.clone());
                    existing_alias.updated_at = now_iso();
                }
                continue;
            }

            let ext = Path::new(&name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let mime = match ext.as_str() {
                "pdf" => "application/pdf",
                "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "doc" => "application/msword",
                "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "odt" => "application/vnd.oasis.opendocument.text",
                "ods" => "application/vnd.oasis.opendocument.spreadsheet",
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "txt" => "text/plain",
                "md" => "text/markdown",
                _ => "application/octet-stream",
            };

            catalog.documents.insert(doc_id.clone(), DocumentRecord {
                document_id: doc_id.clone(),
                revision: 1,
                content_hash: hash.clone(),
                original_path: rel_path.clone(),
                aliases: Vec::new(),
                file_name: name.clone(),
                extension: ext.clone(),
                file_size: bytes.len() as u64,
                mime_type: mime.to_string(),
                imported_at: now_iso(),
                updated_at: now_iso(),
                extraction_status: ExtractionStatus::Pending,
                extraction_error: None,
                extracted_text_path: None,
                extracted_text_hash: None,
                passages: Vec::new(),
                lexical_status: PhaseInfo::default(),
                semantic_status: PhaseInfo::default(),
                classification_status: PhaseInfo::default(),
                wiki_status: PhaseInfo::default(),
                category: None,
                client: None,
                project: None,
                tags: Vec::new(),
                evidence_type: "source".into(),
                editorial_status: "auto".into(),
            });
        }
    }

    // 2. Scan 90_PROPOSALS — preserves legacy proposals without fabricating approval
    if let Ok(prop_dir) = child(&r, "90_PROPOSALS") {
        for name in names(&prop_dir)? {
            if !name.ends_with(".md") || name.starts_with('.') {
                continue;
            }
            let rel_path = format!("90_PROPOSALS/{}", name);
            let bytes = match read(&prop_dir, &name) {
                Ok(b) => b,
                Err(_) => continue,
            };
            let hash = compute_sha256(&bytes);
            discovered_paths.insert(rel_path.clone());
            let doc_id = make_document_id(&rel_path);
            let text = String::from_utf8_lossy(&bytes).to_string();
            let fm = crate::vault::frontmatter(&text).ok().flatten();

            let existing_match = catalog
                .documents
                .values_mut()
                .find(|d| d.original_path == rel_path || d.document_id == doc_id);

            if let Some(existing) = existing_match {
                if existing.content_hash != hash {
                    existing.content_hash = hash.clone();
                    existing.file_size = bytes.len() as u64;
                    existing.revision += 1;
                    existing.updated_at = now_iso();
                    existing.extracted_text_hash = Some(hash.clone());
                    existing.passages = chunk_text_to_passages(&existing.document_id, &text);
                }
                continue;
            }

            catalog.documents.insert(doc_id.clone(), DocumentRecord {
                document_id: doc_id.clone(),
                revision: 1,
                content_hash: hash.clone(),
                original_path: rel_path.clone(),
                aliases: Vec::new(),
                file_name: name.clone(),
                extension: "md".into(),
                file_size: bytes.len() as u64,
                mime_type: "text/markdown".into(),
                imported_at: now_iso(),
                updated_at: now_iso(),
                extraction_status: ExtractionStatus::Ready,
                extraction_error: None,
                extracted_text_path: Some(rel_path.clone()),
                extracted_text_hash: Some(hash.clone()),
                passages: chunk_text_to_passages(&doc_id, &text),
                lexical_status: PhaseInfo { status: PhaseState::Ready, attempts: 1, error: None, updated_at: now_iso() },
                semantic_status: PhaseInfo::default(),
                classification_status: PhaseInfo::default(),
                wiki_status: PhaseInfo::default(),
                category: Some("proposal".into()),
                client: fm.as_ref().and_then(|f| f["client"].as_str()).map(String::from),
                project: fm.as_ref().and_then(|f| f["project"].as_str()).map(String::from),
                tags: Vec::new(),
                evidence_type: "legacy_draft".into(),
                editorial_status: "draft".into(),
            });
        }
    }

    // 3. Scan Knowledge Categories (01_CLIENTS .. 10_APPROVED_OUTPUTS)
    const KNOWLEDGE_FOLDERS: [&str; 10] = [
        "01_CLIENTS", "02_PROJECTS", "03_BRANDS", "04_POSITIONING", "05_PACKAGING_KNOWLEDGE",
        "06_METHODS", "07_CASE_STUDIES", "08_MARKET_RESEARCH", "09_COMPETITORS", "10_APPROVED_OUTPUTS",
    ];
    for folder in KNOWLEDGE_FOLDERS {
        if let Ok(k_dir) = child(&r, folder) {
            let mut k_entries = Vec::new();
            let _ = collect_entries_recursive(&k_dir, "", 0, &mut k_entries);
            for (sub_rel, name, bytes) in k_entries {
                if !name.ends_with(".md") {
                    continue;
                }
                let rel_path = format!("{}/{}", folder, sub_rel);
                let hash = compute_sha256(&bytes);
                discovered_paths.insert(rel_path.clone());
                let doc_id = make_document_id(&rel_path);
                let text = String::from_utf8_lossy(&bytes).to_string();
                let fm = crate::vault::frontmatter(&text).ok().flatten();
                let auto_kind = fm.as_ref().and_then(|f| f["automation_kind"].as_str());
                let ev_type = if let Some(k) = auto_kind {
                    if k == "wiki" { "wiki" } else { "source" }
                } else {
                    "human_note"
                };
                let ed_status = fm.as_ref().and_then(|f| f["status"].as_str()).unwrap_or("approved");

                let existing_match = catalog
                    .documents
                    .values_mut()
                    .find(|d| d.original_path == rel_path || d.document_id == doc_id);

                if let Some(existing) = existing_match {
                    if existing.content_hash != hash {
                        existing.content_hash = hash.clone();
                        existing.file_size = bytes.len() as u64;
                        existing.revision += 1;
                        existing.updated_at = now_iso();
                        existing.extracted_text_hash = Some(hash.clone());
                        existing.passages = chunk_text_to_passages(&existing.document_id, &text);
                    }
                    continue;
                }

                    let norm_cat = match folder {
                        "01_CLIENTS" => "client",
                        "02_PROJECTS" => "project",
                        "03_BRANDS" => "brand",
                        "04_POSITIONING" => "positioning",
                        "05_PACKAGING_KNOWLEDGE" => "packaging_knowledge",
                        "06_METHODS" => "method",
                        "07_CASE_STUDIES" => "case_study",
                        "08_MARKET_RESEARCH" => "market_research",
                        "09_COMPETITORS" => "competitor",
                        "10_APPROVED_OUTPUTS" => "approved_output",
                        _ => folder,
                    };
                    catalog.documents.insert(doc_id.clone(), DocumentRecord {
                    document_id: doc_id.clone(),
                    revision: 1,
                    content_hash: hash.clone(),
                    original_path: rel_path.clone(),
                    aliases: Vec::new(),
                    file_name: name.clone(),
                    extension: "md".into(),
                    file_size: bytes.len() as u64,
                    mime_type: "text/markdown".into(),
                    imported_at: now_iso(),
                    updated_at: now_iso(),
                    extraction_status: ExtractionStatus::Ready,
                    extraction_error: None,
                    extracted_text_path: Some(rel_path.clone()),
                    extracted_text_hash: Some(hash.clone()),
                    passages: chunk_text_to_passages(&doc_id, &text),
                    lexical_status: PhaseInfo { status: PhaseState::Ready, attempts: 1, error: None, updated_at: now_iso() },
                    semantic_status: PhaseInfo::default(),
                    classification_status: PhaseInfo { status: PhaseState::Ready, attempts: 1, error: None, updated_at: now_iso() },
                    wiki_status: PhaseInfo::default(),
                    category: Some(norm_cat.to_string()),
                    client: fm.as_ref().and_then(|f| f["client"].as_str()).map(String::from),
                    project: fm.as_ref().and_then(|f| f["project"].as_str()).map(String::from),
                    tags: Vec::new(),
                    evidence_type: ev_type.into(),
                    editorial_status: ed_status.into(),
                });
            }
        }
    }

    // Removal detection: prune documents whose original files were deleted on disk
    catalog.documents.retain(|_, doc| {
        if doc.original_path.starts_with("20_RAW_SOURCES/")
            || doc.original_path.starts_with("90_PROPOSALS/")
            || KNOWLEDGE_FOLDERS.iter().any(|f| doc.original_path.starts_with(f))
        {
            discovered_paths.contains(&doc.original_path)
        } else {
            true
        }
    });

    // 4. Read existing AUTO_KNOWLEDGE.json if present to link prior completed jobs
    if let Ok(sys) = child(&r, "00_SYSTEM") {
        if names(&sys)?.iter().any(|s| s == "AUTO_KNOWLEDGE.json") {
            if let Ok(ak_bytes) = read(&sys, "AUTO_KNOWLEDGE.json") {
                if let Ok(ak_val) = serde_json::from_slice::<Value>(&ak_bytes) {
                    if let Some(jobs) = ak_val.get("jobs").and_then(Value::as_object) {
                        for (raw_key, job) in jobs {
                            if !raw_key.starts_with("20_RAW_SOURCES/") {
                                continue;
                            }
                            let status = job.get("status").and_then(Value::as_str).unwrap_or("");
                            let output = job.get("output").and_then(Value::as_str);
                            let output_hash = job.get("outputHash").and_then(Value::as_str);
                            let cat = job.get("category").and_then(Value::as_str);
                            let client = job.get("client").and_then(Value::as_str);
                            let project = job.get("project").and_then(Value::as_str);

                            // Find matching doc in catalog by original_path
                            for doc in catalog.documents.values_mut() {
                                if doc.original_path == *raw_key {
                                    if status == "ready" {
                                        doc.extraction_status = ExtractionStatus::Ready;
                                        doc.extracted_text_path = output.map(String::from);
                                        doc.extracted_text_hash = output_hash.map(String::from);
                                        if let Some(c) = cat {
                                            if !c.is_empty() {
                                                doc.category = Some(c.into());
                                            }
                                        }
                                        if let Some(cl) = client {
                                            if !cl.is_empty() {
                                                doc.client = Some(cl.into());
                                            }
                                        }
                                        if let Some(pr) = project {
                                            if !pr.is_empty() {
                                                doc.project = Some(pr.into());
                                            }
                                        }
                                        doc.classification_status.status = PhaseState::Ready;
                                    } else if status == "unsupported" {
                                        doc.extraction_status = ExtractionStatus::Unsupported;
                                        doc.extraction_error = Some("Formato non estraibile".into());
                                    } else if status == "error" {
                                        doc.extraction_status = ExtractionStatus::Failed;
                                        doc.extraction_error = job
                                            .get("error")
                                            .and_then(Value::as_str)
                                            .map(String::from);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    save_catalog(vault_path, &mut catalog)?;
    Ok(catalog)
}

/// Backup existing catalog state
pub fn backup_catalog(vault_path: &Path) -> Result<(), String> {
    let r = root(vault_path)?;
    let sys = child(&r, "00_SYSTEM")?;
    if names(&sys)?.iter().any(|s| s == CATALOG_FILE) {
        let bytes = read(&sys, CATALOG_FILE)?;
        let backup_file = "VAULT_CATALOG.bak.json";
        let tmp = format!(".catalog-bak-{}.tmp", crate::ai::random_token()?);
        write_new(&sys, &tmp, &bytes)?;
        sys.rename(&tmp, &sys, backup_file).map_err(err)?;
    }
    Ok(())
}

/// Rollback catalog from backup
pub fn rollback_catalog(vault_path: &Path) -> Result<CatalogState, String> {
    let r = root(vault_path)?;
    let sys = child(&r, "00_SYSTEM")?;
    let backup_file = "VAULT_CATALOG.bak.json";
    if !names(&sys)?.iter().any(|s| s == backup_file) {
        return Err("Nessun backup catalogo disponibile per il rollback".into());
    }
    let bytes = read(&sys, backup_file)?;
    let mut catalog: CatalogState = serde_json::from_slice(&bytes).map_err(err)?;
    save_catalog(vault_path, &mut catalog)?;
    Ok(catalog)
}

fn extract_plain_text(bytes: &[u8], ext: &str) -> Result<String, String> {
    let text = if bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff]) {
        if bytes.len() % 2 != 0 {
            return Err("Testo UTF-16 incompleto".into());
        }
        let le = bytes[0] == 0xff;
        let units: Vec<_> = bytes[2..]
            .chunks_exact(2)
            .map(|b| {
                if le {
                    u16::from_le_bytes([b[0], b[1]])
                } else {
                    u16::from_be_bytes([b[0], b[1]])
                }
            })
            .collect();
        String::from_utf16(&units).map_err(|_| "Testo UTF-16 non valido")?
    } else {
        String::from_utf8(bytes.to_vec()).map_err(|_| "Codifica testo non UTF-8")?
    };
    let text = text.trim_start_matches('\u{feff}').replace("\r\n", "\n");
    let text = if ext == "html" || ext == "htm" {
        crate::compiler::sanitize_html(&text)
    } else {
        text
    };
    if text.trim().is_empty() {
        return Err("Documento privo di testo leggibile".into());
    }
    Ok(text)
}

fn extract_spreadsheet_content(bytes: &[u8]) -> Result<String, String> {
    use calamine::Reader;
    let mut workbook = calamine::open_workbook_auto_from_rs(std::io::Cursor::new(bytes.to_vec()))
        .map_err(|_| "Foglio di calcolo non leggibile o protetto")?;
    let mut output = String::new();
    for sheet in workbook.sheet_names() {
        let range = workbook
            .worksheet_range(&sheet)
            .map_err(|_| "Impossibile leggere tutte le celle del foglio")?;
        output.push_str(&format!("## Foglio: {sheet}\n\n"));
        for (row, col, value) in range.cells() {
            if value.to_string().is_empty() {
                continue;
            }
            output.push_str(&format!(
                "- Riga {}, colonna {}: {}\n",
                row + range.start().map(|p| p.0 as usize).unwrap_or(0) + 1,
                col + range.start().map(|p| p.1 as usize).unwrap_or(0) + 1,
                value
            ));
            if output.len() > 16 * 1024 * 1024 {
                return Err("Contenuto estratto oltre il limite di 16 MB".into());
            }
        }
    }
    if output.trim().is_empty() {
        return Err("Foglio privo di contenuto".into());
    }
    Ok(output)
}

pub fn extract_document_content(bytes: &[u8], filename: &str) -> Result<String, String> {
    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ["xls", "xlsx", "xlsb", "ods"].contains(&ext.as_str()) {
        extract_spreadsheet_content(bytes)
    } else if ["txt", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml", "log", "eml", "html", "htm"].contains(&ext.as_str()) {
        extract_plain_text(bytes, &ext)
    } else {
        extraction::extract(bytes, filename)
    }
}

/// Extract and generate passages for any document in Pending status.
/// Operates completely OFFLINE without any API key or network connection!
pub fn process_pending_extractions(vault_path: &Path) -> Result<usize, String> {
    let mut catalog = load_catalog(vault_path)?;
    let mut processed = 0;
    let r = root(vault_path)?;

    for doc in catalog.documents.values_mut() {
        if doc.extraction_status != ExtractionStatus::Pending {
            continue;
        }

        doc.extraction_status = ExtractionStatus::Processing;
        let original_bytes = match read_path(&r, &doc.original_path) {
            Ok(b) => b,
            Err(e) => {
                doc.extraction_status = ExtractionStatus::Failed;
                doc.extraction_error = Some(format!("Impossibile leggere l'originale: {}", e));
                continue;
            }
        };

        match extract_document_content(&original_bytes, &doc.file_name) {
            Ok(text) => {
                let trimmed = text.trim().to_string();
                if trimmed.is_empty() {
                    doc.extraction_status = ExtractionStatus::Ready;
                    doc.passages.clear();
                } else {
                    let hash = compute_sha256(trimmed.as_bytes());
                    doc.extracted_text_hash = Some(hash);
                    doc.passages = chunk_text_to_passages(&doc.document_id, &trimmed);
                    doc.extraction_status = ExtractionStatus::Ready;
                    doc.extraction_error = None;
                }
                doc.updated_at = now_iso();
                processed += 1;
            }
            Err(e) => {
                if e.contains("corrotto") || e.contains("protetto") {
                    doc.extraction_status = ExtractionStatus::Protected;
                } else if e.contains("Formato") || e.contains("non consentito") {
                    doc.extraction_status = ExtractionStatus::Unsupported;
                } else {
                    doc.extraction_status = ExtractionStatus::Failed;
                }
                doc.extraction_error = Some(e);
                doc.updated_at = now_iso();
            }
        }
    }

    if processed > 0 || catalog.documents.values().any(|d| d.extraction_status == ExtractionStatus::Processing) {
        save_catalog(vault_path, &mut catalog)?;
    }

    Ok(processed)
}

/// List documents matching options with pagination
pub fn list_documents(vault_path: &Path, options: CatalogListOptions) -> Result<CatalogListResponse, String> {
    let catalog = load_catalog_arc(vault_path)?;
    let total = catalog.documents.len();

    let filter_term = options.filter.as_deref().map(|s| s.to_lowercase());
    let cat_filter = options.category.as_deref();
    let status_filter = options.status.as_deref();
    let client_filter = options.client.as_deref().map(|s| s.to_lowercase());
    let project_filter = options.project.as_deref().map(|s| s.to_lowercase());
    let format_filter = options.format.as_deref().map(|s| s.to_lowercase());

    let mut filtered: Vec<DocumentRecord> = catalog
        .documents
        .values()
        .cloned()
        .filter(|doc| {
            if let Some(ref term) = filter_term {
                let match_name = doc.file_name.to_lowercase().contains(term);
                let match_path = doc.original_path.to_lowercase().contains(term);
                let match_passages = doc.passages.iter().any(|p| p.text.to_lowercase().contains(term));
                if !match_name && !match_path && !match_passages {
                    return false;
                }
            }
            if let Some(cat) = cat_filter {
                if cat != "all" && doc.category.as_deref() != Some(cat) {
                    return false;
                }
            }
            if let Some(st) = status_filter {
                let st_str = match doc.extraction_status {
                    ExtractionStatus::Ready => "ready",
                    ExtractionStatus::Processing => "processing",
                    ExtractionStatus::Pending => "pending",
                    ExtractionStatus::Unsupported => "unsupported",
                    ExtractionStatus::Protected => "protected",
                    ExtractionStatus::Failed => "failed",
                };
                if st != "all" && st != st_str {
                    return false;
                }
            }
            if let Some(ref fmt) = format_filter {
                if fmt != "all" && doc.extension.to_lowercase() != *fmt {
                    return false;
                }
            }
            if let Some(ref cl) = client_filter {
                if doc.client.as_ref().map(|s| s.to_lowercase()) != Some(cl.clone()) {
                    return false;
                }
            }
            if let Some(ref pr) = project_filter {
                if doc.project.as_ref().map(|s| s.to_lowercase()) != Some(pr.clone()) {
                    return false;
                }
            }
            true
        })
        .collect();

    // Sort: newest first
    filtered.sort_by(|a, b| b.imported_at.cmp(&a.imported_at));

    let filtered_total = filtered.len();
    let offset = options.offset.unwrap_or(0);
    let limit = options.limit.unwrap_or(50);

    let paged = filtered.into_iter().skip(offset).take(limit).collect();

    Ok(CatalogListResponse {
        total,
        filtered_total,
        catalog_revision: catalog.catalog_revision,
        documents: paged,
    })
}

/// Get a single document record by ID
pub fn get_document(vault_path: &Path, document_id: &str) -> Result<DocumentRecord, String> {
    let catalog = load_catalog_arc(vault_path)?;
    catalog
        .documents
        .get(document_id)
        .cloned()
        .ok_or_else(|| format!("Documento non trovato: {}", document_id))
}

/// Direct unpaged lookup of a document by relative path or alias
pub fn get_document_by_path(vault_path: &Path, rel_path: &str) -> Result<DocumentRecord, String> {
    let catalog = load_catalog_arc(vault_path)?;
    let clean = rel_path.trim_start_matches("./").trim_start_matches('/');
    // 1. Exact match on original_path
    for doc in catalog.documents.values() {
        if doc.original_path == clean {
            return Ok(doc.clone());
        }
    }
    // 2. Match on aliases
    for doc in catalog.documents.values() {
        if doc.aliases.iter().any(|a| a == clean) {
            return Ok(doc.clone());
        }
    }
    // 3. Suffix or filename match with strict homonym disambiguation
    let suffix_matches: Vec<_> = catalog
        .documents
        .values()
        .filter(|doc| doc.original_path.ends_with(&format!("/{}", clean)) || doc.file_name == clean)
        .collect();
    if suffix_matches.len() == 1 {
        return Ok(suffix_matches[0].clone());
    } else if suffix_matches.len() > 1 {
        return Err(format!(
            "Riferimento ambiguo: '{}' corrisponde a molteplici documenti con lo stesso nome in cartelle diverse",
            clean
        ));
    }
    Err(format!("Nessun documento trovato per il percorso: {}", clean))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentVerificationReport {
    pub is_valid: bool,
    pub status: String, // "verified" | "revision_mismatch" | "tampered_original" | "tampered_passage" | "missing_original" | "missing_passage" | "missing_document"
    pub document_id: String,
    pub original_path: String,
    pub current_revision: u64,
    pub expected_revision: Option<u64>,
    pub current_content_hash: String,
    pub expected_hash: Option<String>,
    pub passage_id: Option<String>,
    pub passage_locator: Option<String>,
    pub passage_text: Option<String>,
    pub verified_text: Option<String>,
    pub message: String,
}

/// Verifies document original bytes, passage hash, revision, and extracted text integrity
pub fn verify_document_passage_integrity(
    vault_path: &Path,
    document_id: &str,
    passage_id: Option<&str>,
    expected_hash: Option<&str>,
    expected_revision: Option<u64>,
) -> Result<DocumentVerificationReport, String> {
    let catalog = load_catalog_arc(vault_path)?;
    let doc = match catalog.documents.get(document_id) {
        Some(d) => d,
        None => {
            return Ok(DocumentVerificationReport {
                is_valid: false,
                status: "missing_document".into(),
                document_id: document_id.into(),
                original_path: "".into(),
                current_revision: 0,
                expected_revision,
                current_content_hash: "".into(),
                expected_hash: expected_hash.map(String::from),
                passage_id: passage_id.map(String::from),
                passage_locator: None,
                passage_text: None,
                verified_text: None,
                message: format!("Documento non registrato nel catalogo: {}", document_id),
            });
        }
    };

    let full_path = vault_path.join(&doc.original_path);
    if !full_path.exists() {
        return Ok(DocumentVerificationReport {
            is_valid: false,
            status: "missing_original".into(),
            document_id: doc.document_id.clone(),
            original_path: doc.original_path.clone(),
            current_revision: doc.revision,
            expected_revision,
            current_content_hash: doc.content_hash.clone(),
            expected_hash: expected_hash.map(String::from),
            passage_id: passage_id.map(String::from),
            passage_locator: None,
            passage_text: None,
            verified_text: None,
            message: format!("File originale non presente su disco: {}", doc.original_path),
        });
    }

    // Verify disk hash against stored content_hash
    let disk_bytes = std::fs::read(&full_path).map_err(err)?;
    let disk_hash = compute_sha256(&disk_bytes);
    if disk_hash != doc.content_hash {
        return Ok(DocumentVerificationReport {
            is_valid: false,
            status: "tampered_original".into(),
            document_id: doc.document_id.clone(),
            original_path: doc.original_path.clone(),
            current_revision: doc.revision,
            expected_revision,
            current_content_hash: disk_hash.clone(),
            expected_hash: expected_hash.map(String::from),
            passage_id: passage_id.map(String::from),
            passage_locator: None,
            passage_text: None,
            verified_text: None,
            message: format!(
                "Il file originale sul disco è stato modificato dopo l'ingestion (hash catalogo: {}, hash disco: {})",
                doc.content_hash, disk_hash
            ),
        });
    }

    // Verify expected revision
    if let Some(exp_rev) = expected_revision {
        if exp_rev != doc.revision {
            return Ok(DocumentVerificationReport {
                is_valid: false,
                status: "revision_mismatch".into(),
                document_id: doc.document_id.clone(),
                original_path: doc.original_path.clone(),
                current_revision: doc.revision,
                expected_revision: Some(exp_rev),
                current_content_hash: doc.content_hash.clone(),
                expected_hash: expected_hash.map(String::from),
                passage_id: passage_id.map(String::from),
                passage_locator: None,
                passage_text: None,
                verified_text: None,
                message: format!(
                    "Revisione del documento aggiornata: la citazione fa riferimento alla rev. {}, mentre il documento corrente è alla rev. {}",
                    exp_rev, doc.revision
                ),
            });
        }
    }

    // Verify expected document hash when passage_id is None
    if passage_id.is_none() {
        if let Some(exp_h) = expected_hash {
            if exp_h != doc.content_hash {
                return Ok(DocumentVerificationReport {
                    is_valid: false,
                    status: "tampered_original".into(),
                    document_id: doc.document_id.clone(),
                    original_path: doc.original_path.clone(),
                    current_revision: doc.revision,
                    expected_revision,
                    current_content_hash: doc.content_hash.clone(),
                    expected_hash: Some(exp_h.into()),
                    passage_id: None,
                    passage_locator: None,
                    passage_text: None,
                    verified_text: None,
                    message: format!(
                        "Hash del documento citato non corrispondente (atteso: {}, registrato: {})",
                        exp_h, doc.content_hash
                    ),
                });
            }
        }
    }

    // Verify passage if requested
    let mut p_locator = None;
    let mut p_text = None;
    if let Some(pid) = passage_id {
        match doc.passages.iter().find(|p| p.passage_id == pid) {
            Some(p) => {
                let comp_p_hash = compute_sha256(p.text.as_bytes());
                if comp_p_hash != p.sha256 {
                    return Ok(DocumentVerificationReport {
                        is_valid: false,
                        status: "tampered_passage".into(),
                        document_id: doc.document_id.clone(),
                        original_path: doc.original_path.clone(),
                        current_revision: doc.revision,
                        expected_revision,
                        current_content_hash: doc.content_hash.clone(),
                        expected_hash: expected_hash.map(String::from),
                        passage_id: Some(pid.into()),
                        passage_locator: Some(p.locator.clone()),
                        passage_text: Some(p.text.clone()),
                        verified_text: None,
                        message: format!(
                            "Integrità del testo del passaggio compromessa nel catalogo (hash registrato: {}, ricalcolato: {})",
                            p.sha256, comp_p_hash
                        ),
                    });
                }
                if let Some(exp_h) = expected_hash {
                    if exp_h != p.sha256 {
                        return Ok(DocumentVerificationReport {
                            is_valid: false,
                            status: "tampered_passage".into(),
                            document_id: doc.document_id.clone(),
                            original_path: doc.original_path.clone(),
                            current_revision: doc.revision,
                            expected_revision,
                            current_content_hash: doc.content_hash.clone(),
                            expected_hash: Some(exp_h.into()),
                            passage_id: Some(pid.into()),
                            passage_locator: Some(p.locator.clone()),
                            passage_text: Some(p.text.clone()),
                            verified_text: None,
                            message: format!(
                                "Hash del passaggio citato non corrispondente (atteso: {}, registrato: {})",
                                exp_h, p.sha256
                            ),
                        });
                    }
                }
                p_locator = Some(p.locator.clone());
                p_text = Some(p.text.clone());
            }
            None => {
                return Ok(DocumentVerificationReport {
                    is_valid: false,
                    status: "missing_passage".into(),
                    document_id: doc.document_id.clone(),
                    original_path: doc.original_path.clone(),
                    current_revision: doc.revision,
                    expected_revision,
                    current_content_hash: doc.content_hash.clone(),
                    expected_hash: expected_hash.map(String::from),
                    passage_id: Some(pid.into()),
                    passage_locator: None,
                    passage_text: None,
                    verified_text: None,
                    message: format!("Passaggio {} non trovato nella revisione corrente del documento", pid),
                });
            }
        }
    }

    // Build verified text: check every passage in doc.passages
    let mut verified_texts = Vec::new();
    for p in &doc.passages {
        let comp = compute_sha256(p.text.as_bytes());
        if comp != p.sha256 {
            return Ok(DocumentVerificationReport {
                is_valid: false,
                status: "tampered_passage".into(),
                document_id: doc.document_id.clone(),
                original_path: doc.original_path.clone(),
                current_revision: doc.revision,
                expected_revision,
                current_content_hash: doc.content_hash.clone(),
                expected_hash: expected_hash.map(String::from),
                passage_id: passage_id.map(String::from),
                passage_locator: p_locator,
                passage_text: p_text,
                verified_text: None,
                message: format!("Integrità compromessa per il passaggio {} nel catalogo", p.passage_id),
            });
        }
        verified_texts.push(p.text.as_str());
    }

    let full_verified = if !verified_texts.is_empty() {
        Some(verified_texts.join("\n\n"))
    } else {
        None
    };

    Ok(DocumentVerificationReport {
        is_valid: true,
        status: "verified".into(),
        document_id: doc.document_id.clone(),
        original_path: doc.original_path.clone(),
        current_revision: doc.revision,
        expected_revision,
        current_content_hash: doc.content_hash.clone(),
        expected_hash: expected_hash.map(String::from),
        passage_id: passage_id.map(String::from),
        passage_locator: p_locator,
        passage_text: p_text,
        verified_text: full_verified,
        message: "Documento e passaggi verificati con successo".into(),
    })
}

/// Read the verified extracted text for a document
pub fn read_verified_document_text(vault_path: &Path, document_id: &str, expected_revision: Option<u64>) -> Result<String, String> {
    let rep = verify_document_passage_integrity(vault_path, document_id, None, None, expected_revision)?;
    if !rep.is_valid {
        return Err(rep.message);
    }
    rep.verified_text.ok_or_else(|| "Nessun testo estratto per questo documento".into())
}

/// Read the full extracted text for a document (with passage hash verification)
pub fn read_document_text(vault_path: &Path, document_id: &str) -> Result<String, String> {
    read_verified_document_text(vault_path, document_id, None)
}

/// Convenience alias for sync_catalog_from_vault
pub fn sync_catalog(vault_path: &Path) -> Result<CatalogState, String> {
    sync_catalog_from_vault(vault_path)
}

/// Convenience alias for read_document_text
pub fn read_text(vault_path: &Path, document_id: &str) -> Result<String, String> {
    read_document_text(vault_path, document_id)
}

/// Read a specific passage by document_id and passage_id with sha256 verification
pub fn read_passage(
    vault_path: &Path,
    document_id: &str,
    passage_id: &str,
) -> Result<DocumentPassage, String> {
    let doc = get_document(vault_path, document_id)?;
    let passage = doc.passages
        .into_iter()
        .find(|p| p.passage_id == passage_id)
        .ok_or_else(|| format!("Passaggio non trovato: {}", passage_id))?;
    
    // Verify passage integrity
    let actual_hash = compute_sha256(passage.text.as_bytes());
    if actual_hash != passage.sha256 {
        return Err(format!("Integrità passaggio compromessa (hash atteso {}, trovato {})", passage.sha256, actual_hash));
    }
    Ok(passage)
}

/// Open the original document in the system default application.
/// Validates path and verifies hash and revision before opening.
pub fn open_original(vault_path: &Path, document_id: &str) -> Result<(), String> {
    let doc = get_document(vault_path, document_id)?;
    let full_path = vault_path.canonicalize().map_err(err)?.join(&doc.original_path);
    if !full_path.exists() {
        return Err("File originale non trovato sul disco".into());
    }
    // Verify hash on disk matches document record
    let bytes = std::fs::read(&full_path).map_err(err)?;
    let actual_hash = compute_sha256(&bytes);
    if actual_hash != doc.content_hash {
        return Err(format!(
            "File modificato su disco (hash non corrispondente alla revisione {})",
            doc.revision
        ));
    }

    let status = Command::new("/usr/bin/open")
        .arg(&full_path)
        .status()
        .map_err(err)?;
    if !status.success() {
        return Err("Impossibile aprire il file con l'applicazione di sistema".into());
    }
    Ok(())
}

/// Reveal the original document in macOS Finder.
pub fn reveal_in_finder(vault_path: &Path, document_id: &str) -> Result<(), String> {
    let doc = get_document(vault_path, document_id)?;
    let full_path = vault_path.canonicalize().map_err(err)?.join(&doc.original_path);
    if !full_path.exists() {
        return Err("File originale non trovato sul disco".into());
    }
    let status = Command::new("/usr/bin/open")
        .arg("-R")
        .arg(&full_path)
        .status()
        .map_err(err)?;
    if !status.success() {
        return Err("Impossibile mostrare il file nel Finder".into());
    }
    Ok(())
}

/// Get summary metrics for the catalog
pub fn catalog_summary(vault_path: &Path) -> Result<CatalogSummary, String> {
    let catalog = load_catalog_arc(vault_path)?;
    let total = catalog.documents.len();
    let mut ready = 0;
    let mut processing = 0;
    let mut attention = 0;
    let mut passages_count = 0;

    for doc in catalog.documents.values() {
        match doc.extraction_status {
            ExtractionStatus::Ready => ready += 1,
            ExtractionStatus::Processing | ExtractionStatus::Pending => processing += 1,
            ExtractionStatus::Unsupported | ExtractionStatus::Protected | ExtractionStatus::Failed => {
                attention += 1
            }
        }
        passages_count += doc.passages.len();
    }

    Ok(CatalogSummary {
        total_documents: total,
        total_raw_sources: total,
        ready_documents: ready,
        processing_documents: processing,
        attention_documents: attention,
        total_passages: passages_count,
        catalog_revision: catalog.catalog_revision,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_chunk_text_to_passages_locators() {
        let text = "Primo paragrafo con testo informativo.\n\nSecondo paragrafo dettagliato con tabelle e numeri 12345.\n\nTerzo paragrafo conclusivo.";
        let passages = chunk_text_to_passages("doc_1", text);
        assert!(!passages.is_empty());
        assert_eq!(passages[0].passage_id, "doc_1_p0");
        assert!(passages[0].locator.starts_with("Paragraf"));
        assert!(!passages[0].sha256.is_empty());

        // Test with ## Pagina and ## Slide headings
        let doc_with_pages = "## Pagina 1\n\nContenuto introduttivo della prima pagina del bilancio.\n\n## Pagina 2\n\nTabella dei ricavi e costi con indicatori finanziari.";
        let page_passages = chunk_text_to_passages("doc_pdf", doc_with_pages);
        assert!(page_passages.len() >= 2);
        assert_eq!(page_passages[0].locator, "Pagina 1");
        assert_eq!(page_passages[1].locator, "Pagina 2");

        // Test with very long paragraph > 1200 chars
        let long_para = "A".repeat(2500);
        let long_passages = chunk_text_to_passages("doc_long", &long_para);
        assert!(long_passages.len() >= 2, "Long paragraph must be split into multiple passages");
        for p in &long_passages {
            assert!(p.char_count <= 1300, "No passage should exceed chunk target significantly");
        }
    }

    #[test]
    fn test_catalog_save_and_load_lifecycle() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();

        let mut catalog = CatalogState::default();
        let doc = DocumentRecord {
            document_id: "doc_test".into(),
            revision: 1,
            content_hash: "hash123".into(),
            original_path: "20_RAW_SOURCES/test.txt".into(),
            aliases: vec![],
            file_name: "test.txt".into(),
            extension: "txt".into(),
            file_size: 42,
            mime_type: "text/plain".into(),
            imported_at: now_iso(),
            updated_at: now_iso(),
            extraction_status: ExtractionStatus::Ready,
            extraction_error: None,
            extracted_text_path: None,
            extracted_text_hash: None,
            passages: vec![DocumentPassage {
                passage_id: "doc_test_p0".into(),
                locator: "Paragrafo 1".into(),
                text: "Hello world".into(),
                char_count: 11,
                sha256: compute_sha256(b"Hello world"),
            }],
            lexical_status: PhaseInfo::default(),
            semantic_status: PhaseInfo::default(),
            classification_status: PhaseInfo::default(),
            wiki_status: PhaseInfo::default(),
            category: None,
            client: None,
            project: None,
            tags: vec![],
            evidence_type: "source".into(),
            editorial_status: "auto".into(),
        };

        catalog.documents.insert("doc_test".into(), doc);
        save_catalog(path, &mut catalog).unwrap();

        let loaded = load_catalog(path).unwrap();
        assert_eq!(loaded.documents.len(), 1);
        assert_eq!(loaded.catalog_revision, 1);
        let loaded_doc = loaded.documents.get("doc_test").unwrap();
        assert_eq!(loaded_doc.file_name, "test.txt");
        assert_eq!(loaded_doc.passages.len(), 1);
        assert_eq!(loaded_doc.passages[0].text, "Hello world");
    }

    #[test]
    fn test_sync_catalog_and_offline_extraction() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        let sample_content = "Documento di test aziendale con informazioni strategiche.\n\nNuova sezione di approfondimento.";
        fs::write(path.join("20_RAW_SOURCES/documento.txt"), sample_content).unwrap();

        let catalog = sync_catalog_from_vault(path).unwrap();
        assert_eq!(catalog.documents.len(), 1);

        let processed = process_pending_extractions(path).unwrap();
        assert_eq!(processed, 1);

        let summary = catalog_summary(path).unwrap();
        assert_eq!(summary.total_documents, 1);
        assert_eq!(summary.ready_documents, 1);
        assert_eq!(summary.processing_documents, 0);
        assert!(summary.total_passages >= 1);
    }

    #[test]
    fn test_deduplication_preserves_aliases() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        let content = "Stesso identico contenuto aziendale per file rinominato.";
        fs::write(path.join("20_RAW_SOURCES/originale.txt"), content).unwrap();
        fs::write(path.join("20_RAW_SOURCES/copia_rinominata.txt"), content).unwrap();

        let catalog = sync_catalog_from_vault(path).unwrap();
        // Identical content hash produces 1 document with 1 alias
        assert_eq!(catalog.documents.len(), 1);
        let doc = catalog.documents.values().next().unwrap();
        assert_eq!(doc.aliases.len(), 1);
        assert!(doc.aliases[0].contains("copia_rinominata.txt") || doc.original_path.contains("copia_rinominata.txt"));
    }

    #[test]
    fn test_proposals_stay_legacy_drafts_and_human_notes_preserved() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("90_PROPOSALS")).unwrap();
        fs::create_dir_all(path.join("01_CLIENTS")).unwrap();

        // 1. Proposal
        let prop = "---\nschema_version: 1\nid: prop-1\ntitle: Proposta Legacy\ntype: proposal\nstatus: draft\ncreated_at: \"2026-09-18T00:00:00Z\"\nupdated_at: \"2026-09-18T00:00:00Z\"\n---\nTesto proposta";
        fs::write(path.join("90_PROPOSALS/proposta.md"), prop).unwrap();

        // 2. Human note
        let note = "---\nschema_version: 1\nid: note-1\ntitle: Cliente Alfa\ntype: client\nstatus: approved\ncreated_at: \"2026-09-18T00:00:00Z\"\nupdated_at: \"2026-09-18T00:00:00Z\"\n---\nNota umana approvata";
        fs::write(path.join("01_CLIENTS/alfa.md"), note).unwrap();

        let catalog = sync_catalog_from_vault(path).unwrap();
        assert_eq!(catalog.documents.len(), 2);

        let p_doc = catalog.documents.values().find(|d| d.original_path.contains("90_PROPOSALS")).unwrap();
        assert_eq!(p_doc.evidence_type, "legacy_draft");
        assert_eq!(p_doc.editorial_status, "draft"); // Not approved!

        let n_doc = catalog.documents.values().find(|d| d.original_path.contains("01_CLIENTS")).unwrap();
        assert_eq!(n_doc.evidence_type, "human_note");
        assert_eq!(n_doc.editorial_status, "approved");
    }

    #[test]
    fn test_double_migration_idempotent_and_rollback() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        fs::write(path.join("20_RAW_SOURCES/doc1.txt"), "Contenuto 1").unwrap();
        let cat1 = sync_catalog_from_vault(path).unwrap();
        let cat2 = sync_catalog_from_vault(path).unwrap();

        // Same document count and identical IDs
        assert_eq!(cat1.documents.len(), cat2.documents.len());
        assert_eq!(cat1.documents.keys().collect::<Vec<_>>(), cat2.documents.keys().collect::<Vec<_>>());

        // Backup and rollback
        backup_catalog(path).unwrap();
        let rolled_back = rollback_catalog(path).unwrap();
        assert_eq!(rolled_back.documents.len(), 1);
    }

    #[test]
    fn test_document_revision_bump_on_content_change() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        // 1. Initial version
        let file_path = path.join("20_RAW_SOURCES/contratto.txt");
        fs::write(&file_path, "Contratto Versione 1: clausole iniziali.").unwrap();

        let cat1 = sync_catalog_from_vault(path).unwrap();
        let doc1 = cat1.documents.values().find(|d| d.original_path == "20_RAW_SOURCES/contratto.txt").unwrap();
        let initial_id = doc1.document_id.clone();
        let initial_hash = doc1.content_hash.clone();
        assert_eq!(doc1.revision, 1);

        // Process extraction
        process_pending_extractions(path).unwrap();
        let cat_extracted = load_catalog(path).unwrap();
        let doc_extracted = cat_extracted.documents.get(&initial_id).unwrap();
        assert_eq!(doc_extracted.extraction_status, ExtractionStatus::Ready);
        assert!(!doc_extracted.passages.is_empty());

        // 2. Modify content on disk
        fs::write(&file_path, "Contratto Versione 2: clausole aggiornate con integrazioni.").unwrap();

        let cat2 = sync_catalog_from_vault(path).unwrap();
        let doc2 = cat2.documents.get(&initial_id).unwrap();

        // Stable ID maintained, revision incremented, hash changed, status reset to Pending
        assert_eq!(doc2.document_id, initial_id);
        assert_eq!(doc2.revision, 2);
        assert_ne!(doc2.content_hash, initial_hash);
        assert_eq!(doc2.extraction_status, ExtractionStatus::Pending);
        assert!(doc2.passages.is_empty());
    }

    #[test]
    fn test_document_pruning_on_file_deletion() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        let file_path = path.join("20_RAW_SOURCES/temp_file.txt");
        fs::write(&file_path, "File temporaneo").unwrap();

        let cat1 = sync_catalog_from_vault(path).unwrap();
        assert_eq!(cat1.documents.len(), 1);

        // Delete the file
        fs::remove_file(&file_path).unwrap();

        // Sync again
        let cat2 = sync_catalog_from_vault(path).unwrap();
        assert_eq!(cat2.documents.len(), 0);
    }

    #[test]
    fn test_passage_integrity_and_tamper_detection() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        let file_path = path.join("20_RAW_SOURCES/doc_valid.txt");
        fs::write(&file_path, "Testo originale del passaggio aziendale.").unwrap();

        let mut cat = sync_catalog_from_vault(path).unwrap();
        let p_text = "Passaggio con testo corretto";
        let doc_id = {
            let doc = cat.documents.values_mut().next().unwrap();
            doc.passages.push(DocumentPassage {
                passage_id: "doc_test_p0".into(),
                locator: "Paragrafo 1".into(),
                char_count: p_text.len(),
                sha256: compute_sha256(p_text.as_bytes()),
                text: p_text.into(),
            });
            doc.document_id.clone()
        };
        save_catalog(path, &mut cat).unwrap();

        // Valid passage reads successfully
        let p_ok = read_passage(path, &doc_id, "doc_test_p0").unwrap();
        assert_eq!(p_ok.text, p_text);

        // Corrupted/tampered passage text fails verification
        let mut corrupted_cat = load_catalog(path).unwrap();
        let c_id = {
            let c_doc = corrupted_cat.documents.values_mut().next().unwrap();
            c_doc.passages[0].text = "Testo manomesso!".into(); // hash mismatch!
            c_doc.document_id.clone()
        };
        save_catalog(path, &mut corrupted_cat).unwrap();

        let err = read_passage(path, &c_id, "doc_test_p0").unwrap_err();
        assert!(err.contains("Integrità passaggio compromessa"));
    }

    #[test]
    fn test_verify_document_passage_integrity_all_cases() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        let orig_text = "Contenuto originale registrato nel catalogo.";
        let file_path = path.join("20_RAW_SOURCES/contratto.txt");
        fs::write(&file_path, orig_text).unwrap();

        let mut cat = sync_catalog_from_vault(path).unwrap();
        let doc_id = {
            let doc = cat.documents.values_mut().next().unwrap();
            doc.passages.push(DocumentPassage {
                passage_id: format!("{}_p0", doc.document_id),
                locator: "Paragrafo 1".into(),
                char_count: orig_text.len(),
                sha256: compute_sha256(orig_text.as_bytes()),
                text: orig_text.into(),
            });
            doc.document_id.clone()
        };
        save_catalog(path, &mut cat).unwrap();

        // 1. Success case
        let rep1 = verify_document_passage_integrity(path, &doc_id, Some(&format!("{}_p0", doc_id)), Some(&compute_sha256(orig_text.as_bytes())), Some(1)).unwrap();
        assert!(rep1.is_valid);
        assert_eq!(rep1.status, "verified");
        assert!(rep1.verified_text.unwrap().contains(orig_text));

        // 2. Tampered original file on disk
        fs::write(&file_path, "Contenuto modificato su disco all'insaputa del catalogo.").unwrap();
        let rep2 = verify_document_passage_integrity(path, &doc_id, None, None, Some(1)).unwrap();
        assert!(!rep2.is_valid);
        assert_eq!(rep2.status, "tampered_original");
        assert!(rep2.message.contains("modificato"));

        // Restore disk file
        fs::write(&file_path, orig_text).unwrap();

        // 3. Revision mismatch (citation was based on rev 1, but doc is updated to rev 2)
        let rep3 = verify_document_passage_integrity(path, &doc_id, None, None, Some(999)).unwrap();
        assert!(!rep3.is_valid);
        assert_eq!(rep3.status, "revision_mismatch");
        assert!(rep3.message.contains("Revisione del documento aggiornata"));

        // 4. Missing original file on disk
        fs::remove_file(&file_path).unwrap();
        let rep4 = verify_document_passage_integrity(path, &doc_id, None, None, None).unwrap();
        assert!(!rep4.is_valid);
        assert_eq!(rep4.status, "missing_original");
    }

    #[test]
    fn test_lookup_by_path_beyond_50_documents_and_homonyms() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("01_CLIENTS/dir_a")).unwrap();
        fs::create_dir_all(path.join("01_CLIENTS/dir_b")).unwrap();

        // Create two homonymous files in different folders
        fs::write(path.join("01_CLIENTS/dir_a/scheda.md"), "# Scheda Cliente A\nContenuto A").unwrap();
        fs::write(path.join("01_CLIENTS/dir_b/scheda.md"), "# Scheda Cliente B\nContenuto B").unwrap();

        // Create 60 additional documents
        for i in 1..=60 {
            let p = path.join(format!("01_CLIENTS/doc_{:03}.md", i));
            fs::write(p, format!("# Doc {}\nContenuto numero {}", i, i)).unwrap();
        }

        sync_catalog_from_vault(path).unwrap();

        // Test direct lookup of the 60th document (well beyond 50)
        let doc60 = get_document_by_path(path, "01_CLIENTS/doc_060.md").unwrap();
        assert_eq!(doc60.original_path, "01_CLIENTS/doc_060.md");
        assert_eq!(doc60.file_name, "doc_060.md");

        // Test exact path lookup for homonymous files
        let doc_a = get_document_by_path(path, "01_CLIENTS/dir_a/scheda.md").unwrap();
        let doc_b = get_document_by_path(path, "01_CLIENTS/dir_b/scheda.md").unwrap();
        assert_ne!(doc_a.document_id, doc_b.document_id);
        assert_eq!(doc_a.original_path, "01_CLIENTS/dir_a/scheda.md");
        assert_eq!(doc_b.original_path, "01_CLIENTS/dir_b/scheda.md");

        // Test ambiguous lookup by bare filename alone errors cleanly
        let amb = get_document_by_path(path, "scheda.md");
        assert!(amb.is_err());
        assert!(amb.unwrap_err().contains("Riferimento ambiguo"));
    }

    #[test]
    fn test_verify_single_passage_document_integrity_with_doc_hash_and_passage_hash() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();

        let raw_text = "# Progetto BNXT Audit\nQuesto è un documento a singolo passaggio per verificare la risoluzione dei falsi allarmi.";
        let file_name = "a86061ba2701d614-_Progetto - BNXT AUDIT.md";
        let file_path = path.join("20_RAW_SOURCES").join(file_name);
        fs::write(&file_path, raw_text).unwrap();

        sync_catalog_from_vault(path).unwrap();

        let mut cat = load_catalog(path).unwrap();
        let doc = cat.documents.values_mut().find(|d| d.original_path.contains("BNXT AUDIT")).unwrap();
        doc.extraction_status = ExtractionStatus::Ready;
        doc.passages = chunk_text_to_passages(&doc.document_id, raw_text);
        let doc_id = doc.document_id.clone();
        save_catalog(path, &mut cat).unwrap();

        let updated_doc = get_document_by_path(path, &format!("20_RAW_SOURCES/{}", file_name)).unwrap();
        assert_eq!(updated_doc.passages.len(), 1);
        let p0 = &updated_doc.passages[0];

        // 1. Documento integro di un solo passaggio -> nessun allarme
        let rep_doc = verify_document_passage_integrity(path, &doc_id, None, Some(&updated_doc.content_hash), Some(1)).unwrap();
        assert!(rep_doc.is_valid, "Intact document check must be valid");

        let rep_passage = verify_document_passage_integrity(path, &doc_id, Some(&p0.passage_id), Some(&p0.sha256), Some(1)).unwrap();
        assert!(rep_passage.is_valid, "Intact passage check must be valid");

        // 2. Passaggio alterato -> segnalato tampered_passage
        let rep_tampered_p = verify_document_passage_integrity(path, &doc_id, Some(&p0.passage_id), Some("0000000000000000000000000000000000000000000000000000000000000000"), Some(1)).unwrap();
        assert!(!rep_tampered_p.is_valid);
        assert_eq!(rep_tampered_p.status, "tampered_passage", "Altered passage hash must be reported as tampered_passage");

        // 3. Documento alterato su disco -> segnalato tampered_original
        fs::write(&file_path, "# Corrupted file bytes on disk").unwrap();
        let rep_tampered_doc = verify_document_passage_integrity(path, &doc_id, None, Some(&updated_doc.content_hash), Some(1)).unwrap();
        assert!(!rep_tampered_doc.is_valid);
        assert_eq!(rep_tampered_doc.status, "tampered_original", "Altered file on disk must be reported as tampered_original");
    }

    #[test]
    fn test_catalog_in_memory_caching_and_zero_disk_reads_on_consecutive_calls() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();
        fs::write(path.join("20_RAW_SOURCES/doc1.md"), "# Documento 1\nContenuto di prova per la cache del catalogo.").unwrap();

        let mut cat = sync_catalog_from_vault(path).unwrap();
        let doc_id = make_document_id("20_RAW_SOURCES/doc1.md");
        save_catalog(path, &mut cat).unwrap();

        // Prima lettura o warm-up
        let _ = load_catalog_arc(path).unwrap();
        let initial_reads = get_catalog_disk_read_count();

        // Chiamate consecutive a get_document e load_catalog_arc
        let doc_first = get_document(path, &doc_id).unwrap();
        assert_eq!(doc_first.document_id, doc_id);

        let doc_second = get_document(path, &doc_id).unwrap();
        assert_eq!(doc_second.document_id, doc_id);

        let reads_after = get_catalog_disk_read_count();
        assert_eq!(
            reads_after, initial_reads,
            "Chiamate consecutive a get_document e load_catalog_arc sullo stesso vault non devono rileggere VAULT_CATALOG.json dal disco"
        );
    }

    #[test]
    fn test_catalog_reloaded_after_vault_modification() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path();
        fs::create_dir_all(path.join("00_SYSTEM")).unwrap();
        fs::create_dir_all(path.join("20_RAW_SOURCES")).unwrap();
        fs::write(path.join("20_RAW_SOURCES/doc_a.md"), "# Documento A\nVersione iniziale").unwrap();

        let mut cat = sync_catalog_from_vault(path).unwrap();
        let doc_id = make_document_id("20_RAW_SOURCES/doc_a.md");
        save_catalog(path, &mut cat).unwrap();

        let _doc1 = get_document(path, &doc_id).unwrap();
        let cat1 = load_catalog(path).unwrap();
        let rev1 = cat1.catalog_revision;

        // Modifica catalogo tramite save_catalog (incrementa revisione e aggiorna cache)
        let mut cat_modified = load_catalog(path).unwrap();
        if let Some(doc) = cat_modified.documents.get_mut(&doc_id) {
            doc.client = Some("Cliente Aggiornato".into());
        }
        save_catalog(path, &mut cat_modified).unwrap();

        let doc2 = get_document(path, &doc_id).unwrap();
        let cat2 = load_catalog(path).unwrap();
        assert_eq!(cat2.catalog_revision, rev1 + 1);
        assert_eq!(doc2.client.as_deref(), Some("Cliente Aggiornato"));
    }
}

