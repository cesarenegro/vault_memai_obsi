# Report di Chiusura Non Conformità e Audit LIMEN Vault v3

**Data**: 19 settembre 2026  
**Autore**: AG (Pair Programming Assistant)  
**Destinatario / Auditor Indipendente**: Claude  
**Workspace**: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`  
**Versione Prodotto**: LIMEN Vault v3 (`0.3.0`), macOS Apple Silicon (`arm64`)  
**Identità Firma**: `Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)` (`E01892F9C136DA67B393B9CD29AF97E369956968`)  
**Profilo Notarizzazione**: `LIMEN-M9` (registrato in Data Protection Keychain, rowid 4161)  
**Stato Gatekeeper su Applicazione Installata**: **ACCEPTED (`source=Notarized Developer ID`)**  
**Stato Gatekeeper su DMG Installato**: **ACCEPTED (`source=Notarized Developer ID`)**  
**Report Storico Conservato**: `IMPLEMENTATION/2026-09-19_AUDIT_REPORT_AG.md` (intatto e non modificato)

---

## 1. Sintesi Esecutiva dell'Audit Closure Finale

In riscontro alla verifica indipendente del 19 settembre 2026, si certifica la chiusura rigorosa e verificabile di tutti i rilievi sollevati:

1. **Notarizzazione Apple e Gatekeeper (A16)**:
   - Sia il pacchetto applicativo in `/Applications/LIMEN Vault v3.app` sia il file immagine in `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg` sono stati sottomessi con successo ad Apple Notary (`status: Accepted`), hanno ricevuto i ticket crittografici, sono stati graffettati con `xcrun stapler staple` e convalidati con `xcrun stapler validate` e `spctl -a -vvv`.
   - L'esito su entrambe le destinazioni di consegna effettive è:
     - `spctl ...`: **`accepted / source=Notarized Developer ID`**
     - `xcrun stapler validate`: **`The validate action worked!`**
2. **Matrice A01…A16 riscritta con Test Reali al 100%**:
   - Eliminato qualsiasi nome fittizio o generico: ogni riga della matrice corrisponde a uno o più test Rust o TypeScript realmente presenti ed eseguiti nel repository.
   - Tutti i log grezzi completi di stdout/stderr, exit code e durata sono salvati in `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/`.
   - I gate privi di collaudo automatico su scala di produzione (**A05** e **A15**) sono dichiarati con trasparenza come **APERTO / NON ESEGUITO**.
3. **Correzione Descrizione Lettura Chiave Keychain**:
   - Rettificata la descrizione: `keychain.rs:4` definisce `pub fn load() -> Result<String, String>` senza argomenti. In `embeddings.rs:259` e `:407`, il caricamento avviene invocando `crate::keychain::load()` a zero argomenti.
4. **Risoluzione dei 3 Punti Aperti dell'Audit Precedente**:
   - **Locators Pagina/Slide**: In `catalog.rs`, `chunk_text_to_passages` riconosce ora le intestazioni `## Pagina N` e `## Slide N` generate da `extraction.rs`, attribuendo il locator esatto `"Pagina N"` o `"Slide N"` ed evitando la precedente etichetta generica `"Paragrafo N"`.
   - **Suddivisione Paragrafi > 1.200 car. e Sovrapposizione**: I paragrafi superiori a 1.050 caratteri vengono suddivisi su confini semantici di frase/spazio, e tra passaggi consecutivi della stessa sezione viene mantenuta una sovrapposizione scorrevole di 150 caratteri.
   - **Scostamento Architetturale Catalogo (JSON atomico vs SQLite)**: Formalmente documentata la decisione di adottare `00_SYSTEM/CATALOG.json` con scrittura atomica e lock di filesystem rispetto a SQLite.
5. **Congelamento Checkout**:
   - Il repository viene congelato con commit e tag locale dedicato, comunicandone l'hash univoco.

---

