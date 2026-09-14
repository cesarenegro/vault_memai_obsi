# TASK LIST — LIMEN Vault: M2–M9 locali; M10 parziale, Worker/CRM pubblicati e installer consegnato

PUBBLICATO E COLLAUDATO — salute MEMAI ok; Workbench Codex read attivo; ricerca reale completata con risposta italiana e 8 fonti, annullamento durante esecuzione PASS. Backend 9043ff5, Render dep-dajgdl0jo6nc73dp4lr0 Live. CRM dpl_CSZPgsq6uTaMspWnTZJFVmAtpg6R Ready su pii-crm.vercel.app. Pre-deploy: entrambi gli script PASS; schema u1c2d3e4f5a6 = head. Commit/push MEMAI autorizzati ed eseguiti su codex/research-runtime; nessun merge main.


- [x] Pre-deploy Docker certificato: START/PASS validazione e START/PASS migrazioni osservati; schema corrente = head u1c2d3e4f5a6.

Aggiornata: 13 settembre 2026. M2–M9 completate in locale secondo le evidenze conservate. M10 parziale: Worker/CRM pubblicati e installer notarizzato consegnato. UI italiana e installer notarizzati consegnati in USER INSTALL, manuale incluso. Mapping con note reali richiesto: in attesa della scelta dei documenti e Cliente/Progetto. Salute MEMAI corretta e verificata dopo 21 minuti; Workbench Codex read pubblicato e collaudato. Ricerca multi-agent pubblicata e collaudata: creazione, risposta con fonti e annullamento.

**Stato verificato:** M7/M8/M9 chiuse in locale con evidenze preservate. M10 non integralmente chiusa: Worker/CRM pubblicati, installer consegnato; restano note reali/mapping, secondo Mac e offline in account pulito. Commit/push MEMAI eseguiti con autorizzazione; nessun commit/push LIMEN o CRM.

## Priorità utente — interfaccia italiana e manuale (13 settembre 2026)

- [x] Interfaccia italiana implementata e installata in `~/Applications/LIMEN Vault 0.2.0.app`: undici sezioni, menu nativi, stati/categorie e messaggi. Metadati/file e diagnostica tecnica originale preservati; voci aggiunte da macOS seguono la lingua del sistema.
- [x] `manuale UI utente.txt` consegnato: 17 sezioni, undici menu, workflow operativi, differenza fra approvazione locale, copia privata e pubblicazione, spiegazione avvisi CRM e mapping.
- [x] pnpm test/typecheck/build PASS in sequenza; Rust 38 lib + 18 main PASS; build Tauri finale PASS, firma Developer ID e verifica strict PASS. Visita delle undici sezioni e copia locale verificata su fixture isolata. Avvio della copia installata: “Benvenuto in LIMEN Vault”, Vault reale “Pronto”. Evidenze: IMPLEMENTATION/UI_IT_EVIDENCE/.
- [x] Primo rebuild finale fallito per disco pieno, risolto eliminando solo cache Rust debug generata; retry PASS. Copia installata precedente conservata in `.local/ui-it/installata-precedente/`; vecchie istanze inglesi chiuse.
- [x] CONSEGNATI in USER INSTALL: installer italiano e DMG app italiano, sostituiti i due pacchetti inglesi. App LIMEN, DMG app, app installer e DMG installer tutti Apple Accepted e stapled; Gatekeeper PASS. Installer dal DMG finale verificato in sola lettura, payload e manuale confrontati tramite SHA-256.
- [x] Installer aggiornato: installazione nuova e aggiornamento da 0.2.0 inglese PASS; app precedente e documenti conservati; destinazione non valida e app ancora aperta rifiutate senza modifiche. UI dell’app installata dal pacchetto osservata in italiano. Backup consegna: USER INSTALL/STORICO/2026-09-13-versione-inglese. Evidenze: IMPLEMENTATION/UI_IT_EVIDENCE/notarized/.
- [x] Diagnosi codice CRM: Workbench richiede `MEMAI_WORKBENCH_ENABLED=true`; ricerca multi-agent richiede `MEMAI_VPRO_MULTI_AGENT_ENABLED=true`. Gli avvisi provengono dai controlli CRM prima della chiamata API, non provano un guasto dell’archivio LIMEN.
- [x] PUBBLICATO — Flag CRM e backend Workbench/multi-agent attivi. Backend dep-dajfpop594qs73c1qmk0 Live, stesso commit bce9d61; Codex read. Workbench: creazione, cronologia e revoca workspace vuoto PASS.
- [x] Ricerca multi-agent pubblicata: avvio da Safari Admin, job c2af2b36-baa2-4dfb-b09e-175720e4da42 completed in 13.24 s con risposta italiana e 8 fonti; job 319f0fbd-aed4-4b42-9876-e4f7e26a843f running → cancelled sulle API reali, senza risposta.
- [ ] Collaudo con note reali e mapping richiesto dall’utente: Vault reale contiene soltanto HOME.md e VAULT_RULES.md di sistema. Chiesti documenti approvati e Cliente/Progetto; nessuna pubblicazione inventata. Contratto verificato: frontmatter `client`/`project` → manifesto → filtri CRM per uguaglianza esatta. Matrice preparata nel rapporto UI italiana.

