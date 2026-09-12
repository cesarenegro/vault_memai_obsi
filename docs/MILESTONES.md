# Product Milestones Roadmap

- [x] **M0 — Foundation**: Monorepo architecture, independence guard tests, Obsidian vault template, system rules.
- [x] **M1 — Product UI Shell**: Reusable UI design system, Desktop application shell (11 screens + First-run UX), Web landing page.
- [x] **M2 — Vault Core**: Completata in locale: sicurezza TS/Rust, parità, IPC, bundle e creazione/apertura offline fuori checkout, Obsidian verificati. Nessuna pubblicazione; vedere TASK_LIST.md.
- [x] **M3 — Snapshots**: Completata in locale il 12 settembre: TS/Rust corretti, staging/pubblicazione esclusiva, verifica hash reale, regressioni ed E2E UI offline passati. Nessuna pubblicazione.
- [x] **M4 — Knowledge Compiler**: Completata in locale il 12 settembre: compilazione deterministica TS/Rust, revisioni draft sicure, provenienza, elenco/anteprima e prove native/UI offline. Rapporto: IMPLEMENTATION/2026-09-12_M4_CLOSURE.md.
- [x] **M5 — Local Search**: Completata e verificata in locale: ricerca TS/Rust, indice sicuro, parità, filtri e UI offline con riavvio. Rapporto: IMPLEMENTATION/2026-09-12_M5_CLOSURE.md.
- [ ] **M6 — OpenAI / Codex**: Ask Knowledge AI query engine.
- [ ] **M7 — Outputs + Proposals**: preparazione TS presente, integrazione Rust/IPC/UI aperta; chiusura AG non confermata dall’audit.
- [x] **M8 — Hard Fallback Validation**: completata in locale; banco nativo, GUI offline, interruzione connessione reale, recupero e lettura Obsidian verificati. Limiti ed evidenze: IMPLEMENTATION/2026-09-12_M8_CLOSURE_E2E.md.
- [ ] **M9 — macOS Release**: Piano [M9REV](../IMPL_PLANS/IMP_PLAN_M9REV.MD) definito; DMG, AI installabile, firma/notarizzazione, aggiornamento manuale e validazione da implementare. Pubblicazione separata.
- [ ] **M10 — R2 Sync**: Optional future cloud synchronization.

Stato operativo completo e sottofasi: [TASK_LIST.md](../TASK_LIST.md), aggiornato il 12 settembre 2026. M2–M5 completate e verificate in locale su macOS ARM64; nessuna pubblicazione.
