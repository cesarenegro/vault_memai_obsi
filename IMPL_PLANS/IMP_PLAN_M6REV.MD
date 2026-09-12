# M6REV — AI interna e accesso esterno controllato al Vault

Data: 12 settembre 2026.
Stato: piano revisionato su richiesta dell’utente; implementazione M6 non avviata da questa revisione.
Percorso operativo: TASK_LIST.md, sezione M6. Questo documento sostituisce il precedente perimetro generico M6 OpenAI/Codex.

## 1. Obiettivo e perimetro

Permettere di interrogare lo stesso Vault da due punti di ingresso: Ask Knowledge dentro LIMEN e conversazioni esterne in ChatGPT Business/Codex. Entrambi devono usare ricerca, lettura e citazioni coerenti, rispettando gli stessi limiti di accesso.

M6 non è limitata alle API. Include l’integrazione API interna, un collegamento MCP per ChatGPT Business e l’accesso locale controllato da Codex. Le tre modalità sono criteri distinti da implementare e verificare; una modalità funzionante non prova le altre.

M6 riguarda consultazione e risposte AI. Salvataggio di output AI, creazione di proposte e promozione dei contenuti restano M7. Il compilatore deterministico M4 resta una funzione separata. L’accesso locale al Vault continua a funzionare senza AI, credenziali, rete o servizi esterni.

## 2. Stato di partenza verificato

- `packages/ai-engine/src/index.ts` contiene soltanto i contratti AI: provider `openai`, `codex`, `local_future`, opzione modello, domanda, fonti e risposta con citazioni.
- La checklist M6 precedente non specificava un collegamento ChatGPT Business/MCP.
- M4 è chiusa in locale; la ricerca M5 costituisce la dipendenza per il recupero del contesto. Verificare lo stato effettivo M5 prima dell’integrazione, senza dedurre il completamento dalla sola presenza dei file.
- Nessuna connessione all’account Business, credenziale API o disponibilità di modelli è stata verificata da questa revisione documentale.

## 3. Architettura proposta

| Canale | Esperienza utente | Implementazione prevista |
| --- | --- | --- |
| LIMEN / Ask Knowledge | Domanda nell’app, risposta con fonti consultabili | Provider OpenAI API, ricerca locale M5 e contesto selezionato |
| ChatGPT Business esterno | Conversazione ChatGPT che cerca e legge il Vault autorizzato | Servizio MCP LIMEN autenticato, strumenti di sola lettura e collegamento supportato dal workspace |
| Codex locale | Consultazione del Vault dal Mac usando Codex | Stesso servizio MCP locale e profilo di permessi limitato; nessun accesso in scrittura implicito |

Il servizio locale di accesso al Vault è la base comune: elenco dei Vault autorizzati, ricerca, lettura sicura, limiti e riferimenti alle fonti. Non esporre percorsi arbitrari del filesystem. I client usano un identificatore del Vault autorizzato e riferimenti relativi ai documenti.

Separare nei contratti il canale di accesso dal provider/modello: ChatGPT Business esterno è un client del servizio MCP, non una chiave API né un modello da inserire nell’enum dei provider.

## 4. Fasi di implementazione

### M6.1 — Contratti, ricerca e politica comune di accesso

- Estendere i contratti AI e definire richieste/risposte del servizio di ricerca e lettura condiviso.
- Basarsi sull’indice M5, con filtri per categoria, stato e fonti selezionate dall’utente.
- Usare per default conoscenza approvata; includere RAW e bozze solo mediante una scelta esplicita e mostrare il loro stato nelle citazioni.
- Escludere credenziali, file di configurazione sensibili, snapshot e directory non selezionate. Limitare dimensione dei documenti, numero di risultati e quantità di contesto.
- Riutilizzare gli accessi sicuri M2/M4: nessun traversal, symlink o file speciale; nessun tool generico di shell o scrittura.
- Ogni riferimento include ID del documento, percorso relativo, titolo, stato e hash/versione dei byte letti. Rilevare indice obsoleto o fonte modificata senza citare silenziosamente contenuti diversi.

### M6.2 — AI dentro LIMEN tramite API

