# Task List Tracciabile — FASE 5i (Correzioni N1–N6 e Indagine N7)

**Data**: 24 Settembre 2026  
**Ambiente**: LIMEN Vault v4 (`E:\Projects\vault_memai_obsi`, branch `windows-build`)  
**Base di partenza**: `6b04271`  
**Vincoli Tassativi**:
1. Nessuna chiamata a OpenAI.
2. Nessuna chiusura di processi non avviati dall'agente.
3. **Un commit distinto per ogni singolo punto** (N1, N2, N3, N4, N5, N6, N7 + consegna).
4. Consegna: `fase-5i.patch` (`git diff 6b04271 HEAD`) aggiunto all'ultimo commit, log test parallelo e singolo, push.

---

## Stato Avanzamento Punti N1–N7

- [ ] **N1 — Proprietà dell'Avvio (Owner Token) ed Evitamento Auto-Deadlock in Background**
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: contatore atomico `START_TOKEN_GEN`, `start_owner: Option<u64>` e `next_start_token()`.
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: `start_internal_with_token_and_binary` differenzia tra proprietario dell'avvio (che procede senza attendere se stesso) e chiamanti concorrenti (che attendono l'esito dell'avvio attivo evitando processi duplicati).
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: `StartingGuard(self.clone(), Some(token))` disarma e ripristina lo stato solo se il token corrisponde, evitando azzeramenti spuri da guard non proprietari.
  - [x] Test obbligatori implementati e verificati:
    - Apertura app senza servizi $\rightarrow$ avvio automatico riuscito con un solo processo (`test_fase5i_n1_app_startup_auto_starts_single_process`).
    - Pulsante premuto durante l'avvio automatico $\rightarrow$ un solo processo e avvio riuscito (C07) (`test_fase5i_n1_button_pressed_during_background_start_waits_and_succeeds_single_process`).
    - Servizio adottato che si chiude $\rightarrow$ la domanda successiva ripiega e un nuovo avvio automatico riesce (C06) (`test_fase5i_n1_adopted_service_dies_next_query_fallbacks_and_restarts`).
  - [ ] Rettifica della spiegazione errata nel rapporto 5h: formalizzare che `BACKGROUND_START_FAILED` era causato dall'auto-deadlock di `trigger_background_start` che attendeva il proprio flag `starting=true`.
  - [ ] **Commit per N1**.

---

- [ ] **N2 — Esposizione Stato "in avvio" dal Backend e Disattivazione AVVIA nel Frontend**
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: aggiunto `pub starting: bool` a `LocalServerReport` e valorizzato in `LlamaServerState::status()`.
  - [x] In `apps/desktop/src/ai-ipc.ts`: aggiornata interfaccia TypeScript `LocalServerReport` con `starting?: boolean`.
  - [x] In `apps/desktop/src/SemanticEngineSettings.tsx`: `isStarting` calcolato da `startingServer || Boolean(serverReport?.starting)`, badge mostra `IN AVVIO…` e pulsante `AVVIA SERVIZIO LOCALE` disattivato (`disabled`) con etichetta `AVVIO IN CORSO…`.
  - [x] Test unitario di conformità backend (`test_fase5i_n2_status_exposes_starting_state`).
  - [ ] **Commit per N2**.

---

- [ ] **N3 — Percorso Reale del Processo Adottato in local_model_timing.log e Dati PANEL_OPEN_STATUS**
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: `get_process_exe_path(pid)` acquisisce il percorso reale del processo adottato su Windows (via `QueryFullProcessImageNameW` con fallback PowerShell) e Unix.
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: `adopt_service` memorizza il percorso reale in `s.binary_path`; `BACKGROUND_ADOPT_SUCCESS` e `EXTERNAL_SERVICE_ADOPTED` registrano il binario effettivo del processo esterno e non quello dell'app locale.
  - [x] In `apps/desktop/src-tauri/src/main.rs`: `local_model_status` estrae `(srv_bin, srv_pid, srv_port)` quando il servizio esiste/ascolta e li passa a `PANEL_OPEN_STATUS`.
  - [x] Test unitario con servizio adottato da percorso differente (`test_fase5i_n3_adopted_service_from_other_folder_logs_real_exe_and_panel_open_status`).
  - [ ] **Commit per N3**.

