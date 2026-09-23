# FASE 2 — MODELLO LOCALE: VELOCITÀ, CACHE DI INTEGRITÀ E RISCONTRO DEI PULSANTI

Data di implementazione: 2026-09-23  
Branch: `windows-build`  
Commit FASE 2: in arrivo  
Patch: `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-2.patch`

---

## 1. Dichiarazione su `fase2-preliminary-stash.patch`
È stata esaminata la patch preliminare `fase2-preliminary-stash.patch`.
- **Esito dell'analisi:** La patch conteneva l'intuizione corretta dell'uso di una cache per i metadati del modello (`ModelVerificationCache`), ma presentava lacune critiche rispetto ai requisiti di collaudo:
  1. Manteneva una duplice lettura su disco in fase di installazione (`install_model_from_file`), violando il requisito di I/O a singola passata.
  2. Non implementava il controllo esatto su NTFS (tolleranza 0 ms con `is_high_precision_fs`), bensì un confronto generico non conforme a quanto standardizzato nella FASE 2L.
  3. Non esponeva il comando IPC dedicato di verifica integrità su richiesta (`local_model_verify_integrity`).
  4. Non includeva il riscontro visivo immediato a 0 ms per la selezione "Locale" / "OpenAI" e per gli stati dei pulsanti nel frontend React (`SemanticEngineSettings.tsx`).
  5. I test unitari dipendevano dallo stato globale del filesystem invece di essere parametrizzati e isolati in cartelle temporanee `tempfile::tempdir()`.
- **Dichiarazione formale:** I principi utili sono stati integrati e completati riscrivendo l'implementazione in conformità rigorosa ai requisiti 2.1–2.5.

---

## 2. Dettaglio delle Modifiche Implementate

### 2.1 e 2.2 SHA-256 e Cache di Integrità (`apps/desktop/src-tauri/src/llama.rs`)
- **Struttura cache:** Creata `ModelVerificationCache` salvata nel file adiacente al modello:
  `models/bge-m3-Q8_0.gguf.sha256.json`.
  Campi memorizzati:
  - `path`: percorso assoluto del file `.gguf`.
  - `bytes`: dimensione in byte (attesa `634.553.760`).
  - `mtime_ms`: timestamp di ultima modifica in millisecondi UTC.
  - `sha256`: stringa esadecimale dell'hash SHA-256 calcolato.
  - `sha256_ok`: booleano di riscontro rispetto all'impronta attesa.
  - `verified_at`: timestamp RFC3339 della verifica.
- **Rilevamento NTFS e confronto esatto:**
  Utilizza `crate::ai::is_high_precision_fs(&path)`.
  - Su file system ad alta risoluzione (NTFS, ReFS): `cache.mtime_ms == current_mtime_ms` (tolleranza zero millisecondi).
  - Su altri file system (FAT32, exFAT): tolleranza 2.000 ms.
- **Evitata ricalcolazione SHA-256 a ogni stato:**
  In `local_model_status()` e `model_status_for_paths(...)`: se il file esiste, la dimensione e la data di modifica corrispondono alla cache, l'esito della cache viene restituito istantaneamente senza rileggere i 635 MB dal disco.
- **I/O a singola passata in installazione (`install_model_from_file`):**
  Il file viene letto in streaming a blocchi di 1 MiB. Durante la lettura, lo stream scrive simultaneamente sul file di destinazione (`.installing`) e calcola l'hash `Sha256::digest`. Al termine, se l'hash e la dimensione coincidono, il file viene rinominato atomicamente e viene scritta la cache `.sha256.json`. Nessuna doppia lettura.
- **Avvio del servizio locale (`LlamaServerState::start`):**
  Chiama `local_model_status()`, che consulta la cache registrata. Se valida, avvia direttamente il processo `llama-server.exe` senza rieseguire la verifica da 635 MB.

