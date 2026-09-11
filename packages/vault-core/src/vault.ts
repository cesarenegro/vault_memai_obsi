export type VaultState =
  | 'READY'
  | 'INITIALIZING'
  | 'INVALID'
  | 'NO_VAULT'
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
