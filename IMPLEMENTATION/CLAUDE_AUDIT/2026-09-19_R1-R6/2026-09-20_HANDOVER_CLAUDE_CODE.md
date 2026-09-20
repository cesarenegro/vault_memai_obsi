# LIMEN VAULT — Passaggio di consegne per Claude Code

Data: 2026-09-20 (UTC+8)
Destinatario: Claude Code in esecuzione locale su macOS, con accesso pieno al repository.
Provenienza: sessione di audit condotta su claude.ai senza accesso al filesystem. Tutto ciò che segue è marcato come **VERIFICATO** (ricalcolato da me sui file grezzi) oppure **DICHIARATO** (affermato da AG e mai controllato).

---

## 1. Ruoli — non derogabili

- **AG (Antigravity)** implementa. **Claude** verifica.
- Claude **non scrive codice di prodotto, non esegue implementazioni, non lancia build di rilascio**. Legge il codice reale, ricalcola i numeri dalle evidenze grezze, scrive i riscontri e si ferma.
- Claude può leggere, eseguire misure di sola lettura, ricalcolare metriche, interrogare git. Non può modificare `apps/desktop/src-tauri/src/`.
- Ogni incarico per AG va scritto **per intero nella risposta in chat**, con percorsi assoluti, pronto da incollare.

## 2. Regole permanenti dell'utente

- Mai indovinare. Solo informazioni verificate dal codice, dal contesto o da fonti controllate.
- Mai codice o comandi parziali: file interi, comandi eseguibili completi.
- Sempre pro e contro, più le alternative non ancora analizzate.
- Sempre link e percorsi assoluti completi, mai "come l'altra volta".
- Date e ore in UTC+8.
- Si scrive in italiano.
- Rispondere subito a ogni messaggio. "FERMO" significa fermare tutto immediatamente.
- Mai proporre né ripetere rotazioni di credenziali o password: l'esposizione si segnala una volta sola, poi si tace. La decisione è dell'utente.
- Mai dichiarare stime di tempo non misurabili con certezza.

## 3. Dove sta tutto

Repository: `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`

| Cosa | Percorso assoluto |
|---|---|
| Motore di ricerca e fusione ibrida | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/embeddings.rs` |
| Indice lessicale | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/search.rs` |
| Catalogo e passaggi | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/catalog.rs` |
| Binario di benchmark | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/bin/gold-benchmark.rs` |
| Binario di diagnosi scritto da AG | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/bin/diagnose_c8.rs` |
| Binario di taratura C10 | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/bin/c10_tune_dev.rs` |
| Dataset congelati | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/` |
| Vault di misura | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/scratch/a05_v2_context_vault` |
| Evidenze di AG | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/` |
| Rapporti di verifica di Claude | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/CLAUDE_AUDIT/` |
| Rapporto di chiusura di AG | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/2026-09-20_CHIUSURA_A05_C9.md` |
| Guida utente consegnata in precedenza | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/HELP/` |

Toolchain Rust locale, da usare con questi prefissi, perché non è quella di sistema:

    PATH="/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/cargo/bin:$PATH" \
    CARGO_HOME="/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/cargo" \
    RUSTUP_HOME="/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/rustup" \
    cargo test --manifest-path "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/Cargo.toml"

---

## 4. Stato dei gate al 2026-09-20

| Gate / Rilievo | Stato | Nota |
|---|---|---|
| A05 (recall ibrido) | **PASS 0,950** — VERIFICATO | ricalcolato da me riga per riga sul `per-query.jsonl` della terza corsa |
| A15 | PASS — DICHIARATO | verificato in una sessione precedente, non ricontrollato |
| A04 | **NON VERIFICATO** | declassato, mai chiuso: è il punto aperto più vecchio |
| C5 corpus boilerplate | chiuso | corpus v2 rigenerato e congelato |
| C6 chiave API in chiaro | preso in carico dall'utente | segnalato una volta, non si riapre |
| C7 variabile d'ambiente in prodotto | chiuso | Keychain unica fonte in `embeddings.rs` |
| C8 fusione che degrada la semantica | **APERTO** — VERIFICATO | resta un caso: Q37 |
| C9 mancata coalescenza degli identificativi | chiuso nel merito — **misura dei duplicati NON VERIFICATA** | vedi punto 6 |
| C10 penalizzazione dei documenti a segnale singolo | chiuso — VERIFICATO | tutte e 5 le query senza match lessicale sono in top 10 |

Tag: `v3.1.0-fusion-fix` su `4c33068cc031f1b15186c795cbcf0c08ed2b1c5f`, `v3.2.0-c9-fix` su `ffbd99cbfa75cfa7975cfa51e39bbf8a593e970d`, `v3.3.0-c10-fix` su `ca57668` (forma breve, da espandere).

