# Implementation plan — LIMEN Vault: memoria aziendale automatica e consultabile

Data: 18 settembre 2026. Destinatario: AG, incaricato dall’utente dell’implementazione successiva. Stato: piano completo e pronto all’esecuzione; implementazione finale NON completata. Questo incarico documentale non avvia AG, non modifica il codice applicativo e non pubblica nulla.

## 1. Obiettivo e vincoli non negoziabili

L’utente carica esclusivamente documenti grezzi. LIMEN conserva gli originali, estrae e normalizza il testo, rende i documenti consultabili e ricercabili, classifica e collega la conoscenza e genera wiki senza operazioni manuali per documento.

La consultazione precede l’arricchimento AI: un documento con testo estratto non può attendere classificazione o wiki per entrare nella ricerca. Un formato non estraibile deve restare apribile come originale e avere un errore comprensibile; mai simulare una conversione riuscita.

Una sola consegna completa: i pacchetti di lavoro qui sotto sono dipendenze interne, NON versioni successive/MVP. Non chiudere la milestone con criteri aperti e non consegnare candidati che correggano soltanto nome, colore o contatore.

Vincoli:
- Tre aree quotidiane: **Chiedi, Documenti, Memoria**. Impostazioni/Aiuto secondari.
- Pulsante globale **CARICA DOCUMENTI**, verde lime `#c8ff00`, testo nero, evidente e accessibile.
- Nome attuale **LIMEN Vault v3** e bundle identifier esistente preservati. Knowkeep è soltanto una proposta non approvata. Nessun nuovo branding, sito pubblico o pubblicazione GitHub in questo incarico.
- Funzioni locali indipendenti da CRM/MEMAI/cloud e dal provider AI. Integrazioni esistenti opzionali, conservate in Avanzate.
- Originali invariati, file Markdown esportabili/leggibili, revisioni e provenienza conservate. Non promuovere bozze ad approved senza la corrispondente revisione umana.
- Configurazione AI una volta, uso e costi espliciti; niente credenziali nel frontend, nei log o nel Vault. Riutilizzare Portachiavi.
- Leggere AGENT.md e le istruzioni applicabili. Conservare il checkout sporco e le modifiche preesistenti; niente reset globale, commit/push/deploy cloud impliciti.
- Dopo tre tentativi falliti della stessa azione fermarla: non aggirare il limite con un comando equivalente. Gli altri lavori indipendenti possono continuare.

## 2. Fonti, baseline e lavoro già presente

Leggere nell’ordine:
1. `AGENT.md`.
2. `IMPLEMENTATION/2026-09-18_UX_MEMORIA_AZIENDALE.md` e `IMPLEMENTATION/2026-09-18_UX_INVENTORY.json`.
3. Questo piano e la sezione operativa MA-* in `TASK_LIST.md`.
4. `SESSION HANDOVER.MD`, `TODO LIST.TXT`.
5. Codice effettivo elencato nella mappa sottostante; i numeri di riga dell’audit possono cambiare.

Inventario registrato al momento dell’audit, non una garanzia sul contenuto futuro: Vault `/Users/cesare/Documents/VAULT`, 56 RAW, configurazione/registro automatici assenti; indice 58 documenti (57 proposte, una approved), una nota in Casi studio. Rileggere SOLO i metadati necessari prima di migrare. Non usare il Vault reale come fixture distruttiva o corpus da inviare implicitamente a un provider.

Correzioni nel checkout, da integrare e verificare, non ricostruire alla cieca:
- Nome v3 già corretto; app installata con quel nome, ma DMG della consegna precedente non contiene tutte le correzioni.
- `AutomationPanel.css`: pulsante lime; candidato di sola correzione estetica non è la release finale.
- `automation.rs`: inventario RAW nel Report e test `inventory_visible_before_activation_and_after_source_changes` aggiunto, non eseguito nell’ultimo audit.
- `ModelPicker.tsx`, `ai_list_models`: elenco account introdotto; contiene anche modelli non adatti alla funzione, compatibilità ancora da trattare.
- `search_read_document`: comando aggiunto, non collegato al risultato UI; apertura/highlight mancanti.
- `knowledge.rs` supporta all e App ha default all; tab globale non ancora aggiunto. Non considerare risolta la vista Memoria.
- Messaggi AiPanel/ProposalPanel/KnowledgePanel migliorati solo parzialmente.
- Ultimo controllo delle correzioni: typecheck desktop PASS; NON prova di completamento Rust, UI o rilascio.
- Vecchio collaudo API: sette fonti e quattro wiki riuscite, una wiki fermata dopo tre tentativi, ultimo HTTP 429. Non riprovare senza risolvere la causa. Evidenza: `IMPLEMENTATION/V3_EVIDENCE/live-ui-api.json`.

