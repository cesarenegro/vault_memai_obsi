import { invoke } from '@tauri-apps/api/core';

export interface HistoryPassageRef {
  passageId: string;
  passageSha256: string;
}

export interface HistorySourceRef {
  documentId: string;
  relativePath: string;
  title: string;
  locator?: string;
  docSha256: string;
  passages: HistoryPassageRef[];
  citationIndex: number;
}

export interface HistoryEntry {
  id: string;
  conversationId: string;
  turnIndex: number;
  parentEntryId?: string;
  createdAtUtc: string;
  utcOffsetSeconds: number;
  requestedModel: string;
  responseModel: string;
  prompt: string;
  answer: string;
  status: string;
  durationMs: number;
  sources: HistorySourceRef[];
  pid?: number;
}

export interface HistoryEntryHeader {
  id: string;
  conversationId: string;
  turnIndex: number;
  createdAtUtc: string;
  utcOffsetSeconds: number;
  requestedModel: string;
  responseModel: string;
  prompt: string;
  answerPreview: string;
  status: string;
  durationMs: number;
  sourcesCount: number;
  pid?: number;
}

export type SourceVerificationStatus = 'fresh' | 'modified' | 'missing';

export interface VerifiedSourceResult {
  documentId: string;
  relativePath: string;
  title: string;
  locator?: string;
  citationIndex: number;
  status: SourceVerificationStatus;
  text?: string;
  warning?: string;
}

export interface VaultIdInfo {
  vaultId: string;
  duplicateWarning?: string;
}

async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (!isTauri) {
    if (command === 'ai_history_list') {
      return [] as unknown as T;
    }
    if (command === 'vault_id_get_or_create') {
      return { vaultId: 'vlt_browser_mock' } as unknown as T;
    }
    throw new Error(`Comando '${command}' non disponibile in anteprima browser`);
  }
  return invoke<T>(command, args);
}

export const historyIpc = {
  getVaultId: (vaultPath: string) => call<VaultIdInfo>('vault_id_get_or_create', { vaultPath }),
  list: (vaultPath: string) => call<HistoryEntryHeader[]>('ai_history_list', { vaultPath }),
  get: (vaultPath: string, entryId: string) => call<HistoryEntry>('ai_history_get', { vaultPath, entryId }),
  delete: (vaultPath: string, entryId: string) => call<void>('ai_history_delete', { vaultPath, entryId }),
  clear: (vaultPath: string) => call<number>('ai_history_clear', { vaultPath }),
  verifySources: (vaultPath: string, sources: HistorySourceRef[]) =>
    call<VerifiedSourceResult[]>('ai_history_verify_sources', { vaultPath, sources }),
};
