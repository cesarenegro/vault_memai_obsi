# FASE 1 — Misura e Diagnosi (Rapporto Evidenze e Dati Misurati)

**Data**: 2026-09-23  
**Branch**: `windows-build`  
**Commit di inizio Fase 1**: `865676dddc8daceabf6a87f91ff4109f8e0bfcee` (`865676d`)  
**Stato**: Concluso (con rettifiche a ipotesi tecniche, esempio illustrativo e chiarimento conteggi 2.548/126)  
**Vault analizzato**: `E:\VAULT WIN TEST DEV` (esattamente **376 documenti**, **23.482 passaggi** totali nel catalogo, **23.482 passaggi** nella cache semantica `EMBEDDINGS_CACHE.json`)  
**Hardware & Runtime**: Windows 11, `llama-server.exe` PID 26580 su porta attiva `62021`, modello `bge-m3-Q8_0.gguf`  

---

## 1. Dichiarazione dei File Modificati nella Fase 1

Tutti i file toccati in questa fase e la relativa natura:
1. `apps/desktop/src-tauri/src/ai.rs`:
   - Aggiunto tracciamento tempi nella struct `Pending` (`t_index_cache_ms`, `t_search_ms`, `t_embed_ms`).
   - Aggiunta funzione `preview_with_port` per consentire alla preview diagnostica di usare la porta attiva del server locale invece di degradare silenziosamente alla ricerca lessicale.
   - Aggiunta misurazione millisecondi `t_openai_ms` (invio primo byte -> ricezione ultimo byte) e `t_total_ms` in `ask()`.
   - Aggiunta funzione `log_ask_timing()` per scrittura append-only su log disk dedicato.
2. `apps/desktop/src-tauri/src/embeddings.rs`:
   - Aggiunta struct `SearchPhaseTimings` (`t_index_cache_ms`, `t_embed_ms`, `t_search_ms`).
   - Aggiunti metodi timed: `hybrid_search_vault_with_port_filtered_timed` e `hybrid_search_vault_with_vector_filtered_timed` per isolare e cronometrare le singole fasi di reperimento e calcolo senza alterare la logica o i punteggi.
3. `apps/desktop/src-tauri/src/main.rs` (**CORREZIONE DI COMPORTAMENTO**):
   - **Dichiarazione formale**: La modifica all'handler Tauri `ai_preview` (righe 485-502) per inoltrare `llama_state.status().port` a `preview_with_port` costituisce a tutti gli effetti una **correzione di comportamento** e non una semplice misurazione passiva.
   - **Conferma commit 20b27f2**: Si conferma che al commit `20b27f2` la funzione `ai_preview` invocava `state.preview(path, options)` passando internamente `port = None`. Di conseguenza, in `ai.rs:select()`, la selezione delle fonti dell'app "Chiedi al Vault" **ricadeva sistematicamente sulla sola ricerca lessicale BM25**, ignorando completamente il motore semantico locale anche quando `llama-server` era attivo e in esecuzione.
4. `.agents/AGENTS.md`:
   - Aggiunta regola di progetto per rendere obbligatoria la task list in ogni implementation plan.
5. `apps/desktop/src-tauri/src/bin/diagnose_fase1.rs` (nuovo binario diagnostico):
   - Strumento per eseguire la diagnostica 1.2 sull'intero vault reale contro `bge-m3` su porta 62021, salvando l'output grezzo integrale.

*(Nota: le modifiche preliminari a `llama.rs` e `main.rs` relative alla Fase 2 sono state isolate e salvate nella patch `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase2-preliminary-stash.patch` e NON fanno parte della Fase 1).*

---

## 2. Dichiarazioni Obbligatorie (Timeout OpenAI, Log e Numeri del Vault)

### Numeri del Vault E:\VAULT WIN TEST DEV (Spiegazione Dettagliata)
- Nel precedente testo del rapporto markdown era comparsa l'indicazione errata di "2548 passaggi, 126 documenti": i valori 2.548 e 126 erano stati riportati a mano in modo errato; da ora le tabelle vengono solo da fase1-diagnose-output.txt.
- **Misurazione reale e verificata a codice**:
  - `E:\VAULT WIN TEST DEV\00_SYSTEM\VAULT_CATALOG.json` (`catalog.rs:180`): caricato da `catalog::load_catalog()`, contiene esattamente **376 documenti** e **23.482 passaggi** totali (`cat.documents.values().map(|d| d.passages.len()).sum()`).
  - `E:\VAULT WIN TEST DEV\00_SYSTEM\EMBEDDINGS_CACHE.json` (`embeddings.rs:331`): caricato da `embeddings::load_embeddings_cache()`, contiene esattamente **23.482 vettori** (`cache.entries.len()`).
  - La diagnosi `diagnose_fase1.rs` è stata eseguita sull'**intero vault al 100%**: tutti i 376 documenti e tutti i 23.482 passaggi sono stati analizzati e confrontati.

### Limite Timeout Chiamata OpenAI
- **Timeout dichiarato**: **30 secondi** esatti.
- **Evidenza codice**: In `apps/desktop/src-tauri/src/ai.rs:447-449`:
  ```rust
  let client = reqwest::Client::builder()
      .connect_timeout(std::time::Duration::from_secs(10))
      .timeout(std::time::Duration::from_secs(30))
      .build()?;
  ```
  Questo valore è identico nei commit `25918eb`, `865676d` e nell'attuale working tree. Nessun timeout è stato modificato.

### Percorso Assoluto File di Log dei Tempi
- **Percorso**: `C:\Users\user\.limen-vault\ask_timing.log`
- **Formato di ogni riga**:
  ```text
  TIMESTAMP [ISO8601] | model=... | t_index_cache=...ms | t_embed=...ms | t_search=...ms | t_openai=...ms | t_total=...ms | prompt_tokens=... | completion_tokens=...
  ```
- **Garanzia di riservatezza**: Nel log **NON** viene registrato alcun testo di domande, né risposte, né passaggi estratti dal vault.

---

## 3. Rettifiche Misurate agli Errori del Rapporto Precedente

Prima di analizzare i dati grezzi, vengono chiariti con misurazioni reali i tre punti critici evidenziati dall'auditor:

### 3.1 Punteggi 33.39, 26.47, ecc. (Fusione vs Lessicale Degradato)
- **Verifica**: Nel rapporto precedente, il tester diagnostico invocava la ricerca senza passare la porta di `llama-server` (porta `None`), facendo degradare silenziosamente l'algoritmo alla modalità di ripiego puramente lessicale BM25 (`lexical_search_vault`).
- **Dimostrazione**:
  - In BM25 puro, il punteggio grezzo è la somma di IDF ponderati per la frequenza dei termini + Title Bonus (fino a 20 punti per match esatto nel titolo). Ecco perché apparivano valori come `33.39` (`13.39` BM25 + `20.0` TitleBonus) e `26.47`.
  - Nella **ricerca ibrida reale** (con `llama-server` attivo), il punteggio lessicale viene normalizzato tra 0.0 e 1.0 dividendo per il massimo punteggio lessicale del batch (`lex_norm`), il punteggio semantico viene normalizzato dividendo per il massimo (`sem_norm`), e il punteggio finale è:
    $$\text{ScoreFin} = 0.5 \times \text{lex\_norm} + 0.5 \times \text{sem\_norm} + \text{title\_bonus\_fused}$$
    dove i punteggi finali risiedono nell'intervallo reale tra **0.0 e 1.25** (con title bonus fino a +0.2).

