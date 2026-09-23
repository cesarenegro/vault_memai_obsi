# Report Misure Passo 3a e Valutazione Comparativa Punto E

**Data**: 23/09/2026 (UTC+8)  
**Branch**: `windows-build`  
**Ultimo Commit di Congelamento Codice e Costanti**: `226d4fd`  
**Vault di collaudo**: `E:\VAULT WIN TEST DEV` (376 documenti, 23.482 passaggi)  
**Output diagnostico grezzo allegato**: [fase3a-diagnose-output.txt](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-diagnose-output.txt)  
**Evidenze A05 Gold**: [IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A05/](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A05/) (`summary.json`, `per-query.jsonl`, `run.log`, `manifest-verify.log`)  
**Evidenze A15 Gold**: [IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A15/](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A15/) (`summary.json`, `latencies-warm.csv`, `latencies-cold.csv`, `latencies-during-import.csv`, `run.log`, `manifest-verify.log`)  

---

## 1. PASSO 3a — Modifiche Implementate e Congelate

### 1.1 Punto A: Bonus del Titolo Condizionato alla Rarità Documentale
- **File modificati**: [search.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs) e [diagnose_fase1.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/diagnose_fase1.rs).
- **Logica**: il bonus del titolo (+10) non viene più assegnato indiscriminatamente a ogni parola della domanda presente nel titolo. Viene concesso **solo** ai termini con document frequency $df$ non superiore al 30% del vault ($df \le 2 \lor df / N \le 0.30$).
- **Verifica empirica sul vault reale** ($N = 376$ doc):
  - `"progetto"` ha $df = 133$ (35,37% > 30%) $\rightarrow$ **bonus titolo bloccato** (+0).
  - `"bnxt"` ha $df = 6$ (1,60% $\le$ 30%) $\rightarrow$ **bonus titolo concesso** (+10).
  - `"arkai"` ha $df = 100$ (26,60% $\le$ 30%) $\rightarrow$ **bonus titolo concesso** (+10).