## 2. Riscontro Rilievi Funzionali Verificati (R2 — R6)

Come confermato dall'audit indipendente (snapshot 14:45 UTC+8), i seguenti cinque punti risultano risolti nel codice e verificati riga per riga:

- **R2 (Ricerca Ibrida e Portachiavi)**: Invocazione reale da `apps/desktop/src/App.tsx:467` con chiave recuperata in sicurezza dal Portachiavi macOS in `apps/desktop/src-tauri/src/embeddings.rs:259` e `:407`. Firma reale: `crate::keychain::load()` senza parametri.
- **R3 (Ammissibilità a Monte)**: `search_vault_filtered` applica il predicato di ammissibilità prima del calcolo dello score e prima della paginazione/taglio `top-k`, impedendo che 50 bozze nascondano una fonte approvata (`ai::tests::test_eligibility_before_limits_regression_50_drafts_do_not_hide_approved_source`).
- **R4 (Verifica Reale di Documento e Passaggio)**: Comandi nativi `catalog_verify_document_passage` e `catalog_read_verified_text` registrati in `main.rs`, integrati in `DocumentReaderModal.tsx` con validazione crittografica SHA-256 su originale e chunk.
- **R5 (Lookup Diretto Senza Paginazione)**: Comando `catalog_get_by_path` implementato con scansione ricorsiva non paginata e indicizzata, sostituendo la lettura paginata limitata a 50 elementi.
- **R6 (Disaccoppiamento DTO Citazioni)**: DTO `CitationOpenRequest` con campi distinti per `documentId`, `passageId` (id univoco chunk per scroll ed evidenziazione), `locator` (etichetta leggibile utente), `revision` e `sha256`.

---

## 3. Risoluzione dei 3 Punti Tecnici Aperti

### 3.1 Locator dei Passaggi: Riconoscimento `## Pagina N` e `## Slide N`
- **Diagnosi audit**: Il chunker generava etichette generiche `"Paragrafo N"`, mentre l'estrattore `extraction.rs` produceva intestazioni `## Pagina N` (per PDF e scansioni OCR) e `## Slide N` (per presentazioni PPTX/Keynote).
- **Implementazione (`apps/desktop/src-tauri/src/catalog.rs:240-246, 330-336`)**:
  `chunk_text_to_passages` rileva ora se il segmento o paragrafo inizia con `## Pagina ` o `## Slide `. Quando rilevato, aggiorna il contesto corrente assegnando alle successive sezioni il locator `"Pagina <N>"` o `"Slide <N>"`.
  Se il documento non presenta pagine o slide (es. TXT/MD), viene mantenuta la numerazione `"Paragrafo <N>"` (o `"Paragrafi <N>-<M>"` in caso di raggruppamento di brevi paragrafi).
  Il passaggio a una nuova pagina o slide impone una cesura immediata del chunk, senza mescolare contenuti di pagine diverse.
- **Test reale**: `catalog::tests::test_chunk_text_to_passages_locators` (PASS).

### 3.2 Suddivisione Paragrafi Lunghi e Sovrapposizione (Overlap)
- **Diagnosi audit**: `chunk_text_to_passages` si limitava a dividere sui doppi a capo (`\n\n`), senza suddividere paragrafi monolitici superiori a 1.200 caratteri e senza applicare sovrapposizione tra chunk consecutivi.
- **Implementazione (`apps/desktop/src-tauri/src/catalog.rs:248-356`)**:
  1. Ogni blocco di testo superiore a `target_chunk - overlap` (1.050 caratteri) viene frammentato ricercando il confine di frase più vicino (`.`, `!`, `?`, `\n`) o lo spazio bianco (` `) nella finestra ottimale.
  2. La dimensione target del passaggio è impostata a 1.200 caratteri.
  3. Tra passaggi consecutivi all'interno della medesima sezione logica viene riportata una sovrapposizione di 150 caratteri (`overlap_chars_count = 150`), garantendo continuità semantica per l'indicizzazione e il recupero ibrido.
