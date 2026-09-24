# FASE 6 — Piano di Implementazione & Task List

## Obiettivo
Correggere i difetti residui B, F, H e applicare le modifiche all'interfaccia decise da Cesare, garantendo la compatibilità sia per Windows che per macOS, aggiornando la versione a LIMEN Vault V5 (0.5.0) e mantenendo l'intera suite di test verde al 100%.

---

## Task List Dettagliata

- [x] **Fase 1: Configurazione globale tema colore Lime e Versione V5 (0.5.0)**
  - [x] 1.1 Definire `--limen-lime: #77F117;` e `--limen-lime-30: rgba(119, 241, 23, 0.30);` in `apps/desktop/src/index.css` (o foglio stile globale), con regola di testo scuro `#0f172a` su sfondo verde.
  - [x] 1.2 Aggiornare la versione a LIMEN Vault V5 (0.5.0) in `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, `tauri.conf.json`, `index.html`, `App.tsx` e `HelpPanel.tsx`.

- [x] **Fase 2: Backend Rust — Comando conteggio note per categoria (Punto 12 & 15)**
  - [x] 2.1 Implementare in `apps/desktop/src-tauri/src/knowledge.rs` la funzione `count_notes_by_category` che conta i file `.md` per ogni cartella di `FOLDERS` senza leggerne il contenuto.
  - [x] 2.2 Scrivere test unitario Rust in `knowledge.rs` per verificare il conteggio (cartelle con 0, 1 e più file `.md`, file non `.md` ignorati).
  - [x] 2.3 Esportare il comando Tauri `count_knowledge_notes` in `apps/desktop/src-tauri/src/main.rs`.

- [x] **Fase 3: Frontend — Correzione Difetti B, F, H**
  - [x] 3.1 **Difetto B (Integrità dei passaggi)**: In `AiPanel.tsx` (righe 638–645), passare l'impronta sha256 del passaggio se presente (`passageHashes` per `passageId`), oppure l'impronta del documento senza `passageId`, evitando il falso positivo di manomissione. Verificare anche `AiHistoryDrawer.tsx` e `App.tsx`.
  - [x] 3.2 **Difetto F (Nome delle fonti)**:
    - In `cleanTitle` (`AiPanel.tsx`), eliminare sia prefissi tecnici con `_` che prefissi esadecimali a 16 caratteri con `-` (es. `32f2a4081d13410e-BNXT CRM.md`).
    - Categoria tecnica: mappare `"raw_source"` in `"Documento caricato"` e le altre categorie in etichette italiane leggibili.
    - Localizzatore senza ripetizione: compattare "Paragrafi X, Paragrafi Y" in "Paragrafi X, Y".
    - Applicare lo stesso formato in `AiHistoryDrawer.tsx` (riga 445).
  - [x] 3.3 **Difetto H (Testi per OS in Windows/Mac)**:
    - Aggiornare `platform.ts` con i termini esatti per OS: `fileManager: 'Esplora file'` su Windows vs `'Finder'` su Mac; `deviceTerm: 'questo computer'` vs `'Mac'`; `keychainTerm: 'Gestione credenziali di Windows'` vs `'Portachiavi'`; percorsi modelli `C:\Users\<utente>\LIMEN Vault\models\` vs Mac.
    - Sostituire le occorrenze in `App.tsx` e `HelpPanel.tsx`.

- [x] **Fase 4: Frontend — Modifiche all'Interfaccia (Punti 4–11, 12, 13)**
  - [x] 4.1 **Schermata di benvenuto (Punto 4)**: Pulsante "APRI VAULT ESISTENTE" (`App.tsx` riga 1040) con sfondo `var(--limen-lime)` e testo `#0f172a`.
  - [x] 4.2 **Panoramica (Punto 5)**: "Differenze rilevate rispetto al manifesto SHA-256" (`App.tsx` riga 1105) trasformato in riga richiudibile, chiusa all'apertura, con conteggio differenze nel titolo e dettaglio aperto solo al clic.
  - [x] 4.3 **Avanzate (Punti 6 & 7)**:
    - All'apertura mostra subito "Collegamenti AI & MCP" (riga 1814) invece di "Bozze e Proposte".
    - Pulsante "Guida Vault" (riga 1817) con sfondo `var(--limen-lime)` e testo `#0f172a`.
  - [x] 4.4 **Chiedi — Layout e Stile Chat (Punti 8, 9, 10, 11)**:
    - Riquadro "Chiedi al Vault" (`AiPanel.tsx`): larghezza allineata alla ricerca con sfondo `var(--limen-lime-30)` per evidenziare l'area di input.
    - Layout chat a messaggistica: turni con domande di Cesare allineate a destra con sfondo `var(--limen-lime)` e testo scuro `#0f172a`; risposte allineate a sinistra in riquadro bianco.
    - Fonti: posizionate rigorosamente SOTTO la risposta in ogni turno e durante lo streaming.
    - Blocco fonti richiudibile e CHIUSO all'inizio (`sourcesOpen: false`), sia in `AiPanel.tsx` sia nello storico `AiHistoryDrawer.tsx`.
  - [x] 4.5 **Memoria (Punto 12)**:
    - Chiamare il comando Tauri di conteggio all'apertura/aggiornamento del tab memoria e mostrare su ogni pulsante il conteggio, es. `Clienti (0)`.
  - [x] 4.6 **Guida Vault (Punto 13)**:
    - Aggiornare `HelpPanel.tsx` con le modifiche di Fase 6 e fasi H1/H2 (storico conversazioni, domande di seguito, pulsante "Nuova conversazione") con i testi differenziati per OS.

- [x] **Fase 5: Collaudo, Test e Consegna**
  - [x] 5.1 Eseguire `cargo test` (lib e bin/main.rs), assicurando tutti i test verdi (204 lib + 19 main.rs ok, 0 failed).
  - [x] 5.2 Salvare evidenza test in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase6-test.log` con commit hash in prima riga e tutte le sezioni `test result`.
  - [x] 5.3 Eseguire `npm run typecheck` e salvare log in `IMPLEMENTATION/WINDOWS_BUILD_EVIDENCE/fase6-typecheck.log` con codice di uscita 0.
  - [x] 5.4 Effettuare UN SOLO commit e push su `origin/windows-build`.
  - [x] 5.5 Rispondere in chat con hash, esito della suite e tabella punto -> file/righe.
