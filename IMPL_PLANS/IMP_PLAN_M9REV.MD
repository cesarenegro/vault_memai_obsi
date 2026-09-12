# M9REV — Release macOS installabile e verificata

Data: 12 settembre 2026. Revisione 1. Stato: piano completo definito; implementazione e accettazione M9 da eseguire. Fonte operativa: [TASK_LIST.md](../TASK_LIST.md), sezione M9. Questa richiesta produce il piano, non avvia firma, acquisti, commit, tag o pubblicazione.

## 1. Obiettivo e baseline verificata

Consegnare LIMEN Vault come applicazione macOS installabile da un utente, indipendente dal repository e dalla toolchain, con conservazione dei dati durante aggiornamento e rimozione. M9 trasforma il prodotto verificato in M8 in un pacchetto distribuibile; non sostituisce la validazione funzionale M7/M8.

Evidenze disponibili: M6 chiusa in locale secondo IMPLEMENTATION/2026-09-12_M6_CLOSURE.md, con prove reali API, Codex e Business su fixture. Il collegamento Business QA è stato disconnesso e il tunnel fermato. La configurazione Tauri letta oggi usa versione 0.1.0, identificatore dev.arkai.limenvault, target app e risorsa vault-template; CSP attualmente null. Il client tunnel di prova risiede in .local e usa un Vault temporaneo: non costituisce packaging di produzione. Non dedurre lo stato M7/M8 dalla presenza dei file; consultare checklist e rapporti al momento del congelamento.

## 2. Scelte del piano e confini

- Prima release: download diretto di DMG contenente una .app firmata e notarizzata, macOS Apple Silicon. Intel/Universal, Windows, Linux e Mac App Store esclusi dalla prima release; aggiungerli solo con incarico e banco dedicati.
- Aggiornamento iniziale manuale mediante nuova .app verificata. Nessun aggiornamento silenzioso. L’updater automatico è un’estensione separata, non un requisito implicito della prima release.
- Versione commerciale e versione minima macOS da stabilire sulla baseline e sulle prove, senza inventare compatibilità. Allineare versioni applicative e metadati effettivamente usati; preservare identificatore e continuità Keychain.
- Nessun Vault reale, credenziale, account, tunnel ID QA o directory personale nel pacchetto. Funzioni locali disponibili senza login, API o R2.
- M10 R2 resta opzionale e non blocca M9. M9 non introduce inferenza AI locale, nuove funzioni di approvazione o migrazioni di schema non necessarie.

## 3. Fasi di implementazione

### M9.1 — Congelamento della release e prerequisiti

Identificare la baseline M2–M8 accettata: revisione Git se disponibile e inventario/hash delle modifiche locali, lockfile, toolchain, sistema e architettura. Conservare il lavoro concorrente; coordinare i file condivisi con AG. Preparare una release candidate distinta da build di sviluppo e fixture.

Verificare disponibilità di identità Developer ID Application con chiave privata, team corretto e autenticazione notarizzazione. Registrare solo stato e identificativi non segreti. Se manca un prerequisito, completare packaging e test indipendenti, segnando firma/notarizzazione bloccate; una firma ad hoc non chiude M9.

### M9.2 — Packaging e risorse

Aggiornare la configurazione Tauri per produrre app e DMG, metadati/versione/minimo macOS, icone e template necessari. Usare percorsi risorse risolti dal bundle; nessun riferimento runtime a .local, checkout, Vite, Node, Cargo o cartelle QA. Escludere harness di test, log, certificati e segreti. Controllare dipendenze dinamiche e ogni eseguibile ausiliario.

Il Vault scelto dall’utente resta esterno al bundle. Preferenze, log e profili operativi devono usare percorsi utente stabili e permessi appropriati; non scrivere nella .app. Primo avvio: scelta/creazione esplicita del Vault, nessuna apertura automatica della fixture. Gestire percorso mancante, volume scollegato, accesso negato e nome Unicode senza danneggiare i dati.

### M9.3 — Collegamenti AI utilizzabili dopo l’installazione

API: conservare la chiave nel Portachiavi, distinguere chiave presente, autorizzazione valida e disponibilità del modello. Errori circoscritti; mai dichiarare verificata una chiave solo perché salvata. Verificare continuità di accesso al Portachiavi passando da build QA a firma definitiva e dopo aggiornamento, senza estrarre o migrare credenziali in chiaro.

