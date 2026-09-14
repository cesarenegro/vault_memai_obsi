# M10REV — copie versionate R2 e pubblicazione controllata della conoscenza

Data: 12 settembre 2026. REV 2, aggiornata dopo chiusura M9. Stato: implementazione parziale in corso; vedere TASK_LIST.md. Checklist: ../TASK_LIST.md. Questa richiesta autorizza la redazione; non crea bucket, credenziali, deploy o modifiche CRM. M9 è completata in locale; nessuna pubblicazione effettuata.

## Requisito UX prioritario

Applicare [UX_AI_INTEGRATION_REV.MD](UX_AI_INTEGRATION_REV.MD): setup amministrativo una tantum, pulsanti Collega ChatGPT Business / Attiva AI, modello predefinito verificato, contesto automatico autorizzato e nessun ID tecnico nel flusso ordinario. Questa richiesta aggiorna i criteri del piano, non dichiara implementata una connessione automatica.

## Decisione bucket — 13 settembre 2026

L’utente ha scelto il bucket Cloudflare R2 esistente `m3mai-core-vault`, condiviso con MEMAI e CRM. Non creare un bucket per ogni applicazione. I nuovi oggetti M10 devono stare in un namespace dedicato e verificato privo di collisioni, con isolamento ambiente/tenant/Vault e autorizzazione server. Le pubblicazioni condivise devono essere consumate dalla stessa fonte; i backup privati non diventano automaticamente leggibili da MEMAI/CRM. Non migrare, sovrascrivere o cancellare gli oggetti esistenti. La scelta del bucket non certifica accessi o collaudi né autorizza modifiche a policy pubbliche o deploy.

## 1. Baseline verificata

- M2–M8 completate in locale secondo i rapporti. Snapshot M3, ricerca M5, AI/MCP M6 e revisione umana M7 disponibili.
- M9 completata: app/DMG 0.1.0 ARM64 firmati e notarizzati, Gatekeeper PASS; API/Codex/Business e lifecycle verificati, Guest avviato con Vault READY secondo conferma manuale dell’utente. Rapporto ../IMPLEMENTATION/2026-09-12_M9_CLOSURE.md.
- Nessun package sync-engine implementato nel checkout. Questa revisione sostituisce la precedente bozza M10REV, mantenendo separati piano e implementazione.
- apps/web/app/page.tsx è una landing AI Knowledge con schede MEMAI e LIMEN. Non è il CRM e non dimostra che il CRM abbia già questi menu o servizi.
- Il Vault resta autorevole in locale. Spegnimento del cloud o del CRM non impedisce apertura, consultazione, ricerca, compilazione e gestione dei dati già disponibili.

## 2. Perimetro e sequenza scelta

M10.1–M10.7 realizzano trasferimento esplicito di versioni immutabili, recupero verificato e pubblicazione selettiva. Non introdurre un mirror bidirezionale con cancellazioni o merge automatici. Chiamare le operazioni “Carica versione”, “Scarica copia” e “Pubblica conoscenza”, evitando un pulsante “Sync” dal significato ambiguo.

Due canali distinti, con autorizzazioni e manifest diversi:

1. **Copia privata del Vault:** archivio recuperabile dei file scelti, incluse fonti e revisioni quando selezionate. Non visibile al CRM per effetto del solo upload.
2. **Conoscenza pubblicata:** insieme esplicito di note approvate nelle categorie 01–10, controllato dall’utente. Accessibile al CRM solo attraverso autorizzazione server. Nessuna condivisione automatica di RAW, output o proposte.

Primo rilascio: pubblicazione manuale da un dispositivo designato per Vault; download consentito su altri dispositivi. Due pubblicazioni concorrenti non si sovrascrivono: confronto della versione base e conflitto esplicito. Editing collaborativo, propagazione cancellazioni, merge Markdown, watcher e sync in background fuori perimetro.

## 3. Architettura proposta

Desktop Rust → servizio opzionale Cloudflare Worker → bucket R2 privato. Il Worker gestisce identità, appartenenza al tenant/Vault, sessioni di upload, commit e letture autorizzate. Il core locale non importa né chiama il CRM. Il browser CRM non riceve chiavi R2 o accesso al filesystem del Mac.

- Credenziali infrastrutturali solo nel servizio. Token desktop revocabile e limitato al Vault, conservato nel Portachiavi, distinto da OpenAI e tunnel Business.
- Identità cloud da definire con il sistema di autenticazione realmente disponibile prima di implementare l’adapter. Non inventare JWT, tenant o endpoint del CRM. Il servizio opzionale può rifiutare login senza bloccare le funzioni locali.
- R2 come object store privato, senza bucket pubblico o URL permanenti ai contenuti. URL presigned brevi solo per operazioni/oggetti autorizzati; log e telemetria non devono conservarne i parametri firma.
- Separare prefissi e privilegi di archivio privato e pubblicazione, preferibilmente anche bucket. Nomi oggetto opachi, nessun percorso locale o nome cliente come autorità di accesso.
- Cifratura in transito e a riposo da verificare sull’infrastruttura scelta. Non dichiarare cifratura end-to-end: la pubblicazione deve poter essere letta dal servizio autorizzato. Un archivio con cifratura client-side e recupero chiavi è una futura estensione separata, non un algoritmo da improvvisare.

