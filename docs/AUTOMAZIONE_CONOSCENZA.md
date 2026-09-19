# Caricamento automatico della conoscenza

Dopo la configurazione iniziale della chiave OpenAI e del modello, l’utente carica i file dalla sezione Fonti oppure li deposita in `20_RAW_SOURCES`. LIMEN esegue conversione, normalizzazione, classificazione, archiviazione, indicizzazione e creazione delle wiki. L’app controlla il Vault aperto ogni 15 secondi e riprende il lavoro persistito alla riapertura.

## Dove vengono salvati i documenti

| Contenuto | Destinazione |
| --- | --- |
| File originale | `20_RAW_SOURCES/`, conservato senza modifiche |
| Note Markdown estratte | Categoria individuata fra `01_CLIENTS` e `09_COMPETITORS`, comprese `05_PACKAGING_KNOWLEDGE` e `08_MARKET_RESEARCH` |
| Wiki AI | Stessa categoria delle fonti, separata per cliente e progetto |
| Registro operazioni, hash e indice ricerca | `00_SYSTEM/` |

Cliente e progetto sono proprietà delle note, non nomi di nuove cartelle imposti dall’AI. I nomi dei file generati hanno prefissi `auto-source-` / `auto-wiki-` e identificativi che evitano collisioni. Il titolo leggibile è nei metadati e nell’interfaccia. Tutti i documenti generati sono veri file Markdown leggibili in Obsidian.

I documenti lunghi vengono divisi automaticamente in parti; una nota indice le collega. Ogni parte rimanda all’originale. Le sezioni wiki citano le note che le sostengono; il registro conserva gli hash di tutte le dipendenze. Se cambia o scompare una fonte, la vecchia nota/wiki non viene più utilizzata dal retrieval. Una modifica a una nota generata viene conservata e segnalata, senza sovrascrittura automatica.

## Conversione e AI

- Testi Markdown, TXT, HTML, CSV, TSV, JSON, XML, YAML, EML: lettura locale, normalizzazione delle terminazioni di riga e gestione UTF-8/UTF-16.
- DOCX, PPTX e ODT: estrazione diretta dall’archivio XML; OCR delle immagini incorporate riconosciute.
- DOC e RTF: conversione tramite componente macOS.
- XLS, XLSX, XLSB e ODS: estrazione locale delle celle e delle formule, senza il taglio alle prime 1.000 righe delle API per fogli.
- PDF testuali o scansionati e immagini PNG/JPEG/WebP/GIF/TIFF/HEIC: PDFKit e OCR Vision sul Mac. L’OCR può commettere errori di riconoscimento; non certifica il testo.
- OpenAI: classificazione del testo estratto e sintesi delle wiki. Una classificazione non utilizzabile ripiega sulla categoria ricerca; cliente/progetto vengono registrati solo se presenti nel testo. Le wiki sono sintesi generate, non fonti originali né verifiche umane.

Le note automatiche conservano `status: review`; l’app le rende utilizzabili da ricerca AI e MCP tramite il registro verificato, senza chiedere approvazioni per documento. Le altre bozze mantengono la politica di accesso precedente. La pubblicazione nel CRM resta un’operazione distinta ed esplicita.

## Eccezioni e limiti

LIMEN conserva gli originali e mostra il problema per file corrotti/protetti, formati sconosciuti, testo non riconoscibile o errori di accesso. Sono previsti al massimo tre tentativi per revisione; modificare il file riapre automaticamente il lavoro. Il comando di riprova serve solo dopo aver risolto un’eccezione. Errori di credenziale/modello interrompono il ciclo; la chiave resta nel Portachiavi macOS.

Limiti: 32 MB per file, PDF fino a 500 pagine, massimo 180 secondi per estrazione OCR, 16 MB di testo estratto Office/fogli. Il lavoro automatico richiede LIMEN aperta e un Vault caricato; la consultazione locale rimane disponibile senza servizi cloud. File binari non documentali e presentazioni legacy `.ppt` non sono dichiarati supportati.

## Stato di consegna

Lo stato di implementazione, le prove effettivamente eseguite e gli eventuali blocchi sono registrati in `TASK_LIST.md`; questo documento descrive il comportamento del codice, non attesta installazione o pubblicazione.
