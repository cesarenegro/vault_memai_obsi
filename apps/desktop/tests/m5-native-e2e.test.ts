import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawn} from 'node:child_process';
import {LocalSearchEngine} from '../../../packages/search-engine/src/search-engine.js';
import {loadSearchIndex} from '../../../packages/search-engine/src/index-store.js';
const bin=path.resolve('src-tauri/target/debug/vault-check'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'m5-e2e-'));
const call=(cmd:string,v:string,q?:unknown)=>{const args=[cmd,v,...(q===undefined?[]:[JSON.stringify(q)])];return JSON.parse(execFileSync(bin,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}));};
const e=new LocalSearchEngine();
function fixture(n:string){const v=path.join(tmp,n);for(const d of ['00_SYSTEM','01_CLIENTS/a','01_CLIENTS/b','04_POSITIONING','05_PACKAGING_KNOWLEDGE','08_MARKET_RESEARCH','90_PROPOSALS'])fs.mkdirSync(path.join(v,d),{recursive:true});return v;}
function write(v:string,rel:string,body:string){fs.writeFileSync(path.join(v,rel),body);fs.utimesSync(path.join(v,rel),1789200000.123456,1789200000.123456);}
const header=(title:string,status:string,body:string)=>`---\nid: shared-source-id\ntitle: ${title}\ntype: client\nclient: Acme\nproject: Apollo\nstatus: ${status}\ntags: [tech, "caffè"]\ncreated_at: 2026-09-12T00:00:00Z\nupdated_at: 2026-09-12T01:00:00Z\n---\n# Heading\n${body}`;
function normalized(r:any){return {id:r.id,title:r.title,relativePath:r.relativePath??r.relative_path,category:r.category,client:r.client??null,project:r.project??null,tags:r.tags,status:r.status??null,snippet:r.snippet,score:r.score,updatedAt:r.updatedAt??r.updated_at,sha256:r.sha256};}
async function parity(ts:string,rs:string,q:unknown){const a=await e.search(ts,q as any),b=call('search',rs,q);assert.deepEqual(a.map(normalized),b.map(normalized),JSON.stringify(q));return a;}
try{
 const ts=fixture('ts'),rs=fixture('rs');
 const notes:[string,string][]=[['01_CLIENTS/a/same.md',header('Caffè "Alpha"','draft',`${'a'.repeat(179)}è😀tail. **Software** [strategy](https://example.test). Caffè.`)],['01_CLIENTS/b/same.md',header('Software Approved','approved','Software software strategy.')],['04_POSITIONING/plan.md','# Plan\nPositioning tech'],['05_PACKAGING_KNOWLEDGE/pack.md','# Packaging\nPaper design'],['08_MARKET_RESEARCH/market.markdown','# Market\nResearch demand'],['90_PROPOSALS/review.md','---\ntitle: Review\nstatus: review\ntags: [tech]\n---\n# Review\nStrategia caffè'],['01_CLIENTS/unicode.md','\uFEFF# Unicode\n'+('😀e\u0301'.repeat(100))+' caffè'],['01_CLIENTS/crlf.md',header('Windows','archived','Archived notes').replaceAll('\n','\r\n')]];
 for(const v of [ts,rs])for(const [p,s]of notes)write(v,p,s);
 assert.equal((await e.getIndexStatus(ts)).state,'missing');assert.equal(call('search-status',rs).state,'missing');
 assert.equal((await e.indexVault(ts)).total_indexed,notes.length);assert.equal(call('search-index',rs).total_indexed,notes.length);
 for(const q of [{},{term:'caffe'},{term:'software strategy'},{client:'ACME',project:'apollo',tags:['TECH'],status:'approved'},{status:'draft'},{category:'packaging'},{category:'research'},{term:'the il'},{limit:0},{limit:2,offset:1}])await parity(ts,rs,q);
 const both=await parity(ts,rs,{term:'software'});assert.equal(new Set(both.map(x=>x.id)).size,both.length);
 console.log('PASS TS/Rust metadata, all filters, TF-IDF ranking, accents/emoji/CRLF, canonical folders, stable IDs and pagination');
 const a=loadSearchIndex(ts),b=JSON.parse(fs.readFileSync(path.join(rs,'00_SYSTEM/SEARCH_INDEX.json'),'utf8'));
 assert.deepEqual(a.documents,b.documents);assert.equal(a.documents['01_CLIENTS/a/same.md'].mtime_ms,1789200000123);
 fs.copyFileSync(path.join(ts,'00_SYSTEM/SEARCH_INDEX.json'),path.join(rs,'00_SYSTEM/SEARCH_INDEX.json'));await parity(ts,rs,{term:'caffe'});
 call('search-index',rs);fs.copyFileSync(path.join(rs,'00_SYSTEM/SEARCH_INDEX.json'),path.join(ts,'00_SYSTEM/SEARCH_INDEX.json'));await parity(ts,rs,{status:'approved'});
 const before=fs.readFileSync(path.join(ts,'00_SYSTEM/SEARCH_INDEX.json'));await e.search(ts,{term:'software'});assert.deepEqual(fs.readFileSync(path.join(ts,'00_SYSTEM/SEARCH_INDEX.json')),before);
 for(const v of [ts,rs])for(const [p,s]of notes)assert.equal(fs.readFileSync(path.join(v,p),'utf8'),s);
 console.log('PASS persistent shared v2 index, fractional mtime normalization, read-only queries and source bytes');
 for(const v of [ts,rs])write(v,'01_CLIENTS/a/same.md',header('Updated','draft','newkeyword'));await assert.rejects(e.search(ts,{term:'caffe'}),/stale/);assert.throws(()=>call('search',rs,{term:'caffe'}));
 for(const v of [ts,rs])fs.unlinkSync(path.join(v,'04_POSITIONING/plan.md'));await e.indexVault(ts);call('search-index',rs);assert.equal((await parity(ts,rs,{term:'newkeyword'})).length,1);assert.equal((await parity(ts,rs,{category:'positioning'})).length,0);
 const docsBefore=loadSearchIndex(ts).documents;await e.indexVault(ts);assert.deepEqual(loadSearchIndex(ts).documents,docsBefore);
 console.log('PASS stale source rejection, changed/deleted sources and unchanged incremental records');
 for(const v of [ts,rs]){
  const native=v===rs,index=path.join(v,'00_SYSTEM/SEARCH_INDEX.json'),note=path.join(v,'01_CLIENTS/a/same.md'),old=fs.readFileSync(index),raw=fs.readFileSync(note);
  const rejectIndex=async()=>native?assert.throws(()=>call('search-index',v)):await assert.rejects(e.indexVault(v));
  fs.unlinkSync(index);fs.symlinkSync(note,index);await rejectIndex();assert.deepEqual(fs.readFileSync(note),raw);fs.unlinkSync(index);fs.writeFileSync(index,old);
  fs.symlinkSync(note,path.join(v,'01_CLIENTS/link.md'));await rejectIndex();assert.deepEqual(fs.readFileSync(index),old);fs.unlinkSync(path.join(v,'01_CLIENTS/link.md'));
  fs.chmodSync(note,0);await rejectIndex();fs.chmodSync(note,0o600);assert.deepEqual(fs.readFileSync(index),old);
  fs.writeFileSync(index,'{bad');await rejectIndex();assert.equal(fs.readFileSync(index,'utf8'),'{bad');if(native)assert.throws(()=>call('search-status',v));else await assert.rejects(e.getIndexStatus(v));fs.writeFileSync(index,old);
  fs.mkdirSync(path.join(v,'00_SYSTEM/.search-lock'));await rejectIndex();assert.ok(fs.existsSync(path.join(v,'00_SYSTEM/.search-lock')));fs.rmdirSync(path.join(v,'00_SYSTEM/.search-lock'));
  fs.writeFileSync(path.join(v,'01_CLIENTS/invalid.md'),'---\ntags: [1]\n---\n# Bad');await rejectIndex();assert.deepEqual(fs.readFileSync(index),old);fs.unlinkSync(path.join(v,'01_CLIENTS/invalid.md'));
  const legacy={...JSON.parse(old.toString()),version:1};fs.writeFileSync(index,JSON.stringify(legacy));assert.equal((native?call('search-status',v):await e.getIndexStatus(v)).state,'outdated');if(native)call('search-index',v);else await e.indexVault(v);
 }
 await parity(ts,rs,{term:'software'});
 console.log('PASS index/source symlink denial, permissions, corrupt index, lock, invalid frontmatter and explicit v1 rebuild');
 await assert.rejects(e.search(ts,{offset:-1}));assert.throws(()=>call('search',rs,{offset:-1}));await assert.rejects(e.search(ts,{limit:201}));assert.throws(()=>call('search',rs,{limit:201}));
 // Overlapping native indexing processes either serialize through lock rejection or complete sequentially.
 const jobs=await Promise.all(Array.from({length:4},()=>new Promise<{code:number|null,out:string}>((resolve,reject)=>{const c=spawn(bin,['search-index',rs]);let out='';c.stdout.on('data',b=>out+=b);c.on('error',reject);c.on('exit',code=>resolve({code,out}));})));
 assert.ok(jobs.some(j=>j.code===0));assert.equal(call('search-status',rs).state,'ready');await parity(ts,rs,{status:'approved'});assert.ok(!fs.readdirSync(path.join(rs,'00_SYSTEM')).some(n=>n.startsWith('.search')));
 console.log('PASS native process concurrency, persistent index and no staging/lock residue');
 console.log('M5 native E2E PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
