import fs from 'fs';
import path from 'path';
import { sanitizeVaultPath, validateSymlinkSafety } from './path-safety.js';
import { buildFrontmatterYaml, parseFrontmatter } from './frontmatter-utils.js';
import { loadProposalIndex, saveProposalIndex, computeSha256 } from './proposal-store.js';
import { ProposalDecision, ApprovalResult } from './index.js';

const APPROVED_CATEGORY_DIRS: Record<string, string> = {
  client: '01_CLIENTS',
  project: '02_PROJECTS',
  brand: '03_BRANDS',
  positioning: '04_POSITIONING',
  packaging: '05_PACKAGING_KNOWLEDGE',
  method: '06_METHODS',
  case_study: '07_CASE_STUDIES',
  research: '08_MARKET_RESEARCH',
};

export async function approveProposal(
  vaultRoot: string,
  decision: ProposalDecision
): Promise<ApprovalResult> {
  try {
    const index = loadProposalIndex(vaultRoot);
    const item = index.proposals[decision.proposalId];

    if (!item) {
      return {
        success: false,
        proposalId: decision.proposalId,
        error: `Proposal '${decision.proposalId}' not found in index.`,
      };
    }

    if (decision.decision !== 'approve' || item.workflowStatus !== 'pending' || decision.revision !== item.revision) {
      throw new Error('Conflict detected: approval requires the current pending revision and an approve decision.');
    }
    if (!/^[a-f0-9]{64}$/.test(decision.expectedSha256 || '')) {
      return { success: false, proposalId: decision.proposalId, conflictDetected: true, error: 'Conflict detected: a valid reviewed SHA-256 is required.' };
    }
    if (!item.relativePath.startsWith('90_PROPOSALS/')) throw new Error('Invalid proposal source path');

    const proposalAbsPath = sanitizeVaultPath(vaultRoot, item.relativePath);
    validateSymlinkSafety(vaultRoot, item.relativePath);

    if (!fs.existsSync(proposalAbsPath)) {
      return {
        success: false,
        proposalId: decision.proposalId,
        error: `Proposal file '${item.relativePath}' missing from disk.`,
      };
    }

    // Byte Verification: check SHA-256 of current disk content against expectedSha256
    const currentMarkdown = fs.readFileSync(proposalAbsPath, 'utf-8');
    const currentSha256 = computeSha256(currentMarkdown);

    if (decision.expectedSha256 && currentSha256 !== decision.expectedSha256) {
      return {
        success: false,
        proposalId: decision.proposalId,
        conflictDetected: true,
        error: `Conflict detected: Proposal content was modified on disk since last review (expected ${decision.expectedSha256.slice(0, 10)}, got ${currentSha256.slice(0, 10)}).`,
      };
    }

    // Determine approved target category and directory
    const categoryKey = (decision.targetCategory || item.category).toLowerCase();
    const categoryDir = APPROVED_CATEGORY_DIRS[categoryKey];

    if (!categoryDir) {
      return {
        success: false,
        proposalId: decision.proposalId,
        error: `Invalid approved target category: '${categoryKey}'. Must be an official approved category (01_CLIENTS to 08_RESEARCH).`,
      };
    }

    const parsedStem = path.parse(item.relativePath).name.replace(/_draft|_prop.*/g, '');
    const defaultTargetRel = `${categoryDir}/${parsedStem}.md`;
    const targetRelPath = decision.targetRelativePath || defaultTargetRel;

    const components = targetRelPath.split('/');
    if (components[0] !== categoryDir || components.length < 2 || components.some(p => !p || p.startsWith('.')) || targetRelPath.includes('\\') || !targetRelPath.endsWith('.md')) {
      throw new Error('Approval target must be Markdown inside the selected official category.');
    }

    const targetAbsPath = sanitizeVaultPath(vaultRoot, targetRelPath);
    validateSymlinkSafety(vaultRoot, targetRelPath);

    // Collision check: refuse silent overwrite of existing approved notes
    if (fs.existsSync(targetAbsPath) && !decision.allowOverwrite) {
      return {
        success: false,
        proposalId: decision.proposalId,
        conflictDetected: true,
        error: `Target document '${targetRelPath}' already exists. Silent overwrite is forbidden in M7. Set allowOverwrite: true to explicitly overwrite.`,
      };
    }

    // Parse proposal note & transition frontmatter status to "approved"
    const parsed = parseFrontmatter(currentMarkdown);
    const now = new Date().toISOString();

    const approvedFrontmatterYaml = buildFrontmatterYaml({
      schema_version: (parsed.frontmatter.schema_version as number) || 1,
      id: parsed.frontmatter.id || item.id,
      title: parsed.frontmatter.title || item.title,
      type: categoryKey,
      client: parsed.frontmatter.client || item.client,
      project: parsed.frontmatter.project || item.project,
      brand: parsed.frontmatter.brand || item.brand,
      status: 'approved', // MANDATORY: transition status to approved upon human publication
      source_ids: parsed.frontmatter.source_ids || [item.sourceOutputId || item.sourceRawId].filter(Boolean) as string[],
      created_at: item.createdAt,
      updated_at: now,
      tags: parsed.frontmatter.tags || item.tags,
      revision: item.revision,
    });

    const targetMarkdown = `${approvedFrontmatterYaml}\n\n${parsed.body}\n`;

    const targetDir = path.dirname(targetAbsPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Write published note atomically to approved folder
    const tempTarget = `${targetAbsPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempTarget, targetMarkdown, 'utf-8');
    fs.renameSync(tempTarget, targetAbsPath);

    const publishedSha256 = computeSha256(targetMarkdown);

    // Update workflow decision & status in PROPOSAL_INDEX.json
    item.workflowStatus = 'approved';
    item.updatedAt = now;
    index.proposals[decision.proposalId] = item;
    index.decisions[decision.proposalId] = decision;

    saveProposalIndex(vaultRoot, index);

    return {
      success: true,
      proposalId: decision.proposalId,
      targetRelativePath: targetRelPath,
      publishedSha256,
    };
  } catch (err) {
    return {
      success: false,
      proposalId: decision.proposalId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
