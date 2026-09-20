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

## 2. Seconda corsa sull'app ricostruita (`611e943`, firmata, notarizzata `99caeb1e-…`) — SUPERATA

App installata in `/Applications/LIMEN Vault v3.app` (firma profonda valida). Stesso vault, stessa sequenza, controllo dello
schermo; schermate della sola finestra dell'app catturate con `screencapture -l<id finestra>` (`01_…` → `12_…`).

| Ora (UTC+8) | Azione / osservazione | Prova |
|---|---|---|
| 17:41 | Apertura vault, Avanzate → Collegamenti AI & MCP | «Nessun passaggio indicizzato», «Cache semantica assente… I **9458** passaggi del vault devono essere calcolati», pulsante «RICALCOLA CACHE SEMANTICA (1024 DIM)» | `01_prima_del_ricalcolo_cache_assente_174205.png` |
| 17:42:14 | Clic sul pulsante → l'app avvia da sola `llama-server` (pid 76504, porta 62980) | `ps -Eww`: `GGML_BACKEND_PATH=/Applications/LIMEN Vault v3.app/Contents/Resources/native/libggml-metal.so` |
| 17:42:26 | Barra «Ricalcolo cache in corso… 32/9458 passaggi 0.3%» | schermata MCP |
| 17:42:41 | «144/9458 passaggi 1.5%» | zoom MCP |
| 17:42:58 → 18:22:16 | Barra in avanzamento continuo (catture ogni 4–5 min) | `02_…` → `12_…` (es. 18:22 ≈ 77 %) |
| 18:31:15 | `EMBEDDINGS_CACHE.json` scritto (125.687.956 byte), staging rimosso | `ls`, verifica sotto |

Verifica della cache prodotta (Python sul file): modello `bge-m3`, 1024 dimensioni, **9.458 voci = 9.458 passaggi del
catalogo, intersezione 100 %, 0 voci fuori catalogo**, nessun file di staging residuo.

Tempo totale **49 min 01 s** (17:42:14 → 18:31:15) per 9.458 passaggi = **0,31 s/passaggio** dentro l'app. Il valore e' piu'
alto dei 0,09 s del banco di prova (§1) per tre fattori verificati: il testo inviato dall'app e' contestualizzato (titolo/
percorso, fino al 20 % in piu'), il file di staging (fino a 125 MB) viene riscritto ogni 320 passaggi, e la memoria libera
durante la corsa era al 26 %. Ritmo osservato dal log del server: 501 passaggi nei primi 103 s, poi ~700 ogni 4 min.

Esito: **tutti e quattro i difetti della sezione 1 non si ripresentano** (Metal caricato, nessun timeout, barra alimentata con
conteggio e percentuale, messaggio corretto a cache assente).

Residui (non bloccanti, non corretti in questa corsa):
- Il badge «Servizio locale di calcolo: SPENTO» non si aggiorna durante il ricalcolo avviato dal pulsante (il servizio e'
  in realta' attivo; lo stato viene riletto solo al termine). Cosmetico.
- La schermata dello stato finale in UI («Cache semantica ricalcolata e allineata con successo al 100%») non e' stata
  catturata perche' lo schermo del Mac si e' bloccato alle 18:2x (blocco per inattivita': `caffeinate -d` impedisce lo
  spegnimento del display ma non il salvaschermo). Lo stato finale e' provato dal file cache e dalla sua verifica.
