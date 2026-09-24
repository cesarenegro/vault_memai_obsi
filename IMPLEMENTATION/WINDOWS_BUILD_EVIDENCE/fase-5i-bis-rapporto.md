# FASE 5i-bis — Rapporto Tecnico e Certificazione Collaudo

Data: 2026-09-24  
Ambiente: Windows (LIMEN Vault v4, target desktop src-tauri)  
Base commit FASE 5i: `66d9bf2`  
Ultimo commit di codice: `d8ddd86`  
Patch di consegna: `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-5i-bis.patch` (`git diff 66d9bf2 d8ddd86`)

---

## 1. Risoluzione D1 — Eliminazione Deadlock Mutex nel Ramo Non Proprietario

- **File**: `apps/desktop/src-tauri/src/llama.rs`
- **Funzione**: `start_internal_with_token_and_binary` (righe 1650–1745)
- **Problema originario**:
  Nel ramo non proprietario di `start_internal_with_token_and_binary`, al termine del ciclo di attesa attiva veniva acquisito il guard `let s = self.0.lock()`, poi venivano invocate `check_health(s.port)` e `self.status()` mentre il lock era ancora tenuto (`status()` riacquisiva la stessa mutex con deadlock su Windows). Successivamente veniva dichiarato `let mut s = self.0.lock()` mentre la variabile `s` precedente era ancora viva nello scope, provocando un secondo deadlock di auto-attesa.
- **Risoluzione applicata**:
  1. Durante il polling di attesa, le variabili necessarie (`starting`, `port`, `failed`, `fail_reason`) vengono estratte in un blocco isolato rilasciando immediatamente il lock prima di effettuare qualsiasi controllo di rete (`check_health`).
  2. All'uscita del ciclo di attesa, le verifiche di salute e di fallimento avvengono senza tenere alcun lock.
  3. L'acquisizione della proprietà dell'avvio avviene in un singolo blocco atomico `{ let mut s = self.0.lock()...; if s.starting { return Err(...); } s.starting = true; s.start_owner = Some(tok); tok }`, senza duplicazioni di lock né shadowed variables.
- **Test unitari implementati**:
  - `llama::tests::test_fase5i_bis_d1_stop_during_wait_unblocks_waiter_and_status_responds`: verifica che un chiamante concorrente in attesa attiva si sblocchi tempestivamente quando l'avvio viene interrotto con `stop()`, e che `status()` risponda immediatamente in meno di 50ms senza alcun blocco mutex.
  - `llama::tests::test_fase5i_bis_d1_owner_panic_resets_guard_and_waiter_unblocks`: verifica che il panic inatteso del thread proprietario provochi il rilascio della guardia `StartingGuard`, consentendo al chiamante in attesa di sbloccarsi entro il timeout e ripristinando la reattività del sistema.
  - Rafforzato `test_fase5i_n1_button_pressed_during_background_start_waits_and_succeeds_single_process` con asserzioni esplicite su `non_owner_wait_count() == 1`, `spawn_count() == 1`, stato del processo mock in vita e corretta terminazione post-`stop()`.

---

## 2. Risoluzione D2 — Rilascio Mutex in `get_binary_path` e Funzione Condivisa `log_panel_open_status`

- **File**: `apps/desktop/src-tauri/src/llama.rs` e `apps/desktop/src-tauri/src/main.rs`
- **Funzione `get_binary_path`** (`llama.rs:1302–1317`):
  - **Problema originario**: La funzione acquisiva la mutex di `RunningState` e, tenendola bloccata, chiamava `get_process_exe_path(pid)`, che su Windows invoca l'API Win32 e in fallback PowerShell con timeout fino a 2000 ms, congelando qualsiasi richiesta concorrente a `status()` o `check_health()`.
  - **Risoluzione applicata**: La mutex viene acquisita esclusivamente per estrarre `(cached, pid_opt)` e viene rilasciata immediatamente. La risoluzione dell'eseguibile tramite `get_process_exe_path(pid)` avviene interamente al di fuori della mutex.
- **Funzione pubblica di libreria `log_panel_open_status`** (`llama.rs:154–175`):
  - Creata la funzione pubblica `pub fn log_panel_open_status(llama_state: &LlamaServerState, elapsed_ms: u64, rep: &LocalModelReport)` in `llama.rs`.
  - Richiamata dal comando Tauri `local_model_status` in `main.rs:828–833`.
  - Richiamata dal test unitario `test_fase5i_n3_adopted_service_from_other_folder_logs_real_exe_and_panel_open_status` (`llama.rs:3346–3355`), eliminando ogni duplicazione di logica di tracciamento.