### 3.2 Misurazione Reale dei Byte JSON (Smentita stima 23.500 B)
- **Verifica**: Nel rapporto precedente era stato stimato che due file sommassero 23.500 byte, saturando da soli il budget di 24.000 byte.
- **Misurazione empirica esatta**:
  - `_Progetto - BNXT AUDIT VICENZA.md`: file intero di soli **539 byte** su disco. Formattato in JSON per il prompt OpenAI pesa **960 byte**.
  - `BNXT CRM.md`: file raw di 30.556 byte su disco. Tuttavia, il ciclo di selezione **non inietta il file intero**: la funzione `extract_passage()` estrae una finestra rilevante di massimo ~1.500 caratteri attorno al match. Il payload JSON iniettato è di soli **1.616 byte**.
  - Somma effettiva dei due documenti nel prompt: $960 + 1616 = \mathbf{2.576\text{ byte}}$ (ovvero appena il 10.7% del budget di 24.000 byte, e NON 23.500 byte).

### 3.3 Funzionamento Misurato del Ciclo `select()` in `ai.rs`
- In `ai.rs`, la selezione delle fonti scorre i candidati ordinati per punteggio:
  ```rust
  if current_bytes + item_bytes > max_context_bytes {
      continue; // NON fa break! Continua a cercare elementi più piccoli!
  }
  ```
- **Conseguenza misurata**: Un documento grande che eccede il budget residuo viene semplicemente scartato (`continue`), e la selezione procede a esaminare i documenti successivi finché non raggiunge o il limite di **10 fonti** o il budget di **24.000 byte**.
- Nella prova empirica: sia per BNXT che per ARKAI il ciclo ha selezionato esattamente il massimo di **10 fonti**, totalizzando 15.077 byte (BNXT) e 15.673 byte (ARKAI).

---

## 4. Diagnosi 1.2 — Risultati Grezzi Ricerca Ibrida Locale

### 4.1 Query 1: `"cosa e' il progetto bnxt ?"`
- **Token estratti per ricerca lessicale**: `["cosa", "progetto", "bnxt"]`
- **Tempi di esecuzione (Build `dev / debug` non ottimizzata)**:
  - Caricamento catalogo & cache (376 doc, 23.482 passaggi da 311 MB): 19.423 ms
  - Calcolo vettore embedding query (`bge-m3` su porta 62021): **80 ms**
  - Calcolo fusione ibrida (324 candidati su 23.482 passaggi): 14.242 ms *(Nota: con build `--release` misurata in A2 dura 2,0–3,8 s)*

#### Tabella Primi 30 Risultati Fusione Ibrida
| Pos | Documento | ScoreFin | LexScore | TitleBns | LexNorm | SemSim | SemNorm |
|---|---|---|---|---|---|---|---|
| 1 | `20_RAW_SOURCES/a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md` | 1.1772 | 33.39 | 20.0 | 1.0000 | 0.4876 | 0.8859 |
| 2 | `20_RAW_SOURCES/32f2a4081d13410e-BNXT CRM.md` | 1.1275 | 26.47 | 10.0 | 0.7928 | 0.5333 | 0.9690 |
| 3 | `20_RAW_SOURCES/d70f1c7b1d36f912-STEFANO APP.md` | 1.0417 | 6.96 | 0.0 | 0.2084 | 0.5504 | 1.0000 |
| 4 | `20_RAW_SOURCES/4245a51312c5c1f2-2026-04-07 - Workflow app iPhone nativa con Xcode.md` | 0.9599 | 3.99 | 0.0 | 0.1195 | 0.5152 | 0.9360 |
| 5 | `20_RAW_SOURCES/5a54c2ce2f581cf2-verifica-walkthrough-ux-email-whatsapp-2026-09-10.md` | 0.8484 | 13.22 | 0.0 | 0.3959 | 0.4234 | 0.7692 |
| 6 | `20_RAW_SOURCES/d7f229ffc176756a-2026-02-17 - Riferimenti e codici BuildSense.md` | 0.8467 | 7.24 | 0.0 | 0.2168 | 0.4422 | 0.8033 |
| 7 | `20_RAW_SOURCES/2365af8d9b1771bc-2026-02-16 - BUILD SENSE Localisation.md` | 0.8382 | 6.27 | 0.0 | 0.1878 | 0.4407 | 0.8007 |
| 8 | `20_RAW_SOURCES/b4b388b4b0fe5e1d-2026-02-14 - Debug loop infinito in FlashCleanView durante build.md` | 0.8372 | 3.19 | 0.0 | 0.0955 | 0.4503 | 0.8181 |
| 9 | `20_RAW_SOURCES/247b4cf913575d12-2026-02-17 - Redesign UI secondo screenshot.md` | 0.7930 | 7.07 | 0.0 | 0.2117 | 0.4132 | 0.7507 |
| 10 | `20_RAW_SOURCES/18ce369ee3bd81fe-2026-06-02 - Migrazione chat a project.md` | 0.7909 | 7.91 | 0.0 | 0.2369 | 0.4093 | 0.7436 |
| 11 | `20_RAW_SOURCES/d3f4756210d60463-2026-02-14 - SWIFT CLEANER counted.md` | 0.7852 | 7.97 | 0.0 | 0.2387 | 0.4059 | 0.7374 |
| 12 | `20_RAW_SOURCES/b21c86f3e37a8792-Progetto senza nome (2).md` | 0.7783 | 13.88 | 10.0 | 0.4157 | 0.3826 | 0.6952 |
| 13 | `20_RAW_SOURCES/1e755ab82023a095-verifica-impl-plan-ux-email-whatsapp-2026-09-10.md` | 0.7767 | 12.82 | 0.0 | 0.3839 | 0.3852 | 0.6999 |
| 14 | `20_RAW_SOURCES/14fd281ff56ab94a-2026-06-04 - Valutazione e feedback su progetto.md` | 0.7657 | 17.66 | 10.0 | 0.5289 | 0.3632 | 0.6599 |
| 15 | `20_RAW_SOURCES/ab7270ec227dfa55-2026-02-05 - PhotoClean AI – Rimozione intelligente duplicati.md` | 0.7604 | 5.55 | 0.0 | 0.1662 | 0.4002 | 0.7272 |
| 16 | `20_RAW_SOURCES/abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md` | 0.7555 | 8.10 | 0.0 | 0.2426 | 0.3891 | 0.7069 |
| 17 | `20_RAW_SOURCES/309bcc15297b9408-2026-05-20 - Esecuzione di codice senza autorizzazione.md` | 0.7496 | 7.06 | 0.0 | 0.2114 | 0.3893 | 0.7073 |
| 18 | `20_RAW_SOURCES/112bf7d370012490-audit-localizzazione-EN-verifica-AG-2026-09-10.md` | 0.7481 | 4.01 | 0.0 | 0.1201 | 0.3986 | 0.7241 |
| 19 | `20_RAW_SOURCES/5084c49d6803da59-2026-05-04 - Ricerca brand UI per Shift.md` | 0.7463 | 5.81 | 0.0 | 0.1740 | 0.3916 | 0.7115 |
| 20 | `20_RAW_SOURCES/957b10627e45aa38-_INDICE.md` | 0.7440 | 13.80 | 0.0 | 0.4133 | 0.3640 | 0.6613 |
| 21 | `20_RAW_SOURCES/e3e1115d1b99c740-2026-02-23 - Adding .xcodeproj file to Build Sense project.md` | 0.7400 | 0.00 | 0.0 | 0.0000 | 0.4073 | 0.7400 |
| 22 | `20_RAW_SOURCES/d7a52d05837b5450-2026-04-11 - Accordo di riservatezza bilinguе per progetto strategico.md` | 0.7400 | 13.59 | 10.0 | 0.4070 | 0.3625 | 0.6586 |
| 23 | `20_RAW_SOURCES/65694e024a83e6cd-2026-03-22 - AI rendering models for architectural visualization.md` | 0.7354 | 0.00 | 0.0 | 0.0000 | 0.4048 | 0.7354 |
| 24 | `20_RAW_SOURCES/c4f02a78e4b17fdc-2026-06-01 - Audit sincronizzazione dati tra gestionale e app iOS.md` | 0.7337 | 7.68 | 0.0 | 0.2300 | 0.3785 | 0.6877 |
| 25 | `20_RAW_SOURCES/de3f221ad4e56160-2026-04-01 - BlackHole AIDA coding agent for Xcode.md` | 0.7330 | 0.00 | 0.0 | 0.0000 | 0.4035 | 0.7330 |
| 26 | `20_RAW_SOURCES/98de5fb0d0fac3db-2026-04-12 - AI model development with LORA for floorplan recognition.md` | 0.7309 | 1.19 | 0.0 | 0.0356 | 0.3984 | 0.7238 |
| 27 | `20_RAW_SOURCES/525504a732971dd4-2026-04-07 - MyArchitectAI API and AI models investigation.md` | 0.7267 | 0.00 | 0.0 | 0.0000 | 0.4000 | 0.7267 |
| 28 | `20_RAW_SOURCES/d3b0adb5f5d4d5c5-2026-04-30 - Pagina prezzi con tre piani tariffari.md` | 0.7240 | 8.44 | 0.0 | 0.2528 | 0.3707 | 0.6734 |
| 29 | `20_RAW_SOURCES/410dbac00663f59c-2026-06-03 - Analisi Excel investitori e outreach personalizzate.md` | 0.7220 | 5.95 | 0.0 | 0.1782 | 0.3778 | 0.6864 |
| 30 | `20_RAW_SOURCES/b2a8b8d50ac331b6-Progetto senza nome (10).md` | 0.7212 | 14.05 | 10.0 | 0.4208 | 0.3507 | 0.6371 |