- **Test reale**: `catalog::tests::test_chunk_text_to_passages_locators` (PASS, asserzione su splitting di testo di 2.500 caratteri e verifica vincolo `char_count <= 1300`).

### 3.3 Scostamento Architetturale: Catalogo JSON Atomico (`00_SYSTEM/CATALOG.json`) vs SQLite
- **Diagnosi audit**: Il piano originario ipotizzava un catalogo transazionale basato su SQLite. L'implementazione utilizza un singolo file JSON atomico versionato in `00_SYSTEM/CATALOG.json`.
- **Giustificazione e Motivazione Tecnica**:
  1. **Portabilità 100% Vault Obsidian e File-System Puro**: Uno dei vincoli cardine del progetto LIMEN Vault è l'indipendenza e la totale leggibilità del vault in Obsidian su qualsiasi piattaforma (inclusi dispositivi mobili, sincronizzazioni Git e sync cloud come iCloud Drive o Dropbox). I file SQLite generano file ausiliari di lock (`.sqlite-wal`, `.sqlite-shm`) che causano frequenti conflitti di sincronizzazione, lock orfani e corruzioni su file system distribuiti o cartelle sincronizzate.
  2. **Crash-Safety e Atomicità**: La scrittura di `00_SYSTEM/CATALOG.json` avviene tramite pattern atomico: scrittura su file temporaneo (`CATALOG.json.tmp`) e rinomina atomica POSIX via `cap_std` (`atomic_save`). L'integrità è validata con digest crittografico SHA-256 di catalogo e documenti.
  3. **Concorrenza e Prestazioni**: La concorrenza multi-processo è regolata dal file lock cooperativo a livello di vault (`00_SYSTEM/.search.lock` e gate di scrittura). In memoria, il catalogo viene indicizzato in hash-map $O(1)$ per percorso e ID, eliminando il sovraccarico di query SQL su file locali per collezioni fino a decine di migliaia di documenti.
- **Dichiarazione formale**: Lo scostamento è registrato come scelta architetturale definitiva per garantire la conformità agli standard di portabilità del vault Obsidian.

---

## 4. Matrice dei Gate di Qualità A01 — A16 (Nomi Reali ed Evidenze)

Tutti i comandi citati corrispondono a test ed eseguibili reali. Gli output grezzi completi sono archiviati nella cartella `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/`.

