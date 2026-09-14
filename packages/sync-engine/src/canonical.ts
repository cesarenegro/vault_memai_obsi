import crypto from 'crypto';
import type { ReleaseManifest } from './types.js';

/**
 * Deterministic JSON stringifier with sorted keys.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJsonStringify(item)).join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).filter(key => record[key] !== undefined).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes the canonical SHA-256 hash for a release manifest.
 * The hash is computed over all fields EXCLUDING `manifestHash`.
 */
export function computeManifestHash(manifest: Omit<ReleaseManifest, 'manifestHash'>): string {
  // Sort documents by relativePath deterministically
  const sortedDocs = [...manifest.documents].sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0
  );

  const payloadToHash = {
    schemaVersion: manifest.schemaVersion,
    channel: manifest.channel,
    tenantId: manifest.tenantId,
    vaultId: manifest.vaultId,
    releaseId: manifest.releaseId,
    parentReleaseId: manifest.parentReleaseId ?? null,
    createdAt: manifest.createdAt,
    deviceId: manifest.deviceId,
    formatVersion: manifest.formatVersion,
    documents: sortedDocs,
  };

  const canonicalString = canonicalJsonStringify(payloadToHash);
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Verifies that a manifest's `manifestHash` strictly matches the canonical hash of its payload.
 */
export function verifyManifestIntegrity(manifest: ReleaseManifest): boolean {
  if (!manifest || !/^[a-f0-9]{64}$/.test(manifest.manifestHash) || !Array.isArray(manifest.documents)) return false;
  const expectedHash = computeManifestHash(manifest);
  return crypto.timingSafeEqual(
    Buffer.from(manifest.manifestHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}
