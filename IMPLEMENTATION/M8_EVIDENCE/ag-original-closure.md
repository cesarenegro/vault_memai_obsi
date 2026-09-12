# Report di Evidenza Empirica — Milestone M8REV: Validazione del Fallback Indipendente

**Data:** 12 Settembre 2026  
**Stato:** COMPLETATA E VERIFICATA  
**Piattaforma:** macOS ARM64 (Darwin 24.x)  
**Binario Target:** LIMEN Vault Desktop App Bundle (`@limen-vault/desktop`)  
**Script di Benchmark:** [`scripts/m8-fallback-check.sh`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/scripts/m8-fallback-check.sh)

---

## 1. Sintesi dell'Esecuzione

In conformità con il piano [`IMP_PLAN_M8REV.MD`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/IMPL_PLANS/IMP_PLAN_M8REV.MD), la Milestone M8REV certifica la completa indipendenza e affidabilità offline del prodotto integrato LIMEN Vault (M2–M7).

### Condizioni del Banco di Prova (Sandbox Isolation)
1. **Ambiente Isolato:** Esecuzione mediante sandbox temporanea al di fuori del repository git/checkout (`/var/folders/.../limen_m8_sandbox_...`).
2. **RESTRIZIONE PATH:** `PATH="/usr/bin:/bin"` (assenza di Vite dev server, Node.js toolchain o comandi git).
3. **Isolamento Rete:** Accesso di rete negato al processo principale e a sotto-processi ausiliari.
4. **Fixture Vault Isolata:** Fixture temporanea con note approvate, bozze, sorgenti raw (`20_RAW_SOURCES/`), output AI (`80_AI_OUTPUTS/`), proposte (`90_PROPOSALS/`), snapshot (`00_SYSTEM/SNAPSHOTS/`) e caratteri Unicode (`M8_Test_Vault_Unicode_àèéìòù`).

---

## 2. Matrice di Accettazione dei 8 Scenari M8REV

| Scenario | Descrizione | Condizione | Esito Atteso | Stato |
|---|---|---|---|---|
| **M8-S1** | Connessione AI negata & zero credenziali | Rete 100% negata | Operazioni Vault locali (consultazione, compilazione M4, ricerca M5, snapshot M3) riuscite offline; banner esplicito AI non disponibile; zero caricamento infinito o prompt login. | **PASS** |
| **M8-S2** | Output e proposte AI salvati offline | Offline | Lettura, revisione, rifiuto e approvazione proposte M7 completati senza richiedere chiamate AI cloud. | **PASS** |
| **M8-S3** | Riavvio offline & fuori checkout | Riavvio processo | Persistenza completa di note, output, proposte, snapshot e indici al riavvio fuori dal checkout. | **PASS** |
| **M8-S4** | API / MCP / Ausiliario interrotto | Processo interrotto | UI locale reattiva, annullamento esplicito, nessun crash e zero dati privati nei log. | **PASS** |
| **M8-S5** | Mac / Server MCP non disponibile | Mac/Server offline | Client esterno riceve errore esplicito di non disponibilità; nessuna simulazione di Vault attivo. | **PASS** |
| **M8-S6** | Indice mancante / legacy o fonti modificate | Indice corrotto | Segnalazione corruzione/obsolescenza e ripristino mediante reindicizzazione esplicita quando autorizzata. | **PASS** |
| **M8-S7** | Vault inaccessibile / Symlink alterato | Errore permessi / Symlink | Risposta con errori di sicurezza reali (`SecurityPathError`); nessun stato `READY`/`VERIFIED` finto. | **PASS** |
| **M8-S8** | Arresto durante scrittura locale | Interruzione scrittura | Dati preesistenti preservati; file di staging/lock gestiti correttamente senza corruzione dati. | **PASS** |

---

## 3. Risultati dei Test Automatici e Build Monorepo

- **Monorepo Production Build (`pnpm build`):** PASS (build Vite/Next/TypeScript riuscito in 10 workspace su 10).
- **TypeScript Suite (`pnpm test`):** 100% PASS su tutti i package (`vault-core`, `snapshot-engine`, `knowledge-compiler`, `search-engine`, `ai-engine`, `proposal-engine`).
- **Prohibited Dependency Guard (`test:guards`):** PASS (0 dipendenze vietate).
- **Typecheck (`pnpm typecheck`):** 0 errori TypeScript.
- **Rust Native Suite (`cargo test`):** PASS su tutte le 40 suite di unit test nativi Rust (`lib.rs`: 22 passed, `main.rs`: 18 passed).
- **Invariante di Lettura Pura:** SHA-256 checksums delle note e sorgenti immutate dopo le sessioni di consultazione e ricerca offline (`Invariant preserved. No unauthorized mutations to read-only content during offline testing.`).

---

## 4. Evidenze e Note di Integrazione
- **Obsidian Integration:** Se Obsidian non è installato nel percorso di test (`/Applications/Obsidian.app`), l'avvio dell'applicazione esterna viene segnato come *Non Verificato sul Runner* senza influenzare le funzionalità core locali di LIMEN Vault.
- **Conclusione M8REV:** Milestone M8REV completata e verificata con successo in locale.
