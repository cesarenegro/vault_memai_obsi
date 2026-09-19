# Evidenza di Collaudo MA-10: Ripristino Snapshot Sicuro in Cartella Separata

## Obiettivo
Fornire una procedura di ripristino snapshot a prova di corruzione e di perdita dati: ripristino vincolato ad una cartella separata vuota o nuova, con verifica di integrità file-per-file prima della scrittura finale, generazione del manifest conforme `00_SYSTEM/VAULT_MANIFEST.json`, e divieto assoluto di sovrascrittura distruttiva sul vault attivo.

## Implementazione Verificata

1. **Backend Rust (`apps/desktop/src-tauri/src/snapshots.rs`)**:
   - Funzione `restore_snapshot(vault_path: &Path, snapshot_id: &str, destination_path: &Path) -> Result<SnapshotRestoreReport, String>`.
   - Regole di sicurezza applicate:
     - Rifiuto esplicito se `destination_path == vault_path` o se la destinazione è contenuta nel vault attivo.
     - Verifica preventiva del manifest dello snapshot (`snapshot_manifest.json` o `manifest.json`).
     - Controllo integrità hash SHA-256 su ciascun file prima e durante il ripristino.
     - Generazione del manifest root canonico `00_SYSTEM/VAULT_MANIFEST.json` con metadati aggiornati e validati.
     - Conteggio preciso di file e byte ripristinati e verifica con `verify_manifest_integrity`.

2. **IPC e UI**:
   - Comando Tauri `snapshot_restore(vault_path, snapshot_id, destination_path)`.
   - Metodo IPC `restoreSnapshot(...)` esposto in `apps/desktop/src/vault-ipc.ts`.
   - Sezione `Avanzate > Snapshot` in `apps/desktop/src/App.tsx` con pulsante `RIPRISTINA IN CARTELLA SEPARATA` con prompt di selezione directory e banner di report esito.

3. **Suite di Test**:
   - `snapshots::tests::test_snapshot_restore_to_separate_folder_verifies_hashes`: PASS (lib.rs & main.rs).
   - Verificata la gestione delle corruzioni (il ripristino fallisce se un file dello snapshot è alterato) e l'impossibilità di sovrascrittura sul vault corrente.
