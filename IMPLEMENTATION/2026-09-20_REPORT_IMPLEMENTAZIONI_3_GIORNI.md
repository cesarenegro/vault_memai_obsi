# LIMEN Vault v3 — Report completo delle implementazioni e modifiche (18–20 settembre 2026)

- **Redatto:** 2026-09-20, ore 17:10 UTC+8
- **Repository:** `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`
- **Ultimo commit descritto:** `e08b106` (codice di prodotto fino a `a08e769545d6c3b61a41deac85cef53c9825fb23`; i commit successivi contengono solo evidenze e questo report)
- **Scopo:** base di riferimento per il manuale utente. Ogni affermazione qui sotto è **verificata** su codice, git, misure o collaudo diretto, salvo dove è marcata **DA VERIFICARE**.
- **Convenzioni:** percorsi assoluti; orari in UTC+8; i numeri di riga si riferiscono al commit indicato sopra.

---

## 0. In una pagina

In tre giorni l'applicazione è passata da un motore di ricerca ibrido dipendente da OpenAI, misurato solo su un corpus sintetico, a un **RAG interamente locale** (indice lessicale BM25 + vettori semantici `bge-m3` calcolati da un `llama-server` impacchettato e firmato dentro l'app), **misurato sui documenti veri dell'utente**, con un pannello di interfaccia per scegliere il fornitore, gestire il modello e il servizio, e con degradazione esplicita a sola ricerca lessicale quando il servizio locale non è disponibile.

Lungo la strada sono stati trovati e corretti quattro difetti del motore (C8, C9, C10, C11), tre difetti di impacchettamento/permessi che impedivano al RAG locale di funzionare nell'app distribuita, e sono state prodotte evidenze riproducibili per ogni misura.

| Area | Prima (18/09) | Dopo (20/09) |
|---|---|---|
| Fornitore vettori semantici | solo OpenAI `text-embedding-3-small` (1536 dim), chiave nel Portachiavi | **OpenAI oppure Locale** `bge-m3-Q8_0` (1024 dim) via `llama-server` su `127.0.0.1`, selezionabile dall'interfaccia |
| Dati che escono dal Mac in modalità Locale | — | **zero byte** (verificato con `lsof` sul processo: unico socket `127.0.0.1:<porta>` in ascolto) |
| Punteggio lessicale sui documenti importati (`20_RAW_SOURCES`) | frequenza dei termini sempre 1 (C11) → pareggi arbitrari | **BM25** (k1=1,2 · b=0,75) con frequenza reale e normalizzazione sulla lunghezza |
| Fusione lessicale + semantica | media pesata con identificativi non riconciliati (C9), che penalizzava i documenti a solo segnale semantico (C10) | candidati coalescenti per documento; formula `max(lex, sem) + 0,20·min(lex, sem) + bonus` |
| Misura di qualità | 40 query su 120 documenti sintetici | anche **82 casi su 56 documenti reali** (4.633 passaggi) e collaudo su vault reale da 114 documenti (9.458 passaggi) |
| Pacchetto | notarizzato, senza RAG locale | notarizzato, con 16 binari nativi firmati (llama-server, 9 dylib, 5 backend ggml, OCR) |

---

## 1. Cronologia dei commit (18–20 settembre)

Tutti i commit sotto sono in `git log`; gli SHA sono abbreviati a 7 caratteri solo per leggibilità e corrispondono agli oggetti reali.

| Data (UTC+8) | Commit | Contenuto |
|---|---|---|
| 19/09 15:27 | `aec113f` | Chiusura audit R1–R6, matrice test reale, rilascio notarizzato v3.0.0 |
| 19/09 17:23 | `6c1b450` | A04 declassato a NON VERIFICATO insieme ad A05 e A15 |
| 19/09 17:33 | `446c86c` | Congelati dataset gold A05 e A15 con manifest SHA-256 |
| 19/09 17:40 | `eaa8413` | Prima misura A05 (Recall@10 = 0,475, FAIL) e A15 (p95 = 198,9 ms, PASS) |
| 19/09 20:26 | `87e41df` | Corpus A05 v2 diversificato (rilievo C5), 120 documenti, manifest |
| 19/09 20:39 | `b7ab5c6` | Testo indicizzato contestualizzato (titolo, categoria, locator nel testo da vettorializzare); misura V2 |
| 19/09 20:59 | `b462218` | Rilievo C7: chiave API letta **solo** dal Portachiavi nel prodotto |
| 19/09 21:18 | `3d88bc8` | Misura diagnostica A05: semantico 0,975 / lessicale 0,650 / ibrido 0,675 → problema nella fusione (C8) |
| 19/09 22:10 | `9cce037` | 30 query di sviluppo separate dal gold, per tarare senza consumare il gold |
| 19/09 22:27 | `2ec1996` | Fusione normalizzata min-max, pesi 0,5/0,5 (Variante B), tarata sul set di sviluppo |
| 20/09 01:30 | `4c33068` (tag `v3.1.0-fusion-fix`) | Prima corsa gold con la nuova fusione: Recall@10 = 0,950 |
| 20/09 04:54 | `37e60f3` | Rilievo C9: identificativi non riconciliati fra i due motori; misura dei duplicati (19 query su 40) |
| 20/09 05:05 | `cf79d9f` | Correzione C9: coalescenza dei candidati per documento |
| 20/09 05:06 | `ffbd99c` (tag `v3.2.0-c9-fix`) | Seconda corsa gold: 0,950 |
| 20/09 05:20–05:24 | `7dedd93`, `ebb8a97` | Rilievo C10 tarato sul set di sviluppo; formula F2 con k = 0,20 |
| 20/09 05:25 | `ca57668` (tag `v3.3.0-c10-fix`) | Terza corsa gold: 0,950 |
| 20/09 10:41 | `54d43ca` | Rilievo C11 (prima metà): tolta la deduplicazione dei token in `20_RAW_SOURCES` |
| 20/09 10:45 | `f4b6daa` | Endpoint degli embedding configurabile, HTTP ammesso solo su loopback, invalidazione cache al cambio di dimensione |
| 20/09 10:48–11:08 | `6800322`, `78187c0` | Banco di prova `a04_real_local`; Portachiavi non interrogato in locale |
| 20/09 12:33 | `faa924b` | **RAG locale integrato nel prodotto**: `llama.rs`, pannello «Motore semantico», comandi Tauri, ripiego lessicale, cache a staging, impacchettamento di `llama-server` |
| 20/09 14:22 | `29078f3` | Chiusura collaudo con ricalcolo cache al 100 % e notarizzazione |
| 20/09 15:48 | `ace11e8` | Rimozione di due schermate di collaudo non provenienti dall'applicazione |
| 20/09 16:06 | `734d0c6` | **C11 seconda metà: BM25** con normalizzazione sulla lunghezza |
| 20/09 16:24 | `83412df` | **Backend ggml impacchettati e firmati**; stderr di `llama-server` nel log |
| 20/09 16:5x | `a08e769` | **Capability Tauri** per gli eventi del webview; errori di `listen` non più silenziati |

