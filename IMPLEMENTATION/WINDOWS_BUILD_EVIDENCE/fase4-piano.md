# Piano di Implementazione FASE 4 — Selezione Modello, Benchmark Prestazionale ed Etichetta Fonti

**Data**: 23 Settembre 2026  
**Ambiente**: LIMEN Vault v3 (Windows 11 Pro, Tauri / Rust)  
**Obiettivo**: Ottimizzare il 70–80% del tempo di risposta end-to-end (frazione OpenAI) consentendo la selezione e persistenza del modello AI da account, la misurazione comparativa su tempi, token e voti qualitativi di Cesare, e l'introduzione dell'etichetta trasparente delle fonti.

---

## 1. Contesto e Motivazione

Nella FASE 3 (approvata con voti 9-9-9 da Cesare sulle tre domande canoniche), i tempi di preparazione locale (ricerca ibrida semantica + estrazione multi-passaggio + deduplicazione + integrità SHA-256) sono scesi a circa 1,0–2,6 secondi.  
Il tempo totale registrato in `C:\Users\user\.limen-vault\ask_timing.log` è stato:
- **BNXT**: totale 7,0 s (di cui **OpenAI 5,8 s**, pari all'**83%** del tempo);
- **ARKAI**: totale 8,0 s (di cui **OpenAI 5,9 s**, pari al **74%** del tempo);
- **SCENA**: totale 11,8 s (di cui **OpenAI 9,0 s**, pari al **77%** del tempo).

La frazione dominante del tempo percepito dall'utente è quindi la latenza di generazione della chiamata remota a OpenAI.  
Attualmente:
1. In `apps/desktop/src/AiPanel.tsx:57`, il modello è fisso con `const [model, setModel] = useState('gpt-4o');`.
2. Il menu in "Collegamenti AI & MCP" non persiste la scelta dell'utente per le sessioni future.
3. L'elenco dei modelli è statico e non recuperato dall'account OpenAI associato alla chiave API configurata.
4. L'interfaccia utente mostra le fonti in un elenco a scomparsa ma non evidenzia la sintesi trasparente delle fonti citate rispetto a quelle consultate.

---

## 2. Componenti della FASE 4

### A. Elenco Modelli Dinamico da Account e Persistenza Modello

1. **Recupero Dinamico Modelli da Account OpenAI**:
   - Backend Rust / IPC Tauri: comando per interrogare l'endpoint `GET https://api.openai.com/v1/models` usando la chiave API registrata nel keychain o nelle impostazioni.
   - Filtro intelligente: selezionare esclusivamente i modelli abilitati a chat/completions (es. `gpt-4o`, `gpt-4o-mini`, `o1-mini`, `o3-mini`, `gpt-4-turbo`), escludendo modelli legacy, audio, realtime o solo embedding (`bge-m3`, `text-embedding-3-*`).
   - Caching locale: memorizzare l'elenco modelli in cache per evitare chiamate ripetute all'apertura del pannello, con pulsante "Aggiorna elenco modelli".

2. **Salvataggio e Persistenza delle Preferenze**:
   - Salvare il modello selezionato nella configurazione locale dell'utente (file `settings.json` del Vault o preferenze utente persistite in Tauri).
   - In "Collegamenti AI & MCP", la selezione del modello predefinito aggiorna la preferenza persistita.
   - All'apertura della schermata "Chiedi" (`AiPanel.tsx`), il valore iniziale dello stato `model` viene letto dalle preferenze salvate anziché essere fissato a `"gpt-4o"`.

### B. Etichetta Trasparente Fonti Consultate e Citate

1. **Rilevazione Fonti Citate vs Consultate**:
   - Fonti Consultate ($M$): totale delle fonti rilevanti selezionate e iniettate nel prompt OpenAI (es. 8 per BNXT, 7 per ARKAI, 8 per SCENA).
   - Fonti Citate ($N$): numero di documenti distinti referenziati dal modello nella risposta generata (es. 5 per BNXT, 4 per ARKAI, 3 per SCENA).
2. **Presentazione UI in `AiPanel.tsx`**:
   - Inserire sopra o accanto al riquadro delle fonti un'etichetta esplicita e rassicurante:
     > **"Basata su N documenti citati tra M consultati"**
   - Click sull'etichetta o espansione per mostrare il dettaglio puntuale (con badge visivo per i documenti citati rispetto a quelli solo consultati a supporto).

### C. Misurazione Comparativa di Cesare (Tempi, Token e Voto Qualitativo)

1. **Protocollo di Test**:
   - Cesare testerà almeno due modelli OpenAI (es. `gpt-4o` vs `gpt-4o-mini` o `o3-mini`) sulle stesse tre domande canoniche:
     1. *"Cosa è il progetto BNXT?"*
     2. *"ARKAI è un'azienda o un marchio? Di cosa si occupa?"*
     3. *"Cos'è il progetto SCENA e quali app comprende?"*
2. **Metriche Raccolte da `ask_timing.log` per Ciascun Modello**:
   - Tempo OpenAI ($t_{ai}$) in millisecondi;
   - Tempo Totale ($t_{tot}$) in millisecondi;
   - Token consumati (prompt tokens, completion tokens, total tokens);
   - Voto di qualità assegnato da Cesare (scala 1–10).
3. **Analisi del Trade-Off**:
   - Se `gpt-4o-mini` (o altro modello leggero) fornisce tempi di risposta inferiori a 2–3 secondi mantenendo voti elevati (es. 8–9), potrà essere raccomandato o impostato come opzione rapida di default.

---

## 3. Task List Tracciabile FASE 4

### Componente 1: Gestione e Persistenza Modelli OpenAI
- [ ] **1.1** Implementare backend Rust / comando Tauri per recuperare la lista dei modelli da `https://api.openai.com/v1/models` validando la chiave API.
- [ ] **1.2** Filtrare la lista modelli per includere solo i modelli di testo/chat supportati (es. `gpt-4o`, `gpt-4o-mini`, `o3-mini`, `gpt-4-turbo`).
- [ ] **1.3** Implementare la persistenza della scelta del modello nel file di preferenze/configurazione del Vault.
- [ ] **1.4** Sincronizzare il selettore del modello in "Collegamenti AI & MCP" con la configurazione salvata.
- [ ] **1.5** Aggiornare `AiPanel.tsx` per inizializzare il modello predefinito dalla configurazione salvata anziché usare la costante fissa `gpt-4o`.

### Componente 2: Interfaccia Fonti Citate vs Consultate
- [ ] **2.1** Calcolare in `AiPanel.tsx` il conteggio dei documenti citati ($N$) e consultati ($M$).
- [ ] **2.2** Inserire l'etichetta visiva `"Basata su N documenti citati tra M consultati"` in testata alla sezione fonti.
- [ ] **2.3** Evidenziare con stile grafico dedicato (badge o spunta) i documenti che sono stati citati nella risposta rispetto a quelli solo consultati.

### Componente 3: Benchmark e Valutazione di Cesare
- [ ] **3.1** Rilascio build o configurazione pronta per la prova di Cesare senza chiamate automatiche.
- [ ] **3.2** Misurazione live condotta da Cesare con Modello A (`gpt-4o`): raccolta tempi, token e voti su BNXT, ARKAI, SCENA.
- [ ] **3.3** Misurazione live condotta da Cesare con Modello B (`gpt-4o-mini` o alternativo): raccolta tempi, token e voti sulle stesse domande.
- [ ] **3.4** Tabulazione comparativa finale in `fase4-benchmark.md`.
- [ ] **3.5** Chiusura FASE 4 con approvazione finale di Cesare.

---

## 4. Regole Operative Tassative per la FASE 4
- **ZERO chiamate a OpenAI da parte dell'assistente**: tutte le chiamate di prova devono essere effettuate unicamente da Cesare all'interno dell'app.
- **ZERO terminazioni di processi di sistema** senza previa autorizzazione esplicita di Cesare.
