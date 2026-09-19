# Automazione della conoscenza — piano precedente

Stato: riferimento storico dell’implementazione iniziale. Per il lavoro corrente di AG prevalgono `IMPL_PLANS/IMP_PLAN_MEMORIA_AZIENDALE_UI_UX.MD` e `TASK_LIST.md`, che separano estrazione/indice locale dall’API e ridefiniscono UI e affidabilità. Non seguire questo piano come checklist della nuova consegna.

Obiettivo richiesto: l’utente carica soltanto file grezzi. LIMEN converte in Markdown, normalizza, classifica, archivia, collega, indicizza per RAG e genera/aggiorna wiki senza approvazioni per documento. Una sola configurazione del provider; nessuna richiesta di conversione/suddivisione manuale.

Runtime Rust nativo, registro persistente nel Vault e lock di processo. Scansione ogni 15 secondi mentre il Vault è aperto, ripresa all’avvio, massimo tre tentativi per revisione. Errori di credenziale/modello interrompono subito le chiamate. Originali e revisioni conservati; i documenti automatici hanno status review e sono abilitati al retrieval solo tramite registro e hash delle dipendenze. Nessuna approvazione umana fittizia, nessuna pubblicazione CRM automatica.

Conversione deterministica: Markdown/TXT/HTML/CSV/TSV/JSON/XML/YAML/EML; UTF-8/UTF-16. DOCX/PPTX/ODT letti direttamente dagli archivi XML, DOC/RTF tramite textutil macOS. XLS/XLSX/XLSB/ODS tramite calamine, comprese righe oltre la millesima e formule. PDF tramite PDFKit, OCR di pagine e immagini tramite Vision integrato nel bundle (nessun compilatore richiesto sul Mac utente). OCR delle immagini incorporate Office. Non usare LLM per inventare il testo originale: il collaudo ha dimostrato allucinazioni con la conversione generativa, rimossa.

OpenAI Responses API solo per classificazione e sintesi wiki. Categoria di ripiego research se classificazione invalida, cliente/progetto solo se riscontrati nel testo. Pagine wiki per categoria e contesto cliente/progetto, sezioni con citazioni validate e invalidazione delle dipendenze. Note lunghe divise automaticamente; pagina indice collega le parti. Recupero ricerca e AI/MCP nativi e TypeScript allineati.

Limiti espliciti: 32 MB per import, PDF fino a 500 pagine, OCR fino a 180 secondi per documento, estrazione Office/fogli fino a 16 MB di testo; formati ignoti, file protetti/corrotti e immagini senza testo vengono segnalati. Non dichiarare supporto universale a ogni formato binario. Nessun software desktop OCR da installare a parte su macOS supportato.

Verifiche: fixture sintetiche Word, PDF testuale/scansionato, immagine, PPTX e XLSX da 1201 righe; test originali invariati, idempotenza, revisioni, eliminazioni, citazioni inesistenti, modifiche umane, lock, limiti tentativi. Test di conversione reali distinti da provider simulato. Collaudo API reale con medesime fixture, suite pnpm in sequenza, Rust, build Tauri e UI. Task list: `TASK_LIST.md`.
