# FASE 2 — MODELLO LOCALE: VELOCITÀ, CACHE DI INTEGRITÀ E RISCONTRO DEI PULSANTI

Data di implementazione: 2026-09-23  
Branch: `windows-build`  
Commit FASE 2: `6c3d560`  
Commit Correzioni FASE 2-b: in arrivo  
Patch: `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-2-b.patch`

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

## 2. Dichiarazione Comportamento Cambiato: Mancata Cancellazione del Modello Non Valido

- **Comportamento precedente:**  
  Nel codice originale (`llama.rs`), qualora il calcolo dello SHA-256 non corrispondesse all'impronta attesa, l'applicazione invocava `fs::remove_file(&target)`, cancellando fisicamente dal disco il file del modello GGUF.
- **Comportamento attuale (FASE 2):**  
  In caso di mancata corrispondenza dell'impronta SHA-256, l'applicazione **non cancella più il file del modello da 635 MB**: cancella esclusivamente il file di metadati della cache (`bge-m3-Q8_0.gguf.sha256.json`) e restituisce `LocalModelReport { installed: false, sha256_ok: false, ... }`.
- **Cosa vede l'utente nell'interfaccia:**  
  Nel pannello *"Motore semantico"* (`SemanticEngineSettings.tsx`):
  - Il badge di stato in alto a destra nella sezione del modello locale mostra chiaramente:  
    `INTEGRITÀ NON VALIDA` (con sfondo rosso chiaro `#fee2e2` e testo rosso scuro `#991b1b`).
  - Viene mantenuta l'indicazione del percorso del file presente su disco e della dimensione in byte, ma il servizio locale non viene avviato.
- **Come rimedia l'utente:**  
  L'utente ha a disposizione due percorsi immediati per rimediare:
  1. **Scaricamento automatico:** Cliccare sul pulsante *"SCARICA MODELLO (635 MB)"* per riscaricare la versione ufficiale integra dal repository HuggingFace/GPUStack.
  2. **Riselezione da disco:** Cliccare sul pulsante *"SOSTITUISCI FILE GGUF DA DISCO…"* (oppure *"SELEZIONA FILE GGUF DA DISCO…"*) per selezionare una copia valida e integra del file `bge-m3-Q8_0.gguf`. L'app provvederà a ricalcolare l'impronta e, se conforme, a registrare la nuova cache.

---

## 3. Dettaglio delle Modifiche Implementate

### 3.1 e 3.2 SHA-256, Cache di Integrità e Rettifica Via Rapida (`apps/desktop/src-tauri/src/llama.rs`)
- **Struttura cache:** Creata `ModelVerificationCache` salvata nel file adiacente al modello:  
  `models/bge-m3-Q8_0.gguf.sha256.json`.
