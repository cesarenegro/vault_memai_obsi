# M8REV — Validazione del fallback indipendente

Data: 12 settembre 2026. Versione: REV 1, revisione richiesta dall’utente. Stato: piano definito; validazione del prodotto integrato da eseguire. Checklist operativa: ../TASK_LIST.md, sezione M8.

## Obiettivo e baseline

Dimostrare che il bundle locale integrato resta utilizzabile senza MEMAI/M3MAI, PII_CRM, Render, Vercel, R2 e connessioni AI. Le prove offline M2–M5 sono evidenze pregresse, non certificano automaticamente il prodotto dopo M6/M7. M8 non introduce inferenza AI locale, sincronizzazione, ripristino snapshot non previsto, firma o distribuzione M9.

## Preparazione

- Usare la build finale M2–M7 identificata tramite hash del binario e risorse/versione, registrando sistema e architettura. Verificare dipendenze effettive, senza dedurre indipendenza dal solo pnpm build.
- Creare fixture isolate con note approvate, draft, RAW, output salvati, proposte in stati diversi, snapshot, indice M5 e Unicode. Conservare hash e inventario iniziali; nessun dato utente per prove di corruzione.
- Eseguire il bundle copiato fuori checkout, senza Vite, Node o toolchain nel PATH. Negare lettura checkout e accesso rete al processo e agli eventuali processi ausiliari; documentare che i divieti siano effettivi. Non modificare il collegamento di rete globale del Mac.
- Preparare indice presente, assente, obsoleto e corrotto, Vault incompleto/inaccessibile, risorsa snapshot alterata e interruzioni di scrittura su fixture distinte.

## Matrice di accettazione

| Condizione | Funzioni che devono riuscire | Esito esplicito atteso |
| --- | --- | --- |
| Rete interamente negata; nessuna credenziale AI | Creare/aprire Vault, consultare note/fonti, compilare localmente M4, ricercare/reindicizzare M5, creare/verificare snapshot M3 | AI cloud indisponibile; nessun caricamento infinito o requisito login per funzioni locali |
| Output/proposte già salvati, offline | Lettura, revisione, rifiuto/approvazione locale M7 secondo permessi | Nessuna richiesta AI necessaria per gestire contenuti persistiti |
| Riavvio senza rete e fuori checkout | Riapertura dello stesso Vault, output/proposte/snapshot/indice persistenti | Nessun dato simulato o dipendenza da memoria del processo precedente |
| API, MCP o processo ausiliario interrotto | UI locale reattiva, annullamento e altre operazioni locali utilizzabili | Errore circoscritto, timeout/retry limitati; nessun dato privato nei log |
| Mac/collegamento MCP non disponibile | LIMEN locale resta indipendente quando in esecuzione | Client esterno non dichiarato live o aggiornato; non simulare disponibilità del Vault |
| Indice mancante/legacy o fonti modificate | Recupero mediante reindicizzazione esplicita quando ammesso | Nessun risultato obsoleto presentato come corrente; indice corrotto segnalato e preservato |
| Vault/file non accessibile, symlink o snapshot alterato | Errori reali e ritorno al funzionamento su fixture valida | Mai READY/VERIFIED inventati, nessuna perdita o fuga dal Vault |
| Arresto durante una scrittura locale | Dati preesistenti conservati e recupero documentato | Staging/lock/operazione incompleta visibili; niente promesse di transazione resistente a perdita alimentazione |

Provare inoltre apertura del Vault in Obsidian installato sul banco, senza dipendere da servizi esterni. Se Obsidian non è disponibile, dichiarare il criterio non verificato; non sostituirlo con una semplice verifica del percorso.

## Esecuzione ed evidenze

1. Riconvalidare le suite automatiche pertinenti M2–M7. Sul checkout finale pnpm test, pnpm typecheck, pnpm build, test Rust e build Tauri; registrare comandi, exit code e log.
2. Eseguire scenari con rete negata dal primo avvio, poi perdita della connessione durante un’operazione AI. Un mock può coprire errori unitari, non provare packaging, offline reale o collegamento account.
3. Eseguire i flussi nativi dalla UI e da nuovi processi per la persistenza; annotare input, risultati attesi/effettivi e riferimenti alle fixture.
4. Confrontare inventario e hash: consultazione non scrive; compilazione, snapshot, indicizzazione e approvazione scrivono solo quanto previsto dalla specifica. Il manifest non deve essere aggiornato per nascondere modifiche.
5. Registrare eventuali dipendenze esterne residue e correggere i difetti pertinenti prima della chiusura. Ripetere solo scenari interessati dalle correzioni; identificare sempre il bundle effettivamente ritestato.
6. Produrre rapporto in IMPLEMENTATION con matrice pass/fail/bloccato, evidenze, limiti e recupero; aggiornare manuale solo per procedure realmente provate, checklist e TODO.

## Dipendenze e criterio finale

Il banco e gli script si possono preparare prima della chiusura M6/M7. La chiusura M8 richiede il prodotto integrato e tutti i criteri locali sopra verificati; non rende complete milestone M6/M7 con accettazioni ancora aperte. Gli E2E online API/Business/Codex restano criteri M6: M8 controlla soprattutto comportamento degradato e indipendenza, senza ricertificare ogni account a ogni test offline.

Le prove attuali riguardano macOS ARM64; registrare la piattaforma effettivamente verificata. Firma, notarizzazione, installazione da pacchetto di distribuzione e pubblicazione restano M9. Nessun commit/deploy previsto dalla sola revisione del piano.
