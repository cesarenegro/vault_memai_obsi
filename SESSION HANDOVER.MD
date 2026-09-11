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
1. **GitHub:** Version control e hosting repository monorepo.
2. **Vercel:** Deployment per l'app web Next.js (`apps/web`).
3. **OpenAI API:** Provider AI autorizzato (`OPENAI_API_KEY`) in `@limen-vault/ai-engine` per sintesi e *Ask Knowledge AI*.
4. **Apple Developer & Notarization:** Firma digitale e notarizzazione dell'applicazione macOS Tauri (`apps/desktop`).
5. **Cloudflare R2 (M10):** Sincronizzazione ed Object Storage opzionale futuro per gli snapshot.

---

## 3. Comandi di Verifica Eseguiti con Successo (Rule 17 AGENT.md)
Esito della verifica reale del monorepo LIMEN Vault:
- `pnpm build`: **SUCCESS** (Next.js web app, Vite desktop app e tutti i pacchetti compilati senza errori).
- `pnpm test`: **SUCCESS** (Unit test e `prohibited-dependencies.test.ts` passati a pieni voti).
- `pnpm typecheck`: **SUCCESS** (Zero errori di tipo TypeScript su tutti i pacchetti ed app del monorepo).

---

## 4. Istruzioni per il Coder / Prossima Sessione
- **Contesto Operativo:** Lavorare **esclusivamente** sul monorepo `MEMAI V_FALLBACK OBSIDIAN` (`/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`). Non fare riferimento a progetti o database esterni estranei.
- **Documentazione Utente:** È stato creato ed allineato il file [`MANUALE UTENTE.MD`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/MANUALE%20UTENTE.MD) completo di guida per l'utente, regole delle 15 cartelle del Vault, importazione PDF/TXT, YAML Frontmatter, workflow di approvazione ed i **diagrammi di flusso Mermaid**.
- **Prossimo Step da Milestone (`docs/MILESTONES.md`):**
  - **Completati:** M0 (Foundation) e M1 (Product UI Shell).
  - **Prossimo Focus (M2 — Vault Core):** Implementazione del runtime locale per la creazione, l'apertura e la validazione del Vault local-first.