## 4. Identità e contratti versionati

Nuovo registro locale 00_SYSTEM/SYNC_PROFILE.json con schemaVersion, vaultId stabile casuale, deviceId, endpoint e ultimo commit verificato. Nessun segreto. Il suo inserimento è una modifica di sistema esplicita: non riscrivere VAULT_MANIFEST per nascondere discrepanze. L’identità Vault non deriva dal nome o dal percorso del Mac.

Un manifest immutabile per release contiene: schemaVersion, channel (private/published), tenantId, vaultId, releaseId, parentReleaseId, createdAt, deviceId, selezione, versione formato, lista ordinata di documenti (id, percorso relativo normalizzato, SHA-256 applicativo, dimensione, tipo, stato, riferimento oggetto), hash canonico del manifest. Definire serializzazione canonica prima dei test. ETag del trasporto non è il SHA-256 del documento.

Schema oggetti proposto: <tenantId>/<vaultId>/<channel>/objects/<sha256> e releases/<releaseId>/manifest.json. Nessuna deduplicazione tra tenant. Un riferimento “current” è aggiornato solo dopo commit riuscito e confronto con la versione base; il lettore fissa un releaseId per tutta la sessione di ricerca/lettura.

Contratti proposti, da implementare con validazione comune:
- inspectLocal / planUpload / beginUpload / uploadObject / finalizeRelease / listReleases;
- planDownload / downloadRelease / verifyRelease / importAsNewVault;
- publishApproved / revokePublication / getTransferStatus / cancelTransfer.
Risultati strutturati: operationId, stato, avanzamento byte/file, errori per oggetto, conflitti, id versione verificata. Nessun boolean generico “success” su copie parziali.

## 5. M10.1 — acquisizione locale coerente

1. Congelare un inventario della baseline e contratti M3/M7; non modificare i writer M7 per comodità del sync.
2. Richiedere assenza di journal M7 pendente e operazioni locali in corso. Acquisire una copia immutabile usando i componenti M3 pertinenti, senza includere SNAPSHOTS ricorsivamente.
3. Mostrare anteprima precisa di file, dimensioni e cartelle comprese/escluse. Nessun trasferimento prima della scelta dell’utente.
4. Copia privata: note, RAW selezionati, output/proposte/revisioni e relativo stato M7 coerente; file di sistema necessari al recupero. Escludere lock, pending/journal non risolti, indici rigenerabili, cache, .obsidian, configurazioni cloud/device, chiavi, log e artefatti runtime. Le esclusioni devono essere visibili e testate, non un generico filtro “hidden”.
5. Pubblicazione: solo file con frontmatter esplicito status: approved e categoria ufficiale, validati. Non applicare implicitamente il default approved dello schema a note prive di stato. Anteprima obbligatoria: approved non equivale a consenso alla condivisione o a permesso CRM.
6. Rilevare modifica durante acquisizione; interrompere con conflitto oppure produrre una versione coerente già congelata. Non calcolare il manifest da byte diversi da quelli caricati.

## 6. M10.2 — upload, commit e concorrenza

- Stato locale persistente fuori dal contenuto condiviso, con operationId idempotente. Mai caricare due versioni per un retry dello stesso commit.
- Caricare oggetti immutabili mancanti, verificando dimensione e hash dei byte. Il servizio deve validare il manifest e la presenza/integrità di tutti gli oggetti prima della pubblicazione; se i limiti Worker impediscono la verifica completa, scegliere un job adatto o limitare la dimensione iniziale. Non sostituirla con un confronto del solo ETag.
- Manifest scritto dopo i dati; puntatore current cambiato per ultimo con scrittura condizionale sulla versione base. Usare un unico meccanismo CAS server, verificato sulla API effettiva, anche per creazione iniziale concorrente. Mai get-then-put senza condizione.
- Oggetti incompleti non compaiono come release disponibili. Errore ambiguo dopo commit: rileggere operationId/releaseId prima di riprovare.
- Retry massimo 3 per errori transitori, con backoff e jitter; 401/403 interrompono. Cancellazione libera le sole risorse dell’operazione; upload multipart incompleti richiedono cleanup circoscritto.
- Quote e limiti espliciti: dimensione per file/release, numero documenti, profondità path, concorrenza e budget trasferimenti. Valori da configurare e verificare prima del banco reale; niente promesse illimitate.
- Una versione eliminata localmente non viene eliminata dal cloud; retention automatica disabilitata nel primo rilascio. Nessuna garbage collection capace di eliminare oggetti ancora referenziati.

