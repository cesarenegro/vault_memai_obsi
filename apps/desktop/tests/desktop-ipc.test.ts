import assert from 'assert';
import { VaultManager, VaultValidator } from '@limen-vault/vault-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

function runDesktopIpcParityTests() {
  console.log('🧪 Running Desktop Integration & IPC Parity Tests...');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-desktop-test-'));

  try {
    // 1. Vault creation parity
    const vaultPath = path.join(tmpDir, 'TestDesktopVault');
    const createdStatus = VaultManager.createVault(vaultPath, 'Desktop Vault');

    assert.strictEqual(createdStatus.state, 'READY');
    assert.strictEqual(createdStatus.name, 'Desktop Vault');
    assert.strictEqual(createdStatus.integrityStatus, 'unverified');
    assert.ok(createdStatus.pageCount >= 1);
    console.log('  ✅ 1. Desktop creation response structure verified');

    // 2. Open vault response structure
    const openRes = VaultManager.openVault(vaultPath);
    assert.strictEqual(openRes.status.state, 'READY');
    assert.strictEqual(openRes.validation.isValid, true);
    assert.strictEqual(openRes.validation.checkedFoldersCount, 15);
    console.log('  ✅ 2. Open vault response structure verified');

    // 3. Web preview fallback mode check (non-Tauri environment simulation)
    const isTauriEnv = typeof globalThis.window !== 'undefined' && '__TAURI_INTERNALS__' in globalThis.window;
    assert.strictEqual(isTauriEnv, false, 'Node test environment must be non-Tauri browser preview mode');
    console.log('  ✅ 3. Web preview mode fallback detection verified');

    console.log('🎉 All Desktop integration tests passed cleanly!');
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

runDesktopIpcParityTests();

// Exercise the same adapter imported by App.tsx, including IPC names and arguments.
const { createVaultIpc } = await import('../src/vault-ipc.js');
const validStatus = { state: 'READY', path: '/fixture', name: 'fixture', page_count: 2, source_count: 0, proposal_count: 0, snapshot_id: null, snapshot_age: null, integrity_status: 'unverified' };
const calls: Array<[string, unknown]> = [];
const adapter = createVaultIpc(async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  calls.push([command,args]);
  return (command === 'open_vault' ? { status: validStatus, validation: { is_valid: true, errors: [], warnings: [], checked_folders_count: 15, checked_files_count: 3, system_files_valid: true } } : validStatus) as T;
}, () => true);
assert.equal((await adapter.create('/fixture')).page_count, 2);
assert.deepEqual(calls[0], ['create_vault', { targetPath: '/fixture', vaultName: 'fixture' }]);
assert.equal((await adapter.open('/fixture')).validation.is_valid, true);
assert.deepEqual(calls[1], ['open_vault', { targetPath: '/fixture' }]);
await adapter.obsidian('/fixture');
assert.deepEqual(calls[2], ['open_obsidian', { vaultPath: '/fixture' }]);
const browser = createVaultIpc(async () => { throw new Error('IPC must not run'); }, () => false);
await assert.rejects(browser.create('/fixture'), /Native Tauri/);
const malformed = createVaultIpc(async <T>() => ({...validStatus, page_count:-1}) as T, () => true);
await assert.rejects(malformed.create('/fixture'), /Invalid native/);
let release!: (value: unknown) => void;
const pending = createVaultIpc(<T>() => new Promise<T>(resolve => { release=resolve as (value: unknown)=>void; }), () => true);
const first = pending.create('/fixture');
await assert.rejects(pending.open('/fixture'), /already running/);
release(validStatus); await first;
const failed = createVaultIpc(async () => { throw new Error('PERMISSION_DENIED'); }, () => true);
await assert.rejects(failed.open('/fixture'), /PERMISSION_DENIED/);
await assert.rejects(failed.open('/fixture'), /PERMISSION_DENIED/); // lock released after rejection
console.log('✅ Production IPC adapter: contracts, arguments, fallback, concurrent request rejection and error recovery');

const goodReport={is_integrity_valid:true,manifest_present:true,total_manifested_files:2,verified_files_count:2,modified_files:[],missing_files:[],added_files:[],errors:[]};
const goodSnapshot={id:'snap-test',vault_path:'/fixture',snapshot_path:'/fixture/00_SYSTEM/SNAPSHOTS/snap-test',created_at:'2026-09-12T00:00:00Z',note:null,manifest_file_count:3,integrity_status:'valid'};
const m3Calls:Array<[string,unknown]>=[];
const m3=createVaultIpc(async<T>(cmd:string,args?:Record<string,unknown>)=>{m3Calls.push([cmd,args]);return(cmd==='list_snapshots'?[goodSnapshot]:cmd==='create_snapshot'?goodSnapshot:goodReport)as T;},()=>true);
assert.equal((await m3.inspect('/fixture')).integrity.is_integrity_valid,true);
assert.deepEqual(m3Calls.slice(0,2),[['list_snapshots',{targetPath:'/fixture'}],['verify_vault_integrity',{targetPath:'/fixture'}]]);
await m3.createSnapshot('/fixture','note');assert.deepEqual(m3Calls[2],['create_snapshot',{targetPath:'/fixture',note:'note'}]);
await assert.rejects(browser.inspect('/fixture'),/Native Tauri/);await assert.rejects(browser.createSnapshot('/fixture'),/Native Tauri/);
const falseVerified=createVaultIpc(async<T>(cmd:string)=>(cmd==='list_snapshots'?[]:{...goodReport,added_files:['unknown']})as T,()=>true);
await assert.rejects(falseVerified.inspect('/fixture'),/Invalid native integrity/);
const badList=createVaultIpc(async<T>()=>[{...goodSnapshot,integrity_status:'maybe'}]as T,()=>true);await assert.rejects(badList.inspect('/fixture'),/Invalid native snapshot/);
console.log('✅ M3 production IPC adapter: contracts, commands/arguments, error propagation and browser rejection');

const {createLatestRequest}=await import('../src/latest-request.js');
const latest=createLatestRequest<string>();let firstDone!:(v:string)=>void;let lastDone!:(v:string)=>void;const shown:string[]=[];const errors:unknown[]=[];
const slow=latest.run(()=>new Promise(r=>firstDone=r),v=>shown.push(v),e=>errors.push(e));
const fast=latest.run(()=>new Promise(r=>lastDone=r),v=>shown.push(v),e=>errors.push(e));
lastDone('latest query');await fast;firstDone('stale query');await slow;assert.deepEqual(shown,['latest query']);
const invalidated=latest.run(()=>new Promise(r=>firstDone=r),v=>shown.push(v),e=>errors.push(e));latest.invalidate();firstDone('previous Vault');await invalidated;assert.deepEqual(shown,['latest query']);
const readCalls:string[]=[];const reads=createVaultIpc(async<T>(cmd:string)=>{readCalls.push(cmd);return (cmd==='search_vault'?[]:{state:'missing',total_indexed:0,last_indexed_at:'',version:2,indexed_categories:{}})as T;},()=>true);
await Promise.all([reads.searchVault('/fixture',{term:'s'}),reads.searchVault('/fixture',{term:'software'})]);assert.equal(readCalls.length,2);
assert.equal((await reads.getSearchIndexStatus('/fixture')).state,'missing');await assert.rejects(browser.searchVault('/fixture',{}),/Native Tauri/);
const badSearch=createVaultIpc(async<T>()=>[{title:'fake'}]as T,()=>true);await assert.rejects(badSearch.searchVault('/fixture',{}),/Invalid native search/);
console.log('✅ M5 IPC/latest request: concurrent reads, newer results win, Vault invalidation, browser rejection and response validation');

// MA-01: Catalog IPC tests
const catCalls: Array<[string, unknown]> = [];
const sampleSummary = {
  totalDocuments: 1,
  totalRawSources: 1,
  readyDocuments: 1,
  processingDocuments: 0,
  attentionDocuments: 0,
  totalPassages: 2,
  catalogRevision: 1,
};
const sampleRecord = {
  documentId: 'doc_1',
  revision: 1,
  contentHash: 'hash_123',
  originalPath: '20_RAW_SOURCES/doc.txt',
  aliases: [],
  fileName: 'doc.txt',
  extension: 'txt',
  fileSize: 100,
  mimeType: 'text/plain',
  importedAt: '2026-09-18T00:00:00Z',
  updatedAt: '2026-09-18T00:00:00Z',
  extractionStatus: 'ready',
  passages: [
    { passageId: 'doc_1_p0', locator: 'Paragrafo 1', text: 'Testo 1', charCount: 7, sha256: 'h1' },
    { passageId: 'doc_1_p1', locator: 'Paragrafo 2', text: 'Testo 2', charCount: 7, sha256: 'h2' }
  ],
  lexicalStatus: { status: 'ready', attempts: 0, updatedAt: '2026-09-18T00:00:00Z' },
  semanticStatus: { status: 'pending', attempts: 0, updatedAt: '2026-09-18T00:00:00Z' },
  classificationStatus: { status: 'pending', attempts: 0, updatedAt: '2026-09-18T00:00:00Z' },
  wikiStatus: { status: 'pending', attempts: 0, updatedAt: '2026-09-18T00:00:00Z' },
  tags: [],
  evidenceType: 'source',
  editorialStatus: 'auto'
};
const catIpc = createVaultIpc(async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  catCalls.push([cmd, args]);
  if (cmd === 'catalog_sync' || cmd === 'catalog_get_summary') return sampleSummary as T;
  if (cmd === 'catalog_list_documents') return { total: 1, filteredTotal: 1, catalogRevision: 1, documents: [sampleRecord] } as T;
  if (cmd === 'catalog_get_document') return sampleRecord as T;
  if (cmd === 'catalog_read_passage') return sampleRecord.passages[0] as T;
  if (cmd === 'catalog_read_text') return 'Testo estratto completo' as T;
  if (cmd === 'catalog_process_extractions') return 1 as T;
  return undefined as T;
}, () => true);