Codex: generare/documentare il comando MCP stdio usando l’eseguibile installato e il Vault autorizzato, con quoting corretto. Non dipendere dal PATH di sviluppo. Revoca tramite arresto/rimozione della configurazione del client; gli strumenti rimangono di sola lettura.

Business: sostituire il profilo temporaneo M6 con configurazione persistente per utente. Prevedere attivazione esplicita, scelta Vault, tunnel e organizzazione corretti, credenziale runtime protetta distinta logicamente dalla chiave per generazione API. Non assumere che le due chiavi appartengano alla stessa organizzazione. Il client deve fermarsi su errori permanenti di autenticazione/autorizzazione, con retry limitati per errori transitori.

Integrare avvio/arresto e stato reale del processo tunnel nelle impostazioni o in un launcher di prodotto documentato e accessibile; verificare readiness e disponibilità remota senza confonderle. Uscita app, cambio Vault e revoca devono arrestare il processo gestito e impedire nuove letture. Nessun avvio al login predefinito, processo orfano o esposizione pubblica automatica. Documentare anche la disconnessione lato Business: fermare il processo non elimina il plugin remoto.

Per il componente tunnel opzionale, soluzione prevista: binari ausiliari versionati forniti con il pacchetto, subordinati a verifica di licenze, redistribuzione, integrità, firma e compatibilità notarizzazione. Se non fattibile, usare un componente opzionale installato in un percorso stabile con verifica dell’artefatto e flusso realmente provato. Non lasciare la decisione irrisolta dichiarando il prodotto completo. Nessun download/esecuzione di “latest” non verificato all’avvio. Se gli ausiliari mancano, le funzioni locali e l’API interna restano utilizzabili.

### M9.4 — Configurazione di produzione e firma

Rivedere CSP attualmente null, capability IPC, apertura URL e permessi filesystem/processi. Applicare una policy compatibile con le funzioni effettive e verificare la UI: nessuna disattivazione generalizzata dei controlli per far passare la release. Proteggere la visualizzazione di Markdown e contenuti non fidati; log minimali senza chiavi, token o contenuto integrale del Vault.

