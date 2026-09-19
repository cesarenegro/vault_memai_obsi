# Diagnosi Analitica Dati Grezzi: Regressioni Q21 e Q26 (Gate A05)

**Data**: 2026-09-20 (UTC+8)  
**Autore**: AG (Pair Programming Assistant)  
**Destinatari**: Auditor Indipendente Claude, Utente Cesare  
**Ambito**: Verifica delle evidenze grezze per il commit `4c33068`, tag `v3.1.0-fusion-fix`  
**Vault di misura**: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/scratch/a05_v2_context_vault` (120 documenti, 167 passaggi, cache embedding `text-embedding-3-small` congelata)  
**Query Gold congelate**: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A05_QUERIES.json`  
**Codice di prodotto**: Immutato (zero modifiche)

---

## 1. Obiettivo della Diagnosi

Condurre un'estrazione quantitativa direttamente dai dati grezzi per verificare o smentire empiricamente le due ipotesi sulla causa dell'uscita dalla top 10 delle query **Q21** (rango baseline 6 $\rightarrow$ rango ibrido 26) e **Q26** (rango baseline 4 $\rightarrow$ rango ibrido 12):
1. **Ipotesi 1**: La normalizzazione min-max per query amplifichi il rumore lessicale quando l'escursione lessicale della query è stretta.
2. **Ipotesi 2**: Il bonus di 0,20 sul codice esatto stia premiando documenti errati contenenti codici.

---

## 2. Diagnosi Dati Grezzi: Query Q21

### 2.1 Parametri Generali della Query
- **Query ID**: `Q21`
- **Testo Query**: `"Rocchetti adesivi sprovvisti di supporto siliconato da gettare per azzerare i residui solidi"`
- **Documento Atteso (Target)**: `doc_021` (`05_PACKAGING_KNOWLEDGE/doc_021.md`)
  - Titolo: *Tecnologia di Etichettatura Ecologica Linerless*
  - Estratto target nel gold: *"Tecnologia di etichettatura linerless: nastri senza carta siliconata di scarto con spalmatura di silicone sul fronte per applicazione diretta su vassoi ortofrutta."*
- **Condizione `is_exact_code`**: **`false`** (la query è in linguaggio naturale e contiene spazi).

### 2.2 Valori Estremi della Query (138 Candidati Intermedi)
- `min_lex`: **`0.000000`**
- `max_lex`: **`24.090000`** (prodotto da `doc_087.md`, *Carta Siliconata da Glassine come Liner di Supporto per Biadesivi*)
- **Escursione Lessicale (`max_lex - min_lex`)**: **`24.090000`**
- `min_sem`: **`0.000000`**
- `max_sem`: **`0.508415`** (prodotto da `doc_087.md`)
- **Escursione Semantica (`max_sem - min_sem`)**: **`0.508415`**

### 2.3 Punteggi del Documento Atteso (`doc_021`)
- **Punteggio lessicale grezzo prima della normalizzazione (`base_score`)**: **`4.7000`** (Rango lessicale puro = **6** su 18 match)
- **Punteggio semantico grezzo prima della normalizzazione (`sem_sim`)**: **`0.4236`** (Rango semantico puro = **24** su 120 documenti)
- `lex_norm`: `0.0000` (valutato sulla voce semantica)
- `sem_norm`: `(0.4236 - 0.0) / 0.508415` = **`0.8332`**
- `exact_bonus`: **`0.00`** (`is_exact_code` è false, `matches_term` è false)
- **`fused_score`**: $0.5 \times 0.0000 + 0.5 \times 0.8332 + 0.00$ = **`0.4166`**
- **Rango Ibrido Finale**: **26**

### 2.4 Tabella Completa dei Documenti che Scavalcano il Target (Ranks 1..26)

