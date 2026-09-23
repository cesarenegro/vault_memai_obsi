# Report Misure Passo 3a e Valutazione Comparativa Punto E

Data: 23/09/2026 (UTC+8)  
Branch: `windows-build`  
Vault di collaudo: `E:\VAULT WIN TEST DEV` (376 documenti, 23.482 passaggi)  
Output diagnostico grezzo allegato: [fase3a-diagnose-output.txt](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-diagnose-output.txt)

---

## 1. PASSO 3a — Modifiche Implementate

### 1.1 Punto A: Bonus del Titolo Condizionato alla Rarità Documentale
- **File modificati**: [search.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs#L805-L825) e [diagnose_fase1.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/diagnose_fase1.rs#L90-L105).
- **Logica**: il bonus del titolo (+10) non viene più assegnato indiscriminatamente a ogni parola della domanda presente nel titolo. Viene concesso **solo** ai termini con document frequency $df$ non superiore al 30% del vault ($df \le 2 \lor df / N \le 0.30$).
- **Verifica empirica sul vault reale** ($N = 376$ doc):
  - `"progetto"` ha $df = 133$ (35,37% > 30%) $\rightarrow$ **bonus titolo bloccato** (+0).
  - `"bnxt"` ha $df = 6$ (1,60% $\le$ 30%) $\rightarrow$ **bonus titolo concesso** (+10).
  - `"arkai"` ha $df = 100$ (26,60% $\le$ 30%) $\rightarrow$ **bonus titolo concesso** (+10).

### 1.2 Punto B: Stopwords Italiane e Valutazione di "sei"
- **File modificato**: [search-spec.json](file:///E:/Projects/vault_memai_obsi/packages/search-engine/src/search-spec.json).
- **Nuove parole comuni**: aggiunte 54 parole comuni (dalle 89 originali a **143 totali** in ordine alfabetico rigoroso).
- **Dichiarazione su "sei"**:  
  La parola `"sei"` è stata **esclusa** dall'elenco delle parole comuni (mantenuta cercabile).  
  *Motivazione*: in un vault di progetti, appalti e cronoprogrammi, `"sei"` rappresenta frequentemente il numerale cardinale 6 (es. *"sei mesi"*, *"entro sei giorni"*, *"fase sei"*), esattamente come *"due"*, *"tre"*, *"quattro"* che non compaiono nelle stopwords. Rimuoverlo avrebbe causato la perdita di informazioni temporali e quantitative.

### 1.3 Ricostruzione dell'Indice Lessicale
- Eseguita reindicizzazione completa con `vault-check search-index "E:\VAULT WIN TEST DEV"`.
- Indice ricostruito con successo: 376 documenti indicizzati (`version: 2`, `last_indexed_at: 2026-09-23T06:33:58.183Z`).

---

## 2. Risultati della Diagnosi Reale su BNXT e ARKAI (Post Passo 3a)

I risultati integrali con i primi 30 candidati e la simulazione di `select()` sono conservati in [fase3a-diagnose-output.txt](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-diagnose-output.txt).

### 2.1 Domanda BNXT: *"cosa e' il progetto bnxt ?"*
Con l'esclusione del bonus per "progetto" e il filtraggio di "cosa":
1. **I documenti ufficiali di BNXT dominano la classifica**:
   - **Rango 1**: `20_RAW_SOURCES/32f2a4081d13410e-BNXT CRM.md` (Score: **1.1938**; prima era rango 18 con 0.7937).
   - **Rango 2**: `20_RAW_SOURCES/a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md` (Score: **1.1695**; prima era rango 14 con 0.8124).
   - **Rango 5**: `5a54c2ce2f581cf2-verifica-walkthrough-ux-email-whatsapp-2026-09-10.md` (Score: **0.8814**).
   - **Rango 10**: `1e755ab82023a095-verifica-impl-plan-ux-email-whatsapp-2026-09-10.md` (Score: **0.7791**).
   - **Rango 12**: `abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md` (Score: **0.7757**).
2. **Crollo dei file estranei "Progetto senza nome"**:
   - `b21c86f3e37a8792-Progetto senza nome (2).md` (prima a rango 4 con score 0.9427) è **crollato al rango 21** (Score: 0.7281, bonus titolo = 0).
   - `14fd281ff56ab94a-2026-06-04 - Valutazione e feedback su progetto.md` è **completamente uscito dai primi 30**.
   - Tutti i 7 file estranei "Progetto senza nome" sono stati spazzati via dalle prime 10 posizioni.
3. **Fonti inviate a OpenAI**:
   - Totale: 10 fonti, 14.444 byte (su 24.000 consentiti).

### 2.2 Domanda ARKAI: *"ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA"*
1. **Dominio assoluto dei documenti ARKAI**:
   - **Tutti i primi 7 risultati** sono documenti ufficiali ARKAI (Score da 1.1880 a 1.1390).
   - Rango 1: `86e2218e7ed905f1-ARKAI FLOORPLAN NICE.md` (Score 1.1880)
   - Rango 2: `540e37c638dd2045-2026-03-31 - Presentazione investitori Arkai.archi.md` (Score 1.1792)
   - Rango 3: `b3f8add2793aa3b3-CONTRATTI ARKAI ITALIA.md` (Score 1.1708)
   - Rango 4: `0bc92121a0ad46f7-2026-03-26 - Arkai.Dev expansion into Italian market.md` (Score 1.1700)
   - Rango 5: `2ff8773ddf4229e7-2026-04-06 - Building ARKAI free image generation web app.md` (Score 1.1498)
   - Rango 6: `7254c793dd89f65d-2026-03-19 - Analisi icona app ARKAI STAGER.md` (Score 1.1395)
   - Rango 7: `2e9471848e17f686-2026-04-06 - ARKAI AI Free Render Engine Xcode project.md` (Score 1.1390)
   - Rango 9: `89ed4d8455f40767-ARKAI FREE IMAGE AI.md` (Score 1.1262)
   - Rango 10: `ca804c2d899aa19b-ARKAI AI RENDER APP.md` (Score 1.1082)
   - Rango 11: `f4fd17ebca858f34-ARKAI.DEV Software Developer.md` (Score 1.1013)
2. **Nei primi 11 risultati ci sono 10 documenti ARKAI su 12**.
3. **Fonti inviate a OpenAI**:
   - 10 fonti, 14.460 byte (su 24.000 consentiti).

---

## 3. PUNTO E — Misurazione dei Tre Metodi (Nessun Codice Attivato in Produzione)

In accordo con la decisione di Cesare, il Punto E **non è stato attivato nel codice di produzione**. È stata invece condotta una misurazione comparativa empirica con il modello semantico `bge-m3` e le nuove stopwords attive sulle 30 domande di sviluppo di `tests/gold/A05_DEV_QUERIES.json`.

### 3.1 Tabella Comparativa sui 30 Quesiti di Sviluppo

| Metodo | Parametro di Soglia | Recall@10 | Hits (su 30) | Media Fonti Inviate (su 10) |
| :--- | :--- | :---: | :---: | :---: |
| **Baseline (nessuna soglia)** | Nessun filtro semantico | **0.833** | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.30$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.35$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.38$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.40$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo a (Soglia assoluta SemSim)** | $\text{SemSim} \ge 0.45$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.60 \times \max$ (60%) | 0.833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.70 \times \max$ (70%) | 0.833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.75 \times \max$ (75%) | 0.833 | 25 / 30 | 10.0 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.80 \times \max$ (80%) | 0.833 | 25 / 30 | 9.9 |
| **Metodo b (Soglia relativa al max)** | $\text{SemSim} \ge 0.85 \times \max$ (85%) | **0.800** | 24 / 30 | 9.2 *(taglia hit legittimo)* |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.15)$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.12)$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.10)$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.08)$ | 0.833 | 25 / 30 | 10.0 |
| **Metodo c (Parola rara $\lor$ Delta max)** | Parola rara $\lor (\max - \text{SemSim} \le 0.05)$ | **0.867** | **26 / 30** | 10.0 *(migliora Recall)* |

