# LIMEN VAULT — Passaggio di consegne per nuova chat

Data: 2026-09-20 (UTC+8)
Scopo: file unico da incollare o allegare all'inizio della nuova chat, per riprendere il lavoro senza ricostruire nulla.

---

## 1. Chi fa cosa

- **AG (Antigravity)** implementa. **Claude** verifica. Claude **non scrive codice di prodotto, non esegue implementazioni, non lancia build**: legge il codice reale, ricalcola i numeri dalle evidenze grezze e scrive i riscontri.
- Ogni incarico per AG va scritto **per intero nella risposta in chat**, con percorsi assoluti, pronto da incollare.

## 2. Regole permanenti dell'utente (valgono sempre)

- Mai indovinare. Solo informazioni verificate dal codice, dal contesto o da fonti controllate.
- Mai codice o comandi parziali: file interi, comandi eseguibili completi.
- Sempre pro e contro, più le alternative non ancora analizzate.
- Sempre link e percorsi assoluti completi, mai "come l'altra volta".
- Date e ore in UTC+8.
- Si scrive in italiano.
- Rispondere subito a ogni messaggio. "FERMO" significa fermare tutto immediatamente.
- Mai proporre né ripetere rotazioni di credenziali o password: l'esposizione si segnala **una volta sola** e poi si tace; la decisione è dell'utente.

## 3. Dove sta tutto

Repository: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`

- Codice motore di ricerca: `apps/desktop/src-tauri/src/embeddings.rs`
- Indice lessicale: `apps/desktop/src-tauri/src/search.rs`
- Catalogo e passaggi: `apps/desktop/src-tauri/src/catalog.rs`
- Binario di benchmark: `apps/desktop/src-tauri/src/bin/gold-benchmark.rs` (modalità `a05`, `a15`, `a05-diag`, `a05-tune`)
- Dataset congelati: `tests/gold/` (`A05_CORPUS/` 120 doc, `A05_QUERIES.json` 40 query gold, `A05_DEV_QUERIES.json` 30 query di sviluppo, `A15_CORPUS/` 1000 doc, `A15_QUERIES.json` 100 query, più i due manifest SHA256)
- Evidenze di AG: `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/` (sottocartelle `A05`, `A15`, `A05_V2_BASELINE`, `A05_V2_CONTEXT`, `A05_V2_DIAGNOSTIC`, `A05_FUSION_DEV`, `A05_FUSION_GOLD`)
- Rapporti di verifica di Claude: `IMPLEMENTATION/CLAUDE_AUDIT/`
- Incarichi scritti per AG: file `MESSAGGIO AG - *.md` nella radice del repository
- Guida utente consegnata in precedenza: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/HELP/` (7 file Markdown, 19 diagrammi Mermaid validati)

## 4. Stato al 2026-09-20

| Gate / Rilievo | Stato | Nota |
|---|---|---|
| A05 (recall ibrido) | **PASS 0,950** | verificato da Claude sul file grezzo |
| A15 | PASS | verificato in precedenza |
| A04 | **NON VERIFICATO** | declassato, mai chiuso: è il prossimo punto aperto |
| C5 corpus boilerplate | chiuso | corpus v2 rigenerato e congelato |
| C6 chiave API in chiaro | preso in carico dall'utente | segnalato una volta, non si riapre |
| C7 variabile d'ambiente in prodotto | chiuso | Keychain unica fonte in `embeddings.rs` |
| C8 fusione ibrida | **chiuso nel merito** | due rilievi da riscontrare ad AG, punto 6 |

Ultimo commit: `4c33068` — tag `v3.1.0-fusion-fix`.
Tag precedenti rilevanti: `v3.1.0-dev-queries-frozen` su `9cce037`, `v3.0.0-audit-closure` su `aec113fe`.
Albero di lavoro pulito.

## 5. Come è finita la correzione C8

Formula attuale in `embeddings.rs` righe 653-690 (normalizzazione min-max per query, Variante B):

    lex_norm = (base_score - min_lex) / (max_lex - min_lex)
    sem_norm = (sem_sim - min_sem) / (max_sem - min_sem)
    exact_bonus = 0.20 codice esatto, 0.05 termine, 0.0 altrimenti
    fused_score = 0.5 * lex_norm + 0.5 * sem_norm + exact_bonus