- **Test unitario implementato**:
  - `llama::tests::test_fase5i_bis_d2_get_binary_path_releases_mutex_before_process_resolution`: verifica che 10 chiamate concorrenti a `status()` eseguite durante la risoluzione del percorso da parte di `get_binary_path` completino in meno di 10 ms (tempo totale misurato 0.00s), confermando il completo disaccoppiamento dalla mutex.

---

## 3. Risoluzione D3 — Isolamento Assoluto File Modello e Registri

### A. Diagnosi approfondita delle scritture anomale (Audit Integrazione D3)
1. **Quale codice scrive `C:\Users\user\LIMEN Vault\models\llama-server.log` e perché lo tronca a 0 byte**:
   - **File e riga**: `apps/desktop/src-tauri/src/llama.rs`, righe 1804–1818.
   - **Codice**:
     ```rust
     if let Some(parent) = model_path.parent() {
         let legacy_log_path = parent.join("llama-server.log");
         ...
         let mut file_legacy = fs::File::create(&legacy_log_path).ok();
     ```
   - **Causa del troncamento a 0 byte**:
     La chiamata a `fs::File::create` apre il file con i flag `write=true, create=true, truncate=true`. Aprendo il file su `legacy_log_path`, il contenuto preesistente viene azzerato all'istante. Quando il server mock o il processo in test non scrive immediatamente sullo stderr piped (oppure viene arrestato rapidamente dai test), il file rimane vuoto a 0 byte. Poiché `model_path` puntava alla cartella reale, `legacy_log_path` ha troncato `C:\Users\user\LIMEN Vault\models\llama-server.log`.
2. **Quali test hanno avviato il vero `llama-server.exe` con il modello reale**:
   - **Percorso di avvio**:
     `get_or_adopt_or_start_service_with_timeout` (riga 1565) $\rightarrow$ `self.trigger_background_start()` (riga 1351) $\rightarrow$ `trigger_background_start_with_binary(None)` (riga 1355) $\rightarrow$ `start_internal_with_token_and_binary(Duration::from_secs(25), Some(token), None)` (riga 1413).
   - In `start_internal_with_token_and_binary`:
     - Riga 1700: `local_model_status()` verificava la presenza del modello reale in `C:\Users\user\LIMEN Vault\models\bge-m3-Q8_0.gguf`.
     - Riga 1730: `detect_llama_server_binary()` individuava il vero `llama-server.exe` installato nel sistema.
     - Riga 1760: `cmd.spawn()` avviava il vero eseguibile di sistema con il modello reale da 634 MB. L'inizializzazione del vero server scriveva sul per-run log circa 11 KB di diagnostica iniziale.
   - **Test coinvolti nelle esecuzioni precedenti**:
     - `test_fase5i_n1_adopted_service_dies_next_query_fallbacks_and_restarts` (C06, riga 3265): lo step 3 chiamava `get_or_adopt_or_start_service_with_timeout` con l'adozione attiva, senza mock binary configurato nello stato;
     - `test_fase5f_discovery_external_command_hang_terminates_within_timeout_with_fallback` (riga 2585);
     - `test_fase5g_model_download_concurrency_serializes_and_prevents_overlap` (riga 2676, 2688);
     - `test_fase5g_on_app_startup_starts_service_in_background_without_question` (riga 2741).

### B. Misure correttive strutturali implementate
1. **Protezione di default in `get_models_dir()`** (`llama.rs:201–230`):
   - In modalità `#[cfg(test)]`, se la variabile `LIMEN_MODELS_DIR` non è impostata, `get_models_dir()` restituisce SEMPRE una directory temporanea sicura (`std::env::temp_dir().join("limen_test_models_isolated_default")`), impedendo categoricamente qualsiasi accesso o scrittura in `C:\Users\user\LIMEN Vault\models\`.
   - `pid_file_path()`, `port_file_path()`, `get_target_model_path()` e `get_model_cache_meta_path()` ereditano automaticamente tale isolamento.
2. **Protezione in `trigger_background_start_with_binary`** (`llama.rs:1425–1435`):
   - In `#[cfg(test)]`, se non viene passato un `custom_binary` e `LIMEN_TEST_ALLOW_REAL_START` non è impostata, il thread in background NON invoca il vero binario né carica il modello reale; imposta semplicemente `starting = true` per validare lo stato del frontend/chiamante.
