# Documento di Session Handover — LIMEN Vault v3 (Windows Build)

**Data / Ora:** 2026-09-23 (UTC+8)  
**Branch Git:** `windows-build`  
**Ultimo Commit Registrato:** `c745536` (`feat(fase-3b1): implement model system instructions, restrictive citation, sources audit log in ask_timing and last vault path UI persistence`)  
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

### FASE 3 — PASSO 3a COMPLETATO E CONGELATO (Commit `226d4fd` e `5b75fbb`)
- **Punto A (Bonus titolo condizionato)**: Implementato in [search.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs) e [diagnose_fase1.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/bin/diagnose_fase1.rs). Bonus +10 solo se $df \le 2 \lor df/N \le 0.30$. `"progetto"` perde il bonus (+0); `"bnxt"` e `"arkai"` lo mantengono (+10).
- **Punto B (Stopwords estese)**: Aggiunte 54 nuove parole comuni in [search-spec.json](file:///E:/Projects/vault_memai_obsi/packages/search-engine/src/search-spec.json) (143 totali). `"sei"` formalmente escluso.
- **Punto E (Metodo c in produzione su decisione di Cesare)**:
  - Implementato in [ai.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs): costante `PUNTO_E_SEM_DELTA_THRESHOLD = 0.05`.
  - Regola di ammissibilità: candidato ammesso se contiene almeno una parola rara della query ($df \le 2 \lor df/N \le 0.30$) con tokenizzazione esatta / parole intere (`contains_whole_words`), OPPURE se la similarità semantica dista $\le 0.05$ dal massimo della query.
  - Servizio offline: se `degraded == true` o il servizio semantico è spento, il Metodo c non filtra (selezione lessicale identica a prima).
  - Fallback: se nessun candidato è ammesso (con semantica attiva), viene inviato comunque il primo della classifica.
- **Verifica Criteri Reali su `E:\VAULT WIN TEST DEV`**:
  - *BNXT*: 10 fonti inviate, **4 su 5 requisiti soddisfatti (PASS)** (`_Progetto - BNXT AUDIT VICENZA` S2, `BNXT CRM` S1, `verifica-walkthrough/impl` S4/S5, `audit-localizzazione-EN-baseline` S6).
  - *ARKAI*: 10 fonti inviate, **10 su 12 documenti ufficiali ARKAI presenti (PASS)**.
- **Misure Gold post-congelamento**:
  - *A05 Gold*: Recall@10 = **0.975** (39/40) $\rightarrow$ **PASS**.
  - *A15 Gold*: p50 = **351.88 ms**, p95 = **532.59 ms** ($\le 1000$ ms) $\rightarrow$ **PASS**.
- **Rilievi Formali Registrati**: registrati in Sezione 7 di `fase3a-misure.md` i tre rilievi (184 chiamate OpenAI in A05; 30 dev queries non discriminanti; normalizzazione CRLF in `catalog.rs` con 22 file coinvolti e test unitario di parità crittografica).

---

### FASE 3 — PASSO 3b-1 COMPLETATO (Commit `c745536`)
Conformemente alle quattro precisazioni di Cesare del 23/09/2026:
1. **Regola di Citazione Restrittiva**: il prompt prescrive di citare SOLO ed ESCLUSIVAMENTE le fonti da cui la risposta trae effettivamente un'informazione rilevante, e VIETA esplicitamente di citare fonti non usate.
2. **Modello Invariato**: mantenuto invariato `gpt-4o` (`gpt-4o-2024-08-06`).
3. **Registro Fonti Inviate e Citate in `ask_timing.log`**:
   - Per ciascuna domanda inviata ad OpenAI, il log registra l'albero completo delle fonti (`S1…S10`, percorso relativo, byte, localizzatore/passaggi) e lo stato di citazione (`-> CITATA` / `-> NON CITATA`).
   - Nel JSON di riga è presente il campo strutturato `"sources": [...]`.
   - **Privacy assoluta garantita**: NESSUN TESTO di domande, risposte o passaggi viene scritto nel file di log.
4. **Rilievi Passo 3a Registrati**: Sezione 7 di `fase3a-misure.md` aggiornata; test di parità crittografica CRLF/LF integrato in `catalog.rs`.
5. **Persistenza UI Vault Aperto (Richiesta aggiuntiva UI)**:
   - All'avvio di Limen Vault, il campo "Percorso del Vault (cartella locale)" viene automaticamente precaricato con il percorso del vault aperto nella sessione precedente (`localStorage.getItem('limen_last_vault_path')`).
   - Il percorso viene sincronizzato al cambio cartella, sfoglia, apertura o creazione vault.
   - Bundle frontend verificato con `npm run build` (`tsc && vite build`: successo, 0 errori).

- **Test Suite Completa Passo 3b-1**:
  - Parallel: **154 passed; 0 failed** (136 lib + 18 main). Log: [cargo-test-fase-3b1-parallel.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-3b1-parallel.log).
  - Single-threaded: **154 passed; 0 failed** (136 lib + 18 main). Log: [cargo-test-fase-3b1-single.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-3b1-single.log).
- **Patch Consegnata**: [fase-3b1.patch](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-3b1.patch) (diff da `5b75fbb` a `c745536`).

---

## 2. Stato Attuale e Prossimo Passo (STOP per Prova di Cesare)

- **STATO ATTUALE**: **STOP OPERATIVO BLOCCANTE**.
- Nessuna chiamata OpenAI effettuata dall'assistente.
- **PROSSIMO PASSO**: Prova live nell'app desktop condotta da **Cesare** sulle tre domande di validazione:
  1. *"Cosa è il progetto BNXT?"*
  2. *"ARKAI è un'azienda o un marchio? Di cosa si occupa?"*
  3. *"Cos'è il progetto SCENA e quali app comprende?"*
- **Verifica nel Registro**: `C:\Users\user\.limen-vault\ask_timing.log` mostrerà per ciascuna interrogazione le fonti `S1…S10` inviate e quali sono state effettivamente citate dal modello.
