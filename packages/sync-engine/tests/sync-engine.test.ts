import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  canonicalJsonStringify,
  computeManifestHash,
  verifyManifestIntegrity,
  SyncProfileManager,
  LocalVaultInspector,
  PublishedKnowledgeConsumer,
  TransferClient,
  InMemoryStorageAdapter,
  type ReleaseManifest,
  type SyncDocumentItem,
} from '../src/index.js';

function createMockVault(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-sync-test-'));
  
  // Create system folder
  fs.mkdirSync(path.join(tmpDir, '00_SYSTEM'));
  fs.writeFileSync(
    path.join(tmpDir, '00_SYSTEM/vault_manifest.json'),
    JSON.stringify({ schema_version: 1, vault_name: 'Test Vault', files: [] })
  );

  // Category 04_POSITIONING with approved note
  fs.mkdirSync(path.join(tmpDir, '04_POSITIONING'));
  fs.writeFileSync(
    path.join(tmpDir, '04_POSITIONING/positioning.md'),
    `---
title: Brand Positioning 2026
status: approved
client: ACME Corp
project: Brand Refresh
---
# Positioning Strategy
Core positioning principles for ACME Corp.
`
  );

  // Category 04_POSITIONING with draft note (should be excluded from published)
  fs.writeFileSync(
    path.join(tmpDir, '04_POSITIONING/draft_plan.md'),
    `---
title: Draft Strategy
status: draft
client: ACME Corp
---
Work in progress.
`
  );

  // Category 08_MARKET_RESEARCH with approved note
  fs.mkdirSync(path.join(tmpDir, '08_MARKET_RESEARCH'));
  fs.writeFileSync(
    path.join(tmpDir, '08_MARKET_RESEARCH/campaign.md'),
    `---
title: Summer Campaign
status: approved
client: Stark Industries
project: Summer 26
---
Campaign deliverables and channels.
`
  );

  // 90_PROPOSALS with draft proposal (should be excluded from published, included in private)
  fs.mkdirSync(path.join(tmpDir, '90_PROPOSALS'));
  fs.writeFileSync(
    path.join(tmpDir, '90_PROPOSALS/prop_01.md'),
    `---
title: Pending AI Proposal
status: pending_review
---
Needs human approval.
`
  );

  // SNAPSHOTS (must always be excluded from both)
  fs.mkdirSync(path.join(tmpDir, '00_SYSTEM/SNAPSHOTS'));
  fs.writeFileSync(path.join(tmpDir, '00_SYSTEM/SNAPSHOTS/dummy.txt'), 'snapshot data');

  fs.unlinkSync(path.join(tmpDir,'00_SYSTEM/vault_manifest.json'));
  for(const name of ['HOME.md','VAULT_RULES.md','VAULT_MANIFEST.json']) fs.copyFileSync(new URL('../../../vault-template/00_SYSTEM/'+name,import.meta.url),path.join(tmpDir,'00_SYSTEM',name));
  for(const dir of ['04_POSITIONING','08_MARKET_RESEARCH','90_PROPOSALS']) for(const name of fs.readdirSync(path.join(tmpDir,dir))) {
   const file=path.join(tmpDir,dir,name);let text=fs.readFileSync(file,'utf8');
   text=text.replace('---\n',`---\nid: ${name}\ntype: research\ncreated_at: "2026-09-13T00:00:00Z"\nupdated_at: "2026-09-13T00:00:00Z"\n`).replace('status: pending_review','status: draft');fs.writeFileSync(file,text);
  }
  return tmpDir;
}

