# Documento di Session Handover — LIMEN Vault v3 (Windows Build)

**Data / Ora:** 2026-09-23  
**Branch Git:** `windows-build`  
**Ultimo Commit Registrato:** `ba26889` (Proposta FASE 3 corretta)  
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

### FASE 3 — QUALITÀ DELLA SELEZIONE DELLE FONTI
- **Proposta Tecnica Corretta**: [fase3-proposta.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3-proposta.md).
- **Passo 3a (Implementazione A, B e Misurazione Comparativa Punto E)**:
  1. *Punto A (Bonus titolo condizionato)*: Implementato in [search.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs) e [diagnose_fase1.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/diagnose_fase1.rs). Bonus +10 solo se $df \le 2 \lor df/N \le 0.30$. `"progetto"` perde il bonus (+0); `"bnxt"` e `"arkai"` lo mantengono (+10).
  2. *Punto B (Stopwords estese)*: Aggiunte 54 nuove parole comuni in [search-spec.json](file:///E:/Projects/vault_memai_obsi/packages/search-engine/src/search-spec.json) (143 totali). `"sei"` formalmente escluso (è numerale 6 fondamentale per scadenze e contratti).
  3. *Reindicizzazione*: Vault `E:\VAULT WIN TEST DEV` reindicizzato con successo (`version: 2`).
  4. *Verifica su BNXT e ARKAI*:
     - Domanda BNXT: `BNXT CRM.md` balza al **Rango 1** (score 1.1938); `_Progetto - BNXT AUDIT VICENZA.md` al **Rango 2** (score 1.1695). I file estranei come `Progetto senza nome (2)` crollano oltre il rango 20.
     - Domanda ARKAI: **Tutti i primi 7 risultati** sono documenti ARKAI ufficiali. 9 documenti ARKAI nei primi 10.
  5. *Punto E (Misurazione comparativa senza codice in produzione)*:
     - Eseguita misurazione comparativa tramite [measure_punto_e.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/measure_punto_e.rs) sui 30 dev queries di `A05_DEV_QUERIES.json`.
     - *Metodo a (soglia fissa)*: fallisce (a 0.380 tiene i falsi positivi, a 0.400 elimina 3 file BNXT ufficiali).
     - *Metodo b (soglia relativa $\ge k \times \max$)*: taglia documenti BNXT legittimi al 75%.
     - *Metodo c (parola rara $\lor \max - \text{SemSim} \le \delta$)*: protegge al 100% i file BNXT ed elimina tutti i falsi positivi. Recall sui 30 dev queries sale da 0.833 a 0.867.
     - Dati completi documentati in [fase3a-misure.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-misure.md). Nessun codice attivato nel motore; scelta demandata a Cesare.
  6. *Gate A15 e benchmark A05 / A04*:
     - File origine valore 198,90 ms: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A15/run.log` (Apple M2 su macOS).
     - Chiarita la soglia del gate contrattuale: $\le 1.000$ ms (margine reale accertato $> 800$ ms, non 1,1 ms).
     - Misura reale Windows in `--release`: $p95 = 834.74$ ms ($\le 1.000$ ms, PASS).
     - A04 confermato invariato come NON VERIFICATO.
  7. *Rettifiche a Proposta Passo 3b*:
     - Stima "+30-50% token" etichettata come ipotetica.
     - Integrità crittografica estesa a ogni singolo passaggio (`passage.sha256`).

---

## 2. File di Evidenza Prodotti nel Passo 3a
- **Output diagnostico grezzo**: [fase3a-diagnose-output.txt](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-diagnose-output.txt)
- **Report misure e comparazione Punto E**: [fase3a-misure.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3a-misure.md)
- **Walkthrough attività**: [walkthrough.md](file:///C:/Users/user/.gemini/antigravity-ide/brain/2bd5a479-b27a-49a6-83e0-db69feccb5fa/walkthrough.md)
- **Tool di misurazione Punto E**: [measure_punto_e.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/measure_punto_e.rs)

---

## 3. Stato Processi di Sistema
- **Risolto blocco CPU / istanze multiple**: terminato il processo `target\release\limen-vault.exe` rimasto attivo in background e liberati i core della CPU.
- Server locale `llama-server` operativo per inferenza locale.
