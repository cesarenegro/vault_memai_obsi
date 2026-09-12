//! Direct read-only browsing, independent of the search index and cloud services.
use crate::{snapshots::{root,child,names,compute_sha256},vault::frontmatter};
use cap_std::fs::{Dir,OpenOptions,OpenOptionsExt};
use serde_json::{json,Value};
use std::{path::Path,io::Read};
const FOLDERS:[&str;10]=["01_CLIENTS","02_PROJECTS","03_BRANDS","04_POSITIONING","05_PACKAGING_KNOWLEDGE","06_METHODS","07_CASE_STUDIES","08_MARKET_RESEARCH","09_COMPETITORS","10_APPROVED_OUTPUTS"];
fn err(e:impl std::fmt::Display)->String{e.to_string()}
pub fn list(path:&Path,folder:&str)->Result<Vec<Value>,String>{if !FOLDERS.contains(&folder){return Err("Unsupported knowledge category".into())}let dir=child(&root(path)?,folder)?;let mut items=Vec::new();let mut bytes=0;walk(&dir,folder,0,&mut items,&mut bytes)?;Ok(items)}
fn walk(dir:&Dir,prefix:&str,depth:usize,items:&mut Vec<Value>,total:&mut usize)->Result<(),String>{
 if depth>32{return Err("Knowledge directory depth limit".into())}
 for name in names(dir)?{if name.starts_with('.') {continue}let relative=format!("{prefix}/{name}");let meta=dir.symlink_metadata(&name).map_err(err)?;
 if meta.file_type().is_symlink(){return Err(format!("Symlink rejected: {relative}"))}
 if meta.is_dir(){walk(&child(dir,&name)?,&relative,depth+1,items,total)?;continue}
 if !name.to_lowercase().ends_with(".md"){continue}if !meta.is_file()||meta.len()>512*1024||items.len()>=1000{return Err(format!("Invalid or oversized knowledge category: {relative}"))}
 let mut file=dir.open_with(&name,OpenOptions::new().read(true).custom_flags(libc::O_NOFOLLOW|libc::O_NONBLOCK)).map_err(err)?;
 let before=file.metadata().map_err(err)?;if !before.is_file(){return Err("Not a regular document".into())}
 let mut data=Vec::new();std::io::Read::by_ref(&mut file).take(512*1024+1).read_to_end(&mut data).map_err(err)?;
 let after=file.metadata().map_err(err)?;if data.len()>512*1024||before.len()!=after.len()||before.modified().map_err(err)?!=after.modified().map_err(err)?{return Err("Knowledge document changed during read".into())}
 *total+=data.len();if *total>8*1024*1024{return Err("Category preview exceeds 8 MiB".into())}let hash=compute_sha256(&data);let text=String::from_utf8(data).map_err(err)?;let fm=frontmatter(&text)?;
 items.push(json!({"relativePath":relative,"title":fm.as_ref().and_then(|f|f["title"].as_str()).unwrap_or(&name),"status":fm.as_ref().and_then(|f|f["status"].as_str()).unwrap_or("unspecified"),"sha256":hash,"markdown":text}));
 }Ok(())
}
#[cfg(test)]mod tests{use super::*;use std::fs;
 #[test]fn actual_notes_without_index_and_no_mutations(){let t=tempfile::tempdir().unwrap();fs::create_dir_all(t.path().join("01_CLIENTS/nested")).unwrap();let p=t.path().join("01_CLIENTS/nested/note.md");let text="---\nschema_version: 1\nid: knowledge-test\ntitle: Aurora\ntype: client\nstatus: approved\ncreated_at: \"2026-09-12T00:00:00Z\"\nupdated_at: \"2026-09-12T00:00:00Z\"\ntags: []\nsource_ids: []\n---\nActual local note";fs::write(&p,text).unwrap();let rows=list(t.path(),"01_CLIENTS").unwrap();assert_eq!(rows.len(),1);assert_eq!(rows[0]["title"],"Aurora");assert_eq!(rows[0]["sha256"],compute_sha256(text.as_bytes()));assert_eq!(fs::read_to_string(p).unwrap(),text);assert!(!t.path().join("00_SYSTEM").exists());}
 #[test]fn symlink_and_oversized_notes_fail_explicitly(){let t=tempfile::tempdir().unwrap();fs::create_dir(t.path().join("01_CLIENTS")).unwrap();let p=t.path().join("01_CLIENTS/link.md");std::os::unix::fs::symlink("/etc/passwd",&p).unwrap();assert!(list(t.path(),"01_CLIENTS").is_err());fs::remove_file(&p).unwrap();fs::write(&p,vec![b'x';512*1024+1]).unwrap();assert!(list(t.path(),"01_CLIENTS").is_err());assert!(list(t.path(),"20_RAW_SOURCES").is_err());}
}