| ID | Requisito di Piano | Test Reali Eseguiti nel Checkout | Log Grezzo Allegato | Exit Code / Durata | Stato |
|:---|:---|:---|:---|:---|:---|
| **A01** | Import multiplo con AI assente; zero perdita originali | `automation::tests::offline_ingestion_and_extraction_without_ai_key`<br>`automation::tests::batch_import_receipts_deduplication_and_isolation`<br>`automation::tests::native_picker_import_is_bounded_and_preserves_selected_file` | `cargo-test.log`<br>`desktop-ipc.log` | Code: 0<br>4.41s / 1s | **PASS** |
| **A02** | Estrazione e normalizzazione su formati supportati | `extraction::tests::pdf_and_scans_use_native_extraction`<br>`extraction::tests::word_and_slides_are_literal`<br>`automation::tests::unicode_text_chunks_preserve_every_byte`<br>`automation::tests::complete_multi_format_pipeline_with_declared_fake_ai` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A03** | Documenti lunghi e tabelle oltre 1.200 righe senza troncamento | `automation::tests::spreadsheets_keep_rows_beyond_api_limit_and_formulas`<br>`automation::tests::long_documents_are_split_without_manual_work`<br>`catalog::tests::test_chunk_text_to_passages_locators` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A04** | Ricerca deterministica: 100% casi gold e passaggi | `search::tests::search_passages_and_catalog_indexing`<br>`embeddings::tests::test_hybrid_fusion_ranks_exact_code_first`<br>`catalog::tests::test_lookup_by_path_beyond_50_documents_and_homonyms` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A05** | Semantica: 40 parafrasi / 100 doc, Recall@10 ≥ 0.90 con gold congelato | Nessuna suite automatica soddisfa il requisito di 100 doc / 40 query gold in CI/CD offline.<br>*Unit test parziali superati*: `embeddings::tests::test_cosine_similarity`, `embeddings::tests::test_embeddings_cache_lifecycle`, `embeddings::tests::test_hybrid_search_offline_graceful_fallback`. | `cargo-test.log` | N/D | **APERTO**<br>(Non eseguito su scala 100 doc) |
| **A06** | Ammissibilità prima del ranking (R3) | `ai::tests::test_eligibility_before_limits_regression_50_drafts_do_not_hide_approved_source`<br>`ai::index_policy_test::forged_approval_is_rejected`<br>`catalog::tests::test_proposals_stay_legacy_drafts_and_human_notes_preserved` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A07** | Citazioni e UI: apertura passaggio/revisione/sha256 (R4, R6) | `ai::tests::test_citation_locators_and_tamper_detection`<br>`catalog::tests::test_verify_document_passage_integrity_all_cases`<br>`ai::tests::binary_raw_source_extracted_text_is_read_in_ai`<br>`catalog::tests::test_passage_integrity_and_tamper_detection`<br>*TypeScript*: `DocumentReaderModal - highlightMatches` | `cargo-test.log`<br>`document-reader.log` | Code: 0<br>4.41s / 15ms | **PASS** |
| **A08** | Freshness e guasti isolati: modifica/rimozione file | `search::tests::test_search_detects_removed_and_modified_files_without_blocking`<br>`catalog::tests::test_document_pruning_on_file_deletion`<br>`catalog::tests::test_document_revision_bump_on_content_change`<br>`automation::tests::source_changes_and_deletion_invalidate_wiki_before_next_tick` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A09** | Idempotenza e recovery su riavvio/crash simulato | `catalog::tests::test_deduplication_preserves_aliases`<br>`catalog::tests::test_sync_catalog_and_offline_extraction`<br>`automation::tests::concurrency_and_scheduler_background_reconciliation`<br>`automation::tests::stale_search_lock_recovers_and_active_lock_is_preserved` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A10** | Gestione guasti API: timeout, 401, 429, max 3 retry | `automation::tests::bounded_retries_resume_and_key_absence`<br>`embeddings::tests::test_hybrid_search_offline_graceful_fallback` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A11** | Migrazione idempotente e rollback | `catalog::tests::test_double_migration_idempotent_and_rollback`<br>`catalog::tests::test_catalog_save_and_load_lifecycle` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A12** | Sicurezza locale: traversal, symlink, sanitizzazione HTML | `vault::tests::capability_blocks_external_symlinks_and_broken_links`<br>`compiler::tests::test_rust_compiler_sanitizes_html`<br>`search::tests::index_symlink_never_overwrites_note`<br>`sync::tests::sync_capture_rejects_symlink_and_freezes_bytes`<br>`mcp::tests::http_auth_origin_and_revocation`<br>*Guard test*: `tests/guards/prohibited-dependencies.test.ts` | `cargo-test.log`<br>`pnpm-test.log` | Code: 0<br>4.41s / 4s | **PASS** |
| **A13** | Protezione: snapshot e restore in cartella separata | `snapshots::tests::test_rust_snapshot_creation_and_integrity`<br>`snapshots::tests::test_snapshot_restore_to_separate_folder_verifies_hashes`<br>`snapshots::tests::snapshot_corruption_and_readonly`<br>`snapshots::tests::links_and_rollback_cannot_touch_outside`<br>`snapshots::tests::failure_at_manifest_write_cleans_only_staging` | `cargo-test.log` | Code: 0<br>4.41s | **PASS** |
| **A14** | UX: tre aree, pulsante lime, conteggi, focus, reader | *Parità nativa*: `tests/native-parity.test.ts`<br>*IPC Desktop*: `tests/desktop-ipc.test.ts`<br>*E2E M3-M7*: `test:m3-e2e` ... `test:m7-e2e` | `native-parity.log`<br>`desktop-ipc.log`<br>`test-m3-e2e.log`..`m7` | Code: 0<br>2s / 1s / 4s | **PASS** |
| **A15** | Prestazioni benchmark 1.000 doc / 10.000 passaggi, p95 ≤ 1s | Nessun benchmark di scala su 1.000 doc / 10.000 passaggi implementato nel repo.<br>Comando `test_benchmark_warm_search_latency` non esiste nel codice. | N/D | N/D | **APERTO**<br>(Non eseguito) |
| **A16** | Consegna: Notarizzazione Apple, Stapler e Gatekeeper | Verifica su `/Applications/LIMEN Vault v3.app` e `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg`:<br>`spctl -a -vvv -t exec` -> **accepted (source=Notarized Developer ID)**<br>`xcrun stapler validate` -> **The validate action worked!** | `installed-app-gatekeeper.log`<br>`installed-app-staple-validate.log`<br>`installed-dmg-gatekeeper.log`<br>`installed-dmg-staple-validate.log` | Code: 0<br>Apple Notary Accepted | **PASS** |

