import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SnapshotManager,ManifestVerifier} from '../../../packages/snapshot-engine/src/index.js';
import {VaultManager} from '../../../packages/vault-core/src/index.js';
const root=path.resolve(import.meta.dirname,'../../..');
const binary=path.join(root,'apps/desktop/src-tauri/target/debug/vault-check');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'m3-e2e-'));
const native=(cmd:string,...args:string[])=>JSON.parse(execFileSync(binary,[cmd,...args],{encoding:'utf8',cwd:tmp}));
const compare=(p:string,id?:string)=>{
 const ts=id?SnapshotManager.verifySnapshotIntegrity(p,id):ManifestVerifier.verifyIntegrity(p);
 const rs=id?native('snapshot-verify',p,id):native('integrity',p);
 for(const [a,b]of[['isIntegrityValid','is_integrity_valid'],['manifestPresent','manifest_present'],['verifiedFilesCount','verified_files_count'],['totalManifestedFiles','total_manifested_files'],['modifiedFiles','modified_files'],['missingFiles','missing_files'],['addedFiles','added_files']]as const)assert.deepEqual(ts[a],rs[b],a);
 assert.equal(ts.errors.length>0,rs.errors.length>0);
 return rs;
};
const tree=(p:string):unknown=>fs.readdirSync(p).sort().map(n=>{const f=path.join(p,n),st=fs.lstatSync(f);return[n,st.mtimeMs,st.ctimeMs,st.isDirectory()?tree(f):fs.readFileSync(f).toString('hex')];});
try{
 const p=path.join(tmp,'Vault with spaces');native('create',p,path.join(root,'vault-template'));
 assert.equal(compare(p).is_integrity_valid,true);
 const created=native('snapshot',p,'native E2E');
 const tsSnap=SnapshotManager.createSnapshot(p,'TS E2E');
 assert.equal(compare(p,created.id).is_integrity_valid,true);assert.equal(compare(p,tsSnap.id).is_integrity_valid,true);
 assert.equal(native('open',p).status.page_count,2);assert.equal(VaultManager.openVault(p).status.pageCount,2);
 const before=tree(p);native('snapshots',p);SnapshotManager.listSnapshots(p);compare(p);compare(p,created.id);assert.deepEqual(tree(p),before,'whole-tree read only');
 assert.equal(fs.existsSync(path.join(created.snapshot_path,'00_SYSTEM/SNAPSHOTS')),false);
 // New native process for every operation: persistence must survive reopening.
 assert.equal(native('snapshots',p).length,2);
 fs.writeFileSync(path.join(created.snapshot_path,'00_SYSTEM/HOME.md'),'tampered');
 fs.unlinkSync(path.join(created.snapshot_path,'00_SYSTEM/VAULT_RULES.md'));
 fs.writeFileSync(path.join(created.snapshot_path,'added.bin'),Buffer.from([0,255,42]));
 const corrupt=compare(p,created.id);assert.deepEqual(corrupt.modified_files,['00_SYSTEM/HOME.md']);assert.deepEqual(corrupt.missing_files,['00_SYSTEM/VAULT_RULES.md']);assert.deepEqual(corrupt.added_files,['added.bin']);
 assert.equal(native('snapshots',p).find((s:any)=>s.id===created.id).integrity_status,'corrupted');assert.equal(SnapshotManager.listSnapshots(p).find(s=>s.id===created.id)?.integrityStatus,'corrupted');
 assert.equal(compare(p).is_integrity_valid,true,'archived tampering must not corrupt live Vault');
 // All malformed manifests are rejected by both engines.
 const manifest=path.join(tsSnap.snapshotPath,'snapshot_manifest.json'), original=fs.readFileSync(manifest,'utf8'), valid=JSON.parse(original);
 for(const variant of [{}, {...valid,files:[...valid.files,valid.files[0]]}, {...valid,files:[{...valid.files[0],path:'../outside'}]}, {...valid,snapshot_id:'snap-wrong'}, {...valid,files:[{...valid.files[0],sha256:'g'.repeat(64)}]}]){
  fs.writeFileSync(manifest,JSON.stringify(variant));assert.equal(compare(p,tsSnap.id).is_integrity_valid,false);
 }
 fs.writeFileSync(manifest,original);
 const pending=path.join(p,'00_SYSTEM/SNAPSHOTS/.pending-interrupted');fs.mkdirSync(pending);fs.writeFileSync(path.join(pending,'partial'),'partial');
 assert.equal(native('snapshots',p).length,2);assert.equal(SnapshotManager.listSnapshots(p).length,2);
 const exec=promisify(execFile);
 await Promise.all([0,1,2,3].map(i=>exec(binary,['snapshot',p,`concurrent ${i}`],{cwd:tmp})));
 assert.equal(native('snapshots',p).length,6);assert.equal(fs.readFileSync(path.join(pending,'partial'),'utf8'),'partial');
 const source=path.join(p,'00_SYSTEM/HOME.md');fs.chmodSync(source,0);try{assert.equal(compare(p).is_integrity_valid,false);}finally{fs.chmodSync(source,0o600);}
 const link=path.join(p,'01_CLIENTS/link');fs.symlinkSync(tmp,link);assert.equal(compare(p).is_integrity_valid,false);fs.unlinkSync(link);
 assert.equal(compare(p).is_integrity_valid,true);
 console.log('✅ Native M3 E2E/parity: create, persistence across processes, TS/native cross-verification, live counts, read-only, tamper/missing/added, schema/traversal, interrupted staging, 4 concurrent creations, permissions and symlinks');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