### Mappa del codice

| Area | File esistenti principali | Intervento |
|---|---|---|
| Navigazione/stati duplicati | `apps/desktop/src/App.tsx`, `vault-ipc.ts` | Shell a tre aree, servizi di stato comuni, dettaglio documento |
| Acquisizione/coda | `AutomationPanel.tsx`, `src-tauri/src/automation.rs`, `main.rs` | Inventario unico, worker nativo, separazione locale/AI |
| Estrazione/OCR | `src-tauri/src/extraction.rs`, `native/extract.swift`, `build.rs` | Riutilizzare estrattori, qualità/posizioni, packaging firmato |
| Compilazione/proposte | `src-tauri/src/compiler.rs`, `proposals.rs`, `ProposalPanel.tsx` | Compatibilità e migrazione conservativa, percorso avanzato |
| Ricerca | `src-tauri/src/search.rs`, `packages/search-engine/src/` | Passaggi, freshness, indice incrementale e ricerca ibrida |
| Risposte e citazioni | `AiPanel.tsx`, `ai-ipc.ts`, `src-tauri/src/ai.rs`, `packages/ai-engine/src/context-selector.ts` | Unico retrieval, budget per passaggi, fonti/versioni apribili |
| Memoria | `KnowledgePanel.tsx`, `src-tauri/src/knowledge.rs` | Vista corrente aggregata e lettore comune |
| Compatibilità lettori | `src-tauri/src/mcp.rs`, `packages/vault-core/src/automation-state.ts` | Stessa politica revisioni/provenienza; non esporre nuove fonti senza policy esplicita |
| Protezione | `src-tauri/src/snapshots.rs`, `vault.rs` | Differenze vs corruzione, copie automatiche, recupero verificabile |
| Guida/consegna | `HelpPanel.tsx`, `HELP/`, `docs/GUIDA_UTENTE_LIMEN.md`, `manuale UI utente.txt`, `scripts/package-v3.sh` | Riallineamento al prodotto realmente collaudato |

## 3. Decisioni di architettura da applicare

### 3.1 Un documento, più rappresentazioni

Introdurre un catalogo nativo versionato dei documenti. Contratto minimo:

- `documentId`: identità stabile, indipendente dal titolo e dalla categoria.
- `revisionId`, `contentHash`, `originalPaths/aliases`, nome originale, MIME/formato, dimensione e data importazione.
- Stato separato di acquisizione, estrazione, indice lessicale, indice semantico, classificazione, wiki; errore tipizzato per fase, tentativi e prossimo tentativo.
- Percorsi/hash del testo estratto e delle note generate; collegamenti fra originale, passaggi, sintesi e revisioni.
- Categoria/cliente/progetto opzionali, tipo di evidenza (`source`, `wiki`, `human_note`, `legacy_draft`), stato editoriale separato dalla disponibilità tecnica.
- Eventi/stato con numero di revisione monotono; i conteggi UI sono query dello stesso catalogo, non liste gestite indipendentemente.

Implementare uno storage transazionale locale per catalogo, job e indici derivati (SQLite con migrazioni versionate è la scelta progettuale), accessibile esclusivamente dal runtime Rust. Originali e Markdown rimangono file: il database non deve essere l’unico modo per recuperare i contenuti. Ricostruzione degli indici dalla provenienza verificata, senza conferire fiducia a semplici flag frontmatter. Non inserire SQL o credenziali nelle schermate React. Prima di introdurre dipendenze verificare licenza, compatibilità Tauri/toolchain e disponibilità offline del binario; non scaricare runtime al primo uso.

