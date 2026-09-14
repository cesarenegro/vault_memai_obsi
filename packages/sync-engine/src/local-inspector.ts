import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SafeDir, parseYamlFrontmatter } from '@limen-vault/vault-core';
import { computeManifestHash } from './canonical.js';
import { SyncProfileManager } from './sync-profile.js';
import type {
  SyncChannel,
  SyncDocumentItem,
  ReleaseManifest,
  UploadPlan,
  InspectionResult,
} from './types.js';

export const OFFICIAL_KNOWLEDGE_CATEGORIES = [
  '01_CLIENTS',
  '02_PROJECTS',
  '03_BRANDS',
  '04_POSITIONING',
  '05_PACKAGING_KNOWLEDGE',
  '06_METHODS',
  '07_CASE_STUDIES',
  '08_MARKET_RESEARCH',
  '09_COMPETITORS',
  '10_APPROVED_OUTPUTS',
];

export const EXCLUDED_SYSTEM_PATHS = [
  '.obsidian',
  '.git',
  '.trash',
  '00_SYSTEM/SNAPSHOTS',
  '00_SYSTEM/SEARCH_INDEX.json',
  '00_SYSTEM/LOCK',
  '00_SYSTEM/SYNC_PROFILE.json',
];

export class LocalVaultInspector {
  /**
   * Inspects local Vault and collects eligible documents according to the chosen channel.
   */
  static inspect(vaultRoot: string, channel: SyncChannel): InspectionResult {
    const operationId = crypto.randomUUID();
    const realRoot = fs.realpathSync(vaultRoot);
    const profile = SyncProfileManager.getOrCreateProfile(realRoot);
    const root = SafeDir.open(realRoot);

    const eligibleDocuments: SyncDocumentItem[] = [];
    const includedPaths: string[] = [];
    const excludedPaths: string[] = [];
    const errors: string[] = [];

    const unlock: (()=>void)[]=[];
    try {
      // 1. Check for active uncommitted journals or locks in 00_SYSTEM
      let sys: SafeDir | undefined;
      try {
        sys = root.dir('00_SYSTEM');
        const sysNames = sys.names();
        const pendingItems = sysNames.filter(
          (n) => n === 'M7_PENDING.json' || n.startsWith('.pending-') || n.startsWith('.tmp-')
        );
        if (pendingItems.length > 0) {
          throw new Error(
            `Active uncommitted operations detected in 00_SYSTEM: ${pendingItems.join(', ')}`
          );
        }
        if(sysNames.includes('LOCK')) throw new Error('Vault is currently locked');
        if(!sysNames.includes('.m7-lock')) {try{sys.writeNew('.m7-lock','');}catch(e){if(!sys.names().includes('.m7-lock'))throw e;}sysNames.push('.m7-lock');}
        for(const name of ['.m7-lock','.compiler-lock','.search-lock']) {
          if(sysNames.includes(name)) unlock.push(sys.lockExisting(name));
        }
      } finally {
        sys?.close();
      }

      // 2. Walk directories
      const entries = root.names();
      for (const entryName of entries) {
        if (entryName.startsWith('.') || entryName === 'node_modules') {
          excludedPaths.push(entryName);
          continue;
        }

        const fullChildPath = path.join(realRoot, entryName);
        const stat = fs.lstatSync(fullChildPath);

        if (stat.isSymbolicLink()) {
          excludedPaths.push(entryName);
          continue;
        }

        if (stat.isDirectory()) {
          this.walkDirectory(
            root,
            realRoot,
            entryName,
            channel,
            eligibleDocuments,
            includedPaths,
            excludedPaths,
            errors
          );
        }
      }

      // Compute total bytes
      const totalBytes = eligibleDocuments.reduce((sum, doc) => sum + doc.sizeBytes, 0);

      return {
        operationId,
        channel,
        vaultRoot: realRoot,
        vaultId: profile.vaultId,
        eligibleDocuments,
        includedPaths,
        excludedPaths,
        totalBytes,
        errors,
      };
    } finally {
      unlock.reverse().forEach(release=>release());
      root.close();
    }
  }

