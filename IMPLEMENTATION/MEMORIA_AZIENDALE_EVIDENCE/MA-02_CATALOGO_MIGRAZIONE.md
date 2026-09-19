# MA-02 — Evidenze Catalogo e Migrazione Conservativa

Data: 18 settembre 2026.
Ambito: LIMEN Vault v3 — Modulo catalogo, migrazione registri, deduplica e rollback.

## 1. Implementazione del Catalogo

- Modulo: `apps/desktop/src-tauri/src/catalog.rs`
- DTO e tipi condivisi: `packages/vault-core/src/catalog-types.ts`, `apps/desktop/src/vault-ipc.ts`
- Struttura `DocumentRecord`:
  - `document_id`: ID deterministico stabile `doc_<hash:16>` calcolato da percorso e hash.
  - `revision`: contatore monotono per documento.
  - `content_hash`: SHA-256 byte-identico del file originale.
  - `original_path`: percorso relativo nel Vault.
  - `aliases`: array di percorsi alternativi con identico content hash (deduplica senza duplicazione di lavoro).
  - `evidence_type`:
    - `"source"` per originali RAW estratti.
    - `"legacy_draft"` per bozze storiche in `90_PROPOSALS`.
    - `"human_note"` per note umane preesistenti in `01_CLIENTS`..`10_APPROVED_OUTPUTS`.
    - `"wiki"` per pagine wiki generate automaticamente.
  - `editorial_status`: `"approved"`, `"draft"` o `"auto"`. Le proposte rimangono `"draft"` e **non vengono approvate automaticamente**.

## 2. Deduplica e Conservazione

- Se viene aggiunto o rinominato un file con lo stesso hash di contenuto, non viene creato un nuovo documento né avviata una nuova elaborazione: il percorso viene aggiunto agli `aliases` del documento esistente.
- Se il contenuto cambia per lo stesso documento, la revisione viene incrementata e le fasi di estrazione resettate.

## 3. Staging Atomico, Backup e Rollback

- File catalogo `00_SYSTEM/VAULT_CATALOG.json` scritto atomicamente tramite file temporaneo `.catalog-<token>.tmp` e rename POSIX.
- `backup_catalog` salva una copia di sicurezza `00_SYSTEM/VAULT_CATALOG.bak.json`.
- `rollback_catalog` ripristina la copia di backup verificandone l'integrità.

## 4. Test Eseguiti e Superati

- `cargo test catalog`:
  - `test_chunk_text_to_passages_locators`: PASS
  - `test_catalog_save_and_load_lifecycle`: PASS
  - `test_sync_catalog_and_offline_extraction`: PASS
  - `test_deduplication_preserves_aliases`: PASS
  - `test_proposals_stay_legacy_drafts_and_human_notes_preserved`: PASS
  - `test_double_migration_idempotent_and_rollback`: PASS
- `pnpm test`: PASS
- `pnpm typecheck`: PASS