| Rango | Documento ID | Percorso / Titolo Documento | Raw Lex (`base_score`) | Raw Sem (`sem_sim`) | `lex_norm` | `sem_norm` | `exact_bonus` | `fused_score` | Esito |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| 1 | `doc_339eb6ae` | `05_PACKAGING_KNOWLEDGE/doc_087.md` | 0.0000 | 0.5084 | 0.0000 | 1.0000 | 0.00 | **0.5000** | Competitore |
| 2 | `doc_339eb6ae...` | `05_PACKAGING_KNOWLEDGE/doc_087.md` (match lessicale) | 24.0900 | 0.0000 | 1.0000 | 0.0000 | 0.00 | **0.5000** | Competitore |
| 3 | `doc_bbcfe2ce` | `05_PACKAGING_KNOWLEDGE/doc_062.md` | 0.0000 | 0.5066 | 0.0000 | 0.9964 | 0.00 | **0.4982** | Competitore |
| 4 | `doc_c8b9ceb2` | `05_PACKAGING_KNOWLEDGE/doc_066.md` | 0.0000 | 0.4857 | 0.0000 | 0.9554 | 0.00 | **0.4777** | Competitore |
| 5 | `doc_56780abb` | `05_PACKAGING_KNOWLEDGE/doc_031.md` | 0.0000 | 0.4592 | 0.0000 | 0.9033 | 0.00 | **0.4516** | Competitore |
| 6 | `doc_bbcfe2ce...` | `05_PACKAGING_KNOWLEDGE/doc_062.md` (match lessicale) | 21.6800 | 0.0000 | 0.9000 | 0.0000 | 0.00 | **0.4500** | Competitore |
| 7 | `doc_59878523` | `05_PACKAGING_KNOWLEDGE/doc_051.md` | 0.0000 | 0.4572 | 0.0000 | 0.8992 | 0.00 | **0.4496** | Competitore |
| 8 | `doc_ca3b2c73` | `05_PACKAGING_KNOWLEDGE/doc_037.md` | 0.0000 | 0.4506 | 0.0000 | 0.8864 | 0.00 | **0.4432** | Competitore |
| 9 | `doc_376db3f4` | `05_PACKAGING_KNOWLEDGE/doc_044.md` | 0.0000 | 0.4470 | 0.0000 | 0.8791 | 0.00 | **0.4396** | Competitore |
| 10 | `doc_b102f43d` | `05_PACKAGING_KNOWLEDGE/doc_114.md` | 0.0000 | 0.4443 | 0.0000 | 0.8739 | 0.00 | **0.4369** | Competitore |
| 11 | `doc_70b7ed50` | `05_PACKAGING_KNOWLEDGE/doc_116.md` | 0.0000 | 0.4426 | 0.0000 | 0.8706 | 0.00 | **0.4353** | Competitore |
| 12 | `doc_27f9b3bf` | `05_PACKAGING_KNOWLEDGE/doc_102.md` | 0.0000 | 0.4416 | 0.0000 | 0.8685 | 0.00 | **0.4343** | Competitore |
| 13 | `doc_eea1b036` | `05_PACKAGING_KNOWLEDGE/doc_074.md` | 0.0000 | 0.4395 | 0.0000 | 0.8645 | 0.00 | **0.4322** | Competitore |
| 14 | `doc_96e4fb83` | `05_PACKAGING_KNOWLEDGE/doc_088.md` | 0.0000 | 0.4383 | 0.0000 | 0.8620 | 0.00 | **0.4310** | Competitore |
| 15 | `doc_4e6d34de` | `05_PACKAGING_KNOWLEDGE/doc_017.md` | 0.0000 | 0.4377 | 0.0000 | 0.8610 | 0.00 | **0.4305** | Competitore |
| 16 | `doc_c2f8279c` | `05_PACKAGING_KNOWLEDGE/doc_094.md` | 0.0000 | 0.4352 | 0.0000 | 0.8560 | 0.00 | **0.4280** | Competitore |
| 17 | `doc_df3e8b8c` | `05_PACKAGING_KNOWLEDGE/doc_082.md` | 0.0000 | 0.4351 | 0.0000 | 0.8558 | 0.00 | **0.4279** | Competitore |
| 18 | `doc_3ad94753` | `05_PACKAGING_KNOWLEDGE/doc_084.md` | 0.0000 | 0.4322 | 0.0000 | 0.8500 | 0.00 | **0.4250** | Competitore |
| 19 | `doc_1a337fea` | `05_PACKAGING_KNOWLEDGE/doc_027.md` | 0.0000 | 0.4318 | 0.0000 | 0.8494 | 0.00 | **0.4247** | Competitore |
| 20 | `doc_8a917641` | `05_PACKAGING_KNOWLEDGE/doc_086.md` | 0.0000 | 0.4283 | 0.0000 | 0.8425 | 0.00 | **0.4212** | Competitore |
| 21 | `doc_d0b63dc6` | `05_PACKAGING_KNOWLEDGE/doc_003.md` | 0.0000 | 0.4266 | 0.0000 | 0.8392 | 0.00 | **0.4196** | Competitore |
| 22 | `doc_e4b6ecc6` | `05_PACKAGING_KNOWLEDGE/doc_090.md` | 0.0000 | 0.4261 | 0.0000 | 0.8381 | 0.00 | **0.4191** | Competitore |
| 23 | `doc_95c9fc45` | `05_PACKAGING_KNOWLEDGE/doc_077.md` | 0.0000 | 0.4253 | 0.0000 | 0.8365 | 0.00 | **0.4183** | Competitore |
| 24 | `doc_e0493abf` | `05_PACKAGING_KNOWLEDGE/doc_011.md` | 0.0000 | 0.4253 | 0.0000 | 0.8365 | 0.00 | **0.4182** | Competitore |
| 25 | `doc_c3f1586b` | `05_PACKAGING_KNOWLEDGE/doc_039.md` | 0.0000 | 0.4252 | 0.0000 | 0.8363 | 0.00 | **0.4182** | Competitore |
| **26** | **`doc_04a71dd2`** | **`05_PACKAGING_KNOWLEDGE/doc_021.md`** | **0.0000** | **0.4236** | **0.0000** | **0.8332** | **0.00** | **0.4166** | **TARGET** |

