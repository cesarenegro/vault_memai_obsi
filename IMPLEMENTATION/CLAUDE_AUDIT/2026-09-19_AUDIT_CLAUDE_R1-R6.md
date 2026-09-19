# Audit indipendente Claude — stato R1…R6 e matrice A01…A16

Data: 19 settembre 2026, 13:26 (UTC+8) — snapshot del checkout alle 05:26 UTC.
Autore: Claude (auditor). Ambito: analisi statica del codice nel checkout di lavoro.
Non certifica il binario consegnato, non esegue le suite, non modifica il prodotto.

## Verdetto

**NON VERIFICABILE per la chiusura complessiva; NON ACCETTABILE allo stato dello snapshot.**

Motivo procedurale prima di tutto: **il checkout è stato modificato mentre l'audit era in corso.**
Due rilevazioni indipendenti sullo stesso file mostrano codice diverso:

- 05:10 UTC — `apps/desktop/src-tauri/src/ai.rs` riga 48: `search::search_vault(... limit:Some(50) ...)`, filtro di ammissibilità applicato dopo.
- 05:26 UTC — stesso file: `search::search_vault_filtered(... limit:Some(200), Some(filter))`, filtro applicato durante la scansione.
- 05:10 UTC — `verify_document_passage_integrity` assente in `apps/desktop/src-tauri/src`; 05:26 UTC — presente in `catalog.rs:942`.

Finché AG lavora sul checkout, nessun esito di chiusura è attribuibile a una versione definita.
Serve un checkout congelato (commit o tag) e la dichiarazione di fine lavori prima dell'audit di chiusura.

## Identità di ciò che è stato esaminato

