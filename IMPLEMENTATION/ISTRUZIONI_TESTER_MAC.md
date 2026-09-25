# Guida per i Tester Esterni — LIMEN Vault v6Mini (macOS)

Benvenuto nel programma di collaudo di **LIMEN Vault v6Mini** (versione 0.6.0).  
LIMEN Vault è l'applicazione desktop pensata per la gestione e consultazione sicura della memoria aziendale, integrando ricerca semantica vettoriale locale e generazione avanzata di risposte aumentate dai documenti.

---

## 1. Requisiti di Sistema

- **Computer**: Mac con processore Apple Silicon (chip **M1, M2, M3, M4** o successivi).
- **Sistema Operativo**: **macOS 26.0** o versioni successive.
- **Connessione Internet**: Necessaria per il primo avvio (download del modello di ricerca) e per la consultazione tramite modello linguistico OpenAI.
- **Chiave API OpenAI**: Una chiave API personale OpenAI con accesso ai modelli standard (es. `gpt-4o`, `gpt-4o-mini`).

---

## 2. Installazione dell'Applicazione

1. Fai doppio clic sul file di installazione scaricato:  
   `LIMEN-Vault-v6Mini.dmg`.
2. Nella finestra visualizzata, trascina l'icona di **LIMEN Vault v6Mini** nella cartella **Applicazioni**.
3. Apri la cartella **Applicazioni** ed esegui **LIMEN Vault v6Mini**:
   - L'applicazione è ufficialmente **firmata con Developer ID e autenticata da Apple (Notarized)**: si aprirà direttamente al primo avvio senza blocchi di Gatekeeper.

---

## 3. Primo Avvio e Configurazione Iniziale

### A. Apertura o Creazione di un Vault
- Al primo avvio vedrai la schermata di benvenuto:
  - Clicca su **"APRI VAULT ESISTENTE"** per aprire una tua cartella Obsidian / Markdown esistente;
  - Oppure clicca su **"CREA NUOVO VAULT"** per inizializzare un vault dimostrativo completo con note ed esempi predefiniti.
- *Nota*: la prima apertura di un vault già esistente può richiedere alcuni secondi in più perché l'indice di ricerca viene ricostruito.

### B. Scaricamento del Modello di Ricerca Semantica (`bge-m3`)
1. Nel menu laterale seleziona la scheda **Avanzate** (icona ingranaggio).
2. Nella barra secondaria orizzontale in alto, clicca su **Collegamenti AI & MCP**.
3. Nel primo riquadro, **Motore semantico**, trovi la sezione *Modello locale (bge-m3)*:
   - Se il modello non è ancora presente, lo stato indica **`NON INSTALLATO`**.
   - Fai clic sul pulsante:  
     **"SCARICA MODELLO (635 MB)"**.
   - L'applicazione scaricherà il modello direttamente dai repository ufficiali e ne verificherà l'integrità crittografica SHA-256.
   - A scaricamento ultimato, lo stato del modello diventa verde:  
     **`INSTALLATO (SHA-256 OK)`**.
4. Nel riquadro sottostante, *Servizio locale di calcolo*, puoi verificare lo stato del servizio `llama-server`:
   - Quando il modello è installato, il servizio locale **parte da solo in background all'apertura dell'applicazione** senza dover eseguire comandi manuali, attestandosi sullo stato:  
     **`ATTIVO`** (con indicazione della porta locale assegnata, es. *ATTIVO (PORTA 60879)*).
   - Se necessario, puoi comunque gestirlo manualmente con i pulsanti **"AVVIA SERVIZIO LOCALE"** o **"ARRESTA SERVIZIO LOCALE"**.

### C. Configurazione del Consenso e della Chiave OpenAI
1. Sempre in **Avanzate → Collegamenti AI & MCP**, scorri fino al riquadro **Generazione risposte e consenso OpenAI** / **Impostazioni OpenAI & Consenso**:
2. **Attivazione del Consenso (Obbligatorio)**:
   - Spunta la casella:  
     **"Consenti l'invio a OpenAI dei passaggi pertinenti per generare le risposte"**  
   - Lo stato confermerà: *✓ Consenso attivo: l’app può inviare i passaggi dei documenti pertinenti a OpenAI per comporre le risposte.*  
   - *Importante*: senza questa casella attivata, le domande non partono e la generazione risposte resta bloccata per salvaguardare la tua riservatezza.
3. **Scelta del Modello Predefinito**:
   - Nel selettore **Modello OpenAI predefinito**, scegli il modello desiderato (consigliato: `gpt-4o-mini (veloce, consigliato)` oppure `gpt-4o (massima qualità)`).
4. **Inserimento della Chiave API**:
   - Nel campo **Chiave API OpenAI (memorizzata nel Portachiavi)** (con segnaposto `sk-proj-...`), incolla la tua chiave API personale OpenAI.
   - Clicca sul pulsante **"Salva chiave"**: la chiave viene archiviata nel **Portachiavi di macOS** (Keychain), protetta dal sistema operativo con crittografia hardware. Nessuna chiave viene mai salvata in chiaro nei documenti del Vault né trasmessa a server esterni diversi da OpenAI.

