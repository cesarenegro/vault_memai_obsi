fn main() {
    println!("cargo:rerun-if-changed=native/extract.swift");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref()==Ok("macos") {
        let output=std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("limen-extract");
        let status=std::process::Command::new("/usr/bin/xcrun").args(["swiftc","-O","native/extract.swift","-o"]).arg(&output).status().expect("Swift toolchain required for native document extraction");
        assert!(status.success(),"Native document extractor compilation failed");
        std::fs::create_dir_all("resources/native").expect("Native resources directory");
        let dest = std::path::Path::new("resources/native/limen-extract");
        let should_copy = match (std::fs::read(&output), std::fs::read(dest)) {
            (Ok(new_bytes), Ok(existing_bytes)) => new_bytes != existing_bytes,
            _ => true,
        };
        if should_copy {
            std::fs::copy(&output, dest).expect("Bundle native extractor");
        }

        if let Ok(entries) = std::fs::read_dir("resources/native") {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.ends_with(".so") || name.ends_with(".dylib") {
                    let initial_verify = std::process::Command::new("codesign")
                        .arg("--verify")
                        .arg(&path)
                        .status()
                        .expect("codesign verification execution failed");
                    if !initial_verify.success() {
                        let sign_status = std::process::Command::new("codesign")
                            .args(["--force", "--sign", "-"])
                            .arg(&path)
                            .status()
                            .expect("codesign utility execution failed");
                        assert!(sign_status.success(), "Failed to ad-hoc codesign native library: {}", path.display());

                        let verify_status = std::process::Command::new("codesign")
                            .arg("--verify")
                            .arg(&path)
                            .status()
                            .expect("codesign verification execution failed");
                        assert!(verify_status.success(), "Signature verification failed for native library after signing: {}", path.display());
                    }
                }
            }
        }
    }

    let dist_dir = std::path::Path::new("../dist");
    if !dist_dir.exists() {
        let _ = std::fs::create_dir_all(dist_dir);
    }
    let index_file = dist_dir.join("index.html");
    if !index_file.exists() {
        let _ = std::fs::write(&index_file, "<!doctype html><html><body><h1>LIMEN Vault</h1></body></html>");
    }

    tauri_build::build()
}
