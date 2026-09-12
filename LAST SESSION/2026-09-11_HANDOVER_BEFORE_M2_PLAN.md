# SESSION HANDOVER — MEMAI V_FALLBACK OBSIDIAN (LIMEN Vault)

**Data aggiornamento:** 11 Settembre 2026

---

## 1. Stato del Progetto e Contesto
Il progetto **MEMAI V_FALLBACK OBSIDIAN (LIMEN Vault)** è un monorepo TypeScript/Next.js/Tauri per un sistema di conoscenza *local-first* indipendente ed offline-capable, compatibile con Obsidian.

### Principi Architetturali Fondamentali:
- **Local-First & Indipendenza:** L'applicazione deve poter aprire, navigare e cercare nel Vault locale senza alcuna dipendenza obbligatoria da servizi cloud remoti.
- **Monorepo Structure:**
  - `apps/web`: Next.js Web Dashboard (Target Vercel: `limen-vault`).
  - `apps/desktop`: App Desktop Tauri / React (`dev.arkai.limenvault`).
  - `packages/*`: `ui`, `vault-core`, `vault-schema`, `knowledge-compiler`, `search-engine`, `snapshot-engine`, `ai-engine`, `proposal-engine`.
  - `vault-template/`: Template della struttura del Vault Obsidian.

---

## 2. Servizi Esterni del Progetto MEMAI
1. **GitHub:** Version control e repository remoto monorepo: [`https://github.com/cesarenegro/vault_memai_obsi`](https://github.com/cesarenegro/vault_memai_obsi) (Branch `main` sincronizzato e pushato).
2. **Vercel:** Deployment per l'app web Next.js (`apps/web`).
3. **OpenAI API:** Provider AI autorizzato (`OPENAI_API_KEY`) in `@limen-vault/ai-engine` per sintesi e *Ask Knowledge AI*.
4. **Apple Developer & Notarization:** Firma digitale e notarizzazione dell'applicazione macOS Tauri (`apps/desktop`).
5. **Cloudflare R2 (M10):** Sincronizzazione ed Object Storage opzionale futuro per gli snapshot.

---

## 3. Comandi di Verifica Eseguiti con Successo (Rule 17 AGENT.md)
Esito della verifica reale del monorepo LIMEN Vault:
- `pnpm build`: **SUCCESS** (Next.js web app, Vite desktop app e tutti i pacchetti compilati al 100%).
- `pnpm test`: **SUCCESS** (Tutti i 6 test unitari di `snapshot-engine`, 8 di `vault-core` e guardie di indipendenza superati).
- `pnpm typecheck`: **SUCCESS** (Zero errori di tipo TypeScript su tutti gli 11 progetti del monorepo).

---

## 4. Istruzioni per il Coder / Prossima Sessione
- **Contesto Operativo:** Lavorare **esclusivamente** sul monorepo `MEMAI V_FALLBACK OBSIDIAN` (`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`). Non fare riferimento a progetti o database esterni estranei.
- **Engine di Snapshot & Integrità SHA-256:** Implementato in `@limen-vault/snapshot-engine` con verifica in sola lettura del manifest `00_SYSTEM/VAULT_MANIFEST.json` e gestione snapshot versionati in `00_SYSTEM/SNAPSHOTS/`.
- **Prossimo Step da Milestone (`docs/MILESTONES.md`):**
  - **Completati:** M0 (Foundation), M1 (Product UI Shell), M2 (Vault Core), M3 (Snapshots).
  - **Prossimo Focus (M4 — Knowledge Compiler):** Compilatore di conoscenza per la trasformazione di sorgenti grezze in pagine Wiki persistenti.
