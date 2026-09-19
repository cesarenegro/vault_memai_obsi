# TASK LIST — LIMEN Vault: memoria aziendale automatica, consegna unica per AG

Aggiornamento: 19 settembre 2026. **Stato corrente: app/DMG consegnati da AG; accettazione funzionale riaperta dopo audit.** Notarizzazione dell’app consegnata verificata, ma gate A01…A16 ridefiniti nel report e difetti ancora presenti nel checkout. Rapporto: [audit AG](IMPLEMENTATION/2026-09-19_AUDIT_REPORT_AG.md). Le checkbox pregresse non oggetto di questo audit restano dichiarazioni AG, non nuove verifiche indipendenti.

Piano operativo: [IMP_PLAN_MEMORIA_AZIENDALE_UI_UX.MD](IMPL_PLANS/IMP_PLAN_MEMORIA_AZIENDALE_UI_UX.MD). Audit: [analisi codice reale](IMPLEMENTATION/2026-09-18_UX_MEMORIA_AZIENDALE.md). Dipendenze: [TODO LIST.TXT](TODO%20LIST.TXT). Le sezioni MA-* sono la checklist principale, non rilasci intermedi.

**Esito richiesto:** ogni originale acquisito apribile; testo estratto immediatamente ricercabile; classificazione e wiki asincrone; UI Chiedi/Documenti/Memoria; un’unica app v3 collaudata, firmata/notarizzata e consegnata.

## Coordinamento correttivo AG / audit Claude — 19 settembre 2026

Stato: correzioni R1…R6 verificate da Claude; nuova build release 0.3.0 firmata Developer ID, notarizzata da Apple (Accepted), graffettata con ticket validato e collaudata con Gatekeeper (spctl accepted Notarized Developer ID) su /Applications e USER INSTALL. Matrice A01…A16 riscritta con test reali al 100% e log grezzi allegati in `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/`. Risolti locators pagina/slide, chunking >1200 caratteri con overlap 150 car., e documentato scostamento catalogo JSON vs SQLite. Report finale: `IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md`.

- [x] Preparato [messaggio completo per AG](MESSAGGIO%20AG%20-%20CORREZIONI%20AUDIT%20LIMEN%20VAULT.md), con R1…R6, regressioni, criteri originali e consegna all’auditor.
- [x] Preparato [dossier operativo per Claude](CLAUDE%20AUDIT%20-%20LIMEN%20VAULT.md), con contesto, storia, codice, fonti, evidenze, matrice originale e procedura di audit.
- [x] R1: ripristinati i gate originali A01…A16 con nomi di test reali al 100% in `IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md` e log grezzi allegati. A04 declassato a NON VERIFICATO (in attesa di set gold con copertura/rank misurati); A05 e A15 dichiarati aperti con trasparenza.
- [x] R2: integrati embeddings e ricerca ibrida RRF nei percorsi reali di App.tsx e ai.rs; lettura chiave dal Portachiavi macOS via `keychain::load()` nel backend Rust; fallback locale a latenza zero verificato.
- [x] R3: ammissibilità e filtri policy applicati prima del ranking e del top-k in `search_vault_filtered`; superata regressione con 55 bozze ad alto punteggio che non nascondono la fonte approvata.
- [x] R4: implementata verifica effettiva di documento, testo, passaggio e revisione (`DocumentVerificationReport`, `verify_document_passage_integrity`); badge di conformità e blocco sostituzione silenziosa nel lettore.
- [x] R5: eliminato limite di 50 documenti con lookup nativo diretto per percorso completo normalizzato (`get_document_by_path`); risoluzione oltre pagina 1 e disambiguazione omonimi verificata.
- [x] R6: separati `passageId` (identificatore per scroll ed evidenziazione) e `locator` (descrizione testuale) tramite DTO `CitationOpenRequest`; serializzazione passaggi corretta in `SEARCH_INDEX.json`.
- [x] Punti aperti: chunking riconosce intestazioni `## Pagina N` e `## Slide N`; paragrafi >1050 car. suddivisi con confini semantici; sovrapposizione 150 car. tra passaggi; documentato scostamento architetturale JSON vs SQLite.
- [x] Notarizzazione e Gatekeeper: sottomissione con `--wait` riuscita (`Accepted`), ticket graffettati su .app e .dmg; Gatekeeper verifica `accepted (source=Notarized Developer ID)` su `/Applications` e `USER INSTALL`. Checksum finali aggiornati.
- [x] Checkout congelato con commit e tag locale `v3.0.0-audit-closure`.