## 7. M10.3 — download e recupero

- Download in nuova directory di staging, mai sul Vault aperto. Validazione preventiva dei path: assoluti, traversal, symlink, file speciali, collisioni Unicode/case-insensitive e limiti rifiutati.
- Verifica manifest, hash e dimensione di ogni oggetto prima di rendere utilizzabile la copia. Hash prova integrità rispetto al manifest; autenticità dipende dall’identità/politica di pubblicazione, non dal solo SHA-256.
- Ricostruire gli indici derivati esplicitamente. Preservare stato M7 e revisioni senza importare token, deviceId o lock da un altro Mac. Assegnare nuovo deviceId, mantenere vaultId soltanto per una copia autorizzata dello stesso Vault.
- Importare esclusivamente come nuovo Vault/cartella. Nessun overwrite, merge, approvazione o ripristino in-place implicito. Copia selettiva non sufficiente a un Vault valido: segnalarla come export, non READY.
- Disco pieno, kill e rete persa lasciano staging identificabile; il Vault originale rimane intatto. Recupero/ripresa idempotente e cleanup soltanto della propria operazione.

## 8. M10.4 — pubblicazione e consumo CRM

Produrre una vista pubblicata distinta dalle copie private. Il CRM legge tramite servizio autenticato: catalogo Vault autorizzati, versioni, ricerca e documento esatto per id/hash. Non serve a leggere una directory macOS da un browser.

- Autorizzazione tenant + Vault + documento lato server, applicata prima della ricerca. Nessun risultato, snippet o conteggio di altri tenant.
- Campo client/project frontmatter utile come filtro, mai come prova di autorizzazione. Mappatura esplicita verso ID CRM stabili, in registro di integrazione; niente join per nome libero.
- Pubblicazione usa release immutable, indice coerente con quella release e versionId obbligatorio in ogni risposta. Fallback a versione precedente solo dichiarato e scelto dall’utente; indicare data e versione, mai “live”.
- Pubblicazione nuova non approva note. Ritiro rimuove la visibilità futura nella vista pubblicata; non garantisce cancellazione di copie già esportate. Sessioni, URL temporanei e cache devono rispettare il modello di revoca documentato.
- Output AI provenienti dal CRM restano bozze CRM o export/import esplicito M7: nessun tool remoto per approvare o sovrascrivere il Vault.
- M10 consegna contratto e servizio di consultazione. Modifica dei menu e adapter del vero CRM in fase successiva dedicata, descritta in IMP_PLAN_CRM_LIMEN_BRIDGEREV.MD; non requisito nascosto di M10.

## 9. M10.5 — UI desktop

Settings → Cloud copy (R2), disattivato di default: account/endpoint, stato, test connessione senza contenuti, disconnetti. Credenziali mai mostrate in log o URL.

Nuova vista Trasferimenti: Carica versione / Scarica copia / Pubblica conoscenza; selettore Vault, canale, versione, anteprima, progressi, annulla, errori e conflitti. Stati distinti DISABLED, NOT_CONFIGURED, OFFLINE, READY, TRANSFERRING, VERIFYING, CONFLICT, AUTH_REQUIRED, FAILED. “READY” del Vault resta separato dallo stato cloud.

Cloud spento o token revocato: funzioni locali inalterate. Nessun collegamento automatico al login e nessun upload al semplice avvio/app opening.

## 10. File candidati

- packages/sync-engine/src/: schema, contratti, manifest canonico, piano trasferimento e test del protocollo; nessun writer locale alternativo al runtime nativo.
- apps/desktop/src-tauri/src/sync/: acquisizione, journal trasferimenti, client, importazione e credenziali; registrazione IPC in main.rs.
- apps/desktop/src/SyncPanel.tsx e sync-ipc.ts; collegamento minimo App.tsx coerente col design.
- services/vault-sync-api/: Worker opzionale e adapter identità, policy/tenant, sessioni upload e commit CAS. Nessuna dipendenza inversa dal desktop/core al CRM.
- docs/SYNC_PROTOCOL.md, docs/SYNC_RECOVERY.md; script/evidenze M10; aggiornamento manuale e checklist.
- Guardie: mantenere divieti provider e dipendenze CRM nel core. Aggiungere controlli dei confini architetturali; non eliminare termini dalle guardie per far passare un’integrazione impropria.

## 11. Matrice di accettazione obbligatoria