Firmare applicazione e componenti distribuiti con identità appropriata, hardened runtime ed entitlement minimi necessari; verificare l’intero artefatto. Inviare il pacchetto previsto a notarizzazione, registrare esito e riferimento, applicare e validare il ticket dove previsto. Gatekeeper deve accettare il pacchetto scaricato senza rimozione della quarantena o bypass di sicurezza. Queste verifiche seguono la [documentazione Tauri sulla firma macOS](https://v2.tauri.app/distribute/sign/macos/) e la [documentazione Apple sulla notarizzazione](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

### M9.5 — Installazione, aggiornamento e recupero

Provare installazione da DMG in un account/macchina di test pulito e avvio da Applications, fuori checkout e senza toolchain. Registrare richieste macOS effettive, senza inventare istruzioni di sistema o portali.

Aggiornamento manuale: arrestare app e ausiliari, installare il nuovo pacchetto verificato, riaprire lo stesso Vault; controllare note, RAW, snapshot, indice, output/proposte M7, preferenze e accesso Keychain. Nessuna cancellazione o riscrittura automatica per “riparare” incompatibilità. Prima di eventuali migrazioni definire versione, backup indipendente e recupero; non confondere snapshot disponibili con una funzione di restore non implementata.

Conservare l’ultima release verificata. Il ritorno a una versione precedente è ammesso solo con formati compatibili; in caso contrario documentare recupero da backup, senza promettere downgrade trasparenti. Provare spazio insufficiente, aggiornamento interrotto e app in esecuzione su fixture. Disinstallare la sola app preserva il Vault; rimozione credenziali/profili richiede scelta esplicita dell’utente e arresto dei processi.

Se richiesto successivamente un updater automatico: definire endpoint, canale, artefatti firmati con chiave updater separata dalla firma Apple, gestione rotazione/perdita chiave, download interrotto, firma invalida, consenso e fallback offline. Non introdurre questa infrastruttura ora. Riferimento: [Tauri Updater](https://v2.tauri.app/plugin/updater/).

## 4. Matrice di accettazione sul pacchetto finale

| Prova | Risultato richiesto |
| --- | --- |
| Provenienza artefatto | Versione, baseline, lockfile, toolchain e SHA-256 dei pacchetti registrati; niente “build finale” senza identificazione |
| Installazione pulita | DMG installabile, app avviabile, risorse e ausiliari presenti, nessun percorso QA |
| Firma/notarizzazione | Firme valide, ticket verificato, Gatekeeper senza bypass anche per artefatto ottenuto via download controllato |
| Offline dal primo avvio | Flussi locali M2–M7 e Obsidian secondo M8; nessuna richiesta login obbligatoria |
| API dal bundle firmato | Selezione fonti, risposta reale, citazioni/hash e chiave protetta; errore rete gestito |
| Codex dal percorso installato | Ricerca/lettura reali e limiti read-only; nessuna dipendenza dal checkout |
| Business dal componente installato | Connessione reale, fonti corrette, stato e stop/revoca; nuova chiamata non restituisce dati dopo revoca, senza attese locali indefinite |
| Aggiornamento e riavvio | Dati persistenti invariati salvo operazioni richieste, accesso Keychain corretto, nessun processo precedente rimasto attivo |
| Errore/recupero | Fixture preservate per spazio insufficiente/interruzione, procedura di recupero realmente provata |
| Disinstallazione | App/ausiliari rimossi o fermati come previsto; Vault conservato, segreti non esportati |

Gli E2E M6 e le prove M8 sono baseline: ripetere sul pacchetto firmato i controlli che packaging, percorsi, firma e processi possono alterare. Non ripetere l’intero audit ad ogni correzione documentale. Un criterio obbligatorio fallito o non verificabile resta aperto.

## 5. File previsti e ordine di lavoro

Modifiche candidate, da confermare leggendo la baseline: apps/desktop/src-tauri/tauri.conf.json, Cargo.toml e main.rs; moduli dedicati per lifecycle/configurazione tunnel; AiPanel.tsx/ai-ipc.ts per stato e controllo; script di build e verifica release sotto scripts/; test mirati desktop/native. Non riscrivere M7 né applicare redesign.

Preparare la specifica e gli script prima della chiusura M8; congelare il candidato solo dopo M7/M8 accettate. Sequenza: packaging e configurazione operativa → test pertinenti → controlli finali → firma/notarizzazione → prove sul pacchetto distribuito → rapporto → eventuale pubblicazione autorizzata.

Sul checkout finale eseguire in sequenza pnpm test, pnpm typecheck, pnpm build; aggiungere cargo test e build Tauri con toolchain del progetto, senza presumere Cargo globale. Registrare exit code/log. Produrre evidenze M9 in IMPLEMENTATION/M9_EVIDENCE e rapporto IMPLEMENTATION/2026-…_M9_CLOSURE.md con matrice, hash e limiti. Non creare ora log o risultati segnaposto.

## 6. Consegna, dipendenze e stati

Consegna locale: DMG e .app verificati, checksum, inventario/licenze degli ausiliari, note di rilascio, manuale installazione/AI/aggiornamento/disinstallazione/recupero. Manuale basato su UI effettivamente provata; le credenziali appartengono all’utente e non sono incluse.

Prerequisiti da verificare durante l’implementazione: accettazione M7/M8, versione/minimo macOS, identità/team Apple e accesso notarizzazione, fattibilità redistribuzione tunnel, banco pulito. Non sono dichiarati già disponibili. Destinazione di pubblicazione e autorizzazione servono soltanto per distribuire, non impediscono la preparazione locale.

Stati distinti in TASK_LIST.md:
1. Piano M9REV definito.
2. Release candidate preparata, verifiche eventualmente aperte.
3. M9 completata in locale: tutti i criteri obbligatori superati, firma/notarizzazione incluse.
4. Release pubblicata: solo dopo incarico esplicito, con versione, destinazione e hash verificati anche dopo il download.

Se cambiano i byte del pacchetto dopo la validazione, rigenerare firme/notarizzazione e verifiche pertinenti. Non creare commit/tag/push né pubblicare con la sola autorizzazione a redigere questo piano. M10 resta separata.
