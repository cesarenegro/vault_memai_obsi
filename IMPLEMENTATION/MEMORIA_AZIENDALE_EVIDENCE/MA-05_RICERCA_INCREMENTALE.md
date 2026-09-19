# MA-05 — Evidenza: Ricerca Locale Incrementale e Passaggi Strutturati

## 1. Obiettivo del pacchetto
Potenziare il motore di ricerca locale del Vault (`search.rs` e package `search-engine`) affinché:
- Indicizzi non soltanto le note Markdown strutturate delle cartelle tematiche, ma anche tutti i documenti supportati del catalogo (`20_RAW_SOURCES` con testo estratto in `00_SYSTEM/EXTRACTED/`).
- Suddivida e indicizzi ogni documento in passaggi (`SearchPassageRecord`) con localizzatori precisi (`locator`: es. "Pagina 1", "Slide 3", "Paragrafi 1-3", "Foglio1!A1:D50"), testo, hash SHA-256 e token.
- Riconosca query lessicali per termini, codici e frasi esatte; assegni punteggi rilevanza con boost per corrispondenze nel titolo, nei tag e nei passaggi specifici.
- Restituisca per ogni risultato di ricerca il passaggio più rilevante (`matching_locator`, `matching_passage_id`, `snippet`) e l'elenco completo dei passaggi pertinenti (`passages`).
- Garantisca un indice incrementale atomico e freshness automatica: se l'indice è assente o un documento nel Vault è stato modificato (hash disallineato), la ricerca aggiorna automaticamente l'indice in background senza richiedere all'utente reindicizzazioni manuali ordinarie né restituire errori bloccanti.

---

## 2. Dettaglio delle modifiche

### 2.1 Backend Rust (`apps/desktop/src-tauri/src/search.rs` e `main.rs`)
- **Nuovi contratti strutturali**:
  - `SearchPassageRecord`: `passage_id`, `locator`, `sha256`, `text`, `tokens`.
  - `SearchMatchingPassage`: `passage_id`, `locator`, `snippet`, `score`.
  - Esteso `SearchResultItem`: campi opzionali `matching_locator`, `matching_passage_id`, `passages: Vec<SearchMatchingPassage>`.
  - Esteso `SearchDocumentRecord`: campo `passages: Vec<SearchPassageRecord>`.
- **Supporto al percorso catalogo (`20_RAW_SOURCES`)**:
  - `relative(p)` ammette `20_RAW_SOURCES` come root categoria valida.
  - `valid_status` include `auto` e `legacy_draft`.
  - `validate` accetta identificatori stabili di catalogo `doc_*`.
- **Indicizzazione passaggi automatica**:
  - Per note Markdown: chunking integrato tramite `catalog::chunk_text_to_passages`.
  - Per documenti RAW del catalogo (`VAULT_CATALOG.json`): recupero dei passaggi estratti da OCR/parser con preservazione incrementale basata su `content_hash` (se immutato, riutilizza i token memorizzati senza rielaborazione).
- **Matching a livello di passaggio e freschezza automatica**:
  - In `search_vault`, se l'indice manca o uno dei file è modificato rispetto all'hash registrato, l'indice viene riallineato automaticamente prima della restituzione dei risultati.
  - Ricerca del passaggio con score massimo e arricchimento del risultato con locator e ID del passaggio.
  - `read_indexed_document` esteso per supportare sia note Markdown che documenti estratti in `20_RAW_SOURCES`.

### 2.2 Frontend e IPC (`packages/search-engine`, `apps/desktop/src/vault-ipc.ts`, `apps/desktop/src/App.tsx`)
- Allineate le interfacce TypeScript di `search-engine` e `vault-ipc`: aggiunti `matching_locator`, `matching_passage_id`, `passages`.
- In `App.tsx`:
  - Nel rendering dei risultati di ricerca viene visualizzato il badge del localizzatore (es. `Pagina 2` o `Paragrafi 1-3`).
  - Il clic sulla scheda di ricerca o sul pulsante "Apri nel lettore" passa direttamente `item.matching_passage_id` a `openReader()`, aprendo il lettore unificato (`DocumentReaderModal`) con evidenziazione e focus istantaneo sul passaggio trovato.

---

## 3. Test e Verifiche di Correttezza

### 3.1 Test Rust Backend (`apps/desktop/src-tauri`)
- `search::tests::search_passages_and_catalog_indexing`: **PASS** (Verifica chunking in paragrafi, ricerca per termine, rilevamento `matching_locator`, `matching_passage_id`, snippet e passaggi multipli).
- `search::tests::metadata_filters_unicode_and_readonly`: **PASS**
- `search::tests::index_symlink_never_overwrites_note`: **PASS**
- `automation::tests::stale_search_lock_recovers_and_active_lock_is_preserved`: **PASS**
- Totale suite Rust: **81 test PASS** (62 test in `lib.rs`, 19 test in `main.rs`, 0 falliti).

### 3.2 Test Frontend e Monorepo (`pnpm`)
- `pnpm typecheck`: **PASS** (11/11 package verificati senza errori di tipi).
- `pnpm test`: **PASS** (Tutti i test TypeScript, integrazione guardie e dipendenze proibite).
