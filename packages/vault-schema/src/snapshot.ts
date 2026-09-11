import { z } from 'zod';
import { ManifestFileEntrySchema } from './manifest.js';

export const SnapshotManifestSchema = z.object({
  schema_version: z.number().int().default(1),
  snapshot_id: z.string(),
  created_at: z.string().datetime(),
  vault_id: z.string(),
  total_files: z.number().int().nonnegative(),
  total_bytes: z.number().int().nonnegative(),
  files: z.array(ManifestFileEntrySchema),
  integrity_status: z.enum(['valid', 'corrupted', 'unverified']).default('unverified'),
  previous_snapshot_id: z.string().optional(),
});

export type SnapshotManifest = z.infer<typeof SnapshotManifestSchema>;