- Implementare l’adapter OpenAI nel backend, con API supportata al momento dell’implementazione e modello configurabile realmente disponibile all’account.
- Conservare i segreti nel portachiavi del sistema operativo; non salvarli nel Vault, nel frontend, nei log o nei file versionati.
- Flusso: domanda → ricerca M5 → selezione del contesto entro i limiti → richiesta al modello → risposta con riferimenti verificati.
- Mostrare quali contenuti verranno inviati al provider; non inviare automaticamente l’intero Vault. I byte selezionati vengono elaborati dal servizio AI esterno: “Vault locale” non significa inferenza cloud senza trasferimento di dati.
- Gestire timeout, annullamento, limiti, modello non disponibile, credenziali mancanti e rete assente. Retry limitati soltanto per errori recuperabili.
- Verificare che le citazioni restituite appartengano alle fonti effettivamente fornite. Se mancano informazioni, dichiararlo; non costruire riferimenti inesistenti.
- Collegare Ask Knowledge preservando l’interfaccia approvata. Mostrare provider/modello effettivo e dati di utilizzo soltanto quando restituiti e verificabili.

### M6.3 — ChatGPT Business tramite MCP

- Implementare strumenti MCP di sola lettura, per esempio `list_vaults`, `search_vault` e `read_document`; nomi e schema finali saranno definiti nei contratti.
- Collegare gli strumenti allo stesso servizio locale utilizzato da LIMEN, con autenticazione, autorizzazioni per Vault e revoca della sessione.
- Verificare nel workspace Business pertinente disponibilità del collegamento, regole amministrative, identità e modalità di trasporto supportate. Non presumerle dal solo abbonamento.
- Valutare prima il collegamento privato supportato, incluso Secure MCP Tunnel dove disponibile. La documentazione consultata lo descrive per collegare server privati in modalità sviluppatore; non equipararlo automaticamente a una distribuzione gestita di produzione.
- Se occorre un endpoint HTTPS, preparare un piano di esposizione autenticata e una destinazione concreta. La presente revisione non autorizza deploy pubblici, apertura del filesystem o pubblicazione di dati.
- Il Vault resta sul Mac; il collegamento inoltra soltanto i risultati e i documenti autorizzati richiesti dal client. Quando il Mac o il collegamento non sono disponibili, ChatGPT deve ricevere un errore esplicito.
- Non utilizzare caricamenti manuali di copie del Vault come prova dell’integrazione live. Eventuali export restano un flusso distinto.
- Documentare connessione, disconnessione e revoca dopo aver verificato l’interfaccia effettiva del workspace; niente percorsi UI inventati.

### M6.4 — Codex locale

- Configurare l’accesso al medesimo servizio MCP attraverso un trasporto locale supportato.
- Usare autenticazione ufficiale Codex: accesso ChatGPT oppure API secondo la configurazione scelta e le disponibilità effettive. Non leggere, estrarre o riutilizzare token privati del client per effettuare chiamate API LIMEN.
- Applicare un profilo di permessi che non conceda scrittura al Vault durante il flusso di consultazione M6.
- Un eventuale accesso diretto alla cartella è un’alternativa da documentare e testare con permessi equivalenti; non è una scorciatoia per aggirare le restrizioni MCP.
- Nessuna incorporazione automatica del runtime Codex nell’app: se necessaria in futuro, definirla come integrazione separata con prerequisiti e distribuzione verificati.

### M6.5 — Protezioni condivise e confine M7

- Trattare documenti, risultati di ricerca e istruzioni incorporate nelle fonti come dati non attendibili, non come autorizzazioni operative.
- Verificare isolamento tra Vault, identità e client; accesso negato deve essere un esito reale, non un filtro solo nell’interfaccia.
- Registrare metadati minimi delle operazioni, evitando contenuti integrali e segreti nei log. Rendere visibile il collegamento esterno attivo e permetterne la revoca.
- Tutti gli strumenti M6 sono di sola lettura. Nessun comando di approvazione, sovrascrittura, cancellazione o salvataggio AI viene esposto in questa milestone.
- In M7, le scritture AI saranno indirizzate a output/proposte con revisioni e approvazione umana; mai direttamente alle fonti RAW o alla conoscenza approvata.

## 5. Componenti interessati