- [x] Cron Render m3mai-reconcile corretto da 0 * * * * a */10 * * * *; monitor runtime confermato 600 secondi. API interne workspaces/research/jobs/settings-workbench tutte HTTP 200.
- [x] Salute MEMAI: heartbeat ingestion 19:30:06 e 19:40:27 UTC; /health HTTP 200 status ok alle 19:47:14 UTC, oltre 20 minuti dalla correzione cron. Nessun recupero manuale.

## Regole operative — aggiornamento 12 settembre 2026

- [x] Semplificato AGENT.md su richiesta: autonomia, verifiche proporzionate e documentazione senza duplicazioni; mantenute protezioni su dati, test, segreti e pubblicazione.
- [x] Verifica documentale e diff; nessuna modifica applicativa, nessun test/build necessario, nessun commit/push/deploy.
- Nessun blocco della revisione regole. Stati delle milestone invariati; M3 non avviata da questa richiesta.

## Quadro delle fasi

| Fase | Obiettivo | Stato effettivo | Residuo principale |
| --- | --- | --- | --- |
| M0 | Fondamenta | Completata secondo documentazione; guardie riconvalidate | Nessun nuovo residuo emerso dalle guardie |
| M1 | Interfaccia prodotto | Shell completata secondo documentazione; UI approvata secondo handover | Funzioni reali nelle milestone successive |
| M2 | Vault locale | Completata in locale e riconvalidata dopo M3 | Nessun residuo M2 |
| M3 | Snapshot e integrità | Completata e verificata in locale | Nessun residuo M3; nessuna pubblicazione |
| M4 | Compilatore conoscenza | Completata e verificata in locale | Nessun criterio M4 aperto; nessuna pubblicazione |
| M5 | Ricerca locale | Completata e verificata in locale | Nessun criterio M5 residuo; non pubblicata |
| M6 | AI interna + Business/Codex esterni | Completata e verificata in locale | Tre E2E reali, revoca e offline verificati; QA disconnessa |
| M7 | Output e proposte | Completata e verificata in locale | Nessuna pubblicazione |
| M8 | Validazione fallback | Completata e verificata in locale | Nessun residuo M8; limiti piattaforma/Obsidian nel rapporto |
| M9 | Release macOS | Completata in locale: notarizzazione, Gatekeeper, AI e Guest PASS | Nessun residuo; pubblicazione separata |
| M10 | Sincronizzazione R2 | Worker, CRM e cataloghi pubblicati; installer notarizzato consegnato | Note reali/mapping, secondo dispositivo e prova offline in account pulito |

## M0 — Fondamenta

- [x] Struttura monorepo con applicazioni desktop/web e pacchetti condivisi.
- [x] Schemi e contratti per Vault, conoscenza e snapshot.
- [x] Template Vault con file di sistema e specifica delle categorie.
- [x] Test di guardia per dipendenze vietate e indipendenza.
- [x] Documentazione di architettura, sicurezza e sviluppo.
- [x] Guardie, test, typecheck e build riconvalidati sul checkout di chiusura M2.

## M1 — Interfaccia prodotto

- [x] Design system e componenti UI condivisi.
- [x] Shell desktop con avvio iniziale e navigazione tra le schermate.
- [x] Schermate Home, Ask Knowledge, Knowledge, Sources, Search, AI Outputs, Proposals, Snapshots, System e Settings.
- [x] Shell web e landing presenti.
- [x] Approvazione visiva registrata nel precedente handover.
- [x] Palette, CSS e layout preservati durante M2; lo stesso vincolo resta per le milestone successive.

La UI Vault e il flusso snapshot invocano Rust e sono stati provati nel bundle macOS offline.

## M2 — completata in locale, regressioni UI corrette e riconvalidate il 12 settembre

### Baseline e prerequisiti

- [x] Conservati diff e sorgenti iniziali in `.local/m2-baseline`; mantenute le modifiche preesistenti.
- [x] Rust/Cargo 1.98.1 disponibili sotto `.local`, Xcode verificato; nessuna modifica al profilo shell.
- [x] Creato bundle macOS con icone derivate dal marchio L approvato e template incorporato in `Contents/Resources/vault-template`.

### Sicurezza, creazione e validazione

