# M2 — chiusura verificata in locale

Data: 11 settembre 2026. **M2 COMPLETATA IN LOCALE.** Nessun commit, push, deploy o pubblicazione effettuato. La checklist corrente è `../TASK_LIST.md`; il piano storico è `m2_refinement_plan.md`.

## Risultato

L’app macOS crea, apre e valida il Vault tramite IPC e runtime Rust, con template incorporato e senza Node nella WebView. Il core TypeScript usa directory aperte tramite openat/O_NOFOLLOW (koffi); Rust usa cap-std e handle. I symlink discendenti sono rifiutati. Il manifest validato viene conservato; file, tipi, permessi, frontmatter e conteggi appartengono alla stessa scansione. Creazione esclusiva senza riscrittura successiva del manifest; template verificato prima delle scritture; nessuna cancellazione automatica su errore.

L’adapter IPC usato da App.tsx valida le risposte, rifiuta richieste concorrenti e gestisce il browser senza Tauri. La UI protegge da risposte obsolete. Il confronto dei blocchi inline style con la baseline è identico; CSS/layout approvati conservati. Le icone mancanti per il bundle derivano dalla stessa L approvata.

## Verifiche automatiche

| Verifica | Esito effettivo |
| --- | --- |
| pnpm test | Exit 0: 11 scenari core originari, regressioni M2, 3 scenari desktop originari più adapter reale, snapshot TS e guardie |
| pnpm typecheck | Exit 0 su 10 workspace |
| pnpm build | Exit 0: pacchetti, Next.js e Vite |
| cargo test --locked | Exit 0: 5 test lib e 8 test bin; 5 casi condivisi eseguiti in entrambi, nessuno ignorato |
| test:native-parity | Exit 0: 10 fixture YAML, 7 errori filesystem, root assente e invariante read-only dell’albero |
| tauri build --bundles app | Exit 0, bundle macOS prodotto |

La parità confronta risultati eseguiti realmente nei due runtime: stato, nome, snapshot id, integrità, conteggi file/cartelle/pagine e validità. Gli errori testati includono permessi, manifest invalido, directory al posto di file, cartella assente e link esterni/rotti/ciclici. Le regressioni verificano template mancante prima della creazione, destinazione occupata, concorrenza di creazione, manifest sostituito senza rilettura e directory TS già aperta durante sostituzione.

Log della verifica finale in `M2_EVIDENCE/node-tests.log`, `typecheck.log`, `build.log`, `native-test-build.log`. Dopo l’ultima correzione del solo valore integrityStatus TS e l’estensione dei confronti nome/integrità, test e parità sono stati rieseguiti con exit 0; typecheck e build finali eseguiti in sequenza con exit 0. Riproduzione nativa: `../scripts/m2-native-check.sh`.

## Prova UI e app standalone

Bundle originale: `apps/desktop/src-tauri/target/release/bundle/macos/LIMEN Vault.app` (dal repository). Copia QA: `/private/tmp/limen-m2-standalone-ctiat0cj/LIMEN Vault.app`.

Prima prova normale tramite LaunchServices: CREATE NEW VAULT ha creato `Vault di prova`, con 15 cartelle, tre file di sistema e READY. Browser Vite: CREATE ha mostrato Native Tauri IPC runtime required e la directory richiesta non è stata creata.

Prova offline finale: nella sola copia QA, un launcher C avvia il binario applicativo sotto sandbox-exec, con PATH `/usr/bin:/bin`, cwd fuori checkout, `(deny network*)` e lettura del checkout negata. La copia QA è rifirmata ad-hoc per il launcher; l’app distribuita nel target non contiene questo launcher. Il server Vite è stato fermato; nessun listener sulla porta 1420. `command -v node` con il medesimo PATH fallisce. La sonda connect restituisce EPERM (errno 1), e leggere package.json dal checkout restituisce Operation not permitted. Il profilo e il launcher effettivamente usati sono conservati in `M2_EVIDENCE/`; percorsi specifici di questa macchina, da adattare per una riproduzione altrove.

Interazioni effettuate nella UI nativa via CUA:

- OPEN di un percorso inesistente: errore leggibile, nessun READY.
- OPEN di `Corrupt Vault` con manifest `{}`: Invalid manifest.
- OPEN di `Incomplete Vault`: Missing required vault folder: 04_POSITIONING.
- CREATE di `Vault di prova` occupato: ALREADY_EXISTS; i tre hash dei file di sistema sono rimasti identici alla baseline.
- CREATE di `Offline Vault`: READY, 15 cartelle, 2 Knowledge Pages, 0 Raw Sources, 0 AI Proposals, UNVERIFIED.
- Chiusura e riavvio della copia isolata, OPEN dello stesso Offline Vault: medesimi stato e conteggi reali. Schermata READY acquisita nella conversazione.
- Open in Obsidian su Vault non registrato: selettore aperto e messaggio con percorso. Selezionata la sola cartella temporanea tramite Open folder as vault → Open.
- Nuovo clic su Open in Obsidian: nessun errore e finestra ricevente “New tab - Offline Vault - Obsidian 1.13.7”. Obsidian è un’app separata; il sandbox offline si applica a LIMEN, non all’istanza Obsidian preesistente.

Nessuna operazione di test eseguita sul Vault reale dell’utente. Obsidian ha registrato soltanto i Vault temporanei selezionati per queste prove.

Consegna finale: chiusa la copia QA, aperto il bundle originale del target e riaperto Offline Vault con READY e conteggi corretti.

## Problemi emersi e risolti durante l’implementazione

- Installazione Rust inizialmente interrotta per spazio disco, completata dopo recupero dello spazio; toolchain locale, nessuna modifica al profilo shell.
- ABI macOS ARM64 di readdir/openat: simbolo e firma variadica corretti; percorsi root macOS canonicalizzati.
- Fixture Rust e read_dir corretti; schema YAML/date e errori di lettura allineati.
- Parità inizialmente diversa per checkedFilesCount sui file illeggibili: ora il conteggio avviene dopo l’apertura riuscita.
- Obsidian rifiuta URI di Vault mai registrati: aggiunta gestione esplicita del primo utilizzo, senza modificare il registro dell’app.
- Avvio shell del banco QA non registrato in LaunchServices; sostituito con launcher QA. Il percorso /tmp dell’eseguibile era rifiutato dal resolver Tauri perché simbolico: il launcher usa /private/tmp canonico. Nessun fallback al checkout aggiunto al prodotto.

I test originari non sono stati indeboliti; le modifiche preesistenti, compreso snapshot-engine, sono state conservate.

## Limiti e consegna

M2 verifica la struttura, non checksum SHA-256: integrityStatus rimane UNVERIFIED. Una creazione interrotta può lasciare contenuti parziali; non è una transazione atomica dell’intero albero. Le prove sono su macOS ARM64 e non certificano altri sistemi o ogni possibile condizione di concorrenza. M3 desktop resta simulata; M4–M9 non sono implementate da questa sessione. Firma Developer ID, notarizzazione e distribuzione appartengono a M9.

Baseline iniziale main / 0f6e3f1 con working tree già modificato; diff e sorgenti iniziali in `.local/m2-baseline`. Rust/Cargo 1.98.1 in `.local`, Obsidian 1.13.7 in `~/Applications`. Nessun criterio M2 residuo.

Fonti tecniche consultate durante implementazione: https://docs.rs/cap-std/latest/cap_std/fs/struct.Dir.html ; https://koffi.dev/load ; https://koffi.dev/values ; header dirent.h del SDK Xcode locale ; https://v2.tauri.app/develop/resources/ ; https://rust-lang.org/tools/install/ .
