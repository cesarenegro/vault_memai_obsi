import type { KnowledgeCategory } from '@limen-vault/vault-schema';

export interface SearchQuery {
  term: string;
  category?: KnowledgeCategory;
  client?: string;
  project?: string;
  tags?: string[];
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  relativePath: string;
  category: KnowledgeCategory;
  snippet: string;
  score: number;
}

export interface SearchEngineContract {
  indexVault(vaultPath: string): Promise<{ indexedCount: number }>;
  search(query: SearchQuery): Promise<SearchResultItem[]>;
}