- [x] Accessi discendenti tramite directory aperte: `openat`/`O_NOFOLLOW` in TS, capability `cap-std` in Rust.
- [x] Root canonica macOS; controllo per componenti, traversal e percorsi esterni; link interni, esterni, rotti e ciclici rifiutati.
- [x] Manifest validato conservato e consumato senza rilettura; regressione nativa sulla sostituzione del file.
- [x] File obbligatori regolari e leggibili; errori di accesso propagati; conteggi dalla stessa scansione, senza duplicazioni.
- [x] Schema manifest e frontmatter TS/Rust allineati; parser YAML reale, date stringa, CRLF, liste, annidamenti e documenti malformati coperti dalle fixture.
- [x] Stati NO_VAULT / NOT_ACCESSIBLE / INCOMPLETE / INVALID / READY; integrità SHA-256 sempre UNVERIFIED in M2.
- [x] Template caricato prima di modificare la destinazione; creazione esclusiva delle 15 cartelle e dei tre file, manifest finalizzato prima della scrittura.
- [x] Zero-overwrite e doppia creazione concorrente verificati; errori parziali non cancellano contenuti.
- [x] Sola lettura verificata sull’intero albero: contenuti, elenco, mtime e ctime. Atime dipende dal filesystem.

### UI, IPC e Obsidian

Le prove dell’11 settembre sono state integrate dalle regressioni M2/M3 del 12 settembre: adapter e protezioni ripristinati, percorso hardcoded eliminato, conteggi live indipendenti dagli archivi.

- [x] Adapter IPC realmente usato dalla UI; contratti, argomenti, errori, blocco concorrenza e recupero dopo errore testati.
- [x] Protezione UI da doppie operazioni e risposte obsolete; conteggi e READY reali; stile preservato.
- [x] Browser senza Tauri: messaggio esplicito e nessuna creazione su disco, provato nell’interfaccia.
- [x] Rilevamento Obsidian nelle installazioni globale/utente; nessun percorso utente hardcoded nel resolver.
- [x] Vault non registrato: apertura selettore Obsidian e istruzione iniziale; Vault registrato: apertura diretta verificata nell’app ricevente.

### Test e accettazione conclusi

- [x] `pnpm test`: suite core originaria, regressioni M2, adapter desktop, snapshot TS e guardie; exit 0.
- [x] `pnpm typecheck` e `pnpm build`: exit 0, eseguiti in sequenza dopo i test.
- [x] `cargo test --locked`: 5 test lib e 8 test bin passati (5 casi condivisi eseguiti in entrambi); nessuno ignorato.
- [x] Parità eseguibile TS/Rust: 10 fixture YAML, 7 errori filesystem, percorso assente, stati/conteggi/nome/integrità e sola lettura; exit 0.
- [x] `tauri build --bundles app`: exit 0; risorse incorporate senza fallback al checkout.
- [x] App avviata tramite LaunchServices fuori checkout; banco QA con rete e lettura checkout negate, PATH `/usr/bin:/bin`, server Vite fermo.
- [x] CREATE e riapertura di `Offline Vault`: READY, 15 cartelle, 2 pagine, 0 fonti, 0 proposte, UNVERIFIED.
- [x] UI: percorso inesistente, manifest corrotto e cartella mancante rifiutati; CREATE su destinazione occupata rifiutato e hash originali invariati.
- [x] Obsidian 1.13.7: selezione iniziale del Vault temporaneo e successiva apertura diretta del Vault corretto.
- [x] Manuale, TODO, roadmap, piano e handover allineati alle prove.
- [x] **M2 completata in locale; nessun criterio M2 residuo.**

La creazione non è una transazione atomica dell’intero albero: un errore può lasciare file parziali, senza cancellazioni automatiche. Le prove coprono macOS ARM64; altre piattaforme non sono certificate. Firma/notarizzazione/distribuzione restano M9, non sono requisiti di chiusura M2.

## M3 — COMPLETATA E VERIFICATA IN LOCALE

- [x] Normalizzazione percorsi ed esclusione esatta SNAPSHOTS; nessuna ricorsione, conteggi M2 corretti.
- [x] Accessi TS/Rust per componenti e directory aperte; symlink/file speciali rifiutati, errori propagati.
- [x] Schema, identità, percorsi, duplicati, hash e dimensioni verificati nei manifest.
- [x] Copia in staging esclusivo; verifica dei file salvati; pubblicazione atomica senza overwrite.
- [x] Rollback su errori gestiti di copia/manifest/pubblicazione; snapshot precedenti preservati; staging da arresto forzato escluso dall’elenco.
- [x] Elenco e verifica snapshot reali: corrotti, mancanti e aggiunti rilevati, nessun VERIFIED dal solo parsing JSON.
- [x] Adapter IPC M2/M3, contratti, concorrenza e risposte obsolete; errori visibili, verifiche incomplete UNVERIFIED.
- [x] UI esistente preservata; aggiunto RECHECK INTEGRITY, lavori nativi SHA/copia fuori dal thread UI.
- [x] Cargo.lock aggiornato; test Rust 10 lib + 13 bin passati (10 condivisi), nessuno ignorato.
- [x] Suite TS originarie e nuove regressioni, adapter e guardie passati; typecheck/build monorepo exit 0.
- [x] Parità M2 e scenari E2E nativi M3 passati: processi nuovi, TS/Rust, corruzione, permessi, link, collisioni e quattro creazioni concorrenti.
- [x] Bundle Tauri finale compilato; browser rifiuta filesystem, app offline fuori checkout e senza Node crea e riapre snapshot veri.
- [x] E2E UI: VERIFIED iniziale, snapshot persistente, CORRUPTED dopo alterazione archivio, DISCREPANCY sul Vault, UNVERIFIED su errore lettura, recupero dopo errore.
- [x] Manuale, evidenze, checklist e handover allineati.
- [x] **M3 chiusa in locale. Nessun criterio residuo, nessuna pubblicazione.**