---

## 3. Diagnosi Dati Grezzi: Query Q26

### 3.1 Parametri Generali della Query
- **Query ID**: `Q26`
- **Testo Query**: `"Guaine avvolgibili ricavate da scarti plastici urbani post-consumo per stabilizzare i bancali"`
- **Documento Atteso (Target)**: `doc_026` (`05_PACKAGING_KNOWLEDGE/doc_026.md`)
  - Titolo: *Film Termoretraibile con Polietilene PCR Post-Consumo*
  - Estratto target nel gold: *"Film termoretraibile con il 50% di polietilene PCR certificato: proprieta elastiche che mantengono la coesione del carico pallettizzato riducendo il fabbisogno di vergine."*
- **Condizione `is_exact_code`**: **`false`** (la query è in linguaggio naturale e contiene spazi).

### 3.2 Valori Estremi della Query (134 Candidati Intermedi)
- `min_lex`: **`0.000000`**
- `max_lex`: **`19.390000`** (prodotto da `doc_077.md`, *Guaine Tubolari a Rete Elastica...*, e `doc_114.md`, *Guaine Termoisolanti...*)
- **Escursione Lessicale (`max_lex - min_lex`)**: **`19.390000`**
- `min_sem`: **`0.000000`**
- `max_sem`: **`0.497034`** (prodotto da `doc_077.md`)
- **Escursione Semantica (`max_sem - min_sem`)**: **`0.497034`**

### 3.3 Punteggi del Documento Atteso (`doc_026`)
- **Punteggio lessicale grezzo prima della normalizzazione (`base_score`)**: **`8.7000`** (Rango lessicale puro = **4** su 10 match)
- **Punteggio semantico grezzo prima della normalizzazione (`sem_sim`)**: **`0.4514`** (Rango semantico puro = **9** su 120 documenti)
- `lex_norm`: `0.0000` (valutato sulla voce semantica)
- `sem_norm`: `(0.4514 - 0.0) / 0.497034` = **`0.9081`**
- `exact_bonus`: **`0.00`** (`is_exact_code` è false, `matches_term` è false)
- **`fused_score`**: $0.5 \times 0.0000 + 0.5 \times 0.9081 + 0.00$ = **`0.4540`**
- **Rango Ibrido Finale**: **12**

### 3.4 Tabella Completa dei Documenti che Scavalcano il Target (Ranks 1..12)

