import type { KnowledgeCategory, Frontmatter } from '@limen-vault/vault-schema';

export const SEARCH_INDEX_VERSION = 2;

export interface SearchQuery {
  term?: string;
  category?: KnowledgeCategory;
  client?: string;
  project?: string;
  tags?: string[];
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  relativePath: string;
  category: KnowledgeCategory;
  client?: string;
  project?: string;
  tags: string[];
  status?: string;
  snippet: string;
  score: number;
  updatedAt?: string;
  sha256: string;
}

export interface IndexStatusReport {
  state: 'missing' | 'ready' | 'outdated';
  total_indexed: number;
  last_indexed_at: string;
  version: number;
  indexed_categories: Record<string, number>;
}

export interface SearchDocumentRecord {
  id: string;
  note_id?: string;
  relative_path: string;
  sha256: string;
  mtime_ms: number;
  title: string;
  category: KnowledgeCategory;
  client?: string;
  project?: string;
  brand?: string;
  tags: string[];
  status?: string;
  created_at: string;
  updated_at: string;
  tokens: string[]; // tokenized term frequencies or raw tokens
  content_preview: string;
}

export interface SearchIndexData {
  version: number;
  last_indexed_at: string;
  documents: Record<string, SearchDocumentRecord>; // relative_path -> document
}

export interface SearchEngineContract {
  indexVault(vaultPath: string): Promise<IndexStatusReport>;
  search(vaultPath: string, query: SearchQuery): Promise<SearchResultItem[]>;
  getIndexStatus(vaultPath: string): Promise<IndexStatusReport>;
}

export * from './tokenizer.js';
export * from './index-store.js';
export * from './search-engine.js';
