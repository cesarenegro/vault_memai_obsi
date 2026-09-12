import type { Frontmatter, KnowledgeCategory } from '@limen-vault/vault-schema';

export const COMPILER_VERSION = '0.2.0';

export interface ProvenanceRecord {
  source_relative_path: string;
  source_id: string;
  sha256: string;
  first_compiled_at: string;
  last_compiled_at: string;
  compiler_version: string;
  draft_relative_path?: string;
}

export interface CompilerIndex {
  version: number;
  records: Record<string, ProvenanceRecord>;
}

export type CompilationStatus = 'compiled' | 'unchanged' | 'unsupported' | 'error';

export interface CompilationItemResult {
  source_relative_path: string;
  status: CompilationStatus;
  draft_relative_path?: string;
  frontmatter?: Frontmatter;
  error?: string;
}

export interface BatchCompilerReport {
  compiled_count: number;
  unchanged_count: number;
  unsupported_count: number;
  error_count: number;
  items: CompilationItemResult[];
}

export interface CompileOptions {
  categoryProposal?: KnowledgeCategory;
  forceRecompile?: boolean;
}

export interface KnowledgeCompilerContract {
  compileSourceToDraft(
    vaultRoot: string,
    relativeSourcePath: string,
    options?: CompileOptions
  ): Promise<CompilationItemResult>;
  batchCompile(
    vaultRoot: string,
    options?: CompileOptions
  ): Promise<BatchCompilerReport>;
}

export * from './provenance.js';
export * from './extractor.js';
export * from './compiler.js';
