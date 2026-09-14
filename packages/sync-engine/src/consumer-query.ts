import crypto from 'node:crypto';
import { verifyManifestIntegrity } from './canonical.js';
import type {
  ReleaseManifest,
  SyncDocumentItem,
  KnowledgeSearchResult,
  AiContextItem,
} from './types.js';

export class PublishedKnowledgeConsumer {
  /**
   * Searches the published release manifest.
   * Only approved documents are present in a published release manifest.
   */
  static search(
    manifest: ReleaseManifest,
    query: string,
    filters?: {
      category?: string;
      client?: string;
      project?: string;
    }
  ): KnowledgeSearchResult[] {
    if (manifest.channel !== 'published' || !verifyManifestIntegrity(manifest)) {
      throw new Error('Consumer search is only permitted on published channels');
    }

    const q = query.toLowerCase().trim();
    const results: KnowledgeSearchResult[] = [];

    for (const doc of manifest.documents) {
      if (doc.status !== 'approved') continue;

      if (filters?.category && !doc.category.toLowerCase().startsWith(filters.category.toLowerCase())) {
        continue;
      }
      if (filters?.client && doc.client?.toLowerCase() !== filters.client.toLowerCase()) {
        continue;
      }
      if (filters?.project && doc.project?.toLowerCase() !== filters.project.toLowerCase()) {
        continue;
      }

      const matchTitle = doc.title?.toLowerCase().includes(q) ?? false;
      const matchPath = doc.relativePath.toLowerCase().includes(q);

      if (!q || matchTitle || matchPath) {
        results.push({
          documentId: doc.id,
          relativePath: doc.relativePath,
          category: doc.category,
          title: doc.title || doc.relativePath,
          snippet: `Nota approvata [${doc.category}] (SHA: ${doc.sha256.slice(0, 8)})`,
          sha256: doc.sha256,
          client: doc.client,
          project: doc.project,
        });
      }
    }

    return results;
  }

  /**
   * Assembles the AI context payload from verified published documents.
   * Respects token/character limits and formats verifiable citations.
   */
  static buildAiContext(
    manifest: ReleaseManifest,
    contentsByHash: Map<string, string>,
    options?: {
      maxTokensEstimate?: number;
      client?: string;
      project?: string;
    }
  ): {
    items: AiContextItem[];
    formattedContext: string;
    citations: string[];
  } {
    if (manifest.channel !== 'published' || !verifyManifestIntegrity(manifest)) {
      throw new Error('AI context generation is only permitted on published releases');
    }

    const maxChars = (options?.maxTokensEstimate ?? 4000) * 4; // ~4 chars per token rule of thumb
    let currentChars = 0;
    const items: AiContextItem[] = [];
    const citations: string[] = [];
    const contextSections: string[] = [];

    for (const doc of manifest.documents) {
      if (doc.status !== 'approved') continue;

      if (options?.client && doc.client?.toLowerCase() !== options.client.toLowerCase()) {
        continue;
      }
      if (options?.project && doc.project?.toLowerCase() !== options.project.toLowerCase()) {
        continue;
      }

      const content = contentsByHash.get(doc.sha256);
      if (!content) continue;
      if (crypto.createHash('sha256').update(content).digest('hex') !== doc.sha256) throw new Error('Document integrity mismatch');

      if (currentChars + content.length + (doc.title || doc.relativePath).length + doc.relativePath.length + manifest.releaseId.length + 120 > maxChars) {
        break;
      }

      const item: AiContextItem = {
        documentId: doc.id,
        relativePath: doc.relativePath,
        title: doc.title || doc.relativePath,
        content,
        sha256: doc.sha256,
        releaseId: manifest.releaseId,
        client: doc.client,
        project: doc.project,
      };

      const section=`--- Fonte: ${item.title} (Percorso: ${doc.relativePath}, Release: ${manifest.releaseId}, Hash: ${doc.sha256.slice(0, 8)}) ---\n${content}\n`;
      if(currentChars+section.length+(items.length?1:0)>maxChars) break;
      items.push(item);
      currentChars += section.length+(items.length>1?1:0);

      const citation = `[${item.title}] (${doc.relativePath}#${doc.sha256.slice(0, 8)})`;
      citations.push(citation);

      contextSections.push(
        `--- Fonte: ${item.title} (Percorso: ${doc.relativePath}, Release: ${manifest.releaseId}, Hash: ${doc.sha256.slice(0, 8)}) ---\n${content}\n`
      );
    }

    return {
      items,
      formattedContext: contextSections.join('\n'),
      citations,
    };
  }
}