| Scenario | Evidenza richiesta |
| --- | --- |
| R2/token/servizio assenti | Tutti i flussi locali M8 pertinenti funzionano, nessuna chiamata cloud necessaria |
| Upload reale e secondo dispositivo isolato | Release completa scaricata, hash byte-per-byte, apertura valida e revisioni M7 consultabili |
| Pubblicazione selettiva | Solo note approvate selezionate; RAW/draft/output non esposti né nei risultati né nei metadati |
| Isolamento tenant | Tentativi incrociati falliscono per list/search/read/upload/commit; nessuno snippet/conteggio estraneo |
| Concorrenza | Due writer dalla stessa base: un commit vincente, altro CONFLICT; nessuna perdita versione |
| Retry/risposta persa | Una operationId produce una sola release; recovery distingue commit effettuato da incompleto |
| Rete persa/401/403 | Retry limitati, stato chiaro, annullamento efficace e UI locale reattiva |
| Kill/disco pieno/corruzione | Originali invariati, staging non utilizzabile come Vault valido, ripresa o errore esplicito |
| Path e metadati ostili | Traversal/symlink/collisioni e manifest fuori limite rifiutati |
| Revoca cloud/pubblicazione | Accesso nuovo negato secondo scadenze documentate; nessun segreto in log, bundle o export |
| CRM consumer di prova | Fissa release, rispetta ACL, restituisce id/hash/fonti; nessuna scrittura o auto-approvazione |
| Packaging | Componenti e risorse inclusi nel nuovo candidato firmato, zero dipendenza checkout/Node per desktop |

Unità/protocollo + test Rust + integrazione su bucket di test vero. Mock utili per fault injection ma non sostituiscono rete/account/trasferimento reali. Due processi sullo stesso Mac non certificano automaticamente due dispositivi: registrare il banco effettivo e lasciare aperto l’eventuale requisito non provato.

Prima della chiusura: pnpm test → pnpm typecheck → pnpm build in sequenza, Rust e build Tauri, E2E delle nuove UI, regressioni M3/M7/M8 pertinenti. La release con nuovi byte richiede nuove verifiche M9 di firma/notarizzazione: non riutilizzare il ticket di un vecchio binario.

## 12. Prerequisiti da risolvere prima dell’implementazione cloud

Account/bucket test e relativo owner; identità/autenticazione del servizio; utenti/tenant/Vault autorizzati; volumi massimi e quota costi; selezione dati realmente condivisibili; banco secondo dispositivo. Non richiedere segreti in chat. Nessun acquisto, deploy o modifica produzione senza incarico relativo alla destinazione.

M10 va sviluppata isolatamente dalla release M9 già congelata, senza modificare gli artefatti distribuiti o le evidenze di quella release. Nessun commit o worktree distruttivo sul lavoro locale di AG/Codex. La chiusura richiede tutta la matrice, manuale recupero, evidenze e checklist; il piano non costituisce chiusura.

## Fonti tecniche verificate

Consultate il 12 settembre 2026, documentazione ufficiale (non verifica dell’account Cloudflare):
- [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/): verificare operazioni effettive; non assumere versioning/ACL S3 completi. Le versioni del progetto sono oggetti immutabili applicativi.
- [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/): consistenza dello storage non sostituisce il protocollo di commit/conflitto né invalida cache applicative.
- [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/): API per le condizioni di scrittura da usare e testare nel servizio.
- [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/): accessi temporanei a oggetti/operazioni, da trattare come credenziali bearer.

## 13. Ordine esecutivo e consegne verificabili

| Fase | Consegna | Condizione per passare oltre |
| --- | --- | --- |
| M10.1 | Schema/manifest, identità Vault e acquisizione coerente | Fixture M3/M7, hash e inclusioni/esclusioni verificati |
| M10.2 | Servizio opzionale, autorizzazione e upload/commit CAS | Bucket test reale, isolamento tenant e conflitti PASS |
| M10.3 | Download verificato e import come nuova copia | Secondo banco, kill/ENOSPC/corruzione PASS |
| M10.4 | Vista pubblicata approved-only e contratto consumer | Nessun RAW/draft esposto; ACL applicate prima della ricerca |
| M10.5 | UI desktop e gestione stato/annullamento | E2E reale delle tre operazioni e fallback offline PASS |
| M10.6 | Regressioni, sicurezza e banco end-to-end | Matrice completa, test finali e limiti documentati |
| M10.7 | Manuale, evidenze e nuova release | Nuovi artefatti firmati/notarizzati, checklist completa |

Implementare una fase alla volta. Il lavoro CRM parte dalla verifica del suo repository e del modello identità; usa il contratto M10.4 stabilizzato, senza attendere interventi cosmetici né confondere consumer di prova e CRM reale. Dettaglio: [IMP_PLAN_CRM_LIMEN_BRIDGEREV.MD](IMP_PLAN_CRM_LIMEN_BRIDGEREV.MD).
