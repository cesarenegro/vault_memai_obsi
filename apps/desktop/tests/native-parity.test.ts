import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {VaultManager} from '../../../packages/vault-core/src/index.js';
const workspace=path.resolve(import.meta.dirname,'../../..');
const binary=path.join(workspace,'apps/desktop/src-tauri/target/debug/vault-check');
const template=path.join(workspace,'vault-template');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'m2-parity-'));
const native=(...args:string[])=>JSON.parse(execFileSync(binary,args,{encoding:'utf8',cwd:tmp}));
const compare=(root:string)=>{
  const ts=VaultManager.openVault(root),rust=native('open',root);
  for(const [a,b] of [['state','state'],['pageCount','page_count'],['sourceCount','source_count'],['proposalCount','proposal_count'],['integrityStatus','integrity_status'],['name','name'],['snapshotId','snapshot_id']] as const) assert.equal(ts.status[a],rust.status[b],root+': '+a);
  assert.equal(ts.validation.isValid,rust.validation.is_valid);
  assert.equal(ts.validation.checkedFilesCount,rust.validation.checked_files_count,root+": checked files");
  assert.equal(ts.validation.checkedFoldersCount,rust.validation.checked_folders_count,root+": checked folders");
};
try {
  const cases=JSON.parse(fs.readFileSync(path.join(workspace,'tests/fixtures/m2/frontmatter.json'),'utf8'));
  for(const c of cases) {
    const root=path.join(tmp,c.name);native('create',root,template);
    fs.writeFileSync(path.join(root,'01_CLIENTS/note.md'),c.content);
    compare(root);assert.equal(native('open',root).status.state,c.state,c.name);
  }
  for(const kind of ['missing-folder','bad-manifest','directory-file','broken-link','outside-link','cycle','permission']) {
    const root=path.join(tmp,kind);native('create',root,template);
    if(kind==='missing-folder')fs.rmdirSync(path.join(root,'04_POSITIONING'));
    if(kind==='bad-manifest')fs.writeFileSync(path.join(root,'00_SYSTEM/VAULT_MANIFEST.json'),'{}');
    if(kind==='directory-file'){fs.unlinkSync(path.join(root,'00_SYSTEM/HOME.md'));fs.mkdirSync(path.join(root,'00_SYSTEM/HOME.md'));}
    if(kind==='broken-link')fs.symlinkSync('missing',path.join(root,'01_CLIENTS/link'));
    if(kind==='outside-link')fs.symlinkSync(tmp,path.join(root,'01_CLIENTS/link'));
    if(kind==='cycle')fs.symlinkSync('../01_CLIENTS',path.join(root,'01_CLIENTS/link'));
    if(kind==='permission')fs.chmodSync(path.join(root,'00_SYSTEM/HOME.md'),0);
    compare(root);
    if(kind==='permission')fs.chmodSync(path.join(root,'00_SYSTEM/HOME.md'),0o600);
  }
  const readonly=path.join(tmp,'readonly');native('create',readonly,template);
  const snapshot=(p:string):unknown=>fs.readdirSync(p).sort().map(n=>{const f=path.join(p,n);const st=fs.statSync(f);return [n,st.mtimeMs,st.ctimeMs,st.isDirectory()?snapshot(f):fs.readFileSync(f).toString('hex')];});
  const before=snapshot(readonly);compare(readonly);assert.deepEqual(snapshot(readonly),before,'native/TS whole-tree read-only');
  compare(path.join(tmp,'nonexistent'));
  console.log('✅ Real TS/Rust parity: 10 YAML fixtures, 7 filesystem failures, missing path');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
