# Verifica indipendente — Correzione C8 (fusione ibrida) e misura gold A05

Data: 2026-09-20 (UTC+8)
Autore: Claude (auditor indipendente)
Oggetto: commit `4c33068`, tag `v3.1.0-fusion-fix`
Repository: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`

---

## 1. Esito complessivo

**Gate A05: PASS.** Recall@10 ibrido = **0,950** (38 hit su 40), soglia ≥ 0,90 superata.
**C8: CHIUSO nel merito.** La correzione della fusione produce l'effetto atteso ed è misurata correttamente.

Due rilievi restano aperti e sono descritti ai punti 4 e 5: **una regressione non dichiarata** nel rapporto di AG e **quattro errori nella tabella per-query** dello stesso rapporto. Nessuno dei due intacca il numero finale, entrambi intaccano l'affidabilità del rapporto.

---

## 2. Numeri ricalcolati da me dalle evidenze grezze

Fonte: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_FUSION_GOLD/per-query.jsonl` (40 righe), confrontato con
`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_V2_DIAGNOSTIC/per-query.jsonl` (40 righe).

| Modalità | Prima (3d88bc8) | Dopo (4c33068) | Delta |
|---|---|---|---|
| Sola semantica | 0,975 — 39/40 | 0,975 — 39/40 | 0,000 |
| Solo lessicale | 0,650 — 26/40 | 0,650 — 26/40 | 0,000 |
| Fusione ibrida | 0,675 — 27/40 | **0,950 — 38/40** | **+0,275** |

Le medie dichiarate in `summary.json` coincidono con le mie: verificate, non accettate.

Controllo di isolamento: i ranghi semantici e lessicali sono **identici query per query** rispetto alla baseline (zero differenze su 40 query). La modifica agisce quindi solo sulla fusione e non ha alterato le due componenti — è la prova che la misura è un confronto pulito.

---

## 3. Condizioni procedurali dell'incarico

| Requisito dell'incarico | Esito | Evidenza |
|---|---|---|
| Query di sviluppo congelate **prima** della taratura | VERIFICATO | `9cce037`, tag `v3.1.0-dev-queries-frozen`, 2026-09-19 22:10:10 +0800 |
| Parametri congelati **prima** del gold | VERIFICATO | `2ec1996`, 2026-09-19 22:27:01 +0800 |
| Gold misurato **dopo** il congelamento | VERIFICATO | `timestamp_utc8` in `summary.json` = 2026-09-20T01:28:54+08:00 |
| Gold misurato **una sola volta** | VERIFICATO | `A05_FUSION_GOLD/` introdotta da un unico commit (`4c33068`); nessuna corsa precedente in git né file duplicati |
| Nessuna modifica al codice di prodotto nel commit della misura | VERIFICATO | `4c33068` tocca solo evidenze, `TASK_LIST.md`, `TODO LIST.TXT` e il rapporto AG |
| Manifest del corpus verificato | VERIFICATO | `manifest-verify.log`, 123 file OK |
| Suite Rust verde con log grezzo | VERIFICATO | `cargo-test.log`: 79 + 17 test, 0 falliti |
| `test_hybrid_fusion_ranks_exact_code_first` ancora presente e passante | VERIFICATO | `embeddings.rs:876`, incluso nei 79 test verdi |
| Nuovo test "semantica pura entra in top 10" | VERIFICATO | `test_hybrid_fusion_pure_semantic_enters_top_ten`, `embeddings.rs:913` |
| Tag `v3.1.0-fusion-fix` sulla misura finale | VERIFICATO | punta a `4c33068cc031f1b15186c795cbcf0c08ed2b1c5f` |

---

## 4. RILIEVO 1 — Regressione non dichiarata (due query perse)

Il rapporto di AG elenca "query a recall 0 residue: solo 2 (Q21 rank 26 e Q26 rank 12)" presentandole come residui. **Non lo sono.** Entrambe erano **dentro** la top 10 prima della correzione:

