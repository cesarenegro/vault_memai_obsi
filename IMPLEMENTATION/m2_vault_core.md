# Implementation Plan — Milestone M2: Vault Core Runtime & Local Desktop Integration

This document outlines the implementation plan for **Milestone M2 — Vault Core**, which introduces the local-first runtime for creating, opening, validating, and protecting an Obsidian-compatible Knowledge Vault on macOS.

---

## User Review Required

> [!IMPORTANT]
> **Key Design Decisions & Boundaries for M2:**
> 1. **Zero Overwrite Safety:** Creating a new Vault in an existing non-empty directory that already contains a Vault or conflicting system files will fail with a clear `VaultAlreadyExistsError` rather than silently overwriting files.
> 2. **Read-Only Vault Opening:** Opening an existing Vault performs strict structural and frontmatter validation without mutating, modifying, or auto-repairing any files on disk.
> 3. **Path Traversal & Symlink Guard:** All file accesses and symlink resolutions are strictly validated against escaping the Vault root. Symlinks resolving outside the Vault root trigger a `SecurityPathError`.
> 4. **Desktop Native IPC Integration:** Tauri IPC commands in `main.rs` / TS runtime service bridge the UI directly to real filesystem operations (`create_vault`, `open_vault`, `validate_vault`).

---

## Proposed Changes

### Core Package: `@limen-vault/vault-core`

#### [MODIFY] [`packages/vault-core/src/vault.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/vault-core/src/vault.ts)
- Extend `VaultState` to include `NOT_ACCESSIBLE` and `INCOMPLETE`.
- Define `VaultValidationResult` interface:
  ```ts
  export interface VaultValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    checkedFoldersCount: number;
    checkedFilesCount: number;
    systemFilesValid: boolean;
  }
  ```
- Implement `VaultManager` class with methods:
  - `createVault(targetPath: string, vaultName?: string): Promise<VaultStatusInfo>`
  - `openVault(targetPath: string): Promise<{ status: VaultStatusInfo; validation: VaultValidationResult }>`
  - `validateVault(targetPath: string): Promise<VaultValidationResult>`

#### [MODIFY] [`packages/vault-core/src/path-guard.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/vault-core/src/path-guard.ts)
- Add real symlink resolution safety (`fs.realpathSync`) to verify symlinks do not escape the Vault root directory.

#### [NEW] [`packages/vault-core/src/vault-creator.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/vault-core/src/vault-creator.ts)
- Implement template copying from `vault-template/` to target directory.
- Verify directory permissions and reject existing non-empty target paths with existing Vault manifests.

#### [NEW] [`packages/vault-core/src/vault-validator.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/vault-core/src/vault-validator.ts)
- Validate 15 required subdirectories.
- Validate `00_SYSTEM/VAULT_MANIFEST.json`, `HOME.md`, `VAULT_RULES.md`.
- Validate YAML frontmatter across `.md` files using `FrontmatterSchema` from `@limen-vault/vault-schema`.

#### [NEW] [`packages/vault-core/tests/vault-core.test.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/vault-core/tests/vault-core.test.ts)
- Comprehensive test suite testing:
  - Vault creation in clean directory.
  - Rejection of creation in occupied directory (no overwrite).
  - Validation of valid Vault.
  - Rejection of missing subdirectories or corrupt manifest/frontmatter.
  - Path traversal and external symlink rejection.
  - Non-existent and unreadable paths.

---

### Desktop Application: `apps/desktop`

#### [MODIFY] [`apps/desktop/src-tauri/src/main.rs`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src-tauri/src/main.rs)
- Implement Tauri IPC commands: `create_vault_cmd`, `open_vault_cmd`, `validate_vault_cmd`.

#### [MODIFY] [`apps/desktop/src/App.tsx`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src/App.tsx)
- Connect "CREATE NEW VAULT" and "OPEN EXISTING VAULT" UI buttons to call native Tauri IPC commands or local TS VaultManager fallback.
- Display actual Vault status, page counts, and validation error messages in the UI.

---

### Documentation & Handover Files

#### [MODIFY] [`SESSION HANDOVER.MD`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/SESSION%20HANDOVER.MD)
#### [NEW] [`LAST SESSION/M2_HANDOVER.md`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/LAST%20SESSION/M2_HANDOVER.md)
#### [NEW] [`TODO/M2_TASKS.md`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/TODO/M2_TASKS.md)
#### [MODIFY] [`docs/MILESTONES.md`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/docs/MILESTONES.md)
#### [MODIFY] [`MANUALE UTENTE.MD`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/MANUALE%20UTENTE.MD)

---

## Verification Plan

### Automated Verification
```bash
# Run unit & guard tests
pnpm test

# TypeScript type checking across all workspace apps & packages
pnpm typecheck

# Production build across desktop and web
pnpm build
```

### Manual & Native Tauri Verification
- Verify native Desktop App Vite/Tauri build.
- Verify Vault creation and validation with local filesystem paths.
