import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sanitizeVaultPath, validateSymlinkSafety } from './path-safety.js';
import { AIOutputItem, ProposalItem, ProposalDecision } from './index.js';

export const PROPOSAL_INDEX_RELATIVE_PATH = '00_SYSTEM/PROPOSAL_INDEX.json';

export interface ProposalIndexData {
  version: number;
  last_updated_at: string;
  outputs: Record<string, AIOutputItem>;
  proposals: Record<string, ProposalItem>;
  decisions: Record<string, ProposalDecision>;
}

export function computeSha256(content: string | Buffer): string {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function loadProposalIndex(vaultRoot: string): ProposalIndexData {
  const indexAbsPath = sanitizeVaultPath(vaultRoot, PROPOSAL_INDEX_RELATIVE_PATH);
  if (!fs.existsSync(indexAbsPath)) {
    return {
      version: 1,
      last_updated_at: new Date(0).toISOString(),
      outputs: {},
      proposals: {},
      decisions: {},
    };
  }
  validateSymlinkSafety(vaultRoot, PROPOSAL_INDEX_RELATIVE_PATH);
  const parsed = JSON.parse(fs.readFileSync(indexAbsPath, 'utf-8'));
  const record = (x: unknown) => typeof x === 'object' && x !== null && !Array.isArray(x);
  if (parsed.version !== 1 || !record(parsed.outputs) || !record(parsed.proposals) || !record(parsed.decisions) || typeof parsed.last_updated_at !== 'string') {
    throw new Error('Invalid proposal index; preserve it and recover explicitly.');
  }
  return parsed;

}

export function saveProposalIndex(vaultRoot: string, data: ProposalIndexData): void {
  const indexAbsPath = sanitizeVaultPath(vaultRoot, PROPOSAL_INDEX_RELATIVE_PATH);
  validateSymlinkSafety(vaultRoot, PROPOSAL_INDEX_RELATIVE_PATH);
  const dir = path.dirname(indexAbsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  data.last_updated_at = new Date().toISOString();
  // Atomic write using temp file
  const tempPath = `${indexAbsPath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, indexAbsPath);
}