---

## 5. Riepilogo Suite di Test e Log Grezzi nel Checkout

Tutti i comandi sono stati eseguiti con successo, producendo i rispettivi log grezzi completi:

1. **`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`**
   - File log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/cargo-test.log`
   - Exit code: `0` — Durata: `24s`
   - Dettaglio:
     - `Running unittests src/lib.rs`: **76 passed; 0 failed; 0 ignored**
     - `Running unittests src/main.rs`: **17 passed; 0 failed; 0 ignored**
     - `Running unittests src/bin/vault-check.rs`: 0 tests
     - **Totale test Rust**: **93 passed, 0 failed**.
2. **`pnpm test`**
   - File log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/pnpm-test.log`
   - Exit code: `0` — Durata: `4s`
   - Include test unitari core e Prohibited Dependency Guard test.
3. **`pnpm typecheck`**
   - File log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/pnpm-typecheck.log`
   - Exit code: `0` — Durata: `6s`
   - 11 package TypeScript validati a zero errori.
4. **`pnpm build`**
   - File log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/pnpm-build.log`
   - Exit code: `0` — Durata: `17s`
   - Compilazione librerie e bundle di produzione Vite.
5. **Suite E2E e Desktop IPC**:
   - `test:native-parity` -> `native-parity.log` (Exit code: `0`, Durata: `2s`)
   - `test:m3-e2e` -> `test-m3-e2e.log` (Exit code: `0`, Durata: `1s`)
   - `test:m4-e2e` -> `test-m4-e2e.log` (Exit code: `0`, Durata: `0s`)
   - `test:m5-e2e` -> `test-m5-e2e.log` (Exit code: `0`, Durata: `1s`)
   - `test:m6-e2e` -> `test-m6-e2e.log` (Exit code: `0`, Durata: `1s`)
   - `test:m7-e2e` -> `test-m7-e2e.log` (Exit code: `0`, Durata: `1s`)
   - `test` (Desktop IPC) -> `desktop-ipc.log` (Exit code: `0`, Durata: `1s`)
   - `document-reader.test.ts` -> `document-reader.log` (Exit code: `0`, Durata: `0s`)

---

## 6. Evidenze Integrali di Notarizzazione, Staple e Gatekeeper

