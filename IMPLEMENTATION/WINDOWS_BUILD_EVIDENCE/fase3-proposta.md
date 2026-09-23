# FASE 3 — Proposta Tecnica Corretta: Qualità della Selezione delle Fonti

Stato: **Proposta tecnica corretta (Nessun codice modificato)**  
Data: 23/09/2026 (UTC+8)  
Riferimento evidenze FASE 1: `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase1-diagnosi.md` e `fase1-diagnose-output.txt`  
Vincolo operativo: **STOP — In attesa di approvazione dell'auditor e via libera di Cesare prima di qualsiasi implementazione**.

---

## 1. Struttura in Due Passi e Sequenza Operativa

Per evitare modifiche aggregate difficili da isolare, la FASE 3 è organizzata in **due passi sequenziali**, ciascuno seguito da misurazione empirica dedicata:

- **Passo 3a — Quali documenti scegliere (Punti A, B, E)**:
  - Punto A: Bonus del titolo condizionato (IDF / frequenza documentale).
  - Punto B: Integrazione formalizzata delle parole comuni italiane (stopwords).
  - Punto E: Soglia minima di pertinenza su valori assoluti (cut-off pre-selezione).
  - *Misura dopo il Passo 3a*: Esecuzione benchmark `A05_DEV_QUERIES.json` e verifica posizionamento documenti BNXT e ARKAI tramite `diagnose_fase1`.
- **Passo 3b — Quanto testo inviare di ciascuno (Punti C, D)**:
  - Punto C: Selezione passaggi più pertinenti per documento (1–3 passaggi a grana fine).
  - Punto D: Gestione budget 24.000 byte con tetto dinamico per documento (entro il limite tassativo di 10 fonti S1…S10).
  - *Misura dopo il Passo 3b*: Verifica byte effettivi del contesto JSON, token utilizzati, latenza di anteprima e tempo totale end-to-end registrato nel log.

---

## 2. Percorsi Reali e Criteri di Accettazione Concordati

I percorsi del vault reale esaminati nel registro `fase1-diagnose-output.txt` risiedono tutti nella directory `20_RAW_SOURCES` con prefisso hash esadecimale a 16 caratteri. Non esistono percorsi con prefisso "02_PROJECTS/".

### 2.1 Criterio BNXT (Domanda: *"cosa e' il progetto bnxt ?"*)
Tra le fonti inviate ad OpenAI devono essere presenti **almeno 4 dei seguenti 5 documenti di progetto per esteso**:
1. `20_RAW_SOURCES/a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md`
2. `20_RAW_SOURCES/32f2a4081d13410e-BNXT CRM.md`
3. `20_RAW_SOURCES/abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md`
4. `20_RAW_SOURCES/112bf7d370012490-audit-localizzazione-EN-verifica-AG-2026-09-10.md`
5. Almeno uno tra:
   - `20_RAW_SOURCES/1e755ab82023a095-verifica-impl-plan-ux-email-whatsapp-2026-09-10.md`
   - `20_RAW_SOURCES/5a54c2ce2f581cf2-verifica-walkthrough-ux-email-whatsapp-2026-09-10.md`

**Condizione di esclusione vincolante**:  
**Nessun file estraneo** deve essere selezionato unicamente a causa della parola generica *"progetto"* nel titolo (esclusione tassativa di `20_RAW_SOURCES/b21c86f3e37a8792-Progetto senza nome (2).md` e `20_RAW_SOURCES/14fd281ff56ab94a-2026-06-04 - Valutazione e feedback su progetto.md`).

