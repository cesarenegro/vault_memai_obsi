# Dossier per Claude — audit LIMEN Vault, CRM, MEMAI e integrazioni

Preparato il 14 settembre 2026 per Cesare. Documento di contesto e guida all’audit, non certificazione completa del sistema e non autorizzazione a modificare produzione.

**Leggi prima le sezioni 1–3: identificano ambienti, repository e discrepanze che altrimenti falserebbero l’audit.** Le verifiche funzionali e di distribuzione sotto riportate risalgono al 13 settembre; le letture Git, del codice e della configurazione Vercel esplicitamente datate 14 settembre sono state svolte per questo dossier. Non confondere i due livelli temporali.

## 1. Ambiente autoritativo e discrepanza produzione/staging

Il riferimento per l’audit della consegna in produzione è:

```text
https://pii-crm.vercel.app
          |
          | MEMAI_API_URL, richiesta dal server CRM
          v
https://m3mai-backend.onrender.com
```

Verifica diretta del 14 settembre: la configurazione **Production** del progetto Vercel `pii-crm` contiene `MEMAI_API_URL=https://m3mai-backend.onrender.com`. È stata letta con la CLI autenticata, estraendo esclusivamente l’hostname e cancellando il file temporaneo; nessuna credenziale è inclusa in questo dossier. Questa verifica riguarda la configurazione attuale, non costituisce una nuova prova funzionale di ogni endpoint.

**Il CRM locale è configurato diversamente:** nel file `/Users/cesare/Documents/STEFANO PARMA PII ALL/PII_CRM/.env.local`, `MEMAI_API_URL` punta a `https://m3mai-backend-staging.onrender.com`. Quindi un test avviato con il CRM locale può interrogare lo staging mentre il CRM pubblico interroga produzione. Non confrontare risultati, utenti, database, flag o cataloghi come se provenissero dallo stesso ambiente.

| Componente | Destinazione | Ruolo e autorità |
|---|---|---|
| CRM produzione | `https://pii-crm.vercel.app` | Interfaccia CRM consegnata; unico progetto CRM Vercel da considerare per questa integrazione |
| MEMAI produzione | `https://m3mai-backend.onrender.com` | Backend del CRM pubblico, secondo configurazione Production verificata oggi |
| MEMAI staging | `https://m3mai-backend-staging.onrender.com` | Ambiente separato; destinazione attuale del CRM locale |
| Worker LIMEN | `https://limen-vault-sync.cesare-negro.workers.dev` | Trasferimenti e pubblicazione del Vault; non è una seconda istanza del backend MEMAI |
| LIMEN desktop | App Tauri sul Mac | Accesso ai file locali, indipendente dalla disponibilità dei tre servizi sopra |
| `apps/web` di LIMEN | Sorgente web nel monorepo | Non sostituisce automaticamente né il CRM pubblico né l’app Tauri; eventuale deployment va identificato separatamente |

Identificativi utili, senza segreti:

- Vercel CRM: progetto `pii-crm`, ID `prj_NrtJAfb49tCrGRoOhvM6gDum7RAY`; team `team_BnfbrzorkYY0WQ2woE2DkVbb`.
- Render progetto M3MAI: `prj-d9t7m7jm8hqs73cek4j0`.
- Render backend produzione: `srv-d8j0fqnlk1mc738mfeo0`; ambiente Production `evm-d9t7m7jm8hqs73cek4jg`.
- Render staging, secondo handover del 26 agosto: servizio `srv-da71dpu7bikc73eijceg`, ambiente `evm-da712j7avr4c7384vpkg`, Blueprint `m3mai-staging`.

Fonte staging: `MEMAI/docs/implementation/P0_1_STAGING_HANDOFF.md`. Il documento descrive database, Redis, Qdrant, Celery e cron separati, branch `codex/p0-1-security-rbac` e storage temporaneo `STORAGE_TYPE=local`, `LOCAL_STORAGE_PATH=/tmp/m3mai-storage`. Questi dettagli storici vanno riconfermati sul runtime staging prima di attribuirgli lo stato attuale.

Anche i due file `.env` locali MEMAI letti oggi dichiarano `STORAGE_TYPE=local`. Non dimostrano che produzione usi storage locale: nel runtime Render produzione era stato verificato `STORAGE_TYPE=s3`, bucket `m3mai-core-vault` ed endpoint Cloudflare corretto.

Il frammento di audit ricevuto parla di «due ambienti» senza identificarli. La discrepanza produzione/staging appena descritta è verificata; non possiamo affermare che sia necessariamente l’unica coppia a cui quel frammento si riferiva. Se Claude rileva un altro deployment, deve riportarne URL, progetto, ambiente, SHA effettivo e origine della configurazione prima di dichiararlo duplicato o autoritativo. Nomi di variabili diversi tra CRM e backend sono possibili adattamenti fra componenti, non prova sufficiente di un guasto.

## 2. Repository corretti e stato Git

In questo dossier i prefissi indicano queste radici assolute:

```text
LIMEN = /Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN
CRM   = /Users/cesare/Documents/STEFANO PARMA PII ALL/PII_CRM
MEMAI = /Users/cesare/Documents/STEFANO PARMA PII ALL/m3mai
VAULT = /Users/cesare/Documents/VAULT
INSTALL = /Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL
```

### Stato verificato direttamente il 14 settembre

