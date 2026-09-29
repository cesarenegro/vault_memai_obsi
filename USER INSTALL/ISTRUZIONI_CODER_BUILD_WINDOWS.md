# Istruzioni al coder per la versione Windows di LIMEN Vault v6Mini

Data: 29 settembre 2026. Richiesta: completare la versione Tauri Windows e consegnare un installer realmente utilizzabile, mantenendo funzionante la versione Mac.

## 1. Obiettivo e punto di partenza

Realizza il pacchetto Windows di LIMEN Vault v6Mini partendo dal progetto esistente. Riutilizza le funzionalità e gli adattamenti Windows già presenti; completa ciò che manca e collauda l’app installata su Windows, fuori dall’ambiente di sviluppo.

- Repository: https://github.com/cesarenegro/vault_memai_obsi
- Branch di partenza: `windows-build`.
- Commit osservato durante la preparazione di queste istruzioni: `b3a57a7`. È il riferimento dell’ispezione, non un invito a riportare indietro modifiche successive.
- Prodotto attuale nei manifest: `LIMEN Vault v6Mini`, versione `0.6.0`, identificativo `dev.arkai.limenvault`.
- Percorso Windows documentato: `E:\Projects\vault_memai_obsi`. Verifica che sia quello effettivo prima di lavorare.
- Destinazione degli artefatti Windows: cartella `USER INSTALL WINDOWS` nella root. Queste istruzioni sono conservate in `USER INSTALL` per richiesta di Cesare.

Nel repository esiste già un lavoro Windows, documentato in `SESSION_HANDOVER_WINDOWS_BUILD.md`: non si parte da zero. Quel documento contiene stati di versioni precedenti; i suoi risultati sono storici e non certificano l’attuale release 0.6.0. Non ripristinare automaticamente vecchi nomi/versioni o vecchie sospensioni: confrontali con il codice e la richiesta attuale.

La presenza di `nsis` tra i target Tauri non prova che esista un installer funzionante. In questa attività preparatoria non è stata eseguita alcuna compilazione o prova Windows.

## 2. Regole di lavoro

1. Leggi le istruzioni applicabili, in particolare `.agents/AGENTS.md`, `TASK_LIST.md` e `TODO LIST.TXT`.
2. Verifica branch, HEAD, modifiche locali e stato remoto prima di aggiornare il checkout. Non usare reset distruttivi o sovrascritture per eliminare lavoro altrui.
3. Lavora su copie e fixture dedicate. Non usare il Vault reale o le cartelle dei modelli/configurazioni di Cesare come area di test. Usa un profilo Windows di collaudo separato e percorsi isolati; se il codice non consente l’isolamento, correggi prima questo prerequisito.
4. Non eseguire chiamate reali a OpenAI: le regole del progetto le vietano per lo sviluppo/collaudo corrente. Usa servizi simulati per i test online e dichiara non verificata l’integrazione live finché non venga autorizzata una prova distinta.
5. Non usare `Stop-Process`, `taskkill` o terminazioni indiscriminate di app, Node, Cargo o llama-server. Se un processo blocca il lavoro, identifica PID e motivo e segnala il blocco. Per le tue prove prevedi l’uscita normale e la chiusura controllata dei soli processi di test, rispettando le regole applicabili; non lasciare server attivi.
6. Dopo tre tentativi falliti della stessa azione fermala, identifica il prerequisito mancante e prosegui sulle attività indipendenti. Non aggirare il limite cambiando superficialmente comando.
7. Aggiorna stato, checkbox, verifiche e residui nella checklist principale a ogni fase e prima di commit/consegna. Un commit per fase conclusa, secondo le regole del progetto.
8. Non includere `SECRETS_NO_GIT`, `.env`, password, chiavi o dati del Vault nel pacchetto distribuito. La cartella di credenziali è stata inserita in Git per trasferimento su richiesta di Cesare: questo non la rende una risorsa dell’app. Non stamparne i contenuti nei log e non modificarne la politica Git senza richiesta.

## 3. Riscontri concreti nel codice da cui partire