### 2.2 Criterio ARKAI (Domanda: *"ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA"*)
Tra le fonti inviate ad OpenAI devono essere presenti **almeno 6 dei 12 documenti ARKAI** identificati nella diagnosi della FASE 1:
1. `20_RAW_SOURCES/7254c793dd89f65d-2026-03-19 - Analisi icona app ARKAI STAGER.md`
2. `20_RAW_SOURCES/86e2218e7ed905f1-ARKAI FLOORPLAN NICE.md`
3. `20_RAW_SOURCES/540e37c638dd2045-2026-03-31 - Presentazione investitori Arkai.archi.md`
4. `20_RAW_SOURCES/aa217245dfd86aeb-nuovo LLM AI Arkai.md`
5. `20_RAW_SOURCES/b3f8add2793aa3b3-CONTRATTI ARKAI ITALIA.md`
6. `20_RAW_SOURCES/0bc92121a0ad46f7-2026-03-26 - Arkai.Dev expansion into Italian market.md`
7. `20_RAW_SOURCES/f4fd17ebca858f34-ARKAI.DEV Software Developer.md`
8. `20_RAW_SOURCES/2e9471848e17f686-2026-04-06 - ARKAI AI Free Render Engine Xcode project.md`
9. `20_RAW_SOURCES/89ed4d8455f40767-ARKAI FREE IMAGE AI.md`
10. `20_RAW_SOURCES/2ff8773ddf4229e7-2026-04-06 - Building ARKAI free image generation web app.md`
11. `20_RAW_SOURCES/ca804c2d899aa19b-ARKAI AI RENDER APP.md`
12. `20_RAW_SOURCES/76c1cadeb9e7f5e0-BOQ ARKAI COMPUTO METRICO.md`

### 2.3 Criteri Temporali
Il criterio di accettazione include il **tempo totale misurato dal registro** (`t_backend_total_ms` e `t_ui_total_ms` in `ask_timing.log`), verificando che il tempo di anteprima (`t_preview_total_ms`) rimanga nell'ordine dei millisecondi e che l'incremento di byte del contesto non degradi la reattività complessiva dell'applicazione.

---

## 3. PASSO 3a — Quali Documenti Scegliere

### 3.1 Punto A — Bonus del Titolo Condizionato (Title Bonus Pesato)

#### Diagnosi del problema
In `apps/desktop/src-tauri/src/search.rs` (righe 842–844), il punteggio lessicale BM25 assegna un bonus piatto di $+10.0$ per ogni termine della query presente nel titolo:
```rust
if title_tokens.contains(t) {
    score += 10.0;
}
```
Nella domanda *"cosa e' il progetto bnxt ?"*, il token generico `"progetto"` assegna $+10.0$ punti a qualsiasi documento con "progetto" nel nome. In `fase1-diagnose-output.txt`, file estranei come `b21c86f3e37a8792-Progetto senza nome (2).md` (LexScore 13.88 con bonus 10.0) e `14fd281ff56ab94a-2026-06-04 - Valutazione e feedback su progetto.md` (LexScore 17.66 con bonus 10.0) ottengono un punteggio sufficiente a scavalcare documenti sostanziali di BNXT come l'audit di baseline (rango 16) e l'audit di verifica (rango 18).

#### Cosa si propone e perché
Condizionare l'entità del bonus del titolo all'informatività del termine tramite la sua **document frequency** (`df`):
- Il bonus viene scalato dall'IDF del termine:
  $$\text{title\_bonus}(t) = \text{IDF}(t) \times K_{\text{title}}$$
  oppure applicato solo se il termine è sufficientemente specifico nel vault ($\frac{\text{df}(t)}{N} < 0.05$).
- Termini comunissimi nel vault come `"progetto"` (alta `df`, basso `idf`) ricevono un bonus trascurabile. Termini rari e discriminanti come `"bnxt"` o `"arkai"` (bassa `df`, alto `idf`) mantengono il pieno vantaggio nel titolo.

#### Vantaggi (Pro)
- Elimina l'ascesa artificiale di documenti non correlati generata da vocaboli comuni presenti nel titolo.
- Preserva il corretto risalto per documenti intitolati con nomi specifici di progetti o entità.

#### Svantaggi o rischi (Contro)
- Richiede la taratura del coefficiente $K_{\text{title}}$ sulle 30 query congelate di sviluppo (`A05_DEV_QUERIES.json`).

#### Alternative considerate e scartate
- *Azzeramento totale del bonus titolo*: Scartata perché farebbe perdere priorità a file esatti (es. `BNXT CRM.md`) quando la query cita l'entità principale.
- *Elenco manuale di parole escluse dal titolo*: Scartata perché arbitraria e fragile rispetto alla crescita del vault; la frequenza documentale (`df`) si aggiorna automaticamente sul corpus.