| Repository | Checkout locale | Remoto verificato / limite |
|---|---|---|
| `cesarenegro/vault_memai_obsi` | LIMEN, branch `main`, HEAD `8c8d6a9` | `git ls-remote` restituisce `8c8d6a9f9d6cd31f73f1e0f181b3f3da56ce09b5` per `refs/heads/main` |
| `cesarenegro/m3mai` | MEMAI, branch `codex/research-runtime`, HEAD `c7c47ee` | Remoto branch `c7c47ee4a424226f126667cae18353422c9fe203`; remoto main `bce9d617104f7ae46b01cab1e542a21abd9a8d5a` |
| `cesarenegro/PII_CRM` | CRM, branch `master`, HEAD `a7c47c4` | Numerose modifiche tracked e untracked presenti; una parte della consegna pubblicata è nel working tree, non rappresentata dal solo HEAD |

Correzioni alle informazioni ricevute da Claude:

1. «MEMAI locale fermo a `3f62887` del 31/08» **non corrisponde al percorso MEMAI sopra verificato**. Può descrivere un altro clone o un controllo precedente. Non resettare questo checkout per allinearlo a tale descrizione.
2. «I commit LIMEN `d4d64ba` e `8c8d6a9` sono solo locali, push bloccato» **non descrive più il remoto verificato oggi**: `main` su GitHub è già `8c8d6a9`. Ciò non dimostra che ogni token disponibile abbia diritto di scrittura; dimostra che il risultato di pubblicazione del branch è già presente. Non è necessario ripetere quel push per raggiungere lo stesso SHA.
3. LIMEN era pulito prima della creazione di questo dossier. Questo documento e gli aggiornamenti di checklist introducono ora sole modifiche documentali locali.
4. MEMAI aveva solo tre file untracked preesistenti fuori dalla consegna: `AGENT.md.bak-20260901003119`, `ZZ_ARCHITETTURA_MEMAI_CONSULENTE.md`, `ZZ_INGESTIONE_IMMAGINI.md`. Preservarli.
5. Nel CRM preservare sia i file modificati sia quelli non tracciati: bridge LIMEN, catalogo MEMAI, pagine Vault, API, componenti progetti/impostazioni, test e `.vercelignore`. Non fare `git reset`, `clean` o checkout globale.

Il backend in produzione al termine del 13 settembre eseguiva il codice `9043ff5aa8d34fef8ed33cf86b98d872378f7fba`; `c7c47ee` è il commit documentale successivo. Render era impostato sul branch `codex/research-runtime`, auto-deploy Off; main non era stato modificato da quel rilascio.

## 3. Mandato e metodo per Claude

Esegui un audit indipendente. Questo dossier è una mappa delle evidenze, non una richiesta di convalidare automaticamente le conclusioni precedenti.

- Leggi `AGENT.md` e/o `AGENTS.md` nelle tre radici, poi `TASK_LIST.md`, `TODO LIST.TXT` e gli handover.
- Una richiesta di audit non autorizza automaticamente correzioni, migrazioni, nuove pubblicazioni di note, modifica di flag, commit, push o deploy. Riporta i difetti con prove; applica eventuali successive autorizzazioni di Cesare nel loro perimetro.
- Non esportare `.env`, password, token, codici cloud, contenuto del Portachiavi o file credenziali. Per confrontare ambienti registra nomi delle variabili, presenza/assenza e valori non sensibili strettamente necessari.
- Registra per ogni prova: data, repository/percorso, SHA e working tree, ambiente, identità/ruolo di test, input, atteso, osservato e fonte dell’evidenza.
- Distingui difetto riprodotto, rischio da approfondire, documentazione obsoleta, prerequisito mancante e test non eseguito.
- Non rieseguire tutta la batteria senza motivo: una discrepanza, modifica o nuova esigenza di indipendenza del collaudo è un motivo da annotare.
- Dopo tre fallimenti della stessa azione, interrompi quella strategia. Non cambiare superficialmente strumento per ripeterla all’infinito.
- Per istruzioni operative su Render/Vercel/Supabase/GitHub verifica prima l’interfaccia odierna dell’account. I percorsi web sotto sono riferimenti del codice e dell’ultima consegna, non una certificazione delle schermate del 14 settembre.
- Claude qui è l’auditor scelto dall’utente. Questo NON richiede di aggiungere Anthropic al prodotto LIMEN. Le regole LIMEN autorizzano OpenAI/ChatGPT/Codex e future astrazioni locali; il codice Workbench MEMAI contiene anche un agente `claude`, che nell’ultima attivazione non è stato abilitato.

## 4. Che cos’è LIMEN Vault

LIMEN è un sistema di conoscenza locale per LIMEN / Packaging in Italy. Il suo archivio è una cartella di file Markdown con metadati YAML compatibile con Obsidian. Il Vault non è il database del CRM e non è il catalogo documenti MEMAI.

Obsidian permette di scrivere e organizzare le note. LIMEN aggiunge validazione della struttura, consultazione, ricerca locale, compilazione della conoscenza, snapshot/integrità SHA-256, interrogazione AI con fonti, bozze/proposte controllate e trasferimenti opzionali.

