import fs from 'fs';
import path from 'path';
import { VaultManifestSchema } from '@limen-vault/vault-schema';
import { REQUIRED_VAULT_FOLDERS } from './vault-validator.js';
import { SafeDir, createRoot } from './safe-fs.js';
export class VaultCreationError extends Error { constructor(message: string) { super(message); this.name = 'VaultCreationError'; } }
export class VaultAlreadyExistsError extends Error { constructor(message: string) { super(message); this.name = 'VaultAlreadyExistsError'; } }
export class VaultCreator {
  static findTemplateDir(workspaceRoot?: string): string {
    let current = path.resolve(workspaceRoot || process.cwd());
    while (true) {
      const candidate = path.join(current, 'vault-template');
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(current);
      if (parent === current) throw new VaultCreationError('Could not locate vault-template');
      current = parent;
    }
  }
  static createVault(targetPath: string, vaultName?: string, customTemplateDir?: string): { vaultPath: string; vaultName: string } {
    if (!targetPath?.trim()) throw new VaultCreationError('Target path required');
    const target = path.resolve(targetPath);
    const name = vaultName?.trim() || path.basename(target);
    // Load and validate all template files before touching the destination.
    const template = SafeDir.open(customTemplateDir || this.findTemplateDir());
    const contents: Record<string, string> = {};
    try {
      const system = template.dir('00_SYSTEM');
      try { for (const file of ['HOME.md', 'VAULT_RULES.md', 'VAULT_MANIFEST.json']) contents[file] = system.read(file); }
      finally { system.close(); }
    } finally { template.close(); }
    const manifest = VaultManifestSchema.parse(JSON.parse(contents['VAULT_MANIFEST.json']));
    manifest.vault_name = name;
    manifest.created_at = manifest.updated_at = new Date().toISOString();
    contents['VAULT_MANIFEST.json'] = JSON.stringify(manifest, null, 2);
    const root = createRoot(target);
    try {
      if (root.names().length) throw new VaultAlreadyExistsError('Target directory is not empty');
      // mkdir is exclusive: a concurrent creator loses before writing any files.
      for (const folder of REQUIRED_VAULT_FOLDERS) root.mkdir(folder);
      const system = root.dir('00_SYSTEM');
      try { for (const [file, content] of Object.entries(contents)) system.writeNew(file, content); }
      finally { system.close(); }
      return { vaultPath: target, vaultName: name };
    } finally { root.close(); }
    // On failure preserve the partial tree; never remove potentially concurrent data.
  }
}
