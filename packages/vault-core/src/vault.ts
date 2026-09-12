import fs from 'fs';
import path from 'path';
import { VaultValidator, VaultValidationResult } from './vault-validator.js';
import { VaultCreator, VaultAlreadyExistsError, VaultCreationError } from './vault-creator.js';
import { validateSymlinkSafety, SecurityPathError } from './path-guard.js';

export type VaultState =
  | 'READY'
  | 'INITIALIZING'
  | 'INVALID'
  | 'NO_VAULT'
  | 'NOT_ACCESSIBLE'
  | 'INCOMPLETE'
  | 'STALE_SNAPSHOT';

export interface VaultConfig {
  vaultPath: string | null;
  vaultName: string | null;
  obsidianPath?: string | null;
  autoSnapshotOnClose: boolean;
}

export interface VaultStatusInfo {
  state: VaultState;
  path: string | null;
  name: string | null;
  pageCount: number;
  sourceCount: number;
  proposalCount: number;
  snapshotId: string | null;
  snapshotAge: string | null;
  integrityStatus: 'valid' | 'corrupted' | 'unverified';
}

export class VaultManager {
  /**
   * Creates a new Vault at targetPath and returns its VaultStatusInfo.
   */
  static createVault(targetPath: string, vaultName?: string, customTemplateDir?: string): VaultStatusInfo {
    const created = VaultCreator.createVault(targetPath, vaultName, customTemplateDir);
    const validation = VaultValidator.validateVault(created.vaultPath);

    return {
      state: validation.isValid ? 'READY' : 'INVALID',
      path: created.vaultPath,
      name: created.vaultName,
      pageCount: validation.pageCount ?? 0,
      sourceCount: validation.sourceCount ?? 0,
      proposalCount: validation.proposalCount ?? 0,
      snapshotId: null,
      snapshotAge: null,
      integrityStatus: 'unverified',
    };
  }

  /**
   * Performs READ-ONLY inspection and validation of an existing Vault.
   */
  static openVault(targetPath: string): { status: VaultStatusInfo; validation: VaultValidationResult } {
    if (!targetPath || typeof targetPath !== 'string') {
      return {
        status: {
          state: 'NO_VAULT',
          path: null,
          name: null,
          pageCount: 0,
          sourceCount: 0,
          proposalCount: 0,
          snapshotId: null,
          snapshotAge: null,
          integrityStatus: 'unverified',
        },
        validation: {
          isValid: false,
          errors: ['No vault path specified.'],
          warnings: [],
          checkedFoldersCount: 0,
          checkedFilesCount: 0,
          systemFilesValid: false,
        },
      };
    }

    const resolved = path.resolve(targetPath);

    if (!fs.existsSync(resolved)) {
      return {
        status: {
          state: 'NOT_ACCESSIBLE',
          path: resolved,
          name: path.basename(resolved),
          pageCount: 0,
          sourceCount: 0,
          proposalCount: 0,
          snapshotId: null,
          snapshotAge: null,
          integrityStatus: 'unverified',
        },
        validation: {
          isValid: false,
          errors: [`Vault directory path does not exist: "${targetPath}"`],
          warnings: [],
          checkedFoldersCount: 0,
          checkedFilesCount: 0,
          systemFilesValid: false,
        },
      };
    }

    try {
      validateSymlinkSafety(resolved, resolved);
    } catch (err) {
      if (err instanceof SecurityPathError) {
        return {
          status: {
            state: 'NOT_ACCESSIBLE',
            path: resolved,
            name: path.basename(resolved),
            pageCount: 0,
            sourceCount: 0,
            proposalCount: 0,
            snapshotId: null,
            snapshotAge: null,
            integrityStatus: 'unverified',
          },
          validation: {
            isValid: false,
            errors: [`Security Violation: ${(err as Error).message}`],
            warnings: [],
            checkedFoldersCount: 0,
            checkedFilesCount: 0,
            systemFilesValid: false,
          },
        };
      }
    }

    const validation = VaultValidator.validateVault(resolved);
    let vaultName = path.basename(resolved);
    let snapshotId: string | null = null;

    // Use only already validated manifest data (never re-read or parse unvalidated/rejected manifest)
    if (validation.isValid && validation.validatedManifest) {
      if (typeof validation.validatedManifest.vault_name === 'string') {
        vaultName = validation.validatedManifest.vault_name;
      }
      if (typeof validation.validatedManifest.snapshot_id === 'string') {
        snapshotId = validation.validatedManifest.snapshot_id;
      }
    }

    let state: VaultState = 'READY';
    if (!validation.isValid) {
      state = (validation.state as VaultState) || 'INVALID';
    }

    const status: VaultStatusInfo = {
      state,
      path: resolved,
      name: vaultName,
      pageCount: validation.pageCount ?? 0,
      sourceCount: validation.sourceCount ?? 0,
      proposalCount: validation.proposalCount ?? 0,
      snapshotId,
      snapshotAge: null,
      integrityStatus: 'unverified',
    };

    return {
      status,
      validation,
    };
  }

  /**
   * Standalone READ-ONLY validation of a Vault directory.
   */
  static validateVault(targetPath: string): VaultValidationResult {
    return VaultValidator.validateVault(targetPath);
  }
}
