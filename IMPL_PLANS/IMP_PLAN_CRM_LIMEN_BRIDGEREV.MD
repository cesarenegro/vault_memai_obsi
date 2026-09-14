# CRM ↔ LIMEN Vault — piano d’integrazione REV 1

12 settembre 2026. PROPOSTA, non implementata. Il repository e la UI corrente del vero CRM non sono stati verificati in questo incarico. I nomi di menu e i percorsi seguenti sono collocazioni proposte, non istruzioni su funzioni già esistenti. Evidenza locale: apps/web/app/page.tsx è soltanto la landing LIMEN con schede MEMAI/LIMEN, non il CRM.

## Vincolo UX prioritario

Applicare [UX_AI_INTEGRATION_REV.MD](UX_AI_INTEGRATION_REV.MD). Vista ordinaria: domanda e risposta con fonti; Vault e contesto Cliente/Progetto già associati. I selettori descritti sotto sono controlli facoltativi in Fonti o impostazioni avanzate, non passaggi obbligatori. Setup tecnico esclusivamente amministrativo e una tantum.

## 1. Cosa aggiungere al CRM

| Punto proposto | Funzione | Regola |
| --- | --- | --- |
| Menu principale: AI & Knowledge → LIMEN Vault | Elenco Vault autorizzati, ricerca, lettura e domanda sulle fonti | Permessi per tenant/utente/Vault; nessun accesso a copie private |
| Controllo secondario Fonti | Vault già selezionato, versione pubblicata, filtro Cliente/Progetto automatico; scelta manuale facoltativa | Ultimo aggiornamento visibile; mai chiamare live una copia R2 |
| Ask AI nel CRM | Campo domanda unico; in Fonti scelta facoltativa CRM / LIMEN Vault / CRM + LIMEN Vault | Inizialmente default CRM; combinazione solo esplicita, fonti e limiti visibili |
| Scheda Cliente e scheda Progetto | Tab Knowledge: documenti collegati, ricerca contestuale, Apri in LIMEN | Join per ID stabili autorizzati; non per nomi liberi |
| Impostazioni → Integrazioni → LIMEN Vault | Collegamenti tenant/Vault, ruoli, versione esposta, revoca | Solo admin autorizzato; nessuna chiave R2 nel browser |

Se il CRM possiede già un menu AI Knowledge, estenderlo; non creare una seconda area equivalente. MEMAI può rimanere un altro servizio disponibile: il selettore delle fonti non sostituisce il selettore del provider/modello. La scelta OpenAI/Codex e la scelta dei documenti sono livelli distinti.

## 2. Tre modalità da non confondere

1. **Aprire l’app locale:** pulsante Apri in LIMEN Vault. Richiede un protocollo deep-link di prodotto da implementare e registrare, con identificatore Vault opaco associato localmente. Non è già disponibile. Non inviare path assoluti, token o comandi nel link. Il desktop valida l’azione e chiede scelta se il Vault non è associato. App assente: mostra download e istruzioni, non falso stato Connected.
2. **Consultare dal CRM anche col Mac spento:** versione approved-only pubblicata mediante M10, conservata in R2 e letta via servizio autenticato. È la modalità standard proposta per il CRM. La data/versione sono sempre visibili.
3. **ChatGPT Business:** plugin già provato in M9, accesso al Mac tramite tunnel quando app e tunnel sono attivi. Non è un’API del CRM né abilita automaticamente le altre due modalità. Un eventuale accesso live CRM al Mac richiede un adapter/autenticazione separato, fuori dalla prima integrazione.

## 3. Flusso tecnico

Desktop → scelta documenti e pubblicazione esplicita M10 → manifest/indice coerenti della release pubblicata R2 → servizio autorizzato → backend CRM → UI.

Il CRM è consumer della conoscenza pubblicata; il Vault locale resta autorevole. Nessuna libreria CRM o dipendenza obbligatoria nel core LIMEN. Cloud o CRM indisponibili non devono intaccare M8. Un browser non legge direttamente la cartella Obsidian del Mac, e il bucket R2 da solo non è un motore di ricerca o una connessione AI.

## 4. Adapter backend CRM