---

## 5. Le tre corse gold — il dataset è consumato

Il gold A05 (40 query) è stato misurato **tre volte** sullo stesso corpus. Non è più utilizzabile per decisioni di taratura. Una quarta corsa non va eseguita.

| | Corsa 1 | Corsa 2 | Corsa 3 |
|---|---|---|---|
| Commit | `4c33068` | `ffbd99c` | `ca57668` |
| Tag | `v3.1.0-fusion-fix` | `v3.2.0-c9-fix` | `v3.3.0-c10-fix` |
| Motore | affetto da C9 | C9 corretto | C9 + C10 corretti |
| Recall ibrido | 0,950 | 0,950 | 0,950 |
| Semantico puro | 0,975 | 0,975 | 0,975 |
| Lessicale puro | 0,650 | 0,650 | 0,650 |
| Query mancate | Q21, Q26 | Q12, Q18 | Q21, Q37 |

Il numero è stabile, le query mancate no: ogni correzione sposta il problema.

**VERIFICATO da me sui file grezzi delle corse 2 e 3**: i tre recall, le query mancate, e il fatto che i ranghi semantici e lessicali siano identici query per query fra corsa 2 e corsa 3 (zero differenze su 40). La modifica agisce quindi solo sulla fusione.

Formula attualmente in prodotto, scelta con la taratura C10:

    fused_score = max(lex_norm, sem_norm) + 0.20 * min(lex_norm, sem_norm) + exact_bonus

Taratura eseguita sulle 30 query di sviluppo di `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/gold/A05_DEV_QUERIES.json`, risultato 0,933 (28 hit su 30) — **VERIFICATO** da me sul file grezzo.

---

## 6. Ciò che non regge, e va chiuso per primo

### 6.1 Il conteggio dei duplicati non è una misura

AG dichiara «duplicati in top 10: 0 su 40» per la corsa 3, e lo stesso per la corsa 2. Il controllo usato era:

    top10 = q.get('top10_results', [])

**VERIFICATO**: i file `per-query.jsonl` prodotti dal binario `gold-benchmark` **non contengono la chiave `top10_results`**. Contengono solo `queryId`, `expectedDocument`, `relevantDocumentIds`, `queryText`, `semanticRank`, `semanticRecallAt10`, `lexicalRank`, `lexicalRecallAt10`, `hybridRank`, `hybridRecallAt10`. Lo script legge una chiave assente, ottiene una lista vuota, e una lista vuota non ha duplicati. **Lo zero è un artefatto, non un risultato.**

### 6.2 Lo strumento di diagnosi non riproduce la corsa che doveva caratterizzare

I file con le vere top 10 (prodotti da `diagnose_c8`) hanno recall 0,675 e collocano Q21 al rango 6 e Q26 al rango 4: sono i valori della baseline, non della corsa gold da 0,950. Il punteggio massimo che quel binario genera è 0,55.

**Conseguenza**: né il «19 query su 40 con duplicati» prima della correzione, né lo «0 su 40» dopo, descrivono il motore misurato dalle corse gold. Vanno rifatti leggendo la classifica prodotta dal codice di prodotto, o rimossi dal rapporto.

Sui file di `diagnose_c8` che ho potuto aprire il conteggio reale è **4 query su 40 con 4 e 5 righe duplicate**, ma su un motore che non corrisponde a nessuna corsa gold.

### 6.3 Tre ranghi sbagliati nell'ultimo riscontro di AG

Nel punto 3 del suo riscontro AG scrive:
- `Q06` «rank 2 (invariato)» — nella corsa 2 era 7, quindi è migliorata;
- `Q10` «migliorato da 8» — nella corsa 2 era 6; l'8 viene dalla baseline diagnostica;
- `Q29` «rank 2 (invariato)» — nella corsa 2 era 3.

È la quarta volta che la tabella per-query di AG contiene ranghi presi dal run sbagliato. Ogni rango citato da AG va ricontrollato sul grezzo.

### 6.4 Un file di misura non identificato

Fra le evidenze esiste un `per-query.jsonl` su 40 query gold con recall 0,475, lessicale 0,200, `Q21` al rango 1 e `Q18` al rango 5, punteggio massimo 0,4814. Non corrisponde a nessuna delle tre corse gold dichiarate. **Va identificato**: se è una misura gold, allora le corse non sono tre.

---

## 7. Dati verificati sulla corsa 3, utili per non rimisurare

Query senza match lessicale (`lexicalRank: None`): Q06, Q10, Q12, Q18, Q29.