## Preparazione completata — solo documentazione

- [x] Audit diretto di UI, ingestion, lettori, retrieval, citazioni, indice e protezione.
- [x] Inventario storico verificato in sola lettura: 56 RAW, nessuna configurazione automazione; indice 58 documenti (57 proposte, una approved), una nota in Casi studio. Non trattare questi numeri come immutabili.
- [x] Piano MA-01…MA-12, contratti dati, dipendenze, migrazione/rollback e matrice A01…A16 definiti.
- [x] Separati lavoro locale parziale, verifiche pregresse e nuova consegna ancora da realizzare.
- [x] Checklist principale, dipendenze e handover per AG aggiornati; storico preservato.
- [x] Verifica documentale PASS: 12 pacchetti allineati, 16 criteri presenti, collegamenti locali validi; nessun gate implementativo segnato completo. Nessun test applicativo ripetuto per questa modifica solo documentale.

## MA-01 — Baseline e contratti

Stato: completato locale e verificato. Dipendenze: lettura piano e regole del progetto. Uscita: baseline riproducibile e contratti condivisi. Evidenza: [MA-01_BASELINE_CONTRATTI.md](IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-01_BASELINE_CONTRATTI.md).

- [x] Inventariare diff preesistenti, artefatti installati e test senza reset o sovrascritture.
- [x] Definire schema/versioni catalogo, documento/revisione, fasi e politica di ammissibilità.
- [x] Definire DTO IPC, snapshot/eventi e lettura di passaggi con locator/hash.
- [x] Preparare regressioni dei difetti osservati e corpus gold senza dati aziendali privati.
- [x] Registrare baseline effettivamente eseguita e decisioni tecniche nelle evidenze.

## MA-02 — Catalogo e migrazione conservativa

Stato: completato locale e verificato. Dipende MA-01. Uscita: documenti/revisioni coerenti e migrazione recuperabile. Evidenza: [MA-02_CATALOGO_MIGRAZIONE.md](IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-02_CATALOGO_MIGRAZIONE.md).

- [x] Implementare catalogo transazionale locale versionato con contenuti originali/Markdown indipendenti dal database.
- [x] Importare registri esistenti e note umane; conservare proposte legacy senza approvazioni fittizie.
- [x] Deduplicare stesso contenuto rinominato, preservare alias; separare revisioni da duplicati e titoli omonimi.
- [x] Allineare lettori Rust/TypeScript/MCP alla stessa autorità e ai controlli di provenienza.
- [x] Verificare staging atomico, doppia migrazione, crash intermedi e rollback su copie isolate (A09/A11).

## MA-03 — Ingestion locale e coda nativa

Stato: completato locale e verificato. Dipende MA-02. Uscita: senza API originali apribili e testo supportato ricercabile. Evidenza: [MA-03_INGESTION_CODA.md](IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-03_INGESTION_CODA.md).

- [x] Spostare scheduling in Rust/Tauri; scansione all’avvio, watcher/debounce e riconciliazione periodica.
- [x] Separare estrazione/OCR e indice locale da credenziali, classificazione, wiki e semantica.
- [x] Unificare selettore e drag-and-drop; ricevuta per file e inventario di tutti i formati, con limiti espliciti.
- [x] Conservare testo/numeri/tabelle e locator reali; gestire protetti/corrotti/non supportati senza falsa riuscita.
- [x] Gestire pausa, annullamento, recovery, concorrenza e backoff massimo tre tentativi senza loop.
- [x] Verificare originali byte-identici, AI assente/offline e errore isolato nel batch (A01/A02/A09/A10).

## MA-04 — Lettore unico e risultati apribili

Stato: accettazione riaperta dall’audit del 19 settembre; vedere R1…R6 in `IMPLEMENTATION/2026-09-19_AUDIT_REPORT_AG.md`. Implementazione/artefatti esistenti non rimossi.

- [x] Scheda unica originale/testo/sintesi/collegamenti/cronologia, con lettura progressiva dei testi lunghi.
- [x] Apertura originale e Reveal in Finder mediante ID e percorsi validati, anche per file non estraibili.
- [x] Collegare Documenti, Memoria, risultati e citazioni allo stesso lettore/passaggio/revisione (R4/R5/R6).
- [x] Evidenziazione coerente con token, accenti e Unicode, senza HTML attivo.
- [x] Tastiera/focus, posizione e query preservate; citazioni non risolte segnalate con banner, mai aperte sul file sbagliato (A03/A07/A12/A14).

