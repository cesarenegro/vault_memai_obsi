# MA-03 — Evidenze Ingestion Locale e Coda Nativa

Data: 18 settembre 2026.
Ambito: LIMEN Vault v3 — Modulo ingestion unificata, ricevute per file, estrazione offline disaccoppiata e scheduling nativo.

## 1. Ricevute per File e Ingestion Unificata

- Modulo Rust: `apps/desktop/src-tauri/src/automation.rs`
- Struttura `ImportReceipt`:
  - `name`: nome del file selezionato.
  - `path`: percorso relativo nel Vault (`20_RAW_SOURCES/{hash:16}-{name}`) se importato o duplicato.
  - `status`: `"imported"`, `"duplicate"`, o `"error"`.
  - `error`: messaggio di errore esplicito se non regolare, oltre 32 MB, modificato durante la lettura, o non supportato.
  - `document_id`: ID catalogo deterministico associato al file.
  - `hash`: SHA-256 reale dei byte acquisiti.
  - `size_bytes`: dimensione in byte verificata.
- Funzione `import_paths(vault: &Path, sources: &[&Path]) -> Vec<ImportReceipt>`:
  - Gestisce lotti eterogenei: file validi, duplicati, file corrotti/troppo grandi/mancanti.
  - Gli errori sui singoli file sono rigorosamente isolati nel lotto (non interrompono né bloccano gli altri file).
  - Deduplica reale basata sul content-hash: file identici per contenuto ricevono lo stato `"duplicate"` con il percorso esistente senza sprecare spazio su disco né duplicare l'elaborazione.
  - All'importazione di uno o più file validi, attiva automaticamente la sincronizzazione del catalogo (`catalog::sync_catalog`) e l'estrazione locale offline (`catalog::process_pending_extractions`).
- Comandi Tauri esposti e registrati in `main.rs`:
  - `automation_choose_files(vault_path)`: picker nativo unificato con restituzione di ricevute.
  - `automation_import_files(vault_path, paths)`: importazione diretta per drag-and-drop o percorsi multipli.

## 2. Disaccoppiamento Completo dell'Estrazione Locale dal Provider AI

- L'estrazione locale e l'indicizzazione dei file RAW nel catalogo (`catalog::sync_catalog` e `catalog::process_pending_extractions`) avvengono completamente OFFLINE, senza alcuna dipendenza da chiavi API, connessione di rete o abilitazione del provider.
- I formati supportati (TXT, Markdown, HTML, CSV, JSON, XML, YAML, fogli di calcolo XLSX/XLS/XLSB/ODS, documenti Office/PDF e scansioni OCR) vengono estratti, suddivisi in passaggi (`DocumentPassage`) con locatori e hash SHA-256 e resi consultabili immediatamente.
- In assenza di provider o con provider disabilitato, lo stato delle fonti per la fase AI viene marcato `"waiting"` ("In attesa della chiave API: originali conservati e consultabili localmente"), senza compromettere in alcun modo la ricerca o la lettura locale.

## 3. Scheduling Nativo e Watcher/Debounce

- Struct thread-safe `AutomationScheduler` in Rust (`automation.rs`):
  - Stato atomico per vault attivo, controllo di esecuzione (`running`), pausa/ripresa (`paused`).
  - Metodo `tick()`: esegue sincronizzazione catalogo, estrazione offline e, se abilitata, riconciliazione automatica con backoff massimo a tre tentativi.
  - Prevenzione concorrenza (`running.swap(true)`) per evitare doppie elaborazioni.
  - Lock POSIX su `.auto-lock` protetto con flag `libc::O_CLOEXEC` per impedire a processi figli (come helper OCR o textutil) di ereditare i file descriptor di blocco.

## 4. Test Eseguiti e Superati

- `cargo test automation --lib` (14/14 PASS):
  - `batch_import_receipts_deduplication_and_isolation`: PASS (verifica ricevute, deduplica per hash, isolamento errori nel lotto).
  - `offline_ingestion_and_extraction_without_ai_key`: PASS (verifica estrazione completa e lettura testo/passaggi a provider spento).
  - `concurrency_and_scheduler_background_reconciliation`: PASS (verifica scheduler, pause/resume, lock concorrenza).
  - `native_picker_import_is_bounded_and_preserves_selected_file`: PASS
  - `full_workflow_preserves_originals_deduplicates_and_retrieves`: PASS
  - `forged_citations_human_edits_and_symlinks`: PASS
  - `spreadsheets_keep_rows_beyond_api_limit_and_formulas`: PASS
  - `inventory_visible_before_activation_and_after_source_changes`: PASS
  - `unicode_text_chunks_preserve_every_byte`: PASS
  - `long_documents_are_split_without_manual_work`: PASS
  - `stale_search_lock_recovers_and_active_lock_is_preserved`: PASS
  - `bounded_retries_resume_and_key_absence`: PASS
  - `source_changes_and_deletion_invalidate_wiki_before_next_tick`: PASS
  - `complete_multi_format_pipeline_with_declared_fake_ai`: PASS
- `cargo test catalog --lib` (6/6 PASS)
- `cargo test --release` (61 lib tests + 18 main tests = 79/79 PASS)
- `node --import tsx/esm apps/desktop/tests/desktop-ipc.test.ts`: PASS (include verifiche IPC di `automationChooseFiles`, `automationImportFiles` e ricevute)
- `pnpm test`: PASS
- `pnpm typecheck`: PASS
