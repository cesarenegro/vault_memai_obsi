# Verifica della misura diagnostica A05 — 19 settembre 2026 (UTC+8)

Checkout: commit `3d88bc8`, tag `v3.1.0-a05-diagnostic`.
Corpus e query invariati rispetto a `v3.1.0-a05-corpus-v2-frozen` (`git diff` vuoto su `tests/gold`).
Nessuna riga modificata in `embeddings.rs`, `search.rs`, `ai.rs`: la sola modifica è in `bin/gold-benchmark.rs`.

## Numeri ricalcolati da me

| Modalità | Recall@10 medio | Query a zero |
|---|---|---|
| Solo semantica (coseno puro) | **0,975** | 1 |
| Solo lessicale | 0,650 | 14 |
| Ibrido, quello che gira nel prodotto | 0,675 | 13 |

Query trovate dalla semantica e perse dall'ibrido: **13** (Q03, Q05, Q06, Q12, Q17, Q18, Q23, Q29, Q31, Q32, Q34, Q37, Q38).
Caso opposto: 1 (Q21).

La regola di lettura fissata prima della misura assegna l'esito: semantica da sola ≥ 0,85, quindi
**la semantica funziona e il problema è nella fusione.**

## Il dato che spiega tutto

**In 36 query su 40 il rango dell'ibrido coincide esattamente con il rango lessicale.**
La componente semantica, pur ordinando quasi perfettamente da sola, non incide sulla classifica finale.

## Causa, verificata nel codice

`apps/desktop/src-tauri/src/embeddings.rs`, riga 650:

```rust
let fused_score = rrf_lex * 0.5 + rrf_sem * 0.5 + exact_bonus + (base_score * 0.01);
```

- I due termini RRF valgono al massimo `1/(60+1) * 0.5 = 0,0082` ciascuno; l'intera escursione fra il primo
  e il duecentesimo posto è di circa 0,006. È il segnale che dovrebbe portare l'informazione semantica.
- `exact_bonus` vale 0,05 oppure 0,15 (righe 645-648): da 6 a 18 volte l'intera escursione dei termini RRF.
- `base_score * 0.01` è il punteggio lessicale grezzo riscalato: con punteggi lessicali dell'ordine
  delle unità o delle decine, questo termine vale da 0,01 a 0,25, cioè da uno a due ordini di grandezza
  più dei termini RRF.

Conseguenza aritmetica: l'ordinamento è deciso da `base_score` e `exact_bonus`, entrambi lessicali, mentre i
ranghi RRF sono rumore. Un documento trovato solo dalla semantica ha `base_score = 0` e, per una query di
parafrasi, nessun bonus di corrispondenza esatta: il suo punteggio massimo è 0,0082, inferiore a quello di
qualunque documento con un minimo punteggio lessicale. Per questo tredici documenti che la semantica mette
al primo posto non compaiono affatto nei primi dieci dell'ibrido.

## Rilievo nuovo

| ID | Gravità | Descrizione |
|---|---|---|
| C8 | **Alta** | La formula di fusione mescola due grandezze non comparabili: ranghi reciproci normalizzati (ordine 10^-3) e punteggi lessicali grezzi più un bonus fisso (ordine 10^-1). La fusione RRF risulta di fatto disattivata e la ricerca ibrida si comporta come una ricerca lessicale. Effetto misurato: Recall@10 0,675 invece di 0,975. |

Chiusura di C8: la fusione deve confrontare grandezze omogenee. Due strade possibili, entrambe da misurare
sullo stesso corpus congelato prima di sceglierne una: RRF puro sui due ranghi, con l'eventuale bonus riportato
alla stessa scala dei termini RRF; oppure normalizzazione dei due punteggi in un intervallo comune prima della
combinazione pesata. La taratura dei pesi va fatta su un insieme di query di sviluppo separato dal gold.

## Stato

- A05: aperto, 0,675 nel prodotto. Il tetto raggiungibile su questo corpus, mostrato dalla sola semantica, è 0,975.
- C5 chiuso, C7 chiuso, C6 preso in carico dall'utente, **C8 nuovo e aperto**.
- Intervento 1: misurato, privo di effetto; resta acquisito perché non peggiora nulla.
- Procedura di questa misura: corretta. Corpus invariato, prodotto non toccato, chiave letta dal Portachiavi
  dentro il processo, evidenze grezze complete e ricalcolabili.