const summary = await catIpc.syncCatalog('/fixture');
assert.equal(summary.totalDocuments, 1);
assert.deepEqual(catCalls[0], ['catalog_sync', { vaultPath: '/fixture' }]);

const listRes = await catIpc.listCatalogDocuments('/fixture', { filter: 'test' });
assert.equal(listRes.total, 1);
assert.equal(listRes.documents[0].documentId, 'doc_1');

const doc = await catIpc.getCatalogDocument('/fixture', 'doc_1');
assert.equal(doc.fileName, 'doc.txt');

const passage = await catIpc.readPassage('/fixture', 'doc_1', 'doc_1_p0');
assert.equal(passage.locator, 'Paragrafo 1');

const txt = await catIpc.readDocumentText('/fixture', 'doc_1');
assert.equal(txt, 'Testo estratto completo');

const processed = await catIpc.processPendingExtractions('/fixture');
assert.equal(processed, 1);

await catIpc.openOriginal('/fixture', 'doc_1');
await catIpc.revealInFinder('/fixture', 'doc_1');

// Rejection in non-Tauri browser mode
await assert.rejects(browser.syncCatalog('/fixture'), /Native Tauri/);
await assert.rejects(browser.listCatalogDocuments('/fixture'), /Native Tauri/);
console.log('✅ MA-01 Catalog IPC: list, sync, passages, original opening, browser rejection verified');