| Area | Evidenza osservata | Lavoro richiesto |
| --- | --- | --- |
| Tauri | `apps/desktop/src-tauri/tauri.conf.json`: target `app`, `dmg`, `nsis`, risorse native e MCP condivise | Separare il packaging per piattaforma e verificare le risorse effettive |
| Credenziali | `src/keychain.rs`: implementazione Windows con `CredReadW`, `CredWriteW`, `CredDeleteW` | Riutilizzarla e provarla nel profilo di test |
| Interfaccia | `apps/desktop/src/platform.ts`: percorsi e termini Windows, OCR dichiarato non disponibile | Verificare che le etichette coincidano con le capacità reali |
| Ricerca locale | `src/llama.rs`: ricerca di `llama-server.exe`, gestione Windows e processi | Provare i percorsi della versione installata e tutte le dipendenze native |
| Generazione locale | `src/llama_llm.rs`: Ministral, `CREATE_NO_WINDOW`, timeout e modelli | Portare anche i comportamenti introdotti per v6Mini sul runtime Windows |
| RAM | `get_physical_ram_bytes()` fuori da macOS restituisce sempre `SIXTEEN_GB_BYTES` | Implementare rilevamento Windows reale; non considerare ogni PC come dotato di 16 GB |
| Estrazione | `src/extraction.rs`: PDF/immagini instradati a `vision()`, che fuori da macOS restituisce errore; DOC/RTF non disponibili nello stesso ramo | Verificare il percorso usato dall’app e implementare le parti Windows mancanti |
| Build nativa | `src-tauri/build.rs`: helper Swift compilato solo su Mac; può creare un `dist/index.html` segnaposto | Non distribuire quel segnaposto; controllare il vero frontend Vite |
| Binari | Nel Git corrente sono presenti anche `resources/native/llama-server` e una libreria `.dylib` | Non copiare automaticamente risorse Mac nel pacchetto Windows |
| Rilascio Mac | `scripts/package-v6mini-macos.sh` usa strumenti Apple e controlli del frontend | Riutilizzare i criteri di verifica, non eseguire lo script su Windows |

I percorsi `src/...` della tabella sono relativi a `apps/desktop/src-tauri/`.

## 4. Preparare e registrare l’ambiente Windows

Prima piattaforma di consegna: Windows 11 x64, target Rust `x86_64-pc-windows-msvc`. Windows ARM64 e altre versioni devono avere prove proprie: non dichiararle supportate per deduzione. Se vuoi includere Windows 10 nel supporto, verifica separatamente sistema, WebView2 e binari nativi.

Verifica la disponibilità di:

- Git, Node compatibile con il progetto (`package.json` richiede almeno Node 20), pnpm compatibile con il lockfile e le impostazioni del workspace;
- toolchain Rust MSVC, compilatore C++ e Windows SDK necessari a Tauri;
- Microsoft Edge WebView2 Runtime;
- strumenti necessari a preparare i binari locali scelti, senza presumere che siano installati nel PC dell’utente finale.

Registra le versioni effettive di Node, pnpm, Rust, Cargo, Windows, WebView2, Tauri e llama.cpp. Scegli versioni riproducibili, senza aggiornamenti generalizzati delle dipendenze per tentativi.

Esegui i comandi dalla root, uno alla volta, verificando il codice di uscita:

```powershell
Set-Location 'E:\Projects\vault_memai_obsi'
git status --short
git branch --show-current
node --version
npx pnpm --version
rustc --version
cargo --version
rustup show
npx pnpm install --frozen-lockfile
```

I comandi `beforeDevCommand` e `beforeBuildCommand` richiamano direttamente `pnpm`: assicurati che sia disponibile anche nei processi figli. L’esecuzione di `npx pnpm` da sola non dimostra che quel prerequisito sia soddisfatto. Non cambiare i manifest in npm solo per aggirarlo.

Se manca un prerequisito, installa soltanto quello necessario da una fonte ufficiale. Non inventare percorsi nei portali o nelle interfacce web: verificali al momento se servono.

## 5. Completare il packaging per piattaforma

Usa la configurazione comune per le impostazioni condivise e un override `apps/desktop/src-tauri/tauri.windows.conf.json` per Windows. Se necessario separa anche la configurazione Mac, mantenendo invariata la sua distribuzione.

Per la prima consegna genera un installer NSIS `.exe`; MSI è facoltativo e non è necessario per chiudere questa richiesta. Prediligi l’installazione per utente quando compatibile con tutte le risorse.

Controlla esplicitamente:

