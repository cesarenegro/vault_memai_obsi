# Chiusura M2 — COMPLETATA IN LOCALE
Stato finale: tutte le fasi concluse e verificate l’11 settembre 2026; nessuna pubblicazione. Rapporto: IMPLEMENTATION/2026-09-11_M2_NATIVE_VALIDATION.md.
Obiettivo: chiudere criteri del piano IMPLEMENTATION/m2_refinement_plan.md con prove reali.
Baseline: diff preesistente e sorgenti UI/Rust conservati in .local/m2-baseline; nessun reset.
Fasi: 1 toolchain locale e contratti; 2 validazione/sicurezza TS e Rust; 3 adapter IPC e test; 4 build/test nativi e prova fuori checkout; 5 documentazione.
Modificare: vault-core, desktop Rust/adapter/App wiring/test, configurazione bundle, fixture e documenti operativi.
Non modificare: stile UI approvato, snapshot-engine, milestone successive, Vault reale.
Database/API remota: nessun impatto. API locale: contratto IPC validato.
UI: wiring/stati soltanto, conservare CSS/layout/icone.
Test: regressioni TS, fixture parità Rust/TS, adapter, pnpm test/typecheck/build sequenziali, cargo test, build Tauri e app standalone senza Node/server/rete.
Rollback: rimuovere solo delta di questa sessione confrontando baseline; non cancellare lavoro preesistente.
Prerequisiti: Rust installato sotto .local senza modificare profilo shell; Xcode presente. Obsidian 1.13.7 disponibile in ~/Applications e verificato su fixture temporanee.
Sicurezza: runtime Rust usa directory capability per impedire escape durante risoluzione; letture tramite handle. Definire esplicitamente politica symlink e limiti TS.
