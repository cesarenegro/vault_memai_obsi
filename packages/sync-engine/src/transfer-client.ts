import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { VaultValidator, REQUIRED_VAULT_FOLDERS, SafeDir } from '@limen-vault/vault-core';
import { SyncProfileManager } from './sync-profile.js';
import { verifyManifestIntegrity } from './canonical.js';
import type { UploadPlan, ReleaseManifest } from './types.js';

export interface StorageAdapter {
  headObject(key: string): Promise<{ exists: boolean; sizeBytes?: number }>;
  putObject(key: string, body: Buffer | string): Promise<void>;
  getObject(key: string): Promise<Buffer | string | null>;
  compareAndSwapCurrent(
    key: string,
    nextCurrent: { releaseId: string; manifestHash: string; committedAt: string },
    expectedReleaseId: string | null
  ): Promise<{ success: boolean; conflictWith?: string }>;
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private objects = new Map<string, Buffer>();

  async headObject(key: string): Promise<{ exists: boolean; sizeBytes?: number }> {
    const obj = this.objects.get(key);
    if (!obj) return { exists: false };
    return { exists: true, sizeBytes: obj.length };
  }

  async putObject(key: string, body: Buffer | string): Promise<void> {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    this.objects.set(key, buf);
  }

  async getObject(key: string): Promise<Buffer | string | null> {
    const buf = this.objects.get(key);
    if (!buf) return null;
    return buf;
  }

  async compareAndSwapCurrent(
    key: string,
    nextCurrent: { releaseId: string; manifestHash: string; committedAt: string },
    expectedReleaseId: string | null
  ): Promise<{ success: boolean; conflictWith?: string }> {
    const existing = this.objects.get(key);
    let currentReleaseId: string | null = null;
    if (existing) {
      try {
        const parsed = JSON.parse(existing.toString('utf8'));
        currentReleaseId = parsed.releaseId || null;
      } catch {
        currentReleaseId = null;
      }
    }

    if (expectedReleaseId === null && currentReleaseId !== null) {
      return { success: false, conflictWith: currentReleaseId };
    }
    if (expectedReleaseId !== null && currentReleaseId !== expectedReleaseId) {
      return { success: false, conflictWith: currentReleaseId || 'empty' };
    }

    this.objects.set(key, Buffer.from(JSON.stringify(nextCurrent, null, 2)));
    return { success: true };
  }
}

export type TransferExecutionResult =
  | {
      status: 'COMMITTED';
      releaseId: string;
      manifestHash: string;
      uploadedObjectsCount: number;
      totalBytesUploaded: number;
    }
  | {
      status: 'CONFLICT';
      expectedReleaseId: string | null;
      actualRemoteReleaseId: string;
      message: string;
    }
  | {
      status: 'FAILED';
      error: string;
    };

export type DownloadExecutionResult =
  | {
      status: 'DOWNLOADED';
      stagingDir: string;
      releaseId: string;
      manifestHash: string;
      downloadedObjectsCount: number;
      totalBytesDownloaded: number;
    }
  | {
      status: 'FAILED';
      error: string;
      stagingDir?: string;
    };

export type ImportExecutionResult =
  | {
      status: 'IMPORTED';
      targetVaultPath: string;
      vaultId: string;
    }
  | {
      status: 'DESTINATION_EXISTS';
      targetVaultPath: string;
      error: string;
    }
  | {
      status: 'FAILED';
      error: string;
    };

function validateRelativePath(relPath: string): boolean {
  if (typeof relPath !== 'string' || !relPath) return false;
  if (path.isAbsolute(relPath)) return false;
  if (relPath.includes('\\') || relPath.includes('\0') || relPath.length > 1024 || relPath.split('/').length > 32) return false;
  const segments = relPath.split('/');
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') return false;
  }
  return true;
}

export class TransferClient {
  /**
   * Generates the canonical storage prefix for a tenant/vault/channel.
   */
  static getStoragePrefix(tenantId: string, vaultId: string, channel: 'private' | 'published'): string {
    if (![tenantId,vaultId].every(x=>/^[a-zA-Z0-9_-]{1,100}$/.test(x)) || !['private','published'].includes(channel)) throw new Error('Invalid storage scope');
    return `limen/${tenantId}/${vaultId}/${channel}`;
  }

