# Ripresa M9 — stato corrente

Utente ha autorizzato M9. Credenziale tunnel copiata nel Portachiavi (helper exit0); app autorizzata direttamente. Start/readiness/stop/restart reali PASS, due figli eliminati con STOP. Tunnel attualmente riavviato per E2E Business remoto. Scheda Chrome 889428371 via browser2 timeout due volte; domanda pendente: portare Plugins in primo piano per usare Chrome nativo. CUA binding m9app corrente. Utente conferma stessa rete: prima verificare così, poi offre hotspot. Notary history riuscito, tre richieste In Progress, nessuna Accepted. Non ripetere upload senza variazione sostanziale. Manuale e note candidato aggiornati, inventario 29 file/harness escluso. Checklist/TODO aggiornati.

# Aggiornamento M8 — 12 settembre 2026

M8 completata in locale: rapporto e TASK_LIST aggiornati. Interruzione reale della connessione TLS OpenAI PASS, UI locale reattiva e inventario invariato. Nuove etichette UI verificate. Lettura Obsidian PASS; isolamento extra di Obsidian non certificato per incompatibilità sandbox Electron (nessuna protezione disabilitata). Proxy PID85642 e app con HTTPS_PROXY PID85645 arrestati; app riavviata normalmente, sessione64703. Mac sbloccato. M9 resta aperta, non avviata da questa richiesta M8.

## Storico precedente (stati superati per M8)

# LIMEN Vault — stato corrente, 12 settembre 2026

M7 completata in locale: IMPLEMENTATION/2026-09-12_M7_CLOSURE.md. M8/M9 aperte; TASK_LIST.md e TODO LIST.TXT aggiornati. Nessun commit/push/tag/deploy.

## Candidato corrente

App /Users/cesare/Applications/LIMEN Vault.app, 0.1.0 ARM64 macOS 26.3. SHA-256 binario 2faa40bc1798e6fae44c44b99696987ecfe1d8810f152a16cd7a95499cae8e6b. Firma Developer ID verificata, harness escluso, NON notarizzata. Ultima modifica: etichette Markdown Files/Proposal Files coerenti con conteggi reali, nessun redesign. pnpm test/typecheck/build e build Tauri passati. Ultimi test Rust 32 lib +18 main PASS, non necessariamente casi distinti. E2E M7 ulteriormente ampliato: approvazioni concorrenti e permessi/recupero PASS.

Copia precedente conservata nel banco /private/var/folders/0h/_bd3ktm50zs9g5bbgxch_zkr0000gn/T/limen-m9-qa-v4hz1b7g/LIMEN Vault-before-labels.app. App corrente avviata con HTTPS_PROXY locale 127.0.0.1:52984 per una prova di interruzione TLS verso il vero api.openai.com; il proxy non legge/decripta/registra payload. Script /tmp/limen-m8-connection-proxy.py, sessione 60095. App sessione 88757. La prova NON è stata eseguita: il Mac si è bloccato. Non registrare PASS. Il proxy è limitato a CONNECT api.openai.com:443. Configurazione solo ambiente del processo, nessuna modifica rete globale. Dopo prova arrestare proxy e riavviare app senza variabile.

## Evidenze nuove

M9_EVIDENCE/installed-online-ui.json: copia firmata precedente alla sola modifica etichette, API reale gpt-4o-mini, CANCEL osservato correttamente, revoca MCP locale e Knowledge reattiva. Codex installed JSONL concluso exit0. install-bank.json PASS su APFS: ENOSPC, SIGKILL copia, rollback stessa versione, conservazione Vault. Non equivale a test su account OS pulito.

M8_EVIDENCE/native-bank.json: otto gruppi PASS, accettazione INCOMPLETE/exit2 esplicita; GUI integrata e Knowledge senza indice/rete provate nei receipt M9. Obsidian ha letto realmente m8-reviewed, ma non era isolato dalla rete. Rimane perdita rete durante richiesta e consolidamento matrice.

## Blocchi e ripresa

- Tool CUA getState dichiara Mac bloccato; richiesta asincrona di sblocco inviata. Non ripetere tentativi nativi finché non sbloccato.
- Helper /tmp/limen-copy-tunnel-key, PID82783/sessione25329, attende autorizzazione SecurityAgent alla copia in memoria della chiave API verso voce separata tunnel. Nessun segreto stampato. L’autorizzazione app API è già efficace, il helper è distinto; domanda precedente già pendente. Mai controllare SecurityAgent automaticamente.
- Notary profilo LIMEN-M9 autenticato. Upload iniziale deadlineExceeded; seconda operazione cancellata per correzione codice; terza deadlineExceeded anche senza S3 acceleration. Non fare nuovi tentativi senza cambio rete reale già richiesto. Nessun rifiuto del codice osservato. DMG/stapling/Gatekeeper non completati.
- Business runtime del bundle installato ancora da provare. Tunnel QA esistente tunnel_6aa551cfb8888191a338383bf73383d9; org-B0kGnyTUjiNT2fnHWVHm6Wex; Business Chrome Cesare già disponibile. Configurare solo fixture QA, poi stop e verificare revoca. Non sostituire questo E2E con quello M6.

Cua kernel resettato; nuova acquisizione app necessaria dopo sblocco. Chrome inventario ancora disponibile. Non leggere pagina Apple Account: potrebbe mostrare credenziali generate.
