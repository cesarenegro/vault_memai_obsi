import {invoke} from '@tauri-apps/api/core';
export interface AiOptions {prompt:string;model:string;includeDrafts:boolean;sourceIds:string[];category?:string;client?:string;project?:string;tags?:string[]}
export interface AiSource {documentId:string;relativePath:string;title:string;category:string;status?:string;sha256:string;content:string;locator?:string;passageId?:string;revision?:number}
export interface AiPreview {ticket:string;sources:AiSource[];contextBytes:number}
export interface AiAnswer {answer:string;provider:string;model:string;citations:Omit<AiSource,'content'>[];tokensUsed?:number}

export interface EmbeddingsProviderReport {
  provider: 'local' | 'openai';
  model: string;
  dimensions: number;
  endpoint: string;
  cacheDimensions: number;
  cacheEntries: number;
  needsReindex: boolean;
}

export interface LocalModelReport {
  installed: boolean;
  path: string;
  bytes: number;
  sha256Ok: boolean;
}

export interface LocalServerReport {
  running: boolean;
  port: number;
  model: string;
  healthy: boolean;
  lastError: string | null;
}

export interface LocalModelProgress {
  downloaded: number;
  total: number;
  percent: number;
}

let mockProvider: EmbeddingsProviderReport = {
  provider: 'local',
  model: 'bge-m3',
  dimensions: 1024,
  endpoint: 'http://127.0.0.1:57471/v1/embeddings',
  cacheDimensions: 1024,
  cacheEntries: 9458,
  needsReindex: false,
};

let mockModel: LocalModelReport = {
  installed: true,
  path: '/Users/cesare/Library/Application Support/LIMEN Vault/models/bge-m3-Q8_0.gguf',
  bytes: 634553760,
  sha256Ok: true,
};

let mockServer: LocalServerReport = {
  running: true,
  port: 57471,
  model: 'bge-m3-Q8_0.gguf',
  healthy: true,
  lastError: null,
};

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!('__TAURI_INTERNALS__' in window)) {
    // Browser preview fallback mode for headless verification / screenshot capture
    if (command === 'embeddings_get_provider') return mockProvider as unknown as T;
    if (command === 'embeddings_set_provider') {
      const p = (args?.provider as 'local' | 'openai') ?? 'local';
      mockProvider = {
        ...mockProvider,
        provider: p,
        dimensions: p === 'local' ? 1024 : 1536,
        endpoint: p === 'local' ? (mockServer.running ? `http://127.0.0.1:${mockServer.port}/v1/embeddings` : '') : 'https://api.openai.com/v1/embeddings',
      };
      return mockProvider as unknown as T;
    }
    if (command === 'local_model_status') return mockModel as unknown as T;
    if (command === 'local_server_status') return mockServer as unknown as T;
    if (command === 'local_server_start') {
      mockServer = { running: true, port: 57471, model: 'bge-m3-Q8_0.gguf', healthy: true, lastError: null };
      mockProvider.endpoint = 'http://127.0.0.1:57471/v1/embeddings';
      return mockServer as unknown as T;
    }
    if (command === 'local_server_stop') {
      mockServer = { running: false, port: 0, model: 'bge-m3-Q8_0.gguf', healthy: false, lastError: null };
      mockProvider.endpoint = '';
      return mockServer as unknown as T;
    }
    if (command === 'embeddings_sync_vault') {
      return { total_passages: 9458, cached_passages: 9458, missing_passages: 0, coverage: 1.0, is_available: true } as unknown as T;
    }
    if (command === 'ai_key_status') return false as unknown as T;
    if (command === 'ai_list_models') return ['bge-m3'] as unknown as T;
    throw new Error(`Comando '${command}' non disponibile in anteprima browser`);
  }
  return invoke<T>(command, args);
}

export const aiIpc = {
  models: () => call<string[]>('ai_list_models'),
  status: () => call<boolean>('ai_key_status'),
  saveKey: (key: string) => call<void>('ai_save_key', { key }),
  deleteKey: () => call<void>('ai_delete_key'),
  preview: (vaultPath: string, options: AiOptions) => call<AiPreview>('ai_preview', { vaultPath, options }),
  ask: (ticket: string) => call<AiAnswer>('ai_ask', { ticket }),
  cancel: (ticket: string) => call<void>('ai_cancel', { ticket }),
  read: (vaultPath: string, s: Omit<AiSource, 'content'>, includeDrafts: boolean) =>
    call<AiSource>('ai_read_source', { vaultPath, documentId: s.documentId, sha256: s.sha256, includeDrafts }),
  mcpStatus: () => call<{ active: boolean; endpoint?: string; vaultId?: string }>('mcp_status'),
  mcpStart: (vaultPath: string, includeDrafts: boolean) =>
    call<{ endpoint: string; token: string; vaultId: string }>('mcp_start', { vaultPath, includeDrafts }),
  mcpStop: () => call<void>('mcp_stop'),
  tunnelStop: () => call<void>('tunnel_stop'),

  // Semantic & Local RAG IPC methods (Gate A04 / Compito 1)
  embeddingsGetProvider: (vaultPath: string) => call<EmbeddingsProviderReport>('embeddings_get_provider', { vaultPath }),
  embeddingsSetProvider: (vaultPath: string, provider: 'local' | 'openai') =>
    call<EmbeddingsProviderReport>('embeddings_set_provider', { vaultPath, provider }),
  localModelStatus: () => call<LocalModelReport>('local_model_status'),
  localModelDownload: () => call<LocalModelReport>('local_model_download'),
  localModelSelectFile: (filePath: string) => call<LocalModelReport>('local_model_select_file', { filePath }),
  localModelPickAndInstall: () => call<LocalModelReport>('local_model_pick_and_install'),
  localServerStart: () => call<LocalServerReport>('local_server_start'),
  localServerStop: () => call<LocalServerReport>('local_server_stop'),
  localServerStatus: () => call<LocalServerReport>('local_server_status'),
  embeddingsCancelSync: () => call<void>('embeddings_cancel_sync'),
  embeddingsSyncVault: (vaultPath: string, apiKey?: string, model?: string) =>
    call<any>('embeddings_sync_vault', { vaultPath, apiKey: apiKey ?? null, model: model ?? null }),
};