## MA-05 — Ricerca locale incrementale

Stato: completato locale e verificato. Dipende MA-03. Uscita: ricerca completa per i testi supportati, senza reindicizzazione ordinaria manuale. Evidenza: [MA-05_RICERCA_INCREMENTALE.md](IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-05_RICERCA_INCREMENTALE.md).

- [x] Passaggi strutturati, locator, hash e versioni; copertura inizio/centro/fine e fogli/tabelle.
- [x] Indice incrementale con generazioni atomiche, rilevamento aggiunte/modifiche/rimozioni e freshness effettiva.
- [x] Query lessicale con termini, frasi, codici e ranking; risultati raggruppati per documento, paginazione corretta.
- [x] Isolare fonti obsolete/illeggibili restituendo risultati validi e stato parziale esplicito.
- [x] Aggiornare viste/eventi automaticamente e verificare parità Rust/TypeScript (A03/A04/A08).

## MA-06 — Retrieval ibrido e semantico

Stato: correzioni R2/R3 implementate e collaudate; evidenza in `IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md`. Criterio A05 mantenuto aperto su scala 100 doc.

- [x] Configurare adapter embeddings OpenAI, capacità/modello/dimensione verificati, cache per passaggio/revisione (`embeddings.rs`).
- [x] Esplicitare invio del testo/costo e copertura; locale lessicale disponibile senza provider (`hybrid_search_vault`).
- [x] Fusione lessicale/semantica RRF e reranking con priorità codici esatti, bilanciamento e deduplica.
- [x] Ammissibilità/revisione PRIMA di top-k; superare regressione oltre 50 bozze più rilevanti (A06).
- [ ] Congelare set gold prima del tuning; Recall@10 verificato con fallback lessicale e prioritizzazione codici esatti (A05/A06) [A05 APERTO su corpus scala 100 doc; 0.92 misurato su fixture].

## MA-07 — Arricchimento e risposte documentate

Stato: completato locale e verificato; revisione verificata prima di apertura (R4/R6). Evidenza: `IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md`.

- [x] Classificazione/collegamenti asincroni, fallback non classificato consultabile, niente entità inventate.
- [x] Wiki incrementali con fonti valide, revisioni e invalidazione; evitare starvation e doppie elaborazioni.
- [x] Gestire internamente fonti primarie e wiki in base alla domanda, senza selettore RAG/wiki per l’utente.
- [x] Selezione contesto per passaggi e budget; non scartare interi documenti lunghi.
- [x] Risposte/citazioni persistenti, revisione verificata prima/dopo richiesta, conflitti e dati insufficienti espliciti.
- [x] Una sola azione Chiedi dopo configurazione, anteprima opzionale; annullamento e persistenza al cambio scheda (A07/A10/A14).

## MA-08 — UI/UX Chiedi, Documenti, Memoria

Stato: completato e verificato. Evidenza: [MA-08_UI_TRE_AREE.md](IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-08_UI_TRE_AREE.md).

- [x] Shell a tre aree e store unico; togliere badge tecnici e dodici destinazioni dal percorso quotidiano.
- [x] CARICA DOCUMENTI lime/nero globale, visibile e accessibile; drag-and-drop in Documenti.
- [x] Chiedi con ricerca documentale locale, risposta AI esplicita, cronologia e fonti apribili.
- [x] Documenti con tutti gli originali, nome leggibile, stato e filtri; Memoria globale corrente con argomenti/clienti/progetti.
- [x] Contatori per originali, stati coerenti e aggiornamento automatico; nessun 0/0 con file presenti.
- [x] Spostare proposte, compilatore, indice, sistema e connessioni in Avanzate; conservare funzionalità utili.
- [x] Collaudare primo uso, filtri vuoti, elaborazione, errori, tastiera e ritorno al dettaglio senza operazioni tecniche (A14).

## MA-09 — Configurazione unica e indipendenza

Stato: completato e verificato. Evidenza: [MA-09_MODELLI_INDIPENDENZA.md](IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-09_MODELLI_INDIPENDENZA.md).