#### File e funzioni da modificare
- `apps/desktop/src-tauri/src/search.rs`: funzione `search()` (righe 842–844).
- `apps/desktop/src-tauri/src/bin/diagnose_fase1.rs`: allineamento del calcolo per la diagnostica.

#### Test da eseguire
- Taratura preliminare su `tests/gold/A05_DEV_QUERIES.json`.
- Verifica che `Progetto senza nome (2).md` e `Valutazione e feedback su progetto.md` non ricevano il bonus per la parola "progetto".
- Verifica che `BNXT CRM.md` riceva il bonus per il token "bnxt".

---

### 3.2 Punto B — Integrazione Parole Comuni Italiane (Stopwords)

#### Elenco attuale in `packages/search-engine/src/search-spec.json` (esattamente 89 voci)
```json
[
  "a", "about", "above", "after", "again", "against", "agli", "ai", "al", "alla", "alle", "allo",
  "an", "and", "at", "before", "below", "between", "but", "by", "che", "con", "da", "dagli",
  "dai", "dal", "dalla", "dalle", "dallo", "degli", "dei", "del", "della", "delle", "dello", "di",
  "down", "during", "e", "else", "for", "fra", "from", "further", "gli", "i", "if", "il", "in",
  "into", "is", "la", "le", "lo", "negli", "nei", "nel", "nella", "nelle", "nello", "non", "o",
  "off", "on", "once", "or", "out", "over", "per", "se", "su", "sugli", "sui", "sul", "sulla",
  "sulle", "sullo", "the", "then", "through", "to", "tra", "un", "una", "under", "uno", "up",
  "when", "with"
]
```

#### Elenco delle SOLE parole da aggiungere (esattamente 55 voci uniche)
L'elenco è stato ripulito da ogni duplicato, da voci già presenti e da forme suscettibili di ambiguità con sostantivi (sono state **tassativamente escluse** `"stato"`, `"stata"`, `"stati"`, `"state"`, presenti nel vault in documenti come `STATO_AUDIT_2026-09-14.md` o espressioni come "stato del progetto"):

```json
[
  "abbiamo", "ad", "anche", "ancora", "avere", "avete", "aveva", "avevano", "chi", "ci",
  "come", "cosa", "cui", "dove", "ed", "era", "erano", "essa", "esse", "essere",
  "essi", "esso", "gia", "ha", "hai", "hanno", "ho", "li", "loro", "mentre",
  "mi", "ne", "od", "perche", "quale", "quali", "quando", "quanta", "quante", "quanti",
  "quanto", "quasi", "quella", "quelle", "quelli", "quello", "questa", "queste", "questi", "questo",
  "sei", "si", "sono", "ti", "vi"
]
```
*Totale combinato risultante: 89 + 55 = 144 voci.*

#### Vincoli architetturali e impatti
1. **Condivisione multipiattaforma**: `search-spec.json` è la sorgente unica condivisa tra backend Rust (`search.rs`), frontend TypeScript (`packages/search-engine/src/tokenizer.ts`) e versione macOS.
2. **Ricostruzione obbligatoria dell'indice**: L'aggiunta di stopwords altera i token generati da `tokenize_text`. Richiede la ricostruzione dell'indice lessicale `SEARCH_INDEX.json` per ogni vault.
3. **Rimisurazione dei benchmark**: Tutti i benchmark di ricerca (A05, A15 e la suite dei gate) devono essere rimisurati da zero post-reindicizzazione.

#### Vantaggi (Pro)
- Rimozione di `"cosa"` dalla query BM25 (nella diagnosi FASE 1 `"cosa"` era il primo token estratto per BNXT).
- Prevenzione dell'inquinamento da particelle pronominali e forme ausiliari prive di specificità.

#### Svantaggi o rischi (Contro)
- Necessità di reindicizzazione completa del vault di test e riallineamento dei file JSON di specifica.

#### File e funzioni da modificare
- `packages/search-engine/src/search-spec.json`: aggiornamento array `stop_words`.
- `packages/search-engine/src/tokenizer.ts` e `apps/desktop/src-tauri/src/search.rs`: verifica caricamento.

---

### 3.3 Punto E — Soglia Minima di Pertinenza su Valori Assoluti

