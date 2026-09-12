# Implementation Plan — M2 Core Security Hardening & Real Desktop UI Integration

Data: 11 settembre 2026. Stato: **IMPLEMENTATO E VERIFICATO IN LOCALE**. Questo documento conserva piano e baseline storici; esiti finali in `2026-09-11_M2_NATIVE_VALIDATION.md` e checklist corrente in `../TASK_LIST.md`. Nessun criterio M2 residuo; nessuna pubblicazione.

## Obiettivo e confini
Risolvere i dieci rilievi dell’audit M2 e dimostrare creazione, apertura e validazione del Vault nell’app macOS installata. Preservare palette, CSS, layout e icone approvati. Nessun avanzamento M3/M4, commit, push, deploy, modifica database o modifica del Vault reale durante lo sviluppo. Usare fixture temporanee. Checklist principale: TASK_LIST.md; blocchi: TODO LIST.TXT.

## Baseline verificata e prerequisiti
Branch main, HEAD 0f6e3f1 al momento della pianificazione. Checkout già modificato da altre attività, incluse M3 e documentazione: nessun reset o ripristino globale. Prima di implementare acquisire diff e impronte dei file interessati; concordare/escludere scritture concorrenti sugli stessi file. Se cambiano durante una fase, riesaminare i delta prima di scrivere.
Rust/Cargo non risolti da command -v nella sessione. L’audit precedente ha ottenuto 8/8 test core verdi, suite generale rossa nel test M3, guardie verdi, build frontend verde e typecheck verde dopo build. Sono risultati storici: NON attestano lo stato corrente. Nuovi handover dichiarano M3 completata, ma questa sessione non ne ha verificato i test.

## Decisione architetturale proposta
UI React → invoke Tauri → servizi filesystem Rust → Vault locale.
I comandi IPC non possono chiamare automaticamente i moduli Node fs/path del core TypeScript. Proposta: implementare un runtime M2 Rust nativo, mantenendo e correggendo vault-core TypeScript per gli attuali consumatori del monorepo. Usare fixture e contratti condivisi per confrontare stato, errori, conteggi e invarianti dei due runtime. Questo comporta manutenzione di due implementazioni; la parità è un requisito di accettazione.
La release non deve lanciare Node, tsx, pnpm, Vite, server HTTP o script del checkout. Node/pnpm e Rust/Cargo restano strumenti di sviluppo/build. js-yaml serve il core TypeScript; il runtime Rust richiede un parser YAML nativo da selezionare e verificare prima dell’implementazione (nessuna crate/versione dichiarata già validata).

## Fase 1 — Confini filesystem e lettura manifest (rilievi 2, 3)
- Risolvere root e percorsi esistenti in forma canonica prima del controllo di appartenenza.
- Helper TS su path.relative(parent, child): ammessi relativo vuoto o relativo non assoluto diverso da '..' e non iniziante con '..' + path.sep. Non rifiutare un nome lecito solo perché inizia con due punti, ad esempio '..note'. Usare controllo per componenti equivalente in Rust.
- Per percorsi non ancora esistenti verificare l’antenato esistente e i componenti; gestire link rotti, link annidati, cicli e sostituzione dei link fra controllo e uso. Definire le garanzie contro queste sostituzioni e provarle; non dichiarare una sicurezza completa con il solo controllo preliminare.
- Prima di leggere ogni file: confine canonico, tipo e accessibilità. Il validatore deve poter leggere il manifest sicuro per validarne il contenuto; il divieto riguarda la lettura prima dei controlli filesystem e il riutilizzo di dati non validati.
- Restituire internamente il manifest già validato; openVault non lo rilegge. Se la validazione fallisce, non esporre nome/snapshot provenienti dal manifest come attendibili.
- Test: sibling vault-outside, traversal, assoluti esterni, link manifest esterno e verifica che nessuna lettura esterna sia avvenuta, root macOS canonica, link rotti/annidati.