3. **Supporto `test_binary` in `LlamaServerState`** (`llama.rs:52, 1370–1385`):
   - Aggiunto il campo `test_binary: Option<PathBuf>` a `RunningState` e i metodi `set_test_binary` / `get_test_binary`.
   - Se `test_binary` è impostato, `trigger_background_start()` usa automaticamente il mock binary indicato.
4. **Isolamento completo e irrobustimento del test C06** (`llama.rs:3315–3365`):
   - All'inizio del test viene impostato `state.set_test_binary(mock_exe.clone())`.
   - Al punto 3, quando il mock esterno muore, la chiamata a `get_or_adopt_or_start_service_with_timeout` attiva automaticamente l'avvio in background del mock di test (e non del vero modello), ripiegando senza blocco con `status == "in avvio"`.
   - Al punto 4, il test attende il recupero del mock e asserisce esplicitamente il valore di ritorno completo di `get_or_adopt_or_start_service_with_timeout`: `assert!(is_ready_q2)`, `assert_eq!(status_q2, "pronto")`, `assert!(port_q2.is_some())`, `assert!(pid_q2.is_some())`, `assert!(reason_q2.is_none())`.
5. **Rafforzamento N5 con avvio reale del mock** (`llama.rs:2975–3025`):
   - `test_fase5i_n5_20_existing_logs_remains_20_after_startup`: crea 20 file di log simulati in una cartella temporanea isolata via `LIMEN_MODELS_DIR`, compila ed esegue un vero avvio di `mock_exe` tramite `state.start_with_custom_binary`, e verifica che dopo l'avvio il numero totale di log nella cartella rimanga ESATTAMENTE 20 e che il log più vecchio sia stato correttamente rimosso dalla rotazione.

### C. Certificazione di non-interferenza sui file reali (Snapshot Prima vs Dopo)
Prima e dopo l'esecuzione completa di entrambe le suite di test (parallela e seriale), è stato registrato lo stato esatto di `C:\Users\user\LIMEN Vault\models\` e `C:\Users\user\.limen-vault\local_model_timing.log`.
- File prima: `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-bis-cartella-modello-prima.txt`
- File dopo: `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-bis-cartella-modello-dopo.txt`
- **Esito**: I due file sono **100% IDENTICI BYTE PER BYTE**.
- Nessun file creato, modificato, troncato o rimosso durante l'intera suite di collaudo.
- Si segnala formalmente che il file `C:\Users\user\LIMEN Vault\models\llama-server.log` (trovato a 0 byte dalle corse precedenti delle 17:10) NON è stato ricreato né alterato, rispettando il vincolo 4 del messaggio integrativo.

---

## 4. Risoluzione D4 — Ripristino `pid_opt` in Stato "In Avvio"

- **File**: `apps/desktop/src-tauri/src/llama.rs`
- **Funzione**: `get_or_adopt_or_start_service_with_timeout` (righe 1644–1658)
- **Problema originario**:
  Nel commit `1b21ad7` il campo PID restituito al timeout di preparazione della domanda era stato forzato a `None` con l'intento di non riportare il PID dell'applicazione chiamante. Ciò impediva a `log_preview_timing_detailed` di registrare il `service_pid` del processo di servizio quando quest'ultimo era già stato avviato o identificato.
- **Risoluzione applicata**:
  Ripristinata l'estrazione:
  ```rust
  let pid_opt = {
      let guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
      guard.child.as_ref().map(|c| c.id()).or(guard.owned_pid).or(guard.adopted_pid)
  };
  (None, pid_opt, false, "in avvio".to_string(), Some(...))
  ```
  Nel codice e nella documentazione è chiarita la distinzione architetturale: `pid_opt` identifica il *processo di servizio* (processo figlio locale o servizio esterno adottato), mentre `app_pid` identifica il processo dell'applicazione Tauri chiamante.
- **Test unitario implementato**:
  - `llama::tests::test_fase5i_bis_d4_starting_state_reports_service_pid_when_available`: verifica che con un processo di servizio in avvio, lo stato restituisca `status == "in avvio"`, `port == None`, ma `pid == Some(service_pid)`.

---

## 5. Chiarimento Architetturale N7 — Call-tree di `save_catalog`