  private static walkDirectory(
    root: SafeDir,
    realRoot: string,
    relativeDirPath: string,
    channel: SyncChannel,
    eligible: SyncDocumentItem[],
    includedPaths: string[],
    excludedPaths: string[],
    errors: string[]
  ) {
    const parts = relativeDirPath.split(path.sep);
    const topLevelDir = parts[0];

    // Exclude SNAPSHOTS, cache, and hidden directories
    if (
      relativeDirPath.includes('SNAPSHOTS') ||
      relativeDirPath.includes('.pending-') ||
      relativeDirPath.includes('.obsidian')
    ) {
      excludedPaths.push(relativeDirPath);
      return;
    }

    if (channel === 'published') {
      // Published channel ONLY allows categories 01_STRATEGY through 10_LEGAL
      const isOfficialCategory = OFFICIAL_KNOWLEDGE_CATEGORIES.some((cat) =>
        topLevelDir === cat
      );
      if (!isOfficialCategory) {
        excludedPaths.push(relativeDirPath);
        return;
      }
    }

    let subDir: SafeDir | undefined;
    try {
      // Open one component at a time, retaining descriptor-relative no-symlink checks.
      for (const part of parts) {
        const next = (subDir ?? root).dir(part);
        subDir?.close();
        subDir = next;
      }
      if (!subDir) throw new Error('Empty directory path');
      const names = subDir.names();

      for (const name of names) {
        if (name.startsWith('.') || name.endsWith('~')) {
          excludedPaths.push(path.join(relativeDirPath, name));
          continue;
        }

        const relativeFilePath = path.join(relativeDirPath, name);
        const fullFilePath = path.join(realRoot, relativeFilePath);
        const stat = fs.lstatSync(fullFilePath);

        if (stat.isSymbolicLink()) {
          excludedPaths.push(relativeFilePath);
          continue;
        }

        if (stat.isDirectory()) {
          this.walkDirectory(
            root,
            realRoot,
            relativeFilePath,
            channel,
            eligible,
            includedPaths,
            excludedPaths,
            errors
          );
          continue;
        }

        // It's a file
        if (channel === 'published') {
          // Must be markdown
          if (!name.endsWith('.md')) {
            excludedPaths.push(relativeFilePath);
            continue;
          }

          // Check frontmatter status: must be 'approved'
          try {
            const content = subDir.read(name);
            const parseResult = parseYamlFrontmatter(content);
            const frontmatter = parseResult?.data;
            const status = String(frontmatter?.status || '').toLowerCase().trim();

            if (status !== 'approved') {
              excludedPaths.push(relativeFilePath);
              continue;
            }

            // Extract hash and build item
            const buffer = Buffer.from(content, 'utf8');
            const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

            const item: SyncDocumentItem = {
              id: relativeFilePath,
              relativePath: relativeFilePath,
              sha256,
              sizeBytes: buffer.length,
              category: topLevelDir,
              status: 'approved',
              objectRef: sha256,
              title: typeof frontmatter?.title === 'string' ? frontmatter.title : name.replace(/\.md$/, ''),
              client: typeof frontmatter?.client === 'string' ? frontmatter.client : undefined,
              project: typeof frontmatter?.project === 'string' ? frontmatter.project : undefined,
              updatedAt: typeof frontmatter?.updated_at === 'string' ? frontmatter.updated_at : undefined,
            };

            eligible.push(item);
            includedPaths.push(relativeFilePath);
          } catch (readErr) {
            errors.push(`Error reading ${relativeFilePath}: ${(readErr as Error).message}`);
            excludedPaths.push(relativeFilePath);
          }
        } else {
          // Channel 'private': backup archive
          if (EXCLUDED_SYSTEM_PATHS.some((p) => relativeFilePath === p || relativeFilePath.startsWith(p + '/'))) {
            excludedPaths.push(relativeFilePath);
            continue;
          }

          try {
            const buffer = subDir.readBytes(name);
            const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
            let status = 'private';
            let title: string | undefined;
            let client: string | undefined;
            let project: string | undefined;

            if (name.endsWith('.md')) {
              try {
                const parseResult = parseYamlFrontmatter(buffer.toString('utf8'));
                const fm = parseResult?.data;
                if (fm?.status) status = String(fm.status).toLowerCase().trim();
                if (fm?.title) title = String(fm.title);
                if (fm?.client) client = String(fm.client);
                if (fm?.project) project = String(fm.project);
              } catch {
                /* non-fatal for private archive */
              }
            }

            const item: SyncDocumentItem = {
              id: relativeFilePath.replace(/\//g, ':'),
              relativePath: relativeFilePath,
              sha256,
              sizeBytes: buffer.length,
              category: topLevelDir,
              status,
              objectRef: sha256,
              title,
              client,
              project,
            };

            eligible.push(item);
            includedPaths.push(relativeFilePath);
          } catch (readErr) {
            errors.push(`Error reading ${relativeFilePath}: ${(readErr as Error).message}`);
            excludedPaths.push(relativeFilePath);
          }
        }
      }
    } finally {
      subDir?.close();
    }
  }

  /**
   * Plans an upload by inspecting the Vault and comparing against an optional base release.
   */
  static planUpload(
    vaultRoot: string,
    channel: SyncChannel,
    options?: {
      tenantId?: string;
      parentReleaseId?: string | null;
      baseManifest?: ReleaseManifest | null;
    }
  ): UploadPlan {
    const inspection = this.inspect(vaultRoot, channel);
    if (inspection.errors.length > 0) {
      throw new Error(`Vault inspection failed: ${inspection.errors.join('; ')}`);
    }

    const realRoot = fs.realpathSync(vaultRoot);
    const profile = SyncProfileManager.getOrCreateProfile(realRoot);
    const tenantId = options?.tenantId || profile.tenantId || 'tenant-default';
    const createdAt = new Date().toISOString();
    const candidateReleaseId = `rel-${createdAt.replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;

    const manifestWithoutHash: Omit<ReleaseManifest, 'manifestHash'> = {
      schemaVersion: 1,
      channel,
      tenantId,
      vaultId: profile.vaultId,
      releaseId: candidateReleaseId,
      parentReleaseId: options?.parentReleaseId ?? options?.baseManifest?.releaseId ?? null,
      createdAt,
      deviceId: profile.deviceId,
      formatVersion: 1,
      documents: inspection.eligibleDocuments,
    };

    const manifestHash = computeManifestHash(manifestWithoutHash);
    const manifest: ReleaseManifest = {
      ...manifestWithoutHash,
      manifestHash,
    };

    // Determine missing objects compared to baseManifest
    const existingHashes = new Set<string>(
      options?.baseManifest ? options.baseManifest.documents.map((d) => d.sha256) : []
    );

    const missingObjects = inspection.eligibleDocuments
      .filter((doc) => !existingHashes.has(doc.sha256))
      .map((doc) => ({
        sha256: doc.sha256,
        relativePath: doc.relativePath,
        sizeBytes: doc.sizeBytes,
      }));

    return {
      operationId: inspection.operationId,
      channel,
      baseReleaseId: options?.baseManifest?.releaseId ?? null,
      candidateReleaseId,
      totalDocuments: inspection.eligibleDocuments.length,
      totalBytes: inspection.totalBytes,
      includedPaths: inspection.includedPaths,
      excludedPaths: inspection.excludedPaths,
      missingObjects,
      manifest,
    };
  }
}