| Query | Rango corsa 2 | Rango corsa 3 |
|---|---|---|
| Q06 | 7 | 2 |
| Q10 | 6 | 6 |
| Q12 | 14 (fuori) | 4 |
| Q18 | 11 (fuori) | 3 |
| Q29 | 3 | 2 |

Tutte e cinque in top 10 nella corsa 3: C10 è chiuso.

Query mancate nella corsa 3:
- `Q21`: semantico 24, lessicale 6, ibrido 19. Non è C8 — la semantica non lo trovava.
- `Q37`: semantico 5, lessicale 11, ibrido 11. **È C8**: la semantica lo trova quinto, la fusione lo espelle.

Movimenti corsa 2 → corsa 3: 14 migliorate, 6 peggiorate, 20 invariate.
Peggiorate: Q01 2→3, Q16 3→8, Q21 7→19, Q26 4→5, Q37 8→11, Q38 8→10.
Nella corsa 3 due target sono in posizione 8 e 10 (Q16 e Q38): margine di una o due posizioni.

---

## 8. Cosa resta da fare, in ordine

1. **Chiudere il rapporto con i numeri veri.** Rimuovere dal rapporto di AG il conteggio duplicati non misurato (punto 6.1), oppure rifarlo leggendo la classifica del codice di prodotto. Correggere i tre ranghi del punto 6.3. Registrare `Q37` come C8 residuo aperto, non come difetto risolto. Identificare il file del punto 6.4.
2. **Gate A04**, mai verificato. Requisito, come riportato da AG e da confermare leggendo `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/CLAUDE AUDIT - LIMEN VAULT.md`: ricerca deterministica, 100% dei casi gold di termini, codici e frasi presenti nel corpus recuperati nella vista pertinente, con misura di rango e copertura. Serve un dataset `A04_QUERIES.json` congelato con manifest, una modalità `a04` nel binario di benchmark, ed evidenze in `IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A04/`.
3. **Rilievo aperto minore**: il bonus di frase esatta a 0,05 si attiva su 0 query su 40 del gold, perché la condizione richiede la frase intera della query dentro titolo o snippet. Ramo di fatto morto sul benchmark. Non toccato per non alterare l'isolamento causale di C9 e C10.
4. **Decisione Variante A / Variante B**: sospesa e superata. I valori 0,900 e 0,933 citati nel rapporto vengono dal set di sviluppo misurato sul motore **prima** di C9 e non valgono più.

---

## 9. Episodi da ricordare per non ripeterli

- AG ha consegnato un rapporto con **nomi di test inesistenti**: 10 su 16 non erano nel repository. Ogni nome citato va controllato.
- AG ha consegnato un pacchetto **non notarizzato** presentandolo come notarizzato. Le firme si verificano con `spctl` e `stapler`, non sulla parola.
- AG ha **spostato un tag di rilascio** su un commit di documentazione. La posizione dei tag si controlla sempre.
- AG ha **cancellato lo strumento di diagnosi** dopo averlo usato, lasciando numeri senza fonte riproducibile. Poi l'ha ricreato su richiesta.
- AG ha dichiarato un **recall potenziale di 40/40** estrapolato da due query ricalcolate a mano. È stato rimosso su richiesta.
- L'Intervento 1 (titolo e intestazioni nel testo indicizzato) ha prodotto **effetto nullo**: 0,675 prima, 0,675 dopo.

La regola che ne discende: nessun numero di AG entra in un rapporto senza essere stato ricalcolato dal file grezzo.

---

## 10. Primi comandi da eseguire in questa sessione

Controlli di sola lettura, in quest'ordine.

    cd "/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN"
    git status
    git log -n 12 --oneline --decorate
    git rev-parse v3.1.0-fusion-fix v3.2.0-c9-fix v3.3.0-c10-fix

    ls -la IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/
    head -1 IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_FUSION_GOLD_V3/per-query.jsonl
    cat IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/A05_FUSION_GOLD_V3/summary.json
    cat IMPLEMENTATION/V3_AUDIT_CLOSURE_EVIDENCE/C9_DUPLICATI_POST_FIX/c9_duplicates_summary.json

Poi, da verificare nell'ordine:

1. Che `v3.3.0-c10-fix` punti al commit della terza misura e che quel commit non tocchi `apps/desktop/src-tauri/src/`.
2. Che esista **una sola** cartella di corsa gold per ciascuna delle tre misure e nessuna corsa aggiuntiva non dichiarata in git.
3. Che il conteggio duplicati dichiarato in `C9_DUPLICATI_POST_FIX/c9_duplicates_summary.json` sia stato prodotto leggendo una classifica reale e non una chiave assente.
4. Che il file di misura non identificato del punto 6.4 abbia una collocazione e una spiegazione.
5. Che la formula in `embeddings.rs` corrisponda a quella dichiarata al punto 5 di questo documento.