---

- [ ] **N4 — Rilascio Guard della Mutex prima di self.status() nel Ramo Già Sano**
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: nel ramo `already_port > 0 && check_health(already_port)` il guard `s` viene rilasciato (drop) prima della chiamata a `self.status()`, prevenendo tentativi di riacquisizione non rientrante.
  - [x] Test unitario che attraversa specificamente il ramo di avvio quando il servizio è già sano (`test_fase5i_n4_start_when_already_healthy_does_not_deadlock_and_returns_status`).
  - [ ] **Commit per N4**.

---

- [ ] **N5 — Rotazione Rigorosa a Massimo 20 File di Log**
  - [x] In `apps/desktop/src-tauri/src/llama.rs`: la rotazione `rotate_llama_server_logs(&logs_dir, 19)` viene eseguita prima di creare il nuovo file (oppure dopo limitando a 20), garantendo che con 20 preesistenti rimangano esattamente 20 file dopo l'avvio.
  - [x] Test unitario con 20 file preesistenti $\rightarrow$ 20 file dopo l'avvio (`test_fase5i_n5_20_existing_logs_remains_20_after_startup`).
  - [ ] **Commit per N5**.

---

- [ ] **N6 — Fixture Repository Locale e Compilazione Rigorosa Senza Return Silenzioso**
  - [x] Copiato sorgente fixture in `apps/desktop/src-tauri/tests/fixtures/invalid_embeddings.rs`.
  - [x] In `test_fase5h_codex_fixture_acceptance`: compilazione tramite `rustc` in cartella temporanea; asserzione esplicita che `rustc` abbia successo e che il fixture esista (nessun `return` silenzioso; il test FALLISCE se manca il sorgente o la compilazione).
  - [x] Passaggio del percorso del binario compilato come argomento diretto `start_with_custom_binary(&fixture_exe)` (nessuna dipendenza da variabile globale d'ambiente né da percorsi assoluti esterni).
  - [x] Test con `ENV_TEST_LOCK` serializzato.
  - [ ] **Commit per N6**.

---

- [ ] **N7 — Indagine Formale sul Catalogo del Vault (`VAULT_CATALOG.json`)**
  - [x] Analisi statica riga per riga del flusso di riscrittura:
    - **Apertura Vault**: `apps/desktop/src/App.tsx:421-462` (`handleOpenExistingVault`) $\rightarrow$ riga 461 chiama `refreshCatalog` $\rightarrow$ `vault-ipc.ts:305` invoca il comando Tauri `catalog_sync`.
    - **Backend Tauri**: `apps/desktop/src-tauri/src/main.rs:635-642` esegue `limen_vault::catalog::sync_catalog_from_vault(Path::new(&vault_path))`.
    - **Sincronizzazione Catalogo**: `apps/desktop/src-tauri/src/catalog.rs:545` $\rightarrow$ riga 875 chiama `save_catalog(vault_path, &mut catalog)?`.
    - **Salvataggio Atomico**: `catalog.rs:294-307` (`save_catalog`) incrementa `catalog.revision += 1`, aggiorna `catalog.updated_at = now_iso()` e riscrive atomicamente `00_SYSTEM/VAULT_CATALOG.json`.
    - **Flusso Domande (Ask / Preview)**: Durante una domanda in `ai.rs` o `search.rs`, il catalogo viene **esclusivamente letto** tramite cache in sola lettura (`load_catalog_arc` / `get_document`). **Nessuna riscrittura avviene durante le domande**.
  - [ ] Formalizzare la dichiarazione documentata in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/2026-09-24_ANALISI_N7_CATALOGO.md`.
  - [ ] **Commit per N7 / Documentazione**.

---

- [ ] **Chiusura FASE 5i e Consegna**
  - [ ] Esecuzione test suite completa in parallelo: salvata in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-5i-parallel.log`.
  - [ ] Esecuzione test suite sequenziale (`--test-threads=1`): salvata in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-5i-single.log`.
  - [ ] Generazione patch completa: `git diff 6b04271 HEAD > IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-5i.patch`.
  - [ ] Commit finale contenente la patch `fase-5i.patch` e i log di verifica.
  - [ ] Git push su `origin/windows-build`.