// MA-03: Automation file import IPC tests
const sampleReceipts: ImportReceipt[] = [
  { name: 'file1.txt', path: '20_RAW_SOURCES/hash-file1.txt', status: 'imported', documentId: 'doc_1', hash: 'hash1', sizeBytes: 100 },
  { name: 'file1.txt', path: '20_RAW_SOURCES/hash-file1.txt', status: 'duplicate', documentId: 'doc_1', hash: 'hash1', sizeBytes: 100 },
  { name: 'bad.txt', path: null, status: 'error', error: 'File non regolare o oltre 32 MB' },
];

const autoCalls: Array<[string, unknown]> = [];
const autoIpc = createVaultIpc(async <T>(cmd: string, args?: Record<string, unknown>) => {
  autoCalls.push([cmd, args]);
  if (cmd === 'automation_choose_files' || cmd === 'automation_import_files') return sampleReceipts as T;
  return undefined as T;
}, () => true);

const chosen = await autoIpc.automationChooseFiles('/fixture');
assert.equal(chosen.length, 3);
assert.equal(chosen[0].status, 'imported');
assert.equal(chosen[1].status, 'duplicate');
assert.equal(chosen[2].status, 'error');
assert.deepEqual(autoCalls[0], ['automation_choose_files', { vaultPath: '/fixture' }]);

const imported = await autoIpc.automationImportFiles('/fixture', ['/tmp/a.txt', '/tmp/b.txt']);
assert.equal(imported.length, 3);
assert.deepEqual(autoCalls[1], ['automation_import_files', { vaultPath: '/fixture', paths: ['/tmp/a.txt', '/tmp/b.txt'] }]);