Non mantenere due autorità divergenti: il nuovo catalogo governa la pipeline; i registri precedenti sono letti in migrazione e gli adattatori di compatibilità devono derivare dalla stessa revisione. Aggiornare insieme lettori Rust/TypeScript/MCP, oppure introdurre un adattatore esplicito testato. Vietato bypassare i controlli hash per far passare i test.

### 3.2 Pipeline disaccoppiata

`importazione → originale salvato → estrazione/OCR → passaggi + indice lessicale → consultabile`

Rami indipendenti successivi: `embeddings/indice semantico`, `classificazione/collegamenti`, `wiki → indice della wiki`.

- Il ramo locale parte anche con automazione AI mai configurata, key mancante o rete assente.
- Nessuna generazione LLM del testo originale. Riutilizzare estrattori deterministici/OCR esistenti.
- Pubblicare revisioni con commit coerente di file, catalogo e generazione indice; su crash riconciliare i passaggi incompleti senza pubblicare artefatti parziali.
- Worker gestito da Tauri/Rust; React osserva e invia comandi, non è lo scheduler. Cambio scheda e remount non avviano copie del worker.
- Scansione iniziale e riconciliazione periodica; watcher con debounce per modifiche da Finder. Non leggere un file ancora in scrittura come versione definitiva.
- Limiti di concorrenza e memoria, priorità all’estrazione/ricerca, equità dei job wiki. Cancellazione e pausa AI non bloccano il salvataggio o la ricerca locale.
- Backoff limitato per errori temporanei, rispettare Retry-After ove disponibile; massimo tre tentativi falliti per job/revisione. Credenziali/modello errati fermano subito il ramo relativo. Ripresa esplicita dopo risoluzione senza azzerare altre lavorazioni.
- Quando l’app è realmente terminata, non promettere elaborazione attiva. Ripresa automatica all’avvio; apertura dell’ultimo Vault valido senza nuovo inserimento del percorso. Nessun daemon di sistema obbligatorio in questa consegna.

### 3.3 Deduplica e revisioni

Deduplicare per hash contenuto entro il Vault, preservando gli alias/nome originale: rinominare lo stesso file non crea nuove elaborazioni AI. Non fondere documenti diversi solo perché hanno titolo uguale. Modifiche vere creano revisioni. Conservare le modifiche umane, niente sovrascrittura silenziosa di note editate.

Rimozione di una fonte: marcare origine mancante/rimossa, invalidare passaggi/wiki correnti dipendenti, conservare cronologia e copie già disponibili. Non usare versioni precedenti come se fossero attuali. Vecchie wiki non compaiono nella vista corrente, ma restano apribili nella cronologia.

### 3.4 Contratti di consultazione e stato

Definire DTO condivisi e validazione degli input IPC prima di collegare la UI. Nomi indicativi, non dichiarati già presenti:

| Operazione | Contratto richiesto |
|---|---|
| Lista documenti | Paginazione, filtri, conteggi per originali, stato fasi, revisione catalogo |
| Dettaglio | Originale e rappresentazioni, revisione corrente/storica, provenienza, errore di fase |
| Apertura originale | ID documento risolto nativamente a file autorizzato; Reveal in Finder/apertura app associata. Niente shell o percorsi arbitrari dal frontend |
| Lettura passaggio | ID/revisione/locator, testo paginato, hash verificato; niente limite che escluda l’intero documento lungo |
| Ricerca | Query/filtri/paginazione → risultati raggruppati per documento, passaggi, highlight, copertura/freshness e stato parziale |
| Domanda | Fonti ammesse → ranking → selezione passaggi → risposta/citazioni persistenti, annullamento |
| Stato/eventi | Snapshot iniziale + eventi versionati, riaggancio e riconciliazione dopo disconnessione |

Distinguere `empty` (zero risultati su dati pronti), `processing`, `partial`, `unavailable`; non mostrare tutte queste condizioni come «Nessun risultato». Errori leggibili con dettagli tecnici espandibili e senza segreti.

## 4. Pacchetti di lavoro e dipendenze

