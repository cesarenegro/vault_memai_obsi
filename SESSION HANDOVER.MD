## Aggiornamento documentale 14 settembre 2026

Dossier completo nella root: `CLAUDE AUDIT - LIMEN CRM MEMAI.md`. Lettura remota Git: LIMEN main 8c8d6a9 già presente su GitHub; MEMAI codex/research-runtime c7c47ee, main bce9d61. Configurazione Production Vercel pii-crm: MEMAI_API_URL=https://m3mai-backend.onrender.com; CRM locale .env.local punta a m3mai-backend-staging.onrender.com. Queste verifiche superano eventuali affermazioni storiche discordanti sotto. Nessuna configurazione cambiata, nessun nuovo commit/push/deploy.

# Stato verificato — 13 settembre 2026, conclusione tecnica

## Produzione MEMAI e CRM
Salute MEMAI corretta: cron ingestion ogni 10 minuti, monitor 600 s; due heartbeat regolari, /health ok dopo 21 minuti e dopo nuovo deploy. Nessun recupero manuale dei dati.
Workbench Codex read attivo: Safari Admin creazione/cronologia/revoca workspace vuoto PASS. Record revocato mantenuto per audit; nessuna conoscenza esportata/pubblicata.
Ricerca multi-agent implementata e pubblicata: domanda nel CRM, tre ricerche specialistiche, sintesi OpenAI con citazioni, fonti consultabili, persistenza e annullamento. Job c2af2b36-baa2-4dfb-b09e-175720e4da42 completed in 13.244079 s con risposta italiana e 8 fonti. Job 319f0fbd-aed4-4b42-9876-e4f7e26a843f running → cancelled, ancora cancelled dopo 3 s, senza risposta.
Limiti: 120 secondi, 4 chiamate, 9 fonti, 1200 token output. Costi/token consumati n/d perché non restituiti dal contratto provider; fonti raccolte non dichiarate fatti verificati.

MEMAI commit 9043ff5aa8d34fef8ed33cf86b98d872378f7fba pubblicato con autorizzazione esplicita su codex/research-runtime. Commit documentale successivo c7c47ee sullo stesso branch; codice runtime resta 9043ff5. Render dep-dajgdl0jo6nc73dp4lr0 Live, istanza vsh8p. Servizio srv-d8j0fqnlk1mc738mfeo0 ora segue codex/research-runtime; auto-deploy Off, main non modificato. Comando pre-deploy python scripts/predeploy.py: START/PASS di validazione e migrazioni osservati nei log; schema u1c2d3e4f5a6 = head. Nessuna nuova migrazione.
CRM produzione unica https://pii-crm.vercel.app, deploy dpl_CSZPgsq6uTaMspWnTZJFVmAtpg6R Ready: https://pii-b0e741qzr-cesares-projects-cda0db9c.vercel.app. Corretto Content-Type JSON dopo 422 del primo collaudo. Test regressione HTTP dimostrato fallire con vecchio codice e passare con nuovo. Nessun commit/push CRM; modifiche pubblicate via CLI. .vercelignore esclude pacchetti USER INSTALL e file già ignorati da Git.

Verifiche: backend 436 passed e 49 subtests passed, 23 skipped e 2 deselected preesistenti. CRM 12/12 test PASS, typecheck/build PASS; lint zero errori e un warning di direttiva eslint superflua. Non ripetere senza nuove ragioni.

## Archivio, UI e consegna desktop
CRM: tre origini Materiali CRM, MEMAI diretto, LIMEN. Guard staff e allowlist Admin/Superadmin; bucket LIMEN dedicato m3mai-core-vault, indipendente dallo storage upload generico. MEMAI 21 documenti e anteprima MERAVIA già verificati; LIMEN NO_PUBLICATION perché Vault reale senza note conoscenza approvate. Nessun bucket nuovo, migrazione storage o duplicazione cataloghi.
Tauri interamente tradotto in italiano e installato in ~/Applications/LIMEN Vault 0.2.0.app; avvio “Benvenuto in LIMEN Vault” e Vault “Pronto” osservati. Undici sezioni visitate. Test JS, Rust e build già PASS.
DMG italiani notarizzati/stapled/Gatekeeper PASS consegnati in /Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL: Installa-LIMEN-Vault-0.2.0-arm64.dmg e LIMEN-Vault-0.2.0-arm64.dmg. Backup inglese in STORICO/2026-09-13-versione-inglese. Test installazione nuova/aggiornamento/preservazione PASS. Pacchetti non modificati da questa lavorazione backend.
Manuale aggiornato nella root LIMEN: manuale UI utente.txt, stessa copia aggiornata in USER INSTALL. Aggiunto workflow ricerche CRM verificato oggi. Manuale già incluso nel DMG resta la versione della sua notarizzazione; istruzioni operative CRM aggiornate nel file esterno.

## Residui che richiedono dati o dispositivi
1. Note reali/mapping: /Users/cesare/Documents/VAULT contiene solo 00_SYSTEM/HOME.md e VAULT_RULES.md. Domanda all’utente pendente su percorso documento approvato e Cliente/Progetto CRM esatti. Non inventare approvazioni e non pubblicare note di sistema. Contratto frontmatter client/project → manifesto → filtri CRM esatti già verificato con fixture; non equivale al collaudo con note reali.
2. Secondo Mac non disponibile.
3. Prova M10 offline in account macOS pulito non certificata.
M10 NON integralmente chiusa; artefatti M9 congelati preservati.

Evidenze correnti: IMPLEMENTATION/2026-09-13_RESEARCH_RELEASE.md. Storico: IMPLEMENTATION/2026-09-13_MEMAI_ATTIVAZIONE.md, IMPLEMENTATION/UI_IT_EVIDENCE/notarized/. Checklist principali TASK_LIST.md e TODO LIST.TXT aggiornate in tutti e tre i progetti.
