# Automazione RAW → Markdown → RAG + wiki

## Implementazione locale

Il caricamento usa il selettore nativo macOS e copia gli originali in `20_RAW_SOURCES`. Il controller del Vault aperto legge la coda persistente ogni 15 secondi, normalizza ed estrae il testo, classifica nelle cartelle 01–09, scrive note Markdown e wiki con provenienza e aggiorna la ricerca. Non occorrono approvazioni per singolo documento. Attivazione iniziale e credenziale API necessarie; l’app deve essere aperta.

La conversione usa estrattori deterministici Office/fogli e PDFKit/Vision locali. OpenAI serve alla classificazione e alle sintesi wiki. Il primo esperimento con conversione generativa aveva aggiunto contenuto inesistente a una presentazione di una diapositiva: quel percorso è stato rimosso. `AUTO_KNOWLEDGE_EVIDENCE/live-api-status.json` documenta questo esperimento fallito e NON è evidenza positiva della catena finale.

Originali e note umane sono preservati. Stato/hash identificano le revisioni, invalidano dipendenze modificate o rimosse ed escludono risultati obsoleti. Tentativi limitati a tre per revisione. Le note automatiche restano `review` e sono identificabili separatamente dalle approvazioni umane; nessuna pubblicazione CRM implicita. Ricerca lessicale esistente integrata con le nuove fonti/wiki, senza dichiarare un indice vettoriale.

## Prova UI effettiva

App candidata aperta dalla build locale su Vault temporaneo isolato. Sezione Fonti, pulsante Carica documenti grezzi, selettore nativo, documento sintetico `documento.docx`: ritorno UI «1 file caricati.». Copia RAW verificata byte per byte identica al file selezionato. Evidenza `AUTO_KNOWLEDGE_EVIDENCE/ui-import.json`. L’automazione non era attivata in questo Vault: la prova attesta l’importazione, non il completamento API dall’interfaccia.

## Residuo concreto

La prova della nuova catena con API reali è sospesa sulla richiesta del Portachiavi macOS per `vault-check`. SecurityAgent non è accessibile allo strumento UI per ragioni di sicurezza; richiesta di intervento all’utente inviata. Nessun aggiramento delle protezioni. La catena completa con provider simulato e gli estrattori reali hanno test separati; non equivalgono alla prova API reale.

## Distribuzione

Modifiche soltanto locali. Nessun commit, push, installazione, notarizzazione o deploy. App installata e pacchetti precedenti preservati. Stato corrente e controlli finali nella checklist principale `TASK_LIST.md`; comportamento e limiti in `docs/AUTOMAZIONE_CONOSCENZA.md`.

## Esiti finali

pnpm test, pnpm typecheck e pnpm build eseguiti in sequenza: PASS. Test Rust release: 50 lib + 18 main PASS, zero fallimenti. Build Tauri finale: PASS, bundle locale generato. git diff --check: PASS. Log in AUTO_KNOWLEDGE_EVIDENCE. Restano due warning Rust di codice non usato; nessun errore di compilazione.