Gli ID corrispondono alla checklist principale. Si possono sviluppare parti indipendenti, ma nessun gate successivo è completo senza i precedenti richiesti.

### MA-01 — Baseline e contratti (prima di ogni modifica funzionale)

Inventariare diff esistenti, test, comandi IPC e formati di registro. Preparare fixture/copertura e scegliere il punto di compatibilità dei lettori. Definire schema/migrazioni del catalogo e DTO. Registrare decisioni e baseline, senza dichiarare test vecchi validi per il nuovo checkout.

Uscita: documento/revisione/stati definiti, rischi di migrazione mappati, test di regressione riproducibili per 0/0, fonti escluse e risultato non apribile.

### MA-02 — Catalogo, migrazione e identità (dipende MA-01)

Migrazione idempotente dei registri AUTO_KNOWLEDGE/compilatore e inventario filesystem. Preview con conteggi e backup verificato; prova prima su copia isolata. Non spostare/cancellare originali e proposte esistenti. Le fonti originali estratte possono diventare evidenza fedele senza approvazione; le proposte restano `legacy_draft` e non vengono promosse a conoscenza approvata.

Le 57 proposte reali non sono 57 nuove fonti indipendenti: mantenere i collegamenti ai relativi originali quando verificabili, senza inventarli. Le note umane esistenti rimangono consultabili e mantengono stato/provenienza.

Uscita: stessa identità dopo riavvio/rinomina, migrazione ripetibile senza duplicazioni, nessun byte originale perso, lettori compatibili e rollback collaudato.

### MA-03 — Ingestion locale autonoma (dipende MA-02)

Separare conversione/indice da `provider_ready`. Gestire importazione multipla e drag-and-drop con ricevuta per file: salvato, già presente, rifiutato con causa. Elencare TUTTI i formati importati, non la sola tabella del compilatore.

Conservare i limiti attuali finché non vengono aumentati con prove: import 32 MB, PDF 500 pagine, OCR 180 secondi, testo estratto fino a 16 MB. Un rifiuto non è un caricamento riuscito. Per documenti conservati ma non estraibili offrire apertura dell’originale. Scansioni prive di testo leggibile non producono contenuto inventato.

Aggiungere locator quando disponibili: pagina PDF, slide, foglio/riga, sezione/paragrafo. DOCX/TXT possono avere locator logici; non inventare pagine inesistenti. Normalizzazione conserva numeri, tabelle, nomi e codici.

Uscita: senza API né rete, file supportati estratti e cercabili; riavvio/cambio scheda non duplica elaborazione; un file corrotto non arresta il batch.

### MA-04 — Lettore unico e apertura originale (dipende MA-02; integra MA-03)

Scheda con titolo leggibile, originale, testo estratto, sintesi, collegamenti e cronologia. Render Markdown sicuro, nessun HTML/script eseguibile dai documenti; link locali validati e link esterni espliciti. Consultazione paginata/virtualizzata dei testi lunghi.

Riutilizzare lo stesso lettore da Documenti, Memoria, ricerca e citazioni. Risultati e citazioni attivabili con tastiera, focus visibile, ritorno alla posizione/query precedente. Esportazione/copia del testo e apertura/rivelazione originale.

Highlight allineato ai token normalizzati del motore: accenti, maiuscole e Unicode; offsets con unità dichiarata (es. UTF-16 per React), test emoji/caratteri multibyte. Non usare innerHTML per iniettare il testo. Un match semantico mostra il passaggio pertinente, non inventa un match letterale.

Uscita: ogni documento acquisito apribile; ogni risultato apre esattamente documento/revisione/passaggio indicati.

### MA-05 — Indice locale incrementale e passaggi (dipende MA-03)

Segmentare per struttura e budget, con sovrapposizione controllata, ID/hash/locator persistenti. Non saltare fonti lunghe per il budget complessivo. Indicizzare testo completo supportato, titoli, metadati, nomi file/codici. Classificazione assente non impedisce l’indicizzazione.

