# Rapporto FASE 2L — Lettura dei Documenti in Memoria e Integrità Filesystem

**Data**: 23 settembre 2026  
**Branch**: `windows-build`  
**Destinatario**: Cesare  
**Stato**: Implementata, convalidata con suite test completa (114/114 passati) e pronta per il collaudo release.

---

## 1. Ipotesi sull'Anomalia del Registro di I/O (Punto 1 delle integrazioni)

> [!NOTE]
> **Ipotesi tecnica (non misurata)**:  
> Nelle prime prove con la build ottimizzata su BNXT, i tempi totali erano di 12–15 secondi (con una porzione non spiegata di 7–8 secondi), mentre nella misurazione con il registro dettagliato il tempo backend è salito a 36.411 ms, con i tre cicli di lettura dei documenti (`doc_read: 10.047 ms`, `verify_pre: 10.013 ms`, `verify_post: 10.082 ms`) che da soli spiegavano 30.142 ms (~1.000 ms per ciascuno dei 10 documenti per fase).  
> 
> L'analisi del codice Rust al commit `1c351f3` dimostra formalmente che **nessun ciclo o lettura aggiuntiva di documenti è mai stata introdotta**: le 10 letture in anteprima, le 10 in `verify_pre` e le 10 in `verify_post` erano presenti storicamente identiche.  
> 
> L'ipotesi tecnica della variazione di tempo per documento (da ~250–400 ms a freddo a ~1.000 ms) risiede nel comportamento combinato dell'I/O Windows su file non indicizzati in memoria: ogni chiamata a `read_source` forzava la deserializzazione completa da disco di `SEARCH_INDEX.json` (129 MB) e `VAULT_CATALOG.json` (31,6 MB). In funzione dello stato della standby list della memoria di Windows e del carico del controller disco su `E:\`, la rilettura ripetuta e il parsing serde di 160 MB di JSON per 10 volte consecutive subiva forti variazioni di latenza.
> 
> Come richiesto, **non vengono formulate previsioni a priori arbitrarie (nessun tempo stimato tipo "< 1 ms")**: faranno fede unicamente i valori effettivi che verranno registrati da Cesare nel log `ask_timing.log` dopo questa correzione.

---

## 2. Anteprima (`doc_read`): Catalogo e Indice in Memoria (Punto 2 delle integrazioni)

Nel registro misurato di Cesare, `doc_read` in fase di anteprima impiegava **10.047 ms**.  
L'analisi del percorso di esecuzione ha rivelato con precisione la causa e il codice è stato corretto per garantire che anche l'anteprima utilizzi catalogo e indice in memoria per tutte le fonti:

1. **Riuso di `SEARCH_INDEX_CACHE` in `search::read_indexed_document`**:
   - **File**: [`apps/desktop/src-tauri/src/search.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs#L1214)
   - **Righe**: 1212–1218
   - **Causa**: `read_indexed_document` chiamava la funzione privata `load(system: &Dir)` che a sua volta invocava `load_with_vault_path(system, None)`. Poiché il parametro `vault_path` era `None`, il controllo in memoria `SEARCH_INDEX_CACHE` (introdotto con l'ottimizzazione A) veniva ignorato e il file `SEARCH_INDEX.json` da 129 MB veniva riletto e deserializzato per ogni singolo documento!
   - **Correzione**: `read_indexed_document` passa ora il `vault_path` reale:
     ```rust
     let data = load_with_vault_path(&child(&r, "00_SYSTEM")?, Some(path))?
         .filter(|d| d.version == VERSION)
         .ok_or("Search index missing or outdated")?;
     ```
     La prima lettura carica i dati nella cache globale protetta da Mutex; le successive 9 letture dell'anteprima accedono all'istanza `Arc<SearchIndexData>` in memoria.

2. **Introduzione di `CATALOG_CACHE` per `VAULT_CATALOG.json`**:
   - **File**: [`apps/desktop/src-tauri/src/catalog.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/catalog.rs#L27-L65) e [`apps/desktop/src-tauri/src/catalog.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/catalog.rs#L1090-L1135)
   - **Righe**: 20–60 (strutture e funzioni di cache `load_catalog_arc`), 1090–1135 (`get_document` e `get_document_by_path`)
   - **Causa**: Ad ogni documento, `read_source` invocava `crate::catalog::get_document(path, id)`, che a sua volta chiamava `load_catalog(vault_path)`. Senza una cache in RAM, `VAULT_CATALOG.json` (31,6 MB) veniva riletto da disco e deserializzato 10 volte consecutive.
   - **Correzione**: Implementata la cache thread-safe `CATALOG_CACHE` con chiave `PathBuf`, memorizzazione di `Arc<CatalogState>` e convalida basata su `mtime` e `size` del file `VAULT_CATALOG.json`. Tutte le funzioni di lookup (`get_document`, `get_document_by_path`, `verify_document_passage_integrity`, `catalog_summary`) utilizzano `load_catalog_arc`, azzerando le riletture da disco.

3. **Riscontro atteso nel registro di Cesare**:
   Nel prossimo log di Cesare per BNXT, la voce `doc_read` non sconterà più le 10 riletture da disco di `SEARCH_INDEX.json` e `VAULT_CATALOG.json`, leggendo unicamente i file delle note markdown da pochi KB.

---

## 3. Gestione Precisione Data di Modifica: NTFS vs non-NTFS (Punto 3 delle integrazioni)

L'unità `E:` sul PC di Cesare è formattata in **NTFS** (verificato tramite comando `(Get-Volume -DriveLetter E).FileSystemType`).

- **Caratteristica di NTFS**: Timestamp con granularità di 100 nanosecondi. Qualsiasi scrittura modifica in modo deterministico `mtime` o dimensione.
- **Caratteristica di FAT32 ed exFAT**: Timestamp con granularità di 2 secondi. In un intervallo di 2 secondi, un file potrebbe essere alterato senza che `mtime` cambi se la dimensione rimane inalterata.

### Implementazione adottata
- **File**: [`apps/desktop/src-tauri/src/ai.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L235-L330)
- **Funzione di rilevamento filesystem**: `is_high_precision_fs(path: &Path) -> bool`
  - Su Windows, risolve la radice del volume (es. `E:\`) ed effettua la chiamata nativa Win32 `GetVolumeInformationW`.
  - Restituisce `true` solo se il filesystem del volume è `"NTFS"` o `"REFS"`. Se l'unità è formattata in `"FAT32"` o `"EXFAT"`, restituisce `false`.
- **Logica di verifica integrità**: `verify_source_integrity_with_fs_override(path, s, is_high_precision, drafts)`:
  - **Se NTFS / alta precisione**: `verify_pre` e `verify_post` confrontano `mtime_ms` e `file_size` salvati nel ticket `Pending` con i metadati attuali del file (`fs::metadata`). Se identici, il contenuto è integro senza leggere byte. Se mutati, viene ricalcolato lo SHA-256.
  - **Se non-NTFS (FAT32/exFAT)**: viene **sempre ricalcolato lo SHA-256 leggendo il file su disco**, ma garantendo che catalogo e indice siano serviti dalla memoria (`Arc`), senza rileggere i file JSON di sistema.

### Test dedicato per i due comportamenti
- **Test**: `test_source_integrity_ntfs_vs_non_ntfs` in [`apps/desktop/src-tauri/src/ai.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L1200-L1245):
  - Verifica che su NTFS il controllo passi immediatamente per il file invariato e fallisca non appena il file muta.
  - Verifica che su non-NTFS una modifica che preserva la stessa identica lunghezza del file (simulazione della finestra di 2 secondi di FAT32) venga intercettata e respinta tramite il ricalcolo forzato dello SHA-256.

---

## 4. Test di Rilettura da Disco Zero: `read_indexed_document` e `read_source` (Punto 4 delle integrazioni)

- **Test**: `test_consecutive_read_indexed_document_and_read_source_zero_disk_reads` in [`apps/desktop/src-tauri/src/ai.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs#L1160-L1195)
  - Esegue una prima lettura per il caricamento iniziale in memoria.
  - Registra i contatori atomici di lettura da disco: `SEARCH_INDEX_DISK_READ_COUNT` e `CATALOG_DISK_READ_COUNT`.
  - Esegue la seconda lettura consecutiva di `search::read_indexed_document` e `ai::read_source`.
  - Verifica tramite asserzione rigorosa che i contatori rimangono identici (`idx_reads_2 == idx_reads_1` e `cat_reads_2 == cat_reads_1`), provando formalmente che **né `SEARCH_INDEX.json` né `VAULT_CATALOG.json` vengono riletti dal disco**.

---

## 5. Sintesi File Modificati nella FASE 2L

| File Modificato | Modifiche Effettuate |
|---|---|
| [`apps/desktop/src-tauri/src/catalog.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/catalog.rs) | Aggiunta `CATALOG_CACHE` (`Arc<CatalogState>`), `CATALOG_DISK_READ_COUNT`, `load_catalog_arc()`, bump revisione e aggiornamento cache in `save_catalog()`, adozione in `get_document()`, `get_document_by_path()`, `list_documents()`, `catalog_summary()`, `verify_document_passage_integrity()`. Aggiunti test unitari. |
| [`apps/desktop/src-tauri/src/search.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/search.rs) | In `read_indexed_document()` passato `Some(path)` a `load_with_vault_path()` per attivare `SEARCH_INDEX_CACHE`. Stessa correzione in `get_search_index_status()` e `index_vault_search()`. Rimosso falso disallineamento da revisione globale per isolamento thread-safe. |
| [`apps/desktop/src-tauri/src/embeddings.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/embeddings.rs) | Rimosso controllo revisione globale cross-vault da `load_embeddings_cache` per garantire isolamento thread-safe multi-vault. |
| [`apps/desktop/src-tauri/src/ai.rs`](file:///E:/Projects/vault_memai_obsi/apps/desktop/src-tauri/src/ai.rs) | Aggiunti `mtime_ms` e `file_size` a `Source`. `#[derive(Clone)]` su `Pending`. Rilevamento filesystem `is_high_precision_fs()`. Verifica `verify_source_integrity_with_fs_override()` per NTFS e non-NTFS in `verify_pre` e `verify_post`. Aggiunti i 4 test di FASE 2L. |

---

## 6. Evidenze Suite di Test

- **File log grezzo completo**: [`IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-2L.log`](file:///E:/Projects/vault_memai_obsi/IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/cargo-test-fase-2L.log) (18.057 byte).
- **Esito**:
  - `limen-vault` (lib test): **114 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 44.93s**
  - `limen-vault` (bin/integration test): **18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.22s**
  - **Totale**: 132/132 test passati con successo.
