// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn get_default_vault_path() -> String {
    format!("{}/Documents/VAULT", std::env::var("HOME").unwrap_or_default())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_default_vault_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
