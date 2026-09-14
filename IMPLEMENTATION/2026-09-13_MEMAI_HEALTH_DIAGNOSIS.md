# Aggiornamento operativo 13 settembre 2026, 19:47 UTC

Correzione produzione autorizzata ed eseguita: cron ogni 10 minuti coerente con monitor runtime 600 secondi. Due heartbeat regolari, /health HTTP 200 ok dopo 21 minuti. Vedere 2026-09-13_MEMAI_ATTIVAZIONE.md.

## Diagnosi storica precedente alla correzione

# MEMAI — diagnosi salute, 13 settembre 2026

Stato: diagnosi in sola lettura; discrepanza configurazione verificata, rimedio non applicato.

## Evidenze

- Render autenticato, pagina https://dashboard.render.com/cron/crn-da20cf8u01pc73djmpn0: servizio `m3mai-reconcile`, comando `python scripts/reconcile_cron.py`, frequenza visibile `every hour`, ultima esecuzione riuscita 13 settembre 2026 alle 20:00 GMT+2.
- Repository MEMAI `render.yaml`: stesso cron previsto `*/10 * * * *`; backend `INGESTION_RECOVERY_INTERVAL_SECONDS=600`.
- `app/services/schedule_monitoring.py`: stato degradato se ultimo successo assente o più vecchio di due intervalli. Con 600 secondi, soglia 20 minuti.
- Evidenza precedente `M10_EVIDENCE/memai-runtime-storage.json`: causa runtime `ingestion_recovery late`.
- `scripts/reconcile_cron.py` registra heartbeat persistente ed esegue realmente `reconcile_stuck_jobs.run()`.
- `app/worker.py`: può aggiornare job e riaccodare elaborazioni reali; non è una sonda innocua.

## Interpretazione e limiti

La frequenza oraria diverge dal manifest e, se il monitor runtime usa 600 secondi, produce finestre di salute degradata anche con esecuzioni riuscite. L'intervallo effettivo del monitor runtime non è stato letto in questa ripresa: la spiegazione resta condizionata a tale verifica. Nessuna nuova lettura /health o heartbeat DB; non si dichiara salute corrente ripristinata. La navigazione Settings è stata interrotta dal cambio tab dell'utente; non sono state lette o modificate impostazioni.

## Correzione concreta proposta

Dopo conferma runtime, impostare soltanto il cron Render `crn-da20cf8u01pc73djmpn0` da frequenza oraria a `*/10 * * * *`, coerente col manifest. Nessun cambio soglia salute, storage, codice, database o altri servizi. Effetto: recupero automatico dei job reali più frequente; rollback alla frequenza oraria osservata. Non avviare un recupero manuale. La modifica produzione richiede autorizzazione specifica (AGENT.md LIMEN, sezioni 3 e 9).

Verifica successiva: frequenza salvata, almeno due esecuzioni programmate riuscite, heartbeat aggiornato e /health senza ritardo ingestion oltre la precedente soglia di 20 minuti. Eventuali altre cause vanno diagnosticate separatamente.

Nessun test applicativo ripetuto: nessuna modifica al codice. Nessun commit/push/deploy o manutenzione. M9 e modifiche preesistenti preservate.
