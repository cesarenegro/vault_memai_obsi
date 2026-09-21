# Misure del ricalcolo della cache semantica (21/09/2026, 06:48–07:56 UTC+8)

Scopo: capire dove va il tempo del ricalcolo nell'app (0,23–0,31 s/passaggio misurati il 20/09) rispetto al banco a
lotti con testo grezzo (0,09 s/passaggio). Strumento: stesso codice del prodotto (`sync_embeddings_with_port`) eseguito
dal binario `sync_timing` con `LIMEN_SYNC_TIMING=1` (tempo per lotto della richiesta HTTP e della scrittura dello
staging) e `LIMEN_SYNC_BATCH` (dimensione del lotto). Vault: copia senza cache di `vault_collaudo_ricalcolo_cache`
(114 documenti, 9.458 passaggi). Server: `llama-server` incluso nell'app, con Metal (`GGML_BACKEND_PATH`), porta 8093,
dedicato. Mac M2 8 GB, memoria libera 30 % all'avvio, **in uso dall'utente durante le corse** (load average 18–38 a fine
corsa). File: `run_lotto16.timing.log`, `run_lotto64.timing.log` (una riga per lotto), `run_lotto*.stdout`.

| | Lotto 16 (predefinito) | Lotto 64 |
|---|---|---|
| Tempo totale | **1.841 s (30 min 41 s)** | **2.214 s (36 min 54 s)** |
| Richieste al server | 1.818,8 s = **98,8 %** | 2.201,1 s = **99,4 %** |
| Scritture dello staging (30, file fino a 125 MB) | 14,2 s = **0,8 %** (media 472 ms, max 2,5 s) | 12,1 s = 0,5 % |
| Resto (preparazione testi, JSON, ciclo) | ~8 s | ~1 s |
| Caratteri per passaggio (testo contestualizzato) | 1.204 | 1.204 |
| Tempo per passaggio | 0,195 s | 0,234 s |
| Andamento in 6 tratti (s/passaggio) | 0,15 · 0,20 · 0,19 · 0,20 · 0,21 · 0,20 | 0,18 · 0,21 · 0,22 · 0,19 · 0,18 · 0,21 |

Esiti, con prova:
1. **Il tempo è quasi tutto nel calcolo del server** (≥ 98,8 %). La scrittura dello staging vale meno dell'1 %: l'ipotesi
   «candidato principale» del 20/09 è **smentita**; non va toccata.
2. **Lotti da 64 non aiutano: sono più lenti** (+20 %) con questo carico. L'ipotesi «la GPU rende meglio con lotti grandi»
   (dal banco su Mac scarico) **non si conferma** nell'uso reale; il lotto 16 resta.
3. La differenza con il banco a 0,09 s/passaggio dipende dal **carico del Mac** (primo tratto 0,15 s, poi 0,20 s stabile;
   load average 18–38 durante le corse; i primi 13 lotti della corsa 16 erano a 0,12 s) e in piccola parte dal testo
   contestualizzato (+17 % di caratteri rispetto al banco). Non è un costo del codice dell'app.
4. Conseguenza pratica: **nessuna modifica al codice è giustificata dalle misure.** L'unico modo per accorciare il
   ricalcolo è farlo con il Mac scarico (a 0,09–0,12 s/passaggio i 9.458 passaggi costano 14–19 minuti invece di 31–37).