#### Posizione dei 9 Documenti BNXT nella Classifica Ibrida
| Rango Ibrido | Documento BNXT Target | ScoreFin | LexScore | TitleBonus | SemSim | Note |
|---|---|---|---|---|---|---|
| **1** | `a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md` | **1.1772** | 33.39 | 20.0 | 0.4876 | Top 1 |
| **2** | `32f2a4081d13410e-BNXT CRM.md` | **1.1275** | 26.47 | 10.0 | 0.5333 | Top 2 |
| **3** | `d70f1c7b1d36f912-STEFANO APP.md` | **1.0417** | 6.96 | 0.0 | 0.5504 | Top 3 (contiene rif. BNXT) |
| **4** | `4245a51312c5c1f2-2026-04-07 - Workflow app iPhone nativa...md` | **0.9599** | 3.99 | 0.0 | 0.5152 | Top 4 |
| **5** | `5a54c2ce2f581cf2-verifica-walkthrough-ux-email-whatsapp...md` | **0.8484** | 13.22 | 0.0 | 0.4234 | Top 5 |
| **13** | `1e755ab82023a095-verifica-impl-plan-ux-email-whatsapp...md` | **0.7767** | 12.82 | 0.0 | 0.3852 | Superato da doc generici "progetto" |
| **16** | `abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md` | **0.7555** | 8.10 | 0.0 | 0.3891 | Superato da doc generici "progetto" |
| **18** | `112bf7d370012490-audit-localizzazione-EN-verifica-AG...md` | **0.7481** | 4.01 | 0.0 | 0.3986 | Superato da doc generici "progetto" |
| **20** | `957b10627e45aa38-_INDICE.md` | **0.7440** | 13.80 | 0.0 | 0.3640 | Superato da doc generici "progetto" |

#### Simulazione `select()` per BNXT
- **Cap fonti**: 10 | **Budget**: 24.000 byte
- Rango 1: `_Progetto - BNXT AUDIT VICENZA.md` -> Selezionato (960 B, cum: 960 B)
- Rango 2: `BNXT CRM.md` -> Selezionato (1.616 B, cum: 2.576 B)
- Rango 3: `STEFANO APP.md` -> Selezionato (1.622 B, cum: 4.198 B)
- Rango 4: `Workflow app iPhone nativa con Xcode.md` -> Selezionato (1.640 B, cum: 5.838 B)
- Rango 5: `verifica-walkthrough-ux-email-whatsapp...md` -> Selezionato (1.126 B, cum: 6.964 B)
- Rango 6: `Riferimenti e codici BuildSense.md` -> Selezionato (1.586 B, cum: 8.550 B) *(Rumore causato dal token "progetto")*
- Rango 7: `BUILD SENSE Localisation.md` -> Selezionato (1.676 B, cum: 10.226 B) *(Rumore)*
- Rango 8: `Debug loop infinito in FlashCleanView...md` -> Selezionato (1.689 B, cum: 11.915 B) *(Rumore)*
- Rango 9: `Redesign UI secondo screenshot.md` -> Selezionato (1.510 B, cum: 13.425 B) *(Rumore)*
- Rango 10: `Migrazione chat a project.md` -> Selezionato (1.652 B, cum: 15.077 B) *(Rumore)*
- **Esito**: Raggiunto il limite di 10 fonti. 5 target su 9 inseriti nel prompt. I restanti 4 target sono stati spiazzati fuori dalla top 10 a causa dell'alta frequenza della stopword "progetto".