### 2.3 Riscontro dei Pulsanti e Reattività UI (`SemanticEngineSettings.tsx` & `ai-ipc.ts`)
- **Selezione fornitore a 0 ms (`optimisticProvider`):**
  Al clic su "Locale (bge-m3)" o "OpenAI (in rete)", l'interfaccia aggiorna immediatamente lo stato radio, lo stile del bordo e il badge colorato a tempo zero, avviando contestualmente la persistenza asincrona nel backend. In caso di errore, lo stato viene ripristinato.
- **Pulsante "SELEZIONA FILE GGUF DA DISCO…":**
  All'attivazione imposta subito lo stato `pickingModelFile = true`, disabilita il pulsante (impedendo doppi clic) e cambia il testo in `SELEZIONE E VERIFICA IN CORSO…` con colore di avviso ambra.
- **Nuovo pulsante "VERIFICA INTEGRITÀ":**
  Disponibile quando il modello è installato. Esegue una verifica forzata con ricalcolo completo e aggiornamento della cache. Durante l'elaborazione mostra `VERIFICA IN CORSO…` ed è disabilitato contro i doppi clic.
- **Pulsante "AVVIA SERVIZIO LOCALE":**
  All'avvio passa immediatamente allo stato visivo `AVVIO IN CORSO…` con sfondo ambra (`#fef3c7`), bordo `#f59e0b` e disabilitazione contro i doppi clic.
- **Pulsanti "ARRESTA SERVIZIO LOCALE" e "AGGIORNA STATO":**
  Forniscono riscontro immediato (`ARRESTO IN CORSO…`, `AGGIORNAMENTO…`) con blocco delle interazioni concorrenti.

### 2.4 Test Unitari Implementati (`apps/desktop/src-tauri/src/llama.rs`)
1. `test_second_status_call_uses_cache_zero_hash_recalculation`:
   Verifica che una seconda chiamata di stato con file intatto non riscriva il file `.sha256.json` e riutilizzi istantaneamente la cache.
2. `test_model_modified_mtime_triggers_recomputation`:
   Verifica che una modifica del file (anche con alterazione del timestamp) invalidi la cache e richieda la riverifica.
3. `test_model_replaced_same_size_detected`:
   Verifica che la sostituzione del file con un altro file di identica dimensione ma contenuto/hash differente venga prontamente rilevata, invalidando l'integrità.
4. `test_install_from_file_single_io_pass`:
   Verifica la procedura di installazione da sorgente a destinazione con calcolo e scrittura simultanei in singola passata.

---

## 3. Registro dei Tempi Dedicato (Percorso Assoluto)

Come richiesto dal punto 2.5:
- **Percorso assoluto del registro:**  
  `C:\Users\user\.limen-vault\local_model_timing.log`
- **Eventi tracciati:**
  1. `PANEL_OPEN_STATUS`: tempo di apertura del pannello e verifica dello stato del modello (`local_model_status`).
  2. `FILE_SELECTION`: tempo impiegato per la selezione del file GGUF, copia a singola passata, calcolo SHA-256 e scrittura della cache.
  3. `SERVICE_START`: tempo impiegato da `start()` per verificare lo stato e avviare il processo `llama-server.exe` sulla porta libera.
  4. `MANUAL_VERIFY`: tempo impiegato dalla verifica esplicita richiesta dall'utente tramite pulsante.
- **Nota vincolante:** Nel presente rapporto **non viene inserita alcuna stima o tempo previsto**: faranno fede esclusivamente i millisecondi registrati nella prova di Cesare con la build ottimizzata.

---

## 4. Evidenze di Collaudo dei Test

I test sono stati eseguiti con successo in entrambe le configurazioni:
- **Test parallelo:**  
  `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-2-parallel.log`  
  Risultato: `124 passed; 0 failed` (lib), `18 passed; 0 failed` (bin).
- **Test singolo thread (`--test-threads=1`):**  
  `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-2-single.log`  
  Risultato: `124 passed; 0 failed` (lib), `18 passed; 0 failed` (bin).