| Rango | Documento ID | Percorso / Titolo Documento | Raw Lex (`base_score`) | Raw Sem (`sem_sim`) | `lex_norm` | `sem_norm` | `exact_bonus` | `fused_score` | Esito |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| 1 | `doc_95c9fc45` | `05_PACKAGING_KNOWLEDGE/doc_077.md` | 0.0000 | 0.4970 | 0.0000 | 1.0000 | 0.00 | **0.5000** | Competitore |
| 2 | `doc_95c9fc45...` | `05_PACKAGING_KNOWLEDGE/doc_077.md` (match lessicale su "Guaine") | 19.3900 | 0.0000 | 1.0000 | 0.0000 | 0.00 | **0.5000** | Competitore |
| 3 | `doc_b102f43d...` | `05_PACKAGING_KNOWLEDGE/doc_114.md` (match lessicale su "Guaine") | 19.3900 | 0.0000 | 1.0000 | 0.0000 | 0.00 | **0.5000** | Competitore |
| 4 | `doc_a259e95b` | `05_PACKAGING_KNOWLEDGE/doc_117.md` | 0.0000 | 0.4775 | 0.0000 | 0.9608 | 0.00 | **0.4804** | Competitore |
| 5 | `doc_e0493abf` | `05_PACKAGING_KNOWLEDGE/doc_011.md` | 0.0000 | 0.4689 | 0.0000 | 0.9434 | 0.00 | **0.4717** | Competitore |
| 6 | `doc_086ca4be` | `05_PACKAGING_KNOWLEDGE/doc_009.md` | 0.0000 | 0.4626 | 0.0000 | 0.9308 | 0.00 | **0.4654** | Competitore |
| 7 | `doc_df3e8b8c...` | `05_PACKAGING_KNOWLEDGE/doc_082.md` (match lessicale su "scarti plastici") | 18.0100 | 0.0000 | 0.9288 | 0.0000 | 0.00 | **0.4644** | Competitore |
| 8 | `doc_56780abb` | `05_PACKAGING_KNOWLEDGE/doc_031.md` | 0.0000 | 0.4585 | 0.0000 | 0.9225 | 0.00 | **0.4613** | Competitore |
| 9 | `doc_af113ad4` | `05_PACKAGING_KNOWLEDGE/doc_001.md` | 0.0000 | 0.4552 | 0.0000 | 0.9159 | 0.00 | **0.4579** | Competitore |
| 10 | `doc_0e9c0fbd` | `05_PACKAGING_KNOWLEDGE/doc_072.md` | 0.0000 | 0.4544 | 0.0000 | 0.9142 | 0.00 | **0.4571** | Competitore |
| 11 | `doc_210493a1` | `05_PACKAGING_KNOWLEDGE/doc_078.md` | 0.0000 | 0.4538 | 0.0000 | 0.9130 | 0.00 | **0.4565** | Competitore |
| **12** | **`doc_00dfd273`** | **`05_PACKAGING_KNOWLEDGE/doc_026.md`** | **0.0000** | **0.4514** | **0.0000** | **0.9081** | **0.00** | **0.4540** | **TARGET** |

---

## 4. Riscontro Analitico alle Due Ipotesi

### Ipotesi 1: Il bonus di 0,20 sul codice esatto premia documenti sbagliati
- **ESITO: SMENTITA DAI DATI (0,00 per tutti).**
- **Evidenza empirica**:
  - `is_exact_code` in `embeddings.rs:584` richiede che l'intera query sia priva di spazi e contenga solo alfanumerici, trattini o underscore. Sia la query Q21 che la query Q26 contengono spazi, per cui `is_exact_code` è valutato a `false`.
  - La condizione `matches_term` (`item.title.to_lowercase().contains(&term_lower) || item.snippet.to_lowercase().contains(&term_lower)`) verifica se il titolo o lo snippet contengono la query intera. Nessun documento del corpus contiene l'intera frase della query, quindi `matches_term` è `false`.
  - Pertanto, `exact_bonus` è **esattamente 0.00** sia per i documenti attesi sia per tutti i documenti che li scavalcano. Il bonus sui codici non ha avuto alcun impatto né su Q21 né su Q26.

