# Project Rules — LIMEN Vault Workspace

## Session Handover Files
- Quando viene richiesto un file di session handover (o riassunto/passaggio di consegne per l'avvio di una nuova chat), **salvarlo SEMPRE direttamente nella root del workspace** (es. `SESSION_HANDOVER.md` o `SESSION_HANDOVER_<NOME_TASK>.md`), rendendolo immediatamente visibile all'utente nel suo IDE workspace.

## Implementation Plans & Task Lists
- Per ogni piano di implementazione (`implementation_plan.md` o piani di lavoro strutturati), includere SEMPRE la corrispondente **Task List** dettagliata e tracciabile con checkbox (`[ ]` / `[x]`), suddivisa per fasi o componenti, aggiornandone progressivamente lo stato di avanzamento.

## Compilazione e Avvio Versione Ottimizzata da Provare
- Per ogni compilazione ottimizzata usare SEMPRE e SOLO:
  `cd "E:\Projects\vault_memai_obsi"; npx pnpm --filter @limen-vault/desktop tauri dev --release`
  (NON usare `cargo build --release` per preparare la versione da provare, così la cache di compilazione resta valida anche quando Cesare riavvia l'app).
- Alla fine di ogni consegna, prima dello STOP: chiudere solo la versione di sviluppo eventualmente avviata dall'assistente (MAI processi avviati da Cesare), avviare la versione ottimizzata con quel comando e lasciarla aperta.
- Nel rapporto finale dichiarare SEMPRE: commit di riferimento (hash e ora UTC+8), percorso dell'eseguibile avviato, ora di avvio.

