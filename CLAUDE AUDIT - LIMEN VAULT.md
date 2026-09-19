# Claude — dossier e mandato di audit indipendente LIMEN Vault

Aggiornato: 19 settembre 2026. Destinatario: Claude, auditor del progetto su richiesta esplicita dell’utente. Questo file è un incarico e un dossier di contesto; NON certifica che Claude abbia già effettuato un audit e NON avvia alcun servizio o agente.

## 1. Il tuo ruolo

Valuta indipendentemente requisiti, codice, percorsi effettivi dell’app, test, evidenze e artefatti consegnati. AG implementa e corregge; Claude verifica e formula il verdetto. Non assumere vero un report perché dettagliato o perché tutti i test dichiarati sono verdi.

Il tuo incarico ordinario è audit e documentazione dei risultati. Non riscrivere il prodotto, modificare dati reali, attivare pubblicazioni o installare una release al posto dell’utente senza un incarico distinto. Puoi eseguire verifiche proporzionate e riproduzioni in fixture isolate, leggere sorgenti/metadati e aggiornare gli stati/evidenze di audit. Non abbassare criteri né correggere test per rendere verde una dichiarazione dell’implementatore.

La regola di AGENT.md che esclude provider Anthropic/Claude DAL PRODOTTO non impedisce questo ruolo esterno di auditor. Non integrare per questo motivo SDK, key o provider Claude nell’app LIMEN.

## 2. Obiettivo del prodotto e priorità dell’utente

LIMEN è una memoria aziendale indipendente: l’utente carica documenti grezzi; l’app conserva gli originali, estrae/normalizza testo, indicizza, organizza, collega e genera wiki. Nessuna conversione, compilazione, scelta cartella o approvazione obbligatoria per ciascun documento nel percorso automatico.

Priorità non negoziabili:
- Ogni originale acquisito deve essere apribile; file non estraibili o rifiutati hanno motivi espliciti, non false riuscite.
- Appena estratto, il testo deve essere ricercabile senza attendere classificazione o wiki.
- Ricerca locale, archivio e consultazione indipendenti da key AI, rete, CRM e MEMAI.
- Retrieval per passaggi, risultati cliccabili, parole evidenziate e citazioni su fonte/revisione/passaggio effettivi.
- Originali preservati e conoscenza esportabile; niente testo sorgente inventato dal modello.
- Tre aree quotidiane: Chiedi, Documenti, Memoria. Pulsante globale CARICA DOCUMENTI verde lime #c8ff00, testo nero. Strumenti tecnici in Avanzate.
- Una consegna finale completa; i pacchetti MA-* sono dipendenze interne, non MVP/versioni da consegnare separatamente.

Nome operativo: **LIMEN Vault v3**. Versione tecnica riportata da AG: 0.3.0; bundle identifier `dev.arkai.limenvault`. Il nome Knowkeep è stato proposto, NON approvato. Distribuzione pubblica gratuita/GitHub/sito è un’intenzione futura, non un’autorizzazione attuale a pubblicare dati/codice o cambiare marchio. Nessuna promessa di AI gratuita o dati sempre sul Mac: classificazione/wiki/embeddings possono usare OpenAI dopo configurazione esplicita.

## 3. Workspace e fonti da leggere