### Ipotesi 2: La normalizzazione min-max amplifica il rumore lessicale quando l'escursione è stretta
- **ESITO: SMENTITA NELLA PREMESSA, MA RIVELATRICE DELLA DINAMICA REALE.**
- **Evidenza empirica**:
  1. L'escursione lessicale **non è stretta**: è pari a **24.09** su Q21 e a **19.39** su Q26 (su una scala tipica BM25/TF-IDF che per testi brevi ha valori massimi tra 15 e 30).
  2. L'ispezione dei dati grezzi rivela la vera dinamica meccanica che ha prodotto il declassamento di rango:
     - **Disallineamento degli ID tra Catalogo e Indice**:
       In `VAULT_CATALOG.json` gli ID dei documenti sono troncati a 16 caratteri esadecimali (`doc_<16hex>`, es. `doc_00dfd273a93893c4`), mentre in `SEARCH_INDEX.json` sono memorizzati con hash completo a 64 caratteri esadecimali (`doc_<64hex>`, es. `doc_00dfd273a93893c4...`).
       In `embeddings.rs:589-606`, la fusione indicizza l'unione degli ID:
       ```rust
       let mut all_ids: BTreeSet<String> = BTreeSet::new();
       all_ids.extend(lexical_results.iter().map(|i| i.id.clone()));
       all_ids.extend(semantic_scores.keys().cloned());
       ```
       Poiché gli ID hanno lunghezze diverse (68 caratteri vs 20 caratteri), `all_ids` non unisce il risultato lessicale e semantico dello stesso documento: genera invece due candidati distinti per documento (uno puramente lessicale con `sem_sim = 0.0` e uno puramente semantico con `base_score = 0.0`). Ciascun candidato può quindi raggiungere al massimo un punteggio fuso di $0.5000$.
     - **Causa reale del rango 26 di Q21**:
       Nella vecchia formula RRF (commit `3d88bc8`), il termine `base_score * 0.01` manteneva artificialmente il documento a rango 6 grazie al solo match lessicale (`base_score = 4.7000`), nascondendo il fatto che la componente semantica per Q21 era molto debole (rango semantico 24 con `sem_sim = 0.4236`). Con la normalizzazione a pesi paritari (0.5 semantica / 0.5 lessicale), i 23 documenti con similarità semantica superiore (da 0.425 a 0.508) e i documenti con match lessicale forte (score 24.09 e 21.68) si sono posizionati davanti al target, facendolo scivolare a rango 26.
     - **Causa reale del rango 12 di Q26 (Residuo C8)**:
       Nella semantica pura, `doc_026` era al limite della top 10 (rango 9, `sem_sim = 0.4514`, `sem_norm = 0.9081`, `fused_score = 0.4540`).
       Oltre agli 8 documenti con similarità semantica più alta (0.4538..0.4970), si sono inseriti davanti al target **3 competitori puramente lessicali** che contenevano parole chiave della query ("Guaine", "scarti plastici": `doc_077` e `doc_114` con score 19.39 normalizzato a 0.5000, `doc_082` con score 18.01 normalizzato a 0.4644).
       L'inserimento di questi 3 documenti lessicali con punteggio fuso superiore a 0.4540 ha fatto scivolare il target esattamente di 3 posizioni: **da rango 9 a rango 12**.

---

## 5. Rilievo C9 — Mancata Coalescenza degli Identificativi nella Fusione

Dall'ispezione della riga di codice `apps/desktop/src-tauri/src/embeddings.rs:589-606` e dai log grezzi di esecuzione, il disallineamento degli ID non è una semplice nota esplicativa ma costituisce il **Rilievo C9**:

### 5.1 Descrizione del Rilievo C9
In `embeddings.rs:589-606`, `all_ids` unisce gli identificativi restituiti da:
- `SEARCH_INDEX.json`: identificativi a 64 caratteri esadecimali (`doc_<64hex>`, es. `doc_00dfd273a93893c4c14832af6ab0acb2896428c1587579175874c3851c9eb42b`).
- `VAULT_CATALOG.json`: identificativi a 16 caratteri esadecimali (`doc_<16hex>`, es. `doc_00dfd273a93893c4`).

Poiché le chiavi stringa differiscono, `all_ids` non unisce i candidati per documento. Ogni documento trovato da entrambi i motori entra quindi due volte nella graduatoria: una volta come riga lessicale pura (con `sem_sim = 0.0`) e una volta come riga semantica pura (con `base_score = 0.0`).

