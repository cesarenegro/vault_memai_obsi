# M2 — COMPLETATA E VERIFICATA IN LOCALE

Aggiornata: 11 settembre 2026. Nessuna pubblicazione.

Checklist principale: [TASK_LIST.md](../TASK_LIST.md).
Rapporto: [verifica M2](../IMPLEMENTATION/2026-09-11_M2_NATIVE_VALIDATION.md).

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
