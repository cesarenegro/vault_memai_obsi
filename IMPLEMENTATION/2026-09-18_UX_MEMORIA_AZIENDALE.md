# LIMEN Vault — analisi del codice e proposta UI/UX della memoria aziendale

Data: 18 settembre 2026. Obiettivo confermato: acquisire documenti grezzi, conservarli, renderli consultabili e ricercabili, organizzare automaticamente la memoria aziendale. L’affidabilità della consultazione viene prima della generazione di sintesi.

## Perimetro e stato reale

Analisi diretta di App.tsx, AutomationPanel, AiPanel, KnowledgePanel, ProposalPanel, comandi Tauri, automation.rs, extraction.rs, compiler.rs, search.rs, ai.rs, knowledge.rs e snapshots.rs. Inventario in sola lettura del Vault reale: `2026-09-18_UX_INVENTORY.json`. Nessun documento reale inviato a un provider durante questo audit.

Distinzione necessaria:
- App aperta verificata: candidato con nome v3 corretto, precedente alle correzioni contatore/modelli.
- Sorgenti locali: includono correzioni in lavorazione a nome, pulsante lime, inventario, messaggi, elenco modelli e vista globale delle note. Queste ultime non sono una consegna completa né collaudata end-to-end. Typecheck desktop PASS; test Rust, build finale e notarizzazione delle ultime correzioni ancora da eseguire.
- Nuova UI/UX descritta sotto: progetto proposto sulla base del codice, non dichiarato già implementato. Non sono previste consegne intermedie per le singole correzioni.

Inventario reale rilevato:
- 56 file originali in `20_RAW_SOURCES`.
- Configurazione e registro dell’automazione assenti: nessun ciclo automatico avviato in questo Vault.
- Una nota Markdown in `07_CASE_STUDIES`; nessuna nelle altre nove categorie.
- Indice: 58 documenti, 57 proposte e una nota con stato approved; nessun documento automatico.
- La precedente schermata mostrava 27 file caricati nell’ultima selezione: non era il totale del Vault.

Questi dati spiegano il problema osservato senza presumere perdita dei file. Non dimostrano che ogni possibile domanda avrebbe zero risultati: il testo della domanda e la pertinenza della singola nota approvata non sono stati verificati.

## Diagnosi

La navigazione rappresenta la struttura tecnica del progetto invece delle attività dell’utente. Le dodici destinazioni di App.tsx:412 comprendono anche compilazione, proposte, copie, sistema e milestone M3/M6/M10. Due pipeline parallele producono artefatti differenti, con criteri di visibilità diversi e aggiornamenti separati.

### 1. Due percorsi di acquisizione producono risultati diversi

Evidenze: `App.tsx:988`, `compiler.rs:271`, `automation.rs:527`.

Il pulsante di caricamento copia gli originali. Il compilatore manuale tratta MD/TXT/HTML e crea bozze in 90_PROPOSALS. L’automazione, solo se attivata, converte altri formati, classifica e crea note/wiki nelle categorie. Nella stessa schermata, COMPILA TUTTE LE FONTI invita a un percorso che non rende automaticamente i documenti utilizzabili dall’AI.

Decisione proposta: una sola acquisizione ordinaria. Il compilatore manuale resta disponibile come strumento avanzato di compatibilità; le proposte esistenti vengono conservate, senza promuoverle tutte implicitamente ad approvate.

### 2. Caricato, elaborato, indicizzato e consultabile non coincidono

Evidenze: `AutomationPanel.tsx:10`, `App.tsx:76`, `App.tsx:314`, `KnowledgePanel.tsx:8`.

Il vecchio 0/0 usava i job, non i file RAW. I contatori della panoramica, la tabella manuale, la coda, la conoscenza e la ricerca hanno stati distinti. Il caricamento aggiorna l’automazione, ma non aggiorna direttamente tutti gli altri elenchi. Conoscenza rilegge al montaggio/cambio categoria/AGGIORNA; la ricerca reagisce ai filtri e alla propria revisione, non alla conclusione di un job automatico.

Decisione proposta: inventario unico per documento, con revisioni ed eventi dal motore nativo. Le schermate sono viste dello stesso inventario; un file non deve comparire caricato in una vista e inesistente in un’altra.