Limiti: pubblicazione atomica della copia, non cattura istantanea del filesystem né garanzia contro perdita alimentazione. Un arresto forzato può lasciare staging nascosto. SHA-256 confronta file con il manifest locale, senza autenticazione crittografica del manifest. Prove su macOS ARM64. Dettagli e walkthrough nel rapporto E2E.

## M4 — COMPLETATA E VERIFICATA IN LOCALE (12 settembre 2026)

- [x] Compilatore deterministico TS/Rust e IPC nativi, formati Markdown/TXT/HTML.
- [x] RAW in sola lettura; accessi ancorati a directory, symlink rifiutati; output solo in 90_PROPOSALS.
- [x] Revisioni nuove senza overwrite, nomi senza collisioni da basename, bozze umane preservate e deduplica fonti invariate.
- [x] Indice validato, lock condiviso tra runtime, sostituzione atomica e rollback errori gestiti.
- [x] SHA-256 completo e first_compiled_at con semantica corretta; migrazione indice legacy.
- [x] Parità estrazione TS/Rust, frontmatter serializzato/validato e draft esplicito.
- [x] Risultati batch per fonte, continuazione dopo errori individuali.
- [x] Sources e Refresh Sources; Proposals con elenco revisioni e anteprima Markdown in testo sicuro.
- [x] Regressioni TS 7/7, test Rust 13 lib + 16 bin (13 condivisi), parità/E2E M2-M3-M4 passati.
- [x] pnpm test, typecheck, build e build Tauri macOS passati sul codice finale.
- [x] UI offline: singolo/batch, anteprima, riavvio/persistenza, nuova revisione senza perdita edit umano, ripetizione 0 compilate/2 invariate.
- [x] Verificati su fixture hash fonti e bozza umana, manifest invariato e assenza di scritture nelle cartelle approvate.
- [x] M4 chiusa in locale; nessun commit/push/deploy.

Evidenze e limiti: `IMPLEMENTATION/2026-09-12_M4_CLOSURE.md`. Kill/spegnimento possono richiedere recupero manuale del lock; niente promesse di transazione hardware tra bozza e indice. Firma/notarizzazione restano M9.

## M5 — COMPLETATA E VERIFICATA IN LOCALE

- [x] Sola lettura note: accessi sicuri TS/Rust, symlink rifiutati, nessun overwrite tramite indice.
- [x] Indice v2 compatibile, validazione, lock condiviso e pubblicazione atomica; errori espliciti.
- [x] Frontmatter e filtri cliente/progetto/tag/stato reali e allineati.
- [x] Unicode, accenti, TF-IDF, snippet e paginazione coerenti TS/Rust.
- [x] ID senza collisioni da basename; hash fonti e rilevamento risultati obsoleti.
- [x] UI completa, debounce, query concorrenti e risposte obsolete gestite.
- [x] Test ricerca TS 5/5; suite monorepo, typecheck e build passati sulla baseline M5.
- [x] Rust 15 lib + 18 bin (15 casi condivisi), E2E parità M5 e regressioni M2–M4 passati.
- [x] Bundle Tauri release compilato; UI offline con accenti, emoji e filtri combinati verificata.
- [x] Riavvio senza reindicizzazione: 4 risultati persistenti; 8 file originali invariati e solo indice aggiunto.
- [x] M5 chiusa in locale; nessuna pubblicazione.

Evidenze e limiti: `IMPLEMENTATION/2026-09-12_M5_CLOSURE.md` e `IMPLEMENTATION/M5_EVIDENCE/`. Le aggiunte concorrenti M6 di AG restano da verificare separatamente.

## M6REV — AI interna + ChatGPT Business/Codex esterni

Piano revisionato: [IMP_PLAN_M6REV.MD](IMPL_PLANS/IMP_PLAN_M6REV.MD). Stato: completata e verificata in locale. Tre canali reali superati; revoca Business eseguita. Rapporto: IMPLEMENTATION/2026-09-12_M6_CLOSURE.md. Nessun commit/push/deploy.

