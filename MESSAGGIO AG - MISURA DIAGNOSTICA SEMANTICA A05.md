# Incarico ad AG — misura diagnostica: quanto vale la semantica da sola

Emesso dall'auditor il 19 settembre 2026 (UTC+8) su decisione dell'utente.
Base: commit `b462218`, corpus congelato `v3.1.0-a05-corpus-v2-frozen`.

Non è un intervento sul motore: è una misura. Serve a capire **dove** si perde il recall,
prima di decidere se cambiare modello di embedding o tarare i pesi della fusione.
Oggi sappiamo che l'ibrido vale 0,675 e il solo lessicale 0,650: la semantica aggiunge 0,025,
ma non sappiamo se perché è debole in sé o perché la fusione la annulla.

## Regola di lettura, fissata PRIMA della misura

- Semantica da sola **maggiore o uguale a 0,85**: la semantica funziona, il problema è nella fusione.
  Il passo successivo diventa la taratura dei pesi, non il cambio di modello.
- Semantica da sola **minore o uguale a 0,70**: il problema è negli embedding o nel modello.
  Il passo successivo diventa il modello più grande o il testo indicizzato.
- Valore intermedio: entrambe le cause concorrono; si riportano i numeri e si decide con l'utente.

Questa regola va copiata nel report e non modificata dopo aver visto i risultati.

## Cosa misurare

Sullo **stesso corpus e sulle stesse 40 query congelate** già usati per `A05_V2_BASELINE` e `A05_V2_CONTEXT`:

1. **Recall@10 della sola componente semantica**, cioè documenti ordinati unicamente per similarità
   coseno, senza alcun contributo lessicale, senza bonus di corrispondenza esatta e senza fusione RRF.
2. **Recall@10 della sola componente lessicale** (già disponibile, va ripetuto nella stessa corsa per confronto).
3. **Recall@10 dell'ibrido** (idem).
4. Per ogni query, il **rango del documento atteso** in ciascuna delle tre modalità, anche oltre la
   decima posizione: serve a distinguere "non trovato" da "trovato ma retrocesso dalla fusione".
   Se il documento atteso non compare entro i primi 50, registrare `null`.

## Come farlo, senza toccare il prodotto

- Tutta la logica va in `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/bin/gold-benchmark.rs`,
  come nuova modalità (per esempio `gold-benchmark a05-diag`). **Nessuna modifica a `embeddings.rs`, `search.rs`, `ai.rs`
  o a qualunque altro file del prodotto.** Se per ordinare per sola similarità servisse una funzione non pubblica,
  fermati e segnalalo invece di cambiare il prodotto.
- Usa le funzioni già pubbliche: `load_embeddings_cache` (riga 103), `fetch_openai_embeddings` (riga 173),
  `rank_document_semantic` (riga 433).
- Riusa la cache di embedding già calcolata per la corsa `A05_V2_CONTEXT`: l'unica chiamata al provider
  deve essere quella per i vettori delle 40 query. Non ricalcolare i 167 passaggi.
- La chiave si legge dal Portachiavi dentro il processo. **Mai sulla riga di comando, mai come prefisso
  di variabile d'ambiente, mai nei log** (rilievo C6).

## Evidenze obbligatorie

In `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_V2_DIAGNOSTIC/`:

- `per-query.jsonl`: per ogni query `queryId`, documento atteso, e per le tre modalità il Recall@10 e il
  rango del documento atteso (o `null` se oltre i primi 50).
- `summary.json`: le tre medie di Recall@10, il numero di query a zero per modalità, l'elenco delle query in cui
  la semantica trova il documento e l'ibrido no, l'elenco del caso opposto, il modello di embedding usato,
  la fonte della cache riusata, e data e ora in UTC+8.
- `run.log`: output grezzo con exit code e durata.
- `manifest-verify.log`: verifica degli sha256 del corpus immediatamente prima della corsa.

## Criteri di accettazione

- Stesso corpus e stesse query, invariati: `git diff v3.1.0-a05-corpus-v2-frozen HEAD -- tests/gold` deve essere vuoto.
- `git diff` sul prodotto limitato a zero righe: la sola modifica ammessa è in `gold-benchmark.rs`.
- Le tre modalità misurate nella stessa corsa, sugli stessi vettori.
- Nessun aggiustamento dei pesi, nessun sinonimo, nessuna riscrittura delle query.
- Tag `v3.1.0-a05-diagnostic` sul commit che contiene misura ed evidenze.
- Nel report: le tre medie, la tabella dei ranghi, la conclusione secondo la regola di lettura sopra,
  e nessuna raccomandazione di intervento oltre quella che la regola impone.

## Cosa non fare

- Non avviare interventi sul motore sulla base di questo risultato: la decisione spetta all'utente.
- Non ripetere la corsa scegliendo la migliore: se ripeti, allega tutte le corse.
- Non toccare i binari consegnati, `/Applications`, `USER INSTALL` né il Vault reale `/Users/cesare/Documents/VAULT`.