Versionare schema/chunker/generazione indice. Aggiornare solo revisioni cambiate, pubblicare generazioni consistenti. Registrare freshness effettiva, non soltanto versione del formato. Un file mutato/mancante non invalida tutta la query: escluderlo temporaneamente con avviso e aggiornare, continuando con gli altri risultati validi.

Ranking lessicale con termini esatti, frasi, accenti e codici; raggruppare passaggi per documento, paginazione con conteggi corretti. Coerenza Rust/TypeScript mediante fixture condivise.

Uscita: ricerca offline utile e automatica; niente reindicizzazione manuale nel percorso ordinario; modifiche e aggiunte visibili senza riapertura della schermata.

### MA-06 — Ricerca semantica e selezione delle fonti (dipende MA-05)

Implementare embeddings reali tramite provider OpenAI configurato; modello/dimensione e compatibilità verificati dalla documentazione ufficiale e dall’account durante l’implementazione. Non simulare la ricerca semantica con sinonimi hardcoded o un cambio di etichetta. Conservare vettori localmente per hash passaggio+modello+dimensione+versione, batch limitati, costo e invio testo espliciti nella configurazione iniziale.

Ricerca ibrida: unire candidati lessicali/semantici con fusione documentata e reranking; preservare la priorità degli identificativi esatti. Filtrare ammissibilità/revisione PRIMA del top-k, mai dopo i primi 50 documenti. Bilanciare documenti, deduplicare passaggi sovrapposti e wiki derivate dalla stessa evidenza. Nessun tuning sul set di valutazione finale.

Senza chiave/rete o embeddings pronti, ricerca lessicale disponibile e indicazione esplicita della copertura semantica. In questa consegna non è richiesto un provider semantico offline; non pubblicizzare semantica offline senza implementarla e misurarla.

Uscita: metriche del corpus MA-11 superate con provider reale; fallback offline e indisponibilità parziale collaudati.

### MA-07 — Classificazione, wiki e risposte documentate (dipende MA-03/05; risposte ibride dipendono MA-06)

Classificazione e wiki sono arricchimenti asincroni con validazione delle citazioni, provenienza e invalidazione dipendenze. Categoria incerta = non classificato, consultabile; non inventare clienti/progetti. Evitare rigenerazioni complete a ogni import e starvation delle wiki.

Per domande puntuali favorire passaggi originali; per sintesi includere wiki valide e prove originali. La politica può essere deterministica: documentarla e testarla, senza richiedere all’utente RAG vs wiki. Le risposte devono distinguere divergenze e insufficienza delle fonti.

Budget del contesto sui passaggi, non su file interi. Citazioni con ID/revisione/locator verificati prima dell’invio e prima della pubblicazione della risposta. Se il documento cambia durante la risposta, non mostrare la citazione come corrente: aggiornare o segnalare la revisione utilizzata. Nessuna risposta salvata come conoscenza primaria automaticamente per evitare auto-conferma del sistema.

Persistenza locale di conversazioni/risposte/citazioni; cambio scheda non perde il lavoro. Annullamento e timeout comprensibili. Una sola azione «Chiedi» dopo configurazione esplicita AI; anteprima delle fonti disponibile e modalità di conferma prima dell’invio opzionale. Conservare i controlli attuali contro prompt injection e citazioni inventate.

Uscita: domanda → risposta → passaggio originale verificato, con fonti ammesse e senza approvazioni per ogni estrazione automatica.

### MA-08 — UI/UX a tre aree (dipende MA-02/04/05, integra MA-07)

Shell e componenti separati invece di aggiungere altri blocchi a App.tsx. Un solo store/subscription di stato del Vault.

