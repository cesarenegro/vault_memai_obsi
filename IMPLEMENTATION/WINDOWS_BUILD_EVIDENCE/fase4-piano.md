# Piano di Implementazione FASE 4 — Selezione Modello, Benchmark Prestazionale ed Etichetta Fonti

**Data**: 23 Settembre 2026  
**Ambiente**: LIMEN Vault v4 (versione 0.4.0, Windows 11 Pro, Tauri / Rust)  
**Obiettivo**: Ottimizzare la frazione OpenAI del tempo di risposta end-to-end consentendo la selezione dinamica e la persistenza della scelta del modello AI dell'account di Cesare, la gestione trasparente dei modelli con ragionamento e delle risposte incomplete, il confronto sperimentale su tempi, token e voti qualitativi di Cesare, e l'introduzione dell'etichetta trasparente delle fonti.

---

## 1. Contesto e Motivazione

Nella FASE 3 (approvata con voti 9-9-9 da Cesare sulle tre domande canoniche), i tempi di preparazione locale (ricerca ibrida semantica + estrazione multi-passaggio + deduplicazione + integrità SHA-256) si sono attestati a circa 1,0–2,6 secondi.  
Il tempo totale registrato in `C:\Users\user\.limen-vault\ask_timing.log` è stato:
- **BNXT**: totale 7,0 s (di cui OpenAI 5,8 s, pari all'83% del tempo totale);
- **ARKAI**: totale 8,0 s (di cui OpenAI 5,9 s, pari al 74% del tempo totale);
- **SCENA**: totale 11,8 s (di cui OpenAI 9,0 s, pari al 77% del tempo totale).

La frazione remota a OpenAI rappresenta la quota dominante del tempo percepito.  
La FASE 4 introduce:
1. Selezione dinamica del modello dall'elenco reale restituito dall'account OpenAI di Cesare, senza nomi scritti a codice.
2. Salvataggio della scelta nella cartella dati dell'app per utente, NON nel vault (nessuna modifica alle note). Finché nessun modello è scelto, l'app impedisce l'invio della domanda e ne richiede la selezione.
3. Supporto e tracciamento dei modelli con ragionamento: gestione dell'eventuale troncamento per limite token con avviso chiaro all'utente e registrazione puntuale dello stato e dei token separati (input, output, ragionamento) nel registro `ask_timing.log`.
4. Etichetta visiva trasparente `"Basata su N documenti citati tra M consultati"`.
5. Benchmark comparativo a tre domande eseguito da Cesare (Modello A `gpt-4o`, Modello B modello attuale veloce ed economico dell'account come `gpt-6-luna`, eventualmente Modello C `gpt-6-sol`). Nessuna previsione a priori: valgono unicamente le misure reali di Cesare.

---

## 2. Specifiche Tecniche e Correzioni Approvate

### A. Elenco Modelli Dinamico (Nessun Nome a Codice)
- **Recupero Dinamico**: Riuso del comando Tauri già esistente `ai_list_models` che interroga l'endpoint `GET https://api.openai.com/v1/models` tramite la chiave API configurata dall'utente.
- **Filtro Esclusivo**: Riuso del filtro già implementato in `apps/desktop/src-tauri/src/ai.rs` (`is_chat_model`), che esclude modelli audio, immagini, embedding (`bge-m3`, `text-embedding`), moderazione e realtime.
- **Assenza di Modelli Hardcoded**: Nessun nome di modello è inserito a codice come default o mock nel frontend o backend. L'elenco rispecchia esattamente i modelli attivi e abilitati nell'account OpenAI di Cesare (inclusi modelli correnti come `gpt-6-sol` e `gpt-6-luna`).

### B. Salvataggio della Scelta nella Cartella Dati Utente (Isolamento Totale dal Vault)
- **Percorso Assoluto**:  
  `C:\Users\user\.limen-vault\ai_settings.json`  
  (o percorso standard multipiattaforma `~/.limen-vault/ai_settings.json`).
- **Nessuna Modifica alle Note**: La configurazione è memorizzata all'esterno del Vault, rispettando la regola "le domande non modificano le note".
- **Blocco Preventivo**: Se nessun modello è ancora stato selezionato dall'utente:
  - Lo stato iniziale del modello è vuoto (`""`);
  - Il pulsante "Chiedi" è disabilitato;
  - L'interfaccia mostra un messaggio chiaro: *"Seleziona un modello per poter procedere"*;
  - La domanda non può essere inviata fino alla selezione esplicita.

### C. Gestione Modelli con Ragionamento e Risposte Incomplete
- **Limite Token e Ragionamento**: Se il modello scelto consuma token interni di ragionamento (reasoning tokens), il limite impostato (`max_output_tokens: 1500`) può determinare risposte incomplete (`finish_reason: "length"` o troncamento JSON).
- **Messaggio Chiaro in UI**: Se la risposta risulta incompleta, l'utente vede un banner esplicito e semplice:  
  *"Risposta incompleta: Il modello ha raggiunto il limite massimo di token generabili (anche a causa dei token di ragionamento interni). La risposta parziale è stata preservata."*
- **Tracciamento nel Registro dei Tempi**: In `C:\Users\user\.limen-vault\ask_timing.log` vengono registrati per ogni domanda:
  - `Stato`: `completata` oppure `INCOMPLETA (<motivo>)`;
  - `Token`: separati in totale, input (`tokens_prompt`), output (`tokens_completion`) e ragionamento (`tokens_reasoning`).

### D. Etichetta Trasparente Fonti Citate vs Consultate
- In testata all'elenco delle fonti dell'interfaccia "Chiedi":
  > **"Basata su N documenti citati tra M consultati"**
- Dove:
  - $N$ = numero di documenti effettivamente citati dal modello nella risposta;
  - $M$ = numero di documenti pertinenti estratti dal Vault e consultati/inviati a supporto nel prompt.

### E. Confronto Sperimentale di Cesare
- **Nessuna stima temporale preventiva**: rimossa qualsiasi previsione sui secondi; valgono esclusivamente le misurazioni di Cesare.
- **Protocollo**:
  - Modello A: `gpt-4o` (garantisce la continuità con tutte le prove storiche delle Fasi 1, 2 e 3);
  - Modello B: Modello attuale più veloce ed economico presente nell'account di Cesare (per esempio `gpt-6-luna`);
  - Eventuale Modello C: `gpt-6-sol`.
- **Domande canoniche di Cesare**:
  1. *"Cosa è il progetto BNXT?"*
  2. *"ARKAI è un'azienda o un marchio? Di cosa si occupa?"*
  3. *"Cos'è il progetto SCENA e quali app comprende?"*
- **Output**: Misurazioni lette direttamente da `ask_timing.log` (tempo totale, tempo OpenAI, token input, token output, token ragionamento) e voto qualitativo (1–10) di Cesare.

---

## 3. Stato di Avanzamento e Task List

### Componente 1: Backend Rust e Persistenza Impostazioni Utente
- [x] **1.1** Estendere `AskTimingLogEntry` con `status`, `incomplete_reason`, `tokens_prompt`, `tokens_completion`, `tokens_reasoning`.
- [x] **1.2** Aggiornare la formattazione di `log_ask_timing_detailed` per registrare stato e token dettagliati in `C:\Users\user\.limen-vault\ask_timing.log`.
- [x] **1.3** Implementare funzioni di persistenza `load_selected_model` e `save_selected_model` nel percorso assoluto `C:\Users\user\.limen-vault\ai_settings.json`.
- [x] **1.4** Implementare comandi Tauri `ai_get_selected_model` e `ai_save_selected_model` registrati in `main.rs`.
- [x] **1.5** Estendere `parse_response` per estrarre token di input, output e ragionamento da `usage` e gestire risposte incomplete senza crash.
- [x] **1.6** Creare test unitario dedicato `test_selected_model_persistence_in_app_data_dir`.

### Componente 2: Frontend Desktop (React / TypeScript)
- [x] **2.1** Estendere interfaccia `AiAnswer` in `ai-ipc.ts` con i campi `status`, `incomplete`, `incompleteReason`, `tokensPrompt`, `tokensCompletion`, `tokensReasoning`.
- [x] **2.2** Aggiungere metodi `getSelectedModel()` e `saveSelectedModel(model)` in `aiIpc`.
- [x] **2.3** Rimuovere modelli hardcoded da `AiPanel.tsx`: `model` e `availableModels` popolati dinamicamente da IPC.
- [x] **2.4** Inserire selettore del modello visibile direttamente nella scheda "Chiedi" e sincronizzarlo con "Collegamenti AI & MCP".
- [x] **2.5** Bloccare l'invio della domanda se nessun modello è selezionato (`disabled`, alert e placeholder dedicati).
- [x] **2.6** Implementare l'etichetta visiva trasparente `"Basata su N documenti citati tra M consultati"`.
- [x] **2.7** Inserire banner visivo per risposta incompleta in `AiPanel.tsx` e arricchire i "Dettagli tecnici" con token di input, output e ragionamento.
- [x] **2.8** Verificare la correttezza del tipo con `npx tsc --noEmit`.

### Componente 3: Verifica Build, Test e Patch di Consegna
- [x] **3.1** Completare l'esecuzione di `cargo test` in parallelo salvando il log in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-4-parallel.log`.
- [x] **3.2** Completare l'esecuzione di `cargo test -- --test-threads=1` salvando il log in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-4-single.log`.
- [x] **3.3** Eseguire commit git e generare la patch `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-4.patch`.
- [ ] **3.4** STOP per la prova di Cesare (nessuna chiamata remota OpenAI eseguita dall'assistente, nessun processo terminato).

### Componente 4: Esecuzione Misure Live di Cesare (Dopo lo STOP)
- [ ] **4.1** Misurazione live con Modello A (`gpt-4o`): 3 domande, lettura tempi/token da `ask_timing.log`, voto di Cesare.
- [ ] **4.2** Misurazione live con Modello B (es. `gpt-6-luna`): 3 domande, lettura tempi/token da `ask_timing.log`, voto di Cesare.
- [ ] **4.3** Eventuale misurazione live con Modello C (`gpt-6-sol`): 3 domande, tempi/token e voto di Cesare.
- [ ] **4.4** Redazione di `fase4-benchmark.md` con tabella comparativa completa.

---

## 4. Regole Operative Tassative
- **ZERO chiamate a OpenAI da parte dell'assistente**: l'assistente non deve MAI invocare le API OpenAI né simulare domande. Le prove sono ad appannaggio esclusivo di Cesare.
- **ZERO chiusure o riavvii di processi** senza esplicita richiesta/autorizzazione di Cesare.