test('Canonical Manifest Hashing and Integrity', () => {
  const doc: SyncDocumentItem = {
    id: '01_STRATEGY/positioning',
    relativePath: '01_STRATEGY/positioning.md',
    sha256: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    sizeBytes: 150,
    category: '01_STRATEGY',
    status: 'approved',
    objectRef: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    title: 'Brand Positioning 2026',
    client: 'ACME Corp',
  };

  const manifestWithoutHash = {
    schemaVersion: 1,
    channel: 'published' as const,
    tenantId: 'tenant-1',
    vaultId: 'vault-uuid-1',
    releaseId: 'rel-20260912-001',
    parentReleaseId: null,
    createdAt: '2026-09-12T12:00:00Z',
    deviceId: 'device-mac-1',
    formatVersion: 1,
    documents: [doc],
  };

  const hash = computeManifestHash(manifestWithoutHash);
  assert.ok(hash && hash.length === 64, 'Hash must be a 64-char sha256 hex string');

  const fullManifest: ReleaseManifest = {
    ...manifestWithoutHash,
    manifestHash: hash,
  };

  assert.equal(verifyManifestIntegrity(fullManifest), true, 'Valid manifest integrity must pass');

  // Tamper detection
  const tamperedManifest: ReleaseManifest = {
    ...fullManifest,
    tenantId: 'tenant-evil',
  };
  assert.equal(verifyManifestIntegrity(tamperedManifest), false, 'Tampered tenantId must fail integrity');
});

test('SyncProfileManager — getOrCreateProfile and recordCommit', () => {
  const vaultDir = createMockVault();
  try {
    const profile = SyncProfileManager.getOrCreateProfile(vaultDir, {
      tenantId: 'tenant-acme',
      endpoint: 'https://worker.vault.local',
    });

    assert.ok(profile.vaultId.startsWith('vault-'));
    assert.ok(profile.deviceId.startsWith('device-'));
    assert.equal(profile.tenantId, 'tenant-acme');

    // Read back
    const read = SyncProfileManager.readProfile(vaultDir);
    assert.ok(read);
    assert.equal(read.vaultId, profile.vaultId);

    // Record commit
    const updated = SyncProfileManager.recordCommit(vaultDir, {
      releaseId: 'rel-1',
      channel: 'published',
      committedAt: '2026-09-12T12:30:00Z',
      manifestHash: 'a'.repeat(64),
    });
    assert.equal(updated.lastCommit?.releaseId, 'rel-1');
  } finally {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  }
});

test('LocalVaultInspector — Channel published vs private', () => {
  const vaultDir = createMockVault();
  try {
    // 1. Published inspection: must ONLY include approved notes in 01-10 categories
    const pubInspection = LocalVaultInspector.inspect(vaultDir, 'published');
    assert.equal(pubInspection.errors.length, 0);
    assert.equal(pubInspection.eligibleDocuments.length, 2, 'Only 2 approved notes must be included');

    const included = pubInspection.eligibleDocuments.map((d) => d.relativePath);
    assert.ok(included.includes('04_POSITIONING/positioning.md'));
    assert.ok(included.includes('08_MARKET_RESEARCH/campaign.md'));
    assert.ok(!included.includes('04_POSITIONING/draft_plan.md'), 'Draft must be excluded');
    assert.ok(!included.includes('90_PROPOSALS/prop_01.md'), 'Proposals must be excluded from published');
    assert.ok(!included.some((p) => p.includes('SNAPSHOTS')), 'SNAPSHOTS must be excluded');

    // 2. Private inspection: backup archive includes approved notes, proposals, and vault manifest
    const privInspection = LocalVaultInspector.inspect(vaultDir, 'private');
    assert.equal(privInspection.errors.length, 0);
    const privIncluded = privInspection.eligibleDocuments.map((d) => d.relativePath);
    assert.ok(privIncluded.includes('04_POSITIONING/positioning.md'));
    assert.ok(privIncluded.includes('04_POSITIONING/draft_plan.md'));
    assert.ok(privIncluded.includes('90_PROPOSALS/prop_01.md'), 'Proposals included in private backup');
    assert.ok(privIncluded.includes('00_SYSTEM/VAULT_MANIFEST.json'));
    assert.ok(!privIncluded.some((p) => p.includes('SNAPSHOTS')), 'SNAPSHOTS excluded from private backup');
  } finally {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  }
});

