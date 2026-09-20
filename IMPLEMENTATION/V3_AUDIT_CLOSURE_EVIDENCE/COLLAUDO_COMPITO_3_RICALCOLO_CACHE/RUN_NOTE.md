# Collaudo compito 3 — ricalcolo cache semantica dall'app installata (barra di avanzamento)

Data: 2026-09-20 (UTC+8). Esecutore: Claude Code (implementatore con piena autorizzazione).
Vault di prova: `tests/scratch/vault_collaudo_ricalcolo_cache` (114 documenti, 9.433 passaggi, `SYNC_PROFILE.json` con
`embeddingsProvider: "local"`, **senza** `EMBEDDINGS_CACHE.json`). Mac: Apple M2, 8,6 GB RAM.

## 1. Prima corsa sull'app installata `a08e769` — FALLITA (difetti reali trovati)

Sequenza eseguita nell'app (controllo dello schermo): apertura vault → Avanzate → Collegamenti AI & MCP →
RICALCOLA CACHE SEMANTICA → barra a 0,0 % → dopo ~60 s errore in UI:
`Ricalcolo cache fallito o interrotto: Richiesta embeddings fallita verso 'http://127.0.0.1:62252/v1/embeddings': error sending request for url`.

Prove (file in questa cartella):
- `llama-server_a08e769_cpu_timeout60s.log`: prima richiesta di lotto a `0.03.395`, `stop: cancel task` per 64 task a
  `1.03.655` → **60,26 s** dopo, cioè il timeout di 60 s in `embeddings.rs` (`Client::builder().timeout(60)`).
  Nei 60 s il server aveva completato 21 passaggi su 64 (4 slot, ~4 s a giro all'inizio, poi 12–30 s per pressione
  di memoria con tre server caricati).
- `bench_batch.py` (misura con passaggi reali del vault, ~1.000 caratteri): server dell'app **0,65 s/passaggio**;
  stesso binario con `GGML_BACKEND_PATH` sulla libreria Metal inclusa **0,09 s/passaggio** (16 passaggi: 10,4 s vs
  1,5–2,2 s; 64 passaggi: 5,9 s con Metal).
- `llama-server --list-devices` del binario incluso: `(none)`; con la cartella Homebrew di ggml nascosta via
  `sandbox-exec`: `BLAS` + `MTL0: Apple M2`; caricamento esplicito della libreria Homebrew: `dlopen ... different Team IDs`.

Difetti verificati (tutti nel codice, nessuno nel vault):
1. **GPU Metal mai caricata** su Mac con Homebrew ggml: ggml cerca prima nella cartella compilata nel binario
   (`/opt/homebrew/Cellar/ggml/0.24.0/libexec`), trova librerie firmate ad-hoc, il runtime indurito le rifiuta e non
   ripiega su quelle incluse nell'app → solo CPU (7 volte più lento).
2. **Timeout 60 s** per lotti di 64 passaggi: sufficiente con Metal (5,9 s), insufficiente su CPU (≥ 42 s, oltre 60 s
   sotto pressione di memoria).
3. **Barra di avanzamento mai alimentata**: la UI ascolta `embeddings_sync_progress` ma nessun punto del backend lo
   emetteva; la barra restava a 0,0 % per tutta la durata.
4. **Messaggio errato a cache assente**: "0 passaggi indicizzati (1536 dim)" e "Disallineamento dimensioni vettore"
   perché `EmbeddingsCache::default()` ha 1536 dimensioni; il conteggio "I 0 passaggi ... devono essere ricalcolati" usava
   `cacheEntries` invece dei passaggi del catalogo.
5. (Operativo) Un `llama-server` orfano di un'istanza precedente dell'app (pid 21212, 3 h) era rimasto attivo: l'app spegne
   il figlio solo all'uscita regolare (`RunEvent::Exit`), non se viene terminata con `kill -9`.

Correzioni: commit `611e943` (dettaglio nel messaggio di commit). Test: `cargo test` 95 + 17, `tsc --noEmit`, `pnpm test`.

## 2. Seconda corsa sull'app ricostruita (`611e943`) — DA ESEGUIRE

Vedi sezione 3 quando completata.
