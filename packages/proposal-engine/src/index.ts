export type ProposalWorkflowStatus = 'pending' | 'approved' | 'rejected';
export type ProposalFrontmatterStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface AICitationSource {
  documentId: string;
  relativePath: string;
  title: string;
  category: string;
  sha256?: string;
  snippet?: string;
}

export interface AIOutputItem {
  id: string;
  relativePath: string;
  prompt: string;
  response: string;
  provider: string;
  model: string;
  sources: AICitationSource[];
  savedAt: string;
  sha256: string;
}

export interface ProposalRevisionRecord {
  revision: number;
  sha256: string;
  createdAt: string;
  note?: string;
}

export interface ProposalItem {
  id: string;
  relativePath: string;
  title: string;
  category: string;
  client?: string;
  project?: string;
  brand?: string;
  tags: string[];
  frontmatterStatus: ProposalFrontmatterStatus;
  workflowStatus: ProposalWorkflowStatus;
  rejectionReason?: string;
  sourceOutputId?: string;
  sourceRawId?: string;
  revision: number;
  revisionsHistory: ProposalRevisionRecord[];
  createdAt: string;
  updatedAt: string;
  sha256: string;
  markdown: string;
}

export interface ProposalDecision {
  proposalId: string;
  revision: number;
  expectedSha256: string;
  decision: 'approve' | 'reject';
  rejectionReason?: string;
  targetCategory?: string;
  targetRelativePath?: string;
  allowOverwrite?: boolean;
}

export interface ApprovalResult {
  success: boolean;
  proposalId: string;
  targetRelativePath?: string;
  publishedSha256?: string;
  error?: string;
  conflictDetected?: boolean;
}

export interface ProposalEngineContract {
  saveAIOutput(
    vaultPath: string,
    prompt: string,
    response: string,
    provider: string,
    model: string,
    sources: AICitationSource[]
  ): Promise<AIOutputItem>;

  listAIOutputs(vaultPath: string): Promise<AIOutputItem[]>;

  createProposal(
    vaultPath: string,
    params: {
      title: string;
      category: string;
      content: string;
      client?: string;
      project?: string;
      brand?: string;
      tags?: string[];
      sourceOutputId?: string;
      sourceRawId?: string;
    }
  ): Promise<ProposalItem>;

  listProposals(
    vaultPath: string,
    filter?: { workflowStatus?: ProposalWorkflowStatus; category?: string }
  ): Promise<ProposalItem[]>;

  getProposal(vaultPath: string, proposalId: string): Promise<ProposalItem | null>;

  updateProposalRevision(
    vaultPath: string,
    proposalId: string,
    updatedContent: string,
    revisionNote?: string
  ): Promise<ProposalItem>;

  rejectProposal(
    vaultPath: string,
    proposalId: string,
    rejectionReason: string
  ): Promise<ProposalItem>;

  approveProposal(
    vaultPath: string,
    decision: ProposalDecision
  ): Promise<ApprovalResult>;
}

// Legacy v1 interfaces above are retained for reading historical integration documents.
// Production writes use the native v2 workflow through an explicit local transport.
export * from './workflow.js';
