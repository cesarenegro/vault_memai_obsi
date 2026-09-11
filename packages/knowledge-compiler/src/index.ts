import type { KnowledgePage } from '@limen-vault/vault-schema';

export interface CompilerOptions {
  sourcePaths: string[];
  outputPath: string;
}

export interface KnowledgeCompilerContract {
  compileSourceToPage(sourcePath: string): Promise<KnowledgePage>;
  batchCompile(options: CompilerOptions): Promise<{ compiledCount: number }>;
}
