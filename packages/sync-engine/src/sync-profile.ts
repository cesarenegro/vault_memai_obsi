import crypto from 'crypto';
import { SafeDir } from '@limen-vault/vault-core';
import type { SyncProfile } from './types.js';

export const SYNC_PROFILE_FILE = 'SYNC_PROFILE.json';

export class SyncProfileManager {
  /**
   * Reads the SYNC_PROFILE.json from 00_SYSTEM if it exists.
   */
  static readProfile(vaultRoot: string): SyncProfile | null {
    const root = SafeDir.open(vaultRoot);
    try {
      let sys: SafeDir | undefined;
      try {
        sys = root.dir('00_SYSTEM');
        if (!sys.names().includes(SYNC_PROFILE_FILE)) {
          return null;
        }
        const content = sys.read(SYNC_PROFILE_FILE);
        const parsed = JSON.parse(content) as SyncProfile;
        if (parsed.schemaVersion !== 1 || !parsed.vaultId || !parsed.deviceId) {
          throw new Error('Malformed SYNC_PROFILE.json');
        }
        return parsed;
      } catch (err) {
        if ((err as { errno?: number }).errno === 2) return null;
        throw err;
      } finally {
        sys?.close();
      }
    } finally {
      root.close();
    }
  }

  /**
   * Gets or initializes the SYNC_PROFILE.json in 00_SYSTEM.
   */
  static getOrCreateProfile(
    vaultRoot: string,
    options?: { endpoint?: string; tenantId?: string; deviceId?: string }
  ): SyncProfile {
    const existing = this.readProfile(vaultRoot);
    if (existing) {
      return existing;
    }

    const root = SafeDir.open(vaultRoot);
    try {
      const sys = root.dir('00_SYSTEM');
      try {
        const profile: SyncProfile = {
          schemaVersion: 1,
          vaultId: `vault-${crypto.randomUUID()}`,
          deviceId: options?.deviceId || `device-${crypto.randomUUID()}`,
          endpoint: options?.endpoint,
          tenantId: options?.tenantId,
        };

        const json = JSON.stringify(profile, null, 2);
        sys.writeNew(SYNC_PROFILE_FILE, json);
        return profile;
      } finally {
        sys.close();
      }
    } finally {
      root.close();
    }
  }

  /**
   * Updates lastCommit in SYNC_PROFILE.json.
   */
  static recordCommit(
    vaultRoot: string,
    commitInfo: NonNullable<SyncProfile['lastCommit']>
  ): SyncProfile {
    const current = this.getOrCreateProfile(vaultRoot);
    const updated: SyncProfile = {
      ...current,
      lastCommit: commitInfo,
    };

    const root = SafeDir.open(vaultRoot);
    try {
      const sys = root.dir('00_SYSTEM');
      try {
        // Safe atomic replace in 00_SYSTEM
        const tempName = `.tmp-${crypto.randomUUID()}`;
        sys.writeNew(tempName, JSON.stringify(updated, null, 2));
        sys.replaceFile(tempName, SYNC_PROFILE_FILE);
        return updated;
      } finally {
        sys.close();
      }
    } finally {
      root.close();
    }
  }
}
