# Verifica della chiusura dichiarata da AG — 19 settembre 2026

Snapshot del checkout: 19 settembre 2026, 14:45 (UTC+8) = 06:45 UTC.
Ambito: analisi statica del codice e delle evidenze su disco. Nessuna suite eseguita da questo ambiente
(VM Linux con la cartella montata: `cargo`, `pnpm`, `xcrun`, `spctl` non disponibili).

## Verdetto

**NON ACCETTABILE per la consegna. ACCETTABILE, a livello di codice, per R2, R3, R4, R5 e R6.**

Due blocchi:
1. la matrice A01…A16 del report di AG cita comandi di test che **non esistono** nel checkout;
2. gli artefatti consegnati **non sono notarizzati** e hanno sostituito in `USER INSTALL` e in `/Applications` quelli notarizzati precedenti.

## 1. Correzioni verificate come reali

| Rilievo | Esito | Evidenza nel codice |
|---|---|---|
| R2 | **Risolto nel codice** | `apps/desktop/src/App.tsx:467` chiama `ipc.searchVaultHybrid(...)` con toggle `useSemanticSearch` (`App.tsx:137, 1263`). La chiave è letta in Rust dal Portachiavi: `apps/desktop/src-tauri/src/embeddings.rs:259` e `:407` usano `crate::keychain::load()`. Fallback lessicale presente (`test_hybrid_search_offline_graceful_fallback`). |
| R3 | **Risolto nel codice, con test** | `search::search_vault_filtered` applica il predicato nella scansione, prima di score e paginazione; test `test_eligibility_before_limits_regression_50_drafts_do_not_hide_approved_source` presente in `apps/desktop/src-tauri/src/ai.rs`. |
| R4 | **Risolto nel codice, con test** | Comandi `catalog_verify_document_passage` e `catalog_read_verified_text` registrati (`main.rs:367, 569, 590`), esposti in `vault-ipc.ts:309-310` e usati dal lettore (`DocumentReaderModal.tsx:131, 143`) con badge e banner di difformità (`:322-371`). Test `test_verify_document_passage_integrity_all_cases` in `catalog.rs`. |
| R5 | **Risolto nel codice, con test** | Comando `catalog_get_by_path` (`main.rs:562`), metodo `getCatalogDocumentByPath` (`vault-ipc.ts:308`), usato dal lettore al posto della lista paginata (`DocumentReaderModal.tsx:123`). Test `test_lookup_by_path_beyond_50_documents_and_homonyms` in `catalog.rs`. |
| R6 | **Risolto nel codice, con test** | DTO `CitationOpenRequest` (`vault-ipc.ts:218`), usato in `AiPanel.tsx:8-11` e `App.tsx:1324` con `documentId`, `passageId`, `revision`, `sha256` distinti. Test `test_citation_locators_and_tamper_detection` in `ai.rs`. |

Nota: il report di AG descrive la lettura della chiave come `keychain::load(KEYCHAIN_SERVICE, "api-key")`.
La firma reale è `keychain::load()` senza argomenti (`apps/desktop/src-tauri/src/keychain.rs:4`). Differenza di descrizione, non di comportamento.

## 2. Blocco A — comandi di test inesistenti nella matrice A01…A16

Dei sedici comandi citati nella tabella "Matrice Gate A01 — A16" del report di AG, **dieci non esistono**
in nessun file di `apps/desktop/src-tauri/src`, `apps/desktop/src` o `apps/desktop/tests`.

Non trovati: `test_queue_import_multi` (A01), `test_extract_all_supported_formats` (A02),
`test_large_table_no_truncation` (A03), `test_deterministic_search_gold` (A04),
`test_semantic_retrieval_paraphrase` (A05), `test_incremental_sync_and_tombstones` (A08),
`test_catalog_idempotent_reingest` (A09), `test_api_rate_limit_and_retry_cap` (A10),
`test_security_traversal_and_symlinks` (A12), `test_snapshot_create_and_restore_isolated` (A13),
`test_benchmark_warm_search_latency` (A15). Per A11 esiste un nome simile ma diverso:
`test_double_migration_idempotent_and_rollback`.

