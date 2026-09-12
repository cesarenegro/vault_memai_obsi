import fs from 'fs';
import path from 'path';
import { sanitizeVaultPath, validateSymlinkSafety } from './path-safety.js';
import { buildFrontmatterYaml } from './frontmatter-utils.js';
import { loadProposalIndex, saveProposalIndex, computeSha256 } from './proposal-store.js';
import { AIOutputItem, AICitationSource } from './index.js';

export function sanitizeCredentials(text: string): string {
  let clean = text;
  // Redact Bearer tokens / API keys if any slip through
  clean = clean.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_API_KEY]');
  clean = clean.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]');
  return clean;
}

export async function saveAIOutput(
  vaultRoot: string,
  prompt: string,
  response: string,
  provider: string,
  model: string,
  sources: AICitationSource[] = []
): Promise<AIOutputItem> {
  const sanitizedPrompt = sanitizeCredentials(prompt);
  const sanitizedResponse = sanitizeCredentials(response);
  const now = new Date().toISOString();

  const contentHash = computeSha256(`${sanitizedPrompt}:${sanitizedResponse}:${now}`);
  const outputId = `out_${contentHash.slice(0, 12)}`;

  const promptStem = sanitizedPrompt
    .slice(0, 30)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safeName = promptStem || 'ai_response';

  const relativePath = `80_AI_OUTPUTS/${safeName}_${outputId.slice(4, 10)}.md`;
  const absPath = sanitizeVaultPath(vaultRoot, relativePath);
  validateSymlinkSafety(vaultRoot, relativePath);

  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sourceIds = sources.map((s) => s.documentId || s.relativePath);

  const frontmatterYaml = buildFrontmatterYaml({
    schema_version: 1,
    id: outputId,
    title: `AI Output: ${safeName.replace(/_/g, ' ')}`,
    type: 'ai_output',
    status: 'draft', // MANDATORY: AI output remains draft in 80_AI_OUTPUTS
    source_ids: sourceIds,
    created_at: now,
    updated_at: now,
    tags: ['ai_output', provider],
  });

  const markdownContent = `${frontmatterYaml}\n\n# AI Response (${provider} / ${model})\n\n> **Prompt:** ${sanitizedPrompt}\n\n${sanitizedResponse}\n`;

  fs.writeFileSync(absPath, markdownContent, 'utf-8');
  const fileSha256 = computeSha256(markdownContent);

  const item: AIOutputItem = {
    id: outputId,
    relativePath,
    prompt: sanitizedPrompt,
    response: sanitizedResponse,
    provider,
    model,
    sources,
    savedAt: now,
    sha256: fileSha256,
  };

  const index = loadProposalIndex(vaultRoot);
  index.outputs[outputId] = item;
  saveProposalIndex(vaultRoot, index);

  return item;
}

export async function listAIOutputs(vaultRoot: string): Promise<AIOutputItem[]> {
  const index = loadProposalIndex(vaultRoot);
  const items = Object.values(index.outputs);
  items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return items;
}
