import path from 'path';
import fs from 'fs';

export class SecurityPathError extends Error {
  constructor(message: string) {
    super(`[SecurityPathError] ${message}`);
    this.name = 'SecurityPathError';
  }
}

/**
 * Checks whether `child` is equal to or a sub-path of `parent`.
 * Prevents prefix matching vulnerability (e.g. parent="/vault", child="/vault-outside").
 */
export function isSubdirectoryOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

/**
 * Validates and resolves a relative vault path against a given Vault root.
 * Enforces security rules:
 * - Prevents path traversal ('..')
 * - Rejects absolute target paths escaping root
 * - Rejects malformed paths
 */
export function sanitizeVaultPath(vaultRoot: string, relativeTarget: string): string {
  if (!vaultRoot || typeof vaultRoot !== 'string') {
    throw new SecurityPathError('Invalid vault root directory specified.');
  }
  if (!relativeTarget || typeof relativeTarget !== 'string') {
    throw new SecurityPathError('Invalid target path specified.');
  }

  // Normalize path separators
  const normalizedTarget = relativeTarget.replace(/\\/g, '/');

  // Reject explicit path traversal attempts
  if (normalizedTarget.split('/').includes('..') || normalizedTarget.startsWith('/')) {
    throw new SecurityPathError(`Path traversal or absolute escape detected in: "${relativeTarget}"`);
  }

  const resolvedRoot = path.resolve(vaultRoot);
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  const resolvedTarget = path.resolve(realRoot, normalizedTarget);

  if (!isSubdirectoryOrEqual(realRoot, resolvedTarget)) {
    throw new SecurityPathError(`Target path "${relativeTarget}" escapes Vault root "${vaultRoot}"`);
  }

  return resolvedTarget;
}

/**
 * Ensures that if a path exists and is a symlink, its real resolved target does not escape the Vault root.
 */
export function validateSymlinkSafety(vaultRoot: string, relativeOrAbsolutePath: string): string {
  const resolvedRoot = path.resolve(vaultRoot);
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;

  const targetPath = path.isAbsolute(relativeOrAbsolutePath)
    ? (isSubdirectoryOrEqual(resolvedRoot, relativeOrAbsolutePath) ? path.resolve(realRoot, path.relative(resolvedRoot, relativeOrAbsolutePath)) : relativeOrAbsolutePath)
    : path.resolve(realRoot, relativeOrAbsolutePath);

  if (!isSubdirectoryOrEqual(realRoot, targetPath)) throw new SecurityPathError('Target escapes Vault root');
  const parts = path.relative(realRoot, targetPath).split(path.sep).filter(Boolean);
  let current = realRoot;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new SecurityPathError('Symlinks inside the Vault are not allowed');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw err;
    }
  }
  return targetPath;
}