## Fase 2 — Validazione e creazione (rilievi 4, 5)
- HOME.md, VAULT_RULES.md e VAULT_MANIFEST.json devono risolversi a file regolari leggibili entro il Vault. Cartelle obbligatorie effettivamente leggibili; nessun catch che nasconda un errore di scansione.
- Conteggi separati per file verificati e pagine Markdown; non contare due volte i file di sistema.
- js-yaml in dependencies e @types/js-yaml in devDependencies. Estrarre il blocco frontmatter, poi usare il parser completo con una modalità che preservi le stringhe data richieste dallo schema. Rifiutare documenti/scalari inattesi e segnalare errori sintattici. Verificare liste multilinea, CRLF, stringhe quotate, date e valori annidati rispetto allo schema.
- Politica proposta: note libere prive di frontmatter generano warning; se il frontmatter è presente deve rispettare lo schema. YAML malformato o schema invalido impediscono READY. Rendere esplicita questa politica nel manuale.
- Stati: assenza di selezione NO_VAULT; percorso inesistente/non leggibile NOT_ACCESSIBLE; struttura obbligatoria mancante INCOMPLETE; manifest/file di sistema/frontmatter invalidi INVALID; READY solo a verifica conclusa senza errori.
- Validità strutturale non equivale a checksum verificato: integrityStatus resta unverified finché non esiste una verifica effettiva. Non implementare nuovi snapshot M3 per chiudere M2.
- Preservare zero-overwrite: preflight dei conflitti, copia esclusiva senza sovrascrittura, errori espliciti; nessuna cancellazione di dati preesistenti in caso di fallimento. Verificare la disponibilità del template prima di modificare la destinazione.
- Test: directory al posto di ogni file obbligatorio, permessi negati, manifest corrotto, cartella mancante, cartella occupata, creazione parziale e doppia richiesta. Sola lettura verificata su intero albero: contenuti, elenco, mtime e ctime; non promettere invarianza atime dipendente dal filesystem.

## Fase 3 — Runtime nativo e risorse (rilievi 6, 7)
- Rendere disponibile/verificare Rust/Cargo e prerequisiti macOS prima della compilazione; nessuna installazione eseguita da questo piano.
- Organizzare servizi Rust separati da main.rs; aggiungere test unitari e fixture di parità TS/Rust.
- Verificare build.rs, Cargo.toml, configurazione e asset icona necessari alla build: l’audit precedente si è fermato prima della compilazione, non dimostra l’assenza di ulteriori errori.
- Includere vault-template come risorsa con destinazione stabile e risolverla dal resource directory Tauri. Non basarsi sul cwd o su un percorso /Users/cesare. Creare esplicitamente tutte le 15 cartelle, comprese quelle vuote che potrebbero non entrare nel bundle tramite glob.
- Creazione e apertura devono funzionare dall’app copiata in un percorso diverso dal checkout, con server di sviluppo fermo e rete assente.

## Fase 4 — Contratto IPC, UI e Obsidian (rilievi 1, 8)
- Comandi proposti: get_default_vault_path, create_vault(path, name), open_vault(path), validate_vault(path), check_obsidian_installed, open_obsidian(path).
- Richieste e risposte tipizzate e serializzabili: stato, percorso, nome validato, conteggi, risultato validazione e integrità separata. Errori con codice e messaggio leggibile. Validare gli argomenti anche in Rust; niente esecuzione di shell generica.
- Aggiungere @tauri-apps/api al desktop; adapter IPC tipizzato. Nessun import runtime di moduli Node nella WebView.
- Loading reale, blocco doppio clic, protezione da risposte obsolete, errori visibili e conteggi reali. Nessun READY ottimistico o dato simulato. Conservare la UI approvata: usare gli elementi esistenti per messaggi e stato; annotare eventuali aggiunte strettamente funzionali.
- In Vite/browser senza Tauri mostrare indisponibilità delle funzioni native; non simulare successo e non introdurre un server filesystem di fallback.
- Obsidian: controllare /Applications/Obsidian.app, considerare installazione utente o resolver macOS per evitare falsi negativi. Codificare correttamente il percorso nel URI obsidian://open?path=… e gestire assenza/errore di avvio. Verificare realmente l’app ricevente e il Vault aperto, non soltanto l’invio del comando.

