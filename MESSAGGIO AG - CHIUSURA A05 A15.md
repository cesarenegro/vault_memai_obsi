# Incarico ad AG — chiusura dei gate A05 e A15

Emesso dall'auditor il 19 settembre 2026 (UTC+8), su richiesta esplicita dell'utente.
Base: commit `aec113fe0eba1e11b458bceb733bf40ba0793e62`, tag `v3.0.0-audit-closure`.
Tutti gli altri gate restano come sono. Non rifare notarizzazione né consegna: A16 e' gia' verificato.

## Perimetro e divieti

- Lavora solo in un Vault di prova generato dagli script. Non usare, leggere o modificare `/Users/cesare/Documents/VAULT`.
- Non ridurre il corpus, non allentare le soglie, non aggiungere sinonimi o liste di espansione dei termini
  scritte a mano per far salire il Recall. Se il risultato non raggiunge la soglia, si riporta il numero reale.
- Il dataset e le query vanno congelati con un commit **precedente** a quello dei risultati: il congelamento deve
  essere dimostrabile dalla cronologia git, non dichiarato a parole.
- Nessun push su remoti. Nessuna chiave nei log.

---

## A05 — semantica misurata

**Criterio del piano**: almeno 40 query di parafrasi senza coincidenza dei termini centrali, su almeno 100 documenti
distinti, Recall@10 >= 0,90 sul set gold congelato prima del tuning.

