# Rapporto di Risoluzione Difetti FASE 5i (N1–N7)

**Data:** 2026-09-24  
**Branch:** windows-build  
**Base Commit:** 6b04271  
**Ultimo Commit di Codice per Patch:** 1b21ad7

---

## 1. Rettifica Ufficiale Rapporto FASE 5h: Causa Evento 13:53:21

Nel rapporto precedente della FASE 5h, il fallimento registrato alle 13:53:21 (BACKGROUND_START_FAILED dopo 26.361 ms nei collaudi C01, C01R, C01R2) era stato erroneamente attribuito a un presunto "secondo avvio contemporaneo" che avrebbe conteso le risorse.

### Causa Reale e Riferimenti Esatti nel Commit 6b04271
L'analisi del codice reale nel commit 6b04271 ha accertato che la spiegazione era completamente errata.
La causa reale era il **difetto bloccante N1 (auto-deadlock di avvio)**:
1. In pps/desktop/src-tauri/src/llama.rs a riga 806: 	rigger_background_start impostava sotto mutex s.starting = true;.
2. A riga 813: 	rigger_background_start avviava un thread in background che invocava start_internal(Duration::from_secs(25)).
3. Alle righe 863–875: start_internal eseguiva un loop di attesa passiva while starting_in_progress { std::thread::sleep(...) } ogni volta che rilevava s.starting == true, interpretandolo genericamente come "un altro avvio è già in corso".
4. Poiché il thread stesso era l'esecutore incaricato di compiere l'avvio, si creava un **auto-deadlock**: il thread attendeva sé stesso fino allo scadere del timeout massimo (25.000 ms), fallendo sistematicamente con BACKGROUND_START_FAILED senza aver mai generato alcun processo o aperto alcuna porta di ascolto.

---

## 2. Risoluzione Dettagliata dei Punti N1–N6 e Nomi Esatti dei Test

### N1 — Token di Proprietà dell'Avvio (Start Owner Token)
- **Implementazione**:
  - Aggiunti start_owner: Option<u64> alla struct RunningState e un generatore atomico START_TOKEN_GEN (
ext_start_token()).
  - 	rigger_background_start_with_binary genera un token univoco, imposta s.start_owner = Some(token) e lo passa al thread.
  - In start_internal_with_token_and_binary, se s.starting è 	rue, si verifica se il chiamante possiede il token proprietario (caller_token == s.start_owner):
    - Se è il **proprietario**, procede immediatamente con la verifica del modello, l'allocazione della porta e lo spawn del processo llama-server.
    - Se è un **chiamante concorrente** (es. click manuale dell'utente su "AVVIA SERVIZIO LOCALE" mentre l'avvio in background è in corso), attende il completamento dell'avvio già in corso e adotta il risultato senza creare processi duplicati.
  - La guardia RAII StartingGuard garantisce che il flag starting e start_owner vengano resettati sia al termine dell'avvio sia in caso di errore o thread panic.
  - Se un servizio esterno adottato termina inaspettatamente, la domanda successiva azzera la registrazione stantia e un nuovo avvio automatico del servizio proprio ha successo (C06).
- **Test Unitari Reali (output grezzo cargo test)**:
  - llama::tests::test_fase5i_n1_app_startup_auto_starts_single_process (Punto N1)
  - llama::tests::test_fase5i_n1_button_pressed_during_background_start_waits_and_succeeds_single_process (Punto N1)
  - llama::tests::test_fase5i_n1_adopted_service_dies_next_query_fallbacks_and_restarts (Punto N1)