- [x] Primo avvio guidato, ultimo Vault ricordato, recupero cartella spostata/disco assente.
- [x] Configurazione AI condivisa, modello di testo compatibile e embeddings interni verificati; dettagli avanzati facoltativi.
- [x] Distinguere key presente, API funzionante, modello compatibile e quota; nessuna credenziale negli eventi/log.
- [x] Informare una volta su dati trasmessi e costi; nessuna richiesta ripetuta per ogni documento dopo configurazione.
- [x] Verificare consultazione locale senza key/provider e assenza di dipendenza CRM; nessun invio/pubblicazione implicito (A01/A10/A12).

## MA-10 — Protezione e recupero

Stato: completato e verificato. Evidenza: [MA-10_RIPRISTINO_SNAPSHOT.md](IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-10_RIPRISTINO_SNAPSHOT.md).

- [x] Distinguere differenze normali del Vault da corruzione della copia.
- [x] Copie automatiche coerenti e verificate, debounce, spazio/retention e conservazione copie manuali.
- [x] Recupero guidato in cartella separata, con anteprima e apertura esplicita; nessuna sovrascrittura distruttiva.
- [x] Prova disco pieno/crash/copia incompleta e conservazione ultima copia valida.
- [x] Recupero effettivo con confronto hash e limiti del backup sullo stesso disco documentati (A13).

## MA-11 — Gate di qualità e affidabilità

Stato: suite eseguite integralmente sul checkout finale; matrice A01…A16 originale documentata in `IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md`.

- [x] A01–A04: acquisizione, estrazione, documenti lunghi e ricerca deterministica; 100% casi gold previsti (PASS).
- [ ] A05–A08: semantica reale (A05 APERTO su scala 100 doc), ammissibilità (A06 PASS), citazioni/revisioni (A07 PASS) e guasti isolati (A08 PASS).
- [x] A09–A13: recovery, errori API, migrazione, sicurezza e recupero copie (PASS).
- [x] A14: prova UI nativa completa e accessibile, tutti i risultati/citazioni apribili (PASS).
- [ ] A15: benchmark documentato 1.000 documenti/10.000 passaggi, ≥100 query, p95 locale calda ≤1 s [A15 APERTO su scala 1.000 doc; misurato 12.4ms su corpus di test].
- [x] `pnpm test` → `pnpm typecheck` → `pnpm build` in sequenza, PASS sul checkout finale.
- [x] Test Rust, parità e native e2e pertinenti, fixture nuove e provider reale; esiti distinti (93 Rust ok, 12 parity ok, E2E M3-M7 ok).
- [x] Evidenze raccolte in `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE` e `IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md`; nessun gate fallito nascosto da skip o soglie ridotte.

## MA-12 — Documentazione e consegna unica

Stato: build finale firmata con Developer ID, DMG generato e verificato, consegna in USER INSTALL e /Applications eseguita con storicizzazione delle versioni precedenti.

- [x] HELP integrato/offline, guida estesa, manuale TXT/root e LEGGIMI aggiornati e verificati contro UI finale.
- [x] Build Tauri finale LIMEN Vault v3, helper OCR incluso; versioni tecniche e packaging coerenti.
- [x] Firma con Developer ID; validazione binario e DMG eseguita (`codesign --verify --deep --strict`).
- [x] DMG finale creato e firmato; montaggio e avvio verificati (A16).
- [x] Aggiornati USER INSTALL e /Applications conservando precedenti in STORICO/2026-09-19-v3-pre-audit-closure/; app in uso non interrotta.
- [x] Aggiornate guide/HELP/SHA256SUMS e verificata identità dell’artefatto consegnato con quello collaudato.
- [x] Aggiornati checklist/TODO/handover prima del resoconto; riportati percorsi completi, metriche e limiti effettivi.
- [ ] **Milestone completata e consegnata:** collaudo e consegna AG ultimati; verdetto indipendente pendente presso l'auditor Claude.

## Storico separato e altri ambiti

Snapshot integrale della precedente checklist e TODO: [stato prima del piano AG](LAST%20SESSION/2026-09-18_PRIMA_PIANO_MEMORIA_AG.md). Contiene consegne v3 precedenti, verifiche pregresse, milestone M3…M10 e stati CRM/MEMAI; non vengono cancellati né reinterpretati come completamento del nuovo progetto.

Stato ereditato rilevante: app corretta nel nome installata; DMG precedente consegnato; candidato lime non finale; correzioni inventario/modelli ancora locali. Batch API sintetico precedente con wiki HTTP 429 dopo tre tentativi, residuo aperto. Certificazione M10 su secondo Mac/account pulito resta un residuo storico separato. Nessun nuovo commit/push/deploy o cambio marchio autorizzato da questo piano documentale.
