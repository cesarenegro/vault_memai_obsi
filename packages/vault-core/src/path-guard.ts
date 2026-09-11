import path from 'path';
import fs from 'fs';

export class SecurityPathError extends Error {
  constructor(message: string) {
    super(`[SecurityPathError] ${message}`);
    this.name = 'SecurityPathError';
  }
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
  if (normalizedTarget.includes('..') || normalizedTarget.startsWith('/')) {
    throw new SecurityPathError(`Path traversal or absolute escape detected in: "${relativeTarget}"`);
  }

  const resolvedRoot = path.resolve(vaultRoot);
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  const resolvedTarget = path.resolve(realRoot, normalizedTarget);

  if (!resolvedTarget.startsWith(realRoot)) {
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
    ? relativeOrAbsolutePath
    : path.resolve(realRoot, relativeOrAbsolutePath);

  if (fs.existsSync(targetPath)) {
    const realTarget = fs.realpathSync(targetPath);
    if (!realTarget.startsWith(realRoot)) {
      throw new SecurityPathError(`Symlink target "${realTarget}" escapes Vault root "${realRoot}"`);
    }
    return realTarget;
  }

  return targetPath;
}

