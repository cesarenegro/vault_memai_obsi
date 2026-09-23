# Piano di Implementazione FASE 5 — Streaming della Risposta, Ottimizzazione Ricerca Locale ed Esposizione Immediata Fonti

**Data**: 23 Settembre 2026  
**Ambiente**: LIMEN Vault v4 (versione 0.4.0, Windows 11 Pro, Tauri / Rust)  
**Obiettivo**: Abbattere la latenza percepita e reale dell'utente mediante tre direttrici complementari:
1. Streaming progressivo del testo generato da OpenAI (conciliato con Strict JSON Schema);
2. Riduzione del tempo di calcolo della ricerca ibrida locale (oggi 0,8 – 1,9 s);
3. Esposizione immediata delle fonti consultate già al termine della fase di preparazione locale.

---

## 1. Analisi delle Prestazioni Attuali e Metriche Mancanti

Nei registri di `C:\Users\user\.limen-vault\ask_timing.log` rilevati durante i benchmark di Cesare:
- **Preparazione locale del contesto (Preview)**: **1,0 – 2,5 s**
  - Lettura indice e cache: 17 – 23 ms
  - Embedding vettore della query (`bge-m3` locale): 72 – 91 ms
  - **Ricerca ibrida, ranking vettoriale e fusione RRF (search)**: **0,8 – 1,9 s** (frazione dominante del tempo locale)
  - Lettura documenti e catalog: 4 – 330 ms
  - Estrazione multi-passaggio e hash SHA-256: 0 – 240 ms
- **Chiamata remota OpenAI (`gpt-4o`)**: **3,6 – 6,2 s** (fino a 8,3 – 9,0 s con modelli alternativi)
- **Tempo totale da UI**: **5,8 – 10,3 s**

### Chiarimento sul Tempo di Comparsa del Testo
Nessuna previsione a priori sui secondi di comparsa del testo può essere formulata:  
**Al tempo di preparazione locale (Preview, 1,0–2,5 s) va sommato il tempo necessario a OpenAI per restituire il primo frammento (Time to First Token / TTFT remoto), che finora non è mai stato misurato.**  
Nella FASE 5 verrà integrata nel backend la misurazione esatta del tempo trascorso tra l'invio della richiesta HTTP a OpenAI e la ricezione del primo frammento SSE (`t_first_chunk_ms`), registrandola formalmente in `ask_timing.log` per consentire a Cesare di quantificarla con precisione.

---

## 2. Direttrici di Intervento della FASE 5

### a) Streaming del Testo della Risposta con JSON Strutturato

Oggi OpenAI risponde con **Strict JSON Schema**:
```json
{
  "answer": "string",
  "citation_ids": ["S1", "S3"]
}
```
In uno stream SSE (`stream: true`), i frammenti della stringa `"answer"` arrivano progressivamente, mentre la lista `"citation_ids"` arriva solo alla fine del testo.

#### Opzioni a Confronto:
- **Opzione A (Raccomandata) — Streaming progressivo di `answer` con Strict Schema e citazioni a fine flusso**:
  - *Funzionamento*: Si mantiene lo schema JSON rigido. Il backend Rust consuma lo stream SSE di OpenAI, estrae incrementale il testo compreso tra le virgolette del campo `"answer"` (decodificando al volo gli escape JSON speciali come `\n`, `\"`, `\uXXXX`) e invia eventi Tauri `limen://ai-stream-chunk` alla UI. Al termine dello stream, il backend valida l'intero JSON e le citazioni, emettendo `limen://ai-stream-end`.
  - *PRO*: Preserva al 100% l'accuratezza formale e qualitativa (voto 9-10 nelle prove di Cesare); garantisce la verifica crittografica SHA-256 delle citazioni; non espone sigle grezze nella prosa.
  - *CONTRO*: Richiede la gestione robusta di caratteri speciali di escape interrotti a cavallo tra chunk consecutivi.
- **Opzione B — Streaming a testo puro con marcatore finale (es. `===CITAZIONI===`)**:
  - *Funzionamento*: Testo libero senza JSON Schema, con sigle separate da marcatore testuale.
  - *PRO*: Nessun parsing JSON durante lo stream.
  - *CONTRO*: Rischio concreto di allucinazioni di schema, omissione del marcatore da parte del modello e perdita della garanzia rigida delle citazioni che ha reso LIMEN Vault affidabile.
- **Opzione C — Sigle in-text rilevate al volo**:
  - *CONTRO*: Violerebbe la regola consolidata della FASE 3b-2 ("nessuna sigla grezza [S1] nella prosa della risposta").

---

### b) Riduzione del Calcolo della Ricerca Locale (da 0,8–1,9 s a valori inferiori)

La ricerca ibrida locale impiega oggi circa **0,8 – 1,9 secondi** su 23.482 passaggi indicizzati.

