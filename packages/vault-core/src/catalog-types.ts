export interface DocumentPassage {
  passageId: string;
  locator: string;
  text: string;
  charCount: number;
  sha256: string;
}

export interface ImportReceipt {
  name: string;
  path?: string | null;
  status: 'imported' | 'duplicate' | 'error';
  error?: string | null;
  documentId?: string | null;
  hash?: string | null;
  sizeBytes?: number | null;
}

export type ExtractionStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'unsupported'
  | 'protected'
  | 'failed';

export type PhaseState = 'pending' | 'processing' | 'ready' | 'skipped' | 'failed';

export interface PhaseInfo {
  status: PhaseState;
  attempts: number;
  error?: string | null;
  updatedAt: string;
}

export interface DocumentRecord {
  documentId: string;
  revision: number;
  contentHash: string;
  originalPath: string;
  aliases: string[];
  fileName: string;
  extension: string;
  fileSize: number;
  mimeType: string;
  importedAt: string;
  updatedAt: string;
  extractionStatus: ExtractionStatus;
  extractionError?: string | null;
  extractedTextPath?: string | null;
  extractedTextHash?: string | null;
  passages: DocumentPassage[];
  lexicalStatus: PhaseInfo;
  semanticStatus: PhaseInfo;
  classificationStatus: PhaseInfo;
  wikiStatus: PhaseInfo;
  category?: string | null;
  client?: string | null;
  project?: string | null;
  tags: string[];
  evidenceType: string;
  editorialStatus: string;
}

export interface EmbeddingsStatusReport {
  totalPassages: number;
  cachedPassages: number;
  missingPassages: number;
  coverage: number;
  model: string;
  dimensions: number;
  isAvailable: boolean;
  lastUpdatedAt: string;
}
