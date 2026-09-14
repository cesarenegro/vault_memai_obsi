# Salute e attivazione MEMAI — 13 settembre 2026

Stato: configurazione cron e flag pubblicati; Workbench Codex read collaudato. Ricerca multi-agent: pagina abilitata, avvio dei job ancora da implementare.

Cron Render crn-da20cf8u01pc73djmpn0: 0 * * * * → */10 * * * *, salvato circa 19:26 UTC. Monitor runtime 600 secondi. Primo heartbeat ingestion 19:30:06 UTC; publication 19:30:43; corpus 18:00:47. Nessun recupero manuale.

API interne autenticate: GET /workspaces, /research/jobs, /settings/workbench HTTP 200. Nessuna policy Workbench persistente; default modalità read, agenti Codex e Claude disabilitati. Preparati solo MEMAI_WORKBENCH_ENABLED=true, MEMAI_WORKBENCH_CODEX_ENABLED=true, MEMAI_VPRO_MULTI_AGENT_ENABLED=true. Claude resta disabilitato. Nessuna modifica dati/schema prevista; applicazione configurazione sulla stessa immagine attuale. Rollback: rimuovere i tre flag aggiunti e riapplicare configurazione.

CRM pii-crm: flag MEMAI_WORKBENCH_ENABLED e MEMAI_VPRO_MULTI_AGENT_ENABLED false → true. Redeploy stessa release già validata, senza upload checkout e senza modificare altri progetti. Nuovo deployment Ready: dpl_Hpe3V9thLucHXprZp3BwzDoefD1G, pii-otx9ukbcf-cesares-projects-cda0db9c.vercel.app; alias pii-crm.vercel.app. Collaudo UI autenticato: Workbench LIMEN e Ricerche multi-agent accessibili, lista job vuota senza errori; messaggi capability disabilitata rimossi. Rollback: false e redeploy.

Limite da verificare: il codice multi-agent contiene servizi/gestione job ma il collegamento alla creazione da richieste utente non è stato ancora dimostrato. Non considerare l’apertura della lista equivalente a ricerca completa.

Backend: tre flag salvati. Deploy dep-dajflofqj5pc73depnfg fallito in pre-deploy (exit 127): wrapper /bin/sh -c con quoting interpretato come unico comando. Alle 19:40 UTC salvato comando conforme a render.yaml: `python scripts/validate_production_release_config.py && python scripts/migrate_and_verify.py`. Verifiche mantenute. Nuovo deploy dello stesso commit bce9d617104f7ae46b01cab1e542a21abd9a8d5a in preparazione; vecchia istanza resta live.

19:43:31 UTC: deploy dep-dajfpop594qs73c1qmk0 sulla stessa immagine bce9d61, con aggiunta esplicita MEMAI_WORKBENCH_CODEX_MODE=read. Pre-deploy complete alle 19:43:49, validazione configurazione PASS; in attesa health check nuova istanza. Non visto report migrate_and_verify nei log visualizzati: non dichiarare migrazioni eseguite. Selettore commit vuoto; Save and deploy senza variazioni non ha avviato una release, aggiunta modalità read ha avviato correttamente.

Deploy dep-dajfpop594qs73c1qmk0 Live verificato. Runtime istanza 5zhjm: master Workbench=True, Codex=True, mode=read, multi-agent=True; WorkbenchPolicy.enforce codex/read PASS. Secondo heartbeat ingestion 19:40:27.030924 UTC, publication 19:40:27.070977 UTC. Avviato collaudo CRM di workspace vuoto COLLAUDO ATTIVAZIONE 2026-09-13 - vuoto, da revocare; nessun export documentale.

Collaudo UI CRM PASS: workspace COLLAUDO ATTIVAZIONE 2026-09-13 - vuoto creato alle 21:45:27 CEST, active codex/read/v1, cronologia created/ok; poi revocato e pulsanti Apri/Download/Import/Revoca disabilitati. Nessun export, proposta o pubblicazione. Il solo record di collaudo resta revocato come traccia.

Verifica finale salute: HTTP 200 {"status":"ok"} alle 19:47:14 UTC, 21 minuti dopo correzione. Schema controllato in sola lettura dopo deploy: database u1c2d3e4f5a6, unico head u1c2d3e4f5a6, coincidenti. Nessuna migrazione manuale eseguita. Nei log pre-deploy osservati compare validazione configurazione PASS ma non report migrazioni: prima del prossimo aggiornamento schema certificare esecuzione concatenata dei due comandi Docker, preferibilmente tramite script unico. Non assumere dal solo stato complete che entrambi siano stati eseguiti.
