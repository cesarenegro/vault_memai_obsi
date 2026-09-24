# Rapporto di Risoluzione Difetti FASE 5i (N1–N7)

**Data:** 2026-09-24  
**Branch:** `windows-build`  
**Base Commit:** `6b04271`  

---

## 1. Rettifica Ufficiale Rapporto FASE 5h: Causa Evento 13:53:21

Nel rapporto precedente della FASE 5h, il fallimento registrato alle 13:53:21 (`BACKGROUND_START_FAILED` dopo 26.361 ms) era stato erroneamente attribuito a un presunto "secondo avvio contemporaneo" che avrebbe conteso le risorse.

**Rettifica e Causa Reale:**
L'auditor indipendente Codex e l'analisi del codice hanno accertato che la spiegazione era errata.
La causa reale era il **difetto bloccante N1**:
All'apertura dell'applicazione, `trigger_background_start` impostava `s.starting = true` all'interno della mutex, e subito dopo avviava un thread in background che invocava `start_internal(Duration::from_secs(25))`.
Nel commit `6b04271`, `start_internal` leggeva `s.starting == true` interpretandolo come un "altro avvio già in corso da parte di un processo o thread concorrente", e si metteva in attesa passiva che tale flag tornasse `false`.
Essendo il thread stesso l'esecutore deputato all'avvio, si generava un **auto-deadlock**: il thread attendeva sé stesso fino allo scadere del timeout massimo (25 secondi), fallendo con `BACKGROUND_START_FAILED` senza aver mai generato alcun processo o aperto alcuna porta.

---

## 2. Risoluzione Dettagliata dei Punti N1–N6

### N1 — Token di Proprietà dell'Avvio (Start Owner Token)
- **Implementazione**:
  - Aggiunto `start_owner: Option<u64>` a `RunningState` e un generatore atomico `START_TOKEN_GEN` (`next_start_token()`).
  - `trigger_background_start_with_binary` assegna un token univoco all'avvio e lo passa al thread.
  - In `start_internal_with_token_and_binary`, se `s.starting` è `true`, si verifica se il chiamante possiede lo stesso token (`caller_token == s.start_owner`):
    - Se è il **proprietario**, procede immediatamente con la verifica del modello, l'allocazione della porta e lo spawn del processo.
    - Se è un **chiamante concorrente** (es. click manuale dell'utente su "AVVIA SERVIZIO LOCALE" mentre l'avvio in background è in corso), attende il completamento dell'avvio già in corso e adotta il risultato senza creare un processo duplicato.
  - La guardia RAII `StartingGuard` garantisce che il flag `starting` e `start_owner` vengano resettati anche a fronte di errori o panic.
  - Se un servizio esterno adottato termina inaspettatamente, la domanda successiva azzera la registrazione stantia e un nuovo avvio automatico del servizio proprio ha successo (C06).
- **Test Unitari Obbligatori**:
  - `test_fase5i_n1_app_startup_auto_starts_single_process`: avvio automatico all'apertura senza servizi attivi produce un solo processo sano.
  - `test_fase5i_n1_button_pressed_during_background_start_waits_and_succeeds_single_process`: pulsante premuto durante l'avvio in background attende e ha successo con un unico processo.
  - `test_fase5i_n1_adopted_service_dies_next_query_fallbacks_and_restarts`: se il servizio esterno muore, la query ripiega e un nuovo avvio automatico ha successo.

### N2 — Esposizione dello Stato "In Avvio" in UI e Disattivazione Pulsante
- **Backend**:
  - `LocalServerReport` include `pub starting: bool` (`#[serde(default)]`).
  - `LlamaServerState::status()` legge `s.starting` ed espone `starting: is_starting`.
  - Unit test `test_fase5i_n2_status_exposes_starting_state` verifica l'esposizione fedele del flag.