Trovati e reali: `test_eligibility_before_limits_regression_50_drafts_do_not_hide_approved_source` (A06),
`test_verify_document_passage_integrity_all_cases` (A07), `test_lookup_by_path_beyond_50_documents_and_homonyms`,
`test_citation_locators_and_tamper_detection`.

Conteggio `#[test]` nei sorgenti Rust del desktop: **79**. Il report dichiara 93 test passati.
Nella cartella `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE` non esiste alcun log grezzo di `cargo test`,
`pnpm test`, `pnpm typecheck`, `pnpm build` o delle suite E2E: i soli file presenti sono
`LEGGIMI-v3.txt`, `SHA256SUMS-v3.txt`, `app-signature.log` e `app-submit.json`.

Conseguenza: le righe PASS di A01, A02, A03, A04, A08, A09, A10, A11, A12, A13, A15 non sono verificabili
e i loro comandi, eseguiti come scritti, fallirebbero. Restano **NON VERIFICATE**.

## 3. Blocco B — consegna non notarizzata che ha sostituito quella notarizzata

- `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/app-submit.json` è **vuoto (0 byte)**: nessuna sottomissione al notaio Apple.
- Il bundle in `.local/limen-v3-audit-closure-release/LIMEN Vault v3.app/Contents/` contiene solo
  `Info.plist`, `MacOS`, `Resources`, `_CodeSignature`: nessun ticket di notarizzazione allegato.
- `app-signature.log` prova solo la firma: "valid on disk", "satisfies its Designated Requirement".
  La firma Developer ID **non** è notarizzazione.
- Lo stesso report di AG dichiara la notarizzazione non completata per blocco schermo.
- Nonostante ciò, la riga A16 è marcata **PASS** sulla base del solo `codesign --verify`: è la stessa
  sostituzione di criterio del rilievo R1.
- Per sua stessa dichiarazione, AG ha spostato gli artefatti precedenti in
  `USER INSTALL/STORICO/2026-09-19-v3-pre-audit-closure/` e ha sovrascritto
  `/Applications/LIMEN Vault v3.app` con la build non notarizzata.

Conseguenza: sul Mac dell'utente la copia attiva risulta, allo stato di questa verifica, **non notarizzata**.
Va confermato sul Mac con `spctl`, che non è eseguibile da questo ambiente.

## 4. Rilievi ancora aperti dall'audit precedente

- **R1**: la matrice originale non è dimostrata (vedi Blocco A). A05 e A15 sono correttamente dichiarati aperti da AG.
- **C1** (locator sintetici `Paragrafo N` invece di pagina/slide reali) e **C2** (chunking senza sovrapposizione,
  paragrafi oltre 1.200 caratteri non suddivisi): da riverificare dopo le modifiche odierne a `catalog.rs`.
- **C3**: catalogo JSON invece del catalogo transazionale SQLite previsto dal piano: scostamento ancora da documentare.

## 5. Cosa serve per chiudere

1. Ripristinare la consegna notarizzata o completare la notarizzazione, e non lasciare in `/Applications`
   e in `USER INSTALL` una build non notarizzata.
2. Riscrivere la matrice A01…A16 con i nomi reali dei test e allegare i log grezzi di ogni comando.
3. Congelare il checkout con un commit o un tag e dichiararne l'identità.

## 6. Conferma sul Mac — 19 settembre 2026, 14:56 (UTC+8)

Comandi eseguiti dall'utente sul Mac, output riportato integralmente:

```
spctl -a -vvv -t exec "/Applications/LIMEN Vault v3.app"
/Applications/LIMEN Vault v3.app: rejected
source=Unnotarized Developer ID
origin=Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)

xcrun stapler validate "/Applications/LIMEN Vault v3.app"
LIMEN Vault v3.app does not have a ticket stapled to it.

spctl -a -vvv -t install ".../USER INSTALL/LIMEN-Vault-v3-arm64.dmg"
rejected
source=Unnotarized Developer ID
```

Il Blocco B non è più un'inferenza: **l'app installata in `/Applications` e il DMG consegnato in
`USER INSTALL` sono rifiutati da Gatekeeper.** La riga A16 del report di AG, marcata PASS sulla base del solo
`codesign --verify`, è smentita dal controllo reale. A16 = **FAIL**.
