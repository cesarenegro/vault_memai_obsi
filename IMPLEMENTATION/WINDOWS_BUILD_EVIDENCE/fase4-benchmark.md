# Rapporto di Benchmark Comparativo FASE 4 — Selezione Modelli OpenAI

**Data**: 23 Settembre 2026 (12:51–12:54 UTC)  
**Ambiente**: LIMEN Vault v4 (0.4.0, Windows 11 Pro)  
**Fonte Dati**: `C:\Users\user\.limen-vault\ask_timing.log`  
**Valutatore**: Cesare (voto qualitativo scala 1–10)

---

## 1. Risultati Sperimentali delle Prove di Cesare

Le misurazioni sono state eseguite direttamente dall'app desktop di Cesare sulle tre domande canoniche, confrontando il modello storico **`gpt-4o`** (`gpt-4o-2024-08-06`) con il modello attuale dell'account **`gpt-6-luna`**.  
Come deliberato da Cesare, è stata effettuata una sola prova per ciascuna combinazione domanda-modello data la naturale variabilità dei tempi di rete, focalizzando la valutazione sulla coerenza qualitativa e sui volumi di token.

### Tabella Comparativa di Misurazione

| Domanda | Modello | Tempo OpenAI ($t_{ai}$) | Tempo UI Totale ($t_{tot}$) | Token Input | Token Output | Token Totali | Fonti Citate / Consultate | Voto Cesare |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BNXT** | `gpt-4o` | **6.155 ms** | **7.167 ms** | 5.785 | 324 | 6.109 | 3 / 8 | **9** |
| **BNXT** | `gpt-6-luna` | **6.058 ms** | **7.056 ms** | 5.783 | 566 | 6.349 | 3 / 8 | **8–9** |
| **ARKAI** | `gpt-4o` | **3.624 ms** | **5.838 ms** | 6.260 | 250 | 6.510 | 5 / 7 | **8–9** |
| **ARKAI** | `gpt-6-luna` | **8.280 ms** | **10.291 ms** | 6.258 | 437 | 6.695 | 4 / 7 | **7–8** |
| **SCENA** | `gpt-4o` | **5.905 ms** | **8.515 ms** | 6.609 | 415 | 7.024 | 3 / 8 | **10** |
| **SCENA** | `gpt-6-luna` | **6.192 ms** | **8.645 ms** | 6.607 | 543 | 7.150 | 3 / 8 | **7** |

---

## 2. Analisi e Decisione di Cesare

1. **Qualità delle Risposte**:
   - `gpt-4o` dimostra una superiorità qualitativa costante e marcata su tutte e tre le domande:
     - **SCENA**: voto **10** (contro il 7 di `gpt-6-luna`);
     - **ARKAI**: voto **8–9** (contro 7–8);
     - **BNXT**: voto **9** (contro 8–9).
   - Le sintesi prodotte da `gpt-4o` sono risultate più concise, autorevoli e pertinenti rispetto alle fonti fornite.

2. **Latenza e Consumo Token**:
   - I tempi di risposta presentano un'ampia oscillazione fisiologica dovuta ai nodi di rete remoti di OpenAI (per esempio su ARKAI `gpt-4o` ha impiegato 3,6 s contro gli 8,3 s di `gpt-6-luna`).
   - `gpt-6-luna` tende a produrre risposte più verbose, consumando sistematicamente più token di output (566 vs 324 su BNXT, 437 vs 250 su ARKAI, 543 vs 415 su SCENA), il che incide sia sul costo per chiamata sia sulla latenza di streaming/generazione.

3. **Decisione Finale di Cesare**:
   - **`gpt-4o` resta confermato come modello predefinito** di LIMEN Vault v4.
   - Il modello `gpt-6-sol` non è stato provato in questa sessione.
   - L'utente mantiene la piena facoltà di selezionare e alternare i modelli direttamente dall'interfaccia grazie alla persistenza introdotta nella FASE 4 in `C:\Users\user\.limen-vault\ai_settings.json`.

---

## 3. Rettifica Tecnica sui Token di Ragionamento (`tokens_reasoning`)

Nel registro `C:\Users\user\.limen-vault\ask_timing.log`, la voce `ragionamento` non è comparsa nelle prove del benchmark di Cesare.  
**Rettifica formale**:
1. **Errore nel nome del campo JSON**:  
   Nella Responses API di OpenAI il campo ufficiale è `usage.output_tokens_details.reasoning_tokens` (con il plurale `tokens`, come documentato nella guida ufficiale OpenAI). Il codice precedente utilizzava erroneamente il singolare `usage["output_token_details"]`. Di conseguenza, il valore **non veniva letto** dal backend e la precedente dichiarazione ("assente perché nullo, non perché non letto") era errata.
2. **Impatto sulle misure di `gpt-6-luna`**:  
   I token in uscita misurati per `gpt-6-luna` (437–566 contro 250–415 di `gpt-4o`) possono aver incluso token di ragionamento interni non visibili, che le API di OpenAI conteggiano a tutti gli effetti nei token di completamento/output. Con il campo non letto non è stato possibile distinguere quale frazione fosse prosa effettiva e quale eventuale elaborazione interna.
3. **Correzione applicata**:  
   In `apps/desktop/src-tauri/src/ai.rs` la lettura è stata corretta con prioritizzazione di `usage["output_tokens_details"]["reasoning_tokens"]` ed è stato introdotto il test unitario `test_parse_response_reads_reasoning_tokens_from_output_tokens_details` che convalida la registrazione corretta di 128 token di ragionamento.