---

## 2. Architettura del sistema RAG (come funziona, passo per passo)

### 2.1 Struttura del Vault

Il Vault è una cartella compatibile con Obsidian. Le cartelle rilevanti per la ricerca (`docs/VAULT_SPEC.md`):

| Cartella | Ruolo | Indicizzata? |
|---|---|---|
| `00_SYSTEM/` | file di sistema: `VAULT_CATALOG.json`, `SEARCH_INDEX.json`, `EMBEDDINGS_CACHE.json`, `SYNC_PROFILE.json`, `COMPILER_INDEX.json`, `M7_STATE.json`, `HOME.md`, `VAULT_RULES.md`, `VAULT_MANIFEST.json` | no (è la sede degli indici) |
| `20_RAW_SOURCES/` | **fonti originali in sola lettura** (trascrizioni `.txt`, `.md`, PDF, DOCX, PPTX, XLSX, immagini con OCR) | sì, tramite catalogo ed estrazione |
| `01_CLIENTS/` … `10_APPROVED_OUTPUTS/` | cartelle di conoscenza (note Markdown approvate) | sì, direttamente dal testo Markdown |
| `90_PROPOSALS/` | bozze generate dall'automazione (candidate alla conoscenza) | sì, come `proposal` |
| `80_AI_OUTPUTS/` | risposte AI salvate come bozza | sì, se Markdown |
| `99_ARCHIVE/` | archivio | — |

### 2.2 Pipeline di indicizzazione

```
file in 20_RAW_SOURCES ──► catalogo (VAULT_CATALOG.json) ──► estrazione testo ──► passaggi (chunking)
                                                                     │
        note Markdown nelle cartelle di conoscenza ───────────────────┤
                                                                     ▼
                                   indice lessicale (SEARCH_INDEX.json)  ◄── BM25 a query-time
                                                                     ▼
                     cache vettoriale (EMBEDDINGS_CACHE.json) ◄── bge-m3 locale o OpenAI
```

1. **Catalogo** — `catalog.rs::sync_catalog_from_vault` (riga 426) scansiona `20_RAW_SOURCES` con deduplicazione per hash di contenuto e conservazione degli alias; ogni documento riceve un `documentId = "doc_" + sha256(percorso relativo)[..16]` (riga 214). Le cartelle di conoscenza 01–10 vengono scansionate separatamente (righe 598–602).
2. **Estrazione** — `catalog.rs::process_pending_extractions` (riga 868) porta i documenti da `pending` a `ready`. Testo e Markdown sono letti direttamente; PDF, DOCX, PPTX, XLSX e immagini passano per l'estrattore nativo `limen-extract` (Swift, con OCR macOS), impacchettato in `Contents/Resources/native/`. Nessun modello generativo tocca il testo sorgente (`extraction.rs`, intestazione).
3. **Segmentazione in passaggi** — `catalog.rs::chunk_text_to_passages` (riga 218): passaggi da **1.200 caratteri** con **sovrapposizione di 150** (righe 224–225); i paragrafi oltre 1.050 caratteri sono spezzati su confini di frase; le intestazioni `## Pagina N` e `## Slide N` generate dall'estrattore diventano il *locator* del passaggio e impongono una cesura (nessun passaggio a cavallo di due pagine). Ogni passaggio ha `passageId`, `locator`, `sha256` del testo, `charCount`.
4. **Indice lessicale** — `search.rs::index_vault_search` (riga 507): per ogni documento salva `tokens` (sacchetto completo delle parole, minuscole, senza accenti, senza stop-word — `tokenize_text`, riga 276), `content_preview` (primi 500 caratteri) e i passaggi con i loro token. Protetto da un lock cooperativo `00_SYSTEM/.search-lock` con PID del proprietario. **Dal commit `54d43ca` i token di `20_RAW_SOURCES` non sono più deduplicati** (rilievo C11).
5. **Cache vettoriale** — `embeddings.rs::sync_embeddings`: per ogni passaggio calcola un vettore dal testo **contestualizzato** (titolo del documento, categoria e locator anteposti al testo del passaggio, con tetto al 20 % della lunghezza — `build_passage_embedding_text`, commit `b7ab5c6`), lo memorizza con `embeddedTextSha256`; se il testo contestualizzato o il modello o la dimensione cambiano, la voce viene ricalcolata. La cache dichiara `model` e `dimensions`.

