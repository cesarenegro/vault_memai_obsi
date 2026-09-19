# MA-06 — Evidenza: Retrieval Ibrido e Semantico

## 1. Obiettivo del pacchetto
Implementare l'architettura di retrieval semantico e ricerca ibrida del Vault:
- **Adapter embeddings OpenAI**: supporto a modelli standard (`text-embedding-3-small`, 1536 dimensioni), con verifica della disponibilità e formattazione payload conforme.
- **Cache locale persistente e transazionale**: memorizzazione dei vettori di embedding per passaggio e hash del contenuto (`EMBEDDINGS_CACHE.json` in `00_SYSTEM/`), garantendo che nessun passaggio venga re-inviato all'API se il suo testo non è mutato.
- **Trasparenza e monitoraggio della copertura**: calcolo esatto della percentuale di passaggi coperti da embedding, monitoraggio token e stato del provider (`is_available`, `coverage`, `missing_passages`).
- **Fusione ibrida RRF (Reciprocal Rank Fusion)**: combinazione dei punteggi del motore lessicale e della somiglianza cosenica semantica, con priorità assoluta per codici, SKU e frasi esatte.
- **Filtro ammissibilità/revisione PRIMA del top-k (Criterio A06)**: i documenti non approvati o le bozze non ammesse vengono eliminati dai candidati *prima* del ranking e del calcolo dei primi K risultati, scongiurando la regressione per cui 50 proposte legacy affogavano le evidenze approvate.
- **Fallback offline immediato**: se la chiave API è assente o la rete non risponde, la ricerca scivola trasparentemente sul motore lessicale senza bloccare la UI o restituire errori fatali.

---

## 2. Dettaglio delle modifiche implementate

### 2.1 Backend Rust (`apps/desktop/src-tauri/src/embeddings.rs`)
- **Contratti DTO e Storage**:
  - `PassageEmbeddingEntry`: `passage_id`, `document_id`, `relative_path`, `locator`, `sha256`, `model`, `dimensions`, `vector`, `updated_at`.
  - `EmbeddingsCache`: versione dello schema (1), modello, dimensioni, dizionario `entries` indicizzato per `passage_id`, data di aggiornamento.
  - `EmbeddingsStatusReport`: passaggi totali, memorizzati in cache, mancanti, copertura percentuale (`coverage: 0.0 .. 1.0`), modello e stato.
- **Algoritmi e Integrazione**:
  - `cosine_similarity(a, b)`: prodotto scalare vettoriale normalizzato con protezione da divisione per zero.
  - `load_embeddings_cache` e `save_embeddings_cache`: persistenza atomica con file temporaneo `.embeddings-*.tmp` e rename sicuro in `00_SYSTEM/EMBEDDINGS_CACHE.json`.
  - `fetch_openai_embeddings`: client HTTPS con timeout espliciti (10s connect, 45s total), gestione codici HTTP 401 e 429 con messaggi diagnostici comprensibili.
  - `sync_embeddings`: sincronizzazione in batch (16 passaggi per richiesta) con potatura dei passaggi orfani e generazione delle sole novità.
  - `hybrid_search_vault`: pipeline a 5 fasi:
    1. Esecuzione ricerca lessicale su passaggi e titoli.
    2. Valutazione disponibilità cache ed embedding della query.
    3. Punteggio semantico sui passaggi candidati ammissibili.
    4. Fusione Reciprocal Rank Fusion ($RRF = \frac{0.5}{60 + r_{lex}} + \frac{0.5}{60 + r_{sem}}$) con bonus per corrispondenze esatte (SKU, codici alfanumerici).
    5. Selezione e ordinamento con paginazione `offset` e `limit`.

### 2.2 IPC e Tauri Bridge (`apps/desktop/src-tauri/src/main.rs`, `lib.rs`)
- Registrati comandi nativi Tauri:
  - `embeddings_get_status(vault_path)`
  - `embeddings_sync_vault(vault_path, api_key, model)`
  - `search_vault_hybrid(vault_path, query, api_key, use_semantic)`

### 2.3 Frontend TypeScript (`packages/vault-core`, `apps/desktop/src/vault-ipc.ts`)
- Aggiunta interfaccia `EmbeddingsStatusReport` in `@limen-vault/vault-core`.
- Estesa API `createVaultIpc`:
  - `getEmbeddingsStatus(path)`
  - `syncEmbeddings(path, apiKey, model)`
  - `searchVaultHybrid(path, query, apiKey, useSemantic)`

---

## 3. Test e Verifiche di Correttezza

### 3.1 Test Rust Backend (`cargo test`)
- `embeddings::tests::test_cosine_similarity`: **PASS** (Verifica ortogonalità, identità e vettori opposti).
- `embeddings::tests::test_embeddings_cache_lifecycle`: **PASS** (Salvataggio atomico e caricamento cache passaggi).
- `embeddings::tests::test_hybrid_search_offline_graceful_fallback`: **PASS** (Fallback lessicale istantaneo senza API key).
- `embeddings::tests::test_hybrid_fusion_ranks_exact_code_first`: **PASS** (Priorità codice esatto SKU-999-X rispetto a corrispondenze concettuali generiche).
- Totale suite Rust: **91 test PASS** (71 in `lib.rs`, 20 in `main.rs`, 0 falliti).

### 3.2 Test Frontend e Monorepo (`pnpm`)
- `pnpm typecheck`: **PASS** (11/11 package verificati senza errori di tipi).
- `pnpm test`: **PASS** (Tutti i test TypeScript di validazione, guards e sync service).
