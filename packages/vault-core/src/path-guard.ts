import path from 'path';

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
  const resolvedTarget = path.resolve(resolvedRoot, normalizedTarget);

  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new SecurityPathError(`Target path "${relativeTarget}" escapes Vault root "${vaultRoot}"`);
  }

  return resolvedTarget;
}