- Root: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`
- HEAD: `3a2124733a29956b94d7e2d48720064c9f014a01` (16 settembre 2026) — **non rappresenta il codice esaminato**
- File modificati o non tracciati rispetto a HEAD: 80
- Impronte MD5 dei file chiave allo snapshot 05:26 UTC:
  - `apps/desktop/src-tauri/src/ai.rs` 2353c6658cdf0e1dbdaec77037e4b575
  - `apps/desktop/src-tauri/src/search.rs` 783c6955afc3a5913cafeb4ca65e5b11
  - `apps/desktop/src-tauri/src/catalog.rs` a0f765848b448ea12e0d1963115bec1e
  - `apps/desktop/src/App.tsx` 9a5183790ff3f66cdf704f043eac707f
  - `apps/desktop/src/AiPanel.tsx` d4c9b3c12563b13b69051ef7fd024858
  - `apps/desktop/src/DocumentReaderModal.tsx` 7eec696996fa97ff9efa5c2d654e17fd

Limiti dell'ambiente di questo audit: l'analisi è stata eseguita da una VM Linux con la cartella montata.
`cargo`, `pnpm`, `xcrun`, `spctl` e l'esbuild del checkout (binario macOS arm64) non sono eseguibili qui.
Suite, benchmark, prove UI native e controlli di firma/notarizzazione restano **NON ESEGUITI** in questo audit.

## Stato dei rilievi R1…R6

| ID | Stato allo snapshot | Evidenza |
|---|---|---|
| R1 | **Confermato aperto** | `IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-11_QUALITY_RELIABILITY_GATES.md` ridefinisce A01…A16 come comandi (A01 guards, A02 typecheck, A04 cargo test, A05 native parity…). Nessun file in `IMPLEMENTATION/V3_EVIDENCE` o `MEMORIA_AZIENDALE_EVIDENCE` contiene i termini recall, p95, benchmark o gold. |
| R2 | **Confermato aperto** | `apps/desktop/src/App.tsx:462` usa `ipc.searchVault` (lessicale). `searchVaultHybrid`, `syncEmbeddings` e `getEmbeddingsStatus` esistono in `apps/desktop/src/vault-ipc.ts:291-293` ma **zero** chiamate nei componenti `.tsx`. Il comando `search_vault_hybrid` (`main.rs:633`) riceve `api_key: Option<String>` dal frontend, non dal Portachiavi in Rust. |
| R3 | **Corretto nel codice, non chiuso** | `ai.rs::select` ora chiama `search::search_vault_filtered` con predicato di ammissibilità e `limit: Some(200)`; in `search.rs:601+` il filtro è applicato nel ciclo di scansione, prima di ranking e paginazione. Manca il test di chiusura richiesto (oltre 50 proposte non ammesse davanti a una fonte ammessa). |
| R4 | **Confermato aperto** | `catalog.rs:942 verify_document_passage_integrity(...)` esiste con `expected_hash`/`expected_revision`, ma **non è registrato come comando Tauri** e non compare in `vault-ipc.ts` né in alcun componente. Il lettore (`DocumentReaderModal.tsx:132`) usa ancora `readDocumentText`, che in `catalog.rs::read_document_text` concatena i passaggi senza verifica. È esattamente il caso "wrapper non chiamato" previsto dal mandato. |
| R5 | **Confermato aperto** | `DocumentReaderModal.tsx:117` chiama `ipc.listCatalogDocuments(vaultPath)` senza opzioni; il default lato Rust è `options.limit.unwrap_or(50)` (`catalog.rs:868`). Oltre i primi 50 documenti la risoluzione per percorso/nome fallisce. Il confronto include `fileName`, quindi resta possibile scegliere un omonimo in cartella diversa. |
| R6 | **Aperto, con mitigazione parziale** | `AiPanel.tsx:27` passa ancora `s.locator || s.passageId` come secondo argomento, che App e reader trattano come ID del passaggio. Mitigazione: `DocumentReaderModal.tsx:435` registra anche il locator come chiave dei riferimenti, quindi lo scorrimento può funzionare per caso. Il DTO non distingue ID, etichetta, revisione e hash; `Source` in `ai.rs` ora porta `locator`, `passage_id` e `revision`, ma il frontend non li usa separatamente. |

## Nuovi rilievi

| ID | Gravità | Descrizione | Evidenza | Test di chiusura |
|---|---|---|---|---|
| C1 | Media | I locator dei passaggi sono etichette sintetiche `Paragrafo N` / `Paragrafi N-M` generate dal chunker, anche quando l'estrattore ha prodotto marcatori reali `## Pagina N` (PDF, `native/extract.swift:32`) o `## Slide N` (PPTX, `extraction.rs:139`). Una citazione non indica quindi la pagina o la slide effettiva. | `catalog.rs:238-241`, `catalog.rs:264-267` | Citazione su PDF multipagina e su PPTX: il locator mostrato deve corrispondere a pagina/slide reale. |
| C2 | Media | `chunk_text_to_passages` è documentata come "overlapping passages" ma non produce alcuna sovrapposizione (`current_chunk.clear()`), e un singolo paragrafo oltre 1.200 caratteri non viene mai suddiviso. | `catalog.rs:217-276` | Documento con paragrafo unico da 50.000 caratteri: verificare passaggi e recupero a centro e fine (A03). |
| C3 | Da documentare | Il catalogo è un file JSON (`VAULT_CATALOG.json`) riscritto con rename atomico, non il catalogo transazionale SQLite previsto dal piano. Nessuna dipendenza `rusqlite`/`sqlx` in `Cargo.toml`. Il rename atomico del singolo file non dimostra transazionalità su catalogo + testo + indice. | `catalog.rs:16`, `catalog.rs:197-205` | Scostamento da dichiarare esplicitamente, con prova di concorrenza, crash a metà scrittura e migrazione. |

## Matrice A01…A16 originale

Stato dal punto di vista di questo audit, secondo i criteri del piano del 18 settembre, non secondo la ridefinizione di MA-11.