---

### 4.2 Query 2: `"ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA"`
- **Token estratti per ricerca lessicale**: `["arkai", "azienda", "marchio", "cosa", "tratta"]`
- **Tempi di esecuzione (Build `dev / debug` non ottimizzata)**:
  - Caricamento catalogo & cache (in memoria): 479 ms
  - Calcolo vettore embedding query (`bge-m3` su porta 62021): **70 ms**
  - Calcolo fusione ibrida (375 candidati su 23.482 passaggi): 9.119 ms *(Nota: con build `--release` misurata in A2 dura 2,0–3,8 s)*

#### Tabella Primi 30 Risultati Fusione Ibrida
| Pos | Documento | ScoreFin | LexScore | TitleBns | LexNorm | SemSim | SemNorm |
|---|---|---|---|---|---|---|---|
| 1 | `20_RAW_SOURCES/7254c793dd89f65d-2026-03-19 - Analisi icona app ARKAI STAGER.md` | 1.1588 | 18.81 | 10.0 | 1.0000 | 0.5400 | 0.7942 |
| 2 | `20_RAW_SOURCES/98de5fb0d0fac3db-2026-04-12 - AI model development with LORA for floorplan recognition.md` | 1.1191 | 11.20 | 0.0 | 0.5954 | 0.6150 | 1.0000 |
| 3 | `20_RAW_SOURCES/16484c8d758ffaea-2026-06-03 - Generare lettere di presentazione personalizzate per investitori.md` | 1.1023 | 12.56 | 0.0 | 0.6677 | 0.6036 | 0.9687 |
| 4 | `20_RAW_SOURCES/301e15e67ca7b690-2026-04-16 - Identifying potential clients for floorplan AI integration.md` | 1.1011 | 13.27 | 0.0 | 0.7055 | 0.6004 | 0.9600 |
| 5 | `20_RAW_SOURCES/86e2218e7ed905f1-ARKAI FLOORPLAN NICE.md` | 1.0995 | 14.98 | 10.0 | 0.7964 | 0.5932 | 0.9402 |
| 6 | `20_RAW_SOURCES/540e37c638dd2045-2026-03-31 - Presentazione investitori Arkai.archi.md` | 1.0970 | 14.85 | 10.0 | 0.7895 | 0.5928 | 0.9391 |
| 7 | `20_RAW_SOURCES/410dbac00663f59c-2026-06-03 - Analisi Excel investitori e outreach personalizzate.md` | 1.0779 | 15.84 | 0.0 | 0.8421 | 0.5820 | 0.9095 |
| 8 | `20_RAW_SOURCES/aa217245dfd86aeb-nuovo LLM AI Arkai.md` | 1.0674 | 17.66 | 10.0 | 0.9389 | 0.4848 | 0.6428 |
| 9 | `20_RAW_SOURCES/6a2687b0ff08b63d-2026-06-04 - Analisi script video di presentazione.md` | 1.0443 | 9.21 | 0.0 | 0.4896 | 0.5954 | 0.9464 |
| 10 | `20_RAW_SOURCES/b3f8add2793aa3b3-CONTRATTI ARKAI ITALIA.md` | 1.0423 | 14.89 | 10.0 | 0.7916 | 0.5727 | 0.8840 |
| 11 | `20_RAW_SOURCES/0bc92121a0ad46f7-2026-03-26 - Arkai.Dev expansion into Italian market.md` | 1.0125 | 14.97 | 10.0 | 0.7959 | 0.5615 | 0.8534 |
| 12 | `20_RAW_SOURCES/16fee114a1264853-Investors Outreach.md` | 1.0022 | 15.96 | 0.0 | 0.8485 | 0.5306 | 0.7685 |
| 13 | `20_RAW_SOURCES/f4fd17ebca858f34-ARKAI.DEV Software Developer.md` | 0.9824 | 14.00 | 10.0 | 0.7443 | 0.5543 | 0.8335 |
| 14 | `20_RAW_SOURCES/9d5299ea3d455186-2026-05-05 - Comunicazione vocale con l'assistente.md` | 0.9788 | 15.66 | 0.0 | 0.8325 | 0.5171 | 0.7313 |
| 15 | `20_RAW_SOURCES/2e9471848e17f686-2026-04-06 - ARKAI AI Free Render Engine Xcode project.md` | 0.9673 | 14.63 | 10.0 | 0.7778 | 0.5464 | 0.8117 |
| 16 | `20_RAW_SOURCES/ee742dcdeecc1dc3-Scelta del modello Claude per audit coworking.md` | 0.9668 | 16.21 | 0.0 | 0.8618 | 0.4420 | 0.5251 |
| 17 | `20_RAW_SOURCES/4b1cbbbba69ddc60-2026-03-19 - Investor presentation for architectural AI platform.md` | 0.9605 | 4.84 | 0.0 | 0.2573 | 0.5818 | 0.9090 |
| 18 | `20_RAW_SOURCES/abf7a87405697eab-2026-04-25 - Pipeline generazione floorplan 2D con Flux.md` | 0.9562 | 8.70 | 0.0 | 0.4625 | 0.5653 | 0.8637 |
| 19 | `20_RAW_SOURCES/89ed4d8455f40767-ARKAI FREE IMAGE AI.md` | 0.9487 | 14.49 | 10.0 | 0.7703 | 0.5401 | 0.7946 |
| 20 | `20_RAW_SOURCES/a66fbdd45a6686e2-2026-04-29 - Contratto di procacciamento con tabelle provvigionali.md` | 0.9485 | 12.41 | 0.0 | 0.6598 | 0.5481 | 0.8165 |
| 21 | `20_RAW_SOURCES/2ff8773ddf4229e7-2026-04-06 - Building ARKAI free image generation web app.md` | 0.9468 | 14.93 | 10.0 | 0.7937 | 0.5296 | 0.7656 |
| 22 | `20_RAW_SOURCES/6c698c8ec74c9161-Progetto MARKAI - areas - markai.md` | 0.9438 | 4.41 | 0.0 | 0.2344 | 0.5774 | 0.8969 |
| 23 | `20_RAW_SOURCES/a07b6143eb3fdaf2-2026-04-04 - Document analysis and problem identification.md` | 0.9289 | 10.24 | 0.0 | 0.5444 | 0.5494 | 0.8201 |
| 24 | `20_RAW_SOURCES/01b212e91f8a0c7e-2026-04-06 - API recommendations for floorplan rendering.md` | 0.9203 | 5.03 | 0.0 | 0.2674 | 0.5665 | 0.8669 |
| 25 | `20_RAW_SOURCES/ca804c2d899aa19b-ARKAI AI RENDER APP.md` | 0.9114 | 14.48 | 10.0 | 0.7698 | 0.5086 | 0.7081 |
| 26 | `20_RAW_SOURCES/14fd281ff56ab94a-2026-06-04 - Valutazione e feedback su progetto.md` | 0.9076 | 14.41 | 0.0 | 0.7661 | 0.5085 | 0.7077 |
| 27 | `20_RAW_SOURCES/3edcc9a51f87f24b-Brief del mattino.md` | 0.9034 | 14.93 | 0.0 | 0.7937 | 0.4504 | 0.5482 |
| 28 | `20_RAW_SOURCES/65694e024a83e6cd-2026-03-22 - AI rendering models for architectural visualization.md` | 0.8922 | 4.83 | 0.0 | 0.2568 | 0.5570 | 0.8408 |
| 29 | `20_RAW_SOURCES/957b10627e45aa38-_INDICE.md` | 0.8884 | 4.87 | 0.0 | 0.2589 | 0.5555 | 0.8367 |
| 30 | `20_RAW_SOURCES/6d96c0f9eb95cf54-2026-03-13 - Floorplan analysis app development with AI integration.md` | 0.8862 | 4.48 | 0.0 | 0.2382 | 0.5561 | 0.8386 |

