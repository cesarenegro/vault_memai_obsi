# MA-01 — Evidenze Baseline, Contratti e DTO

Data: 18 settembre 2026.
Ambito: LIMEN Vault v3 — Memoria aziendale automatica e consultabile.

## 1. Inventario Iniziale e Baseline del Checkout

- **Branch**: `main` (commit di partenza origin/main).
- **Stato Working Tree**:
  - Modifiche preesistenti preservate: pulsante lime (`AutomationPanel.css`), inventario RAW (`automation.rs`), comando `ai_list_models` (`main.rs`, `ai.rs`), `search_read_document` (`main.rs`, `search.rs`), `ModelPicker.tsx`.
- **Verifiche Baseline di Partenza**:
  - `pnpm test`: PASS (13 test sync, 9 test ai-engine, guards ok).
  - `pnpm typecheck`: PASS (11 su 11 package workspace).
  - `cargo test --release`: PASS (52 test lib, 18 test main).
  - Cargo version: `cargo 1.98.1` in `.local/cargo/bin/cargo`.

## 2. Decisioni Tecniche e Architettura del Catalogo

1. **Storage Transazionale Locale e File-backed**:
   - Creato modulo nativo `apps/desktop/src-tauri/src/catalog.rs`.
   - File di stato: `00_SYSTEM/VAULT_CATALOG.json` con versione schema (`1`), revisione catalogo monotona (`catalog_revision`), scrittura atomica tramite staging `.catalog-<token>.tmp` e rename sicuro.
   - Nessuna cancellazione o alterazione dei byte originali in `20_RAW_SOURCES/`.
   - Nessuna promozione automatica fittizia delle 57 proposte legacy a conoscenza approvata: tracciate come `legacy_draft` con `editorial_status: auto/draft`.
2. **Modello Documento a Più Rappresentazioni**:
   - `DocumentRecord`: `document_id`, `revision`, `content_hash`, `original_path`, `file_name`, `extension`, `file_size`, `mime_type`, `imported_at`, `updated_at`.
   - Fasi indipendenti:
     - `extraction_status`: `Pending`, `Processing`, `Ready`, `Unsupported`, `Protected`, `Failed`.
     - `lexical_status`, `semantic_status`, `classification_status`, `wiki_status`: `PhaseInfo { status, attempts, error, updated_at }`.
   - `passages`: vettore di `DocumentPassage` (`passage_id`, `locator`, `text`, `char_count`, `sha256`).
3. **Disaccoppiamento Offline dell'Estrazione**:
   - `extract_document_content(bytes, filename)` gestisce in modo autonomo:
     - Fogli di calcolo (`xls`, `xlsx`, `xlsb`, `ods`) tramite `calamine`.
     - File testuali (`txt`, `md`, `markdown`, `csv`, `tsv`, `json`, `xml`, `yaml`, `log`, `eml`, `html`).
     - Documenti Office complessi e PDF/immagini tramite `extraction::extract`.
   - Estrazione e chunking avvengono interamente sul dispositivo locale senza dipendere dalla disponibilità dell'API OpenAI né dalla presenza di rete.
4. **Contratti DTO e IPC Tauri**:
   - Definiti in `apps/desktop/src-tauri/src/catalog.rs`, registrati in `apps/desktop/src-tauri/src/main.rs`.
   - Esposti in TypeScript in `apps/desktop/src/vault-ipc.ts` e `packages/vault-core/src/catalog-types.ts`.
   - Comandi IPC:
     - `catalog_sync`
     - `catalog_list_documents`
     - `catalog_process_extractions`
     - `catalog_get_document`
     - `catalog_read_text`
     - `catalog_read_passage`
     - `catalog_open_original`
     - `catalog_reveal_in_finder`
     - `catalog_get_summary`

## 3. Verifiche Eseguite

- `cargo test catalog`: PASS (3/3 test: `test_chunk_text_to_passages_locators`, `test_catalog_save_and_load_lifecycle`, `test_sync_catalog_and_offline_extraction`).
- `pnpm --filter @limen-vault/desktop test`: PASS (compresi test su tutti i comandi IPC catalogo e rifiuto browser).
- `pnpm typecheck`: PASS su tutti i workspace package.