- `packages/ai-engine`: contratti, adapter API, selezione contesto e validazione citazioni.
- `packages/search-engine`: riuso della ricerca M5 e riferimenti stabili; niente duplicazione del motore.
- `apps/desktop/src-tauri`: configurazione sicura, accesso al portachiavi, servizio locale e IPC; nessun requisito Node aggiuntivo per le normali funzioni del bundle distribuito.
- `apps/desktop/src`: Ask Knowledge, stato/configurazione dei collegamenti e apertura delle fonti citate.
- Servizio MCP: collocazione e packaging da definire in M6.1; eventuale processo ausiliario deve essere dichiarato e distribuito esplicitamente, non dipendere dal checkout di sviluppo.
- Test, script di verifica e documentazione: aggiunte pertinenti alla milestone. `local_future` resta predisposizione; l’inferenza con modelli locali non è un criterio M6REV.

## 6. Verifiche e criteri di accettazione

### Automatiche

- Test di selezione contesto, filtri, limiti, citazioni, dati insufficienti e annullamento; mock soltanto per i casi unitari, identificati come tali.
- Test filesystem di sola lettura, traversal, symlink, file speciali e hash dei byte effettivamente utilizzati.
- Test MCP: autenticazione assente/non valida/revocata, Vault non autorizzato, richieste malformate, limiti e assenza di strumenti di scrittura.
- Test di contenuti ostili nelle fonti: nessuna espansione di permessi o modifica di dati.
- Regressioni M2–M5 pertinenti. Sul checkout finale: `pnpm test`, `pnpm typecheck`, `pnpm build`, test Rust e build Tauri.

### End-to-end reali, distinti per canale

1. **LIMEN/API:** domanda dal bundle distribuito, chiamata reale con credenziale autorizzata, risposta e citazioni aperte sui documenti corretti. Testare anche provider indisponibile.
2. **ChatGPT Business:** conversazione reale nel workspace pertinente → strumenti MCP → ricerca/lettura del Vault di fixture → risposta con fonti. Testare revoca e collegamento interrotto.
3. **Codex locale:** accesso al Vault di fixture tramite integrazione scelta, ricerca/lettura e risposte con riferimenti; tentativi di scrittura negati dal profilo o dal servizio.
4. **Coerenza:** gli stessi ID/query/filtri recuperano le stesse fonti/versioni attraverso i tre canali. Non richiedere risposte testuali identiche da modelli non deterministici.
5. **Integrità:** confrontare hash delle fonti e pagine prima/dopo le prove. Nessuna scrittura AI nel Vault durante M6.
6. **Indipendenza:** disattivare rete e collegamenti AI; apertura Vault, lettura, ricerca M5 e snapshot continuano a funzionare. Il collegamento esterno al Mac spento non deve essere dichiarato disponibile.

M6 è completa soltanto dopo il superamento dei criteri dei tre canali e delle verifiche comuni. Se manca un accesso Business, una credenziale o un permesso, registrare il criterio specifico come bloccato e procedere con gli altri; non sostituire l’E2E reale con un mock né segnare chiusa l’intera milestone.

## 7. Dipendenze e ordine operativo

1. Verificare baseline M5 e definire servizio comune/contratti e politica delle fonti.
2. Implementare servizio locale di sola lettura e relativi test.
3. Implementare adapter API e Ask Knowledge.
4. Implementare MCP e verificare i collegamenti ChatGPT Business e Codex locale.
5. Eseguire E2E reali, regressioni e build finale; aggiornare checklist, limiti e handover.
6. Passare a M7 per le scritture AI governate.

Prerequisiti da ottenere quando necessari: accesso API e modello, accesso al workspace Business per verificare policy e connessione, sessione Codex autorizzata. Abbonamento ChatGPT/Codex e utilizzo API sono percorsi distinti: non assumere che una chiave API sia inclusa nell’abbonamento o che la stessa identità dia gli stessi permessi.

## 8. Fonti ufficiali e limiti della revisione

Documentazione consultata nella discussione precedente:
- [Collegamento e test MCP/ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt): endpoint HTTPS o Secure MCP Tunnel; disponibilità della modalità sviluppatore dipendente da account/policy.
- [Autenticazione Codex](https://learn.chatgpt.com/docs/auth): accesso ChatGPT o API e controlli applicabili.

Verificare nuovamente disponibilità, SDK/API e modalità di distribuzione al momento dell’implementazione. Nessuna interfaccia del workspace Business è stata ispezionata per questo piano. Questa consegna modifica soltanto documentazione: nessun codice M6 eseguito, nessuna connessione attivata, nessuna credenziale letta e nessun deploy.