Definire un’interfaccia provider-neutral e mappare l’identità reale del CRM al tenant e alle risorse autorizzate nel servizio M10. Contratti proposti, da adattare alle convenzioni del repository:
- listAuthorizedVaults(userContext): Vault visibili e release pubblicata disponibile;
- getPublication(vaultId, releaseId): versione/hash, data pubblicazione, stato e capacità;
- searchKnowledge(vaultId, releaseId, filters): risultati filtrati prima della risposta, snippet e documentId;
- readKnowledge(vaultId, releaseId, documentId, expectedHash): byte/versione esatti e provenienza;
- buildAiContext(selection): solo risultati autorizzati, limiti dimensioni/token, citazioni e versione;
- resolveLocalOpen(vaultId, documentId): deep-link senza segreti, dopo associazione locale supportata.

Applicare ACL a list, conteggi, ricerca, documenti e contesto AI. Controllare scadenza/revoca sul server, non soltanto nascondere pulsanti. Errori distinti NOT_CONFIGURED, UNAUTHORIZED, UNAVAILABLE, NO_PUBLICATION, STALE, READY; gestione timeout/retry limitata. Nessun fallback silenzioso da LIMEN a CRM o viceversa. Cache separata per tenant/utente/permessi/release, senza riutilizzare risposte dopo revoca.

## 5. Modello dati e governance

Proposta di entità logiche da adattare al database esistente, non migrazioni già autorizzate:
- vault_connections: tenant, vaultId, endpoint di servizio, canale pubblicato e abilitazione;
- vault_access: ruoli/utenti autorizzati per Vault e ambito Cliente/Progetto;
- knowledge_links: tenant, vaultId, documentId, crmClientId/crmProjectId e origine della mappatura;
- publication_status: releaseId/hash/date verificati; nessun duplicato del Vault usato come nuova fonte autorevole.

client/project frontmatter sono filtri descrittivi, non un’autorizzazione. Identificativi CRM stabili e tenant devono essere verificati nell’account/repository. Non introdurre SQL o policy RLS specifiche finché non è stato letto lo schema reale. Credenziali del servizio solo backend, rotazione/revoca documentate.

M7 continua a governare le approvazioni: il CRM non approva o sovrascrive automaticamente note locali. “Salva risultato” crea una bozza CRM oppure un export importabile esplicitamente in M7, senza inventare provenienza/modello/hash.

## 6. Sequenza d’implementazione

A. Audit del vero CRM: sidebar/router, schede Cliente/Progetto, Ask AI, auth/ruoli, database, deployment e design system. Individuare esatti file d’integrazione e produrre diff previsto.
B. Contratto adapter e policy: provider LIMEN facoltativo, API server e fixture per due tenant. Nessun accesso produzione per i test.
C. Pagina LIMEN nel menu già coerente col CRM: catalogo, selettore Vault/versione, ricerca/anteprima e stati onesti. Prima sola lettura, senza query AI.
D. Collegamenti Clienti/Progetti per ID, filtri autorizzati e tab Knowledge.
E. Ask AI: scelta CRM/LIMEN/combinata, anteprima fonti e citazioni; non attivare automaticamente la combinazione.
F. Launcher desktop opzionale dopo registrazione/validazione deep-link; aggiornare packaging/notarizzazione per i nuovi byte.
G. Collaudo del CRM reale con pubblicazione R2 reale, poi review di eventuali migrazioni e deploy con autorizzazione sulla destinazione.

Non serve implementare tutto insieme. Completare e verificare B/C prima di aggiungere AI e deep-link. M10 produce archivio/pubblicazione/servizio; questa integrazione modifica il CRM in un incarico distinto.

## 7. Accettazione

- Nessuna nota, snippet, conteggio o link di tenant/Cliente/Progetto non autorizzato.
- Solo documenti approvati e pubblicati esplicitamente; RAW/draft/output non consultabili.
- Query e lettura fissano la stessa release, hash/citazioni coerenti; contenuto modificato non presentato come versione precedente.
- Mac spento: lettura R2 funziona e dichiara versione/data. R2 indisponibile: errore o copia cache esplicitamente marcata; nessuna disponibilità inventata.
- CRM spento/revocato: LIMEN locale continua a funzionare.
- Revoca utente/connessione effettiva sul backend e cache; URL brevi e segreti assenti dai log/browser.
- Combinazione fonti non aggiunge documenti fuori permesso o risultati di un altro provider senza scelta.
- Deep-link ostile/identità non associata non apre path arbitrari, non esegue comandi e non scrive nel Vault.
- Prove UI reali sul CRM; mock non equivalgono a integrazione. Test/migrazioni/deploy secondo regole del repository CRM verificato.

Primo passo necessario quando si autorizzerà l’implementazione: accesso al repository e all’ambiente CRM di test. Questo piano non ne presume URL, schema o menu correnti.
