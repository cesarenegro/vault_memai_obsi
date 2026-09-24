import {invoke} from '@tauri-apps/api/core';

export interface ConversationTurn {
  question: string;
  answer: string;
}

export interface AiOptions {
  prompt: string;
  model: string;
  includeDrafts: boolean;
  sourceIds: string[];
  category?: string;
  client?: string;
  project?: string;
  tags?: string[];
  conversationId?: string;
  turnIndex?: number;
  parentEntryId?: string;
  previousTurns?: ConversationTurn[];
  previousQuestion?: string;
}
export interface AiSource {documentId:string;relativePath:string;title:string;category:string;status?:string;sha256:string;content:string;locator?:string;passageId?:string;revision?:number;passageHashes?:[string,string][]}
export interface AiPreview {
  ticket: string;
  sources: AiSource[];
  contextBytes: number;
  semanticUsed?: boolean;
  semanticFallbackReason?: string;
}
export interface AiAnswer {
  answer: string;
  provider: string;
  model: string;
  status?: string;
  incomplete?: boolean;
  incompleteReason?: string;
  warning?: string;
  citations: Omit<AiSource, 'content'>[];
  citedIndices?: number[];
  tokensUsed?: number;
  tokensPrompt?: number;
  tokensCompletion?: number;
  tokensReasoning?: number;
  uiTotalMs?: number;
  semanticUsed?: boolean;
  semanticFallbackReason?: string;
  historyEntryId?: string;
  conversationId?: string;
  turnIndex?: number;
}

export interface AiStreamChunkPayload {
  ticket: string;
  delta: string;
  fullText: string;
}

export interface AiStreamEndPayload {
  ticket: string;
  answer: string;
  citations: Omit<AiSource, 'content'>[];
  citedIndices?: number[];
  status: string;
  incomplete?: boolean;
  incompleteReason?: string;
  warning?: string;
  error?: string;
  cancelled?: boolean;
  tokensUsed?: number;
  tokensPrompt?: number;
  tokensCompletion?: number;
  tokensReasoning?: number;
  semanticUsed?: boolean;
  semanticFallbackReason?: string;
  historyEntryId?: string;
  conversationId?: string;
  turnIndex?: number;
}

export interface EmbeddingsProviderReport {
  provider: 'local' | 'openai';
  model: string;
  dimensions: number;
  endpoint: string;
  cacheDimensions: number;
  cacheEntries: number;
  totalPassages: number;
  matchedPassages: number;
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
  starting?: boolean;
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
  totalPassages: 9458,
  matchedPassages: 9458,
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

let mockConsent = true;

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!('__TAURI_INTERNALS__' in window)) {
    // Browser preview fallback mode for headless verification / screenshot capture
    if (command === 'ai_get_consent') return mockConsent as unknown as T;
    if (command === 'ai_set_consent') {
      mockConsent = Boolean(args?.granted);
      return undefined as unknown as T;
    }
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
    if (command === 'local_model_status' || command === 'local_model_verify_integrity') return mockModel as unknown as T;
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
    if (command === 'ai_list_models') return [] as unknown as T;
    if (command === 'ai_get_selected_model') {
      return (localStorage.getItem('limen_selected_ai_model') || null) as unknown as T;
    }
    if (command === 'ai_save_selected_model') {
      const m = (args as any)?.model || '';
      localStorage.setItem('limen_selected_ai_model', m);
      return undefined as unknown as T;
    }
    if (command === 'ai_preview') {
      return {
        ticket: 't_mock_123',
        contextBytes: 3420,
        sources: [
          {
            documentId: 'doc_bnxt_spec_p0',
            relativePath: '01_CLIENTS/BNXT_Specifiche.md',
            title: 'Progetto BNXT — Specifiche Tecniche',
            category: 'client',
            status: 'approved',
            sha256: '4a8b7c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
            content: '[Sezione 1] Il progetto BNXT è un sistema di architettura modulare per la gestione della conoscenza aziendale con crittografia end-to-end e consenso esplicito.',
            locator: '## Sezione 1',
            passageId: 'doc_bnxt_spec_p0'
          },
          {
            documentId: 'doc_scena_arch_p1',
            relativePath: '02_PROJECTS/SCENA_Architettura.md',
            title: 'Progetto SCENA — Guida Utente e Moduli',
            category: 'project',
            status: 'approved',
            sha256: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
            content: '[## Moduli] Il progetto SCENA comprende le applicazioni PWA Studente, PWA Admin e Scena Hub per la coordinazione del personale.',
            locator: '## Moduli',
            passageId: 'doc_scena_arch_p1'
          }
        ]
      } as unknown as T;
    }
    if (command === 'ai_ask' || command === 'ai_ask_stream') {
      return {
        answer: 'Il progetto BNXT è una piattaforma di conoscenza aziendale modulare con crittografia end-to-end e gestione granulare del consenso degli utenti. Integra la ricerca ibrida locale per garantire che nessun dato venga trasmesso all\'esterno senza autorizzazione.',
        provider: 'OpenAI',
        model: 'gpt-4o',
        tokensUsed: 412,
        citations: [
          {
            documentId: 'doc_bnxt_spec_p0',
            relativePath: '01_CLIENTS/BNXT_Specifiche.md',
            title: 'Progetto BNXT — Specifiche Tecniche',
            category: 'client',
            status: 'approved',
            sha256: '4a8b7c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
            locator: '## Sezione 1',
            passageId: 'doc_bnxt_spec_p0'
          }
        ]
      } as unknown as T;
    }
    throw new Error(`Comando '${command}' non disponibile in anteprima browser`);
  }
  return invoke<T>(command, args);
}

export const aiIpc = {
  getConsent: (vaultPath: string) => call<boolean>('ai_get_consent', { vaultPath }),
  setConsent: (vaultPath: string, granted: boolean) => call<void>('ai_set_consent', { vaultPath, granted }),
  models: () => call<string[]>('ai_list_models'),
  getSelectedModel: () => call<string | null>('ai_get_selected_model'),
  saveSelectedModel: (model: string) => call<void>('ai_save_selected_model', { model }),
  status: () => call<boolean>('ai_key_status'),
  saveKey: (key: string) => call<void>('ai_save_key', { key }),
  deleteKey: () => call<void>('ai_delete_key'),
  preview: (vaultPath: string, options: AiOptions) => call<AiPreview>('ai_preview', { vaultPath, options }),
  ask: (ticket: string, uiElapsedMs?: number) => call<AiAnswer>('ai_ask', { ticket, uiElapsedMs }),
  askStream: (ticket: string, uiElapsedMs?: number) => call<AiAnswer>('ai_ask_stream', { ticket, uiElapsedMs }),
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
  localModelVerifyIntegrity: () => call<LocalModelReport>('local_model_verify_integrity'),
  localServerStart: () => call<LocalServerReport>('local_server_start'),
  localServerStop: () => call<LocalServerReport>('local_server_stop'),
  localServerStatus: () => call<LocalServerReport>('local_server_status'),
  embeddingsCancelSync: () => call<void>('embeddings_cancel_sync'),
  embeddingsSyncVault: (vaultPath: string, apiKey?: string, model?: string) =>
    call<any>('embeddings_sync_vault', { vaultPath, apiKey: apiKey ?? null, model: model ?? null }),
};
