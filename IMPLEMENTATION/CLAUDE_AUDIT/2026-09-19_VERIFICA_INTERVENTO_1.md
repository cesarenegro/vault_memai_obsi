# Verifica dell'Intervento 1 e del corpus A05 v2 — 19 settembre 2026, 20:50 (UTC+8)

Checkout: commit `b7ab5c6`, tag `v3.1.0-embed-context`, working tree pulito.
Congelamento dataset: commit `87e41df`, tag `v3.1.0-a05-corpus-v2-frozen`, precedente ai risultati.

## Esito in una riga

**Il corpus è ora valido; l'Intervento 1 non ha prodotto alcun effetto misurabile.**
Recall@10 medio 0,675 prima e 0,675 dopo: zero query migliorate, zero peggiorate.
Il gate A05 resta aperto. Due rilievi nuovi, uno dei quali riguarda le credenziali.

## Ricalcoli indipendenti

| Misura | Valore ricalcolato da me | Dichiarato da AG |
|---|---|---|
| A05_V2_BASELINE, Recall@10 medio | 0,675 (40 query, 13 a zero) | 0,675 |
| A05_V2_CONTEXT, Recall@10 medio | 0,675 (40 query, 13 a zero) | 0,675 |
| Baseline lessicale, entrambe le corse | 0,650 | 0,650 |
| Query migliorate / peggiorate | 0 / 0 | 0 / 0 |

Corpus: 120 documenti; il controllo di diversità dichiara PASS su tutte le 7.140 coppie con soglia 0,30;
il controllo di non sovrapposizione passa su 40 query su 40. Il rilievo C5 è quindi **chiuso**:
il solo passaggio al corpus vario ha portato la misura da 0,475 a 0,675, confermando che il vecchio
valore descriveva il corpus e non il prodotto.

## Lettura del risultato

Il contributo della semantica su questo corpus è ora marginale: 0,675 in ibrido contro 0,650 della sola
parte lessicale. Aggiungere titolo, categoria e locator al testo incorporato non ha spostato nulla, con due
sole variazioni di rango interne alla top-10 (Q02 da 8 a 9, Q39 da 6 a 7). L'ipotesi che i recall a zero
dipendessero dalla mancanza di contesto nel passaggio **non è confermata dai dati**.

Nota metodologica: entrambe le corse sono partite da un Vault di prova nuovo, quindi la cache era vuota in
partenza e il percorso di invalidazione non è stato esercitato dalla misura. È coperto solo dal test unitario.

## Rilievi nuovi

| ID | Gravità | Descrizione |
|---|---|---|
| C6 | **Alta** | La chiave API OpenAI è stata scritta in chiaro sulla riga di comando durante l'esecuzione (`security add-generic-password -w '<chiave>'` e `OPENAI_API_KEY="<chiave>" gold-benchmark …`). Una chiave passata così finisce nella cronologia della shell, è visibile nell'elenco dei processi a qualunque utente della macchina e resta scritta nel registro della sessione dell'agente. |
| C7 | Media | Modifica fuori perimetro: `embeddings.rs` ora legge la chiave anche dalla variabile d'ambiente `OPENAI_API_KEY`, in `sync_embeddings` (riga 305) e in `hybrid_search_vault` (righe 497-500), **dando alla variabile d'ambiente la precedenza sul Portachiavi**. L'incarico limitava la modifica al testo incorporato e all'invalidazione della cache. La chiusura del rilievo R2 era stata verificata sul presupposto che la chiave provenga dal Portachiavi dentro Rust: questa aggiunta introduce una seconda fonte, non richiesta, in un binario destinato agli utenti. |

## Quanto invece è corretto

- Sequenza dei commit e dei tag rispettata: dataset congelato prima della misura.
- La modifica al codice è confinata a `embeddings.rs` (193 righe aggiunte, 8 rimosse) e ai suoi due test:
  `test_passage_embedding_text_context_and_20_percent_cap` e
  `test_embedded_text_sha256_cache_invalidation_on_prefix_change`.
- Nessuna lista di sinonimi, nessun ritocco ai pesi della fusione, nessuna modifica a corpus o query dopo il congelamento.
- Il risultato negativo è riportato senza aggiustamenti.

## Stato dei gate

- A05: **aperto**, 0,675 misurato su corpus valido. L'Intervento 1 è misurato e privo di effetto.
- A04, A15, A16 e gli altri gate: invariati rispetto alla verifica del 19 settembre.
- C5: chiuso. C6 e C7: aperti.