### 3. L’elaborazione locale dipende inutilmente dall’API

Evidenza: in `automation.rs:587` il controllo provider_ready precede l’estrazione. La scrittura delle note è successiva alla classificazione AI.

Anche quando conversione e OCR sono locali, senza chiave l’intero documento resta in attesa. Un errore della classificazione impedisce la pubblicazione della nota estratta in quel tentativo.

Decisione proposta: separare salvataggio, estrazione e indice locale da classificazione e wiki. Un documento estratto deve diventare cercabile prima della sintesi. Senza AI resta in una raccolta non classificata e conserva la consultazione locale. File cifrati, corrotti o formati non supportati devono essere conservati e apribili nell’app associata, con un motivo esplicito della mancata estrazione; non dichiararli ricercabili.

### 4. L’AI può non vedere risultati che la ricerca mostra

Evidenze: `ai.rs:17`, `ai.rs:29`, inventario reale.

La ricerca comprende le proposte; l’AI normalmente ammette note approvate e artefatti automatici correnti. Le bozze richiedono una scelta esplicita. Il Vault reale ha 57 proposte su 58 documenti indicizzati: la differenza tra ricerca e risposta è quindi sostanziale.

Inoltre la selezione AI prende i primi 50 risultati PRIMA del filtro di ammissibilità. Se le proposte occupano i primi 50 posti, una fonte ammessa successiva non viene considerata. È un rischio dedotto dal codice, non un caso già misurato sul Vault reale.

Decisione proposta: filtrare i documenti ammessi prima del ranking finale e del limite; distinguere estrazione fedele, sintesi automatica e approvazione editoriale. Non rendere tutte le proposte affidabili modificando soltanto un flag.

### 5. Ricerca lessicale, senza retrieval semantico o selezione RAG/wiki

Evidenze: `search.rs:253`, `search.rs:498`, `ai.rs:29`.

Il motore tokenizza, normalizza e assegna TF×IDF con bonus titolo/tag. Non sono presenti embeddings, sinonimi di dominio, reranking o un selettore dedicato fra fonti e wiki. La domanda intera viene usata come query lessicale. Una ricerca ben formulata può funzionare; equivalenze semantiche senza parole comuni non sono garantite.

Decisione proposta: retrieval ibrido. Ricerca lessicale per termini esatti, nomi e codici; ricerca semantica per parafrasi; fusione e reranking dei passaggi. La ricerca lessicale deve continuare offline. La disponibilità semantica e il suo stato devono essere verificabili, senza azzerare la ricerca locale se il provider è indisponibile.

Le fonti originali/estratte sono evidenza primaria. Le wiki aiutano domande di sintesi e orientamento e devono riportare ai passaggi originali. Nessuna scelta RAG/wiki richiesta all’utente. Conflitti e insufficienza delle fonti devono emergere nella risposta.

### 6. Il contesto AI può scartare un documento rilevante intero

Evidenza: `ai.rs:29` seleziona al massimo dieci fonti e usa 16.000 byte di contesto. Se una fonte supera il budget residuo, viene saltata integralmente.

L’automazione crea parti di circa 6.000 byte (`automation.rs:379`), ma le note manuali lunghe non sono necessariamente spezzate. La divisione automatica segue i byte UTF-8 senza segmentazione per sezioni né sovrapposizione.

Decisione proposta: indicizzare e selezionare passaggi con confini di sezione/paragrafo, origine e revisione; assemblare il contesto dai passaggi pertinenti, senza perdere un documento solo perché lungo. Deduplicare note/parti/wiki derivate dalla medesima evidenza.

### 7. Un indice formalmente pronto può essere obsoleto

Evidenze: `search.rs:159`, `search.rs:581`.

Lo stato ready controlla la versione del formato, non la freschezza di tutti i file. Durante la ricerca un documento corrispondente modificato può causare un errore che interrompe la query. Nuovi file manuali non ancora indicizzati non vengono individuati dal solo controllo di versione dell’indice. L’indicizzazione automatica è legata al ciclo di automazione e alle sue modifiche, non a un rilevamento universale di ogni nota cambiata.