| Query | Rango ibrido prima | Rango ibrido dopo | Effetto |
|---|---|---|---|
| Q21 | **6** | 26 | persa dalla top 10 |
| Q26 | **4** | 12 | persa dalla top 10 |

Il bilancio reale è: **13 query recuperate, 2 perse, saldo +11**. Il rapporto di AG mostra solo il lato positivo. Q26 è inoltre l'unico caso in cui la semantica trova il documento e la fusione lo degrada (`semantic_hit_hybrid_miss_queries: ["Q26"]` nel suo stesso `summary.json`): è lo stesso difetto di C8, in forma attenuata, ancora presente.

Complessivamente 32 query migliorano di rango, 5 peggiorano (Q04 2→3, Q16 5→9, Q21 6→26, Q26 4→12, Q33 3→7), 3 restano invariate.

---

## 5. RILIEVO 2 — Quattro errori nella tabella per-query del rapporto AG

AG dichiara 13 query recuperate ma ne elenca 14, e quattro ranghi di partenza sono errati rispetto al file grezzo:

| Query | Rango dichiarato da AG | Rango reale nella baseline |
|---|---|---|
| Q10 | None (recuperata) | **8 — era già in top 10, non è una query recuperata** |
| Q06 | None | **13** |
| Q18 | None | **15** |
| Q29 | None | **23** |

L'elenco corretto delle 13 recuperate è: Q03, Q05, Q06, Q12, Q17, Q18, Q23, Q29, Q31, Q32, Q34, Q37, Q38.
Il numero finale non cambia; cambia l'accuratezza di ciò che AG riferisce.

---

## 6. Formula attualmente in prodotto

`apps/desktop/src-tauri/src/embeddings.rs`, righe 653-690:

    lex_norm = (base_score - min_lex) / (max_lex - min_lex)
    sem_norm = (sem_sim - min_sem) / (max_sem - min_sem)
    exact_bonus = 0.20 se codice esatto, 0.05 se corrispondenza di termine, altrimenti 0.0
    fused_score = 0.5 * lex_norm + 0.5 * sem_norm + exact_bonus

Il difetto originale di C8 è rimosso: le due componenti ora pesano 0,5 ciascuna su scala 0-1, contro i termini RRF da ~0,006 di escursione che venivano schiacciati dal bonus. Il bonus esatto è stato alzato da 0,15 a 0,20 per il codice esatto, che su scala normalizzata resta un peso ragionevole e conserva il comportamento richiesto dal test sui codici.

---

## 7. Decisione ancora aperta: Variante A o Variante B

Rilievo già sollevato prima della misura gold e **non risolto**:

- La Variante B è stata scelta sul set di sviluppo per **una sola query su 30** (0,933 contro 0,900), e ottiene quel vantaggio **solo** con pesi 0,5/0,5: con qualunque altro peso scende a 0,900. Un massimo stretto su 30 campioni.
- La Variante A (RRF puro) dà **0,900 con tutti e cinque i set di pesi provati**: insensibile alla taratura, senza normalizzazione dinamica per query.
- Il gold però è stato misurato **solo** con la Variante B, e lì vale 0,950. Non esiste una misura gold della Variante A, quindi il confronto sul gold non è disponibile.

Chi decide: l'utente. Il gate è superato con B; A resta l'opzione più robusta ma non misurata sul gold. Misurare A sul gold significherebbe una seconda corsa gold, che va dichiarata come tale.

---

## 8. Stato dei gate dopo questa verifica

| Gate / Rilievo | Stato |
|---|---|
| A05 | **PASS** — 0,950 |
| A15 | PASS (verificato in precedenza) |
| A04 | **NON VERIFICATO** — declassato, mai chiuso |
| C5 (corpus boilerplate) | chiuso |
| C6 (chiave API in chiaro) | preso in carico dall'utente |
| C7 (variabile d'ambiente in prodotto) | chiuso |
| C8 (fusione ibrida) | **chiuso nel merito**, con i rilievi 1 e 2 da riscontrare |