- target Windows e icona `.ico` corretti;
- nome, versione, identificativo e publisher coerenti nei manifest e nell’installer;
- finestra, barra del titolo, menu e ridimensionamento su Windows; non imporre l’aspetto della titlebar macOS;
- scelta documentata per WebView2: rilevamento e installazione se manca, con dichiarazione del fabbisogno di rete durante il setup; per un setup completamente offline prevedi anche il runtime appropriato;
- cartelle dati e modelli scrivibili dall’utente, separate dalla cartella dell’eseguibile;
- risorse HELP, guida e template del Vault presenti e leggibili nell’app installata;
- elenco delle risorse limitato ai file necessari: niente credenziali, repository, cache, prove, DMG, modelli personali o documenti aziendali;
- nessuna dipendenza da `localhost:1420`, Vite, Node, pnpm, Python, Rust o dal checkout sul computer dell’utente finale.

Attenzione alla fusione delle configurazioni: verifica l’elenco finale delle risorse, non presumere che l’override elimini ogni voce della configurazione comune. Se usi directory di preparazione separate per Windows e Mac, rendile esplicite e riproducibili.

## 6. Preparare i motori locali e gli helper Windows

Prepara una distribuzione Windows x64 di `llama-server.exe` con versione fissata e tutte le DLL necessarie. Verifica origine, checksum e licenze. Non riutilizzare eseguibili Mach-O o librerie Metal del pacchetto Mac.

Il progetto deve trovare il motore dalle risorse installate anche quando la cartella corrente è diversa e il sorgente non esiste sul PC. Non basare la riuscita sul PATH del coder o su un’installazione globale già presente.

Servono due funzioni distinte:

1. bge-m3 per la ricerca semantica;
2. Ministral per le risposte in modalità Solo Locale.

Controlla porte assegnate dinamicamente, ascolto limitato a loopback, riconoscimento del modello/servizio, avvio senza finestre terminale aggiuntive, gestione dello standard error e chiusura senza processi orfani. Non agganciare o terminare un server estraneo solo perché usa una porta nota. Prova anche le due funzioni contemporaneamente.

Definisci una configurazione Windows verificata per CPU e, dove disponibile, GPU. Vulkan/CUDA richiedono binari e dipendenze adatti: l’assenza di una GPU supportata deve produrre un comportamento chiaro e non un crash. Un eventuale ripiego sulla CPU deve restare locale; non passare a OpenAI automaticamente.

Correggi il rilevamento RAM fittizio. Mantieni coerenti file, dimensione, hash e download del modello scelto, seguendo la politica 3B/8B già nel codice e verificando anche VRAM, memoria disponibile e carico simultaneo di bge-m3. La memoria dedicata delle GPU Windows non equivale alla memoria unificata Apple: non copiare parametri Metal o `-ngl` senza collaudo.

Download dei modelli: verifica spazio libero, avanzamento, annullamento, interruzione, checksum errato, ripresa prevista e riutilizzo di un file valido. I GGUF non devono essere inseriti in Git o copiati nell’installer per comodità. Mantieni distinguibili la rete usata per lo scaricamento iniziale e l’assenza di rete richiesta durante l’uso Solo Locale.

Per MCP e tunnel, prepara gli eventuali helper Windows solo se la funzione viene consegnata. Un helper assente deve produrre un avviso corretto; non impacchettare il binario Mac sotto un nome `.exe`.

## 7. Estrarre e leggere documenti su Windows

Questa è una verifica bloccante: l’interfaccia cita il supporto PDF, ma il ramo osservato di `extraction.rs` usa un helper Mac anche per i PDF. Segui l’intero percorso reale dall’importazione al catalogo prima di scegliere la correzione; non assumere che una vecchia prova Windows copra il codice attuale.

Implementa e prova almeno PDF testuali, TXT/Markdown, DOCX, PPTX e i fogli supportati dall’app. Conserva testi, numeri, tabelle e riferimenti di pagina/slide/foglio quando disponibili. Controlla separatamente l’OCR delle immagini incorporate nei documenti Office.

Per scansioni e immagini prepara un’alternativa locale Windows all’OCR Apple, con dipendenze e lingue incluse o installate in modo documentato. L’obiettivo è la parità delle funzioni consegnate sul Mac. Se l’OCR o i formati legacy restano assenti, segnala il residuo e non dichiarare completata la parità; una release ridotta richiede una decisione esplicita di Cesare.

Non dichiarare riuscita un’estrazione vuota o inventare testo per compensarla. File protetti, corrotti, troppo grandi o non supportati devono avere un messaggio preciso e lasciare intatto l’originale. L’apertura dei documenti dal lettore e dalle citazioni deve funzionare dalla versione installata.

## 8. Verificare dati, percorsi e credenziali

Prova percorsi Windows con spazi, accenti, caratteri non ASCII, unità diversa da C:, nomi uguali in cartelle diverse e cartelle non scrivibili. Non confondere percorsi relativi del catalogo con percorsi assoluti Windows; conserva l’interoperabilità dei Vault provenienti dal Mac su copie di prova.

