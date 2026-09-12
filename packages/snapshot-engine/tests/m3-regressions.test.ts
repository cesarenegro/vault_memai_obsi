import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {VaultManager,SafeDir} from '@limen-vault/vault-core';
import {SnapshotManager,ManifestVerifier} from '../src/index.js';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'m3-regressions-'));
const fixture=(name:string)=>{const p=path.join(tmp,name);VaultManager.createVault(p);return p;};
const tree=(p:string):unknown=>fs.readdirSync(p).sort().map(n=>{const f=path.join(p,n),st=fs.lstatSync(f);return[n,st.mtimeMs,st.ctimeMs,st.isDirectory()?tree(f):fs.readFileSync(f).toString('hex')];});
try{
 const p=fixture('main');const snap=SnapshotManager.createSnapshot(p,'first');
 assert.equal(VaultManager.openVault(p).status.pageCount,2);
 const before=tree(p);assert.equal(ManifestVerifier.verifyIntegrity(p).isIntegrityValid,true);SnapshotManager.listSnapshots(p);SnapshotManager.verifySnapshotIntegrity(p,snap.id);assert.deepEqual(tree(p),before);
 fs.writeFileSync(path.join(snap.snapshotPath,'00_SYSTEM/HOME.md'),'corrupt');
 fs.unlinkSync(path.join(snap.snapshotPath,'00_SYSTEM/VAULT_RULES.md'));
 fs.writeFileSync(path.join(snap.snapshotPath,'extra.txt'),'extra');
 const report=SnapshotManager.verifySnapshotIntegrity(p,snap.id);
 assert.deepEqual(report.modifiedFiles,['00_SYSTEM/HOME.md']);assert.deepEqual(report.missingFiles,['00_SYSTEM/VAULT_RULES.md']);assert.deepEqual(report.addedFiles,['extra.txt']);
 assert.equal(SnapshotManager.listSnapshots(p)[0].integrityStatus,'corrupted');
 fs.writeFileSync(path.join(snap.snapshotPath,'snapshot_manifest.json'),'{}');assert.equal(SnapshotManager.listSnapshots(p)[0].integrityStatus,'corrupted');
 assert.equal(SnapshotManager.verifySnapshotIntegrity(p,'../escape').isIntegrityValid,false);
 const secure=fixture('secure'),outside=path.join(tmp,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep'),'keep');
 fs.symlinkSync(outside,path.join(secure,'00_SYSTEM/SNAPSHOTS'));assert.throws(()=>SnapshotManager.createSnapshot(secure));assert.throws(()=>SnapshotManager.listSnapshots(secure));assert.deepEqual(fs.readdirSync(outside),['keep']);
 fs.unlinkSync(path.join(secure,'00_SYSTEM/SNAPSHOTS'));fs.symlinkSync(outside,path.join(secure,'01_CLIENTS/link'));assert.throws(()=>SnapshotManager.createSnapshot(secure));assert.deepEqual(fs.readdirSync(path.join(secure,'00_SYSTEM/SNAPSHOTS')),[]);
 fs.unlinkSync(path.join(secure,'01_CLIENTS/link'));
 // Fault injection at manifest persistence: all partial files must be cleaned, existing snapshots preserved.
 const previous=SnapshotManager.createSnapshot(secure);const original=tree(previous.snapshotPath);const write=SafeDir.prototype.writeNew;
 SafeDir.prototype.writeNew=function(name,bytes){if(name==='snapshot_manifest.json')throw new Error('injected manifest write failure');return write.call(this,name,bytes);};
 try{assert.throws(()=>SnapshotManager.createSnapshot(secure),/injected/);}finally{SafeDir.prototype.writeNew=write;}
 assert.deepEqual(fs.readdirSync(path.join(secure,'00_SYSTEM/SNAPSHOTS')),[previous.id]);assert.deepEqual(tree(previous.snapshotPath),original);
 const home=path.join(secure,'00_SYSTEM/HOME.md');fs.chmodSync(home,0);try{assert.equal(ManifestVerifier.verifyIntegrity(secure).isIntegrityValid,false);assert.throws(()=>SnapshotManager.createSnapshot(secure));}finally{fs.chmodSync(home,0o600);}
 // A colliding final directory is never overwritten by exclusive publication.
 const c=SafeDir.open(outside);try{c.mkdir('from');c.mkdir('to');assert.throws(()=>c.renameExclusive('from','to'));assert.deepEqual(c.names(),['from','keep','to']);}finally{c.close();}
 console.log('✅ M3 regressions: live counts, whole-tree read-only, tamper/missing/added, invalid manifest/id, symlinks, rollback at manifest write, permission errors and exclusive publication');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