#### Punti Critici nel Codice Rust (`apps/desktop/src-tauri/src/search.rs`):
1. **Calcolo sequenziale del prodotto scalare semantico** ([search.rs:440–510](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs)):
   - La funzione `search_passages_with_query_vector` itera sequenzialmente in un singolo thread su tutti i 23.482 vettori di dimensione 1024 float (oltre 24 milioni di moltiplicazioni float in memoria).
   - *Ottimizzazione proposta*: Parallelizzazione del dot product su multi-core tramite iteratore parallelo (`rayon::prelude::*`, `par_iter()`), sfruttando l'architettura multi-thread della CPU Intel/AMD.
2. **Pre-filtraggio o Scoring Selettivo Candidate Generation** ([search.rs:520–580](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs)):
   - Attualmente tutti i passaggi del vault vengono valutati vettorialmente, anche se privi di pertinenza.
   - *Ottimizzazione proposta*: Eseguire la ricerca semantica densa prioritariamente sui candidati emergenti o sfruttare l'indice lessicale BM25 per escludere a monte blocchi di passaggi completamente scorrelati prima del calcolo dei vettori.

---

### c) Esposizione Immediata delle Fonti Consultate (Zero Attesa)

Durante la fase di preparazione locale (Preview, ~1–2 s):
- I documenti pertinenti e i passaggi estratti sono già stati selezionati, deduplicati e convalidati con i rispettivi hash SHA-256 prima ancora che la chiamata remota a OpenAI abbia inizio.
- **Miglioramento UI proposto**:
  - L'interfaccia può mostrare immediatamente l'elenco dei documenti consultati a supporto della domanda non appena si conclude la fase di Preview, con l'indicatore *"Consultati per questa domanda (in attesa di risposta…)"*.
  - Quando OpenAI completa la risposta in streaming, i documenti effettivamente citati si accendono con il badge *"CITATA"* e viene visualizzata la formula definitiva *"Basata su N documenti citati tra M consultati"*.
  - L'utente non rimane con una schermata vuota ma può iniziare a consultare le fonti pertinenti già mentre il testo si sta componendo.

---

## 3. Task List Tracciabile FASE 5

### Componente 1: Backend Rust — Streaming, Parser Incrementale e Misurazione TTFT
- [ ] **1.1** Implementare `JsonStringStreamParser` con gestione degli escape JSON (`\n`, `\"`, `\uXXXX`) e buffer per sequenze spezzate tra chunk.
- [ ] **1.2** Test unitari dedicati per `JsonStringStreamParser` su casi limite (chunk spezzati su virgolette, escape Unicode, stream troncati).
- [ ] **1.3** Aggiornare `ask` in `ai.rs` per attivare lo streaming SSE (`stream: true`) ed emettere eventi Tauri `ai-stream-chunk` verso la finestra dell'app.
- [ ] **1.4** Misurare il tempo esatto dal lancio della richiesta alla ricezione del primo frammento (`t_first_chunk_ms`) e registrarlo in `AskTimingLogEntry` e in `ask_timing.log`.
- [ ] **1.5** Emettere l'evento terminale `ai-stream-end` con citazioni convalidate, token usati e stato.

### Componente 2: Backend Rust — Ottimizzazione Calcolo Ricerca Locale (`search.rs`)
- [ ] **2.1** Misurare il profilo di dettaglio interno a `search.rs` (scoring vettoriale dot product vs ranking BM25 vs fusione RRF).
- [ ] **2.2** Introdurre parallelizzazione `rayon` nel calcolo della similarità coseno/dot product su passaggi indicizzati ([search.rs:440–510](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs)).
- [ ] **2.3** Validare che i risultati, l'ordinamento e i punteggi Gold (Recall@10 = 0.975 su A05) restino identici al 100%.

### Componente 3: Frontend Desktop (React / TypeScript) — Streaming e Fonti Immediate
- [ ] **3.1** Aggiungere supporto per eventi di streaming in `ai-ipc.ts`.
- [ ] **3.2** Aggiornare `AiPanel.tsx` per mostrare le fonti consultate non appena la Preview è completata.
- [ ] **3.3** Visualizzare il testo in streaming in tempo reale con cursore attivo nella scheda "Chiedi".
- [ ] **3.4** Aggiornare i badge delle fonti e l'etichetta *"Basata su N documenti citati tra M consultati"* all'evento di fine streaming.

### Componente 4: Verifica, Test e Benchmark di Cesare
- [ ] **4.1** Esecuzione suite completa `cargo test` (parallelo e sequenziale).
- [ ] **4.2** Verifica statica frontend con `npx tsc --noEmit`.
- [ ] **4.3** STOP operativo per la prova live di Cesare (misurazione tempi di ricerca ottimizzata, `t_first_chunk_ms` e qualità).

---

## 4. Regole Operative Tassative
- **Nessuna implementazione della FASE 5 prima dell'approvazione esplicita di Cesare**.
- **ZERO chiamate a OpenAI eseguite dall'assistente**.
- **ZERO processi arrestati o riavviati**.