test('LocalVaultInspector — Concurrency & lock protection', () => {
  const vaultDir = createMockVault();
  try {
    // Place a lock file in 00_SYSTEM
    fs.writeFileSync(path.join(vaultDir, '00_SYSTEM/LOCK'), 'pid: 9999');

    assert.throws(
      () => LocalVaultInspector.inspect(vaultDir, 'published'),
      /locked/i,
      'Must reject inspection while lock exists'
    );
    fs.unlinkSync(path.join(vaultDir, '00_SYSTEM/LOCK'));

    // Check .m7-lock
    fs.writeFileSync(path.join(vaultDir, '00_SYSTEM/.m7-lock'), 'm7');
    assert.equal(LocalVaultInspector.inspect(vaultDir,'published').errors.length,0,'Idle persistent lock must allow inspection');
    fs.unlinkSync(path.join(vaultDir, '00_SYSTEM/.m7-lock'));

    // Check .compiler-lock
    fs.mkdirSync(path.join(vaultDir, '00_SYSTEM/.compiler-lock'));
    assert.throws(
      () => LocalVaultInspector.inspect(vaultDir, 'published'),
      /\.compiler-lock/,
      'Must reject inspection while .compiler-lock exists'
    );
    fs.rmdirSync(path.join(vaultDir, '00_SYSTEM/.compiler-lock'));

    // Check .search-lock
    fs.mkdirSync(path.join(vaultDir, '00_SYSTEM/.search-lock'));
    assert.throws(
      () => LocalVaultInspector.inspect(vaultDir, 'published'),
      /\.search-lock/,
      'Must reject inspection while .search-lock exists'
    );
    fs.rmdirSync(path.join(vaultDir, '00_SYSTEM/.search-lock'));

    // Add pending file
    fs.writeFileSync(path.join(vaultDir, '00_SYSTEM/.pending-123'), 'in progress');

    assert.throws(
      () => LocalVaultInspector.inspect(vaultDir, 'published'),
      /uncommitted/i,
      'Must reject inspection while pending operations exist'
    );
  } finally {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  }
});

test('LocalVaultInspector — planUpload differential', () => {
  const vaultDir = createMockVault();
  try {
    const plan1 = LocalVaultInspector.planUpload(vaultDir, 'published');
    assert.equal(plan1.missingObjects.length, 2, 'Initial plan must upload all 2 objects');
    assert.equal(verifyManifestIntegrity(plan1.manifest), true);

    // Create plan2 using plan1 manifest as baseManifest
    const plan2 = LocalVaultInspector.planUpload(vaultDir, 'published', {
      baseManifest: plan1.manifest,
    });
    assert.equal(plan2.missingObjects.length, 0, 'No objects should be re-uploaded if unchanged');
  } finally {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  }
});

test('PublishedKnowledgeConsumer — search and buildAiContext', () => {
  const vaultDir = createMockVault();
  try {
    const plan = LocalVaultInspector.planUpload(vaultDir, 'published');
    const manifest = plan.manifest;

    // Search by query
    const searchAll = PublishedKnowledgeConsumer.search(manifest, 'Brand');
    assert.equal(searchAll.length, 1);
    assert.equal(searchAll[0].title, 'Brand Positioning 2026');

    // Search with client filter
    const searchClient = PublishedKnowledgeConsumer.search(manifest, '', { client: 'Stark Industries' });
    assert.equal(searchClient.length, 1);
    assert.equal(searchClient[0].relativePath, '08_MARKET_RESEARCH/campaign.md');

    // Build AI Context
    const contentsMap = new Map<string, string>();
    for (const doc of manifest.documents) {
      contentsMap.set(doc.sha256, fs.readFileSync(path.join(vaultDir, doc.relativePath), 'utf8'));
    }

    const aiContext = PublishedKnowledgeConsumer.buildAiContext(manifest, contentsMap, {
      client: 'ACME Corp',
    });

    assert.equal(aiContext.items.length, 1);
    assert.ok(aiContext.citations[0].includes('Brand Positioning 2026'));
    assert.ok(aiContext.formattedContext.includes('Core positioning principles'));
  } finally {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  }
});