Verifica i controlli contro traversal, link simbolici e junction/reparse point senza disattivarli per far passare i test. Controlla inoltre lettura/scrittura atomica e rinomina quando antivirus o file aperti creano blocchi.

Usa il Gestore credenziali Windows già implementato. Prova salvataggio, lettura, sostituzione e rimozione di una credenziale sintetica in un profilo isolato: niente chiavi reali nei test, nei log o nei file del Vault. Non importare automaticamente le credenziali contenute in `SECRETS_NO_GIT`.

Verifica i comandi Apri originale, Esplora file, selettore file, trascinamento e Apri in Obsidian, compreso il caso in cui Obsidian non sia installato.

## 9. Compilazione e creazione dell’installer

Per la prova ottimizzata durante lo sviluppo, la regola di progetto prescrive questo comando dalla root Windows:

```powershell
npx pnpm --filter @limen-vault/desktop tauri dev --release
```

Non sostituirlo con `cargo build --release` per preparare la versione da provare. Un’esecuzione in modalità sviluppo non costituisce la consegna.

Per il pacchetto distribuibile usa invece la CLI di packaging Tauri, dopo aver preparato e verificato risorse e configurazione Windows:

```powershell
npx pnpm --filter @limen-vault/desktop tauri build --bundles nsis --target x86_64-pc-windows-msvc
```

Questo comando è proposto per il lavoro del coder: non è stato eseguito o validato su Windows in questa sessione. Controlla le opzioni della CLI effettivamente installata e conserva il log.

Crea `scripts/package-v6mini-windows.ps1` per rendere riproducibile la consegna: prerequisiti, preparazione verificata degli helper, frontend reale, build NSIS, eventuale firma, copia finale e SHA-256. Deve interrompersi al primo errore e non copiare vecchi artefatti come se fossero nuovi. In PowerShell controlla anche i codici di uscita dei comandi nativi.

Controlla che `dist/index.html` e il pacchetto contengano gli asset Vite reali e non il segnaposto generato da `build.rs`. Ricava il percorso dell’installer dall’output effettivo della build, senza assumere che tutte le configurazioni usino la stessa cartella target.

## 10. Firma e installazione pulita

La firma Developer ID e la notarizzazione Apple non valgono per Windows. Se disponibile, usa una credenziale di firma Windows appropriata, firma gli artefatti previsti e verifica firma e timestamp anche sull’installer finale.

Se manca l’accesso alla firma, continua build e collaudi indipendenti e dichiara il pacchetto non firmato come tale. Non dichiarare eliminati gli avvisi SmartScreen e non proporre di disattivare antivirus o protezioni. Distingui installer funzionante per collaudo e release firmata pronta alla distribuzione.

Installa da zero su un profilo o una macchina Windows senza strumenti di sviluppo e senza il checkout. Prova avvio dal menu Start, prima configurazione, riavvio, aggiornamento sulla versione precedente e disinstallazione. Vault e documenti dell’utente non devono essere cancellati dall’aggiornamento o dalla disinstallazione ordinaria.

## 11. Matrice di accettazione

Per ogni riga conserva ambiente, comando/azione, risultato reale e relativa evidenza. Un test non eseguito resta NON VERIFICATO. Non riutilizzare i numeri dell’handover come risultati di questa release.

