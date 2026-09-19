# Incarico ad AG — Intervento 1: titolo e intestazioni nel testo indicizzato, con misura prima e dopo

Emesso dall'auditor il 19 settembre 2026 (UTC+8) su decisione dell'utente.
Base: commit `eaa8413d1eb9cdb96e4dbc96531c21951018de07`, tag `v3.0.0-audit-closure-complete`.

Obiettivo: far sì che l'embedding di un passaggio porti con sé il contesto del documento
(titolo, categoria, intestazione di sezione), e **dimostrare con una misura prima/dopo** se il Recall@10
migliora. Non si tocca la consegna notarizzata; nessun push su remoti; il Vault reale
`/Users/cesare/Documents/VAULT` non va letto né modificato.

## Fase 0 — Corpus A05 rigenerato (prerequisito, rilievo C5)

Il corpus attuale non serve a misurare: fra `tests/gold/A05_CORPUS/doc_001.md` e `doc_002.md` dodici righe su
diciassette non vuote sono identiche. Su documenti così simili nessun intervento è distinguibile dal rumore.

1. Rigenera almeno 120 documenti in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A05_CORPUS/`
   con `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/scripts/a05-generate-corpus.mjs`, seme dichiarato, tali che:
   - ogni documento tratti un argomento diverso, con vocabolario proprio;
   - nessuna frase di boilerplate ripetuta su più documenti: le sezioni fisse vanno eliminate o riscritte per documento;
   - lunghezze variabili, almeno 20 con tabelle o elenchi, almeno 10 multi-sezione con marcatori `## Pagina N`.
2. Aggiungi `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/scripts/a05-corpus-diversity.mjs` che, per ogni coppia
   di documenti, calcoli la similarità di Jaccard sui token di contenuto e fallisca se una qualsiasi coppia supera 0,30.
   L'output di questo controllo è un'evidenza obbligatoria (`corpus-diversity.log`).
3. Riscrivi le 40 query gold coerenti con i nuovi documenti, mantenendo il vincolo di zero sovrapposizione lessicale
   verificato da `a05-check-overlap.mjs`.
4. Rigenera `A05_MANIFEST.sha256` e **congela corpus e query in un commit dedicato**, con tag
   `v3.1.0-a05-corpus-v2-frozen`, prima di qualunque misura.

## Fase 1 — Misura di riferimento con il motore attuale

Con il codice **immutato**, esegui il benchmark A05 sul nuovo corpus e archivia le evidenze in
`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_V2_BASELINE/`
(stessi file di prima: `per-query.jsonl`, `summary.json`, `run.log`, `overlap-check.log`, `manifest-verify.log`,
più `corpus-diversity.log`). Questa è la riga di partenza: senza di essa il confronto non esiste.

## Fase 2 — Modifica del motore

File: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/embeddings.rs`.

Oggi in `sync_embeddings` il testo inviato a OpenAI è il solo `p.text` (intorno alle righe 296-305):
l'embedding di un passaggio centrale non contiene l'argomento del documento.

1. Costruisci il testo da incorporare come contesto + passaggio, su righe separate:
   - titolo della nota: il `title` del frontmatter se disponibile, altrimenti `file_name` senza estensione;
   - categoria del documento (cartella `01_CLIENTS` … `10_APPROVED_OUTPUTS`);
   - intestazione di sezione del passaggio: `p.locator` (`Pagina N`, `Slide N`, `Paragrafi N-M`);
   - poi il testo del passaggio.
   Il prefisso di contesto deve restare breve rispetto al passaggio: se supera il 20% dei caratteri del passaggio, troncalo.
2. **Invalidazione della cache — punto critico.** L'aggiornamento oggi scatta su `entry.sha256 != p.sha256`:
   il testo del passaggio non cambia, quindi senza un intervento esplicito la cache resterebbe quella vecchia e la
   modifica non avrebbe alcun effetto, dando l'illusione di un risultato nullo. Aggiungi nella voce di cache il campo
   `embedded_text_sha256` e confronta quello, oppure, in alternativa, porta `CACHE_VERSION` da 1 a 2.
   Preferisci il campo esplicito: invalida solo ciò che è davvero cambiato e resta valido per modifiche future.
3. Il vettore della **query** non va prefissato: il contesto serve ai documenti, non alla domanda.
4. Nessuna lista di sinonimi, nessuna espansione di termini, nessun aggiustamento dei pesi della fusione in questa fase:
   l'intervento deve restare isolato, altrimenti non si saprà a cosa attribuire la differenza.
5. Aggiungi un test unitario che verifichi che il testo incorporato contiene titolo, categoria e locator, e che una
   modifica del solo prefisso invalida la voce di cache.

## Fase 3 — Misura dopo la modifica

Riesegui il benchmark A05 sullo **stesso corpus e sulle stesse query congelate**, archiviando in
`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_V2_CONTEXT/`.
Nel `summary.json` riporta anche: numero di passaggi ricalcolati, modello usato, e il confronto per singola query
rispetto alla baseline (query migliorate, invariate, peggiorate).

## Criteri di accettazione

- Le due misure usano lo stesso corpus e le stesse query, congelate prima della Fase 1.
- La differenza fra i due commit tocca solo `embeddings.rs` e i suoi test: nessuna modifica ai dati o alle query.
- Il rapporto dichiara il Recall@10 medio prima e dopo, e l'elenco delle query peggiorate.
- Se il Recall non migliora, si riporta il risultato e si lascia il gate aperto: un esito negativo misurato
  è un risultato utile, un esito gonfiato no.
- Tag: `v3.1.0-a05-corpus-v2-frozen` sul congelamento, `v3.1.0-embed-context` sul commit della modifica misurata.

## Cosa non fare

- Non rigenerare il corpus dopo aver visto i risultati.
- Non ripetere la misura scegliendo la corsa migliore: se ripeti, allega tutte le corse.
- Non toccare i binari consegnati, `/Applications`, `USER INSTALL` né il Vault reale.
