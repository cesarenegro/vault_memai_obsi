import { z } from 'zod';

export const ManifestFileEntrySchema = z.object({
  path: z.string(),
  sha256: z.string().length(64),
  size: z.number().nonnegative(),
  updated_at: z.string().datetime().optional(),
});

export const VaultManifestSchema = z.object({
  schema_version: z.number().int().positive(),
  vault_id: z.string(),
  vault_name: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  snapshot_id: z.string().optional(),
  files: z.array(ManifestFileEntrySchema),
});

export type ManifestFileEntry = z.infer<typeof ManifestFileEntrySchema>;
export type VaultManifest = z.infer<typeof VaultManifestSchema>;
