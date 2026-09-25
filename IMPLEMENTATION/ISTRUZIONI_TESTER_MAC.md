# Guida per i Tester Esterni — LIMEN Vault V5 (macOS)

Benvenuto nel programma di collaudo di **LIMEN Vault V5** (versione 0.5.0).  
LIMEN Vault è l'applicazione desktop pensata per la gestione e consultazione sicura della memoria aziendale, integrando ricerca semantica vettoriale locale e generazione avanzata di risposte aumentate dai documenti.

---

## 1. Requisiti di Sistema

- **Computer**: Mac con processore Apple Silicon (chip **M1, M2, M3, M4** o successivi).
- **Sistema Operativo**: **macOS 26.0** o versioni successive.
- **Connessione Internet**: Necessaria per il primo avvio (download del modello di ricerca) e per la consultazione tramite modello linguistico OpenAI.
- **Chiave API OpenAI**: Una chiave API personale OpenAI con accesso ai modelli standard (es. `gpt-4o`).

---

## 2. Installazione dell'Applicazione

1. Fai doppio clic sul file di installazione scaricato:  
   `LIMEN-Vault-V5-0.5.0-arm64.dmg`.
2. Nella finestra visualizzata, trascina l'icona di **LIMEN Vault V5** nella cartella **Applicazioni**.
3. Apri la cartella **Applicazioni** ed esegui **LIMEN Vault V5**:
   - L'applicazione è ufficialmente **firmata con Developer ID e autenticata da Apple (Notarized)**: si aprirà direttamente al primo avvio senza blocchi di Gatekeeper.

---

## 3. Primo Avvio e Configurazione Iniziale

### A. Apertura o Creazione di un Vault
- Al primo avvio vedrai la schermata di benvenuto:
  - Clicca su **"APRI VAULT ESISTENTE"** per aprire una tua cartella Obsidian / Markdown esistente;
  - Oppure clicca su **"CREA NUOVO VAULT"** per inizializzare un vault dimostrativo completo con note ed esempi predefiniti.

### B. Scaricamento del Modello di Ricerca Semantica (`bge-m3`)
1. Apri la scheda **Motore Semantico** (icona ingranaggio/motore nel menu laterale).
2. Nella sezione *Modello Locale (bge-m3)*, fai clic sul pulsante:  
   **"SCARICA MODELLO (635 MB)"**.
3. L'applicazione scaricherà il modello direttamente dai repository ufficiali e ne verificherà l'integrità crittografica (SHA-256).
4. Al termine del download, il badge mostrerà:  
   `INTEGRO (SHA-256 VERIFICATO)`.
5. Fai clic su **"AVVIA SERVIZIO LOCALE"**: lo stato passerà a **`PRONTO`** con l'indicazione della porta e del PID del servizio di inferenza locale.

### C. Configurazione della Chiave OpenAI
1. Apri la scheda **Avanzate / Impostazioni**.
2. Nella sezione relativa ai collegamenti AI, inserisci la tua **Chiave API OpenAI** personale (`sk-...`).
3. Clicca su **Salva**: la chiave viene archiviata in modo sicuro nel **Portachiavi di macOS** (Keychain), protetta dal sistema operativo. Nessuna chiave viene mai scritta nei documenti o inviata all'esterno.

---

## 4. Come Utilizzare l'Interfaccia Chat e le Fonti

### A. Chiedere al Vault
1. Seleziona la scheda **Chiedi** nel menu laterale.
2. In basso, nel campo di input evidenziato in verde lime, digita la tua domanda in italiano (es. *"Quali progetti sono documentati nel vault?"* oppure *"Riassumi i contenuti principali"*).
3. Premi **Invio** o clicca sul pulsante **"Chiedi"**:
   - **Visualizzazione Immediata Fonti**: entro 1–2 secondi compaiono sotto la domanda i documenti consultati e ritenuti pertinenti dall'algoritmo di ricerca ibrida locale.
   - **Streaming in Tempo Reale**: la risposta si compone progressivamente a video, con un cursore pulsante.
   - **Etichetta Fonti Citate**: a fine generazione compare l'indicazione trasparente:  
     > **"Basata su N documenti citati tra M consultati"**  
     I documenti effettivamente utilizzati dal modello vengono evidenziati con il badge verde **`CITATA`**.

### B. Consultazione e Ispezione delle Fonti
- Fai clic su qualunque fonte nell'elenco per aprire il visualizzatore laterale: potrai leggere il testo esatto del passaggio originale da cui l'AI ha tratto l'informazione, garantendo la totale verificabilità delle risposte.

### C. Storico delle Conversazioni e Domande di Seguito
- Le conversazioni rimangono memorizzate nella barra laterale sinistra dello storico: puoi riaprire qualsiasi chat passata per consultare risposte e fonti.
- Nella conversazione aperta puoi porre domande di seguito: il sistema manterrà il contesto del dialogo per approfondire gli argomenti trattati.
- Per avviare una discussione su un nuovo tema indipendente, fai clic sul pulsante **"Nuova conversazione"** in alto.

---

## 5. Come Segnalare Anomalie o Suggerimenti

Il tuo riscontro è fondamentale per la qualità del rilascio finale. Se riscontri errori, comportamenti inattesi o rallentamenti:

1. **Informazioni Utili da Fornire**:
   - Modello esatto di Mac (es. MacBook Air M2, MacBook Pro M3 Max);
   - Versione di macOS in uso (da *Menu Apple  $\rightarrow$ Informazioni su questo Mac*);
   - Descrizione breve di cosa stavi facendo prima dell'anomalia;
   - Testo dell'eventuale messaggio di errore visualizzato a schermo;
   - Se possibile, uno screenshot della schermata.
2. **Canale di Segnalazione**:
   - Invia la tua segnalazione all'indirizzo email o al canale dedicato concordato con il team di sviluppo.