- [x] Presenza verificata di contratti, context-selector, openai-adapter, mcp-service e test dedicati; non equivale a integrazione funzionante.
- [x] Sostituito lo script test segnaposto: regressioni AI reali, provider simulato solo nei test unitari dichiarati.
- [x] Piano M6REV salvato: API interne, MCP ChatGPT Business e accesso locale Codex sono tre criteri distinti.

### M6.1 — Contratti, ricerca M5 e politica comune di accesso
- [x] Estesi contratti AI e collegata selezione contesto a M5; approvazione esplicita, hash e budget verificati nei test locali.
- [x] Implementati selettore e accesso nativo alle fonti; budget conservativo in byte, nessuna stima spacciata per consumo reale.
- [x] Applicare politica di sola lettura: escludere credenziali, `.env`, snapshot e percorsi esterni al Vault.

### M6.2 — AI dentro LIMEN tramite API (Ask Knowledge)
- [x] Gestione credenziali nel Portachiavi macOS implementata; salvataggio verificato nella UI. Nuova chiave verificata: API reale passata.
- [x] Adapter Responses API TS/Rust con modello esplicito, endpoint fisso HTTPS, citazioni strutturate e niente fallback inventato. E2E API reale passato con citazione e hash verificati.
- [x] Ask Knowledge integrata: risposta API reale corretta, fonte approvata e hash aperti nella UI; 393 token riportati dal provider.
- [x] Gestire timeout, annullamento, credenziali mancanti ed errori di rete con fallback offline pulito.

### M6.3 — ChatGPT Business tramite MCP
- [x] Servizio MCP implementato: riferimento TS e trasporti nativi Rust HTTP/stdio, `list_vaults`, `search_vault`, `read_document`.
- [x] Strumenti MCP locali collegati con autenticazione HTTP, isolamento Vault e revoca; verificati nei test nativi.
- [x] Completare trasporto Business: tunnel privato creato e associato al workspace, client ufficiale installato; nuova chiave corrispondente verificata, tunnel ready e plugin Business connesso con tre strumenti READ. Risposta reale corretta con fonte/hash; fixture invariata. Tunnel fermato e plugin disconnesso dopo prova interruzione.

### M6.4 — Codex locale tramite MCP
- [x] E2E Codex reale su fixture tramite eseguibile MCP stdio: list/search/read, risposta con percorso/hash corretti; CLI read-only con shell disabilitata. Client reale su debug; successivo E2E protocollo sul bundle release passato, incluso indice con approvazione falsificata.
- [x] Servizio rifiuta strumenti di scrittura nei test protocollo; client Codex reale eseguito con profilo read-only e shell disabilitata.

### M6.5 — Protezioni condivise e verifiche E2E
- [x] Fonti isolate come dati non fidati, limiti e assenza strumenti di scrittura verificati; nessuna garanzia assoluta di correttezza delle risposte.
- [x] Test AI TS 8/8 passati; Rust 22 lib + 18 bin passati (comprendono casi condivisi duplicati); bundle e regressioni native M2–M5 passati.
- [x] Verificare le 3 modalità E2E (API in-app, ChatGPT Business MCP, Codex locale MCP) separatamente.
- [x] Verificare l'invariante di sola lettura: zero modifiche ai note del Vault durante l'uso di M6.
- [x] **M6REV completata in locale con criteri di accettazione dei 3 canali verificati.**

## M7 — Output AI e proposte: completata e verificata in locale

Piano: [IMP_PLAN_M7REV.MD](IMPL_PLANS/IMP_PLAN_M7REV.MD). Audit Codex del 12 settembre: chiusura AG non confermata; handoff dello stesso AG elenca IPC/Rust/UI ancora da implementare.

- [x] Moduli TypeScript output/proposte presenti; script test reale abilitato da Codex (prima era echo).
- [x] Sei test TS passati, typecheck/build del package passati. Due regressioni riprodotte prima della correzione: destinazioni RAW/decisioni non valide e reset silenzioso indice corrotto.
- [x] Corrette categorie packaging/research, confinamento destinazione, obbligo hash/revisione/decisione corrente e rifiuto indice corrotto.
- [x] E2E nativo: revisioni conservate, idempotenza, SIGKILL a tre confini, processi concorrenti; due approvazioni concorrenti pubblicano un solo file. Destinazione senza permessi conserva la bozza e recupera esplicitamente. Log: IMPLEMENTATION/M7_EVIDENCE/native-e2e.log.
- [x] Implementati servizi Rust/IPC v2: revisioni immutabili, lock di processo, journal e recupero esplicito. Test nativi e E2E con SIGKILL a tre confini di persistenza passati.
- [x] Collegati Ask Knowledge, AI Outputs, import M4 e revisione/approvazione tramite contratto TS v2; flusso UI verificato nel bundle firmato.
- [x] E2E UI firmata: risposta API reale, salvataggio, riavvio offline, revisione 2, approvazione, ricerca Approved; import/approvazione M4 e RAW immutabili. Evidenze M9_EVIDENCE/m7-ui-offline.json.
- [x] **M7 completata in locale con tutti i criteri verificati.** Evidenze e limiti: IMPLEMENTATION/2026-09-12_M7_CLOSURE.md.

