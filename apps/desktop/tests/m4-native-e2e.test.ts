import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {parseYamlFrontmatter} from '@limen-vault/vault-core';
import {KnowledgeCompiler,loadCompilerIndex} from '../../../packages/knowledge-compiler/src/index.js';
import {FrontmatterSchema} from '@limen-vault/vault-schema';
const bin=path.resolve('src-tauri/target/debug/vault-check');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'limen-m4-e2e-'));
const run=(cmd:string,v:string,rel?:string)=>JSON.parse(execFileSync(bin,[cmd,v,...(rel?[rel]:[])],{encoding:'utf8'}));
function fixture(name:string){const v=path.join(temp,name);for(const d of ['20_RAW_SOURCES/a','20_RAW_SOURCES/b','00_SYSTEM','90_PROPOSALS'])fs.mkdirSync(path.join(v,d),{recursive:true});return v;}
function note(v:string,r:any){const text=fs.readFileSync(path.join(v,r.draft_relative_path),'utf8');const end=text.indexOf('\n---',4);return {fm:FrontmatterSchema.parse(parseYamlFrontmatter(text)?.data),body:text.slice(end+4),text};}
const c=new KnowledgeCompiler();
try{
 const ts=fixture('ts'),rust=fixture('rust');
 const cases=[['a/doc.md','# Title C:\\draft "quoted"\nOriginal'],['b/doc.md','# Other\nContent'],['html.html','<SCRIPT>alert(1)</SCRIPT><iframe>bad</iframe><style>bad</style><p onclick="bad()">Safe</p><img src="https://example.test/a" onerror="bad()"><div title="a > b">Text</div>'],['unclosed.html','<p>Before</p><SCRIPT>never render'],['unicode_è.txt','Test UTF8 è']];
 for(const [rel,raw] of cases){const p=`20_RAW_SOURCES/${rel}`;for(const v of [ts,rust])fs.writeFileSync(path.join(v,p),raw);
  const a=await c.compileSourceToDraft(ts,p),b=run('compile',rust,p);assert.equal(a.status,'compiled');assert.equal(b.status,'compiled');
  const na=note(ts,a),nb=note(rust,b);for(const key of ['title','type','status','source_ids','tags'])assert.deepEqual(na.fm[key as keyof typeof na.fm],nb.fm[key as keyof typeof nb.fm]);assert.equal(na.body,nb.body);
  assert.equal(fs.readFileSync(path.join(rust,p),'utf8'),raw);assert.equal(fs.readFileSync(path.join(ts,p),'utf8'),raw);
  assert.equal(run('compile',rust,p).status,'unchanged');assert.equal((await c.compileSourceToDraft(ts,p)).status,'unchanged');
 }
 console.log('PASS shared TS/Rust extraction, YAML, full provenance and unchanged sources');
 const p='20_RAW_SOURCES/a/doc.md';const old=run('compile',rust,p);const oldPath=path.join(rust,old.draft_relative_path);const human=fs.readFileSync(oldPath,'utf8')+'\nHuman revision';fs.writeFileSync(oldPath,human);fs.writeFileSync(path.join(rust,p),'# Updated');const revised=run('compile',rust,p);assert.equal(revised.status,'compiled');assert.notEqual(revised.draft_relative_path,old.draft_relative_path);assert.equal(fs.readFileSync(oldPath,'utf8'),human);
 const proposals=run('proposals',rust);assert.equal(proposals.length,6);assert.ok(proposals.some((r:any)=>r.markdown===human));
 // A fresh process reads the index and skips the Rust output in TS as well.
 assert.equal((await c.compileSourceToDraft(rust,p)).status,'unchanged');assert.equal(loadCompilerIndex(rust).records[p].draft_relative_path,revised.draft_relative_path);
 console.log('PASS persistent revisions, human edits, preview listing, cross-runtime index');
 const safety=fixture('safety'),outside=path.join(temp,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(safety,p),'# Safe');
 fs.rmdirSync(path.join(safety,'90_PROPOSALS'));fs.symlinkSync(outside,path.join(safety,'90_PROPOSALS'));assert.equal(run('compile',safety,p).status,'error');assert.deepEqual(fs.readdirSync(outside),[]);fs.unlinkSync(path.join(safety,'90_PROPOSALS'));fs.mkdirSync(path.join(safety,'90_PROPOSALS'));
 fs.symlinkSync(path.join(safety,p),path.join(safety,'20_RAW_SOURCES/link.md'));assert.equal(run('compile',safety,'20_RAW_SOURCES/link.md').status,'error');
 fs.writeFileSync(path.join(safety,'00_SYSTEM/other.md'),'# Not RAW');assert.equal(run('compile',safety,'00_SYSTEM/other.md').status,'error');assert.equal(run('compile',safety,'20_RAW_SOURCES/../00_SYSTEM/other.md').status,'error');
 fs.writeFileSync(path.join(safety,'20_RAW_SOURCES/invalid.txt'),Buffer.from([255]));const batch=run('compile-batch',safety);assert.equal(batch.compiled_count,1);assert.equal(batch.error_count,2);
 const indexPath=path.join(safety,'00_SYSTEM/COMPILER_INDEX.json');const indexBytes=fs.readFileSync(indexPath);fs.writeFileSync(indexPath,'{bad');assert.equal(run('compile',safety,p).status,'error');assert.equal(fs.readFileSync(indexPath,'utf8'),'{bad');fs.writeFileSync(indexPath,indexBytes);
 fs.mkdirSync(path.join(safety,'00_SYSTEM/.compiler-lock'));assert.equal(run('compile',safety,p).status,'error');assert.ok(fs.existsSync(path.join(safety,'00_SYSTEM/.compiler-lock')));assert.equal((await c.compileSourceToDraft(safety,p)).status,'error');fs.rmdirSync(path.join(safety,'00_SYSTEM/.compiler-lock'));
 const before=fs.readdirSync(path.join(safety,'90_PROPOSALS'));fs.chmodSync(path.join(safety,'90_PROPOSALS'),0o500);fs.writeFileSync(path.join(safety,p),'# Changed');assert.equal(run('compile',safety,p).status,'error');fs.chmodSync(path.join(safety,'90_PROPOSALS'),0o700);assert.deepEqual(fs.readdirSync(path.join(safety,'90_PROPOSALS')),before);
 console.log('PASS symlink confinement, RAW boundary, invalid UTF8, batch continuation, corrupt index, lock and denied writes');
 const concurrent=fixture('concurrent');fs.writeFileSync(path.join(concurrent,p),'# Concurrent');
 const jobs=await Promise.all(Array.from({length:4},()=>new Promise<any>((resolve,reject)=>{const child=spawn(bin,['compile',concurrent,p]);let out='';child.stdout.on('data',b=>out+=b);child.on('error',reject);child.on('exit',code=>code?reject(Error(`exit ${code}`)):resolve(JSON.parse(out)));})));
 assert.equal(jobs.filter(r=>r.status==='compiled').length,1);assert.ok(jobs.every(r=>['compiled','unchanged','error'].includes(r.status)));assert.equal(fs.readdirSync(path.join(concurrent,'90_PROPOSALS')).length,1);assert.equal(run('compile',concurrent,p).status,'unchanged');
 console.log('PASS concurrent native processes: one revision, no lost index, retry succeeds');
 console.log('M4 native E2E PASS');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
