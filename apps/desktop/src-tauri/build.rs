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
    }
    tauri_build::build()
}