- **Chiedi**: campo centrale, azione AI esplicita e risultati documentali locali; cronologia e fonti apribili. Cercare non deve consumare API di risposta implicitamente.
- **Documenti**: elenco globale predefinito, tutti i formati, caricamento/drag-and-drop, nome/stato leggibili, filtri secondari, dettaglio unico.
- **Memoria**: vista globale corrente di clienti/progetti/argomenti e sintesi; categorie come filtri, niente default su una cartella vuota. Note umane distinguibili dalle sintesi AI, revisioni obsolete solo in cronologia.
- Pulsante lime globale con nero e contrasto/focus verificati, sempre raggiungibile anche durante la navigazione. Progresso per batch senza bloccare lettura/ricerca.
- Stati visibili semplici: Salvato / In elaborazione / Consultabile / Richiede attenzione. Consultabile non implica wiki pronta; dettaglio fasi e contatori distinti.
- Notifiche solo su completamento significativo o problema che richiede intervento. Indicatore persistente discreto per attività in corso.
- Proposte, compilatore, ricostruzione indice, hash, cartelle, sistema e MCP/CRM in impostazioni avanzate. Rimuovere badge M3/M6/M10 dalla navigazione quotidiana, non i servizi esistenti.
- Empty state specifici per primo uso, filtri senza risultati, attesa e errore; azione risolutiva contestuale. Nessun generico 0/0 o testo «nessuna nota» quando esistono documenti in altre categorie.

Uscita: prova utente dall’avvio fino all’apertura di una citazione senza usare strumenti avanzati, aggiornamento indice o scelta cartella.

### MA-09 — Configurazione unica e indipendenza (dipende MA-01/02; integra MA-06/07/08)

Memorizzare ultimo Vault valido, guidare creazione/selezione solo al primo uso; recupero comprensibile se cartella spostata o disco assente. Configurazione provider/modelli condivisa fra ingestion, wiki e domande; modello embeddings distinto internamente, senza imporre dettagli all’utente ordinario.

Elenco modelli account + verifica di capacità richieste; non presentare audio/immagini come modelli di risposta. Le capacità non si deducono dalla sola presenza in `/v1/models`: convalidare le richieste necessarie con input sintetici, documentare errori e fallback senza cambiare silenziosamente provider/costi. Scelta avanzata manuale consentita; stato key presente distinto da API funzionante/quota disponibile. Nessun segreto serializzato negli eventi.

App gratuita non equivale ad API gratuita: spiegazione una volta, archiviazione e ricerca locale disponibili senza chiave. Nessuna dipendenza obbligatoria da CRM e nessuna sincronizzazione/pubblicazione implicita.

Uscita: utente non reinserisce modello per ogni domanda; offline conserva consultazione; dati trasmessi e costo AI chiari.

### MA-10 — Protezione, copie e recupero (dipende MA-02/03)

Distinguere normali differenze del Vault vivo dal manifesto e vera corruzione di una copia. Pianificare copie automatiche durante esecuzione dell’app, prima della migrazione e dopo batch significativi con debounce: non una copia integrale per ogni singolo frammento. Retention/spazio configurabili, niente eliminazione silenziosa di copie manuali o recupero impossibile.

Copia consistente tra file/catalogo: checkpoint/lock appropriato, manifesti verificati, copia in staging e pubblicazione atomica. Se disco pieno, mantenere l’ultima copia valida e segnalare il fallimento.

Recupero guidato in cartella separata con verifica e scelta esplicita di apertura; nessuna sovrascrittura distruttiva del Vault attivo. Copie sullo stesso disco descritte come tali, non protezione da perdita del dispositivo. Riutilizzare le funzioni snapshot esistenti e testarle con il nuovo catalogo.

Uscita: creazione, verifica e recupero realmente eseguiti su fixture con confronto hash.

### MA-11 — Verifiche di affidabilità e prestazioni (inizia MA-01, gate dopo MA-02…10)

Creare corpus sintetico pubblico riproducibile, con verità attesa e nessun dato aziendale privato. Estendere `apps/desktop/tests/fixtures/auto-knowledge/`: PDF testuale e scansionato, immagine, DOCX, PPTX, fogli multipli/oltre 1201 righe, TXT/MD, HTML, Unicode; file corrotto/protetto/non supportato; note e proposte legacy; duplicati con nomi diversi; testi lunghi con marcatori inizio/centro/fine.

Matrice minima e criteri bloccanti:

