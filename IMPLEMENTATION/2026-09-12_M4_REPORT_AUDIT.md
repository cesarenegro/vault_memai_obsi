# Audit M4 — implementazione AG non chiudibile

12 settembre 2026. Audit del codice e del resoconto AG; nessuna correzione applicativa, commit, push o deploy. M2/M3 mantengono la chiusura della baseline precedente; questo audit non è una nuova riconvalida completa dopo M4.

## Difetti verificati

1. **Perdita delle bozze (alta priorità).** `packages/knowledge-compiler/src/compiler.ts:97-115` e `apps/desktop/src-tauri/src/compiler.rs:341-362` usano un nome basato solo sul basename e scrittura con sovrascrittura. Prove TS e Rust: compilare `a/doc.md`, modificare manualmente la bozza, modificare la fonte e ricompilare cancella la modifica umana. Compilare `b/doc.md` usa lo stesso output. Non esistono le nuove revisioni dichiarate.
2. **Confine filesystem Rust aggirabile (alta priorità).** `compiler.rs:74` controlla il percorso lessicale; `compiler.rs:362` segue symlink. Prova isolata: `90_PROPOSALS` collegata a una directory temporanea esterna; compilazione riuscita e file scritto fuori dal Vault. Nessun dato reale utilizzato. Servono directory ancorate e scritture esclusive sicure anche per indice e scansione.
3. **HTML Rust non igienizzato secondo contratto.** `compiler.rs:196` rimuove solo script/iframe minuscoli; la prova conserva integralmente SCRIPT maiuscolo, img remoto e onerror. TS estrae testo, Rust conserva markup: manca parità. Questa prova verifica l'output, non dimostra esecuzione di script nell'app.
4. **Anteprima assente.** `apps/desktop/src/App.tsx:822` mostra solo il numero di proposte e un testo descrittivo, senza elenco leggibile delle bozze o anteprima. La checkbox di anteprima completata era errata.

## Ulteriori lacune da lettura del codice

- Entrambi i compilatori accettano un percorso sorgente senza imporre `20_RAW_SOURCES/`.
- Indice scritto senza transazione; errori di lettura/parsing diventano indice vuoto. Conservare tracking preesistente, gestire concorrenza e rollback.
- `imported_at` viene assegnato alla prima compilazione, non all'importazione effettiva. Definire correttamente la semantica o registrare l'importazione.
- Rust costruisce YAML manualmente escapando solo virgolette; aggiungere serializzazione e verifica schema con titoli contenenti backslash/newline.
- Il batch Rust propaga con `?` gli errori I/O della singola compilazione e interrompe l'intero batch.

## Verifiche effettive di questo audit

- `pnpm --filter @limen-vault/knowledge-compiler test`: 4/4 passati.
- Cargo locale `.local/cargo`, `.local/rustup`; `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml compiler::tests`: 3/3 passati, gli altri test filtrati; warning import inutilizzato.
- Probe riproducibili `.local/m4-audit/probe.mts` e `.local/m4-audit/probe.rs`. Il probe Rust importa direttamente il modulo applicativo originale mediante path e viene compilato in un harness offline separato. Fixture temporanee rimosse al termine.
- TS: human edit overwritten=true; same basename collision=true.
- Rust: human edit overwritten=true; same basename collision=true; unsafe HTML retained=true; wrote outside Vault via symlink=true.
- Non rieseguiti monorepo completo, typecheck o build release: nessuna modifica applicativa e difetti bloccanti già dimostrati. Gli esiti generali rimangono dichiarazioni AG in questo audit.
- Nessun E2E M4 nell'app compilata eseguito da questo audit. Il resoconto AG fornito non documenta una prova nativa offline, mentre TASK_LIST la segnava completata. I precedenti E2E M3 non valgono come E2E M4.

M4: implementazione parziale locale, chiusura bloccata. Correggere i difetti, aggiungere regressioni e parità TS/Rust, completare anteprima e verificare flusso reale offline prima della chiusura.
