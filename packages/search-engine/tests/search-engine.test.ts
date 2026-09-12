import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LocalSearchEngine } from '../src/search-engine.js';
import { loadSearchIndex } from '../src/index-store.js';

function createTempVault(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-search-test-'));
  fs.mkdirSync(path.join(tmpDir, '00_SYSTEM'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '01_CLIENTS'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '04_POSITIONING'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '90_PROPOSALS'), { recursive: true });

  const manifestPath = path.join(tmpDir, '00_SYSTEM', 'VAULT_MANIFEST.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      schema_version: 1,
      vault_id: 'test_vault',
      name: 'Test Search Vault',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    'utf-8'
  );
  return tmpDir;
}

function cleanupTempVault(vaultRoot: string) {
  if (fs.existsSync(vaultRoot)) {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  }
}

test('LocalSearchEngine — indexes vault notes and performs full-text queries', async () => {
  const vaultRoot = createTempVault();
  try {
    const clientNote = `---
id: doc_acme
title: Acme Corp Overview
type: client
client: Acme
tags:
  - strategic
  - enterprise
---

# Acme Corp Overview

Acme Corp is a leading provider of innovative hardware solutions and widgets.
`;
    fs.writeFileSync(path.join(vaultRoot, '01_CLIENTS/acme.md'), clientNote, 'utf-8');

    const searchEngine = new LocalSearchEngine();
    const status = await searchEngine.indexVault(vaultRoot);

    assert.equal(status.total_indexed, 1);
    assert.equal(status.indexed_categories.client, 1);

    // Verify search index file created
    const indexData = loadSearchIndex(vaultRoot);
    assert.ok(indexData.documents['01_CLIENTS/acme.md']);

    // Perform query
    const results = await searchEngine.search(vaultRoot, { term: 'innovative hardware' });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Acme Corp Overview');
    assert.equal(results[0].category, 'client');
    assert.ok(results[0].score > 0);
    assert.ok(results[0].snippet.includes('innovative hardware'));

    // Verify read-only invariant
    assert.equal(fs.readFileSync(path.join(vaultRoot, '01_CLIENTS/acme.md'), 'utf-8'), clientNote);
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('LocalSearchEngine — filters results by category, client, and tags', async () => {
  const vaultRoot = createTempVault();
  try {
    fs.writeFileSync(
      path.join(vaultRoot, '01_CLIENTS/client1.md'),
      '---\ntitle: Client Alpha\ntype: client\nclient: Alpha\ntags: [tech]\n---\n# Client Alpha\nTech company.',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(vaultRoot, '04_POSITIONING/pos1.md'),
      '---\ntitle: Tech Positioning\ntype: positioning\nclient: Alpha\ntags: [positioning]\n---\n# Tech Strategy\nPositioning strategy for tech.',
      'utf-8'
    );

    const searchEngine = new LocalSearchEngine();
    await searchEngine.indexVault(vaultRoot);

    // Category filter
    const clientResults = await searchEngine.search(vaultRoot, { category: 'client' });
    assert.equal(clientResults.length, 1);
    assert.equal(clientResults[0].title, 'Client Alpha');

    const posResults = await searchEngine.search(vaultRoot, { category: 'positioning' });
    assert.equal(posResults.length, 1);
    assert.equal(posResults[0].title, 'Tech Positioning');

    // Client filter
    const alphaResults = await searchEngine.search(vaultRoot, { client: 'Alpha' });
    assert.equal(alphaResults.length, 2);

    // Tag filter
    const techTagResults = await searchEngine.search(vaultRoot, { tags: ['tech'] });
    assert.equal(techTagResults.length, 1);
    assert.equal(techTagResults[0].title, 'Client Alpha');
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('LocalSearchEngine — incremental re-indexing skips unchanged files', async () => {
  const vaultRoot = createTempVault();
  try {
    const filePath = path.join(vaultRoot, '01_CLIENTS/doc.md');
    fs.writeFileSync(filePath, '# Note One\nInitial content.', 'utf-8');

    const searchEngine = new LocalSearchEngine();
    const status1 = await searchEngine.indexVault(vaultRoot);
    assert.equal(status1.total_indexed, 1);

    // Re-index unchanged
    const status2 = await searchEngine.indexVault(vaultRoot);
    assert.equal(status2.total_indexed, 1);

    // Update note content
    fs.writeFileSync(filePath, '# Note One\nUpdated content with new keywords.', 'utf-8');
    await searchEngine.indexVault(vaultRoot);

    const results = await searchEngine.search(vaultRoot, { term: 'keywords' });
    assert.equal(results.length, 1);
    assert.ok(results[0].snippet.includes('keywords'));
  } finally {
    cleanupTempVault(vaultRoot);
  }
});

test('M5 preserves source/index bytes on symlink, corrupt index and interrupted lock',async()=>{
 const v=createTempVault(),e=new LocalSearchEngine();const note=path.join(v,'01_CLIENTS/safe.md'),idx=path.join(v,'00_SYSTEM/SEARCH_INDEX.json');
 try{
  fs.writeFileSync(note,'# Safe');fs.symlinkSync(note,idx);await assert.rejects(e.indexVault(v));assert.equal(fs.readFileSync(note,'utf8'),'# Safe');fs.unlinkSync(idx);
  await e.indexVault(v);const previous=fs.readFileSync(idx);fs.symlinkSync(note,path.join(v,'01_CLIENTS/link.md'));await assert.rejects(e.indexVault(v));assert.deepEqual(fs.readFileSync(idx),previous);fs.unlinkSync(path.join(v,'01_CLIENTS/link.md'));
  fs.writeFileSync(idx,'{corrupt');await assert.rejects(e.getIndexStatus(v));await assert.rejects(e.indexVault(v));assert.equal(fs.readFileSync(idx,'utf8'),'{corrupt');fs.writeFileSync(idx,previous);
  fs.mkdirSync(path.join(v,'00_SYSTEM/.search-lock'));await assert.rejects(e.indexVault(v));assert.ok(fs.existsSync(path.join(v,'00_SYSTEM/.search-lock')));fs.rmdirSync(path.join(v,'00_SYSTEM/.search-lock'));
 }finally{cleanupTempVault(v);}
});

test('M5 Unicode, status filters, stable IDs, pagination and stale source detection',async()=>{
 const v=createTempVault(),e=new LocalSearchEngine();try{
  fs.mkdirSync(path.join(v,'01_CLIENTS/a'));fs.mkdirSync(path.join(v,'01_CLIENTS/b'));
  for(const [d,status]of [['a','draft'],['b','approved']])fs.writeFileSync(path.join(v,`01_CLIENTS/${d}/same.md`),`---\ntitle: Caffè\nstatus: ${status}\ntags: [tech]\n---\n# Caffè\n${'a'.repeat(179)}è😀 tail caffè`);
  await e.indexVault(v);const hits=await e.search(v,{term:'caffe'});assert.equal(hits.length,2);assert.notEqual(hits[0].id,hits[1].id);assert.ok(hits.every(h=>!h.snippet.includes('\uFFFD')));
  assert.equal((await e.search(v,{status:'approved'})).length,1);assert.equal((await e.search(v,{limit:0})).length,0);await assert.rejects(e.search(v,{offset:-1}));
  const idx=fs.readFileSync(path.join(v,'00_SYSTEM/SEARCH_INDEX.json'));await e.search(v,{term:'caffe'});assert.deepEqual(fs.readFileSync(path.join(v,'00_SYSTEM/SEARCH_INDEX.json')),idx);
  fs.writeFileSync(path.join(v,'01_CLIENTS/a/same.md'),'# Changed');await assert.rejects(e.search(v,{term:'caffe'}),/stale/);
 }finally{cleanupTempVault(v);}
});
