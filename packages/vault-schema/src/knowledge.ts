import { z } from 'zod';

export const KnowledgeCategorySchema = z.enum([
  'client',
  'project',
  'brand',
  'positioning',
  'packaging',
  'method',
  'case_study',
  'research',
  'competitor',
  'approved_output',
  'raw_source',
  'ai_output',
  'proposal',
]);

export const FrontmatterSchema = z.object({
  schema_version: z.number().int().default(1),
  id: z.string(),
  title: z.string(),
  type: KnowledgeCategorySchema,
  client: z.string().optional(),
  project: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['draft', 'review', 'approved', 'archived']).default('approved'),
  source_ids: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
  snapshot_id: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const KnowledgePageSchema = z.object({
  frontmatter: FrontmatterSchema,
  content: z.string(),
  relative_path: z.string(),
});

export type KnowledgeCategory = z.infer<typeof KnowledgeCategorySchema>;
export type Frontmatter = z.infer<typeof FrontmatterSchema>;
export type KnowledgePage = z.infer<typeof KnowledgePageSchema>;
