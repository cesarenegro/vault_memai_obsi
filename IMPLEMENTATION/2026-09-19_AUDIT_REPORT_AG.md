# Audit del report AG — 19 settembre 2026

Esito: artefatto consegnato notarizzato verificato; completamento funzionale MA-01…MA-12 non accettabile sulla base del codice e delle evidenze attuali. Audit statico mirato e controllo del pacchetto, senza modifiche applicative, esecuzione completa delle suite o nuove richieste API. Il controllo del checkout non dimostra da solo l’identità dei sorgenti incorporati nel binario.

## Verificato positivamente

- App in USER INSTALL: `spctl --assess --type execute --verbose=2` PASS, `source=Notarized Developer ID`, controllo eseguito in questo audit.
- SHA-256 del DMG consegnato: `d6f36e8a323bf9d73e219956dc653b63143898eea5386b33977e233a07199764`, coincidente con il resoconto.
- File app-status/dmg-status riportano Accepted per 72b72393-bca4-4c69-ab45-788b087d86a6 e b29ccea0-5c47-40b3-95e8-438981dcdc29. Non è stato effettuato un nuovo invio Apple.
- catalog.rs ora conserva l’ID per lo stesso percorso quando il contenuto cambia e incrementa la revisione (blocco intorno a riga 315). Questo corregge il difetto specifico precedente; non certifica tutte le migrazioni/rinomine.
- search.rs:907 tratta RAW recuperando testo/passaggi estratti invece della decodifica UTF-8 dei byte binari. Correzione presente; integrità delle rappresentazioni estratte e collegamento del lettore richiedono ancora lavoro.

## R1 — Bloccante per accettazione: gate A01…A16 sostituiti

Il piano originale, IMPL_PLANS/IMP_PLAN_MEMORIA_AZIENDALE_UI_UX.MD:231, definisce A05 come Recall@10 ≥0,90 su almeno 40 parafrasi/100 documenti. A15, riga 241, richiede benchmark 1.000 documenti/10.000 passaggi e p95 locale calda ≤1 s. MA-11_QUALITY_RELIABILITY_GATES.md assegna gli stessi ID rispettivamente a Native Parity e notarizzazione DMG. Anche gli altri gate sono ridefiniti come comandi/build invece dei criteri di prodotto.

Nella directory delle evidenze controllata non risultano dataset gold, metriche Recall@10 o benchmark p95 a sostegno delle checkbox corrispondenti. Non significa che le suite dichiarate falliscano: significa che non dimostrano i criteri concordati.

Rimedio: ripristinare mappatura originale, collegare ogni criterio a prova, input e risultato grezzo; comandi generali in sezione distinta. A05 e A15 restano aperti fino a misure riproducibili, senza sostituire le soglie.

## R2 — Alta: semantica implementata come modulo ma non collegata al flusso dell’app

App.tsx:462 chiama ipc.searchVault (lessicale); ai.rs:46 chiama search::search_vault. Nessuna chiamata applicativa a searchVaultHybrid o syncEmbeddings trovata nei componenti: esistono wrapper IPC e comandi Rust, ma non una pipeline UI/worker che li utilizzi. I comandi main.rs:619/633 ricevono api_key dal chiamante anziché caricarla dal Portachiavi nativo come richiesto dal piano.

Rimedio: collegare produzione degli embeddings e query ibride al flusso reale, con configurazione/consenso esistenti, credenziali lato Rust, stato copertura e fallback esplicito. Provare dalla UI una parafrasi che non possa essere risolta dal solo match lessicale, registrando pipeline e fonte senza dati privati.

## R3 — Alta: filtro ammissibilità ancora successivo ai primi 50 candidati nelle risposte

ai.rs:46 richiede limit=50 e soltanto nel ciclo successivo filtra eligible/source_ids. Il problema segnalato è ancora presente nel percorso effettivamente usato da Chiedi. Il commento del modulo embeddings sul filtro prima di top-k non corregge questo chiamante.

Rimedio: applicare policy, revisione e filtri prima di limitare i candidati. Regressione obbligatoria: oltre 50 proposte lessicalmente più forti non nascondono una fonte ammessa. Verificare anche che il ramo semantico rispetti tutti i filtri cliente/progetto/categoria/tag e che la paginazione venga applicata una sola volta dopo la fusione.

## R4 — Alta: garanzia integrità/revisione del lettore non implementata come descritta

La funzione dichiarata nel report `verify_document_passage_integrity(...expected_hash, expected_revision)` non è presente nei sorgenti controllati. Esiste read_passage (catalog.rs:911) che confronta il testo del passaggio con l’hash memorizzato, senza expected_revision né hash atteso della citazione e senza verifica dell’originale in quella funzione.

DocumentReaderModal legge getCatalogDocument e readDocumentText: non invoca readPassage. read_document_text, catalog.rs:891, concatena i passaggi del catalogo senza verificarli. open_original effettua invece un controllo dell’hash del file: non va confuso con l’apertura del testo nel lettore.

Rimedio: unico contratto documentId/revisionId/passageId/hash atteso e verifica coerente nel servizio usato dal lettore/citazioni. Testare cambiamenti fra risposta e apertura, testo estratto alterato e file mancante. Citazioni storiche etichettate come tali, senza apertura silenziosa della revisione nuova.

## R5 — Alta: risoluzione nel lettore limitata alla prima pagina

DocumentReaderModal.tsx:117 risolve un percorso tramite listCatalogDocuments senza paginazione e usa find sulla risposta. catalog.rs usa limit default 50. App.tsx passa item.relative_path dalla ricerca e doc.originalPath dalla tabella Documenti; pertanto il percorso può non essere trovato per documenti fuori dalla prima pagina del catalogo. La ricerca per solo nome è inoltre ambigua tra file omonimi.

Rimedio: passare ID canonici quando disponibili e aggiungere lookup nativo diretto per percorso validato, non scansione della prima pagina. Prova con almeno 60 documenti, apertura del più vecchio da ricerca, inventario e citazione; test di nomi identici in cartelle differenti.

## R6 — Media: locator e ID del passaggio scambiati

AiPanel.tsx:27 passa `s.locator || s.passageId` al callback; App inoltra il secondo argomento come passageId. DocumentReaderModal cerca una chiave in passageRefs: una stringa come «Paragrafo 1» non è l’ID `doc_..._p0`. Il click può aprire il documento senza raggiungere il passaggio citato.

Rimedio: DTO separati per ID e descrizione del locator, usando passageId per selezione/scroll. Test reale citazione su passaggio non iniziale.

## Limiti e stato

Non sono stati rieseguiti i 90/91 test riportati nei diversi documenti AG, né effettuati benchmark o prove UI. Gli esiti precedenti non sono inventati come confermati da questo audit. Le discrepanze statiche sono sufficienti a lasciare aperta l’accettazione funzionale. Il pacchetto può essere notarizzato e distribuito mentre i criteri di prodotto restano insoddisfatti.

La checklist va mantenuta coerente: artefatti consegnati distinti da milestone funzionale completata. Nessuna modifica dei dati reali o del software in questo audit.