Decisione proposta: rilevamento modifiche con riconciliazione al riavvio, indicizzazione incrementale e versionata. Durante l’aggiornamento restituire risultati ancora validi ed escludere gli elementi obsoleti con stato parziale esplicito; mai presentarli come aggiornati. La risposta deve usare la stessa revisione mostrata dalla citazione.

### 8. Trovare un risultato oggi non consente di consultarlo

Evidenza: `App.tsx:1202` renderizza div con titolo, percorso, punteggio e snippet; manca un’azione di apertura. Gli snippet non evidenziano la ricerca.

Decisione proposta: risultato cliccabile e accessibile da tastiera; dettaglio laterale con testo leggibile, termini evidenziati, origine e posizione. Apertura originale, testo estratto e sintesi sono viste dello stesso documento. Evidenziazione coerente con normalizzazione degli accenti e token del motore, non semplice sostituzione HTML non sicura. Per corrispondenze solo semantiche mostrare il passaggio pertinente, senza fingere che la parola esatta sia presente.

### 9. Conoscenza è un lettore di cartelle, non una memoria unificata

Evidenze: `KnowledgePanel.tsx:8`, `knowledge.rs:14`.

La versione aperta partiva dalla categoria Clienti. Il pannello mostra Markdown grezzo, percorsi e hash. Il lettore fisico delle cartelle non applica la stessa esclusione delle revisioni automatiche obsolete usata dal retrieval: le vecchie versioni preservate possono rimanere visibili come normali note. La vista globale introdotta nei sorgenti locali è solo una correzione parziale, non risolve questo modello.

Decisione proposta: Memoria raccoglie argomenti, clienti, progetti e sintesi; ricerca globale come default, categorie come filtri. Versioni superate accessibili nella cronologia, escluse dalla vista corrente. Markdown, hash e cartelle nei dettagli tecnici. Il testo viene presentato in modo leggibile, con collegamenti effettivamente apribili.

### 10. Gli errori richiedono troppo intervento tecnico

Evidenze: `automation.rs:456`, `automation.rs:690`, `AutomationPanel.tsx:13`; precedente prova in `V3_EVIDENCE/live-ui-api.json`.

La coda limita i tentativi; il collaudo precedente ha realmente fermato una wiki dopo tre tentativi, ultimo HTTP 429. Mancano in quel flusso un’attesa specifica per 429 e una distinzione completa tra problemi temporanei, credenziali e contenuti. Il timer frontend si interrompe dopo tre errori consecutivi. Ogni batch ha al massimo tre chiamate provider e tratta prima le fonti: le wiki possono attendere mentre continua l’ingresso di fonti.

Decisione proposta: coda nativa persistente con priorità e progressi per fase; backoff per errori temporanei, arresto esplicito su prerequisiti mancanti, limite di tentativi senza loop. Riavvio riprende solo lavori incompleti. Un solo avviso utile con causa, documenti interessati e azione risolutiva. Non riprovare il residuo reale già fermato tre volte senza risolvere la causa.

### 11. Copie e integrità sono utili, ma esposte in modo fuorviante

Evidenze: `snapshots.rs:239`, `snapshots.rs:362`, `App.tsx:139`, `HELP/03_HELP_SCHERMATE.md:147`.

Le copie sono directory locali con manifesto e verifica degli hash. Non c’è un pulsante di ripristino del Vault. Il confronto del Vault vivo con un manifesto registra aggiunte e modifiche ordinarie come differenze; App.tsx traduce un esito non valido senza errori nel valore corrupted. Una modifica intenzionale non equivale a corruzione.

Decisione proposta: distinguere «modifiche dalla copia», «copia verificata» e «errore di integrità». Copie automatiche con retention e controllo spazio; recupero guidato con anteprima, inizialmente in cartella separata per proteggere il Vault corrente. Backup su altro dispositivo opzionale, chiaramente distinto dalle copie sullo stesso disco.

### 12. Configurazione ripetuta, esposizione tecnica e stato non persistente della domanda

Evidenze: `AiPanel.tsx:8`, `AiPanel.tsx:14`, `AutomationPanel.tsx:27`, `App.tsx:67`.

