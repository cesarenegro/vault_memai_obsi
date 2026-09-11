import type { Frontmatter } from '@limen-vault/vault-schema';

export interface ProposalItem {
  id: string;
  title: string;
  targetCategory: string;
  proposedContent: string;
  metadata: Frontmatter;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ProposalEngineContract {
  createProposal(proposal: Omit<ProposalItem, 'id' | 'createdAt' | 'status'>): Promise<ProposalItem>;
  listProposals(): Promise<ProposalItem[]>;
  /**
   * Promotes an approved proposal to Approved Knowledge (Human-in-the-loop action only).
   */
  approveProposal(proposalId: string): Promise<boolean>;
}
