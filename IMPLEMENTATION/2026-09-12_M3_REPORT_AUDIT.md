# Audit del resoconto M3 — 12 settembre 2026

Esito: M3 NON COMPLETATA. Codice Rust e collegamento UI presenti, ma accettazione fallita. Audit mirato, nessuna modifica applicativa o al Cargo.lock del progetto. Le prove M2 dell’11 settembre restano storiche: App.tsx è stata successivamente riscritta e contiene regressioni.

## Prove effettive

1. `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml test_rust_snapshot_creation_and_integrity -- --nocapture`: exit 101, Cargo.lock necessita aggiornamento; nessun test eseguito in questo comando.
2. Copia identica di snapshots.rs in `.local/m3-audit/lib.rs`, crate indipendente con le dipendenze dichiarate, risolte offline: `cargo test --offline --manifest-path .local/m3-audit/Cargo.toml -- --nocapture`: exit 101, 0 passati / 1 fallito. `test_rust_snapshot_creation_and_integrity` fallisce alla riga 413: atteso is_integrity_valid=true, ottenuto false. Il test inoltre crea VAULT_RULES.md senza includerlo nel manifest: anche la fixture richiede coerenza con la politica added-files.
3. Sonda indipendente sullo stesso modulo: un HOME con hash corretto ha verified_files_count=1 ma added_files include `./00_SYSTEM/HOME.md` e `./00_SYSTEM/VAULT_MANIFEST.json`. Un elenco con snapshot_manifest.json pari a `{}` restituisce integrity_status=valid. Path::new(".").join("00_SYSTEM/SNAPSHOTS") produce `./00_SYSTEM/SNAPSHOTS`.

## Difetti da correggere

- P1: snapshots.rs 140–167 e 222–271: prefisso ./ nei percorsi rispetto a chiavi/esclusioni senza prefisso. Falsi added-files e mancata esclusione SNAPSHOTS nella copia: la destinazione viene attraversata dalla copia stessa. Quest’ultimo effetto è dedotto direttamente dal flusso del codice; non avviata una copia ricorsiva incontrollata.
- P1: snapshots.rs 185–206 e list_snapshots: operazioni std::fs su percorsi ambienti per creazione, cancellazione e lettura; non protette dalla capability root, possono seguire un SNAPSHOTS symlink esterno. Non effettuata prova di scrittura esterna.
- P1: snapshots.rs 316–353 e App.tsx 781–782: lo stato valid/VERIFIED deriva dal solo parsing JSON, senza schema completo né verifica hash dei file salvati. Riprodotto con manifest vuoto.
- P1: snapshots.rs 196–200 e 266–308: exists+create_dir_all non è prenotazione esclusiva; nessuna pubblicazione tramite staging+rename. Cleanup solo su alcuni errori, assente sui fallimenti di scrittura del manifest e non garantito in caso di arresto processo. La dichiarazione di atomicità/rollback generale non è supportata.
- P1: App.tsx 117–151 e handler: rimossi adapter IPC usato da M2 e protezioni useRef/risposte obsolete; reintrodotto percorso /Users/cesare/Documents/VAULT e catch vuoto sul refresh, che nasconde gli errori. I test dell’adapter non certificano più il percorso UI attuale.
- P2: manifest Rust parzialmente validato, errori di scansione ignorati con if let Ok / flatten; occorrono schema e propagazione errori coerenti con TS.

## Accettazione residua

Correggere difetti e fixture senza indebolire asserzioni; aggiornare lockfile; eseguire test Rust nel progetto, regressioni sicurezza/concorrenza, parità TS/Rust e prove di corruzione snapshot. Riconvalidare M2 dopo ripristino delle protezioni UI. Poi build Tauri e prova di creazione/riapertura offline nell’app compilata. pnpm test/typecheck/build riportati da AG non sono rieseguiti da questo audit e non provano il runtime Rust.

## Walkthrough dopo le correzioni

Usare esclusivamente un Vault temporaneo. Aprirlo nell’app compilata, andare in Snapshots, creare uno snapshot con nota e verificare che termini senza SNAPSHOTS annidati. Chiudere e riaprire l’app: lo snapshot deve restare visibile. Modificare un file nella sola copia snapshot e rieseguire la verifica prevista: deve risultare corrotto, mai VERIFIED. Se fallisce, acquisire stato UI, messaggio di errore e manifest di test. Questo walkthrough è un criterio futuro, non una prova UI eseguita oggi.

Nessun commit, push o deploy. Nessuna correzione del codice autorizzata/eseguita in questo audit.