#### Diagnosi del problema
Il punteggio finale della fusione ibrida (`fused_score`) è **normalizzato min-max per singola query**:
$$\text{lex\_norm} = \frac{\text{lex} - \text{lex}_{\min}}{\text{lex}_{\max} - \text{lex}_{\min}}, \quad \text{sem\_norm} = \frac{\text{sem} - \text{sem}_{\min}}{\text{sem}_{\max} - \text{sem}_{\min}}$$
Di conseguenza, il primo documento classificato ha sempre un punteggio relativo vicino a $1.0$, anche quando l'intero vault è totalmente privo di attinenza con la domanda. Una soglia applicata sul punteggio normalizzato non filtra i casi estranei.

#### Dati reali di distribuzione SemSim dalla FASE 1 (`fase1-diagnose-output.txt`)

##### 1. Domanda BNXT (*"cosa e' il progetto bnxt ?"*)
- **Documenti pertinenti BNXT**:
  - `32f2a4081d13410e-BNXT CRM.md`: $\text{SemSim} = \mathbf{0.5333}$, $\text{LexScore} = 26.47$
  - `4245a51312c5c1f2-Workflow app iPhone nativa.md`: $\text{SemSim} = \mathbf{0.5152}$, $\text{LexScore} = 3.99$
  - `a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md`: $\text{SemSim} = \mathbf{0.4876}$, $\text{LexScore} = 33.39$
  - `5a54c2ce2f581cf2-verifica-walkthrough-ux-email-whatsapp.md`: $\text{SemSim} = \mathbf{0.4234}$, $\text{LexScore} = 13.22$
  - `112bf7d370012490-audit-localizzazione-EN-verifica.md`: $\text{SemSim} = \mathbf{0.3986}$, $\text{LexScore} = 4.01$
  - `abaef2b48c6e5b70-audit-localizzazione-EN-baseline.md`: $\text{SemSim} = \mathbf{0.3891}$, $\text{LexScore} = 8.10$
  - `1e755ab82023a095-verifica-impl-plan-ux-email-whatsapp.md`: $\text{SemSim} = \mathbf{0.3852}$, $\text{LexScore} = 12.82$
- **Documenti estranei spinti in alto dalla parola "progetto"**:
  - `b21c86f3e37a8792-Progetto senza nome (2).md`: $\text{SemSim} = \mathbf{0.3826}$, $\text{LexScore} = 13.88$ (di cui $10.0$ di bonus)
  - `14fd281ff56ab94a-Valutazione e feedback su progetto.md`: $\text{SemSim} = \mathbf{0.3632}$, $\text{LexScore} = 17.66$ (di cui $10.0$ di bonus)
  - `d7a52d05837b5450-Accordo di riservatezza per progetto.md`: $\text{SemSim} = \mathbf{0.3625}$, $\text{LexScore} = 13.59$ (di cui $10.0$ di bonus)
  - `b2a8b8d50ac331b6-Progetto senza nome (10).md`: $\text{SemSim} = \mathbf{0.3507}$, $\text{LexScore} = 14.05$ (di cui $10.0$ di bonus)
- **Rumore di fondo del vault (documenti non correlati)**:
  - $\text{SemSim} \le 0.36$ e $\text{LexScore} = 0.0$.

##### 2. Domanda ARKAI (*"ARKAI E' UNA AZIENDA, UN MARCHIO ? DI COSA TRATTA"*)
- **Tutti i 12 documenti pertinenti ARKAI**:
  - Presentano $\text{SemSim}$ assoluto compreso tra $\mathbf{0.4848}$ e $\mathbf{0.5932}$ (11 documenti su 12 hanno $\text{SemSim} \ge 0.5086$).
- **Documenti estranei nel vault**:
  - $\text{SemSim} < 0.45$.

#### Cosa si propone e perché
Definire la soglia di ammissibilità pre-selezione su **metriche assolute non normalizzate**:
1. Un documento è ammesso se rispetta la condizione disgiuntiva:
   $$\text{SemSim} \ge \theta_{\text{sem}} \quad \lor \quad \text{LexScore}_{\text{raw}} \ge \theta_{\text{lex}}$$
   dove $\text{LexScore}_{\text{raw}}$ è il punteggio BM25 privo del bonus titolo.