| ID prova | Scenario | Accettazione |
|---|---|---|
| A01 | Import multiplo con AI assente | Ogni riuscito visibile/apribile; per-file falliti distinti; zero perdita originali |
| A02 | Estrazione e normalizzazione | Marcatori/valori attesi presenti su tutti i formati supportati del corpus; niente conversioni inventate |
| A03 | Documenti lunghi/tabelle | Risultati e passaggi anche a centro/fine, ultimi fogli/righe; nessuna esclusione per budget del file |
| A04 | Ricerca deterministica | 100% dei casi gold di termini/codici/frasi presenti nel corpus recuperati nella vista pertinente; misurare rank e copertura |
| A05 | Semantica | Almeno 40 query di parafrasi senza coincidenza dei termini centrali, su almeno 100 documenti distinti; Recall@10 ≥ 0,90 sul set gold congelato prima del tuning. È una soglia di accettazione proposta, non un risultato ottenuto |
| A06 | Ammissibilità prima del ranking | Oltre 50 proposte più rilevanti non nascondono la fonte ammessa; default AI non promuove legacy_draft |
| A07 | Citazioni e UI | 100% delle citazioni emesse nelle prove apribili sul passaggio/revisione effettivi; fixture con riferimenti inventati respinta |
| A08 | Freshness e guasti isolati | Modifica/rimozione di un file non cancella gli altri risultati; file vecchio escluso o etichettato storico; stato parziale esplicito |
| A09 | Idempotenza e recovery | Doppio import/rinomina/remount/riavvio/crash non perde né duplica lavori completati; classificazione/wiki non bloccano il locale |
| A10 | API | Offline, timeout, 401/403/404 e 429 isolati e comprensibili; limite tre tentativi rispettato; ripresa della sola fase risolta |
| A11 | Migrazione | Doppia esecuzione produce stesso inventario; originali/note umane byte-identici; rollback/riapertura senza perdita |
| A12 | Sicurezza locale | Traversal, symlink, document HTML attivo, prompt injection, credenziali nei log e IPC arbitrario respinti |
| A13 | Protezione | Backup verificato e recupero in cartella separata hash-identico, anche dopo gestione di spazio insufficiente |
| A14 | UX | Tre aree, pulsante lime, conteggi coerenti, tastiera/focus, elenco globale, evidenziazione accenti/Unicode, persistenza domanda al cambio scheda |
| A15 | Prestazioni | Benchmark su 1.000 documenti e almeno 10.000 passaggi: p95 ricerca locale calda ≤ 1 s sul Mac di prova, almeno 100 query; UI resta usabile durante importazione. Registrare hardware, cold/warm, memoria e dataset, non includere latenza provider in quella metrica |
| A16 | Consegna | Avvio app e DMG firmati/notarizzati, helper OCR funzionante senza toolchain sviluppatore, guide corrispondenti alla UI finale |

A05/A15 sono target progettuali, non promesse universali. Non ridurre il corpus o cambiare soglie dopo un fallimento per dichiarare completamento. Per dataset reali più grandi riportare limiti e misurare separatamente. In assenza del prerequisito API annotare il gate bloccato, proseguire locale, non dichiarare semantica verificata con mock.

Verifiche finali sul medesimo checkout, in sequenza:

```sh
pnpm test
pnpm typecheck
pnpm build
```

Aggiungere Rust lib/bin e suite di parità/native e2e pertinenti presenti in `apps/desktop/package.json`, più test nuovi del catalogo/coda/retrieval. Toolchain disponibile nel workspace `.local/cargo`, `.local/rustup`: verificarne il percorso prima dell’uso; esempio già usato nel progetto:

```sh
PATH="$PWD/.local/cargo/bin:$PATH" CARGO_HOME="$PWD/.local/cargo" RUSTUP_HOME="$PWD/.local/rustup" cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --release
PATH="$PWD/.local/cargo/bin:$PATH" CARGO_HOME="$PWD/.local/cargo" RUSTUP_HOME="$PWD/.local/rustup" pnpm --filter @limen-vault/desktop tauri build --bundles app
```

Non eseguire cargo test/build contemporaneamente. Test di provider simulato e reale riportati separatamente. Non basta un typecheck. Ripetere i controlli influenzati da successive modifiche, non quelli già riusciti senza nuovi motivi.

Evidenze in `IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/`: risultati suite, dataset/gold/versione, metriche, casi falliti, screenshot o prove UI, hash migrazione/recupero e report consegna. Nessun contenuto aziendale o chiave nei log pubblicabili.