Il requisito architetturale è che accesso e funzioni locali pertinenti restino utilizzabili quando MEMAI, CRM, Render, Vercel o R2 non sono disponibili. Le funzioni cloud e OpenAI richiedono invece rete e configurazione. «Indipendente» non significa «privo di qualsiasi integrazione»: significa che tali integrazioni non devono diventare prerequisiti per aprire i file locali.

Tre passaggi diversi:

1. **Approvazione locale:** una nota è idonea all’uso governato secondo metadati e validazioni.
2. **Copia privata:** trasferisce la versione pianificata del Vault nel canale privato per recupero; non la rende catalogo CRM.
3. **Pubblicazione:** rende disponibile al consumer autorizzato la selezione esplicita di note approvate. Non equivale a pubblicazione anonima su Internet.

Non esiste una garanzia di replica continua bidirezionale Obsidian ↔ CRM ↔ MEMAI. I trasferimenti sono operazioni esplicite, con anteprima, selezione e conferma. La presenza nello stesso bucket non unifica cataloghi, permessi o significato dei dati.

## 5. Architettura e mappa del codice LIMEN

```text
Obsidian <--> Vault Markdown locale <--> UI React/Vite nella app Tauri
                                         |
                                         +--> IPC Rust: file, indice, snapshot, proposte
                                         +--> OpenAI opzionale con anteprima delle fonti
                                         +--> MCP locale / tunnel Business opzionali
                                         |
                                         +--> Worker autenticato LIMEN --> R2
                                                                          |
                                                              canale published
                                                                          |
                                                                server CRM autorizzato
```

| Area | Sorgenti da leggere sotto LIMEN |
|---|---|
| UI desktop italiana | `apps/desktop/src/App.tsx`, `locale.tsx`, pannelli `AiPanel`, `KnowledgePanel`, `ProposalPanel`, `SyncPanel`, `TunnelPanel` |
| Contratti IPC | `apps/desktop/src/*-ipc.ts` e `apps/desktop/src-tauri/src/main.rs` |
| Filesystem / conoscenza | `apps/desktop/src-tauri/src/vault.rs`, `knowledge.rs`, `compiler.rs`, `search.rs` |
| Snapshot / proposte | `apps/desktop/src-tauri/src/snapshots.rs`, `proposals.rs` |
| AI e credenziali | `apps/desktop/src-tauri/src/ai.rs`, `keychain.rs` |
| MCP / tunnel | `apps/desktop/src-tauri/src/mcp.rs`, `tunnel.rs`, `resources/mcp/` |
| Trasferimenti nativi | `apps/desktop/src-tauri/src/sync.rs` |
| Motori condivisi | `packages/vault-core`, `vault-schema`, `snapshot-engine`, `knowledge-compiler`, `search-engine`, `ai-engine`, `proposal-engine`, `sync-engine` |
| Gateway cloud | `services/vault-sync-api/worker.mjs`, `worker.test.mjs`, `wrangler.jsonc` |
| Struttura iniziale | `vault-template/` |
| Packaging | `tools/mac-installer/main.swift`, `scripts/m10-build-installer.sh`, `scripts/package-italian-dmg.sh`, script di firma M9/M10 |

La app consegnata usa Tauri 2, Rust, React e Vite; il monorepo usa pnpm. `apps/web` usa Next.js, ma la presenza di quella directory non dimostra che il suo eventuale deployment sia l’app desktop consegnata. La configurazione Tauri usa `frontendDist: ../dist`, non un sito CRM remoto.

Il file `docs/ARCHITECTURE.md` conserva formulazioni originarie molto forti come «zero runtime dependencies» e non elenca tutte le aggiunte M10. Leggerlo insieme al codice sync e all’handover recente: l’intento da verificare è l’indipendenza delle operazioni locali.

## 6. App nativa, lingua italiana e notarizzazione

Configurazione: `LIMEN/apps/desktop/src-tauri/tauri.conf.json`.

- Nome: LIMEN Vault; versione applicativa `0.2.0`; bundle ID `dev.arkai.limenvault`.
- Destinazione installata: `/Users/cesare/Applications/LIMEN Vault 0.2.0.app`.
- Requisiti della build consegnata: Apple Silicon, macOS 26.3 o successivo.
- Finestra iniziale 1280×840; risorse template Vault e componenti MCP incluse nel bundle.
- CSP del frontend limita connessioni a IPC: valutare anche codice Rust, capability e superfici native; la CSP da sola non certifica l’intera sicurezza.

Consegna italiana in INSTALL:

| File | Scopo | SHA-256 registrato alla consegna |
|---|---|---|
| `Installa-LIMEN-Vault-0.2.0-arm64.dmg` | Installer nativo guidato LIMEN + gestione Obsidian | `157e915e1262f1e7c2979477d90873b899c9064c31cf87e0d94e0fcf65c81288` |
| `LIMEN-Vault-0.2.0-arm64.dmg` | Pacchetto app LIMEN | `69ed92c0ad9c3c02c70a4222d6ef4c4979b05674f7168ccce330d7ea9d061ca9` |

Questi hash sono ripresi da `IMPLEMENTATION/UI_IT_EVIDENCE/notarized/delivery.json`, non ricalcolati oggi. Per associare un artefatto diverso alle evidenze, confrontarne prima l’hash.

L’installer installa sotto `~/Applications`, rileva Obsidian e, se assente, scarica la versione ufficiale 1.13.7 prevista da quella consegna, controllando firma e Gatekeeper. Non aggiornare implicitamente questa versione in un audit. L’aggiornamento dalla precedente 0.2.0 inglese conserva la app precedente e i dati; la destinazione non valida e il target ancora aperto sono stati collaudati come errori protetti.