## Fase 5 — Test, rilascio locale e documentazione (rilievi 9, 10)
Sostituire il test desktop echo con test reali di adapter/contratto e stati UI. Mock IPC utili per errori/caricamento, ma non sostitutivi della prova nativa.
Eseguire in sequenza pnpm test, pnpm typecheck, pnpm build per evitare contese su .next/types; eseguire test:guards separatamente se la suite si interrompe prima. Un typecheck che dipende da output generati richiede un flusso riproducibile, non occultamento dell’errore. Registrare exit code, revisione/diff e test effettivi.
Eseguire cargo test con manifest desktop e pnpm --filter @limen-vault/desktop tauri build. Se toolchain assente, dichiarare blocco; non equiparare pnpm build a build nativa. Non indebolire test rossi M3 né correggere M3 senza incarico.
Prova umana nativa da eseguire: aprire l’app compilata, inserire una nuova directory temporanea e premere CREATE NEW VAULT; devono comparire 15 cartelle e stato READY reale. Riaprire con OPEN EXISTING VAULT e verificare conteggi; riprovare con percorso inesistente e Vault corrotto, che devono mostrare errori. Ripetere create su directory occupata e verificare nessuna modifica. Provare Open in Obsidian e controllare il Vault ricevente. Acquisire schermata con percorso/stato e log del comando in caso di fallimento. Ripetere la prova fuori checkout, senza rete/server e senza Node nel PATH del processo nativo.
Aggiornare checklist, TODO, roadmap, manuale e handover prima del resoconto. Non segnare M2 completata se resta un criterio aperto. Firma, notarizzazione e pubblicazione restano M9/non eseguite.

## File previsti
Modificare: packages/vault-core/package.json, src/path-guard.ts, src/vault-validator.ts, src/vault.ts, src/vault-creator.ts, tests/vault-core.test.ts; apps/desktop/package.json, src/App.tsx, src-tauri/src/main.rs, src-tauri/Cargo.toml, src-tauri/tauri.conf.json; pnpm-lock.yaml; documentazione operativa.
Creare secondo necessità: adapter IPC e relativi test desktop, moduli Rust del runtime e test, fixture comuni, build.rs se necessario, Cargo.lock e risorse bundle mancanti. Nomi dei nuovi moduli da fissare durante l’implementazione.
Non modificare: CSS/palette/icone approvate, funzionalità web, snapshot-engine/M3 e milestone successive, dati Vault reali, configurazioni cloud o segreti. Eventuali icone mancanti per la build vanno derivate da asset approvati, senza ridisegno.

## Impatti e rollback
Database/SQL: nessuno. API remota: nessuna. API locale: nuovi comandi IPC e contratti tipizzati. UI: wiring, stati reali e messaggi funzionali mantenendo lo stile. Rischi: divergenza TS/Rust, corse filesystem, cambi concorrenti e ulteriori prerequisiti Tauri.
Rollback: registrare baseline prima di ogni fase; ripristinare esclusivamente i propri delta verificati, senza reset globale o cancellazione di lavoro altrui. Nessuna migrazione dati; rimuovere soltanto fixture create dal test. Lasciare esplicito lo stato non operativo delle funzioni rimosse, senza ripristinare falsi READY.

## Criteri di completamento
Tutti i dieci rilievi chiusi con prove, suite pertinente verde su checkout stabile, parità TS/Rust, nessuna lettura/scrittura fuori confine, zero-overwrite e read-only dimostrati, app nativa compilata e provata indipendentemente dal checkout. Completata in locale e pubblicata sono stati distinti; questo piano non autorizza pubblicazione.

## Fonti tecniche consultate
- https://v2.tauri.app/develop/calling-rust/ — invoke e comandi Rust.
- https://v2.tauri.app/develop/resources/ — risorse incorporate e risoluzione.
- https://github.com/nodeca/js-yaml — parser YAML JavaScript.
Versioni e parser Rust da verificare al momento dell’implementazione.
