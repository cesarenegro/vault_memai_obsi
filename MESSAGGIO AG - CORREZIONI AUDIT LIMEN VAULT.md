# Incarico per AG — chiusura delle non conformità LIMEN Vault

Data: 19 settembre 2026. Workspace: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`.

Il lavoro NON è accettato come completo. L’app consegnata è notarizzata, ma l’audit ha rilevato difetti funzionali e criteri A01…A16 sostituiti nel report. Prosegui autonomamente fino alla risoluzione delle non conformità e al completamento del piano originario; non chiedere conferma a ogni pacchetto. Claude sarà l’auditor indipendente del progetto.

Leggi `AGENT.md`, `IMPL_PLANS/IMP_PLAN_MEMORIA_AZIENDALE_UI_UX.MD`, `IMPLEMENTATION/2026-09-19_AUDIT_REPORT_AG.md`, `TASK_LIST.md` e `TODO LIST.TXT`. Il presente incarico chiarisce la chiusura dell’audit; non riduce il piano MA-01…MA-12 alle sole sei correzioni seguenti.

## R1 — Ripristina criteri ed evidenze reali

Ripristina esattamente gli A01…A16 del piano. Non sostituirli con comandi di build, test generici o notarizzazione. Conserva il vecchio report come storico e correggi le dichiarazioni non dimostrate. Per ogni criterio indica requisito, test, input/dataset, comando, risultato grezzo, data e checkout/artefatto verificato.

A05: almeno 40 parafrasi su almeno 100 documenti distinti, gold congelato prima del tuning, Recall@10 ≥0,90 con embeddings reali. A15: 1.000 documenti, almeno 10.000 passaggi, almeno 100 query, p95 della ricerca locale calda ≤1 secondo, hardware e misure documentati. Queste prove sono diverse dalla parità nativa e dalla notarizzazione. Se una prova manca, il criterio resta aperto; non ridurre soglie, corpus o asserzioni per dichiarare PASS.

## R2 — Collega la semantica al prodotto

Oggi i moduli embeddings/ibrido esistono, ma App.tsx e ai.rs usano il percorso lessicale. Collega produzione incrementale degli embeddings e retrieval ibrido ai percorsi effettivamente utilizzati da Ricerca e Chiedi. La presenza di comandi IPC non equivale a una funzione raggiungibile dall’utente.

Leggi la chiave dal Portachiavi nel backend Rust; rimuovi dai comandi di ricerca/sincronizzazione il requisito di passare la chiave dal frontend. Il campo per inserire inizialmente una key resta un’operazione distinta, senza persistenza nel frontend. Rispetta configurazione e autorizzazioni AI esistenti; niente trasmissione implicita dei documenti aziendali per i test. Mostra copertura semantica e fallback; senza rete/API la ricerca locale deve continuare. Prova dalla UI una parafrasi senza corrispondenza dei termini centrali e dimostra quale passaggio è recuperato.

## R3 — Applica ammissibilità e filtri prima dei limiti

Correggi il percorso reale di ai.rs: non prendere prima 50 risultati per poi eliminare quelli non ammessi. Policy, revisione e filtri devono precedere il top-k finale. Allinea lessicale e semantico per cliente/progetto/categoria/tag/stato; applica offset/limit una sola volta dopo fusione e ordinamento, senza perdere candidati per un limite prematuro.

Test obbligatorio: oltre 50 proposte legacy più forti lessicalmente non devono nascondere una fonte ammessa. Nessuna approvazione fittizia delle bozze per far funzionare il test.

## R4 — Verifica davvero documento, testo, passaggio e revisione

Implementa un contratto coerente di apertura con documentId, revisionId, passageId e hash atteso. La funzione descritta nel tuo report non risulta presente: usa nomi reali e dimostra i chiamanti, non soltanto il test di un helper scollegato.

DocumentReaderModal deve usare il servizio verificato; readDocumentText non può limitarsi a concatenare testo non verificato dal catalogo. Verifica provenienza della rappresentazione estratta e corrispondenza alla revisione richiesta. Se il documento cambia dopo la risposta, apri la revisione storica verificata e dichiarata, oppure segnala che non è disponibile: mai sostituirla silenziosamente con quella corrente. Testa originale modificato/rimosso, passaggio alterato, testo estratto alterato e cambio revisione tra risposta e clic. Preserva la consultabilità delle copie storiche legittime.

## R5 — Elimina il limite dei primi 50 documenti nel lettore

Non risolvere un percorso con listCatalogDocuments senza paginazione seguito da find. Passa l’ID canonico da ricerca, inventario e citazioni. Per i riferimenti legacy usa lookup nativo diretto per percorso completo validato/alias; nessuna scelta arbitraria del primo nome file corrispondente.

Prova con almeno 60 documenti: il documento oltre la prima pagina deve aprirsi da elenco, ricerca e citazione. Aggiungi due file omonimi in cartelle diverse e verifica che si apra quello corretto.

## R6 — Separa locator descrittivo e ID del passaggio

Correggi la catena AiPanel → App → DocumentReaderModal: `locator` serve alla visualizzazione, `passageId` all’identificazione e allo scroll. Non usare `locator || passageId` come ID. Usa un DTO esplicito, includendo revisione/hash. Prova una citazione in un passaggio non iniziale e verifica visivamente che il lettore raggiunga ed evidenzi proprio quel passaggio.

## Completamento del piano, non soltanto dei sei difetti

Ricontrolla tutti i criteri MA-01…MA-12 e le checkbox segnate complete. Verifica in particolare: ingestion offline e coda nativa, aggiornamento automatico di nuovi/modificati/rimossi, gestione guasti isolati, migrazione idempotente e rollback, nota/wiki correnti rispetto alla cronologia, persistenza domande, tre aree UI, copie automatiche coerenti e recupero in cartella separata. La presenza del comando snapshot_restore non dimostra da sola tutte le richieste MA-10.

La priorità rimane: ogni originale acquisito apribile; testo estratto ricercabile senza API; classificazione/wiki non bloccanti; nessuna perdita di documenti; risultati e citazioni sul documento, revisione e passaggio corretti. Nome LIMEN Vault v3 invariato, pulsante globale CARICA DOCUMENTI lime/nero. Nessun rebranding, deploy CRM o pubblicazione GitHub/sito.

Conserva checkout sporco, note umane, originali, proposte e pacchetti precedenti. Test distruttivi solo su fixture/copie isolate. Dopo tre tentativi falliti della stessa azione fermala e registra la causa; non ripartire con un comando equivalente. Il precedente residuo HTTP 429 non si risolve azzerando il contatore.

## Verifiche e consegna all’auditor

1. Aggiungi regressioni riproducibili R1…R6 e verifica i percorsi effettivi della UI, non soltanto helper o mock.
2. Esegui sul checkout finale `pnpm test` → `pnpm typecheck` → `pnpm build` in sequenza, più Rust, parità e native e2e pertinenti. Registra anche errori e limiti; non presentare test di lettura/catalogo come una risposta AI reale.
3. Esegui e documenta gli A01…A16 originali, separando provider simulato/reale, analisi statica/prova UI e prestazioni locali/latenza API.
4. Aggiorna HELP/guide e rendi coerenti codice, interfaccia, task list e report.
5. Consegna a Claude un dossier con diff/identità checkout, elenco file, mappa criterio→evidenza, log grezzi, corpus/gold, metriche e istruzioni di riproduzione; nessun segreto o documento aziendale nei log. Il verdetto indipendente è di Claude, non di AG.
6. La consegna finale rimane unica. Dopo le correzioni prepara una nuova build e notarizzazione: il vecchio ticket non copre il binario modificato. Fornisci digest dei sorgenti/build e SHA-256 degli artefatti per collegare codice collaudato, app e DMG. Non riutilizzare cartelle di evidenze sovrascrivendo quelle precedenti.
7. Aggiorna TASK_LIST.md e TODO LIST.TXT prima del resoconto. Distingui implementato locale, verificato, consegnato e accettato dall’auditor. Se un criterio resta non verificabile, dichiaralo aperto; niente “100% completo”.

Destinazione della consegna finale: `/Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL/`, app `LIMEN Vault v3.app` e DMG `LIMEN-Vault-v3-arm64.dmg`, più `/Applications/LIMEN Vault v3.app`, preservando i precedenti in STORICO. Non interrompere l’app in uso o perdere input dell’utente. Nessun commit/push/deploy implicito.