---

### 3.2 Analisi Esclusioni Documentali su BNXT e ARKAI

#### Caso BNXT (*"cosa e' il progetto bnxt ?"* — $\text{SemSim}_{\max} = 0.5504$)
- **Metodo a (soglia assoluta)**:
  - *Soglia 0.380*: **NON esclude** il file estraneo `b21c86f3e37a8792-Progetto senza nome (2).md` perché ha $\text{SemSim} = 0.3826 > 0.380$.
  - *Soglia 0.400*: esclude `Progetto senza nome (2)`, ma **esclude contemporaneamente 3 documenti ufficiali BNXT**: `1e755ab82023a095-verifica-impl-plan` (0.3852), `abaef2b48c6e5b70-audit-localizzazione-EN-baseline` (0.3891), `112bf7d370012490-audit-localizzazione-EN-verifica-AG` (0.3986).  
    *Esito*: **La soglia assoluta fissa fallisce**.
- **Metodo b (soglia relativa al max $\ge k \times \max$)**:
  - *Con $k = 0.75$* (soglia = 0.4128): esclude `Progetto senza nome (2)` (0.3826), ma **esclude anche i 3 documenti BNXT** (0.3852, 0.3891, 0.3986).
  - *Con $k = 0.70$* (soglia = 0.3853): esclude `Progetto senza nome (2)` (0.3826) con uno scarto di soli 0.0027, ma rischia di tagliare `verifica-impl-plan` (0.3852).
