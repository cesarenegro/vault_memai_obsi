export type AuthorizedAIProvider = 'openai' | 'codex' | 'local_future';

export interface AIQueryOptions {
  provider: AuthorizedAIProvider;
  model?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  sourceIds?: string[];
}

export interface AIQueryResult {
  answer: string;
  provider: AuthorizedAIProvider;
  model: string;
  citations: string[];
  tokensUsed?: number;
}

export interface AIEngineContract {
  isConfigured(): boolean;
  askKnowledge(options: AIQueryOptions): Promise<AIQueryResult>;
}