Evidenze del 13 settembre: app LIMEN, DMG app, app installer e DMG installer con esito Apple Accepted, staple e Gatekeeper PASS; prova dal pacchetto finale e UI installata italiana. «Welcome to LIMEN Vault» è stato sostituito da «Benvenuto in LIMEN Vault». Undici sezioni visitate; metadati tecnici e contenuti dell’utente non sono tradotti automaticamente. Le voci aggiunte da macOS/Obsidian seguono la lingua dei rispettivi prodotti.

La versione inglese è conservata in `INSTALL/STORICO/2026-09-13-versione-inglese`. Il manuale esterno aggiornato è `LIMEN/manuale UI utente.txt`, con copia in INSTALL. Il manuale dentro il DMG rimane quello incluso alla notarizzazione: l’aggiornamento successivo delle istruzioni CRM nel file esterno non modifica il DMG già notarizzato.

Notarizzazione, firma e Gatekeeper non equivalgono ad audit di correttezza applicativa, autorizzazioni o qualità delle risposte AI.

## 7. Walkthrough desktop e significato degli undici menu

Riferimento operativo dettagliato: `LIMEN/manuale UI utente.txt`. I nomi sotto sono quelli della UI italiana implementata e collaudata nella consegna.

Per aprire il Vault esistente, usare il percorso VAULT nella schermata iniziale e l’apertura di un Vault esistente. «Crea nuovo Vault» è un’operazione diversa e non serve a riaprire la cartella attuale. Lo stato «Pronto» indica struttura valida, non note approvate né pubblicazione remota.

| Menu | Cosa fa | Cosa verificare nell’audit |
|---|---|---|
| Panoramica | Conteggi, percorso, accessi rapidi e integrità | Un file di sistema conta come Markdown, ma non come conoscenza pubblicabile |
| Chiedi al Vault | Prepara fonti locali e invia esplicitamente domanda/contesto a OpenAI | Anteprima e fonti reali, stato approved, inclusione bozze esplicita, scadenza/invalidation del contesto, citazioni |
| Conoscenza | Consulta note per categoria e relativa compilazione | Frontmatter, percorsi ammessi, distinzione conoscenza/fonti originali |
| Fonti | Consulta documenti originali del Vault | RAW non confuso con nota approvata; gestione delle fonti senza pubblicazioni automatiche |
| Ricerca | Indice locale e filtri | Aggiornamento indice, filtri, comportamento offline e lettura sicura |
| Risposte AI | Risposte salvate come bozze | Salvataggio distinto da approvazione e pubblicazione |
| Proposte | Revisioni e applicazione governata delle modifiche | Diff, stato, conflitti, conservazione dei dati e approvazione esplicita |
| Copie locali | Snapshot e recupero | Hash, manifesti, percorsi di destinazione e mancata sovrascrittura del Vault reale |
| Trasferimenti | Test cloud, copia privata, recupero, pubblicazione e ritiro | Anteprima, selezione, canale, conflitti, revoca e ripresa |
| Sistema | Diagnostica locale e rilevamento Obsidian | Le diciture d’indipendenza non sono un health check di Render |
| Impostazioni | Portachiavi OpenAI, MCP e tunnel opzionali, percorso Vault | Segreti esclusi dai log e dai bundle; revoca e ciclo di vita dei collegamenti |

Flusso conoscenza: scrittura/revisione in Obsidian → validazione/compilazione pertinente → approvazione locale → indice → consultazione AI con anteprima → eventuale bozza/proposta → pubblicazione esplicita delle sole note scelte.

Flusso cloud: collegamento autorizzato → test connessione → piano del trasferimento → controllo elenco → conferma → verifica esito. La nuova selezione pubblicata sostituisce quella precedente: non assumere un’aggiunta cumulativa implicita.

Flusso recupero: scelta di una versione privata → anteprima → importazione in un nuovo Vault → riapertura del percorso recuperato. Non usare la prova per sovrascrivere dati reali.

MCP locale è in lettura su note approvate e indicizzate; token e revoca sono distinti dalle credenziali R2. Il tunnel ChatGPT Business è opzionale e richiede il Mac/app attivi. La chiave API OpenAI e un abbonamento/collegamento ChatGPT Business sono configurazioni diverse. Auditare il comportamento effettivo dei client senza presumere che la sola dicitura «pronto» provi una lettura end-to-end.

## 8. R2, Worker e contratto di pubblicazione

Bucket condiviso confermato alla consegna: **`m3mai-core-vault`**. Binding Worker `VAULT`, definito in `services/vault-sync-api/wrangler.jsonc`.

```text
limen/<tenantId>/<vaultId>/private/...
limen/<tenantId>/<vaultId>/published/current.json
limen/<tenantId>/<vaultId>/published/releases/<releaseId>/manifest.json
limen/<tenantId>/<vaultId>/published/objects/<sha256>
```

Il Worker autentica bearer token tramite hash nei grant di `ACCESS_GRANTS`, controlla scadenza/revoca e ricava tenant, Vault, canali e facoltà di scrittura dal grant. Il client nativo non riceve le chiavi amministrative R2.

