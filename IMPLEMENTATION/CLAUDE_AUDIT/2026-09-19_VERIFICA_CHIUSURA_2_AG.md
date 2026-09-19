# Seconda verifica della chiusura AG — 19 settembre 2026, 17:16 (UTC+8)

Checkout verificato: commit `aec113fe0eba1e11b458bceb733bf40ba0793e62`, tag `v3.0.0-audit-closure`, working tree pulito.
Ambiente: VM Linux con la cartella montata. Nessun comando macOS eseguito da qui: firma, notarizzazione e Gatekeeper
sono valutati sui log prodotti da AG, non riprodotti da me.

## Verdetto

**ACCETTABILE con due gate dichiarati aperti (A05, A15) e un gate da declassare (A04).**
I due blocchi della verifica precedente sono chiusi.

## Blocco A — matrice con test reali: chiuso

Tutti i diciotto nomi campionati nella nuova matrice esistono davvero nel checkout:
`offline_ingestion_and_extraction_without_ai_key`, `batch_import_receipts_deduplication_and_isolation` (automation.rs),
`pdf_and_scans_use_native_extraction` (extraction.rs), `spreadsheets_keep_rows_beyond_api_limit_and_formulas`,
`long_documents_are_split_without_manual_work` (automation.rs), `search_passages_and_catalog_indexing`,
`index_symlink_never_overwrites_note`, `test_search_detects_removed_and_modified_files_without_blocking` (search.rs),
`test_hybrid_fusion_ranks_exact_code_first` (embeddings.rs), `forged_approval_is_rejected` (ai.rs),
`bounded_retries_resume_and_key_absence` (automation.rs), `test_double_migration_idempotent_and_rollback`,
`test_chunk_text_to_passages_locators` (catalog.rs), `capability_blocks_external_symlinks_and_broken_links` (vault.rs),
`test_rust_compiler_sanitizes_html` (compiler.rs), `sync_capture_rejects_symlink_and_freezes_bytes` (sync.rs),
`http_auth_origin_and_revocation` (mcp.rs), `test_snapshot_restore_to_separate_folder_verifies_hashes` (snapshots.rs).

`IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/cargo-test.log` contiene 93 righe `test ... ok` e la somma dei
`test result: ok` è 93. I log grezzi di `pnpm test`, `pnpm typecheck`, `pnpm build`, parità nativa, IPC desktop,
document-reader e le cinque suite E2E sono presenti nella stessa cartella (25 file).

## Blocco B — consegna notarizzata: chiuso nei log di AG

- `app-submit.json`: `{"status":"Accepted","id":"9ba47399-ad11-4d08-864f-d5e4c07c97e1"}`
- `dmg-submit.json`: `{"status":"Accepted","id":"714ad977-4239-4055-9078-ffc632c96e45"}`
- `app-staple.log` e `dmg-staple.log`: "The staple and validate action worked!"
- `installed-app-gatekeeper.log`: `/Applications/LIMEN Vault v3.app: accepted — source=Notarized Developer ID`
- `installed-dmg-gatekeeper.log`: DMG in USER INSTALL `accepted — source=Notarized Developer ID`
- `installed-app-staple-validate.log` e `installed-dmg-staple-validate.log`: "The validate action worked!"

Controlli miei sugli artefatti in `.local/limen-v3-audit-closure-release`:
gli SHA-256 ricalcolati ora coincidono con `SHA256SUMS-v3.txt` (DMG `1e64e48c…`, binario `1003a90b…`,
helper `6481242b…`), e il bundle contiene `Contents/CodeResources`, coerente con un ticket allegato.

Resta da fare una verifica indipendente con `spctl` sulle copie installate, da terminale sul Mac.

## Rilievi precedenti

| ID | Stato |
|---|---|
| R1 | **Chiuso quanto a tracciabilità**: la matrice ora rimanda a test esistenti con log grezzi. Resta il limite di merito su A04 (sotto). |
| R2, R3, R4, R5, R6 | **Chiusi**, già verificati nel codice alla verifica precedente. |
| C1 | **Chiuso**: `catalog.rs:240-245` riconosce `## Pagina N` e `## Slide N` e assegna locator `Pagina N` / `Slide N`; test `test_chunk_text_to_passages_locators` verifica le prime due pagine. |
| C2 | **Chiuso**: `target_chunk = 1200`, `overlap_chars_count = 150` riportato fra passaggi della stessa sezione (`catalog.rs:344-351`), paragrafi oltre soglia suddivisi (`:248-249`); il test verifica la suddivisione e `char_count <= 1300`. |
| C3 | **Chiuso come documentazione**: lo scostamento JSON contro SQLite è ora dichiarato con motivazione nel report di AG. |

## Rilievo nuovo

| ID | Gravità | Descrizione |
|---|---|---|
| C4 | Media | A04 richiede il 100% dei casi gold di termini, codici e frasi su un corpus. Il test associato, `search::tests::search_passages_and_catalog_indexing`, indicizza **una sola nota** e verifica un unico risultato con locator presente. È una prova di funzionamento, non una misura di copertura su set gold: A04 va riportato a **NON VERIFICATO**, non PASS. Per A03 invece il test verifica davvero il marcatore di riga 1201 e le formule, quindi la mappatura regge. |

## Gate ancora aperti, correttamente dichiarati da AG

- **A05** — semantica su 40 parafrasi e 100 documenti con Recall@10 ≥ 0,90 su set gold congelato: non eseguita.
- **A15** — benchmark su 1.000 documenti e 10.000 passaggi con p95 ≤ 1 s: non eseguito.

## Conferma indipendente sul Mac — 19 settembre 2026, 17:25 (UTC+8)

Comandi eseguiti dall'utente, output integrale:

```
spctl -a -vvv -t exec "/Applications/LIMEN Vault v3.app"
/Applications/LIMEN Vault v3.app: accepted
source=Notarized Developer ID
origin=Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)

xcrun stapler validate "/Applications/LIMEN Vault v3.app"
Processing: /Applications/LIMEN Vault v3.app
The validate action worked!

spctl -a -vvv -t install ".../USER INSTALL/LIMEN-Vault-v3-arm64.dmg"
accepted
source=Notarized Developer ID
origin=Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)
```

**A16 = PASS, verificato in modo indipendente.** L'app installata e il DMG consegnato sono notarizzati,
il ticket è allegato all'app e Gatekeeper li accetta. Il blocco della consegna del giro precedente è chiuso.

## Stato finale dell'audit al commit `aec113fe0eba1e11b458bceb733bf40ba0793e62`

- R1, R2, R3, R4, R5, R6: chiusi. C1, C2, C3: chiusi.
- A16: PASS verificato in modo indipendente.
- A04: da declassare a NON VERIFICATO (rilievo C4: il test mappato indicizza una sola nota, non misura un set gold).
- A05 e A15: aperti, correttamente dichiarati da AG.
- Non eseguite in questo audit: prova manuale della UI nativa sull'app consegnata e riesecuzione delle suite
  (ambiente Linux senza `cargo`, `pnpm`, `xcrun`).
