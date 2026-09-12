# Implementation Plan — Milestone M3: Versioned Local Snapshots & Integrity Engine

This document outlines the implementation plan for **Milestone M3 — Snapshots**, introducing SHA-256 file manifest integrity verification and versioned local snapshot creation for LIMEN Vault.

---

## User Review Required

> [!IMPORTANT]
> **Key Technical Scope & Boundaries for M3:**
> 1. **SHA-256 Manifest Verification (Read-Only):** Comparing file contents against `00_SYSTEM/VAULT_MANIFEST.json` returns structured discrepancies (`modifiedFiles`, `missingFiles`, `addedFiles`) without mutating or auto-repairing any files on disk.
> 2. **Snapshot Exclusion Rules:** The manifest file `00_SYSTEM/VAULT_MANIFEST.json` and the snapshots container directory `00_SYSTEM/SNAPSHOTS` are explicitly excluded from recursive copy loops.
> 3. **Atomic Snapshot Creation:** Snapshot creation copies files into `00_SYSTEM/SNAPSHOTS/snap-<timestamp>/`. If an error occurs during copy, the partial directory is cleaned up immediately so no incomplete snapshot is marked valid.
> 4. **No Destructive Restore or Pruning:** Automated snapshot deletion, retention policies, or destructive vault restores are NOT implemented in M3 unless explicitly specified in a future milestone.

---

## Proposed Changes

### Core Package: `@limen-vault/snapshot-engine`

#### [MODIFY] [`packages/snapshot-engine/src/index.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/snapshot-engine/src/index.ts)
- Extend `SnapshotEngineContract` and export SHA-256 computation, manifest verification, snapshot creation, and snapshot listing routines.

#### [NEW] [`packages/snapshot-engine/src/manifest-verifier.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/snapshot-engine/src/manifest-verifier.ts)
- Implement `verifyVaultManifestIntegrity(vaultPath: string): Promise<VaultIntegrityReport>`:
  - Computes SHA-256 for all `.md` and system files.
  - Identifies modified files (hash mismatch), missing files, and unmanifested added files.

#### [NEW] [`packages/snapshot-engine/src/snapshot-manager.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/snapshot-engine/src/snapshot-manager.ts)
- Implement `SnapshotManager` class:
  - `createSnapshot(vaultPath: string, note?: string): Promise<SnapshotItem>`
  - `listSnapshots(vaultPath: string): Promise<SnapshotItem[]>`
  - `verifySnapshotIntegrity(vaultPath: string, snapshotId: string): Promise<SnapshotIntegrityResult>`

#### [NEW] [`packages/snapshot-engine/tests/snapshot-engine.test.ts`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/snapshot-engine/tests/snapshot-engine.test.ts)
- Comprehensive test suite testing:
  - Successful snapshot creation and SHA-256 integrity verification.
  - Creating successive versioned snapshots without modifying previous ones.
  - Detection of modified, missing, and added files.
  - Incomplete snapshot cleanup on error.
  - Path traversal and anti-recursion protection (`00_SYSTEM/SNAPSHOTS`).
  - Read-only preservation of original Vault files during snapshot operations.

---

### Desktop Integration: `apps/desktop`

#### [MODIFY] [`apps/desktop/src/App.tsx`](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src/App.tsx)
- Connect Snapshots tab to display versioned snapshots list, allow triggering new local snapshots, and display SHA-256 integrity verification results.

---

## Verification Plan

### Automated Verification
```bash
# Run unit & guard tests across all workspace packages
pnpm test

# TypeScript strict type checking
pnpm typecheck

# Production build across desktop and web
pnpm build
```

### Manual Verification
- Create versioned local snapshots on macOS, modify a test note, and verify SHA-256 detection reports modified file cleanly.
