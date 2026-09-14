# Distribuzione italiana notarizzata — consegnata

Destinazione: /Users/cesare/Documents/STEFANO PARMA PII ALL/USER INSTALL.
Sostituiti Installa-LIMEN-Vault-0.2.0-arm64.dmg e LIMEN-Vault-0.2.0-arm64.dmg con la build italiana; manuale e LEGGIMI aggiornati. Originali conservati, con hash verificati, in STORICO/2026-09-13-versione-inglese.

## Apple e integrità

- App LIMEN: Accepted 3999b97b-e271-4ad9-a6ac-1d3720bf4713.
- DMG app: Accepted 76f22c9c-6eca-4d57-8778-e6d8e741653f.
- App installer: Accepted b358df01-8a09-43d2-94dd-0808dd34554c.
- DMG installer: Accepted cf00bbf8-f6b2-40d6-88cd-67f5217267a3.
- Ticket applicati e validati su app, DMG app, installer e DMG installer. Gatekeeper PASS.
- DMG installer finale in USER INSTALL montato read-only: firma/ticket/Gatekeeper dell’installer PASS; payload identico al DMG standalone; eseguibile installer identico a quello collaudato; manuale identico alla consegna. Smontaggio riuscito.
- SHA-256 e ricevute in UI_IT_EVIDENCE/notarized/delivery.json e USER INSTALL/SHA256SUMS.txt.

## Installer

Corretto il precedente comportamento che saltava l’installazione quando trovava già 0.2.0. Ora prepara e verifica il nuovo bundle prima di sostituirlo, conserva l’app precedente in Applicazioni/LIMEN - versioni precedenti e ripristina il backup se il rename finale fallisce. Non tocca le cartelle del Vault. Se il target è aperto, richiede di chiuderlo. Non sostituisce applicazioni prive di firma valida o di versione diversa. Manuale incluso nel DMG installer, build installer 2.

Test reali in directory isolate: installazione nuova; aggiornamento dalla precedente build inglese con verifica hash differente prima/identico al nuovo dopo; backup vecchio binario identico; documento sentinella invariato; destinazione non valida rifiutata; aggiornamento di app realmente in esecuzione rifiutato senza variazioni. Firma e Gatekeeper del risultato PASS. Avvio via UI dell’app ottenuta dall’installer: Benvenuto in LIMEN Vault e undici menu italiani osservati. Nessuna simulazione di note reali pubblicate.

## Problemi risolti e limiti

Primo invio dell’app rifiutato per firma/timestamp/hardened runtime dei due ausiliari: rifirmati tunnel-client, cloudflared e bundle, invio successivo Accepted. Primo assemblaggio installer fermato da FinderInfo ereditato dal DMG: aggiunta pulizia metadati solo nel nuovo bundle prima della firma, build successiva accettata. Log delle due anomalie conservati.

Nessuna ricompilazione della UI già verificata né ripetizione dei test monorepo senza modifiche. Swift typecheck e collaudi reali dell’installer eseguiti. Percorso di rollback implementato, non sottoposto qui a fault injection. Obsidian presente verificato; ramo Obsidian assente invariato e coperto dalle prove precedenti. Nessuna nuova prova secondo Mac/account pulito offline. M10 resta aperta per i criteri residui. Nessun commit/push, modifica CRM o pubblicazione di note reali in questa sessione.
