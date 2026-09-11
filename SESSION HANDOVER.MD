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
- `pnpm build`: **SUCCESS** (Next.js web app, Vite desktop app e tutti i 10 pacchetti compilati al 100%).
- `pnpm test`: **SUCCESS** (Tutti gli 8 unit test di `vault-core` + guardie di indipendenza superati).
- `pnpm typecheck`: **SUCCESS** (Zero errori di tipo TypeScript su tutti gli 11 progetti del monorepo).

---

## 4. Istruzioni per il Coder / Prossima Sessione
- **Contesto Operativo:** Lavorare **esclusivamente** sul monorepo `MEMAI V_FALLBACK OBSIDIAN` (`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`). Non fare riferimento a progetti o database esterni estranei.
- **Vault Reale Creato:** Il Vault nativo è stato creato ed inzializzato al percorso `/Users/cesare/Documents/VAULT` con stato `READY` e validazione 15 cartelle completata.
- **Prossimo Step da Milestone (`docs/MILESTONES.md`):**
  - **Completati:** M0 (Foundation), M1 (Product UI Shell), M2 (Vault Core).
  - **Prossimo Focus (M3 — Snapshots):** Implementazione dell'engine di snapshot versionati e manifest di integrità.
