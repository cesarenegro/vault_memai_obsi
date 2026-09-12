# M7REV — Output AI e proposte con revisione umana

Data: 12 settembre 2026. Versione: REV 1, revisione richiesta dall’utente. Stato: piano definito; implementazione e accettazione da eseguire. Checklist operativa: ../TASK_LIST.md, sezione M7.

## Baseline verificata e obiettivo

M4 crea revisioni draft in 90_PROPOSALS e ne mostra elenco/anteprima. M5 ricerca anche proposte e output AI. packages/proposal-engine contiene soltanto contratti: createProposal, listProposals e approveProposal che restituisce boolean. La schermata AI Outputs è ancora un segnaposto. M6REV separa consultazione in sola lettura da salvataggio/promozione M7; la presenza dei file AI non certifica i tre E2E M6.

Permettere salvataggio esplicito di risposte AI, creazione/revisione di proposte e pubblicazione locale di conoscenza approvata tramite un’azione umana riferita al contenuto esatto. Nessuna modifica delle fonti RAW.

## Interventi e sequenza

1. **Contratti e persistenza.** Estendere proposal-engine con output, revisioni, decisioni e risultati strutturati (percorso, revisione, hash, esito o conflitto). Distinguere stato del workflow pending/approved/rejected dal frontmatter draft/review/approved/archived: rejected non è uno stato frontmatter valido. Impostare draft esplicitamente: lo schema attuale ha default approved. Definire schema/versione dell’indice e migrazione prima delle scritture.
2. **Salvataggio output.** Pulsante esplicito da Ask Knowledge salva una nuova revisione in 80_AI_OUTPUTS, con risposta, fonti/hash e provider/modello realmente disponibili. Escludere credenziali e token di autenticazione; non copiare automaticamente tutta la conversazione. Persistenza consultabile dopo riavvio e offline. Un output salvato non diventa conoscenza approvata.
3. **Proposte e compatibilità M4.** Creazione da output o lettura di revisioni M4 già presenti in 90_PROPOSALS. Riutilizzare elenco e anteprima esistenti; non alterare indice del compilatore o duplicare automaticamente le sue bozze. Conservare provenienza, revisione genitore e modifiche umane. Per contenuti esterni usare un’importazione locale esplicita con origine dichiarata; non inventare modello, autore o citazioni assenti.
4. **Revisione locale.** Mostrare contenuto esatto, fonti, stato, destinazione e differenze rispetto a un eventuale documento precedente. Una modifica crea una nuova revisione; rifiuto e motivazione restano nel workflow senza cancellare l’originale. Fonti cambiate/mancanti e citazioni non verificabili devono essere visibili, non marcate come verificate.
5. **Approvazione umana.** Il comando locale riceve ID/revisione/hash atteso e destinazione ammessa. Il backend rilegge e verifica i byte prima di pubblicare; se la proposta è cambiata dalla revisione mostrata, richiede una nuova revisione umana. Destinazioni limitate alle categorie ufficiali 01–10, con type coerente e frontmatter validato. Prima versione M7: nuovo file esclusivo, nessun overwrite silenzioso di conoscenza esistente; collisioni esplicite. Aggiornamento in-place di note approvate fuori da questo piano.
6. **Sicurezza e recupero.** Riutilizzare accessi per directory aperte e rifiuto symlink/file speciali. Lock cooperativo, staging esclusivo, pubblicazione atomica del singolo file e ID operazione idempotente. Registrare decisione, hash, destinazione e timestamp locale senza spacciare l’utente locale per identità autenticata remota. Definire ordine delle scritture e recupero verificabile se il documento è pubblicato ma l’indice/registro non è aggiornato; niente successo parziale nascosto né cancellazioni di dati preesistenti.
7. **Integrazione.** Motore, Rust/IPC e UI coerenti; il bundle distribuito non dipende da Node o checkout. MCP Business/Codex resta in sola lettura: nessun tool remoto di approvazione. Eventuali scritture remote richiedono un piano separato. Dopo salvataggio/promozione segnalare indice M5 da aggiornare e rendere disponibile reindicizzazione esplicita. Non riscrivere il manifest M3 per nascondere discrepanze: l’hash del contenuto e lo stato editoriale approved sono concetti distinti.

## Verifiche richieste

- Contratti/schema, revisioni e stati; compatibilità con fixture M4, fonti complete e provenienza incompleta esplicita.
- Sola lettura RAW e assenza di scritture approvate prima dell’azione umana; hash dell’intero albero prima/dopo con elenco esatto dei file autorizzati cambiati.
- Traversal, symlink, collisioni, doppio clic, approvazione concorrente, modifica dopo anteprima, indice corrotto, permessi, errore/interruzione a ogni confine di persistenza. Ripresa idempotente senza doppia pubblicazione.
- Parità TS/Rust e IPC reale, non soltanto mock; regressioni M4/M5 e sicurezza M6 pertinenti.
- Checkout finale: pnpm test, pnpm typecheck, pnpm build in sequenza; test Rust e build Tauri.
- E2E bundle: risposta reale M6 → salvataggio → riavvio → proposta → revisione/rifiuto oppure approvazione → documento corretto → reindicizzazione e ricerca approved. Provare anche approvazione di una bozza M4 e gestione offline di contenuti già salvati.
- Verificare che client esterni M6 non possano approvare o scrivere. Nessun requisito di generare nuove risposte AI cloud offline.

## Dipendenze e chiusura

Preparare persistenza e fixture indipendentemente dagli accessi M6. L’E2E risposta reale/salvataggio dipende dall’integrazione M6 verificata; simulazioni non lo sostituiscono. Coordinarne i contratti e i file condivisi con chi implementa M6. M7 chiusa solo quando i criteri sopra sono verificati e checklist/evidenze aggiornate; locale e pubblicato restano distinti. Nessun deploy o modifica ai dati reali autorizzato da questo piano.