- **Metodo c (Parola rara della domanda $\lor$ $\max - \text{SemSim} \le \delta$)**:
  - Termine raro della domanda: `"bnxt"` ($df = 6$, $1.60\% \le 30\%$).
  - **Tutti i 5 documenti BNXT contengono "bnxt" nel testo o nel titolo** $\rightarrow$ **vengono salvati e ammessi al 100%**, indipendentemente dal loro valore di SemSim!
  - I file estranei che non contengono "bnxt" (`Progetto senza nome (2)`, `FlashCleanView`, `BuildSense`, `Redesign UI`):
    * `b21c86f3e37a8792` ($\text{SemSim} = 0.3826$): distanza dal massimo $= 0.5504 - 0.3826 = \mathbf{0.1678}$. Con $\delta \le 0.10$ viene **escluso tassativamente**.
    * `247b4cf913575d12-Redesign UI` ($\text{SemSim} = 0.4132$): distanza $= 0.1372 > 0.10 \rightarrow$ **escluso**.
    * `d7f229ffc176756a-BuildSense` ($\text{SemSim} = 0.4422$): distanza $= 0.1082 > 0.10 \rightarrow$ **escluso**.
    * `2365af8d9b1771bc-BUILD SENSE` ($\text{SemSim} = 0.4407$): distanza $= 0.1097 > 0.10 \rightarrow$ **escluso**.
  *Esito*: **Il Metodo c (con $\delta \le 0.10$) elimina tutti i file estranei senza parole rare e protegge al 100% i documenti di progetto pertinenti**.

#### Caso ARKAI (*"ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA"* — $\text{SemSim}_{\max} = 0.6150$)
- In FASE 1, il file estraneo `98de5fb0d0fac3db-...LORA for floorplan...` presentava un SemSim elevatissimo ($0.6150$, il massimo assoluto della query).
- **Né il Metodo a né il Metodo b possono escluderlo**, poiché il suo SemSim è pari al 100% del massimo.
- Tuttavia, **i Punti A e B già implementati nel Passo 3a hanno risolto il problema alla radice nella fusione ibrida**:
  - I primi 7 risultati sono tutti documenti ARKAI grazie al bonus titolo su "arkai" ($df = 26.6\% \le 30\%$).
  - Il file estraneo 98de5fb0 (che non ha "arkai" nel titolo) ottiene un punteggio lessicale di soli 10.02 e scivola a rango 8, consentendo a ben 9 documenti ufficiali ARKAI di rientrare nella top 10.