Route da verificare nel sorgente: `/v1/status`, `/<channel>/current`, `releases`, `object/<sha>`, `commit`, `release/<id>[/<sha>]`, `revoke` sotto `/v1`. Il commit valida manifesto, oggetti, hash, dimensioni e parent release; aggiorna il puntatore con condizioni ETag. La pubblicazione revocata o sostituita non deve restare leggibile attraverso il percorso consumer previsto. I byte già scaricati da un destinatario non possono essere cancellati retroattivamente da una revoca.

Canale published: note Markdown approvate nelle categorie 01–10, scelta esplicita; esclusione delle aree di sistema e delle fonti RAW. Canale private: copia dei file ammessi dal piano, con esclusioni di sicurezza da verificare nel codice; «private» non è una dichiarazione di cifratura end-to-end.

Limiti osservati nel Worker: 1.000 documenti per manifesto, 8 MiB per oggetto, 256 MiB totali, manifesto richiesta massimo 2 MiB. Il bridge CRM ha alcuni limiti/validazioni differenti: confrontarli nell’audit anziché presumere parità perfetta.

Punti di audit: canonicalizzazione coerente fra Rust/TypeScript/Worker/CRM, collisioni Unicode/case, path traversal e symlink, file modificati fra anteprima ed esecuzione, oggetti orfani dopo conflitto, revoca simultanea a lettura, isolamento tenant/Vault, esclusione segreti nelle copie private. Sono obiettivi di verifica, non vulnerabilità già dimostrate.

## 9. Come il CRM legge LIMEN e MEMAI

L’Archivio espone tre origini:

| Origine | Fonte reale | Lettura |
|---|---|---|
| Materiali CRM | Catalogo Supabase `materials` e flussi upload CRM | Meccanismo CRM esistente |
| MEMAI | API documenti del backend MEMAI | Elenco `/documents`, anteprima `/documents/{id}`; nessuna copia del catalogo in R2 creata per questa UI |
| LIMEN | Release corrente nel canale published R2 | Bridge server CRM, manifesto e oggetti verificati |

Il CRM legge R2 direttamente dal server tramite `lib/limen-bridge.ts`, con proprie credenziali server. **Non usa necessariamente il bearer grant del Worker:** sono due confini di autorizzazione distinti da auditare entrambi.

Configurazioni pertinenti, nomi soltanto:

- CRM→MEMAI: `MEMAI_API_URL`, autenticazione server in `lib/memai.ts` tramite token servizio oppure login configurato.
- CRM→LIMEN: `LIMEN_R2_BUCKET_NAME`, `LIMEN_TENANT_ID`, `LIMEN_VAULT_ID`, `LIMEN_ALLOWED_USER_IDS`, `LIMEN_ALLOWED_USER_EMAILS` e credenziali R2 server.
- Backend MEMAI→storage: `STORAGE_TYPE`, `AWS_S3_BUCKET` e configurazione S3/endpoint.
- Il bucket LIMEN è indipendente dalla variabile che instrada gli upload generici CRM. Non cambiare globalmente questi ultimi per sistemare LIMEN.

Il bridge richiede staff attivo per `m3mai`, poi l’allowlist sul Vault configurato. All’ultima verifica gli account autorizzati erano Admin/Superadmin; non è un accesso aperto ai clienti. La sola conoscenza di tenantId/VaultId non deve concedere lettura.

Il bridge verifica scope e hash del manifesto, release corrente, stato approved, appartenenza dell’oggetto alla release, dimensione e SHA-256 dei byte. Stati UI: `READY`, `NO_PUBLICATION`, `NOT_CONFIGURED`, `UNAVAILABLE`, `FORBIDDEN`. `NO_PUBLICATION` è compatibile con integrazione corretta e nessuna nota pubblicata; non significa automaticamente bucket errato.

File chiave sotto CRM:

- `lib/limen-bridge.ts`, `lib/r2.ts`, `lib/guard.ts`.
- `app/api/admin/limen/route.ts`: GET con action `status`, `search`, `read`.
- `app/admin/m3mai/vault/`, `app/admin/materials/page.tsx`.
- `app/admin/projects/[id]/ProjectLimenVaultTab.tsx` e integrazione `ProjectTabs.tsx`.
- `app/admin/settings/LimenSettingsSection.tsx`.
- `lib/memai-catalog.ts`, `app/admin/materials/MemaiCatalog.tsx`, `app/api/admin/materials/memai/route.ts`.
- `lib/memai.ts`, `app/admin/m3mai/actions.ts`.
- `tests/limen-bridge.test.cjs`, `memai-catalog.test.cjs`, `memai-research-http.test.cjs`.

### Contesto LIMEN nell’assistente CRM

`askMemaiAssistant` prepara il contesto tramite `buildLimenAiContext` quando la modalità non è `web_only`. Il bridge cerca per titolo/percorso e filtri, legge note con hash/release verificati, seleziona fino a quattro note per default e limita il contesto a circa 16.000 caratteri. Il testo è aggiunto alla query con delimitatori e istruzione di trattarlo come dati non attendibili, poi viene inviato a `/memai/query`.

Questo è un collegamento esplicito del contesto, non una migrazione delle note nel catalogo MEMAI e non la prova che ogni flusso generativo CRM usi LIMEN. Per esempio, auditare separatamente `generateBriefAction`; non generalizzare dal collegamento dell’assistente.

