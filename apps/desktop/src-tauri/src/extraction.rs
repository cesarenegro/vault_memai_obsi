//! Deterministic text extraction and macOS OCR. No generative model invents source text.
use quick_xml::{events::Event, Reader};
use std::{
    io::{Cursor, Read},
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
const MAX: usize = 16 * 1024 * 1024;
struct Scratch(std::path::PathBuf);
impl Scratch {
    fn new() -> Result<Self, String> {
        use std::os::unix::fs::DirBuilderExt;
        let p = std::env::temp_dir().join(format!("limen-extract-{}", crate::ai::random_token()?));
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(&p)
            .map_err(err)?;
        Ok(Self(p))
    }
}
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn xml_text(bytes: &[u8]) -> Result<String, String> {
    let mut r = Reader::from_reader(bytes);
    let mut out = String::new();
    loop {
        match r.read_event().map_err(err)? {
            Event::Text(t) => out.push_str(&t.unescape().map_err(err)?),
            Event::End(e) => match e.local_name().as_ref() {
                b"p" | b"h" => out.push_str("\n\n"),
                b"tc" => out.push('\t'),
                b"tr" => out.push('\n'),
                _ => {}
            },
            Event::Empty(e) if e.local_name().as_ref() == b"br" => out.push('\n'),
            Event::Empty(e) if e.local_name().as_ref() == b"tab" => out.push('\t'),
            Event::DocType(_) => return Err("DTD non consentito nei documenti".into()),
            Event::Eof => break,
            _ => {}
        }
        if out.len() > MAX {
            return Err("Documento estratto oltre 16 MB".into());
        }
    }
    Ok(out)
}
fn entry(z: &mut zip::ZipArchive<Cursor<&[u8]>>, name: &str) -> Result<Vec<u8>, String> {
    let mut f = z.by_name(name).map_err(err)?;
    if f.size() > MAX as u64 {
        return Err("Componente documento oltre 16 MB".into());
    }
    let mut b = Vec::new();
    f.by_ref()
        .take(MAX as u64 + 1)
        .read_to_end(&mut b)
        .map_err(err)?;
    if b.len() > MAX {
        return Err("Componente documento eccessivo".into());
    }
    Ok(b)
}
fn relationships(bytes: &[u8]) -> Result<std::collections::BTreeMap<String, String>, String> {
    let mut r = Reader::from_reader(bytes);
    let mut m = std::collections::BTreeMap::new();
    loop {
        match r.read_event().map_err(err)? {
            Event::Start(e) | Event::Empty(e) if e.local_name().as_ref() == b"Relationship" => {
                let mut id = String::new();
                let mut target = String::new();
                for a in e.attributes() {
                    let a = a.map_err(err)?;
                    match a.key.as_ref() {
                        b"Id" => id = a.decode_and_unescape_value(&r).map_err(err)?.into_owned(),
                        b"Target" => {
                            target = a.decode_and_unescape_value(&r).map_err(err)?.into_owned()
                        }
                        _ => {}
                    }
                }
                m.insert(id, target);
            }
            Event::Eof => break,
            _ => {}
        }
    }
    Ok(m)
}
fn office(bytes: &[u8], ext: &str) -> Result<String, String> {
    let mut z = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|_| "Documento Office corrotto o protetto")?;
    if z.len() > 20000 {
        return Err("Troppi componenti nel documento".into());
    }
    let mut out = String::new();
    if ext == "docx" {
        out = xml_text(&entry(&mut z, "word/document.xml")?)?;
        let extras: Vec<_> = z
            .file_names()
            .filter(|n| {
                n.starts_with("word/header")
                    || n.starts_with("word/footer")
                    || *n == "word/footnotes.xml"
                    || *n == "word/endnotes.xml"
            })
            .map(str::to_owned)
            .collect();
        for n in extras {
            out.push_str(&format!("\n\n## {n}\n\n{}", xml_text(&entry(&mut z, &n)?)?));
        }
    } else if ext == "odt" {
        out = xml_text(&entry(&mut z, "content.xml")?)?;
    } else {
        let rel = relationships(&entry(&mut z, "ppt/_rels/presentation.xml.rels")?)?;
        let xml = entry(&mut z, "ppt/presentation.xml")?;
        let mut r = Reader::from_reader(xml.as_slice());
        let mut slide = 0;
        loop {
            match r.read_event().map_err(err)? {
                Event::Start(e) | Event::Empty(e) if e.local_name().as_ref() == b"sldId" => {
                    for a in e.attributes() {
                        let a = a.map_err(err)?;
                        if a.key.as_ref() == b"r:id" {
                            let id = a.decode_and_unescape_value(&r).map_err(err)?;
                            let target = rel.get(id.as_ref()).ok_or("Relazione slide mancante")?;
                            let name = if target.starts_with("/ppt/") {
                                target.trim_start_matches('/').to_string()
                            } else {
                                format!("ppt/{target}")
                            };
                            slide += 1;
                            out.push_str(&format!(
                                "\n\n## Slide {slide}\n\n{}",
                                xml_text(&entry(&mut z, &name)?)?
                            ));
                        }
                    }
                }
                Event::Eof => break,
                _ => {}
            }
        }
    }
    let pictures: Vec<_> = z
        .file_names()
        .filter(|n| {
            (n.starts_with("word/media/")
                || n.starts_with("ppt/media/")
                || n.starts_with("Pictures/"))
                && ["png", "jpg", "jpeg", "tif", "tiff", "webp"]
                    .contains(&n.rsplit('.').next().unwrap_or("").to_lowercase().as_str())
        })
        .map(str::to_owned)
        .collect();
    for picture in pictures {
        let data = entry(&mut z, &picture)?;
        match vision(&data, picture.rsplit('.').next().unwrap_or("png")) {
            Ok(text) => out.push_str(&format!(
                "\n\n### Testo immagine incorporata: {picture}\n\n{text}"
            )),
            Err(e) if e.contains("Nessun testo riconoscibile") => {}
            Err(e) => return Err(format!("OCR immagine incorporata non completato: {e}")),
        }
    }
    if out.len() > MAX {
        return Err("Documento estratto oltre 16 MB".into());
    }
    if out.trim().is_empty() {
        return Err("Documento senza testo riconoscibile".into());
    }
    Ok(out)
}
#[cfg(target_os = "macos")]
fn vision(bytes: &[u8], ext: &str) -> Result<String, String> {
    use std::os::unix::fs::PermissionsExt;
    let scratch = Scratch::new()?;
    // A distributed app executes its signed, notarized bundled helper.
    // Unit tests and the unbundled development harness use the embedded helper.
    let executable = std::env::current_exe().map_err(err)?;
    let bundle_contents = executable.parent().filter(|p| p.file_name().is_some_and(|n| n == "MacOS")).and_then(|p| p.parent());
    let binary = if let Some(contents) = bundle_contents {
        let helper = contents.join("Resources/native/limen-extract");
        if !helper.is_file() { return Err("Componente OCR mancante nel pacchetto LIMEN".into()); }
        helper
    } else {
    let binary = scratch.0.join("extract");
    std::fs::write(
        &binary,
        include_bytes!(concat!(env!("OUT_DIR"), "/limen-extract")),
    )
    .map_err(err)?;
    std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700)).map_err(err)?;
    binary
    };
    let input = scratch.0.join("input");
    let output = scratch.0.join("result.json");
    std::fs::write(&input, bytes).map_err(err)?;
    let mut child = Command::new(&binary)
        .arg(&input)
        .arg(ext)
        .arg(&output)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(err)?;
    let start = Instant::now();
    let status = loop {
        if let Some(s) = child.try_wait().map_err(err)? {
            break s;
        }
        if start.elapsed() > Duration::from_secs(180) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Tempo massimo estrazione OCR superato".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    };
    let result: serde_json::Value =
        serde_json::from_slice(&std::fs::read(output).map_err(err)?).map_err(err)?;
    if !status.success() {
        return Err(result["error"]
            .as_str()
            .unwrap_or("Estrazione OCR non riuscita")
            .into());
    }
    result["markdown"]
        .as_str()
        .map(str::to_owned)
        .ok_or("Testo estratto assente".into())
}
#[cfg(not(target_os = "macos"))]
fn vision(_: &[u8], _: &str) -> Result<String, String> {
    Err("OCR locale richiede macOS".into())
}
pub fn extract(bytes: &[u8], name: &str) -> Result<String, String> {
    let ext = Path::new(name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "docx" | "pptx" | "odt" => office(bytes, &ext),
        "pdf" | "png" | "jpg" | "jpeg" | "webp" | "gif" | "tif" | "tiff" | "heic" => {
            vision(bytes, &ext)
        }
        "doc" | "rtf" => {
            let scratch = Scratch::new()?;
            let input = scratch.0.join(format!("input.{ext}"));
            std::fs::write(&input, bytes).map_err(err)?;
            let output = scratch.0.join("output.txt");
            let mut child = Command::new("/usr/bin/textutil")
                .args(["-convert", "txt", "-output"])
                .arg(&output)
                .arg(input)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(err)?;
            let start = Instant::now();
            let status = loop {
                if let Some(status) = child.try_wait().map_err(err)? {
                    break status;
                }
                if start.elapsed() > Duration::from_secs(60) {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("Tempo massimo conversione documento superato".into());
                }
                std::thread::sleep(Duration::from_millis(50));
            };
            if !status.success() {
                return Err("Documento non leggibile o protetto".into());
            }
            if std::fs::metadata(&output).map_err(err)?.len() > MAX as u64 {
                return Err("Documento estratto oltre 16 MB".into());
            }
            std::fs::read_to_string(output).map_err(err)
        }
        _ => Err("Formato non documentale o non supportato: originale conservato".into()),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn word_and_slides_are_literal() {
        let doc = extract(
            include_bytes!("../../tests/fixtures/auto-knowledge/documento.docx"),
            "x.docx",
        )
        .unwrap();
        assert!(doc.contains("LIMEN-DOCX-742"));
        let slides = extract(
            include_bytes!("../../tests/fixtures/auto-knowledge/presentazione.pptx"),
            "x.pptx",
        )
        .unwrap();
        assert!(slides.contains("LIMEN-PPTX-318"));
        assert!(!slides.contains("Metodologia"));
        assert_eq!(slides.matches("## Slide").count(), 1);
    }
    #[test]
    fn pdf_and_scans_use_native_extraction() {
        let pdf = extract(
            include_bytes!("../../tests/fixtures/auto-knowledge/documento.pdf"),
            "x.pdf",
        )
        .unwrap();
        assert!(pdf.contains("LIMEN-PDF-529"));
        assert!(pdf.contains("LIMEN-PDF-FINE"));
        for (name, b) in [
            (
                "x.png",
                include_bytes!("../../tests/fixtures/auto-knowledge/scansione.png").as_slice(),
            ),
            (
                "x.pdf",
                include_bytes!("../../tests/fixtures/auto-knowledge/scansione.pdf").as_slice(),
            ),
        ] {
            assert!(extract(b, name).unwrap().contains("LIMEN-OCR-861"));
        }
    }
}