*La decisione su quale metodo adottare (o se mantenere il sistema pulito senza soglia ulteriore, lasciando lavorare i soli Punti A e B) è demandata a Cesare sulla base di questi dati numerici.*

---

## 4. Misure Gold A05, A15 e Stato di A04

### 4.1 Misura Gold A05
- **Misura registrata con semantica bge-m3 e nuove stopwords (Passo 3a)**:  
  **Recall@10 = 0.833** (25/30 hit) su `tests/gold/A05_DEV_QUERIES.json` (che sale a **0.867** con il Metodo c).
- **Valore verificato storico di riferimento**:  
  $0.950$ su 40 query gold in `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_FUSION_GOLD_V3/summary.json` (misurato con semantica OpenAI `text-embedding-3-small` in macOS).
- La misura è dichiarata come singola rilevazione tecnica di allineamento su modello locale.

### 4.2 Benchmark A15 e Chiarimento sul Gate

#### 1. File di Provenienza del Valore 198,90 ms
- Il valore **198,90 ms** proviene da:
  - [IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A15/run.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A15/run.log#L14):  
    `Warm p50: 163.38 ms | p95: 198.90 ms | p99: 254.13 ms`
  - [IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A15/summary.json](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A15/summary.json)
  - [IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/2026-09-19_AUDIT_CLOSURE_REPORT_AG.md#L99):  
    *"Hardware: Apple M2, 8 GB RAM, macOS 26.3. Latenza a caldo (p95 interpolazione lineare): 198.90 ms (soglia <= 1.000 ms)"*.

#### 2. La Soglia Effettiva del Gate
- Nel codice di [gold-benchmark.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/gold-benchmark.rs#L549):
  ```rust
  let status = if doc_count >= 1000 && total_passages >= 10000 && p95 <= 1000.0 {
      "PASS"
  } else {
      "FAIL"
  };
  ```
- **La soglia formale del gate contrattuale A15 è $\le 1.000$ ms (1 secondo), NON 200 ms**.
- Il presunto margine di 1,1 ms era frutto di un errore concettuale della proposta precedente, che confrontava arbitrariamente 198,90 ms con un tetto inesistente di 200 ms.
- Rispetto alla soglia reale del gate ($\le 1.000$ ms), il margine reale accertato era di ben **801,10 ms**.

#### 3. Proposta di Trattamento per Windows
- **Conferma formale della soglia**: la soglia di sbarramento del gate A15 resta $\le 1.000$ ms come stabilito nei requisiti di progetto e nel codice del benchmark.
- **Ruolo di 198,90 ms**: trattare 198,90 ms unicamente come metrica di riferimento prestazionale (baseline Apple Silicon M2 su macOS).
- **Risultato misurato su Windows (build `--release`)**:
  - `Warm p50`: **592.86 ms**
  - `Warm p95`: **834.74 ms** (pienamente $\le 1.000$ ms)
  - `Warm p99`: **972.18 ms**
  - `Gate p95`: **RISPETTATO** (sotto la soglia di 1 secondo).

### 4.3 Stato A04
- Lo stato del benchmark A04 rimane formalmente e immutabilmente **NON VERIFICATO** (in attesa del set gold validato).

---

## 5. Correzioni Applicate alla Proposta per il Passo 3b

Nel documento [fase3-proposta.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3-proposta.md#L210-L245) sono state integrate le correzioni richieste:
1. **Incremento Token**: la dicitura `"+30-50% di token"` è stata esplicitamente etichettata come **stima ipotetica**, da verificare sul campo con i dati effettivi restituiti da OpenAI.
2. **Integrità dei singoli passaggi**: specificato formalmente che, inviando più passaggi per fonte, **ogni singolo passaggio inviato deve restare verificato singolarmente tramite la propria impronta crittografica (`passage.sha256`)**, garantendo l'integrità del frammento oltre a quella del file padre.
