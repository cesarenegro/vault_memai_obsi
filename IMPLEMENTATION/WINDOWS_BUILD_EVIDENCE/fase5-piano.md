# Piano di Implementazione FASE 5 — Streaming della Risposta e Ottimizzazioni

**Data**: 23 Settembre 2026  
**Ambiente**: LIMEN Vault v4 (versione 0.4.0, Windows 11 Pro, Tauri / Rust)  
**Modello Predefinito Tassativo**: **`gpt-4o`**  
**Direttiva Approvata**: **Opzione A** (Strict JSON Schema mantenuto su Responses API, testo emesso progressivamente in streaming, citazioni certificate e convalidate crittograficamente a fine flusso).

---

## 1. Analisi delle Prestazioni Attuali e Metriche Mancanti

Nei registri effettivi di `C:\Users\user\.limen-vault\ask_timing.log`:
- **Preparazione locale del contesto (Preview)**: **1,0 – 2,5 s**
  - Lettura indice e cache: 17 – 23 ms
  - Embedding vettore della query (`bge-m3` locale): 72 – 91 ms
  - **Ricerca ibrida (search)**: **0,8 – 1,9 s** (frazione dominante del tempo locale)
  - Lettura documenti e catalog: 4 – 330 ms
  - Estrazione multi-passaggio e hash SHA-256: 0 – 240 ms
- **Chiamata remota OpenAI (`gpt-4o`)**: **3,6 – 6,2 s** (fino a 8,3 – 9,0 s con modelli alternativi)
- **Tempo totale visto da UI**: **5,8 – 10,3 s**

### Chiarimento sul Tempo di Comparsa del Testo
Nessuna previsione a priori sui secondi di comparsa del testo è ammessa:  
**Al tempo di preparazione locale va sommato il tempo necessario a OpenAI per restituire il primo frammento (Time to First Token / TTFT remoto), che finora non è mai stato misurato.**  
Nella FASE 5 verrà integrata nel backend la misurazione esatta del tempo trascorso tra l'invio della richiesta HTTP a OpenAI e la ricezione del primo frammento utile (`t_first_chunk_ms`), registrandola formalmente in `ask_timing.log` per consentire a Cesare di quantificarla con precisione.

---

## 2. Le Sei Correzioni e Specifiche Operative della FASE 5

### 1. Punto b) — Riferimenti Errati, Prima Misurare nel Registro
- **Correzione di attribuzione**: In `search.rs` non viene calcolato alcun vettore; le righe 440–510 indicizzate in precedenza gestiscono il frontmatter. Il calcolo della similarità semantica avviene interamente in `apps/desktop/src-tauri/src/embeddings.rs` (funzioni `rank_document_semantic` e `cosine_similarity`).
- **Misurazione preliminare nel log**: Prima di intraprendere qualunque ottimizzazione del codice di ricerca, viene aggiunta nel registro `ask_timing.log` la divisione puntuale del tempo di ricerca nelle sue 4 componenti effettive:
  1. **Ricerca per parole (`search_words_ms`)**: tempo della ricerca lessicale BM25 in `search::search_vault_filtered`;
  2. **Similarità semantica (`search_sem_ms`)**: tempo del calcolo vettoriale in `embeddings::rank_document_semantic` su tutti i passaggi del catalogo;
  3. **Fusione e ordinamento (`search_fuse_ms`)**: tempo di unione, normalizzazione min-max e ranking RRF in `embeddings.rs`;
  4. **Filtro di ammissibilità (`search_admit_ms`)**: tempo del filtro Punto E (`filter_candidates_punto_e` in `ai.rs`).
