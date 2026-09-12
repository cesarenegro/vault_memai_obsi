use limen_vault::{compiler, search, snapshots, vault};
use std::path::Path;
fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("m7-interrupt") => output(limen_vault::proposals::execute_with_checkpoint(Path::new(&args[2]), serde_json::from_str(&args[3]).expect("M7 JSON"), |stage| { if std::env::var("LIMEN_TEST_KILL_STAGE").ok().as_deref()==Some(stage) { unsafe { libc::raise(libc::SIGKILL); } } })),
        Some("knowledge") => output(limen_vault::knowledge::list(Path::new(&args[2]),&args[3])),
        Some("m7") => output(limen_vault::proposals::execute(Path::new(&args[2]), serde_json::from_str(&args[3]).expect("M7 JSON"))),
        Some("search-index") => output(search::index_vault_search(Path::new(&args[2]))),
        Some("search-status") => output(search::get_search_index_status(Path::new(&args[2]))),
        Some("search") => match serde_json::from_str::<search::SearchQuery>(&args[3]) {
            Ok(q) => output(search::search_vault(Path::new(&args[2]), q)),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(1);
            }
        },
        Some("compile") => output(compiler::compile_source(Path::new(&args[2]), &args[3])),
        Some("compile-batch") => output(compiler::batch_compile_sources(Path::new(&args[2]))),
        Some("sources") => output(compiler::list_raw_sources(Path::new(&args[2]))),
        Some("proposals") => output(compiler::list_proposals(Path::new(&args[2]))),
        Some("open") => println!(
            "{}",
            serde_json::to_string(&vault::open(Path::new(&args[2]))).unwrap()
        ),
        Some("create") => match vault::create(
            Path::new(&args[2]),
            Some("Parity Vault".into()),
            Path::new(&args[3]),
        ) {
            Ok(status) => println!("{}", serde_json::to_string(&status).unwrap()),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(1);
            }
        },
        Some("integrity") => println!(
            "{}",
            serde_json::to_string(&snapshots::verify_manifest_integrity(Path::new(&args[2])))
                .unwrap()
        ),
        Some("snapshot-verify") => println!(
            "{}",
            serde_json::to_string(&snapshots::verify_snapshot_integrity(
                Path::new(&args[2]),
                &args[3]
            ))
            .unwrap()
        ),
        Some("snapshot") => output(snapshots::create_snapshot(
            Path::new(&args[2]),
            args.get(3).cloned(),
        )),
        Some("snapshots") => output(snapshots::list_snapshots(Path::new(&args[2]))),
        _ => std::process::exit(2),
    }
}

fn output<T: serde::Serialize>(r: Result<T, String>) {
    match r {
        Ok(v) => println!("{}", serde_json::to_string(&v).unwrap()),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}
