# Audit M5 — dichiarazione AG di chiusura non confermata

12 settembre 2026. Incarico: verificare l’implementazione M5 dichiarata conclusa da AG. Audit di codice e prove mirate; nessuna correzione applicativa, commit, push o deploy.

**Esito: implementazione parziale locale; chiusura M5 bloccata da difetti riprodotti.** La baseline M4 resta documentata come chiusa nella sessione precedente; questo audit non è una riconvalida completa M2–M4 dopo le modifiche AG.

## Riscontri prioritari

### 1. P1 — L’indicizzazione Rust può sovrascrivere una nota

`apps/desktop/src-tauri/src/search.rs:77-110`: sanitize_path controlla solo il percorso lessicale; il caricamento segue symlink e ignora errori di parsing, mentre fs::write segue il symlink dell’indice.

Prova isolata: creata una nota `01_CLIENTS/protected.md` contenente `# PROTECTED NOTE` e collegato `00_SYSTEM/SEARCH_INDEX.json` a quella nota. Chiamando index_vault_search, la nota viene sostituita dal JSON dell’indice. Risultato: `Rust indexing overwrote note via index symlink: true`.

La garanzia di sola lettura delle note è quindi violata, non soltanto non testata. Riutilizzare accessi ancorati a directory, controlli symlink e pubblicazione sicura già disponibili; preservare i dati anche in errore.

### 2. P1 — Frontmatter e filtri nativi non corrispondono al contratto

`search.rs:266-290` non esegue parsing del frontmatter: ricava il titolo da H1, assegna cliente/progetto/stato a None, usa il tag fisso indexed e sostituisce le date con l’ora di indicizzazione. `search.rs:317-338` non applica query.status.

Fixture condivisa: documento con client Acme, project Apollo, status draft, tag tech e title Metadata Title, ma heading Heading.

| Query/valore | TypeScript | Rust |
| --- | --- | --- |
| client=Acme | 1 risultato | 0 risultati |
| status=approved | 0 risultati | 1 risultato (la bozza) |
| tags=[tech] | metadato presente nel parser | 0 risultati |
| titolo indicizzato | Metadata Title nel parser | Heading nella prova |

La prova Rust registra client/project/status null e tags=[indexed]. Questo difetto è anche un blocco per M6REV, che deve poter selezionare realmente la conoscenza approvata.

### 3. P1 — Panic Unicode nell’estrazione degli snippet

`search.rs:131` e `search.rs:156` tagliano stringhe UTF-8 usando indici di byte non verificati. Fixture: 179 caratteri ASCII seguiti da `èzzz`, snippet massimo 180. Panic riprodotto: `end byte index 180 is not a char boundary; it is inside 'è'`.

Il probe cattura il panic per continuare gli altri controlli. Dimostra il difetto nella funzione nativa, non un crash dell’intera app osservato via UI. Correggere gli indici per caratteri e coprire accenti/emoji e normalizzazioni che cambiano lunghezza.

### 4. P1 — Indice condiviso TS/Rust incompatibile e corruzione nascosta

Rust dichiara mtime_ms come u64; TS salva stat.mtimeMs anche frazionario. Un indice generato realmente dal motore TS con mtime frazionario è rifiutato dalla deserializzazione SearchIndexData Rust (`Rust cannot deserialize TS index: true`). load_search_index converte il fallimento in un indice vuoto.

Anche TS nasconde la corruzione: dopo aver scritto `{broken` nell’indice di fixture, getIndexStatus restituisce total_indexed=0 senza errore. `index-store.ts` e il salvataggio Rust non usano lock o sostituzione atomica: la concorrenza e gli errori di scrittura non sono coperti dalla suite presente.

Definire schema/versione compatibili, validazione esplicita e aggiornamento atomico; non azzerare silenziosamente tracking e stato dopo un errore.

### 5. P2 — Tokenizzazione e scoring non sono in parità