  /**
   * Executes a planned upload against a storage adapter with CAS commit.
   */
  static async executeUpload(
    plan: UploadPlan,
    vaultRoot: string,
    storage: StorageAdapter,
    options: { tenantId: string; vaultId: string }
  ): Promise<TransferExecutionResult> {
    if (!verifyManifestIntegrity(plan.manifest)) {
      return { status: 'FAILED', error: 'Invalid manifest integrity: hash mismatch' };
    }

    if(plan.manifest.tenantId!==options.tenantId || plan.manifest.vaultId!==options.vaultId || plan.manifest.channel!==plan.channel) return {status:'FAILED',error:'Manifest scope mismatch'};
    const prefix = this.getStoragePrefix(options.tenantId, options.vaultId, plan.channel);
    const root = SafeDir.open(vaultRoot);
    let uploadedObjectsCount = 0;
    let totalBytesUploaded = 0;

    try {
      // 1. Upload missing objects
      for (const obj of plan.missingObjects) {
        // Read file using SafeDir
        const parts = obj.relativePath.split(path.sep);
        let currentDir = root;
        const subDirsToClose: SafeDir[] = [];

        try {
          for (let i = 0; i < parts.length - 1; i++) {
            const next = currentDir.dir(parts[i]);
            subDirsToClose.push(next);
            currentDir = next;
          }

          const fileName = parts[parts.length - 1];
          const buffer = currentDir.readBytes(fileName);
          const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');

          if (computedHash !== obj.sha256) {
            return {
              status: 'FAILED',
              error: `Content changed during transfer for ${obj.relativePath}: hash mismatch`,
            };
          }

          const objectKey = `${prefix}/objects/${obj.sha256}`;
          await storage.putObject(objectKey, buffer);
          uploadedObjectsCount++;
          totalBytesUploaded += buffer.length;
        } finally {
          for (const d of subDirsToClose.reverse()) {
            d.close();
          }
        }
      }

      for(const doc of plan.manifest.documents) {
        const remote=await storage.getObject(`${prefix}/objects/${doc.sha256}`);
        if(remote===null || Buffer.byteLength(remote)!==doc.sizeBytes || crypto.createHash('sha256').update(remote).digest('hex')!==doc.sha256) throw new Error('Remote object missing or corrupted');
      }
      // 2. Upload manifest
      const manifestKey = `${prefix}/releases/${plan.manifest.releaseId}/manifest.json`;
      await storage.putObject(manifestKey, JSON.stringify(plan.manifest, null, 2));

      // 3. Conditional Commit (CAS) on current pointer
      const currentKey = `${prefix}/current.json`;
      const nextCurrent = {
        releaseId: plan.manifest.releaseId,
        manifestHash: plan.manifest.manifestHash,
        committedAt: new Date().toISOString(),
      };

      const casResult = await storage.compareAndSwapCurrent(
        currentKey,
        nextCurrent,
        plan.baseReleaseId ?? null
      );

      if (!casResult.success) {
        return {
          status: 'CONFLICT',
          expectedReleaseId: plan.baseReleaseId ?? null,
          actualRemoteReleaseId: casResult.conflictWith || 'unknown',
          message: `CAS commit failed: base release mismatch (remote is at ${casResult.conflictWith})`,
        };
      }

      // 4. Record successful commit in local sync profile
      SyncProfileManager.recordCommit(vaultRoot, {
        releaseId: plan.manifest.releaseId,
        channel: plan.channel,
        committedAt: nextCurrent.committedAt,
        manifestHash: plan.manifest.manifestHash,
      });

      return {
        status: 'COMMITTED',
        releaseId: plan.manifest.releaseId,
        manifestHash: plan.manifest.manifestHash,
        uploadedObjectsCount,
        totalBytesUploaded,
      };
    } catch (err) {
      return { status: 'FAILED', error: (err as Error).message };
    } finally {
      root.close();
    }
  }

