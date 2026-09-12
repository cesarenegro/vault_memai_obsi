import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync,spawn} from 'node:child_process';
import {GovernedWorkflow} from '../../../packages/proposal-engine/src/workflow.js';
const root=path.resolve(import.meta.dirname,'../../..'),bin=process.env.LIMEN_VAULT_CHECK??path.join(root,'apps/desktop/src-tauri/target/release/vault-check');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'limen-m7-e2e-'));const id=()=>crypto.randomBytes(32).toString('hex');
function call(v:string,q:Record<string,unknown>,command='m7',env:NodeJS.ProcessEnv={}){return spawnSync(bin,[command,v,JSON.stringify(q)],{cwd:temp,encoding:'utf8',env:{PATH:'/usr/bin:/bin',...env}})}
const workflow=new GovernedWorkflow(async(v,q)=>{const r=call(v,q);if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout)});
function vault(name:string){const v=path.join(temp,name);const r=spawnSync(bin,['create',v,path.join(root,'vault-template')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return v;}
try{
 const v=vault('Lifecycle àèé');const raw=path.join(v,'20_RAW_SOURCES/raw.txt');fs.writeFileSync(raw,'Immutable raw');
 const save={action:'save',operationId:id(),title:'Realistic output',content:'Aurora launch date: 17 October 2026. Verification: blue espresso.',provider:'openai',model:'fixture-model',sources:[]};
 let s=await workflow.execute(v,save);assert.equal(s.items.length,1);assert.deepEqual(await workflow.execute(v,save),s);const out=s.items[0];
 s=await workflow.execute(v,{action:'create',operationId:id(),id:out.id,expectedSha256:out.revisions[0].sha256,title:'Aurora approved',category:'client'});let prop=s.items.find(i=>i.kind==='proposal')!;const first=fs.readFileSync(path.join(v,prop.revisions[0].relativePath));
 s=await workflow.execute(v,{action:'revise',operationId:id(),id:prop.id,revision:1,expectedSha256:prop.revisions[0].sha256,content:'Reviewed Aurora launch is 17 October 2026.'});prop=s.items.find(i=>i.kind==='proposal')!;assert.equal(prop.revisions.length,2);assert.deepEqual(fs.readFileSync(path.join(v,prop.revisions[0].relativePath)),first);
 const approval={action:'approve',operationId:id(),id:prop.id,revision:2,expectedSha256:prop.revisions[1].sha256,targetPath:'01_CLIENTS/aurora.md'};
 s=await workflow.execute(v,approval);assert.equal(s.items.find(i=>i.kind==='proposal')!.workflowStatus,'approved');assert.deepEqual(await workflow.execute(v,approval),s);assert.equal(fs.readFileSync(raw,'utf8'),'Immutable raw');
 const indexed=spawnSync(bin,['search-index',v],{encoding:'utf8'});assert.equal(indexed.status,0,indexed.stderr);const found=JSON.parse(spawnSync(bin,['search',v,JSON.stringify({term:'Aurora',status:'approved'})],{encoding:'utf8'}).stdout);assert.ok(found.some((x:any)=>x.relative_path==='01_CLIENTS/aurora.md'));
 console.log('PASS TS/native workflow contract, output persistence, immutable revisions, approval, idempotence, RAW and search');
 for(const stage of ['journal','document','index']){
  const v=vault('Kill '+stage);const q={action:'create',operationId:id(),title:'Interrupted',content:'Preserve after SIGKILL',category:'client'};const killed=call(v,q,'m7-interrupt',{LIMEN_TEST_KILL_STAGE:stage});assert.equal(killed.signal,'SIGKILL');assert.notEqual(call(v,{action:'list'}).status,0);const recovered=await workflow.execute(v,{action:'recover'});assert.equal(recovered.items.length,1);assert.deepEqual(await workflow.execute(v,q),recovered);assert.equal(fs.readdirSync(path.join(v,'90_PROPOSALS')).filter(x=>x.endsWith('.md')).length,1);
 }
 console.log('PASS actual process SIGKILL after journal/document/index; explicit recovery and exactly one publication');
 const concurrent=vault('Concurrent');const q={action:'create',operationId:id(),title:'Concurrent',content:'One operation',category:'client'};
 const jobs=await Promise.all(Array.from({length:4},()=>new Promise<number|null>((resolve,reject)=>{const p=spawn(bin,['m7',concurrent,JSON.stringify(q)],{stdio:'ignore'});p.on('error',reject);p.on('exit',resolve)})));assert.ok(jobs.some(x=>x===0));assert.equal((await workflow.execute(concurrent,q)).items.length,1);
 console.log('PASS concurrent processes serialized; repeat operation does not duplicate revision');
 const cp=vault('Concurrent approval');let cs=await workflow.execute(cp,{action:'create',operationId:id(),title:'Concurrent review',content:'Exact reviewed bytes',category:'client'});const ci=cs.items[0];
 const approvals=await Promise.all(['a.md','b.md'].map(name=>new Promise<number|null>((resolve,reject)=>{const p=spawn(bin,['m7',cp,JSON.stringify({action:'approve',operationId:id(),id:ci.id,revision:1,expectedSha256:ci.revisions[0].sha256,targetPath:'01_CLIENTS/'+name})],{stdio:'ignore'});p.on('error',reject);p.on('exit',resolve)})));
 assert.equal(approvals.filter(x=>x===0).length,1);assert.equal(fs.readdirSync(path.join(cp,'01_CLIENTS')).length,1);
 const pv=vault('Permission recovery');let ps=await workflow.execute(pv,{action:'create',operationId:id(),title:'Permission review',content:'Retain draft',category:'client'});const pi=ps.items[0],dest=path.join(pv,'01_CLIENTS');const pq={action:'approve',operationId:id(),id:pi.id,revision:1,expectedSha256:pi.revisions[0].sha256,targetPath:'01_CLIENTS/recovered.md'};
 const before=fs.readFileSync(path.join(pv,'90_PROPOSALS',path.basename(pi.revisions[0].relativePath)));fs.chmodSync(dest,0o500);
 try{assert.notEqual(call(pv,pq).status,0);assert.equal(fs.existsSync(path.join(dest,'recovered.md')),false)}finally{fs.chmodSync(dest,0o700)}
 await workflow.execute(pv,{action:'recover'});const recoveredApproval=await workflow.execute(pv,pq);assert.equal(recoveredApproval.items[0].workflowStatus,'approved');assert.deepEqual(fs.readFileSync(path.join(pv,pi.revisions[0].relativePath)),before);
 console.log('PASS competing approvals publish exactly one file; denied destination preserves draft and recovers explicitly');
 console.log('M7 native E2E PASS; fixtures retained at '+temp);
}catch(e){console.error('Fixture retained at '+temp);throw e;}