### 2.3 Fornitore dei vettori: OpenAI o Locale

Impostazione persistita in `00_SYSTEM/SYNC_PROFILE.json`, chiave **`embeddingsProvider`** con valori `"openai"` | `"local"` (`embeddings.rs::get_embeddings_provider`, riga 44). **Non si persiste nessun URL**: l'endpoint viene costruito a runtime.

| | OpenAI | Locale |
|---|---|---|
| Endpoint | `https://api.openai.com/v1/embeddings` | `http://127.0.0.1:<porta libera>/v1/embeddings` |
| Modello | `text-embedding-3-small` | `bge-m3-Q8_0.gguf` |
| Dimensioni | 1536 | 1024 |
| Chiave API | dal Portachiavi macOS (`keychain.rs`), mai da variabili d'ambiente nel prodotto (rilievo C7) | **non richiesta, non inviata** |
| TLS | obbligatorio (`https_only`) | http ammesso **solo** per `127.0.0.1`, `localhost`, `::1` (`is_loopback_endpoint`, riga 59); qualunque host esterno in http viene rifiutato con errore |

Regola di sicurezza: con fornitore `local` un endpoint non di loopback viene **rifiutato** (`validate_provider_endpoint`, riga 160, test `test_local_provider_rejects_non_loopback_endpoint`). L'interfaccia non permette di digitare URL.

### 2.4 Il servizio locale `llama-server` (modulo `llama.rs`, 659 righe)

- **Binario**: `Contents/Resources/native/llama-server` (llama.cpp, build Homebrew 0.4.0 b10809) con le sue librerie `libllama*`, `libggml*`, `libmtmd`, `libomp`, `libssl`, `libcrypto` e i **backend di calcolo** `libggml-metal.so`, `libggml-cpu-apple_m1.so`, `libggml-cpu-apple_m2_m3.so`, `libggml-cpu-apple_m4.so`, `libggml-blas.so`. Tutti con `install_name` riscritti (0 dipendenze da `/opt/homebrew`, verificato con `otool -L`) e **firmati con il Team ID dell'app** `ZVGX4HFZC3` — necessario perché con il runtime indurito `dyld` rifiuta librerie di Team ID diverso.
- **Modello**: `~/Library/Application Support/LIMEN Vault/models/bge-m3-Q8_0.gguf`, **634.553.760 byte**, SHA-256 `950f4a8e5e19477a6d3c26d2f162233c20002c601f75e4b002e3239997821167`, scaricato una sola volta da `gpustack/bge-m3-GGUF` con verifica del checksum, oppure installato da file locale (stessa verifica). Non è nel DMG.
- **Ciclo di vita**: avvio su richiesta (non all'apertura dell'app); porta scelta libera con `TcpListener::bind("127.0.0.1:0")` (`find_free_port`, riga 304); argomenti `-m <modello> --embedding --host 127.0.0.1 --port <p> -ub 2048 -b 2048`; controllo di salute su `/health` entro 25 s; verifica che il vettore abbia esattamente 1024 componenti; istanza unica; spegnimento agganciato a `RunEvent::ExitRequested`/`Exit` in `main.rs` (nessun processo orfano); massimo 3 riavvii dopo caduta.
- **Diagnostica**: dal commit `83412df` lo stderr del processo va in `~/Library/Application Support/LIMEN Vault/models/llama-server.log` e le ultime 3 righe compaiono nell'errore in interfaccia (prima: solo «exit status 1»).
- **Prova di rete** (collaudo su app installata, 20/09 16:33 UTC+8): `lsof -nP -a -p <pid> -i` mostra un solo socket, `TCP 127.0.0.1:59667 (LISTEN)`; processo padre = `limen-vault`.

### 2.5 Ricerca: lessicale, semantica, ibrida

Comando Tauri `search_vault_hybrid` (`main.rs`, riga 817) → `embeddings.rs::hybrid_search_vault_with_port` (riga 825).

**Lessicale** (`search.rs::search_vault`, righe ~605–800). Per ogni termine della query, punteggio documentale **BM25**:

```
score += idf · tf·(k1+1) / (tf + k1·(1 − b + b·dl/avgdl))      k1 = 1,2   b = 0,75
idf = ln((N+1)/(df+1)) + 1
```
più `+10` se il termine è nel titolo, `+5` se nei tag. `dl` = numero di token del documento, `avgdl` = media sull'indice, calcolati a ogni query (una passata sui documenti). A livello di passaggio si calcola `tf·idf` con `+15` se il passaggio contiene la frase esatta; il miglior passaggio fornisce locator e snippet, e sostituisce il punteggio documentale solo quando questo è zero. Ordinamento: punteggio decrescente, poi data di aggiornamento, poi percorso.

