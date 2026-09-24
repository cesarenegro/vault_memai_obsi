# Project Rules — LIMEN Vault Workspace

## Session Handover Files
- Quando viene richiesto un file di session handover (o riassunto/passaggio di consegne per l'avvio di una nuova chat), **salvarlo SEMPRE direttamente nella root del workspace** (es. `SESSION_HANDOVER.md` o `SESSION_HANDOVER_<NOME_TASK>.md`), rendendolo immediatamente visibile all'utente nel suo IDE workspace.

## Implementation Plans & Task Lists (REGOLA CRITICA)
- Per ogni piano di implementazione (`implementation_plan.md` o piani di lavoro strutturati per fasi):
  1. È **MANDATORIO** creare SEMPRE l'artifact corrispondente con `UserFacing: true` salvato nella cartella artifact della conversazione (`<appDataDir>\brain\<conversation-id>\<nome_artifact>.md`).
  2. L'artifact deve essere visualizzato e presentato all'utente in **modalità preview renderizzata** (Artifact UI viewer) e **MAI** solo come file `.md` raw o semplice testo nel terminale/workspace.
  3. Includere SEMPRE la corrispondente **Task List** dettagliata e tracciabile con checkbox (`[ ]` / `[x]`), suddivisa per fasi o componenti.
  4. L'artifact deve essere **progressivamente aggiornato in tempo reale** ad ogni avanzamento o completamento di ciascuna fase, mantenendo sincronizzato lo stato.

## Compilazione e Avvio Versione Ottimizzata da Provare
- Per ogni compilazione ottimizzata usare SEMPRE e SOLO:
  `cd "E:\Projects\vault_memai_obsi"; npx pnpm --filter @limen-vault/desktop tauri dev --release`
  (NON usare `cargo build --release` per preparare la versione da provare, così la cache di compilazione resta valida anche quando Cesare riavvia l'app).
- L'assistente compila soltanto con quel comando per riscaldare la cache di compilazione, poi chiude il processo avviato dal proprio terminale nella stessa sessione e ne dichiara il PID. Non avviare né lasciare app in background dal terminale dell'assistente: Cesare avvia l'app direttamente con il suo comando, che grazie alla compilazione release già pronta si apre in pochi secondi.
- **Divieto assoluto di terminazione processi**: nessun `Stop-Process`, `taskkill` o chiusura di finestre su `limen-vault`, `llama-server`, `cargo` o `node`, per nessun motivo. Se un processo blocca la compilazione, fermarsi immediatamente e scrivere a Cesare indicando quale PID e per quale motivo.

## Regole Fisse di Sviluppo e Collaudo
- nessuna chiamata a OpenAI;
- nessuna chiusura di processi non avviati da te;
- nessun llama-server lasciato attivo;
- nessuna scrittura in C:\Users\user\LIMEN Vault\models\, in C:\Users\user\.limen-vault\ o nel vault;
- nomi, conteggi e risultati copiati dagli output grezzi, mai scritti a memoria;
- un commit per fase;
- niente rapporti, patch o aggiornamenti dei file di passaggio di consegne se non richiesti.