  /**
   * Downloads a release from remote storage into an isolated staging directory,
   * validating manifest integrity, relative paths, and object byte hashes.
   */
  static async downloadRelease(
    storage: StorageAdapter,
    options: {
      tenantId: string;
      vaultId: string;
      channel: 'private' | 'published';
      releaseId?: string;
      stagingDir: string;
      newDeviceId?: string;
    }
  ): Promise<DownloadExecutionResult> {
    const prefix = this.getStoragePrefix(options.tenantId, options.vaultId, options.channel);

    try {
      // 1. Determine target releaseId
      let targetReleaseId = options.releaseId;
      if (!targetReleaseId || targetReleaseId === 'current') {
        const currentData = await storage.getObject(`${prefix}/current.json`);
        if (!currentData) {
          return { status: 'FAILED', error: 'No current release pointer found in remote storage' };
        }
        const current = typeof currentData === 'string' ? JSON.parse(currentData) : JSON.parse(currentData.toString('utf8'));
        if (!current.releaseId || !/^[a-zA-Z0-9_-]{1,150}$/.test(current.releaseId)) {
          return { status: 'FAILED', error: 'Invalid or missing releaseId in current pointer' };
        }
        targetReleaseId = current.releaseId;
      }

      // 2. Fetch manifest
      const manifestKey = `${prefix}/releases/${targetReleaseId}/manifest.json`;
      const manifestData = await storage.getObject(manifestKey);
      if (!manifestData) {
        return { status: 'FAILED', error: `Release manifest not found for release ${targetReleaseId}` };
      }
      const manifest: ReleaseManifest = typeof manifestData === 'string' ? JSON.parse(manifestData) : JSON.parse(manifestData.toString('utf8'));

      // 3. Verify manifest integrity
      if (!verifyManifestIntegrity(manifest)) {
        return { status: 'FAILED', error: 'Invalid manifest integrity: hash mismatch' };
      }

      if (manifest.tenantId !== options.tenantId || manifest.vaultId !== options.vaultId || manifest.channel !== options.channel) {
        return { status: 'FAILED', error: 'Manifest tenant/vault/channel mismatch' };
      }

      if(manifest.releaseId!==targetReleaseId) throw new Error('Release identity mismatch');
      if(manifest.documents.length>10000) throw new Error('Release capacity exceeded');
      const seen=new Set<string>(); let total=0;
      for(const doc of manifest.documents) {
        if(!validateRelativePath(doc.relativePath) || !Number.isSafeInteger(doc.sizeBytes) || doc.sizeBytes<0 || doc.sizeBytes>8*1024*1024) throw new Error('Dangerous path or object limit');
        const key=doc.relativePath.normalize('NFC').toLowerCase();
        if(seen.has(key)) throw new Error('Path collision'); seen.add(key);
        if(doc.relativePath.split('/').some(x=>x.startsWith('.')) || /(^|\/)(LOCK|M7_PENDING.json|SYNC_PROFILE.json)$/.test(doc.relativePath)) throw new Error('Forbidden runtime file');
        total+=doc.sizeBytes;
      }
      if(total>256*1024*1024) throw new Error('Release byte limit');
      // 4. Ensure staging directory exists
      if (!fs.existsSync(options.stagingDir)) fs.mkdirSync(options.stagingDir,{mode:0o700});
      if(fs.lstatSync(options.stagingDir).isSymbolicLink() || fs.readdirSync(options.stagingDir).length) throw new Error('Staging must be an empty regular directory');

      let downloadedObjectsCount = 0;
      let totalBytesDownloaded = 0;

      // 5. Download and verify every object
      for (const doc of manifest.documents) {
        if (!validateRelativePath(doc.relativePath)) {
          return {
            status: 'FAILED',
            stagingDir: options.stagingDir,
            error: `Dangerous or invalid relative path in manifest: ${doc.relativePath}`,
          };
        }

        if (!/^[a-f0-9]{64}$/i.test(doc.sha256)) {
          return {
            status: 'FAILED',
            stagingDir: options.stagingDir,
            error: `Invalid sha256 format for document ${doc.relativePath}`,
          };
        }

        const objectKey = `${prefix}/objects/${doc.sha256}`;
        const objectData = await storage.getObject(objectKey);
        if (!objectData) {
          return {
            status: 'FAILED',
            stagingDir: options.stagingDir,
            error: `Missing remote object ${doc.sha256} for document ${doc.relativePath}`,
          };
        }

        const buffer = Buffer.isBuffer(objectData) ? objectData : Buffer.from(objectData);
        if (buffer.length !== doc.sizeBytes) {
          return {
            status: 'FAILED',
            stagingDir: options.stagingDir,
            error: `Size mismatch for object ${doc.sha256}: expected ${doc.sizeBytes}, got ${buffer.length}`,
          };
        }

        const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
        if (actualHash !== doc.sha256) {
          return {
            status: 'FAILED',
            stagingDir: options.stagingDir,
            error: `Integrity corruption for object ${doc.sha256}: hash mismatch`,
          };
        }

        const root=SafeDir.open(options.stagingDir);let dir=root;const opened:SafeDir[]=[];
        try {
          const parts=doc.relativePath.split('/');
          for(const part of parts.slice(0,-1)) {if(!dir.names().includes(part)) dir.mkdir(part);const next=dir.dir(part);opened.push(next);dir=next;}
          dir.writeNew(parts[parts.length-1],buffer);
        } finally {opened.reverse().forEach(d=>d.close());root.close();}
        downloadedObjectsCount++;
        totalBytesDownloaded += buffer.length;
      }

      // 6. If private channel, configure fresh device profile and clean native locks
      if (options.channel === 'private') {
        const systemDir = path.join(options.stagingDir, '00_SYSTEM');
        if (!fs.existsSync(systemDir)) {
          fs.mkdirSync(systemDir, { recursive: true });
        }

        const newProfile = {
          schemaVersion: 1,
          vaultId: manifest.vaultId,
          deviceId: options.newDeviceId || crypto.randomUUID(),
          lastCommit: {
            releaseId: manifest.releaseId,
            channel: manifest.channel,
            committedAt: manifest.createdAt,
            manifestHash: manifest.manifestHash,
          },
        };
        fs.writeFileSync(path.join(systemDir, 'SYNC_PROFILE.json'), JSON.stringify(newProfile, null, 2), 'utf8');

        for(const folder of REQUIRED_VAULT_FOLDERS) if(!fs.existsSync(path.join(options.stagingDir,folder))) fs.mkdirSync(path.join(options.stagingDir,folder));
      }
      fs.writeFileSync(path.join(options.stagingDir,'.m10-download.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});

      return {
        status: 'DOWNLOADED',
        stagingDir: options.stagingDir,
        releaseId: manifest.releaseId,
        manifestHash: manifest.manifestHash,
        downloadedObjectsCount,
        totalBytesDownloaded,
      };
    } catch (err) {
      return {
        status: 'FAILED',
        stagingDir: options.stagingDir,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Imports a downloaded and verified staging directory as a brand new Vault folder.
   * Strictly enforces zero-overwrite: if destination target exists, import fails.
   */
  static importAsNewVault(
    stagingDir: string,
    targetVaultPath: string
  ): ImportExecutionResult {
    try {
      if (!fs.existsSync(stagingDir)) {
        return { status: 'FAILED', error: `Staging directory does not exist: ${stagingDir}` };
      }

      if (fs.existsSync(targetVaultPath)) {
        return {
          status: 'DESTINATION_EXISTS',
          targetVaultPath,
          error: `Target directory already exists at ${targetVaultPath}. In-place overwrite is forbidden.`,
        };
      }

      const root=SafeDir.open(stagingDir);
      let manifest:ReleaseManifest;
      try {
        manifest=JSON.parse(root.read('.m10-download.json'));
        if(!verifyManifestIntegrity(manifest)||manifest.channel!=='private') throw new Error('Not a verified private Vault copy');
        for(const doc of manifest.documents) {
          if(!validateRelativePath(doc.relativePath)) throw new Error('Unsafe path');
          let dir=root;const opened:SafeDir[]=[];
          try {const parts=doc.relativePath.split('/');for(const part of parts.slice(0,-1)){dir=dir.dir(part);opened.push(dir);}const b=dir.readBytes(parts.at(-1)!);if(b.length!==doc.sizeBytes||crypto.createHash('sha256').update(b).digest('hex')!==doc.sha256) throw new Error('Staging changed');}
          finally {opened.reverse().forEach(d=>d.close());}
        }
      } finally {root.close();}
      const validation=VaultValidator.validateVault(stagingDir);
      if(!validation.isValid) throw new Error('Invalid Vault copy: '+validation.errors.join('; '));
      const vaultId=manifest.vaultId;
      const parent=fs.realpathSync(path.dirname(stagingDir));
      if(parent!==fs.realpathSync(path.dirname(targetVaultPath))) throw new Error('Staging must be a sibling of destination');
      const directory=SafeDir.open(parent);
      try {directory.renameExclusive(path.basename(stagingDir),path.basename(targetVaultPath));} finally {directory.close();}

      return {
        status: 'IMPORTED',
        targetVaultPath,
        vaultId,
      };
    } catch (err) {
      return {
        status: 'FAILED',
        error: (err as Error).message,
      };
    }
  }
}
