# Documento di Session Handover — LIMEN Vault v3 (Windows Build)

**Data / Ora:** 2026-09-23 (UTC+8)  
**Branch Git:** `windows-build`  
**Ultimo Commit Registrato (Congelamento Codice e Costanti):** `226d4fd`  
**Vault di Sviluppo / Test:** `E:\VAULT WIN TEST DEV` (376 documenti, 23.482 passaggi)  
**Repository Path:** `E:\Projects\vault_memai_obsi`  

---

## 1. Stato di Avanzamento per Fasi

### FASE 1 — APPROVATA
- Diagnosi completa del selettore ibrido e quadratura dei log temporali end-to-end (`ask_timing.log`).
- Rapporto: [fase1-diagnosi.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase1-diagnosi.md).
- Patch: [fase-1.patch](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-1.patch).

### FASE 2L & 2L-b — APPROVATA CON MISURA REALE DI CESARE
- **Conferma di Cesare (build ottimizzata, 2026-09-23T05:17:57Z):**
  - Totale: **4.978 ms** (prima della FASE 2L: **36.412 ms**, riduzione dell'86,3%).
  - `doc_read`: 14 ms, `verify_pre`: 12 ms, `verify_post`: 11 ms, `OpenAI`: 3.769 ms.

### FASE 2 & FASE 2-b — APPROVATA DALL'AUDITOR (Commit `9e7a8a1`)
- Velocità e integrità approvate (apertura pannello 1–11 ms, avvio servizio 4.964 ms, verifica completa 2.708 ms).
- Correzioni completate (via rapida completa, non-eliminazione file GGUF su mismatch, isolamento registri nei test unitari).

### RISPOSTE CON MODELLO LOCALE — IN SOSPESO (Decisione Cesare 23/09/2026, UTC+8)
- Generazione risposte con modello locale congelata.
- File di istruzioni conservato in radice: [RISPOSTE_MODELLO_LOCALE_IN_SOSPESO.md](file:///E:/Projects/vault_memai_obsi/RISPOSTE_MODELLO_LOCALE_IN_SOSPESO.md) (commit `e8a3043`). Nessun codice di generazione locale sarà sviluppato finché non riattivato esplicitamente.

### FASE 3 — PASSO 3a COMPLETATO E CONGELATO (Commit `226d4fd`)
- **Punto A (Bonus titolo condizionato)**: Implementato in [search.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs) e [diagnose_fase1.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/diagnose_fase1.rs). Bonus +10 solo se $df \le 2 \lor df/N \le 0.30$. `"progetto"` perde il bonus (+0); `"bnxt"` e `"arkai"` lo mantengono (+10).
- **Punto B (Stopwords estese)**: Aggiunte 54 nuove parole comuni in [search-spec.json](file:///E:/Projects/vault_memai_obsi/packages/search-engine/src/search-spec.json) (143 totali). `"sei"` formalmente escluso (è numerale 6 fondamentale per scadenze e contratti).
- **Punto E (Metodo c in produzione su decisione di Cesare)**:
  - Implementato in [ai.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs): costante `PUNTO_E_SEM_DELTA_THRESHOLD = 0.05`.
  - Regola di ammissibilità: candidato ammesso se contiene almeno una parola rara della query ($df \le 2 \lor df/N \le 0.30$) con tokenizzazione esatta / parole intere (`contains_whole_words`), OPPURE se la similarità semantica dista $\le 0.05$ dal massimo della query.
  - Servizio offline: se `degraded == true` o il servizio semantico è spento, il Metodo c non filtra (selezione lessicale identica a prima).
  - Fallback: se nessun candidato è ammesso (con semantica attiva), viene inviato comunque il primo della classifica.
- **Verifica Criteri Reali su `E:\VAULT WIN TEST DEV`**:
  - *BNXT*: 10 fonti inviate, **4 su 5 requisiti soddisfatti (PASS)** (`_Progetto - BNXT AUDIT VICENZA` S2, `BNXT CRM` S1, `verifica-walkthrough/impl` S4/S5, `audit-localizzazione-EN-baseline` S6). (Senza Punto E ne conteneva solo 3).
  - *ARKAI*: 10 fonti inviate, **10 su 12 documenti ufficiali ARKAI presenti (PASS)**.
- **Misure Gold post-congelamento**:
  - *A05 Gold* (40 query, OpenAI `text-embedding-3-small`, corpus 120 doc verificato): Recall@10 = **0.975** (39/40), baseline lessicale = 0.675, zero-recall = 1 (`Q21`) $\rightarrow$ **PASS**.
  - *A15 Gold* (1000 doc, 11000 passaggi, 100 query su `a15_vault`): p50 = **351.88 ms**, p95 = **532.59 ms** ($\le 1000$ ms), p99 = **573.36 ms**, cold = 253.93 ms $\rightarrow$ **PASS**.
- **Test Suite Completa**: 151 test passati, 0 falliti (parallel e single-threaded).

---

## 2. File di Evidenza Prodotti nel Passo 3a

- **Report Misure Completo**: [fase3a-misure.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-misure.md)
- **Output diagnostico grezzo**: [fase3a-diagnose-output.txt](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-diagnose-output.txt)
- **Patch Cumulativa**: [fase-3a.patch](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-3a.patch) (diff da `ba26889` a `226d4fd`)
- **Evidenze A05 Gold**: [IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A05/](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A05/) (`summary.json`, `per-query.jsonl`, `run.log`, `manifest-verify.log`)
- **Evidenze A15 Gold**: [IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A15/](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/A15/) (`summary.json`, `latencies-warm.csv`, `latencies-cold.csv`, `latencies-during-import.csv`, `run.log`, `manifest-verify.log`)
- **Log Test Suite**:
  - [cargo-test-fase-3a-parallel.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-3a-parallel.log)
  - [cargo-test-fase-3a-single.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-3a-single.log)

---

## 3. Stato Processi di Sistema e Avvio Prossima Sessione
- Processi `limen-vault.exe` e `llama-server` operativi e stabili.
- Codice congelato al commit `226d4fd` in perfetto allineamento con i test e le evidenze.
- **Prossimo Passo**: Avvio della FASE 3 Passo 3b (invio di passaggi multipli per fonte approvati con verifica crittografica `passage.sha256`).