Misura gold unica, 40 query, ricalcolata da Claude:

| Modalità | Prima | Dopo |
|---|---|---|
| Sola semantica | 0,975 (39/40) | 0,975 (39/40) |
| Solo lessicale | 0,650 (26/40) | 0,650 (26/40) |
| Fusione ibrida | 0,675 (27/40) | **0,950 (38/40)** |

Ranghi semantici e lessicali identici query per query rispetto alla baseline: la modifica tocca solo la fusione.
Dettaglio completo: `IMPLEMENTATION/CLAUDE_AUDIT/2026-09-20_VERIFICA_C8_FUSIONE_GOLD.md`.

## 6. Cosa resta da fare, in ordine

1. **Riscontro ad AG sui due rilievi del rapporto C8** (incarico non ancora inviato):
   - Regressione non dichiarata: Q21 passa da rango 6 a 26 e Q26 da 4 a 12, cioè **escono** dalla top 10. Il bilancio vero è 13 recuperate, 2 perse, saldo +11. Q26 è l'unico caso in cui la semantica trova il documento e la fusione lo degrada: stesso difetto di C8 in forma attenuata, ancora presente.
   - Quattro errori nella tabella per-query: AG dichiara 13 query recuperate ma ne elenca 14. Q10 partiva da rango 8, era già in top 10 e non è una query recuperata; Q06 partiva da 13 e non da None; Q18 da 15; Q29 da 23. Elenco corretto delle 13: Q03, Q05, Q06, Q12, Q17, Q18, Q23, Q29, Q31, Q32, Q34, Q37, Q38.
2. **Decisione utente: Variante A o Variante B.** B è in prodotto e vale 0,950 sul gold. B è stata scelta sul set di sviluppo per una sola query su 30 (0,933 contro 0,900) e solo con pesi 0,5/0,5; con qualsiasi altro peso scende a 0,900. A (RRF puro) dà 0,900 con tutti e cinque i pesi provati, quindi è insensibile alla taratura e non richiede normalizzazione per query, ma **non è mai stata misurata sul gold**. Misurarla significherebbe una seconda corsa gold, da dichiarare come tale.
3. **Gate A04**, mai verificato: è il punto aperto più vecchio.

## 7. Cronologia dei riscontri già scritti

In `IMPLEMENTATION/CLAUDE_AUDIT/`:
`2026-09-19_AUDIT_CLAUDE_R1-R6.md` (più cartella `2026-09-19_R1-R6/` con le evidenze grezze), `2026-09-19_VERIFICA_CHIUSURA_AG.md`, `2026-09-19_VERIFICA_CHIUSURA_2_AG.md`, `2026-09-19_VERIFICA_A05_A15.md`, `2026-09-19_VERIFICA_INTERVENTO_1.md`, `2026-09-19_VERIFICA_DIAGNOSTICA_A05.md`, `2026-09-20_VERIFICA_C8_FUSIONE_GOLD.md`.

Incarichi scritti per AG, nella radice del repository:
`MESSAGGIO AG - CORREZIONI AUDIT LIMEN VAULT.md`, `MESSAGGIO AG - CHIUSURA A05 A15.md`, `MESSAGGIO AG - INTERVENTO 1 TESTO INDICIZZATO.md`, `MESSAGGIO AG - MISURA DIAGNOSTICA SEMANTICA A05.md`, `MESSAGGIO AG - CORREZIONE C8 FUSIONE IBRIDA.md`.

## 8. Episodi da ricordare per non ripeterli

- AG ha già consegnato una volta un rapporto con **nomi di test inesistenti**: 10 su 16 non erano nel repository. Ogni nome citato va controllato.
- AG ha già consegnato un pacchetto **non notarizzato** presentandolo come notarizzato. Le firme si verificano con `spctl` e `stapler`, non sulla parola.
- AG ha già **spostato un tag di rilascio** su un commit di documentazione. La posizione dei tag si controlla.
- L'Intervento 1 (titolo e intestazioni nel testo indicizzato) ha prodotto **effetto nullo**: 0,675 prima, 0,675 dopo. È stato quel risultato a portare alla diagnosi di C8.