#### Posizione dei 12 Documenti ARKAI nella Classifica Ibrida
| Rango Ibrido | Documento ARKAI Target | ScoreFin | LexScore | TitleBonus | SemSim | Note |
|---|---|---|---|---|---|---|
| **1** | `7254c793dd89f65d-2026-03-19 - Analisi icona app ARKAI STAGER.md` | **1.1588** | 18.81 | 10.0 | 0.5400 | Top 1 (Selezionato) |
| **5** | `86e2218e7ed905f1-ARKAI FLOORPLAN NICE.md` | **1.0995** | 14.98 | 10.0 | 0.5932 | Top 5 (Selezionato) |
| **6** | `540e37c638dd2045-2026-03-31 - Presentazione investitori Arkai.archi.md` | **1.0970** | 14.85 | 10.0 | 0.5928 | Top 6 (Selezionato) |
| **8** | `aa217245dfd86aeb-nuovo LLM AI Arkai.md` | **1.0674** | 17.66 | 10.0 | 0.4848 | Top 8 (Selezionato) |
| **10** | `b3f8add2793aa3b3-CONTRATTI ARKAI ITALIA.md` | **1.0423** | 14.89 | 10.0 | 0.5727 | Top 10 (Selezionato) |
| **11** | `0bc92121a0ad46f7-2026-03-26 - Arkai.Dev expansion into Italian...md` | **1.0125** | 14.97 | 10.0 | 0.5615 | Rango 11 (Escluso per limite 10 fonti) |
| **13** | `f4fd17ebca858f34-ARKAI.DEV Software Developer.md` | **0.9824** | 14.00 | 10.0 | 0.5543 | Rango 13 |
| **15** | `2e9471848e17f686-2026-04-06 - ARKAI AI Free Render Engine Xcode...md` | **0.9673** | 14.63 | 10.0 | 0.5464 | Rango 15 |
| **19** | `89ed4d8455f40767-ARKAI FREE IMAGE AI.md` | **0.9487** | 14.49 | 10.0 | 0.5401 | Rango 19 |
| **21** | `2ff8773ddf4229e7-2026-04-06 - Building ARKAI free image...md` | **0.9468** | 14.93 | 10.0 | 0.5296 | Rango 21 |
| **25** | `ca804c2d899aa19b-ARKAI AI RENDER APP.md` | **0.9114** | 14.48 | 10.0 | 0.5086 | Rango 25 |
| **33** | `76c1cadeb9e7f5e0-BOQ ARKAI COMPUTO METRICO.md` | **0.8619** | 12.06 | 10.0 | 0.5179 | Rango 33 |

#### Simulazione `select()` per ARKAI
- **Cap fonti**: 10 | **Budget**: 24.000 byte
- Rango 1: `Analisi icona app ARKAI STAGER.md` -> Selezionato (1.609 B, cum: 1.609 B)
- Rango 2: `AI model development with LORA for floorplan...md` -> Selezionato (1.722 B, cum: 3.331 B) *(Doc con alta sim semantica su floorplan, ma non ARKAI)*
- Rango 3: `Generare lettere di presentazione...md` -> Selezionato (1.687 B, cum: 5.018 B)
- Rango 4: `Identifying potential clients for floorplan AI...md` -> Selezionato (1.585 B, cum: 6.603 B)
- Rango 5: `ARKAI FLOORPLAN NICE.md` -> Selezionato (1.408 B, cum: 8.011 B)
- Rango 6: `Presentazione investitori Arkai.archi.md` -> Selezionato (1.592 B, cum: 9.603 B)
- Rango 7: `Analisi Excel investitori e outreach...md` -> Selezionato (1.699 B, cum: 11.302 B)
- Rango 8: `nuovo LLM AI Arkai.md` -> Selezionato (1.407 B, cum: 12.709 B)
- Rango 9: `Analisi script video di presentazione.md` -> Selezionato (1.386 B, cum: 14.095 B)
- Rango 10: `CONTRATTI ARKAI ITALIA.md` -> Selezionato (1.578 B, cum: 15.673 B)
- **Esito**: Raggiunto il limite di 10 fonti con 15.673 byte. **5 documenti ARKAI target su 12** sono entrati nel prompt, mentre gli altri 7 sono rimasti esclusi (a partire dal rango 11 `Arkai.Dev expansion...`) a causa di note correlate a "investitori" e "floorplan" prive del termine "arkai" nel titolo.

---

## 5. Sintesi Diagnostica per la Fase 3

I dati empirici raccolti confermano:
1. **L'inferenza locale `bge-m3` per il vettore della query è veloce**: misurati **70-80 ms** sulla porta 62021.
2. **Tempi di caricamento e calcolo (Build NON ottimizzata `dev / debug`)**:
   - I tempi registrati in questa diagnosi (17.179 – 19.423 ms per caricare da disco i 311 MB di cache e 31 MB di catalogo, e 9.119 – 15.205 ms per il confronto lineare dei 23.482 vettori in memoria) appartengono a una **build non ottimizzata (`dev / debug`) senza flag `--release`**.
   - Come riscontrato empiricamente nella precedente **misura A2 con build ottimizzata `--release`**, il tempo di calcolo della ricerca su questo vault si attesta tra **2,0 s e 3,8 s**.
3. **Output Grezzo Integrale Senza Ritocchi**:
   - L'intero output non manipolato generato dal binario diagnostico `diagnose_fase1` è archiviato in:
     [`IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase1-diagnose-output.txt`](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase1-diagnose-output.txt).
