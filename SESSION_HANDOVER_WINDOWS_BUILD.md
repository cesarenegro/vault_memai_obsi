# Documento di Session Handover — LIMEN Vault v3 (Windows Build)

**Data / Ora:** 2026-09-23  
**Branch Git:** `windows-build`  
**Ultimo Commit Registrato:** FASE 2-b (in arrivo)  
**Vault di Sviluppo / Test:** `E:\VAULT WIN TEST DEV`  
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
- File di istruzioni conservato in radice: [RISPOSTE_MODELLO_LOCALE_IN_SOSPESO.md](file:///E:/Projects/vault_memai_obsi/RISPOSTE_MODELLO_LOCALE_IN_SOSPESO.md) (commit `e8a3043`). Nessun codice di generazione locale sarà sviluppato finché non riattivato.

### FASE 3 — QUALITÀ DELLA SELEZIONE DELLE FONTI (Proposta Tecnica Corretta — Nessun Codice)
- **Documento di proposta tecnica corretta**: [fase3-proposta.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase3-proposta.md).
- **Sequenza operativa in due passi con misura intermedia**:
  - **Passo 3a (Quali documenti scegliere)**:
    1. *Punto A*: Bonus titolo condizionato (IDF / frequenza documentale) in `search.rs` per evitare l'ascesa di file per la parola generica "progetto".
    2. *Punto B*: Elenco attuale (89 voci) e 55 nuove stopwords uniche per esteso (totale 144 voci) in `packages/search-engine/src/search-spec.json`, escludendo forme ambigue ("stato/a/i/e"); condiviso con TypeScript e macOS; ricostruzione obbligatoria dell'indice lessicale e rimisurazione di tutti i benchmark.
    3. *Punto E*: Soglia minima di pertinenza su valori assoluti non normalizzati ($\text{SemSim} \ge 0.380$ e BM25 grezzo) per bloccare il rumore (documenti BNXT hanno SemSim 0.385–0.533; rumore estraneo $\le 0.36$).
  - **Passo 3b (Quanto testo inviare di ciascuno)**:
    4. *Punto C*: 1–3 passaggi più pertinenti per documento con locatori combinati (`[§1.2, §2.4]`) e verifica integrità file padre.
    5. *Punto D*: Gestione budget 24.000 byte con tetto dinamico (3.500 B primi documenti, 2.000 B supporto), mantenendo il limite tassativo a massimo 10 fonti (S1…S10) e monitorando tempi totali di risposta e token OpenAI.
- **Criteri di accettazione vincolanti**:
  - BNXT: almeno 4 dei 5 documenti per esteso tra le fonti inviate (`20_RAW_SOURCES/a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md`, `32f2a4081d13410e-BNXT CRM.md`, `abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md`, `112bf7d370012490-audit-localizzazione-EN-verifica-AG-2026-09-10.md`, e almeno uno tra i due file email/whatsapp); zero documenti estranei per "progetto".
  - ARKAI: almeno 6 dei 12 documenti reali elencati.
  - Benchmark gold: taratura obbligatoria su `tests/gold/A05_DEV_QUERIES.json`; nessuna regressione su A05 (Recall@10 $\ge 0.950$) e A15 (p95 $\le 200$ ms); A04 verbalizzato come non verificato; rimisurazione completa.
  - Criterio temporale: rispetto tempi totali registrati (`ask_timing.log`).
- **Implementation Plan aggiornato**: [implementation_plan.md](file:///C:/Users/user/.gemini/antigravity-ide/brain/2bd5a479-b27a-49a6-83e0-db69feccb5fa/implementation_plan.md).

---

## 2. Prossimo Passo Vincolante (STOP)
- **STOP VINCOLANTE**: Nessuna modifica al codice sorgente per la FASE 3. In attesa dell'approvazione dell'auditor e del via libera di Cesare per avviare il Passo 3a.

