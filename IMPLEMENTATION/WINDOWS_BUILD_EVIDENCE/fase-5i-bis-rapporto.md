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
  - `llama::tests::test_fase5i_bis_d1_stop_during_wait_unblocks_waiter_and_status_responds`: verifica che un chiamante concorrente in attesa attiva si sblocchi tempestivamente quando l'avvio viene interrotto con `stop()`, e che `status()` risponda entro il tempo massimo ammesso dal test (`rx_status.recv_timeout(Duration::from_secs(1))`) senza deadlock con `assert!(status_res.is_ok())`.
  - `llama::tests::test_fase5i_bis_d1_owner_panic_resets_guard_and_waiter_unblocks`: verifica che il panico imprevisto del thread proprietario provochi il rilascio automatico via `StartingGuard`, consentendo a un thread in attesa concorrente di sbloccarsi entro il timeout massimo ammesso dal test (`rx_wait.recv_timeout(Duration::from_secs(2))`) con `assert!(wait_res.is_ok())`.

---

## 2. Risoluzione D2 — Esecuzione `get_binary_path` Fuori Mutex e Condivisione `log_panel_open_status`

- **File**: `apps/desktop/src-tauri/src/llama.rs`
- **Funzioni**:
  - `LlamaServerState::get_binary_path` (righe 1410–1425): estrae i metadati essenziali (`owned_pid`, `adopted_pid`, `binary_path`) rilasciando immediatamente il guard mutex; esegue la risoluzione del percorso del processo reale (`get_process_exe_path(pid)`) e il fallback `detect_llama_server_binary()` interamente fuori da qualsiasi lock.
  - `log_panel_open_status` (righe 255–270): funzione condivisa sia dal comando Tauri `local_model_status` (in `main.rs`) sia dalle procedure interne di stato, eliminando codice duplicato e garantendo tracciamento omogeneo.
- **Test unitario implementato**:
  - `llama::tests::test_fase5i_bis_d2_get_binary_path_releases_mutex_before_process_resolution`: esegue 10 chiamate concorrenti a `get_binary_path` mentre il lock viene conteso, e asserisce che il tempo totale di esecuzione rimanga ampiamente inferiore al limite previsto dal test (`assert!(elapsed < Duration::from_millis(500))`).

---

## 3. Risoluzione D3 — Isolamento Cartella Modelli e Log di Collaudo

### A. Architettura di Isolamento
1. **Supporto Variabile d'Ambiente `LIMEN_MODELS_DIR`** (`llama.rs:202–209`):
   - `get_models_dir()` controlla la presenza della variabile d'ambiente `LIMEN_MODELS_DIR`. Se valorizzata e non vuota, restituisce quel percorso assicurandone la creazione.
2. **Isolamento Automatico di Default in Modalità Test** (`llama.rs:210–215`):
   - Nei test unitari, in assenza di `LIMEN_MODELS_DIR`, `get_models_dir()` ripiega su `temp_dir().join("limen_test_models_isolated_default")`.
3. **Supporto `test_binary` in `LlamaServerState`** (`llama.rs:52, 1370–1385`):
   - Aggiunto il campo `test_binary: Option<PathBuf>` a `RunningState` e i metodi `set_test_binary` / `get_test_binary`.
   - Se `test_binary` è impostato, `trigger_background_start()` usa automaticamente il mock binary indicato.
4. **Isolamento completo e irrobustimento del test C06** (`llama.rs:3315–3365`):
   - All'inizio del test viene impostato `state.set_test_binary(mock_exe.clone())`.
   - Al punto 3, quando il mock esterno muore, la chiamata a `get_or_adopt_or_start_service_with_timeout` attiva automaticamente l'avvio in background del mock di test (e non del vero modello), ripiegando senza blocco con `status == "in avvio"`.
   - Al punto 4, il test attende il recupero del mock e asserisce esplicitamente il valore di ritorno completo di `get_or_adopt_or_start_service_with_timeout`: `assert!(is_ready_q2)`, `assert_eq!(status_q2, "pronto")`, `assert!(port_q2.is_some())`, `assert!(pid_q2.is_some())`, `assert!(reason_q2.is_none())`.
5. **Rafforzamento N5 con avvio reale del mock** (`llama.rs:2975–3025`):
   - `test_fase5i_n5_20_existing_logs_remains_20_after_startup`: crea 20 file di log simulati in una cartella temporanea isolata via `LIMEN_MODELS_DIR`, compila ed esegue un vero avvio di `mock_exe` tramite `state.start_with_custom_binary`, e verifica che dopo l'avvio il numero totale di log nella cartella rimanga ESATTAMENTE 20 e che il log più vecchio sia stato correttamente rimosso dalla rotazione.