| ID | Esito | Nota |
|---|---|---|
| A01 | NON ESEGUITO | Richiede prova di importazione reale senza AI. |
| A02 | NON ESEGUITO | Richiede corpus multiformato. |
| A03 | BLOCCATO | C2: paragrafi lunghi non suddivisi; prova richiesta su documento lungo. |
| A04 | NON ESEGUITO | Richiede set gold di termini e codici. |
| A05 | FAIL | R2: la semantica non è nel percorso reale; nessuna evidenza di Recall@10 o set gold. |
| A06 | PARZIALE, non chiuso | R3 corretto nel codice; manca il test con oltre 50 proposte non ammesse. |
| A07 | FAIL | R4 e R6: citazioni non verificate contro revisione e hash nel percorso del lettore. |
| A08 | NON ESEGUITO | Freshness e guasti isolati non provati in questo audit. |
| A09 | NON ESEGUITO | Idempotenza e recovery non provati in questo audit. |
| A10 | NON ESEGUITO | Limite a tre tentativi presente in `automation.rs:855-857`; comportamento non provato. |
| A11 | NON ESEGUITO | Migrazione non provata. |
| A12 | NON ESEGUITO | Sicurezza locale non provata in questo audit. |
| A13 | NON ESEGUITO | Backup e ripristino non provati. |
| A14 | PARZIALE | Struttura presente: tre aree Chiedi/Documenti/Memoria (`App.tsx:587-601`), pulsante CARICA DOCUMENTI `#c8ff00` (`App.tsx:562,577`), sezione Avanzate (`App.tsx:663`). Conteggi, tastiera, focus e persistenza non provati. R5 incide sull'apertura dei risultati. |
| A15 | NON ESEGUITO | Nessun benchmark nelle evidenze. |
| A16 | NON VERIFICABILE QUI | Firma, notarizzazione e Gatekeeper non eseguibili dall'ambiente di questo audit. |

## Evidenze positive

- Il filtro di ammissibilità di R3 è stato spostato prima della selezione top-k, con predicato applicato nella scansione.
- Esiste una funzione Rust con la semantica richiesta da R4 (`verify_document_passage_integrity`), pronta per essere collegata al percorso reale.
- La struttura UI richiesta da A14 (tre aree, pulsante lime, Avanzate) è presente nel codice.
- Il limite di tre tentativi è implementato e commentato come commit prima della chiamata di rete (`automation.rs:801, 855-857`).

## Correzioni richieste ad AG

1. Collegare `verify_document_passage_integrity` al percorso reale: comando Tauri registrato in `apps/desktop/src-tauri/src/main.rs`, metodo in `apps/desktop/src/vault-ipc.ts`, uso in `apps/desktop/src/DocumentReaderModal.tsx` al posto della sola `readDocumentText`, con ID, revisione e hash attesi (R4).
2. Integrare la ricerca ibrida nel percorso reale: `apps/desktop/src/App.tsx:462` deve usare il servizio condiviso, con chiave letta dal Portachiavi in Rust e non passata dal frontend; mantenere il fallback lessicale offline (R2).
3. Separare nel DTO ID del passaggio, etichetta, revisione e hash, e usarli distinti in `apps/desktop/src/AiPanel.tsx:27` e nel reader (R6).
4. Risolvere l'identità del documento nel lettore con lookup nativo per ID/percorso, senza dipendere dalla prima pagina di `catalog_list_documents` (R5).
5. Derivare i locator dai marcatori dell'estrattore (C1) e correggere chunking e sovrapposizione (C2).
6. Ripristinare la matrice A01…A16 originale nelle evidenze, con output grezzi, dataset e set gold congelati (R1), e documentare lo scostamento SQLite/JSON (C3).
7. Congelare il checkout e dichiararne l'identità (commit o tag) prima di chiedere l'audit di chiusura.

## Evidenze grezze

`IMPLEMENTATION/CLAUDE_AUDIT/2026-09-19_R1-R6/evidenze-grezze.md` — comandi e output dello snapshot delle 05:10-05:26 UTC.
Nota: la sezione R3 e la riga sulle occorrenze di `verify_document_passage_integrity` di quel file riflettono lo stato delle 05:10 UTC, superato dalle modifiche di AG delle 05:25-05:26 UTC riportate qui.