### 5.2 Le Tre Conseguenze Meccaniche di C9
1. **Punteggio massimo raggiungibile pari a 0,5000**: Nessun documento può mai combinare i punteggi di entrambi i motori. La formula fusa $0.5 \times \text{lex\_norm} + 0.5 \times \text{sem\_norm}$ ha come limite superiore invalicabile $0.5 \times 1.0 + 0.5 \times 0.0 = 0.5000$. Un documento rilevante sia sul piano lessicale sia semantico non può mai superare un documento trovato da un solo motore.
2. **Minimi identicamente nulli e normalizzazione ridotta a divisione per il massimo**: Per costruzione, essendoci sempre righe con `sem_sim = 0.0` e righe con `base_score = 0.0`, $\min_{lex} = 0.0$ e $\min_{sem} = 0.0$ per ogni query. La normalizzazione min-max si riduce aritmeticamente a una semplice divisione per il massimo.
3. **Presenza di righe duplicate nella Top 10**: La classifica finale contiene lo stesso documento fisico replicato su righe distinte. Ad esempio, su Q26 `doc_077.md` occupa sia il rango 1 (semantico) sia il rango 2 (lessicale); su Q21 `doc_087.md` occupa i ranghi 1 e 2, e `doc_062.md` occupa i ranghi 3 e 6.

### 5.3 Misura di C9 sul Gold Ufficiale (40 Query)
Dall'esecuzione dello strumento diagnostico archiviato `diagnose_c8` sui 120 documenti:
- **Query con duplicati in Top 10**: **19 su 40 (47,5%)** (hanno meno di 10 documenti distinti in top 10).
- **Query con esattamente 10 documenti distinti**: **21 su 40 (52,5%)**.
- **Righe duplicate totali in Top 10**: **22 righe duplicate**.
- Evidenze archiviate: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/C9_DUPLICATI/` (`c9_duplicates_summary.json`, `c9_duplicates_per_query.jsonl`).

---

## 6. Calcolo Controfattuale e Riclassificazione delle Regressioni

Ricalcolando il punteggio fuso per ciascun documento unificando lessicale e semantica dello stesso file ($0.5 \times \text{lex\_norm} + 0.5 \times \text{sem\_norm}$), con tutti i concorrenti calcolati con la medesima coalescenza:

### 6.1 Target doc_021 su Q21
- Punteggi grezzi dello stesso documento: Raw Lex = 4.7000, Raw Sem = 0.4236.
- Normalizzati sui massimi coalescenti: Lex Norm = $4.7000 / 24.0900 = 0.1951$, Sem Norm = $0.4236 / 0.508415 = 0.8332$.
- Punteggio Fuso Controfattuale: $0.5 \times 0.1951 + 0.5 \times 0.8332 = \mathbf{0.5142}$ ($> 0.5000$).
- **Rango Controfattuale Coalescente**: **Rango 4** (recuperata in Top 10, prima era a rango 26).

### 6.2 Target doc_026 su Q26
- Punteggi grezzi dello stesso documento: Raw Lex = 8.7000, Raw Sem = 0.4514.
- Normalizzati sui massimi coalescenti: Lex Norm = $8.7000 / 19.3900 = 0.4487$, Sem Norm = $0.4514 / 0.497034 = 0.9082$.
- Punteggio Fuso Controfattuale: $0.5 \times 0.4487 + 0.5 \times 0.9082 = \mathbf{0.6784}$ ($> 0.5000$).
- **Rango Controfattuale Coalescente**: **Rango 4** (recuperata in Top 10, prima era a rango 12).

### 6.3 Conclusioni e Riclassificazione
1. Entrambi i target superano la soglia di 0,5000, superando ogni competitor trovato da un solo motore.
2. Entrambi i target raggiungono il **Rango 4** tra i documenti uniti.
3. Le regressioni di Q21 e Q26 **non sono limiti della formula di fusione normalizzata**, ma **esclusivamente conseguenze dirette del rilievo C9**.
4. L'effetto della correzione sul recall complessivo non è misurato. Le due regressioni sono formalmente riclassificate come anomalie indotte da C9.