Verificare la gestione del contesto aggiunto nei diversi search mode, log e provider: una barriera testuale non basta da sola a dimostrare che contenuti privati non possano raggiungere una ricerca Web. Questa è una domanda aperta per l’audit end-to-end, non un difetto provato in questo dossier.

## 10. Mapping Cliente/Progetto e prova con note reali

Contratto attuale: frontmatter `client` e `project` della nota → metadati del manifesto pubblicato → filtri del bridge CRM per uguaglianza esatta con `clientId` e `projectId` ricevuti.

L’assistente CRM ha anche conversioni `ensureMemaiClient` / `ensureMemaiProject` verso identificativi MEMAI. **Non confondere questi identificativi con quelli usati per filtrare LIMEN:** il bridge riceve i valori del contesto CRM. Nomi visualizzati, slug, UUID CRM e ID MEMAI non sono automaticamente intercambiabili.

Ultimo stato del Vault reale: solo `00_SYSTEM/HOME.md` e `00_SYSTEM/VAULT_RULES.md`, nessuna nota conoscenza reale da pubblicare. Le fixture hanno verificato filtri ed esclusioni; non costituiscono collaudo reale Cliente/Progetto.

Prerequisito: Cesare deve indicare contenuto approvato e associazione Cliente/Progetto. Dopo autorizzazione, il piano di collaudo è:

1. Identificare esattamente record CRM e nota, validarne frontmatter secondo lo schema completo, annotare ID e hash.
2. Preparare il piano di pubblicazione; controllare che contenga soltanto la selezione approvata. Non pubblicare note di sistema per creare artificialmente un risultato.
3. Eseguire la pubblicazione autorizzata, registrando release e hash.
4. Verificare presenza nel contesto corretto e assenza in contesti Cliente/Progetto diversi.
5. Aprire la nota, confrontare byte/hash e controllare il contesto effettivo dell’assistente, senza attribuire alla UI una prova che non è stata eseguita.
6. Se autorizzato il collaudo di ritiro, verificare revoca, aggiornamento dei risultati e rifiuto della lettura attraverso riferimenti precedenti.

Usare fixture isolate per attacchi a hash, path e conflitti; non danneggiare il Vault reale o la pubblicazione aziendale.

## 11. MEMAI: salute e pre-deploy corretti

MEMAI è il backend FastAPI con propri documenti, governance e servizi di supporto. La consegna ha preservato storage e dati esistenti, senza migrazione o rielaborazione massiva per risolvere l’health.

Problema del 13 settembre: `/health` restituiva `degraded` per `ingestion_recovery` in ritardo; catalogo e anteprime funzionavano. Cron `m3mai-reconcile` era orario mentre il monitor attendeva 600 secondi. Corretto a `*/10 * * * *`. Heartbeat osservati alle 19:30:06 e 19:40:27 UTC; salute ok alle 19:47:14 UTC, dopo oltre 20 minuti. Health ancora ok dopo il rilascio ricerca. È importante controllare sia codice HTTP sia JSON: uno status HTTP da solo non esaurisce il significato di salute.

Il pre-deploy con comando shell quotato aveva causato exit 127; la concatenazione con `&&` non dava evidenza affidabile dell’esecuzione di entrambi gli script. Soluzione pubblicata: `python scripts/predeploy.py`, che esegue sequenzialmente validazione release e verifica migrazioni, fermandosi sul primo errore.

Entrambi START/PASS osservati nel deploy finale. Schema runtime `u1c2d3e4f5a6` uguale ad Alembic head; nessuna nuova migrazione creata per la ricerca. Non avviare manutenzione durante un deploy Render.

Sorgenti MEMAI: `apps/backend-fastapi/app/main.py`, `app/services/schedule_monitoring.py`, `scripts/predeploy.py`, `scripts/validate_production_release_config.py`, `scripts/migrate_and_verify.py`, `render.yaml`. Non esporre endpoint di debug per raggiungere Redis/Qdrant privati.

## 12. Workbench: stato reale, separato dall’Archivio

I vecchi avvisi «Workbench disabilitato» e «Ricerca multi-agent disabilitata» provenivano dai flag CRM prima delle chiamate API. Non dimostravano un malfunzionamento dell’Archivio LIMEN.

Flag CRM attivati: `MEMAI_WORKBENCH_ENABLED`, `MEMAI_VPRO_MULTI_AGENT_ENABLED`.
Backend: master Workbench e multi-agent attivi; Codex attivo con `MEMAI_WORKBENCH_CODEX_MODE=read`. Claude non abilitato nell’ultima configurazione verificata. Per stabilire una capability effettiva leggere sia policy runtime sia configurazione persistita per tenant: il tipo TypeScript o un default di GET non provano autorizzazione.

Workbench gestisce workspace versionati, export, cronologia, revoca e import di proposte pending. Collaudo effettivo: workspace vuoto `COLLAUDO ATTIVAZIONE 2026-09-13 - vuoto` creato, cronologia letta, revocato. Nessun export di corpus reale o import di proposte reali certificato da quella prova. Non chiamare questo «Workbench interamente collaudato con dati reali».