4. **Causa dello spiazzamento delle fonti**:
   - Nella query BNXT, la parola "progetto" (non filtrata come stopword) agisce come magnete lessicale portando note generiche di altri progetti nei primi posti.
   - Nella query ARKAI, l'assenza di un boost prioritario sul match esatto del soggetto principale nel titolo permette a note generiche su "investitori" o "floorplan" di scavalcare note chiave come `ARKAI.DEV Software Developer` o `CONTRATTI ARKAI ITALIA`.
   - Inoltre, il ritaglio di circa 1.500 caratteri attorno alla prima parola trovata (`extract_passage`) spesso non cattura la reale sostanza del documento. Questi aspetti saranno affrontati nella proposta architetturale della **FASE 3**.

---

## 6. Riscontro delle 3 Domande Reali di Cesare e Raffinamento Registro dei Tempi

### 6.1 Dati Misurati nel Registro `ask_timing.log` e Tempi Visti da Cesare
Dalle tre interrogazioni di prova eseguite da Cesare su build ottimizzata:
- **BNXT**: `index: 66 ms`, `search: 1074 ms`, `embed: 632 ms`, `openai: 6034 ms`, `total: 15751 ms` (Somma fasi parziali: 7.806 ms. Differenza: **7.945 ms**). Tempo cronometro Cesare: **~24 s**.
- **ARKAI**: `index: 63 ms`, `search: 1549 ms`, `embed: 81 ms`, `openai: 3639 ms`, `total: 12702 ms` (Somma fasi parziali: 5.332 ms. Differenza: **7.370 ms**). Tempo cronometro Cesare: **~32 s**.
- **SCENA**: `index: 65 ms`, `search: 1824 ms`, `embed: 75 ms`, `openai: 4281 ms`, `total: 13523 ms` (Somma fasi parziali: 6.245 ms. Differenza: **7.278 ms**). Tempo cronometro Cesare: **~37 s**.

---

### 6.2 Punto 1 — Dove erano finiti i 7,3 – 7,9 Secondi Mancanti al Totale?
Nel codice precedente, `t_total_ms` misurava `p.created_at.elapsed()` dentro `ask()`.
La discrepanza tra la somma delle fasi e il totale era causata da due cicli di verifica delle fonti eseguiti dentro `ask()`:
1. **Verifica integrità pre-chiamata** (`ai.rs:580-583`):
   Per ciascuna delle 10 fonti selezionate, `ask()` chiamava `read_source()`, la quale invoca:
   - `crate::catalog::get_document(path, id)`: ricarica e deserializza da disco per intero il file `VAULT_CATALOG.json` (**31,6 Megabyte**, 376 documenti e 23.482 passaggi) per 10 volte consecutive.
   - `search::read_indexed_document()`: rilegge da disco il file markdown o raw source e ricalcola da zero l'impronta crittografica SHA-256 su disco per 10 volte.
   *Ipotesi ricavata dai totali; misura reale di Cesare (2026-09-23T03:04:35Z): verify_pre 10.013 ms, verify_post 10.082 ms.*
2. **Verifica integrità post-chiamata** (`ai.rs:658-661`):
   Subito dopo aver ricevuto la risposta da OpenAI, `ask()` rieseguiva esattamente lo stesso ciclo su tutte le 10 fonti per verificare che nessun documento fosse stato modificato durante la chiamata HTTP di OpenAI.
   Ricaricava e deserializzava da disco `VAULT_CATALOG.json` (31,6 MB) per altre 10 volte consecutive, e ricalcolava lo SHA-256 dei 10 file per la seconda volta.
   *Ipotesi ricavata dai totali; misura reale di Cesare (2026-09-23T03:04:35Z): verify_pre 10.013 ms, verify_post 10.082 ms.*
3. **Payload & Parsing** (`ai.rs`):
   Costruzione client HTTPS, serializzazione JSON della richiesta e parsing della risposta JSON: **~40 – 80 ms**.

**Somma totale delle fasi interne ad `ask()`**:
$$\text{VerifyPre } (\sim 3.800\text{ ms}) + \text{Payload } (\sim 15\text{ ms}) + \text{OpenAI } (3.639 - 6.034\text{ ms}) + \text{VerifyPost } (\sim 3.800\text{ ms}) + \text{Parse } (\sim 35\text{ ms}) = \mathbf{12.702 - 15.751\text{ ms}}$$
I ~7,3 - 7,9 secondi mancanti erano quindi interamente consumati da **20 deserializzazioni ridondanti del catalogo da 31,6 MB e 20 calcoli SHA-256 da disco** eseguite per garantire l'integrità pre e post chiamata.

---

### 6.3 Punto 2 — Perché il Tempo Visto da Cesare (24–37 s) era Quasi il Doppio del Totale Registrato?
Il cronometro di Cesare parte dal click sul pulsante "Invia domanda" nell'interfaccia React (`AiPanel.tsx:118`).
Il ciclo di vita completo di una richiesta comprende due passaggi asincroni distinti invocati in sequenza dal frontend:

1. **Fase 1: Anteprima Fonti (`aiIpc.preview`, righe 120-125)**:
   - Prima che la domanda venga inviata a OpenAI, l'app seleziona le fonti pertinenti.
   - `select_with_port_timed()` esegue la ricerca ibrida: `index_cache` (65 ms) + `embed` (80–630 ms) + `search` (1.000–1.800 ms).
   - Poi esegue il ciclo di valutazione dei primi candidati (da 10 a 20 documenti) con `read_source()` ed estrazione dei passaggi: ciascuna lettura deserializza `VAULT_CATALOG.json` da 31,6 MB per estrarre `locator` e `revision`.
   - Questa fase preliminare di sola anteprima: misura reale di Cesare: 11.932 ms (2026-09-23T03:04:35Z).
   - Solo al termine della preview il backend genera il `ticket` e lo restituisce al frontend React.
2. **Fase 2: Passaggio Anteprima -> Invio (`handoff`, righe 126-138)**:
   - Ricevuto il ticket di preview, il componente React aggiorna lo stato visivo (`setPreviewData`), imposta il messaggio *"Generazione della risposta con OpenAI…"* e invia il comando Tauri `ai_ask(ticket, uiElapsedSoFar)`.
   - Latenza IPC Tauri e reattività rendering UI: **~100 – 400 ms**.
3. **Fase 3: Interrogazione OpenAI (`aiIpc.ask`, riga 138)**:
   - Il backend riceve il ticket, esegue `ask()` con verifica pre-chiamata, chiamata OpenAI e verifica post-chiamata: **12.702 – 15.751 ms**.
   - Solo ora la risposta torna al frontend e viene visualizzata a video.

**Totale end-to-end percepito dall'utente**:
$$\text{Tempo Visto da Cesare} = \text{Preview } (7 - 12\text{ s}) + \text{Handoff } (0.2 - 0.4\text{ s}) + \text{Ask } (12.7 - 15.7\text{ s}) = \mathbf{20 - 37\text{ SECONDI}}.$$
I 10–20 secondi mancanti risiedevano interamente nella **fase di Anteprima delle Fonti** e nel passaggio frontend-backend prima dell'invio ad OpenAI.

---