## M8REV — Fallback indipendente: completata in locale

Piano: [IMP_PLAN_M8REV.MD](IMPL_PLANS/IMP_PLAN_M8REV.MD). Rapporto corrente: IMPLEMENTATION/2026-09-12_M8_CLOSURE_E2E.md (chiusura Codex basata su prove native e GUI). Originali AG conservati in IMPLEMENTATION/M8_EVIDENCE/.

- [x] Sostituito benchmark con sole echo mediante banco nativo reale; uscita 2 per accettazione incompleta, uscita 1 per failure. Evidenze conservate.
- [x] Bundle/harness copiati fuori checkout e identificati con hash/inventario; rete, lettura checkout e Node negati e verificati con probe.
- [x] Operazioni native offline: creazione/apertura, compilazione RAW, ricerca/indice, snapshot e verifica integrità passati.
- [x] Nuovi processi recuperano stato persistente; inventario completo invariato nelle letture.
- [x] Indice corrotto/mancante, symlink/traversal, permessi, snapshot alterato e lock/staging preesistenti verificati; bundle release MCP stdio provato offline.
- [x] Flussi GUI fuori checkout: M7, compilazione, ricerca, snapshot ed errore API passati. Knowledge corretto e provato senza indice e con rete negata: M9_EVIDENCE/knowledge-ui-offline.json.
- [x] Workflow M7 offline e persistenza dopo riavvio provati dalla UI: M9_EVIDENCE/m7-ui-offline.json.
- [x] CANCEL su richiesta API reale e revoca endpoint MCP dalla UI: endpoint prima risponde 401 senza token, dopo revoca rifiuta la connessione; Knowledge rimane utilizzabile. M9_EVIDENCE/installed-online-ui.json.
- [x] Connessione TLS verso OpenAI realmente interrotta durante richiesta: errore circoscritto, UI Knowledge reattiva, inventario Vault invariato; M8_EVIDENCE/network-interruption-ui.json.
- [x] SIGKILL reale e recupero a tre confini nel banco nativo; Obsidian installato ha aperto la nota locale m8-reviewed con contenuto e proprietà corretti. Obsidian non era sotto sandbox di rete: limite registrato.
- [x] Suite finali e matrice del prodotto M2–M7 completo con evidenze consolidate nel rapporto di chiusura.
- [x] **M8REV completata in locale.** Isolamento rete provato su LIMEN; lettura Obsidian provata, isolamento del processo Obsidian non certificato.

## M9REV — Release macOS: completata e verificata in locale

Piano: [IMP_PLAN_M9REV.MD](IMPL_PLANS/IMP_PLAN_M9REV.MD). Stato: app/DMG finali notarizzati, Gatekeeper PASS; API/Codex/Business verificati. Collaudo Guest manuale confermato dall’utente: app avviata, nuovo Vault READY.

- [x] Redatto M9REV e verificata coerenza con configurazione Tauri, M6 e piano M8; consultata documentazione ufficiale firma/notarizzazione/updater.
- [x] Identità Developer ID Application presente; profilo Portachiavi LIMEN-M9 validato tramite servizio Apple (history riuscito). Nessun segreto esportato.
- [x] M9.1: baseline M7/M8 accettata; 0.1.0, minimo macOS 26.3 ARM64 e prerequisiti Apple verificati.
- [x] Ausiliari tunnel versionati, SHA-256 verificato, licenze e inventario inclusi. Script firma/DMG/notarizzazione preparato e sintassi verificata.
- [x] CSP configurata e UI verificata nel candidato macOS 26.3 ARM64, unico ambiente disponibile. Harness vault-check escluso dal pacchetto firmato.
- [x] M9.2: app e DMG candidato Apple Silicon prodotti con risorse complete, harness escluso; montaggio read-only e confronto inventario esatto PASS. Artefatto NOT-NOTARIZED, non distribuibile.
- [x] API reale e Codex MCP dalla copia in ~/Applications: PASS; credenziale API utilizzabile dal bundle firmato.
- [x] Tunnel installato: chiave separata Portachiavi autorizzata, readiness locale, STOP elimina realmente tunnel e processo MCP figlio; restart riuscito. Evidenza tunnel-local-ui.json. Lettura Business remota PASS in Safari: data/frase/percorso/hash identici alla fixture, inventario invariato; business-installed-read.json. Nuova chiamata dopo STOP: HTTP 504 MCP request timed out, nessun dato nuovo; timeout remoto 2m8s, stop locale immediato.
- [x] M9.3: API/Codex/Business verificati dall’installazione; credenziali Portachiavi, readiness, stop/restart e uscita app con figli assenti verificati. Nuova chiamata Business dopo stop: HTTP504 senza nuovi dati.
- [x] M9.4: app Accepted (87834a15-bd33-4962-b276-dcd31829a2e7), DMG Accepted (6d3af9a1-ceba-425e-894b-6d5194960dbe), stapling/validate e Gatekeeper PASS. Copia ottenuta via HTTP locale con quarantena aggiunta per il test: ticket e Gatekeeper PASS; final-install.json.
- [x] Banco APFS: copia esatta, ENOSPC reale, SIGKILL copia, sostituzione/rollback stessa versione e rimozione app preservano il Vault. M9_EVIDENCE/install-bank.json.
- [x] M9.5: installazione Guest e nuovo Vault READY confermati dall’utente; update/recupero/disinstallazione e conservazione dati verificati nel banco APFS. Provenienza e limiti nel rapporto M9.
- [x] Matrice finale superata: IMPLEMENTATION/2026-09-12_M9_CLOSURE.md; test Guest manuale dell’utente distinto dalle prove strumentali.
- [x] Manuale, note di release, hash DMG, inventario/licenze e rapporto disponibili. Copia del pacchetto finale in /Users/Shared/LIMEN-M9/.
- [x] **M9 completata e verificata in locale**, firma/notarizzazione/Gatekeeper e Guest inclusi.
- [ ] Pubblicazione separata, soltanto con incarico esplicito; registrare versione, destinazione e hash scaricato.

