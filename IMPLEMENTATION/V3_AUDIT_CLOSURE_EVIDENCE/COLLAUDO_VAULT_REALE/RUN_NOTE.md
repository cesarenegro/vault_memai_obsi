# Collaudo sul Vault reale — `/Users/cesare/Documents/VAULT` (20/09/2026, 22:35–23:20 UTC+8)

Autorizzazione dell'utente: «PROCEDI SUL VAULT REALE». App: `/Applications/LIMEN Vault v3.app` build `4740e77`
(notarizzata `d2f0c233-…`). Backup integrale preventivo: `/Users/cesare/Documents/VAULT_BACKUP_2026-09-20_pre-v3`
(142 file, `diff -rq` identico).

Stato di partenza (sola lettura, prima di ogni azione): in `00_SYSTEM/` solo `SEARCH_INDEX.json` del 18/09;
**assenti** `VAULT_CATALOG.json` ed `EMBEDDINGS_CACHE.json`; `SYNC_PROFILE.json` senza `embeddingsProvider`.
Il Vault reale non era mai stato processato dalla v3. Confronto con la copia di collaudo: la pipeline aggiunge solo
`00_SYSTEM/VAULT_CATALOG.json` ed `EMBEDDINGS_CACHE.json` e aggiorna `SEARCH_INDEX.json` e `SYNC_PROFILE.json`;
nessun file viene scritto nelle cartelle di conoscenza o in `20_RAW_SOURCES`.

| Ora | Azione nell'app | Esito verificato |
|---|---|---|
| 22:37 | APRI VAULT ESISTENTE su `/Users/cesare/Documents/VAULT` (l'apertura esegue catalogo + estrazione) | PRONTO · 89 file Markdown · 114 fonti · 57 proposte; `VAULT_CATALOG.json` 13.213.350 byte: **114 documenti, 9.458 passaggi, 114 `ready`, 0 senza passaggi** |
| 22:38 | Chiedi → **Aggiorna indice** | `SEARCH_INDEX.json` riscritto (47.733.080 byte, 22:38:12): 114 documenti; passaggi lessicali solo per i 56 file di `20_RAW_SOURCES` (4.633), per costruzione (`search.rs`, `index_vault_search`: i passaggi vengono presi dal catalogo solo per `20_RAW_SOURCES/`); le altre note sono indicizzate come documenti interi |
| 22:39 | Avanzate → Collegamenti AI & MCP → Motore semantico → **Locale** | badge RAG 100% LOCALE; `SYNC_PROFILE.json` = `embeddingsProvider: "local"` (22:39); riquadro «Cache semantica assente: 9458 passaggi da calcolare» |
| 22:40:06 | **RICALCOLA CACHE SEMANTICA (1024 DIM)** | il servizio parte da solo: ATTIVO (PORTA 50509); a 20 s «80/9458 passaggi 0.8%» |
| 22:40 → 23:16 | monitor ogni 2 min (`monitor_ricalcolo_vault_reale.log`) | staging in crescita fino a 123 MB, poi promosso |
| 23:16:41 | `EMBEDDINGS_CACHE.json` scritto | 125.687.962 byte; **bge-m3, 1024 dim, 9.458 voci = 9.458 passaggi del catalogo, intersezione 100 %, 0 fuori catalogo, nessuno staging residuo** |
| 23:19 | Chiedi → «marca privata e distribuzione», Ricerca Ibrida attiva | **50 risultati**, badge **RAG 100% LOCALE**, nessun banner degradato; primi risultati con localizzatore («Paragrafi 36-38», «Paragrafi 68-71») — `01_ricerca_ibrida_vault_reale_232016.png` |
| 23:19 | `lsof` sui processi | `llama-server` (pid 16852): unico socket `TCP 127.0.0.1:50509 (LISTEN)`; app (pid 15384): **nessuna connessione TCP** |
| 23:20 | Chiusura regolare dell'app | app chiusa, nessun `llama-server` residuo, pidfile rimosso |

Tempo del ricalcolo: **36 min 35 s** (22:40:06 → 23:16:41) per 9.458 passaggi = 0,23 s/passaggio (Mac meno carico rispetto
alla corsa da 49 min del collaudo 3).

Il Vault reale è ora pronto per la ricerca ibrida interamente locale. Il backup può essere rimosso dall'utente quando
lo ritiene.