---

## 4. Come Utilizzare l'Interfaccia Chat e le Fonti (FASE 6b)

### A. Conversazione Continua
1. Seleziona la scheda **Chiedi** nel menu laterale.
2. L'interfaccia si presenta come una chat a conversazione continua:
   - Le tue domande compaiono allineate a **destra con sfondo verde lime**;
   - Le risposte elaborate dall'assistente AI compaiono allineate a **sinistra in riquadri bianchi** con bordo e testo chiaro;
   - La casella di scrittura è **fissa in basso**, sempre accessibile durante la consultazione.
3. Digita la tua domanda nella casella in basso e premi **Invio** (oppure clicca sul pulsante **"Chiedi"** a destra nella barra di input).
4. Puoi proseguire la discussione formulando domande di seguito: il sistema manterrà automaticamente il contesto dei turni precedenti per approfondire i concetti.
5. Per azzerare il contesto e iniziare un argomento differente, clicca sul pulsante **"Nuova conversazione"** presente nell'intestazione o in calce alla chat.

### B. Consultazione delle Fonti e Apertura dei Documenti
1. Su ciascuna risposta dell'assistente compare l'indicazione discreta:  
   **"N fonti citate"** (o *"1 fonte citata"*).
2. Cliccando su questo pulsante, si apre automaticamente la sezione **Fonti** nella barra laterale destra/sinistra.
3. Cliccando su una specifica fonte o su **"Mostra tutte"**, si apre il pop-up dei dettagli con il testo completo del passaggio originale estratto dal documento.
4. Nel pop-up dei dettagli è presente il pulsante **"Apri documento"**: facendovi clic, l'applicazione apre direttamente il documento nel lettore integrato per una consultazione approfondita e verificata del testo originale.

### C. Storico delle Conversazioni
- Nella barra laterale è presente lo **storico delle conversazioni**: tutte le sessioni di dialogo vengono memorizzate con data, ora, modello utilizzato e primo prompt.
- Puoi riaprire qualunque conversazione precedente in qualsiasi momento per riesaminare risposte, passaggi e fonti consultate.

### D. Modalità 100% Solo Locale con Ministral 3 8B Instruct (FASE 8 — Offline a Rete Zero)
LIMEN Vault v6Mini supporta un'innovativa architettura a **doppio binario**:
1. **Modalità Ibrida (Predefinita)**:
   - Ricerca semantica locale ad alta velocità sul Mac con il modello embedding `bge-m3` (~635 MB).
   - Generazione delle risposte tramite OpenAI (`gpt-4o-mini` o `gpt-4o`). Il modello generativo locale resta scaricato dalla RAM (~350 MB occupati in totale).
2. **Modalità 100% Solo Locale (Ministral 3 8B Instruct Q5_K_M)**:
   - Si attiva con un clic sul pulsante **Verde Lime** ("**SOLO LOCALE (Mac)**") posizionato nella testata della chat o sopra la barra di scrittura.
   - **Zero byte inviati all'esterno, zero chiavi API e funzionamento anche a Wi-Fi disconnesso**.
   - **Primo utilizzo**: se il modello (~6,06 GB) non è ancora installato, compare una finestra modale con le specifiche del file e il pulsante **"SCARICA MINISTRAL 8B (6,06 GB)"**. Al termine del download da Hugging Face e della verifica crittografica SHA-256, il motore locale è immediatamente operativo.
   - **Gestione automatica della memoria**: il servizio locale viene avviato su Apple Silicon con accelerazione GPU Metal (~6,2 GB allocati) e viene spento non appena si ritorna alla modalità OpenAI o si esce dall'app, liberando istantaneamente la RAM.
   - **Badge di garanzia offline**: le risposte composte sul computer riportano in calce il badge:  
     `Generato sul Mac · Ministral 3 8B Instruct Q5_K_M (Offline)`.

---

## 5. Come Segnalare Anomalie o Suggerimenti

Il tuo riscontro è fondamentale per la qualità del rilascio finale. Se riscontri errori, comportamenti inattesi o rallentamenti:

1. **Canale di Segnalazione**:
   - Invia un'email a: **`cesare@arkitecna.com`**
   - Oggetto dell'email: **`LIMEN Vault v6Mini — segnalazione tester`**
2. **Informazioni Utili da Includere**:
   - Modello esatto di Mac (es. MacBook Air M2, MacBook Pro M3 Max);
   - Versione di macOS in uso (da *Menu Apple  $\rightarrow$ Informazioni su questo Mac*);
   - Descrizione chiara dell'azione che stavi compiendo prima dell'anomalia;
   - Testo esatto dell'eventuale messaggio di errore visualizzato a schermo;
   - Uno screenshot o breve registrazione dello schermo se l'anomalia è visiva.