### MA-12 — HELP, release unica e handover (dipende MA-11 completo)

Aggiornare HELP offline, HelpPanel, guida estesa, manuale TXT e rimandi del manuale root. Descrivere le tre aree e configurazione unica; niente istruzioni ordinarie di compilazione/reindicizzazione/approvazione per file. Precisare originali non estraibili, costi API, offline lessicale, stato wiki e copie locali. Riservare dettagli di architettura alla documentazione tecnica.

Build finale unica LIMEN Vault v3, firmata e notarizzata; aggiornare coerentemente versione tecnica/build se necessario e lo script che attualmente verifica 0.3.0, senza cambiare nome pubblico in v4 o nel marchio non deciso. Verificare requisito macOS/arm64 effettivo, non dichiarare piattaforme non collaudate.

Usare `scripts/package-v3.sh`, output/evidenze nuovi (`LIMEN_RELEASE_OUT`, `LIMEN_RELEASE_EVIDENCE`) per non sovrascrivere candidati precedenti. Profilo già usato: `LIMEN-M9`; verificare disponibilità senza esporre credenziali. Non assumere che una vecchia notarizzazione copra il nuovo binario. Gate separati app e DMG: Accepted, staple/validate, firma e Gatekeeper.

Destinazioni richieste già note:
- `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN Vault v3.app`
- `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg`
- `/Applications/LIMEN Vault v3.app`

Archiviare le copie sostituite in STORICO, aggiornare HELP/guide/LEGGIMI/SHA256SUMS accanto al DMG. App in uso dall’utente: osservare lo stato prima di chiuderla/sostituirla, non interrompere lavorazioni o perdere input. Non pubblicare su GitHub/sito né modificare backend/CRM: fuori perimetro attuale.

Aggiornare checklist PRIMA di consegna e resoconto. Finale con percorso completo, cosa funziona, test realmente eseguiti e limiti residui. Se un gate resta aperto, non chiamare la consegna completa.

## 5. Migrazione, recovery e rollback

1. Riconoscere versione dei registri/catalogo; versioni ignote non vanno sovrascritte.
2. Preflight spazio e permessi; inventario/hash e copia coerente verificata. Migrazione collaudata prima su fixture/copia isolata.
3. Scrivere nuovo catalogo e indici in staging, importare riferimenti esistenti senza modificare originali o approvazioni. Verificare collegamenti e conteggi.
4. Pubblicare marker/versione solo al completamento atomico. Crash intermedi devono lasciare attiva la generazione precedente o riprendere staging in modo idempotente.
5. Conservare vecchi registri e copia di sicurezza per rollback. Non avviare due scheduler sul medesimo Vault né aprire il nuovo catalogo con una vecchia app che non lo comprende.
6. Rollback preferito: riaprire una copia verificata con app precedente, mantenendo il Vault aggiornato separato; non copiare ciecamente un database vecchio su documenti nuovi.

Nessun rollback è dichiarato disponibile senza prova di lettura e confronto hash. Importazioni avvenute dopo migrazione non devono sparire quando si recupera una copia precedente: segnalarne la differenza e conservarle.

## 6. Definizione di completamento e rapporto per AG

MA-01…MA-12 e A01…A16 completati con evidenze, HELP coerente e app/DMG effettivamente consegnati. Usare in TASK_LIST gli stati: da fare, in corso, completato locale, verificato, consegnato, bloccato; una checkbox di gate resta aperta finché manca una verifica richiesta.

Riferire all’utente risultati di prodotto: «caricato → aperto → trovato → citato», non soltanto numero di file modificati. Non dichiarare consultabilità universale o ricerca infallibile: riportare corpus, metriche e limiti. Un’API non disponibile non deve impedire la memoria locale; l’assenza di un test API reale impedisce invece di certificare la parte semantica/AI.

La roadmap di esecuzione vive SOLO in `TASK_LIST.md`; `TODO LIST.TXT` contiene soltanto blocchi/dipendenze e azioni per risolverli. Questo piano definisce i contratti e i criteri, non una seconda checklist di stato.