**Semantica**: similarità coseno fra il vettore della query e i vettori dei passaggi; il documento prende il punteggio del suo miglior passaggio (`rank_document_semantic`).

**Ibrida** (rilievi C9 e C10): i candidati dei due motori vengono **riconciliati per documento** (`normalize_id` porta gli id a 20 caratteri; l'indice lessicale usa `doc_<64 hex>`, il catalogo `doc_<16 hex>`, stesso sha256 del percorso); per ogni documento si normalizzano min-max i due punteggi sull'insieme dei candidati e si fonde:

```
fused = max(lex_norm, sem_norm) + 0,20 · min(lex_norm, sem_norm) + exact_bonus
exact_bonus = 0,20 se la query è un codice (solo alfanumerici con cifre/`-`/`_`), 0,05 se il termine intero compare in titolo o snippet, altrimenti 0
```

**Modalità degradata**: se il fornitore è `local` e il servizio non è sano, `active_port = None`, la ricerca procede **solo lessicale**, la funzione restituisce `degraded = true` e `main.rs:849` emette l'evento `search_mode_status` al frontend. In nessun caso si ripiega su OpenAI quando il fornitore è locale. Copertura: test `embeddings::tests` che asserisce `degraded` e nessuna chiamata a OpenAI a servizio spento.

### 2.6 Migrazione della cache al cambio di fornitore

Passando da OpenAI (1536) a Locale (1024) tutti i vettori vanno ricalcolati. Il ricalcolo scrive in `00_SYSTEM/EMBEDDINGS_CACHE.staging.json` e la cache precedente resta intatta fino al completamento; l'operazione è ripristinabile senza ripartire da zero. Tempo misurato: 4.633 passaggi in 846,64 s (~183 ms/passaggio) su Mac M2 8 GB; 9.458 passaggi nel collaudo su vault reale. `needsReindex` è calcolato confrontando gli identificativi dei passaggi del catalogo con le chiavi della cache (non solo la dimensione).

---

## 3. Interfaccia grafica: cosa c'è e dove

Descrizione basata sull'applicazione installata `/Applications/LIMEN Vault v3.app` (Desktop v3 0.3.0), osservata direttamente il 20/09.

### 3.1 Schermata iniziale
- Titolo «Benvenuto in LIMEN Vault v3».
- Campo **Percorso del Vault (cartella locale)** precompilato con `~/Documents/VAULT`.
- Pulsanti **CREA NUOVO VAULT** e **APRI VAULT ESISTENTE**.

### 3.2 Barra laterale
- **CARICA DOCUMENTI** (pulsante verde): importazione di file nel Vault.
- **Chiedi** — ricerca nel Vault e domande all'AI.
- **Documenti** (con contatore, es. 114) — elenco dei documenti; in codice esistono filtri per formato: *Tutti i formati, PDF, Word (DOCX), Excel / Fogli, Testo e Note*.
- **Memoria** (con contatore, es. 89) — note Markdown di conoscenza.
- **Avanzate** — manutenzione e impostazioni.
- In basso: **Apri in Obsidian**.

### 3.3 Panoramica
Stato del Vault (PRONTO), percorso, contatori: **File Markdown**, **Fonti originali** (documenti in sola lettura), **File delle proposte** (revisioni delle bozze), **Integrità SHA-256** con elenco delle differenze rispetto al manifesto (file modificati, mancanti, aggiunti).

### 3.4 Chiedi — «Cerca nel Vault & Chiedi all'AI»
- Casella di ricerca «Cerca parole chiave, contratti, clienti, passaggi di documenti…», menu **Tutte le categorie**, **Filtro cliente**, **Filtro progetto**, pulsante **Cancella ricerca**, pulsante **Aggiorna indice**.
- Casella **Ricerca Ibrida (Semantica + Lessicale)** e badge **RAG 100% LOCALE** (quando il fornitore è locale).
- Risultati: titolo, locator (es. «Paragrafi 36–38»), categoria (`Proposta`, `raw_source`, …), snippet, percorso nel Vault, **Apri nel lettore** (lettore con verifica SHA-256 del passaggio).
- **Chiedi al Vault**: selettore **Modello OpenAI** (elenco da OpenAI con la chiave del Portachiavi, o nome inserito a mano), area di testo «Fai una domanda sul tuo Vault», casella «Includi bozze indicizzate e note non approvate (le fonti originali sono escluse)», pulsante **ANTEPRIMA FONTI** (mostra le fonti locali prima di inviare a OpenAI solo i documenti visualizzati). Le domande non modificano le note; **SALVA RISPOSTA COME BOZZA** crea una bozza locale.
- **Banner di modalità degradata** (giallo, `role="alert"`): compare quando `useSemanticSearch` è attivo e l'ultima ricerca è stata eseguita in sola modalità lessicale per servizio locale non disponibile. **DA VERIFICARE nell'app installata dopo il commit `a08e769`** — vedi §6.

### 3.5 Avanzate e Manutenzione — sottoschede
1. **Bozze e Proposte** — due sotto-elenchi: *Risposte AI salvate (80_AI_OUTPUTS)* e *Proposte manuali (90_PROPOSALS)*. «Revisione delle proposte»: le proposte sono bozze del percorso manuale, da leggere, correggere e **approvare** prima dell'inserimento nella conoscenza. Pulsanti **AGGIORNA**, **RECUPERA OPERAZIONE INTERROTTA**, menu **Categoria importazione** (es. *Cliente*). Ogni proposta approvata mostra la **decisione registrata** (JSON con `action`, `actor`, `at`, `publishedSha256`, `revision`, `sha256`, `targetPath`) e il contenuto della revisione.
2. **Copie locali e Ripristino** — snapshot e ripristino in cartella separata con verifica degli hash.
3. **Trasferimenti** — sincronizzazione (modulo `sync.rs`).
4. **Collegamenti AI & MCP** — contiene il pannello **Motore semantico** (§3.6), poi **Collegamenti AI** (chiave OpenAI: SALVA CHIAVE / VERIFICA PORTACHIAVI / RIMUOVI CHIAVE), **MCP in sola lettura · Vault corrente** (ATTIVA MCP LOCALE / REVOCA MCP, con indirizzo, ID Vault e token riservato), **ChatGPT Business · tunnel privato** (ID tunnel, ID organizzazione, chiave di esecuzione; SALVA / AVVIA / ARRESTA), **Impostazioni del Vault** (cartella locale).
5. **Compilatore manuale** — «Compila file di testo e Markdown in bozze `90_PROPOSALS/`», pulsante **COMPILA FONTI TESTO**.
6. **Stato di Sistema** — tabella dello stato locale.
7. **Guida Vault** — documentazione impacchettata.

### 3.6 Pannello «Motore semantico» (nuovo, `SemanticEngineSettings.tsx`)
- Badge **RAG 100% LOCALE** quando il fornitore è locale.
- Scelta esclusiva: **OpenAI (in rete)** — «Modello text-embedding-3-small (1536 dim). Richiede chiave API configurata nel Portachiavi e connessione internet» — oppure **Locale (bge-m3, nessun dato esce dal Mac)** — «Modello bge-m3-Q8_0.gguf (1024 dim) eseguito dal motore integrato. Funzionamento 100% offline a rete zero».
- Riquadro **Modello locale (bge-m3-Q8_0.gguf)**: stato (INSTALLATO (SHA-256 OK) / non installato), percorso, dimensione (605,2 MB · 634.553.760 byte), pulsante di scaricamento con barra di avanzamento e selettore di file per installazione manuale.
- Riquadro **Servizio locale di calcolo**: stato **SPENTO** / **ATTIVO (PORTA n)** / **ERRORE** con ultimo errore leggibile; pulsanti **AVVIA SERVIZIO LOCALE** / **ARRESTA SERVIZIO LOCALE** e **AGGIORNA STATO**; testo «Il servizio è in ascolto su loopback http://127.0.0.1:<porta> con modello bge-m3-Q8_0.gguf. Controllo di salute /health superato».
- Riquadro **Cache semantica del Vault**: «N passaggi indicizzati (1024 dim)» e avviso di allineamento con il fornitore attivo; se le dimensioni non coincidono, pulsante per il ricalcolo con avanzamento.
- Messaggio di esito in fondo (es. «Servizio locale avviato con successo sulla porta 59667»).

### 3.7 Comandi Tauri aggiunti (interfaccia ↔ motore)
`embeddings_get_provider`, `embeddings_set_provider`, `local_model_status`, `local_model_download` (con evento `local_model_download_progress`), `local_server_start`, `local_server_stop`, `local_server_status`, `embeddings_sync_vault` (evento `embeddings_sync_progress`), `search_vault_hybrid` (evento `search_mode_status`). Esposti in `apps/desktop/src/ai-ipc.ts`.

---

## 4. Workflow di lavoro dell'utente

1. **Apertura o creazione del Vault** dalla schermata iniziale.
2. **Caricamento documenti** (CARICA DOCUMENTI o copia in `20_RAW_SOURCES/`): il catalogo li registra, l'estrattore produce il testo, i passaggi vengono creati. Il modulo `automation.rs` (ingestione RAW persistente, opt-in) può eseguire il ciclo automaticamente: i file generati sono immutabili e mai approvati automaticamente.
3. **Prima configurazione del motore semantico** (Avanzate → Collegamenti AI & MCP → Motore semantico): scegliere **Locale**, scaricare il modello (una sola volta, ~605 MB), avviare il servizio (o lasciarlo partire su richiesta), attendere il ricalcolo della cache (una sola volta per Vault; per 9.458 passaggi circa 30 minuti su M2 — **misurato** 846,64 s per 4.633).
4. **Ricerca** (Chiedi): con «Ricerca Ibrida» attiva si ottengono risultati ordinati per fusione; senza, solo lessicale. Ogni risultato apre il lettore con verifica di integrità.
5. **Domanda all'AI** (facoltativa, va in rete verso OpenAI): ANTEPRIMA FONTI mostra cosa verrà inviato; solo i documenti mostrati vengono inviati; la risposta può essere salvata come bozza in `80_AI_OUTPUTS`.
6. **Compilazione e proposte**: il compilatore trasforma fonti di testo in bozze in `90_PROPOSALS/`; l'utente le rivede e le **approva** (Bozze e Proposte) → il documento entra nella cartella di conoscenza scelta (es. `07_CASE_STUDIES/`), con decisione registrata e hash. Dopo modifiche manuali: **Aggiorna indice**.
7. **Protezione**: snapshot e ripristino (Copie locali e Ripristino); integrità SHA-256 in Panoramica.
8. **Condivisione controllata**: MCP in sola lettura per client esterni (note approvate), tunnel privato per ChatGPT Business — entrambi disattivi per impostazione predefinita.

---

## 5. Misure e difetti trovati (con evidenze)

Tutte le evidenze sono in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/`.

### 5.1 Linea A05 (corpus sintetico, 40 query gold, 120 documenti)
| Corsa | Commit | Motore | Recall@10 ibrido | Mancate |
|---|---|---|---|---|
| storica v1 | `eaa8413` | corpus v1 con boilerplate (C5) | 0,475 | 21 |
| baseline v2 | `b7ab5c6` | fusione RRF originaria | 0,675 | 13 |
| 1 | `4c33068` | fusione min-max 0,5/0,5 (C8 corretto) | 0,950 | Q21, Q26 |
| 2 | `ffbd99c` | + coalescenza C9 | 0,950 | Q12, Q18 |
| 3 | `ca57668` | + formula C10 | 0,950 | Q21, Q37 |

Semantico puro 0,975 e lessicale puro 0,650 in tutte e tre. Intervallo di Wilson al 95 % per 38/40: [0,835 – 0,986]: la soglia 0,90 è superata dalla stima, non dal limite inferiore. Il gold è stato interrogato dal motore cinque volte sul corpus v2: non va più usato per tarature.

### 5.2 Linea A04 su corpus **reale** (56 file di `20_RAW_SOURCES`: 28 trascrizioni Whisper + 28 versioni RAG, 4.633 passaggi; 82 frasi esatte con verità di riferimento automatica)
| Motore lessicale | P@1 | R@10 | Pari merito al rango 1 | Documenti distinti al rango 1 | Mediana byte del vincitore |
|---|---|---|---|---|---|
| tf = 1 (prima di C11) | 0,902 | 1,000 | 14 (gruppi fino a 10) | 36 | 48.709 |
| tf reale senza normalizzazione | 0,146 | 0,585 | 0 | 14 | **227.401** (il file più grande vince 47 volte su 82) |
| **BM25** (attuale) | **0,939** | **1,000** | 1 | 32 | 48.208 |

Con bge-m3 locale (prima di BM25): semantico P@1 0,598 / R@10 0,890; ibrido R@10 0,915 ma P@1 0,341 perché la fusione declassava 24 dei 49 rango-1 semantici (segnale lessicale allora dominato dai documenti lunghi). **Ibrido con BM25: DA MISURARE.**

### 5.3 Rilievi chiusi in questi tre giorni
- **C5** corpus omogeneo → corpus v2 diversificato (Jaccard ≤ 0,2154).
- **C7** chiave API da variabile d'ambiente nel prodotto → solo Portachiavi.
- **C8** fusione RRF che annullava la semantica → normalizzazione min-max.
- **C9** identificativi non riconciliati (duplicati in top 10 in 19 query su 40) → coalescenza per documento; 0 duplicati nelle corse 2 e 3 (misurato anche sul motore della corsa 3, cartella `C9_DUPLICATI_POST_C10`).
- **C10** penalizzazione dei documenti a solo segnale semantico → formula F2 k = 0,20; 5/5 query senza match lessicale in top 10.
- **C11** frequenza dei termini sempre 1 in `20_RAW_SOURCES` (righe 559–560 di `search.rs`, `sort()+dedup()`) → rimossa; e BM25 per la lunghezza.
- **Impacchettamento RAG locale** (tre difetti scoperti solo collaudando l'app installata): (a) backend ggml assenti → «no backends are loaded»; (b) backend presenti ma firmati da Team ID diverso → rifiutati da dyld; (c) `capabilities/` assente → `event.listen` negato, banner e barre di avanzamento muti.

### 5.4 Aperti
- **A04**: R@10 lessicale 1,000 e P@1 0,939 sul corpus reale, ma il requisito recita «100 % dei casi nella vista pertinente» e il ranking ibrido va rimisurato con BM25.
- **A15** è misurato su corpus sintetico da 1.000 documenti; il vault reale ne ha 114.
- Bonus di frase esatta `0,05`: mai attivo sulle query gold (frasi lunghe); ramo `0,20` mai esercitato da alcun benchmark.
- Nessuna interfaccia per scegliere fra i backend CPU (`m1`/`m2_m3`/`m4`): li seleziona ggml a runtime.

---

## 6. Collaudo sull'applicazione installata (20/09, UTC+8)

Vault di collaudo: copia integrale del Vault reale in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/scratch/vault_collaudo_local_rag_v2/` (114 documenti, 9.458 passaggi, cache bge-m3 con intersezione 100 % — verificata), senza alcuna cache copiata da altri vault.

| Ora | Azione nell'app | Esito osservato |
|---|---|---|
| 16:32 | Apertura del vault dalla schermata iniziale | PRONTO · 89 file Markdown · 114 fonti · 57 proposte |
| 16:33 | Avanzate → Collegamenti AI & MCP → Motore semantico | Locale selezionato; modello INSTALLATO (SHA-256 OK); servizio SPENTO; cache 9.458 passaggi (1024 dim) allineata |
| 16:33 | AVVIA SERVIZIO LOCALE → AGGIORNA STATO | **ATTIVO (PORTA 59667)**, `/health` superato, «Servizio locale avviato con successo sulla porta 59667» |
| 16:33 | `lsof` sul processo figlio (pid 10561, padre `limen-vault`) | unico socket `127.0.0.1:59667 (LISTEN)`; zero connessioni esterne |
| 16:33 | Chiedi → «marca privata e distribuzione», Ricerca Ibrida attiva | 50 risultati; primi: «Evoluzione della grande distribuzione…», «Factory 2026 — Pubblicità, private label…» |
| 16:34 | Terminazione del servizio dal sistema (`kill`) | processo terminato, nessun riavvio automatico (il riavvio scatta solo su caduta rilevata) |
| 16:35 | Nuova ricerca «naming» | 50 risultati **ma nessun banner di modalità degradata** → difetto delle capability Tauri, corretto in `a08e769` |

Prima di questo collaudo, la stessa sequenza sull'app allora installata falliva ad **AVVIA SERVIZIO LOCALE** con «llama-server uscito con codice exit status: 1»: causa i backend ggml (§5.3).

**Verifica sul bundle `a08e769` installato (19:16–19:20 UTC+8)**, evidenze in `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/COLLAUDO_COMPITO_1_V3_APP_INSTALLATA/` (schermate reali 2880×1864 catturate con la scorciatoia di sistema, più `RUN_NOTE.md`):

| Ora | Azione | Esito |
|---|---|---|
| 19:17 | AVVIA SERVIZIO LOCALE dal pannello | **ATTIVO (PORTA 60411)**, `/health` superato |
| 19:17 | Ricerca ibrida «marca privata e distribuzione» | 50 risultati, badge **RAG 100% LOCALE** |
| 19:17:57 | `kill` del processo (pid 19379, unico socket `127.0.0.1:60411`) | terminato |
| 19:18 | Ricerca «naming» a servizio spento | 50 risultati lessicali, badge **«RAG LOCALE SPENTO (SOLO LESSICALE)»** e **banner giallo** «Modalità degradata (solo ricerca lessicale)… Nessun dato è uscito dal Mac» |
| 19:20 | Riavvio dal pannello | ATTIVO (porta 60470), ricerca ibrida di nuovo attiva |

Resta **DA VERIFICARE** solo la barra di avanzamento del ricalcolo della cache dall'interfaccia (nel collaudo la cache era già completa).

Nota operativa: nella cartella `~/Applications/` esiste ancora **`LIMEN Vault 0.2.0.app`**, una versione precedente con lo stesso identificativo `dev.arkai.limenvault`; Launchpad/Spotlight possono aprirla al posto della v3. Va rimossa dall'utente.

---

## 7. Rilascio e firma

- Pipeline: `pnpm --filter @limen-vault/desktop tauri build` → `scripts/package-v3.sh prepare` (firma di ogni file in `Contents/Resources/native/` — `*.dylib`, `*.so`, eseguibili — e dell'app; invio ad Apple Notary) → `package` (graffettatura app, DMG con Applications/HELP/guide, invio DMG) → `finish` (graffettatura DMG).
- Identità: `Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)`; profilo notarile `LIMEN-M9`.
- Esiti del 20/09: app `07e5abcb-aaee-41fa-9adb-f056209088a0` **Accepted**; DMG `56892416-9783-4033-9fcd-3fd510c65bf9` **Accepted**; verifica indipendente sull'app installata: `spctl` accepted / `source=Notarized Developer ID`, `stapler validate` OK, `codesign --verify --deep --strict` valido. Secondo giro per `a08e769`: app `6b0a0583-4974-4f55-bf96-278c2921c475` **Accepted**, DMG accettato e graffettato, installata in `/Applications` e verificata (`spctl` accepted, `stapler validate` OK, firma profonda valida) alle 18:5x UTC+8. È la build in uso per il collaudo del §6.
- Evidenze: `IMPLEMENTATION/V3_EVIDENCE/` (`app-submit.json`, `app-status.json`, `app-staple.log`, `app-gatekeeper.log`, `dmg-*.json/log`, `app-signature.log`).

---

## 8. Sicurezza e riservatezza (stato al 20/09)

- Con fornitore **Locale**: nessun dato esce dal Mac per la ricerca; verificato con `lsof` (§6). Le sole uscite in rete dell'app sono quelle esplicite e attivate dall'utente: OpenAI per «Chiedi al Vault» e per il fornitore OpenAI; scaricamento una-tantum del modello; MCP/tunnel se attivati.
- Chiave OpenAI: solo nel Portachiavi macOS; non interrogato quando il fornitore è locale.
- `https_only` attivo per ogni host non di loopback; endpoint locale mai persistito; URL non digitabili dall'interfaccia.
- CSP del webview: `default-src 'self'`, `connect-src ipc: http://ipc.localhost`, `frame-src 'none'`.
- Binari nativi firmati e notarizzati; runtime indurito.
- Capability Tauri `capabilities/default.json`: `core:default`, `dialog:default` per la finestra `main` (nessun permesso di shell, fs o http concesso al webview).

---

## 9. Come aggiungere altri sistemi di indicizzazione (es. «LLM Wiki»)

Il progetto ha già tre canali di ingresso della conoscenza; un «LLM Wiki» (note di sintesi generate dall'AI a partire dalle fonti) si innesta su quelli esistenti senza cambiare il motore di ricerca.

### 9.1 Punti di estensione esistenti
1. **Cartelle di conoscenza** (`01_…10_`): qualunque file Markdown scritto lì viene indicizzato direttamente (lessicale + semantico) con titolo, categoria e tag dal frontmatter. È il canale più semplice: un generatore esterno che scrive Markdown ben formato è già indicizzato.
2. **`90_PROPOSALS/` + approvazione umana** (`compiler.rs::compile_source`, `batch_compile_sources`, `list_proposals`; `proposals.rs::execute` con checkpoint): le bozze generate restano *proposte* finché un umano non le approva; l'approvazione registra decisione, revisione e hash. È il canale corretto per contenuti generati da un LLM: garantisce che nulla di inventato entri nella conoscenza senza revisione.
3. **Automazione opt-in** (`automation.rs::configure/run/run_with`, stato in `00_SYSTEM/M7_STATE.json`): ingestione persistente delle fonti RAW con ricevute per file, riprese dopo interruzione, limite di 3 tentativi sulle chiamate API, nessuna promozione automatica di `legacy_draft`. Il ciclo `run_with` riceve una funzione «chiedi al modello» — oggi OpenAI — e può ricevere un modello locale.
4. **Contestualizzazione dei passaggi** (`build_passage_embedding_text`): qualunque metadato aggiunto ai documenti (es. sezione della wiki, entità) entra automaticamente nel testo vettorializzato entro il 20 %.

### 9.2 Schema proposto per un LLM Wiki locale
- **Generazione**: per ogni sessione/fonte in `20_RAW_SOURCES`, un modello genera una nota di sintesi con frontmatter (`title`, `category`, `tags`, `sources: [documentId, passageId…]`) in `90_PROPOSALS/`. Se il modello è locale (llama.cpp supporta anche modelli di testo via `/v1/chat/completions`), l'infrastruttura di `llama.rs` — binario firmato, porta dinamica, salute, spegnimento — è riusabile con un secondo modello GGUF.
- **Revisione**: approvazione dalla scheda Bozze e Proposte → la nota entra nella cartella di conoscenza scelta con decisione registrata.
- **Indicizzazione**: automatica (§2.2): la nota approvata è lessicalmente e semanticamente cercabile; le citazioni ai passaggi (`passageId` + `sha256`) sono verificabili nel lettore.
- **Collegamento wiki**: i `[[wikilink]]` di Obsidian sono già ripuliti da `strip_markdown` per l'indice; per usarli come grafo serve un indice aggiuntivo (nuovo file in `00_SYSTEM/`, es. `LINK_INDEX.json`, costruito in `index_vault_search`).

### 9.3 Altri indici possibili, e cosa serve
| Indice | Cosa aggiungere | Dove |
|---|---|---|
| Entità/nomi (persone, aziende, marchi) | estrazione deterministica o via modello in fase di estrazione; campo `entities` nel catalogo; bonus nel punteggio | `catalog.rs` (estrazione), `search.rs` (punteggio), `SearchDocumentRecord` |
| Grafo dei collegamenti | tabella `[[link]]` → documento | `search.rs::index_vault_search` |
| Riassunti per documento («abstract») | nota generata in `90_PROPOSALS` per ogni fonte, approvata | canale 2 |
| Indice temporale (data dell'incontro) | il frontmatter delle RAG `.md` ha già «Data dell'incontro»; va estratto in un campo del catalogo e usato come filtro | `catalog.rs`, filtri in `SearchQuery` |
| Re-ranking con modello locale | cross-encoder o LLM locale sui primi 50 risultati ibridi | nuovo passo in `hybrid_search_vault_with_port` dopo la fusione |

Regole da rispettare per qualunque nuovo indice: (1) scrivere in `00_SYSTEM/` con scrittura atomica e lock; (2) invalidare per hash come fa la cache vettoriale; (3) niente rete se il fornitore è locale; (4) misurare prima/dopo sul set di 82 casi reali e sul vault di collaudo, con evidenze ricalcolabili.

---

## 10. File e cartelle di riferimento

| Cosa | Percorso |
|---|---|
| Motore di fusione e fornitori | `apps/desktop/src-tauri/src/embeddings.rs` |
| Indice lessicale e BM25 | `apps/desktop/src-tauri/src/search.rs` |
| Catalogo, estrazione, chunking | `apps/desktop/src-tauri/src/catalog.rs`, `extraction.rs` |
| Servizio locale e modello | `apps/desktop/src-tauri/src/llama.rs` |
| Comandi Tauri | `apps/desktop/src-tauri/src/main.rs` |
| Capability del webview | `apps/desktop/src-tauri/capabilities/default.json` |
| Binari nativi impacchettati | `apps/desktop/src-tauri/resources/native/` |
| Pannello Motore semantico | `apps/desktop/src/SemanticEngineSettings.tsx` (montato da `AiPanel.tsx` → `AiSettings`) |
| Ricerca e banner | `apps/desktop/src/App.tsx` (scheda `search`, listener `search_mode_status`) |
| Script di rilascio | `scripts/package-v3.sh` |
| Banchi di prova | `apps/desktop/src-tauri/src/bin/gold-benchmark.rs`, `a04_real_local.rs`, `collaudo_compito1.rs`, `diagnose_c8.rs`, `c10_tune_dev.rs` |
| Dataset congelati | `tests/gold/` (A05, A15, `A04_REAL_QUERIES.json`) |
| Vault di misura | `tests/scratch/real_vault_v1/`, `tests/scratch/vault_collaudo_local_rag_v2/` |
| Evidenze | `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/`, `IMPLEMENTATION/V3_EVIDENCE/` |
| Documentazione utente esistente | `HELP/00_INDICE.md` … `07_AUTOMAZIONE_DOCUMENTI.md`, `docs/GUIDA_UTENTE_LIMEN.md`, `manuale UI utente.txt` |
