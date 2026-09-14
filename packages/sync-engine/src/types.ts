/**
 * Core type definitions for LIMEN Vault Sync Engine (Milestone M10).
 * Governs private backup archives and approved-only published releases.
 */

export type SyncChannel = 'private' | 'published';

export interface SyncProfile {
  schemaVersion: number;
  vaultId: string;
  deviceId: string;
  endpoint?: string;
  tenantId?: string;
  lastCommit?: {
    releaseId: string;
    channel: SyncChannel;
    committedAt: string;
    manifestHash: string;
  };
}

export interface SyncDocumentItem {
  id: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  category: string;
  status: string;
  objectRef: string;
  title?: string;
  client?: string;
  project?: string;
  updatedAt?: string;
}

export interface ReleaseManifest {
  schemaVersion: number;
  channel: SyncChannel;
  tenantId: string;
  vaultId: string;
  releaseId: string;
  parentReleaseId?: string | null;
  createdAt: string;
  deviceId: string;
  formatVersion: number;
  documents: SyncDocumentItem[];
  manifestHash: string;
}

export interface UploadPlan {
  operationId: string;
  channel: SyncChannel;
  baseReleaseId?: string | null;
  candidateReleaseId: string;
  totalDocuments: number;
  totalBytes: number;
  includedPaths: string[];
  excludedPaths: string[];
  missingObjects: {
    sha256: string;
    relativePath: string;
    sizeBytes: number;
  }[];
  manifest: ReleaseManifest;
}

export interface InspectionResult {
  operationId: string;
  channel: SyncChannel;
  vaultRoot: string;
  vaultId: string;
  eligibleDocuments: SyncDocumentItem[];
  includedPaths: string[];
  excludedPaths: string[];
  totalBytes: number;
  errors: string[];
}

export interface DownloadPlan {
  operationId: string;
  channel: SyncChannel;
  releaseId: string;
  manifest: ReleaseManifest;
  missingLocalObjects: string[];
  stagingPath: string;
  totalBytesToFetch: number;
}

export interface VerificationResult {
  isValid: boolean;
  checkedCount: number;
  corruptedCount: number;
  missingCount: number;
  errors: string[];
}

export interface AuthorizedVaultInfo {
  vaultId: string;
  vaultName: string;
  currentReleaseId: string;
  publishedAt: string;
  documentCount: number;
}

export interface KnowledgeSearchResult {
  documentId: string;
  relativePath: string;
  category: string;
  title: string;
  snippet: string;
  sha256: string;
  client?: string;
  project?: string;
}

export interface AiContextItem {
  documentId: string;
  relativePath: string;
  title: string;
  content: string;
  sha256: string;
  releaseId: string;
  client?: string;
  project?: string;
}