2. Dai dati di FASE 1, la soglia assoluta ottimale indicativa è:
   - $\theta_{\text{sem}} \approx 0.380$
   - $\theta_{\text{lex}} \approx 3.0$
   Questa combinazione ammette tutti i documenti di BNXT (che hanno $\text{SemSim} \ge 0.385$ o BM25 significativo) ed esclude il rumore con $\text{SemSim} \le 0.370$ e BM25 nullo.
3. Se nessun documento supera la soglia, il sistema restituisce una lista vuota o una sola fonte primaria dichiarata, evitando di riempire la risposta con fonti irrilevanti.

#### Vantaggi (Pro)
- Blocca l'inclusione forzata di documenti estranei fino al tetto di 10.
- Riduce l'inquinamento del prompt e previene allucinazioni su domande a basso riscontro nel vault.

#### Svantaggi o rischi (Contro)
- Una soglia $\theta_{\text{sem}}$ eccessivamente rigida rischierebbe di escludere documenti periferici. La taratura avverrà sulle 30 query di `A05_DEV_QUERIES.json`.

---

## 4. PASSO 3b — Quanto Testo Inviare di Ciascuno

### 4.1 Punto C — Passaggi Multipli per Documento (1–3 Passaggi)

#### Situazione attuale
In `ai.rs` (righe 450–461), per documenti lunghi ($> 3.000$ caratteri), il codice estrae un unico passaggio corrispondente a `r.matching_passage_id`, oppure tronca il testo grezzo a 3.000 caratteri. Se un documento contiene sezioni distinte rilevanti (es. audit con contesto iniziale ed esito finale), OpenAI riceve solo un frammento isolato.

#### Come cambiano citazioni, localizzatori e controllo di integrità
1. **Localizzatori (`locator`)**:
   - In `Source`, `locator` diventa la sequenza ordinata dei localizzatori dei passaggi selezionati (es. `Some("§2.1, §4.3")`).
   - Nel campo `content`, ciascun blocco di testo è preceduto dal rispettivo contrassegno:  
     `"[§2.1] <testo passaggio 1>\n\n[§4.3] <testo passaggio 2>"`.
2. **Identificativi di citazione e interfaccia**:
   - OpenAI continua a citare la fonte a livello di documento con `S1…S10`.
   - L'utente nell'interfaccia vede la fonte con i localizzatori multipli chiaramente indicati nel riquadro espandibile.
3. **Controllo di integrità (`verify_pre` e `verify_post`)**:
   - Con l'invio di più passaggi per fonte, **ogni singolo passaggio inviato deve restare verificato singolarmente (impronta del passaggio `passage.sha256`)**, non solo il file padre.
   - Viene verificata la corrispondenza esatta dello SHA-256 del testo estratto rispetto al campo `sha256` del singolo passaggio registrato nel catalogo, oltre alla validazione del file padre (`content_hash`, `mtime`, `size`).
   - Se un passaggio o il file risultano alterati, la fonte viene rigettata tempestivamente con errore esplicito.

---

### 4.2 Punto D — Budget 24.000 Byte con Tetto per Documento

#### Limite tassativo delle fonti: S1…S10 (Nessun superamento)
- Gli identificativi di citazione nel prompt e nel JSON schema rimangono tassativamente **l'elenco chiuso S1…S10**.
- **Il Punto D NON supera 10 fonti**.
- L'obiettivo del Punto D è distribuire meglio i 24.000 byte tra le fonti effettivamente selezionate ($\le 10$, tipicamente 4–8 fonti dense), evitando che la selezione si fermi a 15.000 byte per troncamenti prematuri o che un solo documento monopolizzi il contesto.

#### Tetto per documento e allocazione dinamica
- **Tetto massimo per documento**: nessun documento può superare 3.500 byte.
- Documenti di massimo rango (primi 3): fino a 3.500 byte (2–3 passaggi combinati).
- Documenti di supporto (dal quarto in poi): fino a 2.000 byte.
- Il ciclo di selezione in `ai.rs` accumula passaggi pertinenti fino al raggiungimento del budget di 24.000 byte, fermandosi comunque a massimo 10 fonti.

