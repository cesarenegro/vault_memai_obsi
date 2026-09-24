#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod compiler;
use limen_vault::search;
mod snapshots;
mod vault;

use snapshots::*;
use std::{
    path::{Path, PathBuf},
    process::Command,
};
use tauri::Manager;
use vault::*;

#[tauri::command]
async fn automation_status(vault_path:String)->Result<limen_vault::automation::Report,String>{tauri::async_runtime::spawn_blocking(move||limen_vault::automation::status(Path::new(&vault_path))).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn automation_configure(vault_path:String,config:limen_vault::automation::Config)->Result<limen_vault::automation::Report,String>{tauri::async_runtime::spawn_blocking(move||limen_vault::automation::configure(Path::new(&vault_path),config)).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn automation_run(vault_path:String)->Result<limen_vault::automation::Report,String>{tauri::async_runtime::spawn_blocking(move||limen_vault::automation::run(Path::new(&vault_path))).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn automation_retry(vault_path:String)->Result<limen_vault::automation::Report,String>{tauri::async_runtime::spawn_blocking(move||limen_vault::automation::retry(Path::new(&vault_path))).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn automation_choose_files(vault_path:String,app:tauri::AppHandle)->Result<Vec<limen_vault::automation::ImportReceipt>,String>{
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move||{
        let selected=app.dialog().file().set_title("Carica documenti in LIMEN").blocking_pick_files().unwrap_or_default();
        let vault = Path::new(&vault_path);
        let mut paths = Vec::new();
        for file in selected {
            let path_buf = file.into_path().map_err(|e|e.to_string())?;
            paths.push(path_buf);
        }
        let path_refs: Vec<&Path> = paths.iter().map(|p| p.as_path()).collect();
        Ok(limen_vault::automation::import_paths(vault, &path_refs))
    }).await.map_err(|e|e.to_string())?
}

#[tauri::command]
async fn automation_import_files(vault_path: String, paths: Vec<String>) -> Result<Vec<limen_vault::automation::ImportReceipt>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let vault = Path::new(&vault_path);
        let path_bufs: Vec<std::path::PathBuf> = paths.into_iter().map(std::path::PathBuf::from).collect();
        let path_refs: Vec<&Path> = path_bufs.iter().map(|p| p.as_path()).collect();
        Ok(limen_vault::automation::import_paths(vault, &path_refs))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn tunnel_start(config: limen_vault::tunnel::Config, app:tauri::AppHandle, state:tauri::State<'_,limen_vault::tunnel::TunnelState>)->Result<serde_json::Value,String>{let state=state.inner().clone();let resources=app.path().resource_dir().map_err(|e|e.to_string())?;let data=app.path().app_data_dir().map_err(|e|e.to_string())?;tauri::async_runtime::spawn_blocking(move||state.start(config,&resources,&data)).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn tunnel_status(state:tauri::State<'_,limen_vault::tunnel::TunnelState>)->Result<serde_json::Value,String>{let s=state.inner().clone();tauri::async_runtime::spawn_blocking(move||s.status()).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn tunnel_stop(state:tauri::State<'_,limen_vault::tunnel::TunnelState>)->Result<(),String>{let s=state.inner().clone();tauri::async_runtime::spawn_blocking(move||s.stop()).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn tunnel_save_key(key:String)->Result<(),String>{tauri::async_runtime::spawn_blocking(move||limen_vault::tunnel::save_key(&key)).await.map_err(|e|e.to_string())?}
#[tauri::command]
fn tunnel_config(app:tauri::AppHandle)->Result<Option<limen_vault::tunnel::Config>,String>{limen_vault::tunnel::config(&app.path().app_data_dir().map_err(|e|e.to_string())?)}

#[tauri::command]
async fn list_knowledge(vault_path:String,folder:String)->Result<Vec<serde_json::Value>,String>{tauri::async_runtime::spawn_blocking(move||limen_vault::knowledge::list(Path::new(&vault_path),&folder)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn count_knowledge_notes(vault_path:String)->Result<std::collections::HashMap<String, usize>,String>{tauri::async_runtime::spawn_blocking(move||limen_vault::knowledge::count_notes_by_category(Path::new(&vault_path))).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn m7_execute(vault_path: String, request: limen_vault::proposals::Request) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || limen_vault::proposals::execute(Path::new(&vault_path), request)).await.map_err(|e|e.to_string())?
}

#[tauri::command]
fn get_default_vault_path() -> Result<String, String> {
    std::env::var("HOME")
        .map(|h| {
            Path::new(&h)
                .join("Documents/VAULT")
                .to_string_lossy()
                .into()
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_vault(
    target_path: String,
    vault_name: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<VaultStatusResponse, String> {
    let template = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("vault-template");
    vault::create(Path::new(&target_path), vault_name, &template)
}

#[tauri::command]
fn open_vault(
    target_path: String,
    llama_state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> OpenVaultResponse {
    let p = Path::new(&target_path);
    let res = vault::open(p);
    if res.validation.is_valid {
        let _ = limen_vault::catalog::sync_catalog(p);
        let _ = limen_vault::catalog::process_pending_extractions(p);
        let rep = limen_vault::embeddings::get_embeddings_provider(p, 0);
        if rep.provider == "local" {
            let _ = limen_vault::ai::save_embeddings_provider_setting("local");
            llama_state.on_app_startup();
        }
    }
    res
}

#[tauri::command]
fn validate_vault(target_path: String) -> ValidationResultResponse {
    perform_vault_validation(Path::new(&target_path))
}

#[tauri::command]
async fn verify_vault_integrity(
    target_path: String,
) -> Result<VaultIntegrityReportResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        snapshots::verify_manifest_integrity(Path::new(&target_path))
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_snapshot(
    target_path: String,
    note: Option<String>,
) -> Result<SnapshotItemResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        snapshots::create_snapshot(Path::new(&target_path), note)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_snapshots(target_path: String) -> Result<Vec<SnapshotItemResponse>, String> {
    tauri::async_runtime::spawn_blocking(move || snapshots::list_snapshots(Path::new(&target_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn snapshot_restore(
    vault_path: String,
    snapshot_id: String,
    destination_path: Option<String>,
) -> Result<snapshots::SnapshotRestoreReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest_buf = destination_path.as_deref().map(Path::new);
        snapshots::restore_snapshot(Path::new(&vault_path), &snapshot_id, dest_buf)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_proposals(vault_path: String) -> Result<Vec<compiler::ProposalItem>, String> {
    tauri::async_runtime::spawn_blocking(move || compiler::list_proposals(Path::new(&vault_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_raw_sources(vault_path: String) -> Result<Vec<compiler::RawSourceItem>, String> {
    tauri::async_runtime::spawn_blocking(move || compiler::list_raw_sources(Path::new(&vault_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn compile_source(
    vault_path: String,
    relative_source_path: String,
) -> Result<compiler::CompilationItemResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        compiler::compile_source(Path::new(&vault_path), &relative_source_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn batch_compile_sources(
    vault_path: String,
) -> Result<compiler::BatchCompilerReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        compiler::batch_compile_sources(Path::new(&vault_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn index_vault_search(vault_path: String) -> Result<search::IndexStatusReport, String> {
    tauri::async_runtime::spawn_blocking(move || search::index_vault_search(Path::new(&vault_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn search_vault(
    vault_path: String,
    query: search::SearchQuery,
) -> Result<Vec<search::SearchResultItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        search::search_vault(Path::new(&vault_path), query)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_search_index_status(vault_path: String) -> Result<search::IndexStatusReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        search::get_search_index_status(Path::new(&vault_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn obsidian_path() -> Option<PathBuf> {
    let mut paths = vec![PathBuf::from("/Applications/Obsidian.app")];
    if let Ok(home) = std::env::var("HOME") {
        paths.push(Path::new(&home).join("Applications/Obsidian.app"));
    }
    if let Some(p) = paths.into_iter().find(|p| p.is_dir()) {
        return Some(p);
    }
    let output = Command::new("/usr/bin/mdfind")
        .arg("kMDItemCFBundleIdentifier == 'md.obsidian'")
        .output()
        .ok()?;
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(PathBuf::from)
        .find(|p| p.extension().is_some_and(|e| e == "app") && p.is_dir())
}

#[tauri::command]
fn check_obsidian_installed() -> bool {
    obsidian_path().is_some()
}

#[tauri::command]
fn open_obsidian(vault_path: String) -> Result<(), String> {
    let app = obsidian_path().ok_or("OBSIDIAN_NOT_INSTALLED")?;
    let path = Path::new(&vault_path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !path.is_dir() {
        return Err("Vault path is not a directory".into());
    }
    let registered = std::env::var("HOME")
        .ok()
        .and_then(|home| {
            std::fs::read_to_string(
                Path::new(&home).join("Library/Application Support/obsidian/obsidian.json"),
            )
            .ok()
        })
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .is_some_and(|registry| obsidian_registered(&registry, &path));
    let uri = if registered {
        format!(
            "obsidian://open?path={}",
            urlencoding::encode(&path.to_string_lossy())
        )
    } else {
        "obsidian://choose-vault".to_string()
    };
    let output = Command::new("/usr/bin/open")
        .arg("-a")
        .arg(app)
        .arg(uri)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() && !registered {
        Err(format!("OBSIDIAN_REGISTRATION_REQUIRED: In Obsidian, use Open folder as vault → Open and select {}. This is required once; then press Open in Obsidian again.", path.display()))
    } else if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into())
    }
}

fn obsidian_registered(registry: &serde_json::Value, target: &Path) -> bool {
    registry
        .get("vaults")
        .and_then(serde_json::Value::as_object)
        .is_some_and(|vaults| {
            vaults
                .values()
                .filter_map(|v| v.get("path").and_then(serde_json::Value::as_str))
                .any(|p| Path::new(p).canonicalize().is_ok_and(|p| p == target))
        })
}

fn main() {
    // Un llama-server rimasto orfano da un'istanza uccisa (kill -9/crash) viene terminato subito all'avvio.
    let _ = limen_vault::llama::reap_orphan_server();
    let args:Vec<String>=std::env::args().collect();
    if args.get(1).is_some_and(|s|s=="--mcp-stdio") {
        if args.len()!=3 { eprintln!("Usage: limen-vault --mcp-stdio VAULT");std::process::exit(2); }
        if let Err(e)=limen_vault::mcp::stdio(PathBuf::from(&args[2])) {eprintln!("{e}");std::process::exit(1);}
        return;
    }

    let llama_state = limen_vault::llama::LlamaServerState::default();
    // Avvio in background all'apertura dell'app se il modello locale è installato e il fornitore scelto è Locale
    llama_state.on_app_startup();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .menu(|app| {
            use tauri::menu::{Menu, MenuItemKind};
            // Keep native menu roles and keyboard shortcuts; localize labels only.
            fn translate(item: MenuItemKind<tauri::Wry>) -> tauri::Result<()> {
                fn label(text: &str) -> &str {
                    match text {
                        "File" => "File", "Edit" => "Modifica", "View" => "Vista",
                        "Window" => "Finestra", "Help" => "Aiuto",
                        "Undo" => "Annulla", "Redo" => "Ripeti", "Cut" => "Taglia",
                        "Copy" => "Copia", "Paste" => "Incolla", "Select All" => "Seleziona tutto",
                        "Minimize" => "Riduci a icona", "Zoom" | "Maximize" => "Ingrandisci",
                        "Close Window" | "Close" => "Chiudi finestra",
                        "Enter Full Screen" | "Toggle Full Screen" | "Fullscreen" => "Schermo intero",
                        "Services" => "Servizi", "Hide Others" => "Nascondi le altre",
                        "Show All" => "Mostra tutto",
                        t if t.starts_with("About ") || t == "About" => "Informazioni su LIMEN Vault",
                        t if t.starts_with("Hide ") || t == "Hide" => "Nascondi LIMEN Vault",
                        t if t.starts_with("Quit ") || t == "Quit" => "Esci da LIMEN Vault",
                        _ => text,
                    }
                }
                match item {
                    MenuItemKind::Submenu(menu) => {
                        menu.set_text(label(&menu.text()?))?;
                        for child in menu.items()? { translate(child)?; }
                    }
                    MenuItemKind::Predefined(item) => item.set_text(label(&item.text()?))?,
                    _ => {}
                }
                Ok(())
            }
            let menu = Menu::default(app)?;
            for item in menu.items()? { translate(item)?; }
            Ok(menu)
        })
        .manage(std::sync::Arc::new(limen_vault::ai::AiState::default()))
        .manage(std::sync::Arc::new(limen_vault::sync::State::default()))
        .manage(limen_vault::mcp::McpState::default())
        .manage(limen_vault::tunnel::TunnelState::default())
        .manage(llama_state)
        .manage(std::sync::Arc::new(limen_vault::automation::AutomationScheduler::default()))
        .invoke_handler(tauri::generate_handler![automation_status,automation_configure,automation_run,automation_retry,automation_choose_files,automation_import_files,sync_revoke_publication,sync_select_notes,sync_list_releases,sync_get_status,sync_save_config,sync_save_key,sync_disconnect,sync_test_connection,sync_plan_transfer,sync_execute_transfer,sync_cancel_transfer,
            get_default_vault_path,
            create_vault,
            open_vault,
            validate_vault,
            check_obsidian_installed,
            open_obsidian,
            verify_vault_integrity,
            create_snapshot,
            list_snapshots,
            snapshot_restore,
            list_raw_sources,
            list_proposals,
            m7_execute,
            tunnel_start,tunnel_stop,tunnel_status,tunnel_save_key,tunnel_config,list_knowledge,count_knowledge_notes,
            compile_source,
            batch_compile_sources,
            index_vault_search,
            search_vault,
            get_search_index_status,
            vault_id_get_or_create,ai_history_list,ai_history_get,ai_history_delete,ai_history_clear,ai_history_verify_sources,ai_list_models,ai_get_selected_model,ai_save_selected_model,search_read_document,ai_key_status,ai_save_key,ai_delete_key,ai_get_consent,ai_set_consent,ai_preview,ai_ask,ai_ask_stream,ai_cancel,ai_read_source,mcp_start,mcp_stop,mcp_status,
            catalog_sync,catalog_list_documents,catalog_process_extractions,catalog_get_document,catalog_get_by_path,catalog_verify_document_passage,catalog_read_verified_text,catalog_read_text,catalog_read_passage,catalog_open_original,catalog_reveal_in_finder,catalog_get_summary,
            embeddings_get_status,embeddings_sync_vault,search_vault_hybrid,
            embeddings_get_provider,embeddings_set_provider,
            local_model_status,local_model_download,local_model_select_file,local_model_pick_and_install,local_model_verify_integrity,select_vault_folder,
            local_server_start,local_server_stop,local_server_status,embeddings_cancel_sync
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app,event| { if matches!(event,tauri::RunEvent::ExitRequested{..}|tauri::RunEvent::Exit) {let _=app.state::<limen_vault::tunnel::TunnelState>().stop();let _=app.state::<limen_vault::llama::LlamaServerState>().stop();} });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn obsidian_registration_matches_canonical_path() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().canonicalize().unwrap();
        let registry = serde_json::json!({"vaults":{"test":{"path":tmp.path(),"open":true}}});
        assert!(obsidian_registered(&registry, &path));
        assert!(!obsidian_registered(&serde_json::json!({}), &path));
        assert!(!obsidian_registered(&registry, &path.join("different")));
    }
    #[test]
    fn test_rust_vault_validation() {
        let temp = tempfile::tempdir().unwrap();
        let tmp = temp.path().to_path_buf();

        for folder in REQUIRED_VAULT_FOLDERS.iter() {
            fs::create_dir_all(tmp.join(folder)).unwrap();
        }

        fs::write(tmp.join("00_SYSTEM").join("HOME.md"), "# Home").unwrap();
        fs::write(tmp.join("00_SYSTEM").join("VAULT_RULES.md"), "# Rules").unwrap();
        fs::write(
            tmp.join("00_SYSTEM").join("VAULT_MANIFEST.json"),
            r#"{"schema_version": 1, "vault_id": "test", "vault_name": "Test", "created_at": "2026-09-11T00:00:00Z", "updated_at": "2026-09-11T00:00:00Z", "files": []}"#,
        )
        .unwrap();

        let val = perform_vault_validation(&tmp);
        assert!(val.is_valid, "Validation errors: {:?}", val.errors);
        assert_eq!(val.checked_folders_count, 15);

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_rust_invalid_yaml_rejection() {
        let temp = tempfile::tempdir().unwrap();
        let tmp = temp.path().to_path_buf();

        for folder in REQUIRED_VAULT_FOLDERS.iter() {
            fs::create_dir_all(tmp.join(folder)).unwrap();
        }

        fs::write(tmp.join("00_SYSTEM").join("HOME.md"), "# Home").unwrap();
        fs::write(tmp.join("00_SYSTEM").join("VAULT_RULES.md"), "# Rules").unwrap();
        fs::write(
            tmp.join("00_SYSTEM").join("VAULT_MANIFEST.json"),
            r#"{"schema_version": 1, "vault_id": "test", "vault_name": "Test", "created_at": "2026-09-11T00:00:00Z", "updated_at": "2026-09-11T00:00:00Z", "files": []}"#,
        )
        .unwrap();

        // Write file with bad YAML syntax in frontmatter
        fs::write(
            tmp.join("01_CLIENTS").join("bad_yaml.md"),
            "---\ntitle: \"Unclosed string\ninvalid: [bad list\n---\n# Content",
        )
        .unwrap();

        let val = perform_vault_validation(&tmp);
        assert!(
            !val.is_valid,
            "Vault with bad YAML frontmatter must be invalid"
        );
        assert!(val.errors.iter().any(|e| e.contains("Invalid YAML syntax")));

        let _ = fs::remove_dir_all(&tmp);
    }
}


#[tauri::command]
async fn vault_id_get_or_create(vault_path: String) -> Result<limen_vault::history::VaultIdInfo, String> {
    tauri::async_runtime::spawn_blocking(move || limen_vault::history::get_or_create_vault_id(Path::new(&vault_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_history_list(vault_path: String) -> Result<Vec<limen_vault::history::HistoryEntryHeader>, String> {
    tauri::async_runtime::spawn_blocking(move || limen_vault::history::list_history_entries(Path::new(&vault_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_history_get(vault_path: String, entry_id: String) -> Result<limen_vault::history::HistoryEntry, String> {
    tauri::async_runtime::spawn_blocking(move || limen_vault::history::get_history_entry(Path::new(&vault_path), &entry_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_history_delete(vault_path: String, entry_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || limen_vault::history::delete_history_entry(Path::new(&vault_path), &entry_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_history_clear(vault_path: String) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || limen_vault::history::clear_vault_history(Path::new(&vault_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_history_verify_sources(
    vault_path: String,
    sources: Vec<limen_vault::history::HistorySourceRef>,
) -> Result<Vec<limen_vault::history::VerifiedSourceResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::history::verify_history_sources(Path::new(&vault_path), &sources)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_list_models()->Result<Vec<String>,String>{
 let key=tauri::async_runtime::spawn_blocking(limen_vault::keychain::load).await.map_err(|_|"Portachiavi non disponibile")??.filter(|k|!k.is_empty()).ok_or("Configura la chiave API OpenAI in Impostazioni per vedere i modelli disponibili")?;
 limen_vault::ai::list_models(key).await
}
#[tauri::command]
async fn ai_get_selected_model() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(limen_vault::ai::load_selected_model)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn ai_save_selected_model(model: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || limen_vault::ai::save_selected_model(&model))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn search_read_document(vault_path:String,document_id:String,sha256:String)->Result<String,String>{
 tauri::async_runtime::spawn_blocking(move||limen_vault::search::read_indexed_document(Path::new(&vault_path),&document_id,&sha256).map(|(_,text)|text)).await.map_err(|_|"Lettura documento interrotta")?
}
#[tauri::command]
async fn ai_key_status()->Result<bool,String>{tauri::async_runtime::spawn_blocking(||limen_vault::keychain::load().map(|v|v.is_some())).await.map_err(|_|"Keychain worker failed")?}
#[tauri::command]
async fn ai_save_key(key:String)->Result<(),String>{tauri::async_runtime::spawn_blocking(move||limen_vault::keychain::save(&key)).await.map_err(|_|"Keychain worker failed")?}
#[tauri::command]
async fn ai_delete_key()->Result<(),String>{tauri::async_runtime::spawn_blocking(limen_vault::keychain::delete).await.map_err(|_|"Keychain worker failed")?}
#[tauri::command]
async fn ai_get_consent(vault_path: String) -> Result<bool, String> {
    let p = PathBuf::from(vault_path);
    tauri::async_runtime::spawn_blocking(move || Ok(limen_vault::ai::get_openai_consent(&p)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_set_consent(vault_path: String, granted: bool) -> Result<(), String> {
    let p = PathBuf::from(vault_path);
    tauri::async_runtime::spawn_blocking(move || limen_vault::ai::set_openai_consent(&p, granted))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_preview(
    vault_path: String,
    options: limen_vault::ai::Options,
    state: tauri::State<'_, std::sync::Arc<limen_vault::ai::AiState>>,
    llama_state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::ai::Preview, String> {
    let t_entry = std::time::Instant::now();
    let state = state.inner().clone();
    let llama = llama_state.inner().clone();
    let prep_timeout = limen_vault::llama::service_preparation_timeout();

    let (port, pid, is_ready, service_status, fallback_reason) = match tokio::time::timeout(
        prep_timeout + std::time::Duration::from_millis(500),
        tauri::async_runtime::spawn_blocking(move || {
            llama.get_or_adopt_or_start_service_with_timeout(prep_timeout)
        }),
    )
    .await
    {
        Ok(Ok(res)) => res,
        Ok(Err(e)) => (
            None,
            None,
            false,
            "fallito".to_string(),
            Some(format!("Errore nel task di ispezione del servizio locale: {e}")),
        ),
        Err(_) => {
            let reason = format!(
                "Tempo limite per la preparazione del servizio locale superato ({} s): ripiego sulla ricerca per parole.",
                prep_timeout.as_secs()
            );
            (None, None, false, "in avvio".to_string(), Some(reason))
        }
    };
    let t_service_prep_ms = t_entry.elapsed().as_millis() as u64;

    state
        .preview_with_service_info(
            PathBuf::from(vault_path),
            options,
            port,
            pid,
            is_ready,
            Some(service_status),
            fallback_reason,
            Some(t_entry),
            t_service_prep_ms,
        )
        .await
}
#[tauri::command]
async fn ai_ask(
    ticket: String,
    ui_elapsed_ms: Option<u64>,
    state: tauri::State<'_, std::sync::Arc<limen_vault::ai::AiState>>,
) -> Result<serde_json::Value, String> {
    let state = state.inner().clone();
    limen_vault::ai::execute_guarded_ask(state, ticket, move |pending, cancel| async move {
        let key = tauri::async_runtime::spawn_blocking(limen_vault::keychain::load)
            .await
            .map_err(|_| "Keychain worker failed".to_string())
            .and_then(|r| r)
            .and_then(|k| k.ok_or("Configure API key in Settings".into()))?;
        limen_vault::ai::ask(pending, key, cancel, ui_elapsed_ms).await
    }).await
}
#[tauri::command]
async fn ai_ask_stream(
    window: tauri::Window,
    ticket: String,
    ui_elapsed_ms: Option<u64>,
    state: tauri::State<'_, std::sync::Arc<limen_vault::ai::AiState>>,
) -> Result<serde_json::Value, String> {
    let state = state.inner().clone();
    let ticket_clone = ticket.clone();
    limen_vault::ai::execute_guarded_ask_stream_worker(state, ticket, move |pending, cancel| async move {
        let key = tauri::async_runtime::spawn_blocking(limen_vault::keychain::load)
            .await
            .map_err(|_| "Keychain worker failed".to_string())
            .and_then(|r| r)
            .and_then(|k| k.ok_or("Configure API key in Settings".into()))?;
        limen_vault::ai::ask_stream(Some(window), ticket_clone, pending, key, cancel, ui_elapsed_ms).await
    }).await
}
#[tauri::command]
fn ai_cancel(ticket:String,state:tauri::State<'_,std::sync::Arc<limen_vault::ai::AiState>>){state.cancel(&ticket);}
#[tauri::command]
async fn ai_read_source(vault_path:String,document_id:String,sha256:String,include_drafts:bool)->Result<limen_vault::ai::Source,String>{
 tauri::async_runtime::spawn_blocking(move||limen_vault::ai::read_source(Path::new(&vault_path),&document_id,&sha256,include_drafts)).await.map_err(|_|"Source worker failed")?
}
#[tauri::command]
fn mcp_status(state:tauri::State<'_,limen_vault::mcp::McpState>)->serde_json::Value{state.status()}
#[tauri::command]
fn mcp_stop(state:tauri::State<'_,limen_vault::mcp::McpState>){state.stop();}
#[tauri::command]
fn mcp_start(vault_path:String,include_drafts:bool,state:tauri::State<'_,limen_vault::mcp::McpState>)->Result<limen_vault::mcp::ConnectionInfo,String>{state.start(PathBuf::from(vault_path),include_drafts)}

#[tauri::command]
fn sync_get_status(app:tauri::AppHandle,state:tauri::State<'_,std::sync::Arc<limen_vault::sync::State>>)->Result<serde_json::Value,String>{let mut v=limen_vault::sync::status(&app.path().app_data_dir().map_err(|e|e.to_string())?);let p=state.progress();if !p.is_null(){v["status"]=p["status"].clone();v["progress"]=p;}Ok(v)}
#[tauri::command]
async fn sync_save_key(token:String)->Result<(),String>{tauri::async_runtime::spawn_blocking(move||limen_vault::sync::save_key(token)).await.map_err(|e|e.to_string())?}
#[tauri::command]
fn sync_save_config(app:tauri::AppHandle,config:serde_json::Value)->Result<(),String>{limen_vault::sync::save_config(&app.path().app_data_dir().map_err(|e|e.to_string())?,config)}
#[tauri::command]
async fn sync_disconnect(app:tauri::AppHandle)->Result<(),String>{let p=app.path().app_data_dir().map_err(|e|e.to_string())?;tauri::async_runtime::spawn_blocking(move||limen_vault::sync::disconnect(&p)).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn sync_test_connection(app:tauri::AppHandle)->Result<serde_json::Value,String>{let p=app.path().app_data_dir().map_err(|e|e.to_string())?;tauri::async_runtime::spawn_blocking(move||limen_vault::sync::test_connection(&p)).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn sync_plan_transfer(app:tauri::AppHandle,state:tauri::State<'_,std::sync::Arc<limen_vault::sync::State>>,vault_path:String,operation:String,release_id:Option<String>)->Result<serde_json::Value,String>{let p=app.path().app_data_dir().map_err(|e|e.to_string())?;let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||state.plan(&p,Path::new(&vault_path),&operation,release_id.as_deref())).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn sync_execute_transfer(app:tauri::AppHandle,state:tauri::State<'_,std::sync::Arc<limen_vault::sync::State>>,vault_path:String,operation_id:String)->Result<serde_json::Value,String>{let p=app.path().app_data_dir().map_err(|e|e.to_string())?;let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||state.execute(&p,&operation_id,Path::new(&vault_path))).await.map_err(|e|e.to_string())?}
#[tauri::command]
fn sync_cancel_transfer(state:tauri::State<'_,std::sync::Arc<limen_vault::sync::State>>,operation_id:String){state.cancel(&operation_id);}

#[tauri::command]
async fn sync_list_releases(app:tauri::AppHandle)->Result<serde_json::Value,String>{let p=app.path().app_data_dir().map_err(|e|e.to_string())?;tauri::async_runtime::spawn_blocking(move||limen_vault::sync::list_releases(&p)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn sync_select_notes(app:tauri::AppHandle,state:tauri::State<'_,std::sync::Arc<limen_vault::sync::State>>,operation_id:String,paths:Vec<String>)->Result<String,String>{let p=app.path().app_data_dir().map_err(|e|e.to_string())?;let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||state.select(&p,&operation_id,&paths)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn sync_revoke_publication(app:tauri::AppHandle)->Result<serde_json::Value,String>{let p=app.path().app_data_dir().map_err(|e|e.to_string())?;tauri::async_runtime::spawn_blocking(move||limen_vault::sync::revoke_publication(&p)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn catalog_sync(vault_path: String) -> Result<limen_vault::catalog::CatalogSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::sync_catalog_from_vault(Path::new(&vault_path))?;
        limen_vault::catalog::catalog_summary(Path::new(&vault_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_list_documents(
    vault_path: String,
    options: Option<limen_vault::catalog::CatalogListOptions>,
) -> Result<limen_vault::catalog::CatalogListResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::list_documents(Path::new(&vault_path), options.unwrap_or_default())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_process_extractions(vault_path: String) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::process_pending_extractions(Path::new(&vault_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_get_document(
    vault_path: String,
    document_id: String,
) -> Result<limen_vault::catalog::DocumentRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::get_document(Path::new(&vault_path), &document_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_get_by_path(
    vault_path: String,
    rel_path: String,
) -> Result<limen_vault::catalog::DocumentRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::get_document_by_path(Path::new(&vault_path), &rel_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_verify_document_passage(
    vault_path: String,
    document_id: String,
    passage_id: Option<String>,
    expected_hash: Option<String>,
    expected_revision: Option<u64>,
) -> Result<limen_vault::catalog::DocumentVerificationReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::verify_document_passage_integrity(
            Path::new(&vault_path),
            &document_id,
            passage_id.as_deref(),
            expected_hash.as_deref(),
            expected_revision,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_read_verified_text(
    vault_path: String,
    document_id: String,
    expected_revision: Option<u64>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::read_verified_document_text(
            Path::new(&vault_path),
            &document_id,
            expected_revision,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_read_text(vault_path: String, document_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::read_document_text(Path::new(&vault_path), &document_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_read_passage(
    vault_path: String,
    document_id: String,
    passage_id: String,
) -> Result<limen_vault::catalog::DocumentPassage, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::read_passage(Path::new(&vault_path), &document_id, &passage_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_open_original(vault_path: String, document_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::open_original(Path::new(&vault_path), &document_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_reveal_in_finder(vault_path: String, document_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::reveal_in_finder(Path::new(&vault_path), &document_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn catalog_get_summary(
    vault_path: String,
) -> Result<limen_vault::catalog::CatalogSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::catalog::catalog_summary(Path::new(&vault_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn embeddings_get_status(
    vault_path: String,
) -> Result<limen_vault::embeddings::EmbeddingsStatusReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::embeddings::embeddings_status(Path::new(&vault_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn embeddings_get_provider(
    vault_path: String,
    llama_state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::embeddings::EmbeddingsProviderReport, String> {
    let port = llama_state.status().port;
    tauri::async_runtime::spawn_blocking(move || {
        Ok(limen_vault::embeddings::get_embeddings_provider(Path::new(&vault_path), port))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn embeddings_set_provider(
    vault_path: String,
    provider: String,
    llama_state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::embeddings::EmbeddingsProviderReport, String> {
    let port = llama_state.status().port;
    let llama_clone = llama_state.inner().clone();
    let rep = tauri::async_runtime::spawn_blocking(move || {
        limen_vault::embeddings::set_embeddings_provider(Path::new(&vault_path), &provider, port)
    })
    .await
    .map_err(|e| e.to_string())??;

    if rep.provider == "local" {
        llama_clone.on_app_startup();
    }
    Ok(rep)
}

#[tauri::command]
async fn local_model_status(
    llama_state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::llama::LocalModelReport, String> {
    let t0 = std::time::Instant::now();
    let rep = tauri::async_runtime::spawn_blocking(limen_vault::llama::local_model_status)
        .await
        .map_err(|e| e.to_string())?;
    let elapsed = t0.elapsed().as_millis() as u64;
    limen_vault::llama::log_panel_open_status(&llama_state, elapsed, &rep);
    Ok(rep)
}

#[tauri::command]
async fn local_model_download(
    app: tauri::AppHandle,
) -> Result<limen_vault::llama::LocalModelReport, String> {
    let app_handle = app.clone();
    limen_vault::llama::download_model_with_progress(move |downloaded, total, percent| {
        use tauri::Emitter;
        let _ = app_handle.emit(
            "local_model_download_progress",
            serde_json::json!({
                "downloaded": downloaded,
                "total": total,
                "percent": percent,
            }),
        );
    })
    .await
}

#[tauri::command]
async fn local_model_select_file(
    file_path: String,
) -> Result<limen_vault::llama::LocalModelReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        limen_vault::llama::install_model_from_file(Path::new(&file_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn select_vault_folder(
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move || {
        let folder = app
            .dialog()
            .file()
            .set_title("Seleziona cartella del Vault LIMEN")
            .blocking_pick_folder();
        match folder {
            Some(f) => {
                let path_buf = f.into_path().map_err(|e| e.to_string())?;
                let path_str = path_buf.to_string_lossy().to_string();
                let normalized = path_str.replace('/', "\\");
                Ok(Some(normalized))
            }
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn local_model_pick_and_install(
    app: tauri::AppHandle,
) -> Result<limen_vault::llama::LocalModelReport, String> {
    use tauri_plugin_dialog::DialogExt;
    let t0 = std::time::Instant::now();
    let rep = tauri::async_runtime::spawn_blocking(move || {
        let file = app
            .dialog()
            .file()
            .set_title("Seleziona file modello GGUF (bge-m3-Q8_0.gguf)")
            .add_filter("Modello GGUF", &["gguf"])
            .blocking_pick_file();
        match file {
            Some(f) => {
                let path_buf = f.into_path().map_err(|e| e.to_string())?;
                limen_vault::llama::install_model_from_file(&path_buf)
            }
            None => Err("Selezione file annullata".into()),
        }
    })
    .await
    .map_err(|e| e.to_string())??;
    let elapsed = t0.elapsed().as_millis() as u64;
    limen_vault::llama::log_local_model_timing(
        "FILE_SELECTION_TOTAL_WITH_DIALOG",
        elapsed,
        &format!("installed={}, sha256_ok={}", rep.installed, rep.sha256_ok),
    );
    Ok(rep)
}

#[tauri::command]
async fn local_model_verify_integrity() -> Result<limen_vault::llama::LocalModelReport, String> {
    let t0 = std::time::Instant::now();
    let rep = tauri::async_runtime::spawn_blocking(|| {
        limen_vault::llama::local_model_status_with_recheck(true)
    })
    .await
    .map_err(|e| e.to_string())?;
    let elapsed = t0.elapsed().as_millis() as u64;
    limen_vault::llama::log_local_model_timing(
        "MANUAL_VERIFY",
        elapsed,
        &format!("installed={}, sha256_ok={}", rep.installed, rep.sha256_ok),
    );
    Ok(rep)
}

#[tauri::command]
async fn local_server_start(
    state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::llama::LocalServerReport, String> {
    let state = state.inner().clone();
    state.reset_auto_start_failure();
    tauri::async_runtime::spawn_blocking(move || state.start())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn local_server_stop(
    state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::llama::LocalServerReport, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.stop())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn local_server_status(
    state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::llama::LocalServerReport, String> {
    Ok(state.status())
}

#[tauri::command]
async fn embeddings_cancel_sync() -> Result<(), String> {
    limen_vault::embeddings::cancel_sync();
    Ok(())
}

#[tauri::command]
async fn embeddings_sync_vault(
    app: tauri::AppHandle,
    vault_path: String,
    api_key: Option<String>,
    model: Option<String>,
    llama_state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<limen_vault::embeddings::EmbeddingsStatusReport, String> {
    let rep = limen_vault::embeddings::get_embeddings_provider(Path::new(&vault_path), 0);
    let port = if rep.provider == "local" {
        Some(llama_state.ensure_running()?)
    } else {
        None
    };

    // Avanzamento reale per la barra "Ricalcolo cache in corso": un evento all'avvio e uno per lotto.
    let app_handle = app.clone();
    let on_progress = move |processed: usize, total: usize| {
        use tauri::Emitter;
        let percent = if total == 0 { 100.0 } else { (processed as f64 / total as f64) * 100.0 };
        let _ = app_handle.emit(
            "embeddings_sync_progress",
            serde_json::json!({ "processed": processed, "total": total, "percent": percent }),
        );
    };

    limen_vault::embeddings::sync_embeddings_with_progress(
        Path::new(&vault_path),
        api_key.as_deref().unwrap_or(""),
        model.as_deref(),
        port,
        Some(&on_progress),
    )
    .await
}

#[tauri::command]
async fn search_vault_hybrid(
    app: tauri::AppHandle,
    vault_path: String,
    query: search::SearchQuery,
    api_key: Option<String>,
    use_semantic: Option<bool>,
    llama_state: tauri::State<'_, limen_vault::llama::LlamaServerState>,
) -> Result<Vec<search::SearchResultItem>, String> {
    let rep = limen_vault::embeddings::get_embeddings_provider(Path::new(&vault_path), 0);
    let is_local = rep.provider == "local";

    let active_port = if is_local && use_semantic.unwrap_or(true) && query.term.as_ref().map(|t| !t.trim().is_empty()).unwrap_or(false) {
        let status = llama_state.status();
        if status.healthy && status.port > 0 {
            Some(status.port)
        } else {
            None
        }
    } else {
        None
    };

    let (items, degraded) = limen_vault::embeddings::hybrid_search_vault_with_port(
        Path::new(&vault_path),
        query,
        api_key,
        use_semantic.unwrap_or(true),
        active_port,
    )
    .await?;

    use tauri::Emitter;
    let _ = app.emit("search_mode_status", serde_json::json!({
        "provider": rep.provider,
        "degraded": degraded,
        "is_local": is_local,
    }));

    Ok(items)
}