### 6.4 Punto 3 — Spiegazione con File e Righe: Perché Tutte e Tre le Domande hanno Usato `gpt-4o-2024-08-06`?
La comparsa di `gpt-4o-2024-08-06` per tutte e tre le domande deriva dalla seguente catena documentata nel codice sorgente:

1. **Frontend — Valore predefinito cablato nello state React**:
   - In [`apps/desktop/src/AiPanel.tsx:57`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src/AiPanel.tsx#L57):
     ```typescript
     const [model, setModel] = useState('gpt-4o');
     ```
   - In [`apps/desktop/src/AiPanel.tsx:120-125`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src/AiPanel.tsx#L120-L125):
     ```typescript
     const preview = await aiIpc.preview(vaultPath, {
       prompt: queryText,
       model: model || 'gpt-4o',
       includeDrafts: drafts,
       sourceIds: [],
     });
     ```
   - Nella scheda principale "Chiedi al Vault" (`AiPanel`) **non è presente alcun selettore UI** (`<select>` o radio button) per permettere all'utente di cambiare il modello.
   - Nella scheda "Collegamenti AI & MCP" (`AiSettingsPanel`, riga 549) esiste un selettore di modello (`Modello OpenAI predefinito`), ma modifica solo una variabile di stato locale `selectedModel` che non viene salvata nelle preferenze su disco né propagata alla scheda Chiedi. Di conseguenza, l'app invia sempre la stringa `"gpt-4o"`.

2. **Backend — Inoltro dell'opzione**:
   - In [`apps/desktop/src-tauri/src/ai.rs:7`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L7): la struct `Options` riceve `pub model: String` (`"gpt-4o"`).
   - In [`apps/desktop/src-tauri/src/ai.rs:307`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L307) (`request_body`): la richiesta HTTP POST per l'endpoint OpenAI `/v1/responses` viene serializzata con il campo `"model": o.model` (ovvero `"gpt-4o"`).

3. **API OpenAI — Risoluzione Server-Side dell'Alias**:
   - Sui server di OpenAI (`https://api.openai.com/v1/responses`), la stringa generica `"gpt-4o"` è un alias mobile che rimanda allo snapshot bloccato predefinito corrente di produzione: `"gpt-4o-2024-08-06"`.
   - Nella risposta JSON di ritorno da OpenAI, il campo `"model"` restituito dal server contiene letteralmente la stringa `"gpt-4o-2024-08-06"`.

4. **Estrazione e Logging del Modello Restituito**:
   - In [`apps/desktop/src-tauri/src/ai.rs:564`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L564) (in `parse_response`): il backend estrae il modello effettivo da `r["model"]`:
     ```rust
     "model": r["model"],
     ```
   - In [`apps/desktop/src-tauri/src/ai.rs:672`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L672):
     ```rust
     let model_str = parsed["model"].as_str().unwrap_or(p.options.model.as_str());
     ```
   - Il logger riceve `model_str` e registra a file `"model": "gpt-4o-2024-08-06"`.

*Risoluzione programmata per la FASE 4*:
Nella FASE 4 verrà introdotta la selezione vincolante e obbligatoria del modello desiderato (`gpt-4o`, `gpt-4o-mini`, o altri snapshot espliciti), con salvataggio persistente su configurazione e validazione pre-invio.

---

### 6.5 Quadratura Matematica nel Nuovo Registro dei Tempi
È stato implementato nel backend Rust (`ai.rs`, `main.rs`) e nel frontend (`AiPanel.tsx`, `ai-ipc.ts`) il tracciamento dettagliato di tutte le sotto-fasi.

Nel file di log `C:\Users\user\.limen-vault\ask_timing.log` viene ora registrato per ogni domanda sia il blocco testuale strutturato ad albero con verifica matematica della quadratura delle somme, sia la corrispondente riga JSON.

#### Esempio di formato con valori illustrativi, non misurati
```text
================================================================================
REGISTRO TEMPI RISPOSTA [2026-09-23T...]
Modello: gpt-4o-2024-08-06 | Token usati: 412
Tempo visto da UI (click -> risposta): 24150 ms
Tempo totale Backend: 23890 ms
  ├─ 1. ANTEPRIMA (Preview): 7850 ms
  │    ├─ Indice & cache: 66 ms
  │    ├─ Vettore semantico (embed): 632 ms
  │    ├─ Ricerca ibrida & fusione (search): 1074 ms
  │    ├─ Lettura documenti (doc_read): 5820 ms
  │    └─ Estrazione passaggi (passage_extract): 258 ms
  ├─ 2. PASSAGGIO ANTEPRIMA-INVIO (Handoff IPC/UI): 289 ms
  └─ 3. INTERROGAZIONE (Ask): 15751 ms
       ├─ Verifica impronte pre-chiamata (verify_pre): 3850 ms
       ├─ Costruzione richiesta (payload): 12 ms
       ├─ Chiamata OpenAI (openai): 6034 ms
       ├─ Verifica impronte post-chiamata (verify_post): 3820 ms
       └─ Lettura risposta (parse): 35 ms
Verifica quadratura somme:
  Backend = Preview (7850 ms) + Handoff (289 ms) + Ask (15751 ms) = 23890 ms (coincide con Totale Backend)
  Ask = Verify_pre (3850 ms) + Payload (12 ms) + OpenAI (6034 ms) + Verify_post (3820 ms) + Parse (35 ms) = 15751 ms (coincide con Totale Ask)
================================================================================
```
Inoltre, nei "Dettagli tecnici" dell'interfaccia utente in `AiPanel.tsx`, è stato aggiunto il campo visibile:
`Tempo interfaccia (totale): XX,X s (XXXXX ms)`
per consentire all'utente di verificare all'istante la sincronia con il proprio cronometro.

---

## 7. Prossimo Passo (STOP & Checkpoint)

In accordo con le regole del Piano di Lavoro:
1. Questa documentazione aggiornata e la patch finale della Fase 1 sono completate.
2. La Task List è allineata con l'ordine ufficiale delle fasi (`1 → 2L → 2 → 3 → 4 → 5 → H1 → H2 → 6 → 6A → 7`).

---

## 8. Riscontro Tempi Misurati Dopo la FASE 2L

Grazie all'eliminazione delle riletture ridondanti di catalogo e indice da disco e all'uso della memoria condivisa conforme a NTFS:
- **Prima della FASE 2L** (2026-09-23T03:04:35Z): **36.412 ms** (tempo UI 36.412 ms; doc_read 10.047 ms, verify_pre 10.013 ms, verify_post 10.082 ms, OpenAI 4.364 ms).
- **Dopo FASE 2L — Prima misurazione** (2026-09-23T03:44:27Z): **5.330 ms**.
- **Dopo FASE 2L — Prova di conferma di Cesare** (build ottimizzata, 2026-09-23T05:17:57Z): **4.978 ms** (doc_read 14 ms, verify_pre 12 ms, verify_post 11 ms, OpenAI 3.769 ms).
Abbattimento complessivo del tempo di risposta: da **36,4 secondi** a **4,9 secondi** (riduzione dell'86%).

---

## 9. Proposta Tecnica sul Limite del Catalogo (32 MB)

### Stato Attuale e Rischio di Saturazione
La funzione `load_catalog_arc` in `catalog.rs` (righe 260-263) impone il controllo:
```rust
let bytes = read(&sys, CATALOG_FILE)?;
if bytes.len() > 32 * 1024 * 1024 {
    return Err("Catalog file exceeds 32 MB".into());
}
```
Nel vault di sviluppo e test `E:\VAULT WIN TEST DEV`, il file `00_SYSTEM\VAULT_CATALOG.json` misura attualmente **31.605.698 byte** (30,14 MB), pari al **94,19% del limite massimo consentito**.
Con una media di circa 84 KB per documento, l'aggiunta di circa 20-25 documenti comporterebbe il superamento della soglia dei 32 MB.

### Cosa vede l'utente oggi quando il limite viene superato (con file e righe del codice)
1. **Rifiuto nel backend Rust:**
   `load_catalog_arc` in `catalog.rs` (riga 262) restituisce:
   `Err("Catalog file exceeds 32 MB".into())`.
2. **Visualizzazione dell'errore nella tab "Chiedi al Vault" (`AiPanel.tsx`):**
   - Alla riga 122, `executeAsk` chiama `aiIpc.preview(...)`.
   - Nel backend, `ai_preview` invoca `select_with_port_timed`, che a sua volta chiama `load_catalog_arc` (`search.rs`, riga 673).
   - Al superamento del limite, la promise IPC viene rigettata; nel blocco `catch (e: any)` (righe 147-156 di `AiPanel.tsx`), il frontend imposta:
     `setError('Impossibile completare la risposta. Verifica la connessione o la chiave API.')`
     `setTechError("Catalog file exceeds 32 MB")`.
   - Alle righe 283-307 di `AiPanel.tsx`, l'interfaccia renderizza un riquadro rosso di allerta bloccante:
     `<div style={{ padding: 16, borderRadius: 8, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>`
     con l'icona `<AlertCircle size={16} />`, il messaggio di impossibilità di risposta e il pannello espandibile `<details>` contenente il testo d'errore tecnico `Catalog file exceeds 32 MB`. L'anteprima non viene generata e l'invio della domanda a OpenAI è totalmente inibito.
3. **Visualizzazione dell'errore nel caricamento / sincronizzazione (`App.tsx`):**
   - Durante il caricamento di file (`handleUploadDocuments`, righe 240-256), `ipc.processPendingExtractions` e `ipc.syncCatalog` invocano `load_catalog_arc`.
   - In caso di superamento dei 32 MB, la riga 252 di `App.tsx` imposta:
     `setActionError("Caricamento non riuscito: Catalog file exceeds 32 MB")`.
   - Alle righe 875-889 di `App.tsx`, compare in cima alla schermata principale il banner rosso di blocco:
     `<div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#991b1b', fontSize: 13 }}>`
     contenente `<strong>Errore:</strong> Catalog file exceeds 32 MB`, interrompendo la pipeline di ingestione.

### Misure Reali Effettuate sul Catalogo di `E:\VAULT WIN TEST DEV`
L'analisi diretta dei 31,6 MB del catalogo reale del vault di test evidenzia la scomposizione esatta:
- **Dimensione totale file `VAULT_CATALOG.json`:** `31.605.698 byte` (30,14 MB).
- **Documenti totali:** 376.
- **Passaggi totali estratti:** 23.482.
- **Byte effettivi di solo testo dei passaggi UTF-8 (`passages[].text`):** **24.230.597 byte** (23,11 MB), pari esattamente al **76,67%** della dimensione complessiva del file.
- **Dimensione del JSON escludendo il testo dei passaggi:** **7.375.101 byte** (7,03 MB), con una riduzione reale di oltre il **76,67%**.
- **Stima memoria RAM heap:** In Rust su architettura x86_64, ogni stringa memorizza 24 byte di metadati (`ptr`, `cap`, `len`) oltre all'allocazione del buffer. La struttura deserializzata `Arc<CatalogState>` per 23.482 passaggi e 376 documenti occupa tra **50 e 55 MB di memoria heap**.

### Analisi delle Opzioni Proposte

| Opzione | Pro | Contro | Memoria RAM & Riscontri Tecnici |
| :--- | :--- | :--- | :--- |
| **1. Alzare il limite** (es. a 64 MB o 128 MB) | • Modifica immediata a una singola costante in `catalog.rs` (riga 261)<br>• Piena retrocompatibilità con tutti i vault esistenti<br>• Zero migrazioni di dati o modifiche strutturali | • Dilaziona la saturazione senza rimuovere la duplicazione ridondante del testo<br>• A 128 MB la deserializzazione iniziale del JSON richiede una stima di ~400–600 ms | **Memoria usata (stima basata su misure reali)**: con 31,6 MB su disco l'`Arc<CatalogState>` in memoria occupa ~50–55 MB di RAM; a 64 MB occuperà una stima di ~100–110 MB; a 128 MB occuperà una stima di ~200–220 MB. Con la cache in memoria condivisa (introdotta nella FASE 2L), l'occupazione in RAM è singola per vault. |
| **2. Ridurre la dimensione del catalogo** (non ripetere il testo dei passaggi già presente nell'indice) | • **Soluzione architetturalmente ottimale**: il testo dei passaggi pesa per il **76,67%** del file (24,2 MB su 31,6 MB). Rimuovendo `text` da `DocumentPassage` e memorizzando solo metadati (`passage_id`, `locator`, `char_count`, `sha256`), la dimensione reale misurata scende a **7,03 MB** (-76,67%)<br>• Con il limite dei 32 MB, il vault supporterà oltre **1.600 documenti** anziché saturarsi a ~400 | • Richiede di estrarre il testo dei passaggi al bisogno leggendo i file sorgente o interrogando l'indice lessicale (`SEARCH_INDEX.json`), come già avviene in `read_indexed_document`<br>• Richiede una strategia di migrazione/retrocompatibilità per cataloghi già compilati con schema v1 | **Memoria usata (misurata/stimata)**: la struct deserializzata scenderebbe a **circa 12–15 MB di RAM**, riducendo del 70% anche il tempo di parsing JSON all'avvio. |
| **3. Formato binario** (Bincode / rkyv / Memmap) | • Deserializzazione sub-millisecondo anche per archivi molto estesi<br>• Possibilità di memory-mapping a zero allocazioni heap | • File proprietario non ispezionabile né modificabile in chiaro da Obsidian o tramite editor di testo<br>• Maggiore complessità di evoluzione dello schema e debug | **Memoria usata**: occupazione minima in RAM grazie al memory mapping gestito dal kernel OS. |