#### Svantaggi o rischi (Contro): Token, Costi e Latenza di OpenAI
- **Aumento dei token di input**: passare da ~15.000 byte a ~22.000–24.000 byte comporta un incremento potenziale del 30–50% dei token di prompt inviati ad OpenAI (*stima ipotetica, da verificare sui dati reali restituiti dall'API OpenAI*).
- **Latenza di risposta**: nella prova di Cesare del 2026-09-23T05:17:57Z, la chiamata OpenAI ha impiegato **3.769 ms**. Con un contesto più corposo, il tempo di risposta di OpenAI potrebbe variare in proporzione al volume effettivo dei token.
- **Monitoraggio obbligatorio**: il criterio di accettazione della FASE 3b include la misurazione del tempo totale end-to-end (`t_backend_total_ms` e `t_ui_total_ms`).

---

## 5. Misure e Benchmark del Progetto (Prevenzione Overfitting)

Tarare soglie e moltiplicatori solo sulle due query BNXT e ARKAI comporterebbe un rischio di adattamento a casi particolari. La procedura di validazione adotta i benchmark congelati del repository:

1. **Dataset di taratura congelato**:
   - `tests/gold/A05_DEV_QUERIES.json` (30 domande di sviluppo congelate con verità di base).
   - Tutte le calibrazioni di $K_{\text{title}}$, $\theta_{\text{sem}}$ e $\theta_{\text{lex}}$ saranno eseguite su questo set.
2. **Misura Gold A05 (Recall@10)**:
   - Valore verificato di riferimento pre-FASE 3: **Recall@10 = 0.950** (PASS, rilievo C8).
   - **Vincolo vincolante**: Nessuna modifica è accettata se causa un peggioramento di A05 ($\text{Recall@10} < 0.950$).
3. **Misura A15 (Scala 1.000 doc / 11.000 passaggi)**:
   - Valore verificato di riferimento: p95 a caldo = **198.90 ms** (PASS).
   - **Vincolo vincolante**: Nessuna modifica è accettata se degrada la latenza di A15 oltre la soglia dei 200 ms.
4. **Stato di A04 ("Termini ed espressioni da etichettare")**:
   - Nel file di progetto `TODO LIST.TXT`, il gate A04 è formalmente rubricato come **NON VERIFICATO** in attesa di etichettatura completa da parte dell'utente.
   - Poiché le modifiche alle stopwords e al tokenizer impattano la ricerca lessicale pura, dopo la reindicizzazione tutti i benchmark, inclusa l'esecuzione di A04, saranno rimisurati e verbalizzati, verificando che non si verifichino regressioni nei test funzionali esistenti.

---

## 6. Riepilogo File Coinvolti e Piano di Esecuzione

| Componente | File Coinvolti | Scopo Modifica |
| :--- | :--- | :--- |
| **Stopwords** | `packages/search-engine/src/search-spec.json`<br>`packages/search-engine/src/tokenizer.ts` | Integrazione delle 55 nuove stopwords italiane e riallineamento spec. |
| **Motore Ricerca** | `apps/desktop/src-tauri/src/search.rs` | Bonus titolo proporzionale a IDF / document frequency; rigenerazione indice. |
| **Selettore AI** | `apps/desktop/src-tauri/src/ai.rs` | Soglia minima assoluta ($\theta_{\text{sem}}, \theta_{\text{lex}}$), passaggi multipli, budget 24.000 B con tetto 3.500 B, conservazione limite S1…S10. |
| **Diagnostica** | `apps/desktop/src-tauri/src/bin/diagnose_fase1.rs`<br>`apps/desktop/src-tauri/src/bin/gold-benchmark.rs` | Verifica criteri BNXT/ARKAI e validazione gold A05/A15. |

---

## 7. Stato Operativo

- [x] Proposta tecnica corretta redatta in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3-proposta.md`.
- [x] Task List dell'implementation plan allineata alla sequenza 3a e 3b.
- [x] **STOP vincolante**: Nessuna riga di codice modificata. In attesa di approvazione dell'auditor e via libera di Cesare per procedere al Passo 3a.
