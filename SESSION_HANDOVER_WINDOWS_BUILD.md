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

### FASE 2 & FASE 2-b — MODELLO LOCALE: VELOCITÀ, CACHE DI INTEGRITÀ E RETTIFICHE (Approvata in velocità, correzioni completate)
- **Prova di Cesare con build ottimizzata (`local_model_timing.log`):**
  - Apertura pannello: **1 – 11 ms**
  - Avvio servizio: **4.964 ms**
  - Verifica completa: **2.708 ms**
  - Velocità approvata.
- **Rettifiche FASE 2-b Implementate e Verificate:**
  1. *Via rapida completa (`llama.rs`)*:
     - Controlli espliciti aggiunti in `model_status_for_paths`: `expected_sha256`, `expected_size`, `cache.path`, `mtime` esatto NTFS. Se la dimensione su disco differisce da quella attesa, restituisce direttamente `installed: false, sha256_ok: false`.
     - Aggiunti test dedicati: `test_cache_with_unexpected_hash_triggers_recomputation` e `test_unexpected_size_reports_not_installed`.
  2. *Dichiarazione comportamento cambiato*:
     - In caso di hash errato, il file del modello GGUF da 635 MB **non viene più cancellato** dal disco; viene cancellata solo la cache `.sha256.json`.
     - L'interfaccia mostra il badge rosso chiaro `INTEGRITÀ NON VALIDA` (`SemanticEngineSettings.tsx`).
     - L'utente può rimediare riscaricando automaticamente il file o riselezionando un file valido da disco.
     - Dichiarato formalmente in [fase2-modello-locale.md](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase2-modello-locale.md).
  3. *Distinzione eventi di registro*:
     - Rinominato l'evento in `main.rs` in `FILE_SELECTION_TOTAL_WITH_DIALOG` per distinguerlo dalla copia/hashing effettiva (`FILE_SELECTION`).
  4. *Rettifica proposta limite catalogo (§9 di `fase1-diagnosi.md`)*:
     - Citazione esatta del messaggio del codice in `catalog.rs` (riga 262): `"Catalog file exceeds 32 MB"`.
     - Dimostrazione visiva nel frontend con file e righe: `AiPanel.tsx` (righe 122-156 e 283-307, banner rosso con icona `AlertCircle` e `<details>`) e `App.tsx` (righe 240-256 e 875-889, banner `actionError` globale).
     - Misure reali certificate su `E:\VAULT WIN TEST DEV`: file di 31.605.698 byte (30,14 MB), 376 documenti, 23.482 passaggi; testo effettivo dei passaggi pari a 24.230.597 byte (**76,67%** del file); dimensione catalogo senza testo passaggi pari a 7.375.101 byte (7,03 MB, -76,67%); stima heap RAM Rust ~50–55 MB.
  5. *Isolamento registri nei test unitari*:
     - `get_local_model_timing_log_path()` e `get_ask_timing_log_path()` reindirizzano a `std::env::temp_dir()` in modalità test (`cfg(test)`), con supporto a override da variabile d'ambiente (`LIMEN_TIMING_LOG_DIR`, `LIMEN_LOCAL_MODEL_TIMING_LOG`, `LIMEN_ASK_TIMING_LOG`).
     - Aggiunto test `test_execution_does_not_modify_userprofile_limen_vault` che verifica l'assoluta assenza di modifiche a `C:\Users\user\.limen-vault\`.
- **Log di collaudo completi (127 lib passed, 18 bin passed, 0 falliti):**
  - In parallelo: [cargo-test-fase-2-parallel.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-2-parallel.log)
  - Uno alla volta (`--test-threads=1`): [cargo-test-fase-2-single.log](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-2-single.log)
- **Patch di consegna:** [fase-2-b.patch](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-2-b.patch) (diff da `6c3d560` a `HEAD`).

---

## 2. Prossimo Passo Vincolante (STOP)
- **STOP VINCOLANTE:** Consegna delle correzioni della FASE 2-b e attesa approvazione finale di Cesare prima di procedere alla FASE 3 (qualità della selezione delle fonti).
