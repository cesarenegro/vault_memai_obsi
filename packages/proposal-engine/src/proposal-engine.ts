import fs from 'fs';
import path from 'path';
import { sanitizeVaultPath, validateSymlinkSafety } from './path-safety.js';
import { buildFrontmatterYaml, parseFrontmatter } from './frontmatter-utils.js';
import { loadProposalIndex, saveProposalIndex, computeSha256 } from './proposal-store.js';
import { ProposalItem, ProposalWorkflowStatus } from './index.js';

export async function createProposal(
  vaultRoot: string,
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
): Promise<ProposalItem> {
  const now = new Date().toISOString();
  const stem = params.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safeStem = stem || 'proposal';

  const proposalHash = computeSha256(`${params.title}:${params.content}:${now}`).slice(0, 10);
  const proposalId = `prop_${proposalHash}`;
  const relativePath = `90_PROPOSALS/${safeStem}_${proposalHash.slice(0, 6)}.md`;

  const absPath = sanitizeVaultPath(vaultRoot, relativePath);
  validateSymlinkSafety(vaultRoot, relativePath);

  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tags = params.tags || ['proposal'];

  const frontmatterYaml = buildFrontmatterYaml({
    schema_version: 1,
    id: proposalId,
    title: params.title,
    type: params.category,
    client: params.client,
    project: params.project,
    brand: params.brand,
    status: 'draft', // MANDATORY frontmatter status
    source_ids: [params.sourceOutputId || params.sourceRawId].filter(Boolean) as string[],
    created_at: now,
    updated_at: now,
    tags,
    revision: 1,
  });

  const markdown = `${frontmatterYaml}\n\n# ${params.title}\n\n${params.content.trim()}\n`;
  fs.writeFileSync(absPath, markdown, 'utf-8');

  const fileSha256 = computeSha256(markdown);

  const item: ProposalItem = {
    id: proposalId,
    relativePath,
    title: params.title,
    category: params.category,
    client: params.client,
    project: params.project,
    brand: params.brand,
    tags,
    frontmatterStatus: 'draft',
    workflowStatus: 'pending',
    sourceOutputId: params.sourceOutputId,
    sourceRawId: params.sourceRawId,
    revision: 1,
    revisionsHistory: [
      {
        revision: 1,
        sha256: fileSha256,
        createdAt: now,
        note: 'Initial proposal created',
      },
    ],
    createdAt: now,
    updatedAt: now,
    sha256: fileSha256,
    markdown,
  };

  const index = loadProposalIndex(vaultRoot);
  index.proposals[proposalId] = item;
  saveProposalIndex(vaultRoot, index);

  return item;
}

export async function listProposals(
  vaultRoot: string,
  filter?: { workflowStatus?: ProposalWorkflowStatus; category?: string }
): Promise<ProposalItem[]> {
  const index = loadProposalIndex(vaultRoot);
  let items = Object.values(index.proposals);

  if (filter?.workflowStatus) {
    items = items.filter((p) => p.workflowStatus === filter.workflowStatus);
  }
  if (filter?.category) {
    items = items.filter((p) => p.category === filter.category);
  }

  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items;
}

export async function getProposal(
  vaultRoot: string,
  proposalId: string
): Promise<ProposalItem | null> {
  const index = loadProposalIndex(vaultRoot);
  const item = index.proposals[proposalId];
  if (!item) return null;

  // Refresh content from disk if file exists
  try {
    const absPath = sanitizeVaultPath(vaultRoot, item.relativePath);
    if (fs.existsSync(absPath)) {
      const diskMarkdown = fs.readFileSync(absPath, 'utf-8');
      const diskSha = computeSha256(diskMarkdown);
      item.markdown = diskMarkdown;
      item.sha256 = diskSha;
    }
  } catch (_) {}

  return item;
}

export async function updateProposalRevision(
  vaultRoot: string,
  proposalId: string,
  updatedContent: string,
  revisionNote?: string
): Promise<ProposalItem> {
  const index = loadProposalIndex(vaultRoot);
  const item = index.proposals[proposalId];
  if (!item) {
    throw new Error(`Proposal '${proposalId}' does not exist.`);
  }

  const now = new Date().toISOString();
  const nextRevision = item.revision + 1;

  const absPath = sanitizeVaultPath(vaultRoot, item.relativePath);
  validateSymlinkSafety(vaultRoot, item.relativePath);

  const parsed = parseFrontmatter(updatedContent);
  const frontmatterYaml = buildFrontmatterYaml({
    schema_version: (parsed.frontmatter.schema_version as number) || 1,
    id: item.id,
    title: parsed.frontmatter.title || item.title,
    type: parsed.frontmatter.type || item.category,
    client: parsed.frontmatter.client || item.client,
    project: parsed.frontmatter.project || item.project,
    brand: parsed.frontmatter.brand || item.brand,
    status: item.frontmatterStatus || 'draft',
    source_ids: parsed.frontmatter.source_ids || [item.sourceOutputId || item.sourceRawId].filter(Boolean) as string[],
    created_at: item.createdAt,
    updated_at: now,
    tags: parsed.frontmatter.tags || item.tags,
    revision: nextRevision,
  });

  const markdown = `${frontmatterYaml}\n\n${parsed.body}\n`;
  fs.writeFileSync(absPath, markdown, 'utf-8');

  const fileSha256 = computeSha256(markdown);

  item.revision = nextRevision;
  item.updatedAt = now;
  item.sha256 = fileSha256;
  item.markdown = markdown;
  item.revisionsHistory.push({
    revision: nextRevision,
    sha256: fileSha256,
    createdAt: now,
    note: revisionNote || `Updated to revision ${nextRevision}`,
  });

  index.proposals[proposalId] = item;
  saveProposalIndex(vaultRoot, index);

  return item;
}

export async function rejectProposal(
  vaultRoot: string,
  proposalId: string,
  rejectionReason: string
): Promise<ProposalItem> {
  const index = loadProposalIndex(vaultRoot);
  const item = index.proposals[proposalId];
  if (!item) {
    throw new Error(`Proposal '${proposalId}' does not exist.`);
  }

  const now = new Date().toISOString();
  item.workflowStatus = 'rejected';
  item.rejectionReason = rejectionReason;
  item.updatedAt = now;

  index.proposals[proposalId] = item;
  saveProposalIndex(vaultRoot, index);

  return item;
}