### B. Rettifica e Dichiarazione su D3 e Scritture nella Cartella Reale dei Modelli
La precedente affermazione secondo cui `C:\Users\user\LIMEN Vault\models\llama-server.log` "NON è stato ricreato né alterato" è **FALSA**.  
Dal confronto analitico tra l'elenco delle ore 17:10:26 UTC+8 e lo snapshot `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-bis-cartella-modello-prima.txt` risulta che:
1. `llama-server.log`: la data di modifica è cambiata da 17:10:25 a 17:46:59 UTC+8 (il file è stato riaperto e troncato a 0 byte);
2. 5 nuovi log per avvio sono stati scritti in `C:\Users\user\LIMEN Vault\models\logs\` tra le 17:45:54 e le 17:47:41 UTC+8:
   - `llama-server_20260924T094554Z_2772.log`
   - `llama-server_20260924T094558Z_28060.log`
   - `llama-server_20260924T094659Z_8152.log`
   - `llama-server_20260924T094700Z_13196.log`
   - `llama-server_20260924T094741Z_1064.log`
3. 5 log preesistenti sono stati cancellati dalla rotazione a 20 file:
   - `llama-server_20260924T090528Z_41264.log`
   - `llama-server_20260924T090529Z_5460.log`
   - `llama-server_20260924T090857Z_40212.log`
   - `llama-server_20260924T090859Z_12268.log`
   - `llama-server_20260924T090902Z_12940.log`

Queste scritture sono state generate dalle corse parziali di `cargo test` eseguite durante lo sviluppo iniziale della FASE 5i-bis prima del completamento dell'isolamento D3 (`3662f4a`), anteriormente all'acquisizione dell'elenco "prima".  
L'identità byte per byte tra `fase5i-bis-cartella-modello-prima.txt` e `fase5i-bis-cartella-modello-dopo.txt` dimostra **esclusivamente che la corsa finale di collaudo non ha scritto**, mentre le corse intermedie di sviluppo avevano ancora alterato la cartella condivisa dei modelli.

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

## 6. Modifiche al Comportamento dell'Applicazione in Esecuzione (Runtime App Changes)

Le seguenti modifiche introdotte impattano direttamente il comportamento a runtime dell'applicazione rilasciata (non riguardano esclusivamente l'isolamento dei test):

1. **`get_models_dir` legge `LIMEN_MODELS_DIR` anche nel programma rilasciato**
   - **File e Righe**: `apps/desktop/src-tauri/src/llama.rs`, righe 202–209
   - **Comportamento**: La variabile d'ambiente `LIMEN_MODELS_DIR` viene interrogata prioritariamente sia nei test che nell'applicazione compilata in modalità release. Se valorizzata, la cartella dei modelli viene reindirizzata al percorso indicato.
2. **`start_internal_with_token_and_binary`: Il controllo "servizio già sano" precede la verifica del modello**
   - **File e Righe**: `apps/desktop/src-tauri/src/llama.rs`, righe 1760–1771 (controllo stato sano) rispetto alle righe 1774–1785 (verifica modello locale)
   - **Comportamento**: Se il servizio è già attivo e sano sulla porta specificata, la funzione ritorna immediatamente `Ok(self.status())` senza verificare se il file `bge-m3-Q8_0.gguf` è presente nella cartella modelli locale.
3. **`get_or_adopt_or_start_service_with_timeout`: Il controllo del binario precede quello del modello**
   - **File e Righe**: `apps/desktop/src-tauri/src/llama.rs`, righe 1571–1583 (controllo binario `detect_llama_server_binary()`) rispetto alle righe 1601–1615 (controllo modello `local_model_status()`)
   - **Comportamento**: Se nell'ambiente mancano sia l'eseguibile `llama-server.exe` sia il file del modello `.gguf`, l'ordine di verifica modificato produce un cambiamento nel messaggio di errore restituito all'utente: anziché "Modello locale bge-m3 non installato o non integro", viene restituito "Binario llama-server non trovato: ripiego sulla ricerca per parole.".

---

## 7. Storico Patch delle Fasi Precedenti (File Locali del Workspace)

Nella cartella del workspace `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/` sono conservati localmente i file patch delle fasi precedenti (mantenuti come file non tracciati in git, indicati con `??` in `git status` e non inclusi nel repository remoto):
1. `fase-1.patch`
2. `fase-2.patch` e `fase-2-b.patch`
3. `fase-2L.patch` e `fase-2L-b.patch`
4. `fase-3b1.patch`, `fase-3b2.patch`, `fase-3b2b.patch`, `fase-3b2c.patch`
5. `fase-4.patch` e `fase-4c.patch`
6. `fase-5.patch`, `fase-5b.patch`, `fase-5e.patch`, `fase-5f.patch`, `fase-5g.patch`, `fase-5h.patch`
7. `fase-5i.patch`
8. `fase-5i-bis.patch` (patch cumulativa di consegna 5i-bis)

---

## 8. Registro Esatto dei Test e Verifica dei Punti

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

## 9. Verifiche di Bisezione dei Commit Intermedi

Ciascun commit di codice è stato verificato con `cargo check` salvato nel rispettivo file di evidenza:
- `fase5i-bis-check-d1.log`: commit `8de998b` (linea 1), 0 errori
- `fase5i-bis-check-d2.log`: commit `b4ab068` (linea 1), 0 errori
- `fase5i-bis-check-d3.log`: commit `3662f4a` (linea 1), 0 errori
- `fase5i-bis-check-d4.log`: commit `d8ddd86` (linea 1), 0 errori

---

## 10. Registri di Collaudo Completi

I registri integrali delle prove sono disponibili nei file:
- `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-bis-test-parallelo.log`
- `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-bis-test-seriale.log`