### 1. Corpus
- Genera almeno 120 documenti Markdown distinti in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A05_CORPUS/`,
  dominio packaging e consulenza, con frontmatter valido e `status: approved`.
- Contenuto sintetico ma realistico, in italiano, lunghezze variabili (da poche righe a oltre 1.200 caratteri),
  almeno 20 documenti con tabelle o elenchi, almeno 10 multi-sezione con marcatori di pagina.
- Generazione deterministica con seme fisso, script in
  `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/scripts/a05-generate-corpus.mjs`, seme dichiarato nel report.

### 2. Query gold
- 40 query di parafrasi in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A05_QUERIES.json`,
  ciascuna con: `queryId`, `text`, `relevantDocumentIds` (uno o piu'), `relevantPassageIds` quando pertinente.
- Vincolo verificabile: nessuna parola di contenuto della query deve comparire nel passaggio atteso.
  Implementa il controllo in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/scripts/a05-check-overlap.mjs`,
  che normalizza (minuscole, senza accenti), rimuove le stopword italiane e fallisce se l'intersezione dei lemmi
  di contenuto fra query e passaggio atteso non e' vuota. L'output di questo controllo e' un'evidenza obbligatoria.
- Congela corpus e query con `tests/gold/A05_MANIFEST.sha256` (sha256 di ogni file) e committa **prima** di eseguire la misura.

### 3. Esecuzione
- Crea il Vault di prova, importa il corpus, esegui l'indicizzazione e la sincronizzazione degli embedding
  con la chiave reale letta dal Portachiavi. Non passare la chiave da riga di comando e non scriverla nei log.
- Per ogni query esegui la ricerca ibrida con lo stesso percorso usato dal prodotto (`search_vault_hybrid`),
  `limit = 10`, e registra i primi 10 risultati con id, punteggio e rango.
- Esegui anche una passata **solo lessicale** (semantica disattivata) sulle stesse query, come riferimento.

### 4. Metriche
- Recall@10 per singola query: `|rilevanti ∩ primi10| / |rilevanti|`. Dichiara l'unita' (documenti o passaggi) e usala in modo coerente.
- Aggregato: media delle 40 query, piu' numero di query con Recall@10 = 0 e loro elenco.
- Riporta anche la media della passata lessicale, per mostrare il contributo della semantica.

### 5. Evidenze obbligatorie
In `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05/`:
- `per-query.jsonl`: una riga per query con `queryId`, primi 10 risultati (id, rango, punteggio), recall calcolato.
- `summary.json`: media, mediana, minimo, conteggio dei fallimenti, media della passata lessicale, modello di embedding usato,
  numero di documenti e passaggi indicizzati, data e ora in UTC+8.
- `run.log`: output grezzo con exit code e durata.
- `overlap-check.log`: esito del controllo di non sovrapposizione lessicale.
- `manifest-verify.log`: verifica degli sha256 del dataset appena prima della corsa.

### 6. Accettazione
PASS solo se: 40 query, almeno 100 documenti distinti indicizzati, controllo di non sovrapposizione superato per tutte le query,
Recall@10 medio >= 0,90, dataset congelato in un commit precedente. Altrimenti si riporta il numero reale e il gate resta aperto.

---

## A15 — prestazioni misurate

**Criterio del piano**: 1.000 documenti e almeno 10.000 passaggi, p95 della ricerca locale calda <= 1 s sul Mac di prova,
almeno 100 query, UI utilizzabile durante l'importazione. Latenza del provider esclusa dalla metrica.

### 1. Corpus
- Genera 1.000 documenti in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A15_CORPUS/` con
  `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/scripts/a15-generate-corpus.mjs`, seme fisso, tali da produrre
  almeno 10.000 passaggi dopo l'estrazione. Dichiara nel report il conteggio reale dei passaggi.

### 2. Procedura
- Importa e indicizza il corpus, poi registra il conteggio di documenti e passaggi dal catalogo.
- 100 query distinte, definite in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A15_QUERIES.json`.
- **Cold**: prima esecuzione dopo riavvio del processo, registrata a parte.
- **Warm**: dopo 10 query di riscaldamento non conteggiate, esegui le 100 query e registra ogni singola latenza in millisecondi.
- Misura solo il percorso **locale**: ricerca lessicale o ibrida con semantica disattivata. Se misuri anche l'ibrida con
  semantica attiva, riportala come riga separata, mai fusa con la metrica del gate.
- Prova di concorrenza: durante un'importazione in corso, esegui 20 query e registra le latenze, per documentare che la
  ricerca resta disponibile. Se esiste un test automatico equivalente, indicalo.

### 3. Metriche
- p50, p90, p95, p99, minimo, massimo, calcolati dalle 100 misure grezze, con la formula del percentile dichiarata.
- Nessuna query esclusa. Se una query e' lenta, resta nel campione.
- Registra: modello di Mac, chip, RAM, macOS, se la batteria era in carica, e se altri processi pesanti erano attivi.

### 4. Evidenze obbligatorie
In `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A15/`:
- `latencies-warm.csv`: `queryId,latency_ms` per tutte le 100 query.
- `latencies-cold.csv`: le misure a freddo.
- `latencies-during-import.csv`: le 20 misure sotto importazione.
- `summary.json`: percentili, conteggi di documenti e passaggi, hardware, data e ora in UTC+8.
- `run.log`: output grezzo con exit code e durata.

### 5. Accettazione
PASS solo se: 1.000 documenti e almeno 10.000 passaggi effettivi, 100 query misurate, p95 calda <= 1.000 ms,
misure grezze allegate e percentile ricalcolabile da quelle misure. Altrimenti si riporta il numero reale.

---

## Cosa verifichera' l'auditor

1. Che il commit del dataset preceda quello dei risultati nella cronologia git.
2. Che gli sha256 del manifest corrispondano ai file presenti.
3. Che il controllo di non sovrapposizione lessicale sia stato eseguito su tutte le 40 query e non su un campione.
4. Il ricalcolo indipendente di Recall@10 medio da `per-query.jsonl` e dei percentili da `latencies-warm.csv`.
5. Che il codice non contenga liste di sinonimi o espansioni aggiunte per l'occasione: differenza del codice fra il
   commit di congelamento e quello dei risultati.
6. Che la metrica di A15 non includa chiamate di rete al provider.

## Cosa non fare

- Non dichiarare PASS con un corpus ridotto, con meno di 40 query o con query che condividono i termini centrali.
- Non rieseguire la misura piu' volte scegliendo il risultato migliore: se ripeti, allega tutte le corse.
- Non toccare il Vault reale dell'utente, i DMG consegnati o la copia in `/Applications`.