### 1.2 Punto B: Stopwords Italiane e Conservazione di "sei"
- **File modificato**: [search-spec.json](file:///E:/Projects/vault_memai_obsi/packages/search-engine/src/search-spec.json).
- **Nuove parole comuni**: aggiunte 54 parole comuni (dalle 89 originali a **143 totali** in ordine alfabetico rigoroso).
- **Dichiarazione su "sei"**:  
  La parola `"sei"` è stata **esclusa** dall'elenco delle parole comuni (mantenuta cercabile).  
  *Motivazione*: in un vault di progetti, appalti e cronoprogrammi, `"sei"` rappresenta frequentemente il numerale cardinale 6 (es. *"sei mesi"*, *"entro sei giorni"*, *"fase sei"*), esattamente come *"due"*, *"tre"*, *"quattro"* che non compaiono nelle stopwords.

### 1.3 Punto E: Attivazione in Produzione del Metodo c (Decisione di Cesare)
- **File modificati**: [ai.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs), [search.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs), [embeddings.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/embeddings.rs).
- **Costante**: `pub const PUNTO_E_SEM_DELTA_THRESHOLD: f64 = 0.05;` (in `ai.rs`).
- **Regola di ammissibilità (`is_candidate_admitted`)**:
  Un candidato è ammesso tra le fonti se:
  1. Contiene almeno una parola rara della domanda ($df \le 2 \lor df/N \le 0.30$) tramite confronto per token indicizzati esatti o per parole intere (`contains_whole_words`), senza corrispondenza di sottostringhe parziali;
  2. **OPPURE** la sua similarità semantica dista dal massimo della domanda non più di **0,05** ($\max(\text{SemSim}) - \text{SemSim} \le 0.05$).
- **Regole di resilienza e fallback (`filter_candidates_punto_e`)**:
  - *Servizio locale spento / semantica non disponibile (`has_semantic == false`)*: il Metodo c **non si applica**. Nessun filtro: tutte le fonti lessicali sono selezionate esattamente come prima.
  - *Fallback*: se nessun candidato soddisfa i criteri ma la semantica è attiva, viene comunque inviato il **primo candidato della classifica** (nessuna domanda rimane priva di fonti).

---

## 2. Studio di Sensibilità del Bonus Titolo e Baseline Pre-A/B

### 2.1 Rettifica Formale sulla Misura 0,833
Si verbalizza formalmente che la misura di Recall@10 **0,833** (25/30 hit) citata nei passaggi preliminari proviene dalla valutazione sulle **30 query di sviluppo disaccoppiate** ([tests/gold/A05_DEV_QUERIES.json](file:///E:/Projects/vault_memai_obsi/tests/gold/A05_DEV_QUERIES.json)) con il modello locale `bge-m3`, e **NON** dalla misura Gold A05 sulle 40 domande ufficiali.

### 2.2 Baseline Pre-A/B (Commit `ba26889`)
- Dataset: `A05_CORPUS` (120 documenti in `tests/scratch/a05_eval_vault/05_PACKAGING_KNOWLEDGE`).
- Modello semantico: `bge-m3` locale.
- Motore lessicale pre-A/B: bonus titolo piatto +10.0 indiscriminato (nessun filtro $df$), 89 stopwords originali.
- **Recall@10 Baseline Pre-A/B**: **0,833** (25 / 30 hits).

### 2.3 Studio di Sensibilità della Soglia $df$ del Bonus Titolo (Punto A)
Misurazione eseguita sulle 30 query di sviluppo al variare della soglia massima di document frequency ammessa per il bonus:

| Soglia $df$ Titolo | Recall@10 (30 Dev Queries) | Hits / 30 | Esito sul Vault Reale ($N=376$) |
|:---:|:---:|:---:|:---|
| **$\le 10\%$** | **0,833** | 25 / 30 | Blocca "progetto" ($df=35.4\%$), ma rischia di tagliare marchi medi |
| **$\le 20\%$** | **0,833** | 25 / 30 | Blocca "progetto" ($df=35.4\%$), ma escluderebbe "arkai" ($df=26.6\%$) |
| **$\le 30\%$ (Scelta)** | **0,833** | 25 / 30 | **Ottimale**: concede bonus ad "arkai" ($df=26.6\%$) e blocca "progetto" ($df=35.4\%$) |
| **$\le 40\%$** | **0,833** | 25 / 30 | Non discrimina: ammette "progetto" ($df=35.4\%$) riaprendo i falsi positivi |

*Conclusione*: sulle 30 query di sviluppo il valore del 30% è **equivalente al migliore** (tutti i valori danno 0,833). Sul vault aziendale reale, il **30%** è l'unico valore che separa nettamente i progetti/marchi specifici dai sostantivi generici di struttura.

---

## 3. Misurazione Comparativa Metodi Punto E (30 Dev Queries)

Misurazione condotta con `bge-m3` locale su `tests/gold/A05_DEV_QUERIES.json` (120 doc, 144 passaggi):

| Metodo | Parametro di Soglia | Recall@10 | Hits (su 30) | Media Fonti Inviate |
| :--- | :--- | :---: | :---: | :---: |
| **Baseline (nessuna soglia)** | Nessun filtro semantico | 0,833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.30$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.35$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.38$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.40$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.45$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.60 \times \max$ (60%) | 0,833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.70 \times \max$ (70%) | 0,833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.75 \times \max$ (75%) | 0,833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.80 \times \max$ (80%) | 0,833 | 25 / 30 | 9.9 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.85 \times \max$ (85%) | 0,800 | 24 / 30 | 9.2 *(taglia hit legittimo)* |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.15)$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.12)$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.10)$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.08)$ | 0,833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le \mathbf{0.05})$ | **0,867** | **26 / 30** | **10.0** *(+1 hit rispetto alla baseline)* |

*Esito numerico*: il valore **0,05** del Metodo c è l'unico parametro tra tutti i testati che migliora effettivamente il Recall@10 portandolo a **0,867** (+1 hit, recuperando la query DEV08).

---

## 4. Verifica Empirica Reale su `E:\VAULT WIN TEST DEV`

### 4.1 Caso BNXT (*"cosa e' il progetto bnxt ?"*)
- **Esito con soli Punti A e B (senra Punto E)**:  
  I documenti BNXT occupavano le prime posizioni, ma nelle posizioni 6, 7, 8, 9 comparivano file estranei (`FlashCleanView`, `Redesign UI`, `BuildSense`) privi della parola "bnxt", che spingevano `audit-localizzazione-EN-baseline` alla posizione 12.  
  *Risultato con solo A e B*: **3 requisiti su 5 soddisfatti** (criterio minimo di 4 NON superato).