Il modello era testo libero separato per automazione e domanda; nessuna richiesta all’elenco modelli nella versione aperta. La risposta/domanda sono stato del componente: cambiare scheda smonta il pannello e perde quella sessione se non salvata come bozza. Preview e invio sono due azioni distinte. L’avvio presenta di nuovo il percorso del Vault invece di un accesso ordinario già configurato.

Decisione proposta: configurazione iniziale unica, modello di testo compatibile verificato e preferenza condivisa. Non basta mostrare indistintamente tutti i modelli restituiti dall’account: la correzione locale ModelPicker richiede ancora la selezione delle capacità appropriate. Impostazione avanzata per scegliere un modello specifico. Domande e risposte persistenti con fonti/versioni; conservazione configurabile. Dopo una configurazione esplicita dell’uso AI, una sola azione per chiedere; anteprima obbligatoria opzionale per chi la desidera.

L’elenco account usa l’endpoint ufficiale OpenAI `/v1/models`: https://developers.openai.com/api/reference/resources/models/methods/list. La lista non dimostra, da sola, compatibilità con output strutturati o disponibilità effettiva al momento della richiesta.

## UI/UX proposta: tre aree quotidiane

| Area | Attività dell’utente | Comportamento del sistema |
|---|---|---|
| Chiedi | Scrive una domanda o cerca un termine | Mostra risposte con citazioni e documenti/passaggi; risultati apribili; cronologia persistente |
| Documenti | Carica o trascina originali, consulta un documento | Salva subito, estrae, indicizza, organizza; mostra tutti i formati e uno stato chiaro per ogni originale |
| Memoria | Esplora argomenti, clienti, progetti e sintesi | Raggruppa la conoscenza corrente, collega prove e wiki, conserva le versioni nella cronologia |

Pulsante globale **CARICA DOCUMENTI** verde lime, testo nero, sempre visibile. Nessun obbligo di conoscere RAW, Markdown, RAG, wiki LLM o i nomi delle cartelle per usarlo.

Una ricerca nella stessa area Chiedi può mostrare due viste comprensibili: «Risposta» e «Documenti». La ricerca locale non deve attivare implicitamente una richiesta AI a pagamento. L’azione «Chiedi» avvia la risposta; cercare nei documenti resta locale. Filtri per cliente, progetto, periodo e tipo sono secondari.

Impostazioni e Aiuto restano accessibili in posizione secondaria. Connessioni CRM/MCP, diagnostica e strumenti manuali in Avanzate. Copie e recupero sotto Protezione della memoria; non eliminare le funzioni che proteggono i dati, ridurne il peso nel percorso ordinario.

### Documento come unità stabile

Ogni originale ha una scheda unica: nome leggibile, tipo, data, origine, stato, testo estratto, collegamenti, sintesi, revisioni. Le parti tecniche non moltiplicano inutilmente il numero dei «documenti» mostrati. Più caricamenti dello stesso contenuto sono riconosciuti: il codice attuale deduplica contenuto+nome, quindi uno stesso file rinominato può creare un’altra sorgente.

Stati visibili: «Salvato», «In elaborazione», «Consultabile», «Richiede attenzione». La wiki può essere «In aggiornamento» senza togliere la consultazione del documento. Contatori calcolati su originali, non sul numero di frammenti o job.

Nel caso reale, prima della configurazione: **56 originali salvati · automazione non configurata**. Lo stato della singola nota già approvata e delle 57 proposte deve restare distinto; non convertirli artificiosamente in 56 documenti pronti.

### Percorso operativo unico

1. Prima apertura: selezione/creazione della memoria e configurazione AI guidata una volta. Stato connessione verificato; impostazioni tecniche secondarie.
2. Caricamento: ricevuta immediata con elenco di riusciti, duplicati e rifiutati. Salvataggio dell’originale indipendente dall’API.
3. Conversione/OCR e indicizzazione locale: il documento diventa consultabile e ricercabile appena pronto il testo.
4. Classificazione e arricchimento: metadati e collegamenti aggiornati automaticamente; se incerti restano correggibili senza bloccare tutto.
5. Wiki: sintesi asincrone con citazioni e revisioni; aggiornamento dell’indice quando cambiano.
6. Consultazione: ricerca/documento/citazione aprono la stessa revisione. Problemi isolati non azzerano tutta la memoria.

