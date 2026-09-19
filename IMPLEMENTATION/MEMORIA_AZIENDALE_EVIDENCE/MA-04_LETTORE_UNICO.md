# MA-04 — Evidenza: Lettore Unico e Risultati Apribili

## 1. Obiettivo del pacchetto
Fornire un componente modale universale di lettura (`DocumentReaderModal.tsx`) che consenta all'utente di:
- Aprire qualsiasi documento del Vault (fonti originali, note Markdown, proposte) sia tramite ID catalogo (`doc_*`) sia tramite percorso relativo o nome file.
- Consultare i passaggi estratti (`DocumentPassage`) con i relativi localizzatori (`p. 1-2`, `riga 1-45`, `slide 3`, ecc.), testo integrale e metadati di provenienza (hash SHA-256, percorsi originali, alias, timestamp).
- Copiare con un clic la citazione strutturata conforme Obsidian/LIMEN `[[file#locator]]` o `[[file]]`.
- Evidenziare in sicurezza i termini di ricerca senza iniezione HTML (nessun `dangerouslySetInnerHTML`), con supporto alla normalizzazione dei diacritici/accenti (es. "caffè" vs "caffe").
- Aprire il file originale con l'applicazione di sistema predefinita ("Apri originale") o rivelarlo nel Finder ("Mostra nel Finder").

---

## 2. Componenti e modifiche implementate

### 2.1 `apps/desktop/src/DocumentReaderModal.tsx`
- **Risoluzione documento flessibile**:
  - Se il target inizia per `doc_`, invoca `ipc.getCatalogDocument(vaultPath, docId)`.
  - Altrimenti, cerca nel catalogo per `originalPath`, `fileName`, o `aliases`.
- **Navigazione a schede**:
  - **Passaggi (`passages`)**: Elenco schede per ogni `DocumentPassage`, con localizzatore in rilievo, calcolo parole, testo formattato e pulsante rapido per copiare la citazione `[[documento#localizzatore]]`. Scroll automatico verso `initialPassageId` quando specificato.
  - **Testo integrale (`fulltext`)**: Visualizzazione del testo estratto completo memorizzato in `00_SYSTEM/EXTRACTED/`.
  - **Metadati e Provenienza (`metadata`)**: Tabella con ID documento, percorsi, dimensione, hash SHA-256 completo verificato, alias storici e date di ingestione/estrazione.
- **Evidenziazione sicura (`highlightMatches`)**:
  - Ritorna un array di nodi `React.ReactNode` con elementi `<mark>` stilizzati.
  - Normalizzazione Unicode NFD (`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()`) per far corrispondere query accentate e non accentate senza alterare il testo originale renderizzato.
  - Nessun uso di `dangerouslySetInnerHTML`, immune a vettori XSS.
- **Azioni native di sistema**:
  - "Apri originale": invoca `ipc.openOriginalDocument(vaultPath, doc.documentId)`.
  - "Mostra nel Finder": invoca `ipc.revealInFinder(fullPath)`.

### 2.2 Integrazione in `apps/desktop/src/App.tsx`
- Aggiunto stato modale nel root component: `readerOpen`, `readerTarget`, `readerPassageId`, `readerQuery`, con helper `openReader(target, passageId?, query?)`.
- Connesso `AiPanel`: al clic su una citazione documentale, attiva `onOpenDocument` aprendo il modale con il documento e il relativo estratto.
- Connessa la ricerca locale (`currentTab === 'search'`):
  - Le schede dei risultati di ricerca sono interattive (`onClick={() => openReader(item.relative_path, undefined, searchTerm)}`).
  - Aggiunto pulsante esplicito "Apri nel lettore".
- Connessa la tabella delle fonti (`currentTab === 'sources'`):
  - Aggiunto pulsante "Leggi" per ogni sorgente RAW per aprire istantaneamente il testo estratto e i passaggi nel lettore unificato.

---

## 3. Test e Verifiche

### 3.1 Test unitari evidenziazione e sicurezza (`apps/desktop/tests/document-reader.test.ts`)
- `returns plain text when query is empty or undefined`: **PASS**
- `highlights exact match with case insensitivity and React elements`: **PASS**
- `normalizes diacritics and accents (caffè vs caffe)`: **PASS**
- `handles multiple occurrences in long passages without XSS injection`: **PASS**
- `preserves Unicode and emojis`: **PASS**

### 3.2 Test IPC e Parità Desktop (`apps/desktop/tests/desktop-ipc.test.ts`)
- Tutti i metodi `getCatalogDocument`, `listCatalogDocuments`, `readDocumentText`, `openOriginalDocument`, `revealInFinder` verificati: **PASS**.

### 3.3 TypeScript Typecheck & Test Suite Monorepo
- `pnpm typecheck`: **PASS** (11/11 package senza errori).
- `pnpm test`: **PASS** (Tutti i test TypeScript/Node del monorepo).
- `cargo test`: **PASS** (79/79 test Rust: 61 lib + 18 main).