test('Reject unresolved real M7 journal and similarly named unofficial categories', () => {
 const root=createMockVault();
 try {
  fs.mkdirSync(path.join(root,'01_CLIENTS_SECRET'));
  fs.writeFileSync(path.join(root,'01_CLIENTS_SECRET/a.md'),'---\nstatus: approved\n---\nSecret');
  assert.equal(LocalVaultInspector.inspect(root,'published').eligibleDocuments.length,2);
  fs.writeFileSync(path.join(root,'00_SYSTEM/M7_PENDING.json'),'{}');
  assert.throws(()=>LocalVaultInspector.inspect(root,'private'),/uncommitted/);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('Reject content corruption, enforce budget, and exclude unassigned client notes', () => {
 const root=createMockVault();
 try {
  const {manifest}=LocalVaultInspector.planUpload(root,'published');
  const doc=manifest.documents[0];
  assert.throws(()=>PublishedKnowledgeConsumer.buildAiContext(manifest,new Map([[doc.sha256,'tampered']])),/integrity/);
  const bytes=fs.readFileSync(path.join(root,doc.relativePath),'utf8');
  assert.equal(PublishedKnowledgeConsumer.buildAiContext(manifest,new Map([[doc.sha256,bytes]]),{maxTokensEstimate:1}).items.length,0);
  delete doc.client; manifest.manifestHash=computeManifestHash(manifest);
  assert.equal(PublishedKnowledgeConsumer.search(manifest,'',{client:'unrelated'}).length,0);
  assert.equal(verifyManifestIntegrity({...manifest,manifestHash:'a'}),false);
  assert.equal(verifyManifestIntegrity(JSON.parse(JSON.stringify(manifest))),true);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('TransferClient — successful CAS upload and conflict detection', async () => {
  const root = createMockVault();
  try {
    const storageStore = new Map<string, string | Buffer>();
    let currentRemote: { releaseId: string; manifestHash: string; committedAt: string } | null = null;

    const mockStorage = {
      async headObject(key: string) {
        return { exists: storageStore.has(key) };
      },
      async putObject(key: string, body: Buffer | string) {
        storageStore.set(key, body);
      },
      async getObject(key: string) {
        return storageStore.get(key) ?? null;
      },
      async compareAndSwapCurrent(
        key: string,
        nextCurrent: { releaseId: string; manifestHash: string; committedAt: string },
        expectedReleaseId: string | null
      ) {
        if (expectedReleaseId === null && currentRemote !== null) {
          return { success: false, conflictWith: currentRemote.releaseId };
        }
        if (expectedReleaseId !== null && currentRemote?.releaseId !== expectedReleaseId) {
          return { success: false, conflictWith: currentRemote?.releaseId || 'none' };
        }
        currentRemote = nextCurrent;
        storageStore.set(key, JSON.stringify(nextCurrent));
        return { success: true };
      },
    };

    const plan1 = LocalVaultInspector.planUpload(root, 'published',{tenantId:'t1'});
    const result1 = await TransferClient.executeUpload(plan1, root, mockStorage, {
      tenantId: 't1',
      vaultId: plan1.manifest.vaultId,
    });

    assert.equal(result1.status, 'COMMITTED');
    assert.equal(result1.uploadedObjectsCount, 2);

    // Verify profile updated
    const profile = SyncProfileManager.readProfile(root);
    assert.equal(profile?.lastCommit?.releaseId, plan1.manifest.releaseId);

    // Verify objects in storage
    assert.ok(storageStore.has(`limen/t1/${plan1.manifest.vaultId}/published/releases/${plan1.manifest.releaseId}/manifest.json`));
    assert.ok(storageStore.has(`limen/t1/${plan1.manifest.vaultId}/published/current.json`));

    // Try committing with wrong base release -> must trigger CONFLICT
    const planConflict = LocalVaultInspector.planUpload(root, 'published',{tenantId:'t1'});
    planConflict.baseReleaseId = 'old-stale-id';
    const resultConflict = await TransferClient.executeUpload(planConflict, root, mockStorage, {
      tenantId: 't1',
      vaultId: plan1.manifest.vaultId,
    });
    assert.equal(resultConflict.status, 'CONFLICT');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('TransferClient — downloadRelease and importAsNewVault (Milestone M10.3)', async () => {
  const root = createMockVault();
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-staging-test-'));
  const targetVault = path.join(os.tmpdir(), `limen-imported-vault-${Date.now()}`);

  try {
    const memoryStorage = new InMemoryStorageAdapter();
    const profile = SyncProfileManager.getOrCreateProfile(root);

    // 1. Upload private release
    const plan = LocalVaultInspector.planUpload(root, 'private', {
      tenantId: 'tenant-acme',
    });
    const uploadResult = await TransferClient.executeUpload(plan, root, memoryStorage, {
      tenantId: 'tenant-acme',
      vaultId: profile.vaultId,
    });
    assert.equal(uploadResult.status, 'COMMITTED');

    // 2. Download release to staging
    const downloadResult = await TransferClient.downloadRelease(memoryStorage, {
      tenantId: 'tenant-acme',
      vaultId: profile.vaultId,
      channel: 'private',
      stagingDir,
      newDeviceId: 'device-secondary-mac',
    });

    assert.equal(downloadResult.status, 'DOWNLOADED');
    assert.equal(downloadResult.releaseId, plan.manifest.releaseId);
    assert.ok(downloadResult.downloadedObjectsCount > 0);

    // 3. Verify staging content and reconstructed sync profile
    const profilePath = path.join(stagingDir, '00_SYSTEM/SYNC_PROFILE.json');
    assert.ok(fs.existsSync(profilePath));
    const stagingProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    assert.equal(stagingProfile.vaultId, profile.vaultId);
    assert.equal(stagingProfile.deviceId, 'device-secondary-mac');
    assert.equal(stagingProfile.lastCommit.releaseId, plan.manifest.releaseId);

    // 4. Verify native locks are absent in staging
    assert.equal(fs.existsSync(path.join(stagingDir, '00_SYSTEM/LOCK')), false);
    assert.equal(fs.existsSync(path.join(stagingDir, '00_SYSTEM/.m7-lock')), false);

    // 5. Test destination exists protection (zero-overwrite invariant)
    fs.mkdirSync(targetVault);
    const conflictImport = TransferClient.importAsNewVault(stagingDir, targetVault);
    assert.equal(conflictImport.status, 'DESTINATION_EXISTS');

    // Remove conflict directory to allow clean import
    fs.rmdirSync(targetVault);

    // 6. Import as new Vault
    const importResult = TransferClient.importAsNewVault(stagingDir, targetVault);
    assert.equal(importResult.status, 'IMPORTED', JSON.stringify(importResult));
    assert.equal(importResult.targetVaultPath, targetVault);
    assert.ok(fs.existsSync(path.join(targetVault, '00_SYSTEM/vault_manifest.json')));
    assert.ok(fs.existsSync(path.join(targetVault, '04_POSITIONING/positioning.md')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.rmSync(targetVault, { recursive: true, force: true });
  }
});

test('TransferClient — downloadRelease integrity error and path traversal rejection', async () => {
  const root = createMockVault();
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-staging-tamper-'));

  try {
    const memoryStorage = new InMemoryStorageAdapter();
    const profile = SyncProfileManager.getOrCreateProfile(root);

    const plan = LocalVaultInspector.planUpload(root, 'published', {
      tenantId: 't-tamper',
    });
    await TransferClient.executeUpload(plan, root, memoryStorage, {
      tenantId: 't-tamper',
      vaultId: profile.vaultId,
    });

    // Tamper with one object in storage
    const firstDoc = plan.manifest.documents[0];
    const objectKey = `limen/t-tamper/${profile.vaultId}/published/objects/${firstDoc.sha256}`;
    await memoryStorage.putObject(objectKey, Buffer.from('TAMPERED CORRUPT BYTES'));

    // Attempt download -> must fail with integrity corruption
    const failResult = await TransferClient.downloadRelease(memoryStorage, {
      tenantId: 't-tamper',
      vaultId: profile.vaultId,
      channel: 'published',
      stagingDir,
    });

    assert.equal(failResult.status, 'FAILED');
    assert.ok(failResult.error.includes('Integrity corruption') || failResult.error.includes('Size mismatch'));

    // Test path traversal rejection: craft manifest with ../ traversal
    const badManifest = {
      ...plan.manifest,
      releaseId: 'rel-traversal',
      documents: [
        {
          ...firstDoc,
          relativePath: '../outside.txt',
        },
      ],
    };
    // Recompute manifest hash for badManifest
    badManifest.manifestHash = computeManifestHash(badManifest);

    await memoryStorage.putObject(
      `limen/t-tamper/${profile.vaultId}/published/releases/rel-traversal/manifest.json`,
      JSON.stringify(badManifest)
    );

    const traversalResult = await TransferClient.downloadRelease(memoryStorage, {
      tenantId: 't-tamper',
      vaultId: profile.vaultId,
      channel: 'published',
      releaseId: 'rel-traversal',
      stagingDir,
    });

    assert.equal(traversalResult.status, 'FAILED');
    assert.ok(traversalResult.error.includes('Dangerous'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
});



test('Download rejects nonempty/symlink staging; import refuses arbitrary directories',async()=>{
 const root=createMockVault();const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'sync-negative-'));
 try {
  const storage=new InMemoryStorageAdapter();const plan=LocalVaultInspector.planUpload(root,'private',{tenantId:'t'});const vaultId=plan.manifest.vaultId;
  assert.equal((await TransferClient.executeUpload(plan,root,storage,{tenantId:'t',vaultId})).status,'COMMITTED');
  const stage=path.join(sandbox,'stage');const outside=path.join(sandbox,'outside');fs.mkdirSync(stage);fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(stage,'04_POSITIONING'));
  const r=await TransferClient.downloadRelease(storage,{tenantId:'t',vaultId,channel:'private',stagingDir:stage});
  assert.equal(r.status,'FAILED');assert.deepEqual(fs.readdirSync(outside),[]);
  const empty=path.join(sandbox,'empty');fs.mkdirSync(empty);assert.equal(TransferClient.importAsNewVault(empty,path.join(sandbox,'target')).status,'FAILED');assert.ok(fs.existsSync(empty));
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(sandbox,{recursive:true,force:true});}
});


test('nested source directories are captured without following symlinks', () => {
  const root = createMockVault();
  try {
    const folder = path.join(root, '04_POSITIONING', 'nested', 'deeper');
    fs.mkdirSync(folder, {recursive:true});
    fs.copyFileSync(path.join(root,'04_POSITIONING/positioning.md'), path.join(folder,'note.md'));
    fs.symlinkSync(folder,path.join(root,'04_POSITIONING/alias'));
    const result = LocalVaultInspector.inspect(root,'published');
    assert.deepEqual(result.errors,[]);
    assert.ok(result.includedPaths.includes('04_POSITIONING/nested/deeper/note.md'));
    assert.ok(!result.includedPaths.some(p=>p.includes('/alias/')));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
