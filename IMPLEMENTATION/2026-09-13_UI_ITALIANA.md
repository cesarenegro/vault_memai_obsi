# UI italiana — installata in locale, 13 settembre 2026

Richiesta: UI Tauri interamente italiana, manuale operativo, diagnosi avvisi CRM; successiva estensione a mapping e note reali.

## Consegnato

App italiana firmata Developer ID installata in `/Users/cesare/Applications/LIMEN Vault 0.2.0.app`; precedente conservata in `.local/ui-it/installata-precedente/`. Candidato finale in `.local/ui-it/final/`. UI webview, stati/categorie, accessibilità, messaggi e menu nativi tradotti mantenendo ruoli/shortcut. File e metadati non tradotti; diagnostica originale e voci aggiunte da macOS mantengono la lingua di origine. Manuale richiesto nella radice. Nessuna modifica a dati del Vault reale o CRM, nessun commit/push/deploy.

La copia installata precedente era quella ancora inglese vista dall’utente; la nuova copia è stata aperta e verificata direttamente. Prima consegna limitata all’app locale; su richiesta successiva, entrambi i DMG sono stati rigenerati in italiano, notarizzati e sostituiti in USER INSTALL. Dettagli correnti: 2026-09-13_DMG_ITALIANO_CONSEGNATO.md. M9 preservata.

## Verifiche effettive

- pnpm test, pnpm typecheck, pnpm build in sequenza: exit 0.
- Rust: 38 test lib e 18 main passati, nessuno ignorato.
- Smoke rendering italiano: categorie/stati, errore noto, successo Portachiavi e dettaglio tecnico originale PASS.
- Tauri app finale: PASS. Prima ricompilazione finale fallita ENOSPC; rimossa solo cache debug generata per i test; retry PASS. Log del fallimento conservato.
- Firma Developer ID e codesign --verify --deep --strict: PASS.
- Candidato nativo: creazione Vault isolato Pronto, visita undici sezioni, categorie e filtri tradotti, creazione copia locale Verificata; menu nativo Modifica con Annulla/Ripeti/Taglia/Copia/Incolla/Seleziona tutto.
- Copia installata finale: schermata Benvenuto italiana, undici menu e apertura Vault reale Pronto. Screenshot osservato senza sovrapposizioni; stato integrità preesistente (due modificati e un aggiunto) ancora esplicito.
- Nessuna nuova chiamata AI o trasferimento cloud; nessuna nuova prova secondo Mac/offline pulito. M10 resta aperta.

## CRM e mapping

Codice CRM letto: i flag MEMAI_WORKBENCH_ENABLED e MEMAI_VPRO_MULTI_AGENT_ENABLED devono essere esattamente true; le server action producono disabled prima delle chiamate /workspaces e /research/jobs. Il messaggio UI sul backend non dimostra una verifica effettiva della capability remota. Cataloghi e pubblicazione LIMEN sono flussi distinti.

Il sync nativo copia client/project dal frontmatter al manifesto. searchPublishedNotes confronta i valori esatti con clientId/projectId. Non esiste qui risoluzione automatica nome cliente → ID CRM. Il form Proposte non offre selettori dell’anagrafica CRM: preparare i metadati nella nota.

Matrice reale preparata, NON eseguita:
1. Identificare documento approvato e anagrafica Cliente/Progetto reale indicati dall’utente.
2. Controllare frontmatter e ID reali, validazione locale, testo e SHA-256.
3. Anteprima e pubblicazione esplicita di quella nota approvata.
4. In produzione /api/admin/limen?action=search: risultato con ID corretti; assente con cliente/progetto diverso.
5. Lettura pubblicata: release, percorso, hash e testo corrispondono alla nota locale.
6. Verifica UI CRM della nota pubblicata e del contesto; documentare limiti di presentazione.

Prerequisito mancante: nel Vault reale solo HOME.md e VAULT_RULES.md di sistema, nessuna nota reale. Chiesta selezione dei documenti approvati e del Cliente/Progetto, risposta pendente. Nessuna pubblicazione di fixture o dati inventati.
