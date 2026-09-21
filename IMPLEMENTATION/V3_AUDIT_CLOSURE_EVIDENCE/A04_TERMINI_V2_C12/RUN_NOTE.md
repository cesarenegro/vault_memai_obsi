# A04 — termini ed espressioni brevi: set di prova, difetto C12 e misure (21/09/2026)

## Set di prova
`tests/gold/A04_TERM_QUERIES.json`: 66 casi (46 termini singoli, 20 espressioni di due parole) estratti dal catalogo del
Vault (presenti in 5–40 documenti, esclusi loop di trascrizione e riempitivi), etichettati dall'utente nel file Excel
`USER INSTALL/A04_TERMINI_DA_COMPILARE.xlsx` (per ogni termine i 5 documenti con piu' occorrenze, con brano reale).
Esito dell'etichettatura: in 63 casi su 66 l'utente ha accettato tutti e cinque i candidati, in 3 casi tre o quattro.
Quindi la verita' di riferimento e' di fatto «uno dei 5 documenti in cui il termine e' piu' frequente»: misura la
coerenza della ricerca con la frequenza, non una preferenza fine dell'utente. 9 casi sono termini malformati dalla mia
estrazione o riempitivi ("lindustria", "dell industria", "wonderful wonderful", "audio domanda", "vieni", "ovvio",
"sostanzialmente", "cita", "factory operatore"): tenuti nelle misure complessive, indicati a parte.

Vault: `tests/scratch/vault_collaudo_ricalcolo_cache` (114 documenti, cache bge-m3 completa). Banco: `a04_real_local`
con `LIMEN_A04_VAULT`/`LIMEN_A04_QUERIES`, server Metal dedicato (porta 8093).

## Prima corsa (`A04_TERMINI_V1`, codice `d5aa553`) — difetto trovato
| Modalita' | P@1 | P@1 netta (senza pareggi) | R@10 | Pareggi al rango 1 | Pareggio massimo |
|---|---|---|---|---|---|
| Lessicale | 0,470 (31/66) | 0,394 | 0,879 (58/66) | 21 | **50** |
| Semantico | 0,500 (33/66) | 0,485 | 0,894 (59/66) | 2 | 3 |
| Ibrido | 0,485 (32/66) | 0,485 | 0,955 (63/66) | 2 | 2 |

Anomalia: per "personal", "cita", "lead", "lezione" tutti i risultati lessicali avevano punteggio **15,0** (verificato con
`vault-check search`), pur essendo "personal" un token esatto in 36 documenti (39 occorrenze nel documento atteso).
Causa (`search.rs`): il bonus di 15 punti «frase esatta nel passaggio» usava `contains` (sottostringa: "personal" in
"personale", "lead" in "leader", "cita" in "capacita") e vale solo per i documenti con BM25 zero; essendo piu' alto di
qualsiasi BM25 (≈4 per un termine), i documenti con la sola sottostringa superavano quelli con il termine vero.
Sulle 82 frasi non si vedeva: una frase esatta contenuta implica i token presenti, quindi BM25 > 0.

## Correzione C12 (`a845ad0`)
Confronto a parola intera (`contains_whole_words`: delimitatori non alfanumerici o bordi), stessa normalizzazione.
Test: parola intera vs sottostringhe; documento con token esatto batte documento con sola sottostringa (99 + 17 test).

## Seconda corsa (`A04_TERMINI_V2_C12`) — dopo C12
| Modalita' | P@1 | P@1 netta | R@10 | Pareggi al rango 1 | Pareggio massimo |
|---|---|---|---|---|---|
| Lessicale | **0,576** (38/66) | 0,424 | **0,955** (63/66) | 18 | **4** |
| Semantico | 0,500 (33/66) | 0,485 | 0,894 (59/66) | 2 | 3 |
| Ibrido | **0,636** (42/66) | 0,636 | **1,000** (66/66) | 1 | 2 |

Primo posto occupato **solo** da documenti attesi (pareggi inclusi): lessicale 27/66 → 33/66; ibrido 32/66 → **42/66**.
I 18 pareggi lessicali residui (dimensione ≤ 4) sono in gran parte coppie trascrizione/versione elaborata con testo
identico e quindi punteggio identico; l'ibrido li scioglie (1 pareggio).
Controllo di non regressione sulle 82 frasi (`A04_REAL_LOCAL_V4_C12`): lessicale P@1 0,939, R@10 1,000 invariati;
ibrido P@1 0,939 (netta 0,927), R@10 1,000.

## Lettura
Sui termini singoli la ricerca resta molto meno precisa che sulle frasi (ibrido 0,636 contro 0,927): con un termine
comune a 30–40 documenti la scelta del "primo" e' intrinsecamente ambigua, e la verita' di riferimento accettata
dall'utente (5 candidati validi) lo conferma. R@10 = 1,000 in ibrido dice che il documento cercato e' comunque sempre
nella prima pagina.