- **Frontend**:
  - `ai-ipc.ts`: aggiornata l'interfaccia `LocalServerReport` con `starting?: boolean;`.
  - `SemanticEngineSettings.tsx`:
    - Calcolato `const isStarting = startingServer || Boolean(serverReport?.starting);`.
    - Badge di stato: mostra `IN AVVIO…` con sfondo ambrato `#fef3c7` e testo `#92400e`.
    - Pulsante `AVVIA SERVIZIO LOCALE`: disabilitato (`disabled={... || isStarting}`) con testo `AVVIO IN CORSO…`.
    - Polling automatico: aggiunto `useEffect` che effettua `refreshAll()` ogni 1.000 ms finché `serverReport?.starting` è `true`, aggiornando la vista non appena il servizio diventa pronto.

### N3 — Registrazione Percorso Eseguibile Reale Adottato e PANEL_OPEN_STATUS
- **Implementazione**:
  - Risolta la causa in `log_local_model_timing_meta`: in precedenza, quando non era specificato un percorso binario esplicito, la funzione ripiegava su `detect_llama_server_binary()`, registrando erroneamente il percorso della propria installazione locale anche per processi adottati.
  - Ora, se è presente un PID di servizio (adottato o proprio), il percorso viene ricavato direttamente dal processo reale tramite `get_process_exe_path(pid)`. Solo in assenza sia di PID che di porta viene utilizzato il rilevamento locale.
  - `adopt_service` memorizza il percorso binario reale del processo adottato in `s.binary_path`.
  - Aggiunto `LlamaServerState::get_binary_path(&self) -> Option<PathBuf>`.
  - In `main.rs`, il comando `local_model_status` (invocato all'apertura del pannello impostazioni) interroga `llama_state.status()`, estraendo `pid`, `port` e `binary_path` e passandoli a `log_local_model_timing_meta("PANEL_OPEN_STATUS", ...)`.
- **Test Unitario Obbligatorio**:
  - `test_fase5i_n3_adopted_service_from_other_folder_logs_real_exe_and_panel_open_status`: compila ed esegue un processo in una cartella temporanea esterna differente (`external_llama_server.exe`), lo adotta e verifica che `local_model_timing.log` contenga per `PANEL_OPEN_STATUS` il percorso reale dell'eseguibile esterno, il PID e la porta corretti.

### N4 — Rilascio del Guard Mutex prima della Chiamata a status()
- **Implementazione**:
  - In `start_internal_with_token_and_binary` (al controllo di servizio già attivo e sano `already_port > 0 && check_health(already_port)`), il mutex guard `s` viene rilasciato (tramite blocco `{ let mut s = ...; }`) prima di invocare `self.status()`.
  - Essendo `std::sync::Mutex` non rientrante, il rilascio previene ogni possibile deadlock.
- **Test Unitario Obbligatorio**:
  - `test_fase5i_n4_start_when_already_healthy_does_not_deadlock_and_returns_status`: attraversa specificamente il ramo di servizio già sano su una porta attiva, verificando che `start_with_timeout` ritorni immediatamente senza deadlock.

### N5 — Rispetto Rigoroso del Limite di 20 File di Log
- **Implementazione**:
  - In `start_internal_with_token_and_binary`, la rotazione `rotate_llama_server_logs(&logs_dir, 19)` viene eseguita prima di creare il nuovo file di log della sessione.
  - Con 20 file preesistenti, la cartella viene ridotta a 19, e con la successiva creazione del file per-run si ottengono esattamente **20 file totali** (risolvendo il difetto per cui se ne ottenevano 21).
- **Test Unitario Obbligatorio**:
  - `test_fase5i_n5_20_existing_logs_remains_20_after_startup`: crea esattamente 20 file di log, simula la rotazione e la creazione del nuovo file, e asserisce che al termine siano presenti esattamente 20 file, con eliminazione del file più vecchio e presenza del file nuovo.

### N6 — Fixture invalid_embeddings nel Repository e Compilazione Obbligatoria
- **Implementazione**:
  - Copiato il sorgente del fixture diagnostico direttamente nel repository:  
    [`apps/desktop/src-tauri/tests/fixtures/invalid_embeddings.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/tests/fixtures/invalid_embeddings.rs).
  - In `test_fase5h_codex_fixture_acceptance`:
    - Rimosso qualunque percorso assoluto esterno al repository e rimosso il `return` silenzioso: se il sorgente manca o la compilazione fallisce, il test va in `panic!` e **FALLISCE tassativamente**.
    - La compilazione avviene tramite `rustc` in una cartella temporanea isolata.
    - Il binario risultante viene passato direttamente come parametro esplicito tramite `state.start_with_custom_binary(&fixture_exe, prep_timeout)` senza impostare alcuna variabile d'ambiente globale `LLAMA_SERVER_PATH`.
    - Il test acquisisce inoltre `ENV_TEST_LOCK` a garanzia di completa serializzazione e isolamento.

---

## 3. Indagine N7: Tracciamento Riscrittura Catalogo del Vault

### Evidenza Segnalata dal Collaudo
Nel collaudo di Cesare del 24/09/2026, il file `E:\VAULT WIN TEST DEV\00_SYSTEM\VAULT_CATALOG.json` è risultato riscritto alle ore 15:42:59 UTC+8 senza operazioni manuali da parte dell'utente.

### Tracciamento Catena Chiamate (File e Righe Esatte)
La catena causale che ha provocato la riscrittura è la seguente:

1. **Apertura del Vault (Frontend)**:
   - File: [`apps/desktop/src/App.tsx`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src/App.tsx), riga 461.
   - Quando l'utente apre un vault esistente (`handleOpenExistingVault`), al termine dell'apertura viene invocata la funzione:
     `await refreshCatalog(res.status.path, ticket);`
2. **Richiesta di Sincronizzazione Catalogo (IPC)**:
   - File: [`apps/desktop/src/App.tsx`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src/App.tsx), riga 232.
   - La funzione `refreshCatalog` invoca:
     `const summary = await ipc.syncCatalog(target);`
   - File: [`apps/desktop/src/vault-ipc.ts`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src/vault-ipc.ts), riga 305:
     `syncCatalog: (path: string) => run(async () => invoke<CatalogSummary>('catalog_sync', { vaultPath: path }))`
3. **Comando Backend Tauri**:
   - File: [`apps/desktop/src-tauri/src/main.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/main.rs), righe 634–640.
   - Il comando `catalog_sync` esegue in un task bloccante:
     `limen_vault::catalog::sync_catalog_from_vault(Path::new(&vault_path))?;`
4. **Sincronizzazione e Scrittura Incondizionata su Disco**:
   - File: [`apps/desktop/src-tauri/src/catalog.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/catalog.rs), riga 875.
   - La funzione `sync_catalog_from_vault` esegue la scansione delle cartelle del vault e, **incondizionatamente** (anche quando nessun file in `20_RAW_SOURCES` è stato aggiunto o modificato), invoca:
     `save_catalog(vault_path, &mut catalog)?;`
5. **Scrittura Atomica del File**:
   - File: [`apps/desktop/src-tauri/src/catalog.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/catalog.rs), righe 294–307.
   - `save_catalog` incrementa la revisione (`catalog.catalog_revision += 1`), imposta `catalog.updated_at` al timestamp corrente e riscrive `00_SYSTEM/VAULT_CATALOG.json` tramite file temporaneo atomico `.catalog-<token>.tmp`.

### Verifica sull'Impatto delle Domande (AI Ask / AI Preview)
È stato condotto un audit sistematico su tutte le chiamate effettuate durante la formulazione di domande:
- `ai_preview` ([main.rs:515](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/main.rs#L515) $\rightarrow$ [ai.rs:1476](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L1476))
- `ai_ask` / `ai_ask_stream` ([main.rs:562](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/main.rs#L562))
- `select_lexical_sources` / `select_semantic_sources` ([search.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs) e [embeddings.rs](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/embeddings.rs))

**Esito Categorico**:
Né `ai_preview` né `ai_ask` né `ai_ask_stream` toccano o riscrivono in alcun modo `00_SYSTEM/VAULT_CATALOG.json`. Tali funzioni accedono al catalogo esclusivamente in modalità di sola lettura tramite `load_catalog_arc` con cache in memoria.
La riscrittura delle 15:42:59 è stata causata **esclusivamente dall'apertura del vault** e dalla chiamata automatica a `catalog_sync` eseguita da `App.tsx`.

Come da vincolo ("Non modificare il comportamento prima di averlo documentato"), il comportamento è stato accuratamente documentato senza alterare il flusso di sincronizzazione del catalogo.