- **Regola di cautela vincolante**: Si ottimizzerà esclusivamente la componente che le misurazioni di Cesare indicheranno come collo di bottiglia, e solo a condizione di **non alterare in alcun modo i risultati** (stesse identiche fonti per BNXT, ARKAI e SCENA verificate sulla porta del servizio dell'app).

### 2. Punto c) — Fonti Mostrate Subito
- Non appena la fase locale di `preview` è completata (~1–2 s), l'interfaccia mostra immediatamente nella scheda "Chiedi" l'elenco dei documenti consultati a supporto della domanda (con titolo pulito e leggibile tramite `cleanTitle`), con l'etichetta *"Fonti consultate dal Vault per questa domanda (in attesa di risposta…)"*.
- Mentre il testo in streaming si compone, l'utente può già visualizzare l'elenco delle fonti estratte.
- Al termine dello streaming, i documenti effettivamente citati dal modello vengono evidenziati con il badge *"CITATA"* e compare l'etichetta trasparente definitiva:  
  **"Basata su N documenti citati tra M consultati"**.

### 3. Controllo di Integrità Post-Risposta (`verify_post`)
- Il controllo `verify_post` resta tassativo e obbligatorio prima di considerare valida la sessione.
- Con lo streaming, il testo è già apparso progressivamente a schermo: se `verify_post` fallisce (poiché uno dei documenti o passaggi è mutato su disco durante i secondi della chiamata), **il testo mostrato viene immediatamente sostituito da un avviso chiaro**:  
  > *"Un documento è cambiato durante la generazione: la risposta è stata annullata, riprova"*
- Nessuna citazione viene mostrata (`citations: []`).
- Un test unitario dedicato convalidi questa sostituzione protettiva.

### 4. Pulizia Durante lo Streaming (`sanitize_answer_prose`)
- Frammenti successivi dello stream SSE possono spezzare sigle o marcatori (es. `"[S"` nel frammento 1 e `"1]"` nel frammento 2, oppure `"*"` e `"*BNXT**"`).
- Per evitare che frammenti grezzi appaiano temporaneamente all'utente, viene implementato `StreamProseSanitizer` dotato di **sliding tail buffer**:
  - Trattiene la porzione terminale ambigua (fino a 10 caratteri) se coincide con un prefisso di sigla (`[`, `[S`, `(`) o di marcatore (`*`, `**`);
  - Emette verso la UI solo il testo certo e già pulito tramite `sanitize_answer_prose`;
  - A fine stream svuota l'eventuale residuo garantendo la totale assenza di sigle grezze o asterischi markdown.
- Test dedicati:
  - Frammenti spezzati `"[S"` + `"1]"` $\rightarrow$ non mostrano mai `[S1]`;
  - Frammenti spezzati `"**"` + `"BNXT**"` $\rightarrow$ non mostrano mai asterischi.

### 5. Risposte Interrotte
- Se lo streaming si interrompe (errore di rete, chiusura connessione, annullamento dell'utente o limite di token raggiunto prima della chiusura JSON):
  - Il testo parziale generato fino a quel momento resta visibile all'utente, accompagnato da un avviso esplicito e semplice di interruzione;
  - **Zero citazioni**: nessuna fonte viene contrassegnata come citata (`citations: []`) per prevenire attribuzioni parziali o non verificate.
- Questa regola viene formalmente sancita nel rapporto di implementazione.

### 6. Schema Responses API Rigoroso
- L'app utilizza e mantiene la Responses API di OpenAI (`text.format` JSON schema):
```json
{
  "model": "gpt-4o",
  "store": false,
  "max_output_tokens": 1500,
  "input": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "text": {
    "format": {
      "type": "json_schema",
      "name": "vault_answer",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "answer": { "type": "string" },
          "citation_ids": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]
            }
          }
        },
        "required": ["answer", "citation_ids"],
        "additionalProperties": false
      }
    }
  }
}
```
- Lo streaming SSE consuma esattamente lo stesso schema, preservando i controlli di `parse_response` (stato presente, esattamente un output_text, citazioni validate, conteggio token input, output e reasoning).

---

## 3. Todo List e Task List Tracciabile FASE 5

> [!IMPORTANT]
> **Modello Tassativo da Usare**: **`gpt-4o`** per tutte le sessioni e misurazioni di questa fase.

### Componente 1: Misurazione Dettagliata Ricerca nel Registro (`ask_timing.log`)
- [x] **1.1** Estendere `SearchPhaseTimings` in `embeddings.rs` per misurare separatamente `t_words_ms`, `t_sem_ms`, `t_fuse_ms`. *(Completato: misurazione separata in `hybrid_search_vault_with_vector_filtered_timed` e propagazione)*
- [x] **1.2** Misurare `t_admit_ms` in `ai.rs` durante l'esecuzione del filtro Punto E. *(Completato: misurato attorno a `filter_candidates_punto_e` in `select_with_port_timed`)*
- [x] **1.3** Aggiornare `PreviewTimingBreakdown` e la formattazione di `log_ask_timing_detailed` in `ai.rs` per riportare nel log la scomposizione esatta della ricerca (parole, semantica, fusione, ammissibilità). *(Completato: campi `search_words_ms`, `search_sem_ms`, `search_fuse_ms`, `search_admit_ms` e quadratura)*
- [x] **1.4** Misurare e registrare `t_first_chunk_ms` (Time to First Token remoto di OpenAI) al primo frammento SSE utile. *(Completato: integrato in `AskTimingBreakdown` e `AskTimingLogEntry`, misurazione in `ask_stream`)*

### Componente 2: Parser Incrementale e Sanitizer con Sliding Tail Buffer
- [x] **2.1** Implementare `StreamProseSanitizer` in `ai.rs` con sliding tail buffer per trattenere prefissi ambigui (`[`, `[S`, `*`, `**`). *(Completato: buffer circolare a coda mobile con calcolo parità asterischi e tag di citazione)*
- [x] **2.2** Test unitari dedicati per `StreamProseSanitizer`: convalidare che `"[S"` + `"1]"` non mostri sigle e `"**"` + `"BNXT**"` non mostri asterischi. *(Completato: `test_stream_prose_sanitizer_split_citations` e `test_stream_prose_sanitizer_split_bold_asterisks` superati)*
- [x] **2.3** Implementare `JsonStreamAnswerParser` per estrarre incrementale la stringa `answer` decodificando gli escape JSON (`\n`, `\"`, `\uXXXX`). *(Completato: parser a macchina a stati con buffer unicode e decodifica escape su confini di chunk)*
- [x] **2.4** Test unitari dedicati per `JsonStreamAnswerParser` (chunk spezzati, caratteri speciali, terminazione stream). *(Completato: `test_json_stream_answer_parser_decodes_escapes_and_unicode` superato)*

### Componente 3: Chiamata Streaming SSE e Controllo `verify_post`
- [x] **3.1** Modificare `ask_streaming` in `ai.rs` per consumare lo stream SSE di OpenAI mantenendo Strict Schema su Responses API con modello `gpt-4o`. *(Completato: implementato `ask_stream` con SSE reader e misurazione `t_first_chunk_ms`)*
- [x] **3.2** Integrare l'emissione di eventi Tauri `limen://ai-stream-chunk` verso la finestra attiva. *(Completato: emit via `tauri::Emitter` con payload ticket, frammento sanitizzato e flag stream)*
- [x] **3.3** Implementare la gestione di `verify_post` a fine stream: se fallisce, emissione evento con cancellazione testo, messaggio di annullamento e zero citazioni. *(Completato: payload `verify_post_failed` emesso con testo sostitutivo esatto)*
- [x] **3.4** Test unitario dedicato che simula il fallimento di `verify_post` post-streaming. *(Completato: `test_verify_post_failure_replaces_text_with_cancellation_message` superato)*
- [x] **3.5** Gestione risposte interrotte: preservazione testo parziale con avviso esplicito e zero citazioni. *(Completato: payload `interrupted` ed emissione gestiti, `test_interrupted_stream_preserves_partial_text_with_zero_citations` superato)*

### Componente 4: Frontend Desktop (React / TypeScript)
- [x] **4.1** In `apps/desktop/src/AiPanel.tsx`: Mostrare immediatamente le fonti consultate non appena la Preview è completata con titoli leggibili/puliti. *(Completato: blocco fonti consultate mostrato subito alla ricezione della preview)*
- [x] **4.2** In `apps/desktop/src/ai-ipc.ts`: Aggiungere listener eventi streaming Tauri e collegarli in `apps/desktop/src/AiPanel.tsx`. *(Completato: payload `AiStreamChunkPayload` e `AiStreamEndPayload`, listener registrati e puliti su unmount)*
- [x] **4.3** In `apps/desktop/src/AiPanel.tsx`: Visualizzare testo in streaming con cursore attivo; all'evento finale accendere i badge *"CITATA"* e l'etichetta *"Basata su N documenti citati tra M consultati"*. *(Completato: cursore pulsante durante lo streaming, badge CITATA e conteggio trasparente post-stream)*
- [x] **4.4** In `apps/desktop/src/AiPanel.tsx`: Gestire in UI la sostituzione del testo in caso di errore `verify_post` e l'avviso in caso di stream interrotto. *(Completato: messaggio di annullamento esatto su disallineamento sorgenti e banner per stream interrotto)*
- [x] **4.5** Modello predefinito `gpt-4o` (selezione modelli FASE 4 da account e salvataggio in `ai_settings.json` invariati; se vuoto, valore iniziale proposto `gpt-4o`). *(Completato: fallback gpt-4o iniziale mantenendo la selezione e persistenza)*

### Componente 5: Verifica, Test e Consegna (FASE 5)
- [x] **5.1** Esecuzione test suite completa in parallelo salvata in `cargo-test-fase-5-parallel.log`. *(Completato: 150/150 test lib e 18/18 test bin superati)*
- [x] **5.2** Esecuzione test suite sequenziale salvata in `cargo-test-fase-5-single.log`. *(Completato: superata con `--test-threads=1`)*
- [x] **5.3** Verifica statica frontend con `npx tsc --noEmit`. *(Completato: 0 errori TypeScript)*
- [x] **5.4** Commit git e generazione `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-5.patch`.
- [x] **5.5** Aggiornamento di `SESSION_HANDOVER_WINDOWS_BUILD.md`.

### Componente 6: FASE 5b — Correzione Quattro Difetti in ask_stream
- [x] **6.1** Caratteri UTF-8 spezzati: buffer di decodifica `Utf8ChunkDecoder` che trattiene sequenze multibyte incomplete sui confini dei chunk di rete senza emettere replacement char ``. *(Completato con `test_utf8_chunk_decoder_split_multibyte_character`: "è" spezzato in 2 chunk da 1 byte produce "è")*
- [x] **6.2** `verify_post` rifiuta OGNI errore (inclusi "Document access denied" e "Generated source obsolete or modified"): annullamento risposta, testo sostituito da avviso chiaro, zero citazioni. *(Completato con `test_verify_post_rejects_document_access_denied_and_obsolete_source`)*
- [x] **6.3** Nessuno stato inventato: senza evento finale `response.completed` dal provider, trattata come risposta incompleta (`status: "incomplete"`), testo parziale con avviso esplicito, zero citazioni. *(Completato con `test_missing_response_completed_treated_as_interrupted_with_zero_citations`)*
- [x] **6.4** Errore di rete durante lo streaming: trattato come interruzione con preservazione testo parziale, zero citazioni e motivo registrato nel log di timing `ask_timing.log`. *(Completato con `test_streaming_network_error_treated_as_interrupted_with_reason`)*
- [x] **6.5** Rimozione ramo non usato `choices[0].delta.content` (formato Chat Completions, non usato con Responses API).
- [x] **6.6** Suite completa 154 test lib + 18 test integrazione = 172 test verdi sia in parallelo che sequenziali (`--test-threads=1`).
- [x] **6.7** Commit git, generazione `fase-5b.patch`, aggiornamento `SESSION_HANDOVER_WINDOWS_BUILD.md`.
- [x] **6.8** STOP operativo per la prova di Cesare.

---

## 4. Regole Operative Tassative
- **ZERO chiamate a OpenAI eseguite dall'assistente**.
- **ZERO processi arrestati o riavviati**.