### N2 — Esposizione dello Stato "In Avvio" in UI e Disattivazione Pulsante
- **Backend**:
  - LocalServerReport include pub starting: bool (#[serde(default)]).
  - LlamaServerState::status() legge s.starting ed espone starting: is_starting.
- **Frontend**:
  - pps/desktop/src/ai-ipc.ts: aggiornata l'interfaccia LocalServerReport con starting?: boolean;.
  - pps/desktop/src/SemanticEngineSettings.tsx:
    - Calcolato const isStarting = startingServer || Boolean(serverReport?.starting);.
    - Badge di stato: mostra IN AVVIO… con sfondo ambrato #fef3c7 e testo #92400e.
    - Pulsante AVVIA SERVIZIO LOCALE: disabilitato (disabled={... || isStarting}) con testo AVVIO IN CORSO….
    - Polling automatico: aggiunto useEffect che effettua efreshAll() ogni 1.000 ms finché serverReport?.starting è 	rue, aggiornando la vista non appena il servizio diventa pronto.
- **Controllo Tipi Frontend**:
  - Eseguito 
pm run typecheck (	sc --noEmit) in pps/desktop: 0 errori.
  - Salvato in: IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-frontend-typecheck.log.
- **Test Unitario Reale (output grezzo cargo test)**:
  - llama::tests::test_fase5i_n2_status_exposes_starting_state (Punto N2)

### N3 — Registrazione Percorso Eseguibile Reale Adottato e PANEL_OPEN_STATUS
- **Implementazione**:
  - Risolta la causa in log_local_model_timing_meta: in precedenza, quando non era specificato un percorso binario esplicito, la funzione ripiegava su detect_llama_server_binary(), registrando erroneamente il percorso della propria installazione locale anche per processi adottati.
  - Ora, se è presente un PID di servizio (adottato o proprio), il percorso viene ricavato direttamente dal processo reale tramite get_process_exe_path(pid). Solo in assenza sia di PID che di porta viene utilizzato il rilevamento locale.
  - dopt_service memorizza il percorso binario reale del processo adottato in s.binary_path.
  - In main.rs, il comando local_model_status (invocato all'apertura del pannello impostazioni) interroga llama_state.status(), estraendo pid, port e inary_path e passandoli a log_local_model_timing_meta("PANEL_OPEN_STATUS", ...).
- **Test Unitari Reali (output grezzo cargo test)**:
  - llama::tests::test_fase5i_n3_adopted_service_from_other_folder_logs_real_exe_and_panel_open_status (Punto N3)
  - llama::tests::test_fase5h_local_model_timing_log_includes_app_and_service_metadata (Punto N3)

### N4 — Rilascio del Guard Mutex prima della Chiamata a status()
- **Implementazione**:
  - In start_internal_with_token_and_binary (al controllo di servizio già attivo e sano lready_port > 0 && check_health(already_port)), il mutex guard s viene rilasciato (tramite blocco { let mut s = ...; }) prima di invocare self.status().
  - Essendo std::sync::Mutex non rientrante, il rilascio previene ogni possibile deadlock.
- **Test Unitario Reale (output grezzo cargo test)**:
  - llama::tests::test_fase5i_n4_start_when_already_healthy_does_not_deadlock_and_returns_status (Punto N4)

### N5 — Rispetto Rigoroso del Limite di 20 File di Log
- **Implementazione**:
  - In start_internal_with_token_and_binary, la rotazione otate_llama_server_logs(&logs_dir, 19) viene eseguita prima di creare il nuovo file di log della sessione.
  - Con 20 file preesistenti, la cartella viene ridotta a 19, e con la successiva creazione del file per-run si ottengono esattamente **20 file totali** (risolvendo il difetto per cui se ne ottenevano 21).
- **Test Unitario Reale (output grezzo cargo test)**:
  - llama::tests::test_fase5i_n5_20_existing_logs_remains_20_after_startup (Punto N5)

### N6 — Fixture invalid_embeddings nel Repository e Dimostrazione Fallimento
- **Implementazione**:
  - Copiato il sorgente del fixture diagnostico direttamente nel repository:  
    pps/desktop/src-tauri/tests/fixtures/invalid_embeddings.rs.
  - In 	est_fase5h_codex_fixture_acceptance:
    - Rimosso qualunque percorso assoluto esterno al repository e rimosso il eturn silenzioso: se il sorgente manca o la compilazione fallisce, il test va in panic! e **FALLISCE tassativamente**.
    - La compilazione avviene tramite ustc in una cartella temporanea isolata.
    - Il binario risultante viene passato direttamente come parametro esplicito tramite state.start_with_custom_binary(&fixture_exe, prep_timeout) senza impostare alcuna variabile d'ambiente globale LLAMA_SERVER_PATH.
- **Dimostrazione Fallimento con Fixture Mancante**:
  - Ridenominato temporaneamente 	ests/fixtures/invalid_embeddings.rs in invalid_embeddings.rs.bak.
  - Eseguito cargo test test_fase5h_codex_fixture_acceptance.
  - Il test è fallito con esito FAILED (panic esplicito "Sorgente fixture tests/fixtures/invalid_embeddings.rs NON trovato nel repository!").
  - Salvato output grezzo in: IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-n6-fixture-mancante.log.
  - Ripristinato il file e verificato lo stato pulito del repository con git status.
- **Test Unitario Reale (output grezzo cargo test)**:
  - llama::tests::test_fase5h_codex_fixture_acceptance (Punto N6)

---

## 3. Verifica Compilazione Commit Intermedi (N1–N6)

Per garantire l'usabilità di future ricerche per bisezione (git bisect), ciascun commit intermedio N1–N6 è stato verificato con cargo check nella cartella pps/desktop/src-tauri, accertando che compila con successo (0 errori). Gli output grezzi sono salvati nei seguenti file di evidenza:

- **N1** (commit 555d373): ase5i-check-commit-n1.log — Finished dev profile in 8.63s (0 errori).
- **N2** (commit 54b41d3): ase5i-check-commit-n2.log — Finished dev profile in 7.00s (0 errori).
- **N3** (commit dddf717): ase5i-check-commit-n3.log — Finished dev profile in 6.46s (0 errori).
- **N4** (commit 1a0f223): ase5i-check-commit-n4.log — Finished dev profile in 5.49s (0 errori).
- **N5** (commit 3dcf8bf): ase5i-check-commit-n5.log — Finished dev profile in 5.63s (0 errori).
- **N6** (commit 1b21ad7): ase5i-check-commit-n6.log — Finished dev profile in 5.64s (0 errori).

---

## 4. Indagine N7: Tracciamento Riscrittura Catalogo del Vault

### Evidenza Segnalata dal Collaudo
Nel collaudo del 24/09/2026, il file E:\VAULT WIN TEST DEV\00_SYSTEM\VAULT_CATALOG.json è risultato riscritto alle ore 15:42:59 UTC+8 senza operazioni manuali di modifica note da parte dell'utente.

### a) Funzione Rust che Scrive Fisicamente il File
- **File**: pps/desktop/src-tauri/src/catalog.rs, righe 294–328:
  `ust
  pub fn save_catalog(vault_path: &Path, catalog: &mut CatalogState) -> Result<(), String> {
      catalog.catalog_revision += 1;
      catalog.last_updated_at = now_iso();
      let r = root(vault_path)?;
      let sys = child(&r, "00_SYSTEM")?;
      let tmp = format!(".catalog-{}.tmp", crate::ai::random_token()?);
      let bytes = serde_json::to_vec_pretty(&catalog).map_err(err)?;
      write_new(&sys, &tmp, &bytes)?;
      let res = sys.rename(&tmp, &sys, CATALOG_FILE).map_err(err);
      ...
  `
  La scrittura fisica del file su disco avviene qui: serializzazione in byte a riga 300, scrittura nel file temporaneo atomico a riga 301 e rinomina in VAULT_CATALOG.json a riga 302.

### b) Condizione di Scrittura all'Apertura del Vault
- **File**: pps/desktop/src-tauri/src/catalog.rs, riga 875:
  `ust
  save_catalog(vault_path, &mut catalog)?;
  `
- **Esito**: La scrittura avviene **SEMPRE incondizionatamente all'apertura del vault**.
  **Nessuna condizione esiste** prima di invocare save_catalog a riga 875. Quando il frontend apre un vault esistente (App.tsx:461), viene invocata efreshCatalog -> ipc.syncCatalog -> comando Tauri catalog_sync (main.rs:635) -> sync_catalog_from_vault(Path::new(&path)).
  La funzione scansiona le cartelle e, anche qualora nessun file sia stato modificato o aggiunto, esegue incondizionatamente save_catalog, incrementando catalog_revision e aggiornando last_updated_at.

### c) Verifica Codice sul Percorso della Domanda (Nessuna Scrittura)
È stato condotto un audit completo riga per riga sul percorso di esecuzione delle domande:
1. **i_preview**: pps/desktop/src-tauri/src/main.rs, righe 510–560.
   - Verifica la preparazione del servizio llama (timeout 5s).
   - Invoca state.preview_with_service_info(...) a riga 548. Nessuna scrittura su disco.
2. **preview_with_service_info**: pps/desktop/src-tauri/src/ai.rs, righe 1476–1557.
   - Invoca select_with_port_detailed(&path, &o, active_port).await? a riga 1489.
   - Inserisce la richiesta nella mappa in memoria self.pending (righe 1530–1543). Nessuna scrittura su disco.
3. **select_with_port_detailed**: pps/desktop/src-tauri/src/ai.rs, righe 1282–1360.
   - Invoca crate::embeddings::hybrid_search_vault_with_port_filtered_timed a riga 1303.
4. **hybrid_search_vault_with_port_filtered_timed**: pps/desktop/src-tauri/src/embeddings.rs, righe 1255–1280.
   - Invoca search_vault_with_port_filtered_timed che a riga 1143 chiama crate::search::search_vault_records e a riga 1193 chiama crate::catalog::load_catalog_arc.
5. **load_catalog_arc**: pps/desktop/src-tauri/src/catalog.rs, righe 269–291.
   - Legge da cache in memoria CATALOG_CACHE (righe 273–286) o in sola lettura da disco (ead(&sys, CATALOG_FILE) a riga 243). Nessuna operazione di scrittura.
6. **i_ask / i_ask_stream**: pps/desktop/src-tauri/src/main.rs, righe 562–600 -> i.rs:1728 -> sk_with_cancel (i.rs:1594):
   - Recupera i dati pendenti dalla memoria, effettua la richiesta HTTP streaming/completions verso OpenAI, sanitizza e restituisce la risposta. Nessuna scrittura su disco.
7. **Controllo Globale di save_catalog**:
   - Una ricerca esaustiva su tutto il codice Rust del progetto conferma che save_catalog è richiamata **esclusivamente** in:
     - catalog.rs:875 in sync_catalog_from_vault (apertura vault / sync).
     - catalog.rs:903 in estore_catalog_backup (azione esplicita utente di rollback backup).
     - catalog.rs:1038 in process_extraction_queue (coda di estrazione testo).
   - Nessun'altra parte dell'applicazione richiama save_catalog.

**Conclusione**: È **VERIFICATO NEL CODICE** che la formulazione di una domanda NON riscrive in alcun caso il catalogo VAULT_CATALOG.json. La riscrittura delle 15:42:59 è stata causata esclusivamente dall'apertura del vault e dalla conseguente sincronizzazione incondizionata. Il comportamento è stato documentato e non alterato in questa fase.

---

## 5. Log di Collaudo dello Stato Finale

Tutti i log grezzi completi includono il comando eseguito in prima riga:

1. **Test in Parallelo**:
   - File: IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-test-parallelo.log
   - Comando in prima riga: cargo test
   - Esito: **185 passed in lib.rs, 18 passed in main.rs, 0 failed, 0 ignored** (totale 203 passati).
2. **Test Seriale (uno alla volta)**:
   - File: IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-test-seriale.log
   - Comando in prima riga: cargo test -- --test-threads=1
   - Esito: **185 passed in lib.rs, 18 passed in main.rs, 0 failed, 0 ignored** (totale 203 passati).
3. **Controllo Tipi Frontend**:
   - File: IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase5i-frontend-typecheck.log
   - Comando in prima riga: 
pm run typecheck (	sc --noEmit)
   - Esito: **0 errori**.

---

## 6. Generazione Patch FASE 5i

La patch cumulativa di tutte le modifiche di codice da 6b04271 è stata generata sul commit finale di codice 1b21ad7:

`ash
git diff 6b04271 1b21ad7 --output="IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-5i.patch"
`

- **Estremo base**: 6b04271 (consegna FASE 5h)
- **Estremo superiore**: 1b21ad7 (ultimo commit di codice N6)
- **File**: IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase-5i.patch
- **File modificati nella patch**:
  - pps/desktop/src-tauri/src/llama.rs
  - pps/desktop/src-tauri/src/main.rs
  - pps/desktop/src-tauri/tests/fixtures/invalid_embeddings.rs
  - pps/desktop/src-tauri/tests/fixtures/valid_mock_server.rs
  - pps/desktop/src/SemanticEngineSettings.tsx
  - pps/desktop/src/ai-ipc.ts
- **Verifica patch**: git apply --stat applicata con successo (6 files changed, 720 insertions(+), 103 deletions(-)).
