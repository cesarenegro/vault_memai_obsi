import { ProposalFrontmatterStatus } from './index.js';

export interface ProposalFrontmatterData {
  schema_version: number;
  id: string;
  title: string;
  type: string; // KnowledgeCategory
  client?: string;
  project?: string;
  brand?: string;
  status: ProposalFrontmatterStatus;
  source_ids: string[];
  created_at: string;
  updated_at: string;
  tags: string[];
  revision?: number;
}

export function buildFrontmatterYaml(data: ProposalFrontmatterData): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`schema_version: ${data.schema_version || 1}`);
  lines.push(`id: "${data.id}"`);
  lines.push(`title: "${data.title.replace(/"/g, '\\"')}"`);
  lines.push(`type: "${data.type}"`);
  if (data.client) lines.push(`client: "${data.client.replace(/"/g, '\\"')}"`);
  if (data.project) lines.push(`project: "${data.project.replace(/"/g, '\\"')}"`);
  if (data.brand) lines.push(`brand: "${data.brand.replace(/"/g, '\\"')}"`);
  lines.push(`status: "${data.status || 'draft'}"`);

  if (data.revision !== undefined) {
    lines.push(`revision: ${data.revision}`);
  }

  if (data.source_ids && data.source_ids.length > 0) {
    lines.push('source_ids:');
    for (const sid of data.source_ids) {
      lines.push(`  - "${sid}"`);
    }
  } else {
    lines.push('source_ids: []');
  }

  lines.push(`created_at: "${data.created_at}"`);
  lines.push(`updated_at: "${data.updated_at}"`);

  if (data.tags && data.tags.length > 0) {
    lines.push('tags:');
    for (const tag of data.tags) {
      lines.push(`  - "${tag}"`);
    }
  } else {
    lines.push('tags: []');
  }

  lines.push('---');
  return lines.join('\n');
}

export function parseFrontmatter(markdownContent: string): {
  frontmatter: Partial<ProposalFrontmatterData>;
  body: string;
} {
  const match = markdownContent.match(/^---\n([\s\S]+?)\n---\n?/);
  if (!match) {
    return { frontmatter: {}, body: markdownContent.trim() };
  }

  const rawYaml = match[1];
  const body = markdownContent.slice(match[0].length).trim();
  const frontmatter: Partial<ProposalFrontmatterData> = {};

  const lines = rawYaml.split('\n');
  let currentKey: string | null = null;
  let currentList: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ')) {
      const val = trimmed.slice(2).trim().replace(/^"|"$/g, '');
      currentList.push(val);
      continue;
    }

    if (currentKey && currentList.length > 0) {
      (frontmatter as any)[currentKey] = currentList;
      currentKey = null;
      currentList = [];
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();

      if (!rawVal) {
        currentKey = key;
        currentList = [];
      } else if (rawVal === '[]') {
        (frontmatter as any)[key] = [];
      } else {
        const cleanVal = rawVal.replace(/^"|"$/g, '');
        if (key === 'schema_version' || key === 'revision') {
          (frontmatter as any)[key] = parseInt(cleanVal, 10) || 1;
        } else {
          (frontmatter as any)[key] = cleanVal;
        }
      }
    }
  }

  if (currentKey && currentList.length > 0) {
    (frontmatter as any)[currentKey] = currentList;
  }

  return { frontmatter, body };
}