TS applica stopword, stripping Markdown e una formula TF-IDF; Rust conserva parole del frontmatter, non rimuove stopword e calcola count*1.5 più bonus titolo (`search.rs:113-119`, `340-350`). Non è il TF-IDF dichiarato.

La normalizzazione degli accenti dichiarata nel resoconto non è implementata nel tokenizer TS: nella prova `caffe` non trova il testo `Caffè`. Allineare una specifica comune e verificare risultati, ranking, snippet e paginazione con fixture condivise.

### 6. P2 — Ricerca live e UI incomplete rispetto alla checklist

`App.tsx:292-303`: ogni modifica input invia una query, senza debounce/coalescenza o controllo della generazione del risultato. L’adapter IPC accetta una sola operazione alla volta. Probe con invocazione simulata pendente: la seconda query viene rifiutata con `A Vault operation is already running`; non viene ripianificata dall’handler. Può quindi restare il risultato del termine precedente. Questa è una prova dell’adapter più lettura dell’handler, non un E2E UI M5.

La UI Search espone termine e categoria; non contiene i controlli cliente/progetto/tag dichiarati completi nella checklist. getSearchIndexStatus è esposto nell’adapter ma non richiamato dalla UI; il banner viene popolato solo dopo reindicizzazione nella sessione corrente. Completare i filtri richiesti, refresh/persistenza dello stato e gestione dei risultati obsoleti.

## Altri limiti emersi dalla lettura

- Gli ID di fallback derivano dal solo basename; documenti con lo stesso nome in cartelle diverse possono condividere l’ID, usato anche come chiave React dei risultati.
- Il walker Rust segue directory symlink senza limite di profondità e ignora errori read_dir/read_to_string; l’indice può risultare incompleto o mantenere contenuti precedenti senza segnalarlo.
- TS effettua precontrolli dei percorsi seguiti da letture ambientali separate, e legge contenuto e hash in momenti diversi; non riutilizza il modello di lettura sicura e coerente introdotto per M4.

## Verifiche effettive e limiti

- `pnpm --filter @limen-vault/search-engine test`: **3/3 PASS**.
- Toolchain locale `.local/cargo`, `.local/rustup`: `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml search::tests`: **1/1 PASS**; gli altri test sono filtrati. Il test nativo copre un semplice documento senza frontmatter e una query; non copre filtri, snippet Unicode, parità o sicurezza.
- Probe TS: `.local/m5-audit/probe.mts`; fixture temporanea rimossa. Indice TS di prova conservato in `.local/m5-audit/ts-index.json`.
- Probe Rust: `.local/m5-audit/probe.rs`, importa direttamente il modulo applicativo originale search.rs in un harness offline separato. Le fixture vengono rimosse al termine; nessuna nota reale modificata.
- Probe IPC: `.local/m5-audit/ipc-probe.mts`, invocazione simulata esplicitamente per verificare la sovrapposizione delle query.
- Non rieseguiti monorepo completo, typecheck/build release o E2E UI M5: i difetti bloccanti sono già dimostrati, senza necessità di ulteriori build per questo audit.
- Il log AG fornito non documenta una build Tauri o un E2E UI offline M5. Nessun walkthrough M5 è stato trovato tra i file del progetto cercati; un eventuale artefatto esterno AG non è stato verificato. La checkbox E2E non costituisce da sola evidenza.

## Ordine di correzione

1. Eliminare sovrascritture/symlink e rendere affidabile il caricamento/salvataggio dell’indice.
2. Implementare frontmatter, filtri e schema indice comuni TS/Rust.
3. Correggere Unicode, tokenizzazione/scoring, ID stabili e paginazione.
4. Completare gestione query e UI; aggiungere regressioni e parità reali.
5. Test/typecheck/build, Rust e Tauri sul checkout corretto; E2E offline con riavvio, persistenza, filtri e hash delle note invariati.

M6REV rimane pianificata; non considerare soddisfatta la sua dipendenza di ricerca/filtri M5 finché questi criteri sono aperti.
