export type AuthorizedAIProvider = 'openai' | 'codex' | 'local_future';

export interface AICitation {
  documentId: string;
  relativePath: string;
  title: string;
  category: string;
  status?: string;
  sha256?: string;
  snippet?: string;
}

export interface AIQueryOptions {
  vaultPath?: string;
  signal?: AbortSignal;
  provider: AuthorizedAIProvider;
  model?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  sourceIds?: string[];
  categoryFilter?: string;
  clientFilter?: string;
  projectFilter?: string;
  tagsFilter?: string[];
  includeRawAndDrafts?: boolean;
}

export interface AIQueryResult {
  answer: string;
  provider: AuthorizedAIProvider;
  model: string;
  citations: AICitation[];
  tokensUsed?: number;
  latencyMs?: number;
}

export interface MCPToolCall {
  id: string;
  name: 'list_vaults' | 'search_vault' | 'read_document';
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  callId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface MCPSessionStatus {
  active: boolean;
  channel: 'chatgpt_business' | 'codex_local' | 'unconnected';
  authenticated: boolean;
  connectedAt?: string;
  vaultPath?: string;
}

export interface AIEngineContract {
  isConfigured(): boolean;
  askKnowledge(options: AIQueryOptions): Promise<AIQueryResult>;
}

export * from './context-selector.js';
export * from './openai-adapter.js';
export * from './mcp-service.js';
