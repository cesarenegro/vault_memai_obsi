import crypto from 'crypto';
import type { SnapshotManifest } from '@limen-vault/vault-schema';

export interface SnapshotEngineContract {
  createSnapshot(vaultPath: string): Promise<SnapshotManifest>;
  verifyIntegrity(vaultPath: string, manifest: SnapshotManifest): Promise<boolean>;
}

export function computeSHA256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