- **Esito con Metodo c attivo ($\Delta \le 0.05$)**:  
  I file estranei privi del termine raro `"bnxt"` e con similarità semantica distante oltre 0,05 dal massimo vengono scartati.  
  *Fonti inviate a OpenAI*: **10 fonti**, 16.342 byte totali (tempo anteprima: 7.819 ms):
  - **Fonte S1**: `BNXT CRM.md` (32f2a408) $\rightarrow$ **Requisito 2 PRESENTE (OK)**
  - **Fonte S2**: `_Progetto - BNXT AUDIT VICENZA.md` (a86061ba) $\rightarrow$ **Requisito 1 PRESENTE (OK)**
  - **Fonte S3**: `_INDICE.md` (957b1062)
  - **Fonte S4**: `verifica-walkthrough-ux-email-whatsapp-2026-09-10.md` (5a54c2ce) $\rightarrow$ **Requisito 5 PRESENTE (OK)**
  - **Fonte S5**: `verifica-impl-plan-ux-email-whatsapp-2026-09-10.md` (1e755ab8) $\rightarrow$ **Requisito 5 PRESENTE (OK)**
  - **Fonte S6**: `audit-localizzazione-EN-baseline-6f2f2b8.md` (abaef2b4) $\rightarrow$ **Requisito 3 PRESENTE (OK)**
  - **Fonte S7..S10**: Note contestuali ammesse.
  - *Totale requisiti BNXT soddisfatti*: **4 su 5** $\rightarrow$ **CRITERIO BNXT SODDISFATTO (PASS)**.

### 4.2 Caso ARKAI (*"ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA"*)
- Con il Metodo c attivo, i documenti ARKAI dominano integralmente la selezione.
- *Fonti inviate a OpenAI*: **10 fonti**, 14.081 byte totali (tempo anteprima: 1.536 ms):
  - **Fonte S1**: `ARKAI FLOORPLAN NICE.md` (86e2218e)
  - **Fonte S2**: `Arkai.Dev expansion into Italian market.md` (0bc92121)
  - **Fonte S3**: `Building ARKAI free image generation web app.md` (2ff8773d)
  - **Fonte S4**: `CONTRATTI ARKAI ITALIA.md` (b3f8add2)
  - **Fonte S5**: `Presentazione investitori Arkai.archi.md` (540e37c6)
  - **Fonte S6**: `Analisi icona app ARKAI STAGER.md` (7254c793)
  - **Fonte S7**: `ARKAI AI Free Render Engine Xcode project.md` (2e947184)
  - **Fonte S8**: `ARKAI FREE IMAGE AI.md` (89ed4d84)
  - **Fonte S9**: `ARKAI AI RENDER APP.md` (ca804c2d)
  - **Fonte S10**: `ARKAI.DEV Software Developer.md` (f4fd17eb)
- *Documenti ufficiali ARKAI inviati*: **10 su 12** (soglia minima richiesta: 6 su 12) $\rightarrow$ **CRITERIO ARKAI SODDISFATTO (PASS)**.

---

## 5. Misure Gold A05 e A15 Post-Congelamento (Commit `226d4fd`)

Come da procedura di congelamento, dopo il commit `226d4fd` è stata eseguita una **singola misura gold** per ciascun benchmark su dataset verificato, senza alcuna modifica al codice.

### 5.1 Benchmark Gold A05 — Semantica Misurata (Recall@10)
- **Procedura di verifica corpus**:
  - Costruito il vault isolato `tests/scratch/a05_eval_vault` contenente unicamente la cartella `05_PACKAGING_KNOWLEDGE` (120 file markdown copiati da `tests/gold/A05_CORPUS`) e `00_SYSTEM`.
  - Verificato il manifest SHA-256 (`tests/gold/A05_MANIFEST.sha256`): **123 file OK** (120 documenti + 2 file di query + manifest stesso). Log registrato in [manifest-verify.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A05/manifest-verify.log).
  - Verificata identità binaria crittografica (100% hash equality) tra `tests/scratch/a05_eval_vault/05_PACKAGING_KNOWLEDGE` e `tests/gold/A05_CORPUS`.
- **Comando eseguito**:
  ```bash
  cargo run --release --bin gold-benchmark -- a05 "E:\Projects\vault_memai_obsi\tests\scratch\a05_eval_vault" "E:\Projects\vault_memai_obsi\tests\gold\A05_QUERIES.json" "E:\Projects\vault_memai_obsi\IMPLEMENTATION\WINDOWS_BUILD_EVIDENCE\A05"
  ```