Sorgenti CRM: `lib/memai-workbench.ts`, `app/admin/m3mai/workbench/`.
Sorgenti MEMAI: `app/routers/workspaces.py`, `app/routers/settings.py`, servizi `workspace_registry.py`, `workspace_export.py`, `workbench_import.py`, `workbench_settings.py` sotto `apps/backend-fastapi`.
API: `/workspaces`, `/{id}/export`, `/{id}/import`, `/{id}/revoke`, `/{id}/history` sotto `/workspaces`; `/settings/workbench`.

## 13. Ricerca multi-agent: implementazione e limiti

Prima dell’ultimo intervento esistevano pagina/lista e servizi di base, ma mancava il collegamento completo per avviare una nuova ricerca. Attivare il flag non era sufficiente.

Implementato e pubblicato:

- POST `/research/jobs` con domanda, UUID di idempotenza, autorizzazione contributor, tenant derivato dalla sessione, allowlist se configurata e controllo provider.
- Limite di una ricerca attiva per tenant; lock di ammissione PostgreSQL.
- Dispatcher nel processo backend, attivo nel lifespan, con fino a due job contemporanei per processo e lock PostgreSQL per job. Non è stato aggiunto un nuovo worker Celery per questo flusso.
- Tre ricerche Web specialistiche sequenziali: fonti ufficiali/dati, alternative, limiti/criticità. Non sono tre agenti LLM autonomi con accesso al Vault.
- Ricerca attraverso provider Tavily esistente; sintesi con singola richiesta OpenAI asincrona cancellabile, senza tool o failover automatico verso altri provider.
- Checkpoint e risultati nelle tabelle esistenti `multi_agent_jobs` e `multi_agent_job_artifacts`; richiesta nel JSON del budget, fonti/risposta negli artifact. Nessuna colonna nuova.
- Risposta italiana, citazioni, fonti consultabili, stati queued/running/completed/partial/failed/cancelled e annullamento persistente.

Limiti effettivi dichiarati: 120 secondi, quattro chiamate, nove fonti, massimo 1.200 token di output per la sintesi. Costi e token consumati sono **n/d**: non c’è metering effettivo nel contratto usato. Non dichiarare verificato un tetto di spesa monetario o che la funzione sia gratuita. Auditare coerenza tra budget persistito e limiti effettivamente applicati.

Il runtime riserva la chiamata prima dell’operazione esterna e riprende dai checkpoint dopo riavvio. Una chiamata interrotta può consumare una quota senza produrre un artifact. Auditare interruzione, concorrenza fra repliche, esaurimento budget e starvation; i test locali non equivalgono a una prova di carico distribuita.

Sorgenti MEMAI: `app/routers/research.py`, `app/services/research_runtime.py`, `multi_agent_jobs.py`, `multi_agent_manager.py`, `web_sanitizer.py`, `web_search.py`, `app/utils/provider_gateway.py`, `app/schemas.py` sotto `apps/backend-fastapi`.
Sorgenti CRM: `lib/memai-research-jobs.ts`, `app/admin/m3mai/background/actions.ts`, `ResearchJobsClient.tsx`, `[id]/ResearchJobDetailClient.tsx`.

Primo collaudo CRM: errore 422 per corpo senza Content-Type JSON. Corretto usando l’opzione `json` di `memaiFetch`; aggiunto test che attraversa client ricerca e wrapper HTTP. Dimostrato che il test fallisce con il precedente invio body-only e passa con la correzione.

Evidenze reali del 13 settembre:

| Job | Esito |
|---|---|
| `c2af2b36-baa2-4dfb-b09e-175720e4da42` | Avviato da Safari Admin nel CRM; completed in 13.244079 s, sintesi italiana e 8 fonti |
| `b4182fcc-22c4-4271-aa20-cf3453ac3eba` | Completato prima del clic annulla; NON considerato prova di annullamento |
| `319f0fbd-aed4-4b42-9876-e4f7e26a843f` | API reali: running → cancelled; ancora cancelled dopo 3 s, senza risposta |

Le fonti sono etichettate come raccolte, con attendibilità da valutare. Il completamento del job non certifica accuratezza normativa o fattuale della sintesi.

## 14. Release, evidenze e verifiche già eseguite

Ultima consegna funzionale verificata il 13 settembre:

- Render Live: `dep-dajgdl0jo6nc73dp4lr0`, codice `9043ff5`, istanza osservata `vsh8p`.
- CRM Ready: `dpl_CSZPgsq6uTaMspWnTZJFVmAtpg6R`; URL `https://pii-b0e741qzr-cesares-projects-cda0db9c.vercel.app`, alias `pii-crm.vercel.app`.
- Backend: 436 test passed e 49 subtests passed; 23 skipped e 2 deselected preesistenti. Non riportare «tutti i test eseguiti» ignorando queste esclusioni.
- CRM: 12/12 test mirati, typecheck e build PASS; lint zero errori, un warning di direttiva eslint superflua.
- UI italiana: test/typecheck/build pnpm e build Tauri PASS; Rust 38 lib + 18 main PASS; prove delle undici sezioni e installazione effettiva italiana.
- HTTP finale: `/health` 200 con `status: ok`; `/research/jobs` anonimo 401; `/api/admin/limen` anonimo 403.
- Archivio MEMAI: 21 documenti e anteprima MERAVIA già verificati; non è un audit di accuratezza di tutto il corpus.

Evidenze sotto LIMEN:

