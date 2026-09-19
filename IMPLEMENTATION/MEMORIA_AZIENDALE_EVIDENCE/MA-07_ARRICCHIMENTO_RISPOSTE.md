# Report di Validazione MA-07 — Arricchimento e Risposte Documentate

## Obiettivo del Pacchetto
Garantire risposte AI arricchite con citazioni verificabili, ancorate a passaggi e numeri di pagina/riga precisi, con budget del contesto per passaggi per evitare lo scarto di documenti lunghi, doppia verifica dell'hash prima e dopo la richiesta a OpenAI, e navigazione diretta della citazione verso il lettore unificato.

## Implementazione

### 1. Selezione Contesto per Passaggi e Budget (`apps/desktop/src-tauri/src/ai.rs`)
- In `select()`, se un documento supera il budget di lunghezza (> 3000 caratteri), non viene scartato: il testo viene sezionato in passaggi con `chunk_text_to_passages_locators()`, e vengono selezionati i passaggi rilevanti per la domanda.
- A ogni fonte selezionata viene assegnato il `locator` (`Option<String>`) e il `passage_id` (`Option<String>`).
- Vengono consultate sia le fonti primarie in `20_RAW_SOURCES` sia le note compilate in `01_CLIENTS`..`10_ADMIN`, senza richiedere all'utente di scegliere manualmente la modalità.

### 2. Formato Citazioni e Risposte con Locator
- In `parse_response()`, ogni citazione valida include:
  - `documentId`: ID univoco stabile del documento.
  - `relativePath`: percorso relativo nel Vault (es. `20_RAW_SOURCES/contratto.pdf`).
  - `title`: titolo o nome del file.
  - `locator`: localizzatore puntuale (es. `Articolo 4`, `p.2`, `row:15`).
  - `passageId`: ID univoco del passaggio (es. `doc_id_p0`).
  - `citationString`: riferimento canonico Obsidian `[[path#locator]]`.

### 3. Doppia Verifica di Integrità e Rilevamento Manomissioni
- La funzione `read_source()` verifica che l'hash SHA-256 effettivo dei byte su disco coincida esattamente con l'hash registrato al momento dell'anteprima.
- Qualsiasi modifica, cancellazione o sostituzione con symlink viene rilevata e bloccata con errore esplicito prima di esporre dati manomessi.

### 4. Navigazione Citazione nel Frontend (`apps/desktop/src/AiPanel.tsx`, `DocumentReaderModal.tsx`)
- In `AiPanel.tsx`, i bottoni delle citazioni espongono il badge del localizzatore (es. `[p.3]`, `[Articolo 4]`).
- Il click sulla citazione richiama `onOpenDocument(citation.relativePath, citation.locator || citation.passageId)`.
- `DocumentReaderModal.tsx` supporta `initialPassageId` verificando sia `passageId` che `locator`, evidenziando in lime (`#c8ff00`) e scorrendo al passaggio esatto.

## Evidenza Test Eseguiti

1. **Test Unitario Cargo (`apps/desktop/src-tauri/src/ai.rs`)**:
   - `test_citation_locators_and_tamper_detection`: PASSED
   - `binary_raw_source_extracted_text_is_read_in_ai`: PASSED
   - `citation_ids_and_incomplete_rejected`: PASSED
   - `approved_policy_and_context_hash`: PASSED

2. **Test Monorepo TypeScript & Vitest**:
   - `pnpm typecheck`: 11 package verificati con 0 errori.
   - `pnpm test`: Tutti i test di `ai-engine`, `vault-core`, `search-engine`, `sync-service` superati con esito positivo.
