import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VaultManager, VaultCreator, VaultValidator, sanitizeVaultPath } from '../src/index.js';
import { SafeDir } from '../src/safe-fs.js';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'m2-regressions-'));
const cases=JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/m2/frontmatter.json',import.meta.url),'utf8'));
try {
  for (const item of cases) {
    const root=path.join(tmp,item.name); VaultManager.createVault(root);
    fs.writeFileSync(path.join(root,'01_CLIENTS/note.md'),item.content);
    const result=VaultManager.openVault(root);
    assert.equal(result.status.state,item.state,item.name);
    assert.equal(result.status.pageCount,3,item.name+' page count');
    assert.equal(result.validation.checkedFilesCount,4,item.name+' file count');
  }
  const root=path.join(tmp,'security');VaultManager.createVault(root);
  assert.equal(path.basename(sanitizeVaultPath(root,'..note.md')),'..note.md');
  const system=path.join(root,'00_SYSTEM');
  const fd=SafeDir.open(root);
  const pinned=fd.dir('00_SYSTEM'); const originalHome=pinned.read('HOME.md');
  fs.renameSync(system,path.join(root,'original-system'));
  fs.symlinkSync(tmp,system);
  assert.throws(()=>fd.dir('00_SYSTEM'));
  assert.equal(pinned.read('HOME.md'),originalHome,'opened directory remains pinned during replacement'); pinned.close();
  assert.equal(VaultManager.openVault(root).status.state,'INVALID');
  fd.close();fs.unlinkSync(system);fs.renameSync(path.join(root,'original-system'),system);
  fs.symlinkSync('missing',path.join(root,'01_CLIENTS/broken'));
  assert.equal(VaultManager.openVault(root).status.state,'INVALID');fs.unlinkSync(path.join(root,'01_CLIENTS/broken'));
  fs.symlinkSync('../01_CLIENTS',path.join(root,'01_CLIENTS/cycle'));
  assert.equal(VaultManager.openVault(root).status.state,'INVALID');fs.unlinkSync(path.join(root,'01_CLIENTS/cycle'));
  const home=path.join(system,'HOME.md');fs.chmodSync(home,0);
  assert.equal(VaultManager.openVault(root).status.state,'INVALID');fs.chmodSync(home,0o600);
  const before=(p:string):unknown=>fs.readdirSync(p).sort().map(n=>{const f=path.join(p,n);const s=fs.statSync(f);return [n,s.mtimeMs,s.ctimeMs,s.isDirectory()?before(f):fs.readFileSync(f).toString('hex')];});
  const tree=before(root);VaultManager.openVault(root);VaultValidator.validateVault(root);assert.deepEqual(before(root),tree);
  const occupied=path.join(tmp,'occupied');fs.mkdirSync(occupied);fs.writeFileSync(path.join(occupied,'user.txt'),'keep');
  assert.throws(()=>VaultManager.createVault(occupied));assert.equal(fs.readFileSync(path.join(occupied,'user.txt'),'utf8'),'keep');
  const absent=path.join(tmp,'absent');assert.throws(()=>VaultCreator.createVault(absent,undefined,path.join(tmp,'missing-template')));assert.equal(fs.existsSync(absent),false);
  const manifest=path.join(root,'00_SYSTEM/VAULT_MANIFEST.json');fs.writeFileSync(manifest,'{"schema_version":1,"vault_id":"x"}');
  assert.equal(VaultManager.openVault(root).status.state,'INVALID');
  console.log('✅ M2 regressions: 10 shared YAML fixtures, exact counts, symlinks, permissions, whole-tree read-only, template preflight and occupied target');
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
