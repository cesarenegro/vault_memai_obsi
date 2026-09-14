# Ricerca multi-agent — rilascio del 13 settembre 2026

## Stato operativo
Implementazione locale verificata. Commit MEMAI 9043ff5aa8d34fef8ed33cf86b98d872378f7fba pubblicato su codex/research-runtime, derivato da origin/main bce9d61 (stesso albero del precedente checkout c01f9a8).
Deploy Render dep-dajgdl0jo6nc73dp4lr0 Live in 1m04s, commit 9043ff5. Branch servizio impostato a codex/research-runtime; auto-deploy resta Off. Selettore commit specifico non restituisce risultati: usata selezione branch e Deploy latest commit, SHA osservato 9043ff5.
PreDeployCommand salvato: python scripts/predeploy.py. Nessuna nuova migrazione; schema precedente a head u1c2d3e4f5a6.
CRM primo deploy dpl_64XgPd2XasSxBmA7RQpwJdBuP1uc Ready, poi sostituito dalla correzione JSON per pii-crm soltanto; URL https://pii-n0aktyo99-cesares-projects-cda0db9c.vercel.app. Aggiunto .vercelignore coerente con .gitignore ed esclusione USER INSTALL, evitando invio pacchetti desktop.

## Verifiche completate
- Backend: 436 passed, 23 skipped, 2 deselected, 49 subtests passed.
- Ripresa checkpoint, isolamento tenant, idempotenza, blocco job concorrenti per tenant, annullamento in corso, errori provider, scadenza e sintesi OpenAI: PASS.
- Predeploy: validazione prima delle migrazioni, stop al primo errore: PASS. Test manifest aggiornato dal comando concatenato al singolo script; verifiche di comportamento aggiunte.
- CRM: typecheck e build PASS; lint 0 errori, 1 warning preesistente di direttiva eslint superflua.

## Limiti dichiarati
Le chiamate provider sono limitate (4), così come tempo (120 s), fonti (9), output sintesi (1200 token). Il contratto attuale non restituisce consumi misurati: costo e token in UI sono n/d. Le fonti raccolte non sono dichiarate fatti verificati.
Prova reale ricerca pubblicata completata con risposta italiana e 8 fonti. Nessuna nota privata viene letta dalla ricerca Web e nessuna conoscenza viene approvata o pubblicata automaticamente.
Mapping reale: Vault contiene soltanto 00_SYSTEM/HOME.md e VAULT_RULES.md; manca scelta note approvate e Cliente/Progetto. Secondo Mac assente; prova M10 offline in account pulito non certificata. M9 e DMG italiani notarizzati preservati.

Produzione: screenshot Render PREDEPLOY START/PASS validate_production_release_config.py alle 22:26:28 CEST e START/PASS migrate_and_verify.py alle 22:26:28–29. /health HTTP 200 status ok dopo nuovo deploy.

CRM correzione JSON: dpl_CSZPgsq6uTaMspWnTZJFVmAtpg6R Ready, https://pii-b0e741qzr-cesares-projects-cda0db9c.vercel.app, alias pii-crm.vercel.app verificato. Nuovo test attraversa client ricerca e memaiFetch reale, intercetta fetch e verifica Content-Type/auth/body; PASS. Mutazione con precedente implementazione body-only fallisce come atteso: test regressione dimostrato. Suite CRM 12/12 PASS; typecheck/build PASS.

E2E Safari Admin: job c2af2b36-baa2-4dfb-b09e-175720e4da42 creato 22:31:41 CEST, completed 22:31:55, 13.244079 secondi, sintesi italiana e 8 fonti osservate. Secondo job b4182fcc-22c4-4271-aa20-cf3453ac3eba completato prima del clic annulla: non valido come prova di cancellazione, conservato audit.

API reali: job 319f0fbd-aed4-4b42-9876-e4f7e26a843f: CREATED queued, BEFORE_CANCEL running, CANCEL cancelled, AFTER_CANCEL cancelled answer_present False dopo 3 secondi. Schema u1c2d3e4f5a6 = HEAD [u1c2d3e4f5a6]. Istanza Render vsh8p.

PUBBLICATO E COLLAUDATO — salute MEMAI ok; Workbench Codex read attivo; ricerca reale completata con risposta italiana e 8 fonti, annullamento durante esecuzione PASS. Backend 9043ff5, Render dep-dajgdl0jo6nc73dp4lr0 Live. CRM dpl_CSZPgsq6uTaMspWnTZJFVmAtpg6R Ready su pii-crm.vercel.app. Pre-deploy: entrambi gli script PASS; schema u1c2d3e4f5a6 = head. Commit/push MEMAI autorizzati ed eseguiti su codex/research-runtime; nessun merge main.

Verifica HTTP finale: /health 200 ok; /research/jobs anonimo 401; /api/admin/limen anonimo 403. Evidenza JSON research-release-http-2026-09-13.json. Commit documentale c7c47ee, nessun ulteriore deploy codice.
