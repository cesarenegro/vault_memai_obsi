import fs from 'fs';
import path from 'path';
import { REQUIRED_VAULT_FOLDERS } from './vault-validator.js';

export class VaultCreationError extends Error {
  constructor(message: string) {
    super(`[VaultCreationError] ${message}`);
    this.name = 'VaultCreationError';
  }
}

export class VaultAlreadyExistsError extends Error {
  constructor(message: string) {
    super(`[VaultAlreadyExistsError] ${message}`);
    this.name = 'VaultAlreadyExistsError';
  }
}

export class VaultCreator {
  /**
   * Resolves the path to the workspace `vault-template` directory.
   */
  static findTemplateDir(workspaceRoot?: string): string {
    const startDir = workspaceRoot || process.cwd();
    let curr = path.resolve(startDir);

    while (curr !== path.parse(curr).root) {
      const templateCandidate = path.join(curr, 'vault-template');
      if (fs.existsSync(templateCandidate) && fs.statSync(templateCandidate).isDirectory()) {
        return templateCandidate;
      }
      curr = path.dirname(curr);
    }

    throw new VaultCreationError('Could not locate "vault-template" directory in workspace tree.');
  }

  /**
   * Recursively copies a directory structure and files.
   */
  private static copyRecursive(srcDir: string, destDir: string) {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        VaultCreator.copyRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Creates a new LIMEN Vault in the specified target directory.
   * Protects existing data: throws VaultAlreadyExistsError if target contains existing files/manifest.
   */
  static createVault(targetPath: string, vaultName?: string, customTemplateDir?: string): { vaultPath: string; vaultName: string } {
    if (!targetPath || typeof targetPath !== 'string') {
      throw new VaultCreationError('Target vault directory path is required.');
    }

    const resolvedTarget = path.resolve(targetPath);
    const finalName = vaultName?.trim() || path.basename(resolvedTarget) || 'LIMEN Vault';

    // 1. Protection Check: Existing non-empty directory or existing Vault
    if (fs.existsSync(resolvedTarget)) {
      const stat = fs.statSync(resolvedTarget);
      if (!stat.isDirectory()) {
        throw new VaultCreationError(`Target path exists and is not a directory: "${targetPath}"`);
      }

      const existingEntries = fs.readdirSync(resolvedTarget);
      const hasManifest = fs.existsSync(path.join(resolvedTarget, '00_SYSTEM', 'VAULT_MANIFEST.json'));
      const hasFolders = REQUIRED_VAULT_FOLDERS.some((folder) => fs.existsSync(path.join(resolvedTarget, folder)));

      if (existingEntries.length > 0 && (hasManifest || hasFolders)) {
        throw new VaultAlreadyExistsError(
          `Target directory "${targetPath}" already contains an existing Vault or conflicting files.`
        );
      }
    } else {
      try {
        fs.mkdirSync(resolvedTarget, { recursive: true });
      } catch (err) {
        throw new VaultCreationError(`Failed to create directory "${targetPath}": ${(err as Error).message}`);
      }
    }

    // 2. Locate Template and Copy Structure
    const templateDir = customTemplateDir || VaultCreator.findTemplateDir();

    try {
      VaultCreator.copyRecursive(templateDir, resolvedTarget);
    } catch (err) {
      throw new VaultCreationError(`Failed to copy vault template to "${targetPath}": ${(err as Error).message}`);
    }

    // 3. Update Manifest with Vault Name & Creation Timestamp
    const manifestPath = path.join(resolvedTarget, '00_SYSTEM', 'VAULT_MANIFEST.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
        const manifestData = JSON.parse(manifestRaw);
        const now = new Date().toISOString();

        manifestData.vault_name = finalName;
        manifestData.created_at = now;
        manifestData.updated_at = now;

        fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
      } catch (err) {
        throw new VaultCreationError(`Failed to update vault manifest in "${targetPath}": ${(err as Error).message}`);
      }
    }

    return {
      vaultPath: resolvedTarget,
      vaultName: finalName,
    };
  }
}
