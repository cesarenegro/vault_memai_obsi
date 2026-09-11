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
   * Helper: Counts markdown files in a given directory path.
   */
  private static countMarkdownFiles(dirPath: string, rootDir: string): number {
    let count = 0;
    if (!fs.existsSync(dirPath)) return 0;

    try {
      validateSymlinkSafety(rootDir, dirPath);
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          validateSymlinkSafety(rootDir, fullPath);

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            count += VaultManager.countMarkdownFiles(fullPath, rootDir);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            count++;
          }
        } catch {
          // Skip unreadable / security error files
        }
      }
    } catch {
      return 0;
    }

    return count;
  }

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
      pageCount: VaultManager.countMarkdownFiles(created.vaultPath, created.vaultPath),
      sourceCount: VaultManager.countMarkdownFiles(path.join(created.vaultPath, '20_RAW_SOURCES'), created.vaultPath),
      proposalCount: VaultManager.countMarkdownFiles(path.join(created.vaultPath, '90_PROPOSALS'), created.vaultPath),
      snapshotId: null,
      snapshotAge: null,
      integrityStatus: validation.isValid ? 'valid' : 'corrupted',
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

    // Try reading name from manifest if present
    const manifestPath = path.join(resolved, '00_SYSTEM', 'VAULT_MANIFEST.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
        const manifestData = JSON.parse(manifestRaw);
        if (manifestData.vault_name) {
          vaultName = manifestData.vault_name;
        }
        if (manifestData.snapshot_id) {
          snapshotId = manifestData.snapshot_id;
        }
      } catch {
        // Fall back to folder basename if manifest read fails
      }
    }

    let state: VaultState = 'READY';
    if (!validation.isValid) {
      state = validation.systemFilesValid ? 'INCOMPLETE' : 'INVALID';
    }

    const status: VaultStatusInfo = {
      state,
      path: resolved,
      name: vaultName,
      pageCount: VaultManager.countMarkdownFiles(resolved, resolved),
      sourceCount: VaultManager.countMarkdownFiles(path.join(resolved, '20_RAW_SOURCES'), resolved),
      proposalCount: VaultManager.countMarkdownFiles(path.join(resolved, '90_PROPOSALS'), resolved),
      snapshotId,
      snapshotAge: null,
      integrityStatus: validation.isValid ? 'valid' : 'corrupted',
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