## M10 — codice e banco R2 completati in parte; integrazione operativa in corso

- [x] Bucket scelto: `m3mai-core-vault` su Cloudflare R2, namespace `limen/`; nessun nuovo bucket o migrazione dati preesistenti.
- [x] Correzioni TS: lock flock reale, categorie esatte, hash JSON, limiti contesto e verifica oggetti.
- [x] Recupero TS: staging vuoto, scritture descriptor-relative esclusive, rifiuto symlink/collisioni, verifica prima di import, validazione Vault e rename senza overwrite. Suite sync-engine 13/13 PASS.
- [x] Implementato servizio opzionale `services/vault-sync-api`: grant con scadenza, autorizzazione tenant/Vault/canale, oggetti immutabili, verifica server, CAS, idempotenza e revoca. Cinque test protocollo PASS.
- [x] Implementati e registrati i comandi Rust M10, Portachiavi separato, cattura dei byte, piano persistente, retry limitati e ripresa. Test Rust 38 lib + 18 main PASS; candidato Tauri compilato.
- [x] UI: collegamento amministrativo con codice, anteprima, operazioni esplicite, annullamento, ripresa e percorso della copia. Prova nativa: creazione Vault READY e cloud NOT_CONFIGURED senza bloccare il locale.
- [x] R2 reale con dati sintetici: upload/download, commit idempotente, CAS concorrente con un vincitore, revoca e recupero di Vault privato valido READY. Evidenza: IMPLEMENTATION/M10_EVIDENCE/r2-protocol.json. Gateway eseguito localmente con adapter S3 reale: non equivale a Worker pubblicato o secondo Mac.
- [x] CRM: guard/allowlist, verifica hash, controllo release durante lettura, contesto prima della richiesta AI; correzione direttiva use server. Typecheck e build completa PASS.
- [x] Verifiche monorepo: pnpm test, pnpm typecheck, pnpm build PASS; controlli mirati ripetuti dopo le modifiche interessate.
- [x] Documentati protocollo e recupero: docs/SYNC_PROTOCOL.md, docs/SYNC_RECOVERY.md.
- [x] Worker pubblicato: https://limen-vault-sync.cesare-negro.workers.dev, binding m3mai-core-vault, grant di collaudo con scadenza. Upload/import dalla UI nativa riusciti, tre file identici: M10_EVIDENCE/native-live-transfer.json. Nessuna migrazione di oggetti preesistenti.
- [x] Desktop → Worker → R2: upload/import PASS; selezione di una nota su due verificata sul manifest remoto; SIGKILL durante upload e ripresa stessa operationId con sorgenti invariati PASS.
- [x] Protocollo Worker su HTTPS/R2 reale: 14 scenari PASS (auth, hash, CAS, history, revoca).
- [x] CRM autenticato con Superadmin attivo: sette verifiche API PASS su autenticazione Supabase e R2 reali, compresa lettura della nota selezionata dalla UI desktop. CRM eseguito in locale.
- [x] CRM pubblicato su pii-crm.vercel.app: build e deployment Vercel PASS; nessun commit/push.
- [x] Correzione storage CRM pubblicata e verificata: destinazione dedicata m3mai-core-vault, allowlist Admin/Superadmin + guard staff, catalogo con selettore CRM/MEMAI e LIMEN. Sette test PASS, typecheck/build PASS; API produzione autenticata NO_PUBLICATION, anonimo 403; Safari catalogo PASS. Evidenza crm-storage-production.json.
- [ ] Mapping Cliente/Progetto con contenuti reali da collaudare: Vault predefinito vuoto, nessuna nota reale pubblicata.
- [x] Audit storage completato: IMPLEMENTATION/STORAGE_AUDIT_2026-09-13.md; catalogo materials distinto dal contenuto del bucket MEMAI.
- [x] DMG finale consegnato in /Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/LIMEN-Vault-0.2.0-arm64.dmg; hash e ticket verificati.
- [x] Installer nativo LIMEN + Obsidian firmato/notarizzato e consegnato in USER INSTALL/Installa-LIMEN-Vault-0.2.0-arm64.dmg. Test isolati assente/presente, DMG finale, Gatekeeper, UI un clic e avvio app/Vault READY PASS. Requisiti Apple Silicon/macOS 26.3. Evidenze installer/.
- [x] Catalogo MEMAI diretto pubblicato nel CRM: 21 documenti reali elencati, anteprima documento fittizio MERAVIA PASS; 11 test totali PASS, typecheck/build PASS. Nessuna duplicazione di file.
- [x] MEMAI Render runtime verificato: STORAGE_TYPE=s3, bucket m3mai-core-vault, endpoint Cloudflare. Nessuna modifica storage.
- [x] Diagnosi MEMAI approfondita in sola lettura: Render mostra `m3mai-reconcile` ogni ora e ultima esecuzione riuscita il 13 settembre alle 20:00 CEST; manifest ogni 10 minuti, monitor locale con soglia 20 minuti. Evidenze e limiti: IMPLEMENTATION/2026-09-13_MEMAI_HEALTH_DIAGNOSIS.md.
- [ ] Allineare la frequenza cron in produzione previa autorizzazione specifica, quindi verificare heartbeat e salute oltre 20 minuti. Intervallo effettivo del monitor runtime ancora da leggere; nessuna manutenzione o rielaborazione avviata.
- [x] SIGKILL e ENOSPC reali sulla app: sorgenti invariati, ripresa stessa operazione, import completo con 17 file identici. Evidenze native-kill-recovery.json e native-enospc.json.
- [x] Ripresa dopo rename: ricevuta e hash impediscono sovrascritture; test Rust PASS.
- [x] UI 0.2.0: ritiro della pubblicazione sintetica confermato e completato; comandi e stato TRANSFERRING presenti.
- [x] Installazione finale dal DMG fuori checkout: Gatekeeper accettato, app 0.2.0 avviata e Vault READY, download IMPORTED. UI live osservata: 9/17 file, 2051 KB verificati.
- [ ] Secondo Mac non disponibile secondo utente: prova sullo stesso Mac registrata come tale; requisito secondo dispositivo non certificato.
- [x] Primo candidato 0.2.0 firmato/notarizzato, app e DMG Accepted; M9 congelata preservata.
- [x] Candidato finale: build, firma e notarizzazione app Accepted (d507ac22-ad50-4ca4-bd71-49a9fdac8937).
- [x] Consegna M10 precedente: DMG firmato/notarizzato e ticket verificato, staple app allora non ripetuto dopo tre errori. Sostituita dalla consegna italiana: nuova app e due DMG Accepted/stapled/Gatekeeper PASS (UI_IT_EVIDENCE/notarized). Resta non certificata l’apertura offline in account vergine.