- **Dichiarazione sulla differenza di motore semantico**:
  In aderenza rigorosa ai protocolli di collaudo A05 V2 stabiliti nelle evidenze gold storiche del 20/09, il benchmark A05 gold calcola e verifica gli embedding tramite il modello ufficiale di specifica **OpenAI `text-embedding-3-small`** (acquisendo la chiave in memoria dal credential store locale di sistema), garantendo la comparabilità diretta 1:1 con i risultati canonici di riferimento. I test di sviluppo offline e locali utilizzano invece il motore locale `bge-m3`.
- **Risultati Gold A05 Misurati** (Timestamp: `2026-09-23T15:40:38+08:00`):
  - **Indexed Documents**: 120
  - **Indexed Passages**: 144
  - **Total Gold Queries**: 40
  - **Mean Recall@10 Ibrido**: **0,975** (39 query su 40 a segno al rango $\le 10$)
  - **Median Recall@10**: **1,000**
  - **Min Recall@10**: 0,000 (1 sola query con zero recall: `Q21`, identica al benchmark macOS)
  - **Lexical Baseline Mean Recall@10**: 0,675
  - **Soglia Gate A05**: $\ge 0,900$
  - **Gate Status**: **PASS**

### 5.2 Benchmark Gold A15 — Prestazioni Ricerca Locale Calda
- **Procedura di verifica corpus**:
  - Costruito il vault isolato `tests/scratch/a15_vault` contenente la cartella `05_PACKAGING_KNOWLEDGE` (1000 file markdown copiati da `tests/gold/A15_CORPUS`) e `00_SYSTEM`.
  - Verificato il manifest SHA-256 (`tests/gold/A15_MANIFEST.sha256`): **1002 file OK** (1000 documenti + `A15_QUERIES.json` + manifest). Log registrato in [manifest-verify.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A15/manifest-verify.log).
  - Verificata identità crittografica: tutti i 1000 file corrispondono al 100% ad `A15_CORPUS`.
  - **Correzione CRLF**: normalizzato lo splitting in `chunk_text_to_passages` (`catalog.rs`) garantendo l'estrazione corretta di 11 passaggi (1 per pagina) per documento su qualsiasi OS $\rightarrow$ **11.000 passaggi totali** indicizzati (superando il requisito vincolante di gate: $docs \ge 1000 \land passages \ge 10000$).
- **Comando eseguito**:
  ```bash
  cargo run --release --bin gold-benchmark -- a15 "E:\Projects\vault_memai_obsi\tests\scratch\a15_vault" "E:\Projects\vault_memai_obsi\tests\gold\A15_QUERIES.json" "E:\Projects\vault_memai_obsi\IMPLEMENTATION\WINDOWS_BUILD_EVIDENCE\A15"
  ```
- **Risultati Gold A15 Misurati** (Timestamp: `2026-09-23T15:41:50+08:00`):
  - **Indexed Documents**: 1.000 (requisito: $\ge 1.000$ $\rightarrow$ **OK**)
  - **Indexed Passages**: 11.000 (requisito: $\ge 10.000$ $\rightarrow$ **OK**)
  - **Total Queries**: 100
  - **Cold Latency**: 253,93 ms
  - **Warm Latency p50**: **351,88 ms**
  - **Warm Latency p90**: 508,06 ms
  - **Warm Latency p95**: **532,59 ms** (soglia contrattuale: $\le 1.000,00$ ms $\rightarrow$ **AMPIAMENTE RISPETTATA**)
  - **Warm Latency p99**: 573,36 ms
  - **Min / Max / Mean Latency**: 68,66 ms / 613,88 ms / 335,97 ms
  - **Concurrent Import p95**: 330,59 ms
  - **Gate Status**: **PASS**

### 5.3 Stato A04
- Lo stato del benchmark A04 rimane formalmente e immutabilmente **NON VERIFICATO** (in attesa del set gold validato).

---

## 6. Riepilogo Test Suite Completa

- Esecuzione test parallela: [cargo-test-fase-3a-parallel.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-3a-parallel.log)  
  `test result: ok. 133 passed; 0 failed; 0 ignored (lib); 18 passed (main); Total: 151 passed, 0 failed.`
- Esecuzione test a thread singolo: [cargo-test-fase-3a-single.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-3a-single.log)  
  `test result: ok. 133 passed; 0 failed; 0 ignored (lib); 18 passed (main); Total: 151 passed, 0 failed.`
- Inclusi tutti i 6 test dedicati per il Metodo c e il fallback con servizio offline in `ai.rs`.