- [ ] Installazione NSIS x64 riuscita su Windows pulito; avvio senza strumenti di sviluppo.
- [ ] WebView2 presente/assente gestito secondo la modalità scelta; requisito di rete dichiarato.
- [ ] Nome, icona, versione e publisher corretti; nessuna finestra terminale inattesa.
- [ ] Apertura e creazione Vault su fixture isolate; riapertura dopo chiusura.
- [ ] Caricamento e lettura dei formati previsti, PDF lunghi e tabelle compresi; originali byte-identici.
- [ ] OCR locale di scansioni e immagini verificato, oppure residuo esplicito con parità non dichiarata completa.
- [ ] Ricerca per parole e ricerca semantica bge-m3 reali; filtri e risultati oltre la prima pagina.
- [ ] RAM rilevata realmente e selezione 3B/8B coerente; CPU/GPU supportate documentate.
- [ ] Risposte Ministral reali in Solo Locale; servizio semantico e generazione entrambi attivi senza conflitti.
- [ ] Prova di almeno 20 domande locali consecutive senza blocchi; tempi, memoria e hardware riportati come misure effettive.
- [ ] Nessuna richiesta verso servizi esterni durante la prova Solo Locale dopo il download; verificare anche caricamento automatico dei modelli e attività automatiche in background.
- [ ] Fonti consultate/citate, lettore e revisione corretti; nessuna sostituzione silenziosa della fonte.
- [ ] Timeout, servizio assente, errore HTTP, stream vuoto e risposta incompleta mostrati correttamente.
- [ ] Credenziali Windows verificate con valori sintetici; nessuna persistenza in chiaro nel Vault.
- [ ] Copie locali e ripristino in cartella separata verificati su fixture.
- [ ] Percorsi con accenti/spazi e cartelle non scrivibili; nessuna scrittura nei dati reali di Cesare.
- [ ] Arresto normale e riavvio senza processi orfani o aggancio di servizi estranei.
- [ ] UI, storico, invio domanda, scroll, fonti e ridimensionamento verificati a scala 100%, 125% e 150%.
- [ ] Funzioni online e trasferimenti verificati con mock; collaudo live separato e non dichiarato effettuato.
- [ ] Test frontend, typecheck, build e test Rust pertinenti eseguiti; controlli Windows reali per i rami specifici della piattaforma.
- [ ] Aggiornamento/disinstallazione senza perdita del Vault; risorse necessarie presenti dopo l’installazione.
- [ ] Nessuna regressione Mac introdotta; se manca un ambiente Mac, verifica runtime Mac esplicitamente pendente.
- [ ] Firma Windows verificata, oppure stato non firmato e dipendenza chiaramente riportati.
- [ ] Installer finale e checksum coincidono con l’artefatto collaudato.

Per le verifiche del monorepo usa gli script presenti (`test`, `typecheck`, `build`) e quelli nativi pertinenti, adattando solo le assunzioni realmente specifiche di macOS. Per Rust valuta `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml` dopo aver controllato isolamento e dipendenze dei test. Non eseguire suite che toccano dati reali o fanno chiamate online vietate; isola/correggi quei test o dichiara il blocco.

## 12. Consegna richiesta

Crea `USER INSTALL WINDOWS` e consegna:

1. Installer con nome riconoscibile, per esempio `LIMEN-Vault-v6Mini-0.6.0-windows-x64-setup.exe`; il nome finale deve corrispondere all’artefatto prodotto e verificato.
2. `SHA256SUMS.txt` calcolato dopo ogni operazione di firma e copia finale.
3. `LEGGIMI_WINDOWS.md`: requisiti effettivi, installazione, primo avvio, modelli, modalità locale, aggiornamento, disinstallazione e limiti accertati.
4. Script PowerShell riproducibile e configurazioni Windows nel repository.
5. Evidenze in `IMPLEMENTATION/WINDOWS_RELEASE_EVIDENCE/` e un riepilogo breve con commit sorgente, versioni, hardware, prove passate e residue. Evita credenziali e contenuti aziendali nei log.
6. `TASK_LIST.md` e `TODO LIST.TXT` aggiornati distinguendo: implementato, compilato, installato e collaudato, firmato, pubblicato.

Non sostituire o rimuovere i DMG Mac in `USER INSTALL`. Non aggiungere aggiornamento automatico, Store o nuovi servizi se non necessari alla consegna. La cartella Windows non è più esclusa dal `.gitignore`, ma verifica quali artefatti entrano realmente nel commit e gli eventuali limiti del remoto prima del push.

Il lavoro non è concluso quando il compilatore termina: è concluso quando il setup consegnato installa e avvia l’app su Windows pulito e i criteri funzionali dichiarati hanno evidenze. Se mancano firma, OCR o un collaudo richiesto, consegna il risultato disponibile con quel residuo esplicito, senza marcare completa la milestone corrispondente.

## Riferimenti ufficiali verificati durante la preparazione

Documentazione consultata il 29 settembre 2026. Non sostituisce il collaudo della versione Tauri bloccata dal progetto.

- Prerequisiti Windows, toolchain MSVC e WebView2: https://v2.tauri.app/start/prerequisites/
- Installer Windows NSIS/MSI e opzioni WebView2: https://v2.tauri.app/distribute/windows-installer/
- Configurazione comune e override di piattaforma: https://v2.tauri.app/reference/config/
- Firma Windows: https://v2.tauri.app/distribute/sign/windows/

Le istruzioni descrivono codice, comandi e requisiti; non contengono percorsi passo passo nelle interfacce web di account non verificati.