### 6.1 Sottomissione ad Apple Notary con `--wait`
- **Sottomissione App (`app-v3.zip`)**:
  - Comando: `xcrun notarytool submit "$OUT/app-v3.zip" --keychain-profile "LIMEN-M9" --no-s3-acceleration --wait --output-format json`
  - File log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/app-submit.json`
  - Risultato Apple:
    ```json
    {"message":"Processing complete","id":"9ba47399-ad11-4d08-864f-d5e4c07c97e1","status":"Accepted"}
    ```
- **Sottomissione DMG (`LIMEN-Vault-v3-arm64.dmg`)**:
  - Comando: `xcrun notarytool submit "$OUT/LIMEN-Vault-v3-arm64.dmg" --keychain-profile "LIMEN-M9" --no-s3-acceleration --wait --output-format json`
  - File log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/dmg-submit.json`
  - Risultato Apple:
    ```json
    {"status":"Accepted","message":"Processing complete","id":"714ad977-4239-4055-9078-ffc632c96e45"}
    ```

### 6.2 Graffettatura Ticket (Staple)
- **Staple App**:
  - Log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/app-staple.log`
  - Output: `The staple and validate action worked!`
- **Staple DMG**:
  - Log: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/dmg-staple.log`
  - Output: `The staple and validate action worked!`

### 6.3 Validazione Gatekeeper sulle Copie Effettivamente Consegnate

I controlli sono stati eseguiti non sui file intermedi in `.local`, ma sulle destinazioni finali di installazione:

#### 1. Applicazione installata in `/Applications/LIMEN Vault v3.app`
- **Comando**: `spctl -a -vvv -t exec "/Applications/LIMEN Vault v3.app"`
- **Log**: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/installed-app-gatekeeper.log`
- **Output**:
  ```
  /Applications/LIMEN Vault v3.app: accepted
  source=Notarized Developer ID
  origin=Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)
  ```
- **Comando**: `xcrun stapler validate "/Applications/LIMEN Vault v3.app"`
- **Log**: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/installed-app-staple-validate.log`
- **Output**:
  ```
  Processing: /Applications/LIMEN Vault v3.app
  The validate action worked!
  ```

#### 2. Disco immagine in `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg`
- **Comando**: `spctl -a -vvv -t install "/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg"`
- **Log**: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/installed-dmg-gatekeeper.log`
- **Output**:
  ```
  /Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg: accepted
  source=Notarized Developer ID
  origin=Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)
  ```
- **Comando**: `xcrun stapler validate "/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg"`
- **Log**: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/installed-dmg-staple-validate.log`
- **Output**:
  ```
  Processing: /Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg
  The validate action worked!
  ```

---

## 7. Checksum SHA-256 Finali Post-Staple

Poiché l'operazione di graffettatura (`stapler staple`) appone il ticket crittografico nel bundle e nel volume alterando i checksum iniziali, i valori sono stati ricalcolati sui file finali pronti per l'uso:

File: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/SHA256SUMS-v3.txt` (e copia in `USER INSTALL/SHA256SUMS-v3.txt`):

```
1e64e48c1f0271e4cc4a6e6e9b425adefffd7fe6d98f97cf907ae67e6f649b3e  LIMEN-Vault-v3-arm64.dmg
1003a90bce1aaed933ac9d1019b280f93106aace712dd005ce6a618bcdac975b  LIMEN Vault v3.app/Contents/MacOS/limen-vault
6481242bcb27b23d10f14da8c03388188bedc1a4f4bb690b39de67b66eea0a41  LIMEN Vault v3.app/Contents/Resources/native/limen-extract
```

---

## 8. Identità del Checkout e Congelamento Versione

Per prevenire qualsiasi disallineamento durante la revisione, l'intero stato del repository contenente il codice verificato, i test, la documentazione e i log di evidenza è stato congelato localmente tramite commit e tag git.

- **Tag**: `v3.0.0-audit-closure`
- **Commit SHA**: `5d35d6146568facff49d1aa018b3f96d5f067c15` (e HEAD congelato locale)
- **Nessun push remoto**: In conformità alle direttive di sicurezza, nessun commit o artefatto è stato inviato a repository remoti o servizi esterni.
