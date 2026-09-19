# Incarico ad AG — correzione del rilievo C8: la fusione ibrida annulla la semantica

Emesso dall'auditor il 19 settembre 2026 (UTC+8) su decisione dell'utente.
Base: commit `3d88bc8`, tag `v3.1.0-a05-diagnostic`. Corpus congelato: `v3.1.0-a05-corpus-v2-frozen`.

## Il difetto, misurato

Sullo stesso corpus e sulle stesse 40 query: sola semantica 0,975, solo lessicale 0,650, ibrido 0,675.
In 36 query su 40 il rango dell'ibrido coincide esattamente con il rango lessicale: la semantica non
incide sulla classifica finale.

Causa, in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/embeddings.rs`, riga 650:

```rust
let fused_score = rrf_lex * 0.5 + rrf_sem * 0.5 + exact_bonus + (base_score * 0.01);
```

I due termini RRF valgono al massimo 0,0082 e la loro escursione complessiva è circa 0,006.
`exact_bonus` vale 0,05 o 0,15 (righe 645-648) e `base_score * 0.01` vale da 0,01 a 0,25.
L'ordine finale lo decidono questi due termini, entrambi lessicali; i ranghi RRF sono rumore.
Un documento trovato solo dalla semantica ha `base_score = 0` e, su una query di parafrasi, nessun bonus:
il suo punteggio massimo è 0,0082, sotto qualunque documento con un minimo punteggio lessicale.

Obiettivo: rendere la fusione una fusione vera. Il tetto dimostrato su questo corpus è 0,975.

## Fase 0 — Query di sviluppo, separate dal gold

La taratura non si fa sul gold, altrimenti il numero descrive il gold.

1. Scrivi 30 query di sviluppo nuove in
   `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A05_DEV_QUERIES.json`,
   sullo stesso corpus congelato, con lo stesso formato del file gold e lo stesso vincolo di zero
   sovrapposizione lessicale verificato da `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/scripts/a05-check-overlap.mjs`.
2. Nessuna query di sviluppo deve coincidere con una query gold, e i documenti attesi devono coprire
   almeno 25 documenti distinti, includendo almeno 10 dei 13 documenti che oggi l'ibrido perde
   (Q03, Q05, Q06, Q12, Q17, Q18, Q23, Q29, Q31, Q32, Q34, Q37, Q38).
3. Aggiorna il manifest e congela il file in un commit dedicato con tag `v3.1.0-dev-queries-frozen`,
   **prima** di toccare la fusione.

## Fase 1 — Due varianti, misurate solo sul set di sviluppo

Implementa entrambe dietro un parametro interno del solo binario di benchmark, senza esporle all'utente:

- **Variante A — RRF puro.** Il punteggio finale è `w_lex * 1/(k + rank_lex) + w_sem * 1/(k + rank_sem)`,
  con `k = 60`. Il punteggio lessicale grezzo non entra nella somma. L'eventuale bonus di corrispondenza
  esatta, se lo mantieni, va riportato alla stessa scala dei termini RRF, cioè al massimo pari all'escursione
  fra il primo e l'ultimo rango.
- **Variante B — punteggi normalizzati.** Per ogni query si normalizzano punteggio lessicale e similarità
  semantica nell'intervallo da 0 a 1 sui candidati di quella query, poi si combinano come
  `w_lex * lex_norm + w_sem * sem_norm`. Dichiara come tratti i documenti presenti in una sola delle due liste.

Per ciascuna variante prova almeno le combinazioni di pesi `(0,5 / 0,5)`, `(0,3 / 0,7)`, `(0,2 / 0,8)`.
Misura tutto **solo sulle 30 query di sviluppo**. Non guardare il gold in questa fase.

Evidenze in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_FUSION_DEV/`:
`dev-results.json` con Recall@10 per ogni combinazione variante-pesi, `per-query.jsonl` della combinazione
migliore, `run.log`, `overlap-check.log`, `manifest-verify.log`.

## Fase 2 — Scelta e congelamento dei parametri

Scegli variante e pesi in base al risultato sul set di sviluppo, scrivi la scelta e il motivo nel report,
e congela i valori in un commit prima di misurare sul gold. A parità di risultato preferisci la variante A,
perché non introduce parametri di normalizzazione da mantenere.

## Fase 3 — Una sola misura sul gold

Con i parametri congelati, applica la variante scelta a
`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/embeddings.rs` e misura
**una volta sola** sulle 40 query gold, riusando la cache di embedding esistente.

Evidenze in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_FUSION_GOLD/`:
`per-query.jsonl` con Recall@10 e rango del documento atteso nelle tre modalità (semantica, lessicale, ibrido),
`summary.json` con le tre medie e il confronto query per query rispetto a `A05_V2_DIAGNOSTIC`, `run.log`,
`manifest-verify.log`.

## Vincoli di non regressione

- Il percorso con semantica disattivata deve restare identico a oggi: stessa funzione, stesso ordinamento.
- Il ripiego offline deve continuare a restituire i risultati lessicali quando manca la chiave, la rete o la cache.
- Il test `test_hybrid_fusion_ranks_exact_code_first` deve continuare a passare. Se la nuova fusione lo fa
  fallire, non modificarlo per farlo passare: segnalalo e fermati.
- Aggiungi un test che verifichi che un documento trovato solo dalla semantica, con punteggio lessicale nullo,
  possa entrare nei primi dieci.
- L'intera suite Rust deve restare verde. Allega il log grezzo.

## Criteri di accettazione

- Corpus invariato: `git diff v3.1.0-a05-corpus-v2-frozen HEAD -- tests/gold/A05_CORPUS` vuoto.
- Query gold invariate: `git diff v3.1.0-a05-corpus-v2-frozen HEAD -- tests/gold/A05_QUERIES.json` vuoto.
- Le query di sviluppo congelate in un commit precedente alla modifica della fusione.
- Il gold misurato una sola volta, dopo il congelamento dei parametri. Se ripeti, allega tutte le corse.
- Nel report: le tre medie prima e dopo, l'elenco delle query migliorate e peggiorate, variante e pesi scelti
  con il motivo, e il valore di Recall@10 sul gold senza arrotondamenti favorevoli.
- Tag `v3.1.0-dev-queries-frozen` sul congelamento, `v3.1.0-fusion-fix` sulla misura finale.
- La chiave si legge dal Portachiavi dentro il processo: mai sulla riga di comando, mai in variabili di shell,
  mai nei log (rilievo C6).

## Cosa non fare

- Non tarare sul gold, in nessuna forma, neppure "per curiosità".
- Non cambiare modello di embedding, testo indicizzato o chunking in questo incarico: una variabile alla volta.
- Non toccare i binari consegnati, `/Applications`, `USER INSTALL` né il Vault reale `/Users/cesare/Documents/VAULT`.
- Se il risultato sul gold resta sotto 0,90, riportalo e lascia il gate aperto.