Root: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`.

Leggere prima:
1. `AGENT.md` e istruzioni utente applicabili: verità verificata, autonomia nel perimetro, tutela del lavoro, limite tre tentativi, stato operativo aggiornato.
2. `IMPL_PLANS/IMP_PLAN_MEMORIA_AZIENDALE_UI_UX.MD` — requisiti vincolanti, MA-01…MA-12 e matrice A01…A16.
3. `TASK_LIST.md` — checklist unica. Le checkbox pregresse non sono prova indipendente.
4. `TODO LIST.TXT` — dipendenze/blocchi, non seconda roadmap.
5. `IMPLEMENTATION/2026-09-19_AUDIT_REPORT_AG.md` — rilievi R1…R6 ancora aperti all’ultimo audit.
6. `MESSAGGIO AG - CORREZIONI AUDIT LIMEN VAULT.md` — incarico correttivo completo.
7. `IMPLEMENTATION/2026-09-18_UX_MEMORIA_AZIENDALE.md` e `IMPLEMENTATION/2026-09-18_UX_INVENTORY.json` — analisi precedente e inventario.
8. `SESSION HANDOVER.MD` — contesto operativo; le sezioni vecchie sono storico.

Ulteriori fonti:
- `IMPLEMENTATION/MEMORIA_AZIENDALE_EVIDENCE/MA-01_…MA-12_…` — documenti prodotti da AG da verificare, NON certificazioni indipendenti.
- `IMPLEMENTATION/V3_EVIDENCE/` — test/pacchetti e documentazione di più momenti; AG ha riutilizzato la directory. Associare ogni prova a data, submission ID, hash e checkout; non assumere che tutti i file si riferiscano all’ultima build.
- `LAST SESSION/2026-09-18_PRIMA_PIANO_MEMORIA_AG.md` — snapshot storico della checklist/TODO prima del nuovo piano.
- `IMPL_PLANS/IMP_PLAN_AUTO_KNOWLEDGE.MD` — piano iniziale superato per questa consegna.
- `CLAUDE AUDIT - LIMEN CRM MEMAI.md` — dossier di un ambito precedente più ampio. Non sostituisce questo mandato; non autorizza modifiche a CRM/MEMAI o servizi esterni.

Per capire una divergenza usa requisiti utente e piano originale, verifica il codice attuale e chiedi prove. Le righe nei report sono riferimenti storici: ritrova il simbolo nel checkout attuale. Un’assenza nel checkout o nelle evidenze va descritta con perimetro e data, non come conclusione su ogni versione futura.

## 4. Storia recente essenziale

### 17–18 settembre: automazione iniziale e problemi reali

Sono stati aggiunti estrattori locali/OCR, note automatiche, wiki, Portachiavi e packaging v3. Collaudo sintetico precedente: sette fonti e quattro wiki pronte; un’ulteriore wiki fermata dopo tre tentativi, ultimo HTTP 429. Il residuo non è una nuova prova positiva e non va riprovato azzerando contatori.

L’utente ha poi segnalato 0/0 dopo caricamento, Conoscenza vuota, assenza di modelli selezionabili, ricerca con risultati non apribili, eccessiva complessità di Proposte/Copie/compilazione.

Inventario in sola lettura registrato il 18 settembre: `/Users/cesare/Documents/VAULT`, 56 RAW, configurazione/registro automazione assenti, una nota in Casi studio, indice di 58 documenti (57 proposte e una approved). Le 27 importazioni mostrate dalla UI erano l’ultima selezione, non il totale. Questi dati sono storici: non asserire che siano immutati oggi. Non leggere o esportare il contenuto dei documenti aziendali se non serve e non usare quel Vault per test distruttivi.

### 18–19 settembre: piano consegnato ad AG

Preparati MA-01…MA-12 e A01…A16. AG ha dichiarato completati prima MA-01…05. Un controllo ha rilevato ID dipendente dal contenuto, lettura di binari come UTF-8, freshness incompleta e garanzie di integrità non dimostrate. Sono state richieste correzioni.

### 19 settembre: dichiarazione di completamento di AG

AG ha dichiarato tutte le milestone e tutti gli A01…A16 al 100%, circa 90 test Rust, suite TypeScript/native e notarizzazione. Ha consegnato app/DMG in USER INSTALL. I documenti AG hanno conteggi suite non uniformi (81/90/91 secondo fase), da ricondurre a checkout/log effettivi, non da ripetere come un’unica misura certificata.

### 19 settembre: audit indipendente successivo

Confermato Gatekeeper dell’app consegnata e hash del DMG. Nel codice presenti due correzioni specifiche: revisione incrementata mantenendo identità sullo stesso percorso; uso del testo estratto invece dei byte binari nel lettore RAW per AI. NON dimostrato il completamento del piano. Rilevati R1…R6 sotto. TASK_LIST e TODO sono stati aggiornati riaprendo l’accettazione interessata; altre checkbox storiche rimangono dichiarazioni AG da controllare.

## 5. Cosa è stato verificato e cosa no

Verificato direttamente dall’audit precedente:
- App consegnata: `spctl --assess --type execute --verbose=2` → accepted, source=Notarized Developer ID.
- Hash DMG consegnato: `d6f36e8a323bf9d73e219956dc653b63143898eea5386b33977e233a07199764`, coincidente con AG.
- Ispezione statica dei percorsi e difetti R1…R6.

Letto nei file di esito, senza una nuova interrogazione Apple in quell’audit:
- Notary app Accepted, ID `72b72393-bca4-4c69-ab45-788b087d86a6`.
- Notary DMG Accepted, ID `b29ccea0-5c47-40b3-95e8-438981dcdc29`.

NON verificato indipendentemente in quell’audit:
- Nuova esecuzione delle suite complete, benchmark p95, Recall@10, corpus gold e copertura di tutti i gate.
- Prova UI completa dell’ultima app per tutti i flussi.
- Identità dimostrata tra checkout attuale, sorgenti incorporati e binario consegnato.
- Aggiornamento della copia `/Applications` all’esatto candidato finale.
- Garanzie complessive di migrazione, crash recovery, copie automatiche e recupero soltanto perché un test/helper è presente.

## 6. Rilievi aperti e verifica di chiusura

### R1 — Criteri sostituiti, chiusura complessiva non dimostrata

`MA-11_QUALITY_RELIABILITY_GATES.md` ha ridefinito A01…A16 come comandi e packaging. A05 originale è semantica misurata; nel report è Native Parity. A15 originale è benchmark; nel report è notarizzazione DMG.

Chiusura: matrice originale invariata, evidenze riproducibili per ciascuna riga, output grezzi e dataset/gold. Un test generale può contribuire a più criteri ma non cambiarne il significato. Assenza di evidenza = non verificato, non PASS. Non confondere questo con una prova che ogni suite dichiarata sia fallita.

### R2 — Modulo semantico non integrato nel percorso reale

All’audit `App.tsx` chiamava `ipc.searchVault`, `ai.rs::select` chiamava `search::search_vault`; wrapper/comandi ibridi presenti ma senza uso nei componenti/worker. Comandi embedding/ibrido richiedevano api_key dal chiamante frontend.

Chiusura: seguire il percorso UI → IPC → servizio condiviso → adapter/cache → ranking → lettore. Verificare sincronizzazione automatica dei passaggi nuovi/modificati, key letta dal Portachiavi in Rust, copertura visibile e fallback lessicale offline. Prova semantica reale con input sintetico, non soltanto coseno simulato o fixture che coincidano lessicalmente.

### R3 — Ammissibilità dopo top-50

`ai.rs::select` chiedeva 50 risultati e solo dopo filtrava eligible/source_ids. Commenti in embeddings.rs non correggono il chiamante lessicale.

Chiusura: test con oltre 50 proposte non ammesse davanti a una fonte ammessa; corretto risultato senza promuovere bozze. Filtri cliente/progetto/categoria/tag/stato identici fra i rami, paginazione una volta dopo fusione. Nessun top-k prematuro che renda il filtro inefficace.

### R4 — Garanzia di hash/revisione non collegata al lettore

La funzione nominata da AG `verify_document_passage_integrity(...expected_hash, expected_revision)` non risultava presente. `read_passage` verificava solo il testo contro hash nel catalogo. DocumentReaderModal usava getCatalogDocument/readDocumentText; quest’ultima concatenava passaggi senza verifica. `open_original` controlla invece l’hash del file: è un percorso diverso.

Chiusura: servizio condiviso usato realmente dal lettore e dalle citazioni, ID/revisione/hash attesi, verifica della provenienza del testo estratto e gestione storica esplicita. Test di modifica originale, rimozione, testo/passaggio manomesso e cambio revisione tra risposta e apertura. Niente sostituzione silenziosa con una revisione nuova; non impedire recupero di una copia storica valida solo perché l’originale corrente è cambiato.

### R5 — Lettore risolve solo la prima pagina

DocumentReaderModal risolveva percorsi cercandoli nella prima `listCatalogDocuments`, default 50, mentre App passava percorsi da risultati e tabella. Aperture di documenti più vecchi possono fallire. Lookup per solo nome può scegliere l’omonimo sbagliato.

Chiusura: ID canonico e lookup nativo diretto per percorso/alias validato; prova almeno 60 documenti, apertura oltre prima pagina da tutti i percorsi, nomi duplicati in cartelle diverse. Aumentare semplicemente il limite a 100/1000 non risolve il difetto architetturale.

### R6 — Locator visuale usato come passageId

AiPanel passava `s.locator || s.passageId`; App e reader trattavano il secondo argomento come ID del passaggio. «Paragrafo 1» non equivale a `doc_..._p0`.

Chiusura: DTO distinto per ID/etichetta/revisione/hash, test con citazione a un passaggio non iniziale. Verificare apertura, scroll/focus ed evidenziazione nella UI, non solo presenza del campo nella risposta JSON.

## 7. Matrice originale A01…A16

Copia di consultazione dal piano del 18 settembre, senza ridefinire i gate. Il piano originale resta la fonte completa dei requisiti e delle dipendenze.
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

A05/A15 sono soglie richieste, non prestazioni già ottenute. Dataset e gold congelati prima del tuning; niente sinonimi hardcoded per simulare semantica e niente riduzione del corpus dopo un fallimento. Per Recall@10 pubblicare formula, unità (documenti/passaggi), rilevanza attesa e misura per query, non solo media. Per p95 registrare misure individuali, hardware, warm-up, cold/warm e attività concorrenti; non eliminare selettivamente query lente. Separare latenza locale da richiesta remota.

## 8. Mappa architetturale e aree da controllare oltre R1…R6

Frontend React/Tauri:
- `apps/desktop/src/App.tsx`: shell, ricerca, caricamento, stato e apertura reader.
- `AiPanel.tsx`, `ai-ipc.ts`: domanda, anteprima/invio, citazioni e persistenza.
- `DocumentReaderModal.tsx`, `vault-ipc.ts`: risoluzione identità, lettura, paginazione e apertura originali.
- `AutomationPanel.tsx`, `AutomationPanel.css`, `KnowledgePanel.tsx`, `ModelPicker.tsx`, `ProposalPanel.tsx`, `HelpPanel.tsx`.

Backend nativo `apps/desktop/src-tauri/src/`:
- `catalog.rs`: inventario, ID/revisioni/alias, estrazione e passaggi, backup/rollback e letture.
- `automation.rs`: vecchia pipeline AI, classificazione/wiki, limitazione tentativi e registri.
- `extraction.rs` e `../native/extract.swift`: conversione nativa, PDFKit/Vision OCR, limiti e locator.
- `search.rs`: indice, ranking, freshness e lettura fonti.
- `embeddings.rs`: cache, chiamate provider, sincronizzazione, semantica/fusione e filtri.
- `ai.rs`: ammissibilità, contesto, risposta strutturata, citazioni e verifica.
- `main.rs`, `lib.rs`: comandi registrati, worker e ciclo di vita.
- `snapshots.rs`: copie, manifesti, restore; `mcp.rs`: compatibilità/policy lettori esterni.

Package condivisi: `packages/search-engine`, `packages/ai-engine`, `packages/vault-core` e relativi test. Allineamento di DTO non equivale automaticamente a parità di comportamento.

Verifiche aggiuntive previste dal piano, NON nuove conclusioni negative senza prova:
- Il piano propone catalogo transazionale SQLite; il checkout controllato usa JSON atomico. Accertare e documentare lo scostamento, concorrenza/read-modify-write, lock, crash e migrazioni; rename atomico del singolo file non dimostra una transazione su catalogo+testo+indice.
- Identità stabile su modifica non basta per rename, alias, omonimi, rimozione e storia. Controllare tutte le transizioni.
- Chunker: paragrafi molto lunghi, sovrapposizione reale, assenza di duplicazione nel testo integrale; pagine/slide/fogli devono derivare dall’estrattore, non da etichette inventate.
- Modello elencato dall’account non prova compatibilità con Responses/output strutturati; filtro per nome non certifica capacità. Fallback non deve cambiare modello/costo silenziosamente.
- Classificazione/wiki non devono fermare estrazione e indice locale. Un parser guasto o un 429 non deve arrestare tutta la memoria.
- Contatori e stato devono provenire dalla stessa revisione; nuova nota o completamento job deve aggiornare tutte le viste.
- Backup/restore: comando di ripristino non equivale a copie automatiche, retention, gestione disco pieno o coerenza del catalogo. Provare recupero in cartella separata.
- Revisione delle proposte e policy MCP devono restare conservative, senza promozioni a approved per aggirare retrieval.
- Documenti non fidati, HTML/Markdown, link locali, symlink/traversal e prompt injection non devono creare esecuzioni o esfiltrazioni.

## 9. Procedura di audit riproducibile

1. Leggi requisiti e stato; registra data, branch/HEAD se disponibili, diff/stato sporco, fingerprint dei file rilevanti e versione toolchain. Il checkout contiene modifiche non committate: HEAD da solo non identifica il codice collaudato.
2. Per ogni rilievo verifica se il codice è cambiato dopo l’audit precedente. Non ripetere rilievi risolti; registra prova della correzione. Non cancellare lo storico.
3. Segui i percorsi effettivi, dall’azione UI al backend e ritorno. Cerca implementazioni non registrate, wrapper non chiamati, default incompatibili e flag che disattivano la funzionalità.
4. Crea fixture in un Vault temporaneo separato. Se i test esistenti non coprono la regressione, esegui una riproduzione isolata o documenta il test mancante; mantieni eventuali probe chiaramente separati dal codice da consegnare. Non modificare dati aziendali per dimostrare il bug.
5. Esegui i controlli mirati. Se difetti bloccanti restano, riportali senza consumare tempo rifacendo notarizzazioni; continua verifiche indipendenti utili.
6. Per certificare il checkout finale esegui le suite obbligatorie del progetto, poi i gate non coperti dalle suite. Mantieni output grezzi, exit code e durata; nessun dato sensibile.
7. Prova la UI nativa su fixture: importazione senza AI, tutti i formati, ricerca, dettaglio, citazione non iniziale, oltre 50 documenti, modifica/riavvio, stato parziale, offline, restore. Usa le capacità UI autorizzate disponibili; niente percorsi/menu inventati se non accessibili.
8. Per la semantica reale usa dati sintetici e credenziali attraverso il percorso previsto, senza estrarre chiavi nei log. Se manca accesso/quota, marca non verificabile e lascia il gate aperto; non sostituire con mock dichiarandolo reale.
9. Confronta manifest sorgenti/build/artefatti, verifica pacchetto installato e DMG. Un binario vecchio con stesso nome/versione non certifica il nuovo checkout.
10. Aggiorna risultati e checklist con verdetto. Non dichiarare accettata la release finché i criteri bloccanti non sono verificati.

### Comandi già presenti nel progetto

Dalla root, in sequenza per il checkout finale:

```sh
pnpm test
pnpm typecheck
pnpm build
```

Toolchain Rust locale già utilizzata (verificare esistenza prima):

```sh
PATH="$PWD/.local/cargo/bin:$PATH" CARGO_HOME="$PWD/.local/cargo" RUSTUP_HOME="$PWD/.local/rustup" cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --release
```

Suite native elencate in `apps/desktop/package.json`: `test:native-parity`, `test:m3-e2e`, `test:m4-e2e`, `test:m5-e2e`, `test:m6-e2e`, `test:m7-e2e`. Leggere gli script: alcuni richiedono un `vault-check` o binario nativo già compilato. Verificare che test e binario siano dello stesso checkout. Non chiamare genericamente “test E2E della UI” una prova IPC o stdio MCP. Non presumere Vitest: verificare il runner reale nei package.

Non eseguire cargo build/test simultanei causando attese superflue. Non ripetere suite già valide senza cambiamenti o motivi. Fermare la stessa azione al terzo fallimento e riportare il prerequisito mancante.

## 10. Artefatti e consegna

Candidato prodotto da AG:
- `.local/limen-v3-final/LIMEN Vault v3.app`
- `.local/limen-v3-final/LIMEN-Vault-v3-arm64.dmg`
- `.local/limen-v3-final/app-v3.zip`

Destinazioni:
- `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN Vault v3.app`
- `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-v3-arm64.dmg`
- `/Applications/LIMEN Vault v3.app` — verificare separatamente, non presumere aggiornamento.

Precedenti dichiarati archiviati da AG in `USER INSTALL/STORICO/2026-09-18-v3-precedente/`. Altri candidati/storici sono presenti: non eliminarli e non confonderli con l’app attiva.

Packaging: `scripts/package-v3.sh`, con `LIMEN_RELEASE_OUT`/`LIMEN_RELEASE_EVIDENCE`; profilo Portachiavi già usato `LIMEN-M9`. Il profilo è un riferimento, non contiene credenziali da richiedere o esporre. Certificato SHA-1 già usato `E01892F9C136DA67B393B9CD29AF97E369956968`; verificarne identità attuale senza copiarne descrizioni potenzialmente errate dai report.

Non notarizzare una build nuova per conto di AG durante un semplice audit; verifica quella fornita. Per controlli locali usare firma/staple/Gatekeeper sul target corretto. Nessun ticket storico copre un’app modificata. Non chiudere l’app dell’utente senza osservazione fresca e senza proteggere input/lavorazioni.

HELP/guide: verificare contenuto nel bundle e file in USER INSTALL, non solo sorgenti. Il progetto richiede ora macOS 26.3+ e arm64 nella configurazione osservata: ricontrollare prima di descrivere compatibilità. Distribuzione multipiattaforma non certificata.

## 11. Come produrre il verdetto

Scrivi un rapporto datato in `IMPLEMENTATION/CLAUDE_AUDIT/` e evidenze in una sottocartella per singola esecuzione; non sovrascrivere i report precedenti di AG o l’audit del 19 settembre. La checklist di stato resta soltanto `TASK_LIST.md`.

Formato minimo:
- **Verdetto:** ACCETTABILE / NON ACCETTABILE / NON VERIFICABILE, con ambito esplicito (checkout, funzionalità, pacchetto).
- Identità del codice/artefatto verificato e limiti dell’ambiente.
- Matrice A01…A16 originale: requisito, prova eseguita, esito PASS/FAIL/NON ESEGUITO/BLOCCATO, evidenza e residuo. Non “PASS parziale” dove manca un criterio obbligatorio.
- Rilievi ordinati per gravità, con ID stabile, file/simbolo/righe verificate, riproduzione, atteso/osservato, conseguenza e test di chiusura.
- Stato R1…R6: confermato / risolto con prova / non riproducibile / non verificabile. Nuovi problemi hanno ID distinti.
- Separazione tra prova statica, test simulato, API reale, UI nativa, prestazioni e packaging.
- Correzioni richieste ad AG, senza allargare arbitrariamente il perimetro.
- Evidenze positive: riconosci ciò che funziona, senza dedurne automaticamente il resto.

AG implementa e propone la chiusura; Claude verifica la chiusura. Un’ulteriore firma/notarizzazione non sana un bug di consultazione. Un report prolisso, un nome di funzione o il conteggio dei test non sono una prova dell’esperienza utente.

## 12. Prima azione richiesta a Claude

Verifica lo stato corrente rispetto a R1…R6 e alla matrice originale, seguendo il codice reale. Se AG non ha ancora corretto, identifica i blocchi confermati senza ripetere un intero rilascio. Se AG dichiara risolto, riproduci i casi concreti e chiedi solo l’evidenza/accesso indispensabili che mancano, continuando le verifiche indipendenti. Non assumere né il successo né il fallimento prima del controllo.