Nella documentazione precedente era stato erroneamente indicato che `save_catalog` (linea 1038 di `catalog.rs`) intervenisse "esclusivamente all'apertura del vault".
L'ispezione analitica del codice ha individuato l'intero albero di chiamata di `process_pending_extractions`, che invoca `save_catalog` nei seguenti flussi:
1. `open_vault` (`apps/desktop/src-tauri/src/main.rs:103`): sincronizzazione iniziale all'apertura del vault;
2. `AutomationScheduler::tick` (`apps/desktop/src-tauri/src/automation.rs:465`): ciclo periodico schedulato per l'elaborazione dei documenti in coda;
3. `import_selected_batch` (`apps/desktop/src-tauri/src/automation.rs:409`): importazione attiva di nuovi file sorgente;
4. `catalog_process_extractions` (`apps/desktop/src-tauri/src/main.rs:659`): comando esplicito invocato dal frontend;
5. `run_internal` (`apps/desktop/src-tauri/src/automation.rs:791`): elaborazione sincrona interna di sincronizzazione.

La dicitura errata è stata definitivamente rettificata.

---

## 6. Storico Patch del Repository (FASE 1 – FASE 5)

Nel repository `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/` sono conservate tutte le patch delle fasi precedenti:
1. `fase-1.patch`
2. `fase-2.patch` e `fase-2-b.patch`
3. `fase-2L.patch` e `fase-2L-b.patch`
4. `fase-3b1.patch`, `fase-3b2.patch`, `fase-3b2b.patch`, `fase-3b2c.patch`
5. `fase-4.patch` e `fase-4c.patch`
6. `fase-5.patch`, `fase-5b.patch`, `fase-5e.patch`, `fase-5f.patch`, `fase-5g.patch`, `fase-5h.patch`
7. `fase-5i-bis.patch` (consegna attuale)

---

## 7. Registro Esatto dei Test e Verifica dei Punti

Di seguito l'elenco esatto dei test eseguiti, estratto direttamente dall'output di `cargo test`:

| Punto | Nome esatto del test in `cargo test` | Esito |
|---|---|---|
| D1 | `llama::tests::test_fase5i_bis_d1_stop_during_wait_unblocks_waiter_and_status_responds` | ok |
| D1 | `llama::tests::test_fase5i_bis_d1_owner_panic_resets_guard_and_waiter_unblocks` | ok |
| D2 | `llama::tests::test_fase5i_bis_d2_get_binary_path_releases_mutex_before_process_resolution` | ok |
| D3 / C06 | `llama::tests::test_fase5i_n1_adopted_service_dies_next_query_fallbacks_and_restarts` | ok |
| D3 / N5 | `llama::tests::test_fase5i_n5_20_existing_logs_remains_20_after_startup` | ok |
| D4 | `llama::tests::test_fase5i_bis_d4_starting_state_reports_service_pid_when_available` | ok |
| N1 | `llama::tests::test_fase5i_n1_app_startup_auto_starts_single_process` | ok |
| N1 | `llama::tests::test_fase5i_n1_button_pressed_during_background_start_waits_and_succeeds_single_process` | ok |
| N2 | `llama::tests::test_fase5i_n2_status_exposes_starting_state` | ok |
| N3 | `llama::tests::test_fase5i_n3_adopted_service_from_other_folder_logs_real_exe_and_panel_open_status` | ok |
| N4 | `llama::tests::test_fase5i_n4_start_when_already_healthy_does_not_deadlock_and_returns_status` | ok |
| FASE 5f | `llama::tests::test_fase5f_discovery_external_command_hang_terminates_within_timeout_with_fallback` | ok |
| FASE 5g | `llama::tests::test_fase5g_missing_binary_sets_auto_start_failed_until_button_reset` | ok |
| FASE 5g | `llama::tests::test_fase5g_on_app_startup_starts_service_in_background_without_question` | ok |
| FASE 5g | `llama::tests::test_fase5g_startup_in_progress_does_not_kill_and_subsequent_succeeds` | ok |

Totale test suite libreria: **189 passati, 0 falliti, 0 ignorati**.  
Totale test suite binari / integrazione: **18 passati, 0 falliti**.  
Totale complessivo: **207 test passati con successo**.

---

## 8. Verifiche di Bisezione dei Commit Intermedi

Ciascun commit di codice è stato verificato con `cargo check` salvato nel rispettivo file di evidenza:
- `fase5i-bis-check-d1.log`: commit `8de998b` (linea 1), 0 errori
- `fase5i-bis-check-d2.log`: commit `b4ab068` (linea 1), 0 errori
- `fase5i-bis-check-d3.log`: commit `3662f4a` (linea 1), 0 errori
- `fase5i-bis-check-d4.log`: commit `d8ddd86` (linea 1), 0 errori

---

## 9. Registri di Collaudo Completi

I registri integrali delle prove sono disponibili nei file:
- `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-bis-test-parallelo.log`
- `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-bis-test-seriale.log`