## Affidabilità: condizioni verificabili di accettazione

Non promettere che ogni domanda avrà una risposta: documenti illeggibili, dati mancanti e formulazioni ambigue esistono. Imporre invece che il sistema non perda documenti, non nasconda lo stato e non presenti una ricerca incompleta come completa.

- Ogni importazione riuscita ha originale verificabile e scheda apribile; salvataggi falliti dichiarati singolarmente. Nessun 0/0 con originali presenti.
- PDF, scansioni, DOCX, PPTX, fogli e testi del corpus di prova sono consultabili; contenuti oltre i primi fogli/pagine inclusi. File protetti/non supportati mostrano causa e originale accessibile.
- Termini esatti/codici e contenuti a inizio, centro e fine di documenti lunghi ritrovati nel corpus controllato. Target di accettazione: 100% dei casi deterministici del corpus, non promessa universale su qualunque dato.
- Parafrasi e sinonimi di settore valutati su domande annotate con passaggi attesi. Misurare Recall@10 e pertinenza, separatamente per ricerca lessicale e ibrida; soglia da fissare con un corpus aziendale rappresentativo, senza inventare una percentuale «garantita».
- Ogni citazione si apre sul passaggio e sulla revisione effettivamente usati. Revisioni obsolete non entrano nella risposta corrente. Nessuna citazione a file inesistenti o inventati.
- Caricamenti concorrenti, duplicati, modifiche e rinomina non producono perdita o doppie elaborazioni incontrollate. Ripresa dopo chiusura/crash collaudata.
- Senza API funzionano archivio, apertura, conversione supportata e ricerca locale. Classificazione/wiki/risposta dichiarano l’attesa senza bloccare la consultazione.
- Un file cambiato o difettoso non cancella i risultati validi degli altri. Stato «aggiornamento in corso» o «ricerca parziale» esplicito e recuperabile.
- Test con quota API esaurita, 429, credenziali errate e rete assente: niente loop; originale intatto; azione correttiva comprensibile.
- I progressi sono identici fra Documenti, Memoria e Chiedi; nessun pulsante manuale di reindicizzazione necessario nel normale uso.
- Backup verificato e prova reale di recupero in una cartella separata. Non chiamare «backup completo» una sola copia sullo stesso disco.
- Prestazioni misurate su volumi crescenti e documenti lunghi. Il codice attuale rilegge registro e dipendenze per verificare singoli risultati automatici (`search.rs:535`, `automation.rs:259`): rischio di costo crescente da profilare, non benchmark già eseguito.

## Intervento tecnico coerente con una consegna unica

Conservare estrattori nativi, originali immutati, scritture atomiche, protezione da symlink, provenienza/hash, Portachiavi e validazione delle citazioni. Sono basi utili già presenti.

Unificare invece inventario/documento/revisione, coda nativa, eventi di aggiornamento, lettore del documento e servizio di retrieval. La UI a tre aree deve consumare questi servizi, non coordinare personalmente decine di operazioni IPC indipendenti. L’app chiusa realmente non esegue il timer corrente; il requisito di esecuzione continua a finestra chiusa richiede una scelta esplicita di ciclo di vita dell’app, non una promessa basata sul polling React.

Ordine di dipendenza interno, senza rilasci parziali: modello documento e coda → consultazione e indice affidabile → retrieval/citazioni → UI semplificata → migrazione conservativa dei dati esistenti → prove end-to-end → unica build Tauri firmata/notarizzata. Nessuna migrazione distruttiva dei 56 originali o approvazione massiva delle proposte durante l’audit.

## Limiti dell’analisi

È stata verificata l’implementazione e letto l’inventario reale. Non sono stati eseguiti un benchmark semantico, un nuovo batch AI sui documenti aziendali o una simulazione di crash in questa analisi. Le nuove correzioni locali hanno superato il typecheck desktop, ma non l’intero collaudo di rilascio. Il precedente residuo HTTP 429 resta aperto. Il redesign non è ancora implementato né consegnato.
