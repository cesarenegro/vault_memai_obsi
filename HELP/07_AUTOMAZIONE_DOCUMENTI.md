# Documenti e wiki automatiche — v3

Torna all’indice: [[00_INDICE]]

### Configurazione iniziale

Apri **Impostazioni**, salva la chiave API OpenAI e verifica il Portachiavi. In **Fonti → Configurazione dell’automazione** indica un modello API disponibile nel tuo account e premi **ATTIVA AUTOMAZIONE**. L’attivazione autorizza l’invio automatico del testo estratto a OpenAI per classificazione e sintesi wiki, con consumo API. La chiave resta nel Portachiavi del Mac.

### Uso quotidiano: carica soltanto gli originali

1. Apri il Vault e vai in **Fonti**.
2. Premi **CARICA DOCUMENTI** e seleziona uno o più file nel selettore macOS. In alternativa depositali in `20_RAW_SOURCES`.
3. Lascia LIMEN aperta: controlla nuovi file e modifiche ogni 15 secondi, elabora la coda e aggiorna la ricerca. Puoi usare le altre sezioni durante il lavoro.
4. In **Avanzamento e documenti** trovi stato, errori e destinazione delle note. Consulta i risultati in **Conoscenza**, **Ricerca** e **Chiedi al Vault**.

Non servono conversione in Markdown, scelta della cartella, compilazione o approvazione manuali per ciascun documento. Chiudendo l’app il lavoro si interrompe; riaprendo lo stesso Vault riprende dalla coda salvata. Dopo **METTI IN PAUSA** non partono nuovi cicli automatici.

### Dove vengono salvati i risultati

| Contenuto | Destinazione |
| --- | --- |
| Originali integri | `20_RAW_SOURCES/` |
| Note estratte e normalizzate | Cartella pertinente da `01_CLIENTS` a `09_COMPETITORS` |
| Wiki tematiche con citazioni | Stesse categorie, raggruppate per cliente e progetto |
| Registro elaborazioni e indice | `00_SYSTEM/` |

Sono veri file `.md`, leggibili in Obsidian. I prefissi `auto-source-` e `auto-wiki-` distinguono note e wiki; il titolo leggibile compare nelle proprietà e nell’app. Cliente e progetto sono proprietà delle note: LIMEN non crea automaticamente sottocartelle per ciascuno. Se non riesce a classificare un documento usa la categoria Ricerca; i riferimenti cliente/progetto vengono accettati solo se compaiono nel testo e non sono automaticamente identificativi CRM.

I documenti lunghi vengono divisi in parti collegate da una nota indice. Note e wiki mantengono riferimenti alle fonti. Se una fonte cambia o scompare, le versioni precedenti vengono escluse dal retrieval; i file rimangono conservati. Una modifica manuale a una nota generata viene preservata e segnalata, non sovrascritta.

### Formati, privacy e limiti

- PDF testuali o scansionati; immagini PNG, JPEG, WebP, GIF, TIFF e HEIC: estrazione/OCR sul Mac.
- Word DOC/DOCX, ODT/RTF, presentazioni PPTX: estrazione sul Mac, comprese le immagini Office supportate per OCR.
- Fogli XLS/XLSX/XLSB/ODS: celle e formule estratte localmente.
- Markdown, TXT, HTML, CSV/TSV, JSON, XML, YAML ed EML: lettura locale del testo.
- OpenAI riceve il testo estratto per classificare e generare wiki. L’OCR può sbagliare caratteri; le wiki sono sintesi AI, non certificazioni umane.

Massimo 32 MB per file, PDF fino a 500 pagine, timeout OCR 180 secondi e limite del testo estratto 16 MB per Office/fogli/PDF. File corrotti o protetti, formati sconosciuti e presentazioni legacy `.ppt` vengono segnalati; non si dichiara il supporto a qualsiasi file binario.

Le note automatiche conservano `status: review` ma sono consultabili dall’AI e dai collegamenti MCP quando il registro conferma che sono aggiornate. Sono distinguibili dalle note approvate da una persona. Le altre bozze richiedono ancora l’opzione di inclusione. La pubblicazione CRM resta esplicita e richiede note approvate.

### Errori e ripresa

La coda e gli originali rimangono nel Vault se manca la connessione o la chiave. Dopo tre tentativi per revisione LIMEN interrompe i tentativi su quel documento; dopo aver risolto la causa usa **RIPROVA LE ECCEZIONI RISOLTE**. Errori di accesso API o modello mettono in pausa l’automazione: correggi la configurazione e riattivala. Non cancellare registri o note per nascondere un errore.

### Compilazione manuale facoltativa

La tabella manuale sottostante gestisce Markdown, testo e HTML. **Compila bozza** e **COMPILA TUTTE LE FONTI** creano bozze in `90_PROPOSALS` per il percorso **Proposte**. L’assenza di PDF o Word in quella tabella non significa che il caricamento automatico sia fallito: consulta **Avanzamento e documenti**.

### Ricerca ibrida, semantica e verifica di integrità

1. **Ricerca Ibrida**: combina ranking lessicale (TF-IDF con filtri strict di categoria, cliente, progetto, stato e tag) e retrieval semantico vettoriale generato sui passaggi estratti. Senza connessione internet o senza chiave API, la ricerca prosegue in modalità lessicale locale senza alcun blocco.
2. **Portachiavi nativo**: la chiave API OpenAI viene letta direttamente dal Portachiavi macOS nel backend nativo; non vi è alcun passaggio o persistenza della chiave nel frontend durante le ricerche o la sincronizzazione semantica.
3. **Lettore documenti verificato**: aprendo un documento o cliccando una citazione, il motore verifica SHA-256 dei byte su disco, coerenza della revisione e integrità del testo del passaggio. Se il documento originale o un passaggio sono stati alterati, o se la citazione fa riferimento a una revisione precedente, viene mostrato un banner di allerta chiaro.
4. **Accesso diretto e senza limiti**: il lettore risolve i percorsi in modo canonico e diretto per ID o percorso univoco, eliminando ogni vincolo di paginazione sui primi 50 documenti.