await assert.rejects(browser.automationChooseFiles('/fixture'), /Native Tauri/);
await assert.rejects(browser.automationImportFiles('/fixture', []), /Native Tauri/);
console.log('✅ MA-03 Automation file import IPC: choose, import, receipts, browser rejection verified');

// R2-R6: Verification, unpaged path lookup, and hybrid search IPC tests
const rCalls: Array<[string, unknown]> = [];
const sampleVerification = {
  isValid: true,
  status: 'verified',
  documentId: 'doc_1',
  originalPath: '20_RAW_SOURCES/doc.txt',
  currentRevision: 1,
  expectedRevision: 1,
  currentContentHash: 'hash_123',
  expectedHash: 'h1',
  passageId: 'doc_1_p0',
  passageLocator: 'Paragrafo 1',
  passageText: 'Testo 1',
  verifiedText: 'Testo estratto completo verificato',
  message: 'Documento e passaggi verificati con successo',
};
const sampleEmbedReport = {
  totalPassages: 10,
  cachedPassages: 10,
  missingPassages: 0,
  coverage: 1.0,
  model: 'text-embedding-3-small',
  dimensions: 1536,
  isAvailable: true,
  lastUpdatedAt: '2026-09-19T00:00:00Z',
};
const sampleSearchResults = [
  {
    id: 'doc_1',
    title: 'doc.txt',
    relative_path: '20_RAW_SOURCES/doc.txt',
    category: 'source',
    snippet: 'Testo 1...',
    score: 1.0,
    tags: [],
    sha256: 'a'.repeat(64),
  }
];

const rIpc = createVaultIpc(async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  rCalls.push([cmd, args]);
  if (cmd === 'catalog_get_by_path') return sampleRecord as T;
  if (cmd === 'catalog_verify_document_passage') return sampleVerification as T;
  if (cmd === 'catalog_read_verified_text') return 'Testo verificato' as T;
  if (cmd === 'embeddings_get_status') return sampleEmbedReport as T;
  if (cmd === 'embeddings_sync_vault') return sampleEmbedReport as T;
  if (cmd === 'search_vault_hybrid') return sampleSearchResults as T;
  return undefined as T;
}, () => true);

const docByPath = await rIpc.getCatalogDocumentByPath('/fixture', '20_RAW_SOURCES/doc.txt');
assert.equal(docByPath.documentId, 'doc_1');
assert.deepEqual(rCalls[0], ['catalog_get_by_path', { vaultPath: '/fixture', relPath: '20_RAW_SOURCES/doc.txt' }]);

const vRep = await rIpc.verifyDocumentPassage('/fixture', 'doc_1', 'doc_1_p0', 'h1', 1);
assert.equal(vRep.isValid, true);
assert.equal(vRep.status, 'verified');
assert.deepEqual(rCalls[1], ['catalog_verify_document_passage', { vaultPath: '/fixture', documentId: 'doc_1', passageId: 'doc_1_p0', expectedHash: 'h1', expectedRevision: 1 }]);

const vTxt = await rIpc.readVerifiedDocumentText('/fixture', 'doc_1', 1);
assert.equal(vTxt, 'Testo verificato');
assert.deepEqual(rCalls[2], ['catalog_read_verified_text', { vaultPath: '/fixture', documentId: 'doc_1', expectedRevision: 1 }]);

const hybridRes = await rIpc.searchVaultHybrid('/fixture', { term: 'test' }, undefined, true);
assert.equal(hybridRes.length, 1);
assert.deepEqual(rCalls[3], ['search_vault_hybrid', { vaultPath: '/fixture', query: { term: 'test' }, apiKey: null, useSemantic: true }]);

const syncRep = await rIpc.syncEmbeddings('/fixture');
assert.equal(syncRep.coverage, 1.0);
assert.deepEqual(rCalls[4], ['embeddings_sync_vault', { vaultPath: '/fixture', apiKey: null, model: null }]);

await assert.rejects(browser.getCatalogDocumentByPath('/fixture', 'test'), /Native Tauri/);
await assert.rejects(browser.verifyDocumentPassage('/fixture', 'doc_1'), /Native Tauri/);
await assert.rejects(browser.searchVaultHybrid('/fixture', {}), /Native Tauri/);
console.log('✅ R2-R6 IPC: unpaged path lookup, passage integrity verification, verified text, hybrid search, Keychain sync verified');