- **Rettifica Via Rapida (`model_status_for_paths`):**
  La via rapida a tempo zero verifica scrupolosamente tutti i parametri di congruenza:
  1. `bytes == expected_size` e `cache.bytes == expected_size` (se la dimensione su disco è diversa da quella attesa, restituisce direttamente `installed: false, sha256_ok: false` senza procedere oltre).
  2. `cache.path == target` (verifica percorso del modello).
  3. `cache.sha256.eq_ignore_ascii_case(expected_sha256)` (verifica corrispondenza con l'impronta attesa dalla build corrente; se una versione futura richiede un modello diverso, il vecchio non viene accettato).
  4. `mtime` esatto su NTFS (tolleranza 0 ms con `is_high_precision_fs`).
  5. `cache.sha256_ok == true`.
  Se uno di questi controlli non coincide, si procede alla verifica lenta su disco (`compute_file_sha256`).
- **I/O a singola passata in installazione (`install_model_from_file`):**
  Streaming da 1 MiB con copia verso destinazione e calcolo hash simultanei: zero riletture da disco.
- **Avvio del servizio locale (`LlamaServerState::start`):**
  Sfrutta `local_model_status()` e la cache registrata, avviando `llama-server.exe` senza rileggere i 635 MB.

### 3.3 Riscontro dei Pulsanti e Reattività UI (`SemanticEngineSettings.tsx` & `ai-ipc.ts`)
- **Selezione fornitore a 0 ms (`optimisticProvider`):**
  Al clic su "Locale (bge-m3)" o "OpenAI (in rete)", l'interfaccia aggiorna immediatamente radio, bordo e badge colorato prima del completamento asincrono IPC.
- **Pulsante "SELEZIONA FILE GGUF DA DISCO…":**
  Mostra subito `SELEZIONE E VERIFICA IN CORSO…` con colore di avviso ambra e disabilitazione per prevenire doppi clic.
- **Nuovo pulsante "VERIFICA INTEGRITÀ":**
  Disponibile quando il modello è installato; durante la verifica forzata mostra `VERIFICA IN CORSO…` ed è disabilitato contro doppi clic.
- **Pulsante "AVVIA SERVIZIO LOCALE":**
  Mostra subito `AVVIO IN CORSO…` con sfondo ambra `#fef3c7`, bordo `#f59e0b` e protezione dal doppio clic.
- **Pulsanti "ARRESTA SERVIZIO LOCALE" e "AGGIORNA STATO":**
  Feedback immediato (`ARRESTO IN CORSO…`, `AGGIORNAMENTO…`).

---

## 4. Registro dei Tempi Dedicato e Misure Reali di Cesare

- **Percorso assoluto del registro:**  
  `C:\Users\user\.limen-vault\local_model_timing.log`
- **Distinzione eventi:**
  1. `PANEL_OPEN_STATUS`: tempo di apertura del pannello e verifica dello stato del modello (`local_model_status`).
  2. `FILE_SELECTION`: tempo di I/O effettivo per copia e calcolo dell'impronta SHA-256 a singola passata.
  3. `FILE_SELECTION_TOTAL_WITH_DIALOG`: tempo complessivo comprensivo della selezione dell'utente nella finestra di dialogo di sistema.
  4. `SERVICE_START`: tempo impiegato da `start()` per verificare lo stato e avviare il processo `llama-server.exe`.
  5. `MANUAL_VERIFY`: tempo della verifica esplicita richiesta dall'utente tramite pulsante.

### Misure Reali di Cesare con Build Ottimizzata
- **Apertura pannello:** `1 – 11 ms`
- **Avvio servizio locale:** `4.964 ms`
- **Verifica completa (635 MB):** `2.708 ms`
Velocità pienamente approvata.

### Isolamento dei Test Unitari
- Nei test unitari (`cfg(test)`), `get_local_model_timing_log_path()` e `get_ask_timing_log_path()` indirizzano automaticamente la scrittura su `std::env::temp_dir()`, supportando inoltre gli override `LIMEN_LOCAL_MODEL_TIMING_LOG`, `LIMEN_ASK_TIMING_LOG` e `LIMEN_TIMING_LOG_DIR`.
- Il test unitario `test_execution_does_not_modify_userprofile_limen_vault` garantisce formalmente che nessuna esecuzione di test sporchi o modifichi `C:\Users\user\.limen-vault\`.

---

## 5. Test Unitari Dedicati (`apps/desktop/src-tauri/src/llama.rs`)
1. `test_second_status_call_uses_cache_zero_hash_recalculation`: riscontro assenza ricalcolo su seconda apertura (cache hit).
2. `test_model_modified_mtime_triggers_recomputation`: ri-verifica completa automatica se il timestamp del file cambia.
3. `test_model_replaced_same_size_detected`: rilevamento della sostituzione file a parità di dimensione.
4. `test_cache_with_unexpected_hash_triggers_recomputation`: verifica che se la cache memorizza un hash diverso dall'atteso, la via rapida non la accetta e riesegue la verifica completa aggiornando la cache.
5. `test_unexpected_size_reports_not_installed`: verifica che una dimensione diversa da quella attesa restituisca `installed: false, sha256_ok: false`.
6. `test_install_from_file_single_io_pass`: copia e calcolo simultanei in singola passata.
7. `test_execution_does_not_modify_userprofile_limen_vault`: verifica isolamento da `~/.limen-vault`.