**M10: implementazione, CRM e installer pubblicati/consegnati. Restano collaudo con note reali e mapping Cliente/Progetto, secondo Mac e prova offline in account pulito. Non certificare criteri non eseguiti.**

## Ordine operativo e dipendenze

1. M2–M9 completate in locale; conservare artefatti ed evidenze della release notarizzata.
2. Priorità attuale: risolvere discrepanza frequenza cron MEMAI dopo lettura intervallo runtime e autorizzazione della modifica produzione. M10 resta aperta per i collaudi elencati.
3. Worker e CRM già pubblicati; ulteriori modifiche di produzione richiedono autorizzazione nella destinazione concreta. Nessuna migrazione richiesta.

Blocchi e dipendenze: TODO LIST.TXT.

## Evidenze e storico

- Evidenze correnti M10: `IMPLEMENTATION/M10_EVIDENCE/`; diagnosi MEMAI: `IMPLEMENTATION/2026-09-13_MEMAI_HEALTH_DIAGNOSIS.md`.
- Handover corrente: `SESSION HANDOVER.MD`; storico separato in `LAST SESSION/`.
- Riproduzione automatica nativa: `scripts/m5-native-check.sh`.
- Audit precedenti conservati come storico; non rappresentano lo stato operativo corrente.
- Modifiche preesistenti conservate. Nessun commit/push/deploy in questa lavorazione; build italiana installata in locale. Deployment CRM precedente registrato in M10.

