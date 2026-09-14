import { invoke } from '@tauri-apps/api/core';

export type SyncStatus =
  | 'DISABLED'
  | 'NOT_CONFIGURED'
  | 'OFFLINE'
  | 'READY'
  | 'TRANSFERRING'
  | 'VERIFYING'
  | 'CONFLICT'
  | 'AUTH_REQUIRED'
  | 'FAILED';

export type TransferOperation = 'UPLOAD_PRIVATE' | 'DOWNLOAD_COPY' | 'PUBLISH_APPROVED';

export interface SyncConfig {
  enabled: boolean;
  endpoint?: string;
  bucketName?: string;
  tenantId?: string;
  vaultId?: string;
}

export interface SyncStatusInfo {
  progress?: {completedFiles:number;totalFiles:number;completedBytes:number};
  pendingOperationId?: string;
  pendingVaultPath?: string;
  status: SyncStatus;
  bucket?: string;
  endpoint?: string;
  lastReleaseId?: string;
  lastCommittedAt?: string;
  channel?: 'private' | 'published';
  error?: string;
}

export interface TransferPlanItem {
  relativePath: string;
  category: string;
  sizeBytes: number;
  sha256: string;
  status: string;
}

export interface TransferPlanResponse {
  operationId: string;
  operation: TransferOperation;
  channel: 'private' | 'published';
  eligibleDocuments: TransferPlanItem[];
  excludedPaths: string[];
  totalBytes: number;
  baseReleaseId?: string | null;
}

export interface TransferExecutionResponse {
  status: 'COMMITTED' | 'DOWNLOADED' | 'IMPORTED' | 'CONFLICT' | 'FAILED';
  releaseId?: string;
  manifestHash?: string;
  conflictWith?: string;
  error?: string;
  targetVaultPath?: string;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('Native app runtime required for cloud transfer operations');
  }
  try {return await invoke<T>(command, args);}
  catch(e){const message=typeof e==='string'?e:e instanceof Error?e.message:'Operazione non riuscita';throw new Error(message==='NOT_CONFIGURED'?'Collega prima l’archivio in Impostazioni Cloud Copy.':message);}
}

export const syncIpc = {
  revokePublication: () => call<{status:string}>('sync_revoke_publication'),
  selectNotes: (operationId:string, paths:string[]) => call<string>('sync_select_notes',{operationId,paths}),
  listReleases: () => call<{releaseId:string;createdAt:string;documentCount:number}[]>('sync_list_releases'),
  saveKey: (token:string) => call<void>('sync_save_key',{token}),
  getStatus: async (): Promise<SyncStatusInfo> => {
    if (!('__TAURI_INTERNALS__' in window)) {
      return { status: 'OFFLINE', error: 'Web preview mode (independent offline vault)' };
    }
    return call<SyncStatusInfo>('sync_get_status');
  },

  testConnection: async (): Promise<{ success: boolean; latencyMs?: number; error?: string }> => {
    return call<{ success: boolean; latencyMs?: number; error?: string }>('sync_test_connection');
  },

  saveConfig: async (config: SyncConfig): Promise<void> => {
    return call<void>('sync_save_config', { config });
  },

  disconnect: async (): Promise<void> => {
    return call<void>('sync_disconnect');
  },

  planTransfer: async (
    vaultPath: string,
    operation: TransferOperation,
    releaseId?: string
  ): Promise<TransferPlanResponse> => {
    return call<TransferPlanResponse>('sync_plan_transfer', { vaultPath, operation, releaseId });
  },

  executeTransfer: async (
    operationId: string,
    vaultPath: string
  ): Promise<TransferExecutionResponse> => {
    return call<TransferExecutionResponse>('sync_execute_transfer', { operationId, vaultPath });
  },

  cancelTransfer: async (operationId: string): Promise<void> => {
    return call<void>('sync_cancel_transfer', { operationId });
  },
};
