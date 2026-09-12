# M3 — correzioni e accettazione E2E (completata in locale)
Incarico: correggere codice e test E2E M3. Preservare lo stile attuale e il lavoro preesistente.
1. Snapshot TS/Rust: directory aperte, percorsi canonici relativi, schema completo, SHA-256 reale, errori propagati.
2. Creazione in staging esclusivo, verifica prima della pubblicazione atomica senza overwrite; cleanup limitato allo staging posseduto. Nessuna promessa di snapshot istantaneo del filesystem sorgente o cleanup dopo kill.
3. Ripristino adapter e concorrenza UI M2, aggiornamento/recheck integrità, conteggi Vault indipendenti dalle copie archiviate.
4. Regressioni TS/Rust, corruzione/permessi/link/concorrenza/rollback, parità e flusso compilato offline con riapertura.
5. Test monorepo sequenziali, build Tauri, prove UI e aggiornamento TASK_LIST.md/TODO/handover.
Nessun database, cloud, commit, push o deploy. Solo Vault temporanei per prove. Rollback: solo propri delta rispetto a .local/m3-baseline.

Esito: tutte le fasi concluse. Test automatici, build nativa ed E2E UI offline passati; rapporto IMPLEMENTATION/2026-09-12_M3_CLOSURE_E2E.md.
