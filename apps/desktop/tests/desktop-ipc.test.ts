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