| Percorso | Contenuto |
|---|---|
| `SESSION HANDOVER.MD` | Ultima ricostruzione di consegna; alcune informazioni Git del 13 sono superate dalla sezione 2 di questo dossier |
| `IMPLEMENTATION/2026-09-13_RESEARCH_RELEASE.md` | Implementazione, deploy, difetto JSON corretto e prove reali |
| `IMPLEMENTATION/research-release-http-2026-09-13.json` | HTTP finale; include un tentativo 404 su route inesistente annotato come NON prova della guardia |
| `IMPLEMENTATION/2026-09-13_MEMAI_ATTIVAZIONE.md` | Salute, flag, Workbench e storico dei tentativi di deploy |
| `IMPLEMENTATION/2026-09-13_UI_ITALIANA.md` | Traduzione e collaudo desktop |
| `IMPLEMENTATION/UI_IT_EVIDENCE/notarized/` | JSON notarizzazione, consegna, hash e test installer |
| `IMPLEMENTATION/M10_EVIDENCE/installer/` | Evidenze installer precedenti alla consegna italiana finale |
| `IMPLEMENTATION/2026-09-12_M10_AUDIT.md`, `2026-09-13_M10_PROGRESS.md` | Stato e limiti M10 nel relativo momento |
| `IMPLEMENTATION/2026-09-12_M9_CLOSURE.md`, `M9_RELEASE_NOTES.md` | Chiusura M9 e artefatti da preservare |

Nella cartella notarized sono conservati anche file con esiti rejected e tentativi precedenti. Correlare ID richiesta, hash e artefatto finale: non scegliere un JSON a caso per affermare che la consegna finale sia rifiutata o accettata.

## 15. Sequenza raccomandata dell’audit

1. **Identità:** fissare ambiente autoritativo, SHA distribuito e checkout completo; distinguere staging e produzione prima di qualsiasi confronto funzionale.
2. **Inventario senza mutazioni:** mappare route, guard, configurazioni, bucket/prefix e flussi. Registrare dati mancanti senza esporre segreti.
3. **Desktop locale:** validazione, lettura e ricerca; controlli filesystem; anteprime, bozze e approvazione. Provare errori e isolamento su fixture.
4. **Consegna macOS:** associare hash ai DMG finali e alle attestazioni; distinguere pacchetto, app installata e sorgenti attuali. Nuovi test solo se richiesti dall’audit o da discrepanze.
5. **Cloud LIMEN:** analizzare grant, canali, integrità, commit e revoca; consumer CRM indipendente dal Worker.
6. **CRM:** autenticazione, allowlist, filtri, lettura hash/release, catalogo MEMAI, separazione dagli upload generici.
7. **AI e governance:** provenienza del contesto, search mode, invio ai provider, prompt injection, import/export Workbench e stati pending/approved.
8. **Ricerca:** lifecycle, checkpoint, idempotenza, annullamento, failover assente, limiti reali e assenza metering.
9. **Operatività:** health con semantica JSON, cron, monitor, pre-deploy, versione schema, branch di rilascio e configurazione effettiva.
10. **Prove reali residue:** solo dopo disponibilità di contenuti approvati/dispositivi. Non trasformare fixture in certificazioni reali.

Comandi di riferimento, da eseguire nella radice corretta quando pertinenti; non sono stati rilanciati per scrivere questo dossier:

```text
LIMEN: pnpm test
       pnpm typecheck
       pnpm build
       (in sequenza; per modifiche native aggiungere test Rust/build Tauri pertinenti)

CRM:   node --test tests/*.test.cjs
       npx tsc --noEmit
       npm run build

MEMAI/apps/backend-fastapi:
       ./venv/bin/python -m pytest tests/ -q
```

Non lanciare script di firma, deploy, migrazione o recovery come se fossero test read-only. Non manipolare il database durante un deploy e non esporre servizi privati per facilitarne l’audit.

## 16. Residui e forma del rapporto richiesto

M10 rimane parziale per tre criteri reali:

- Collaudo note reali e mapping Cliente/Progetto: contenuto approvato e associazione non indicati.
- Secondo Mac non disponibile.
- Apertura offline M10 in account macOS pulito non certificata. Una prova M9 o sullo stesso account/Mac non soddisfa automaticamente questo criterio.

Inoltre il collaudo Workbench registrato riguarda un workspace vuoto e revocato; non copre ogni export/import con corpus reale. Le esclusioni test e il metering assente restano limiti dichiarati, non vanno occultati in una formula «tutto verificato».

Output atteso da Claude:

- Mappa ambienti con sorgenti e configurazioni effettive; eventuali differenze da questo dossier datate.
- Tabella risultati con severità, ambiente, file/funzione, evidenza riproducibile, impatto, correzione proposta e verifica necessaria.
- Elenco separato di comportamenti confermati, difetti dimostrati, rischi non ancora riprodotti e prove bloccate da prerequisiti.
- Stato conclusivo di ciascun flusso: locale, pubblicato, collaudato con fixture, collaudato realmente, non verificato.
- Nessuna attestazione generale di sicurezza/completamento dedotta da build, notarizzazione o un singolo HTTP 200.

Le incongruenze documentali devono essere corrette senza cancellare lo storico né il lavoro preesistente. Gli artefatti M9 congelati devono restare intatti. Questo audit può contestare qualunque implementazione descritta, ma deve farlo sul codice, ambiente e dati effettivamente corrispondenti alla consegna.
