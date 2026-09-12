import fs from 'fs';
import path from 'path';

export function isSubdirectoryOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

export function sanitizeVaultPath(vaultRoot: string, relativeTarget: string): string {
  if (!vaultRoot || typeof vaultRoot !== 'string') {
    throw new Error('SecurityPathError: Invalid vault root directory specified.');
  }
  if (!relativeTarget || typeof relativeTarget !== 'string') {
    throw new Error('SecurityPathError: Invalid target path specified.');
  }

  const normalizedTarget = relativeTarget.replace(/\\/g, '/');

  if (normalizedTarget.split('/').includes('..') || normalizedTarget.startsWith('/')) {
    throw new Error(`SecurityPathError: Path traversal or absolute escape detected in: "${relativeTarget}"`);
  }

  const resolvedRoot = path.resolve(vaultRoot);
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  const resolvedTarget = path.resolve(realRoot, normalizedTarget);

  if (!isSubdirectoryOrEqual(realRoot, resolvedTarget)) {
    throw new Error(`SecurityPathError: Target path "${relativeTarget}" escapes Vault root "${vaultRoot}"`);
  }

  return resolvedTarget;
}

export function validateSymlinkSafety(vaultRoot: string, relativeOrAbsolutePath: string): string {
  const resolvedRoot = path.resolve(vaultRoot);
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;

  const targetPath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(realRoot, relativeOrAbsolutePath);

  if (!isSubdirectoryOrEqual(realRoot, targetPath)) {
    throw new Error('SecurityPathError: Target escapes Vault root');
  }

  const parts = path.relative(realRoot, targetPath).split(path.sep).filter(Boolean);
  let current = realRoot;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error('SecurityPathError: Symlinks inside the Vault are not allowed');
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw err;
    }
  }
  return targetPath;
}
