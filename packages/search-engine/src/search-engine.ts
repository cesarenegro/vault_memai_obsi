import fs from 'node:fs';
import path from 'node:path';
import {SafeDir,parseYamlFrontmatter,isAutomationPath,isCurrentAutomationDocument} from '@limen-vault/vault-core';
import {KnowledgeCategorySchema} from '@limen-vault/vault-schema';
import type {KnowledgeCategory} from '@limen-vault/vault-schema';
import type {SearchEngineContract,SearchQuery,SearchResultItem,IndexStatusReport,SearchDocumentRecord,SearchIndexData} from './index.js';
import {hash,documentId,readIndex,saveIndex,relativeParts} from './index-store.js';
import {tokenizeText,extractSnippet,computeTermFrequencies,normalizeText} from './tokenizer.js';
import spec from './search-spec.json' with {type:'json'};
const compare=(a:string,b:string)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
function readFile(dir:SafeDir,name:string):{bytes:Buffer,mtime:number}{
 const fd=dir.open(name);try{const a=fs.fstatSync(fd);if(!a.isFile()||a.size>4*1024*1024)throw new Error('Not a regular file or exceeds 4 MiB');const bytes=fs.readFileSync(fd);const b=fs.fstatSync(fd);
 if(a.size!==b.size||a.mtimeMs!==b.mtimeMs||a.ctimeMs!==b.ctimeMs)throw new Error('Source changed while reading');return {bytes,mtime:Math.max(0,Math.floor(a.mtimeMs))};}finally{fs.closeSync(fd);}
}
function readPath(root:SafeDir,relative:string):Buffer{const p=relativeParts(relative),dirs:SafeDir[]=[];let d=root;try{for(const n of p.slice(0,-1)){d=d.dir(n);dirs.push(d);}return readFile(d,p.at(-1)!).bytes;}finally{dirs.reverse().forEach(d=>d.close());}}
function parse(content:string,relative:string,category:string,mtime:number,sha:string):SearchDocumentRecord{
 let body=content;const parsed=parseYamlFrontmatter(content);if(parsed?.syntaxError)throw new Error(`${relative}: ${parsed.syntaxError}`);const fm=parsed?.data??{};
 if(parsed){body=content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');}
 for(const key of ['id','title','type','client','project','brand','status','created_at','updated_at'])if(fm[key]!==undefined&&typeof fm[key]!=='string')throw new Error(`${relative}: Invalid ${key}`);
 if(fm.tags!==undefined&&(!Array.isArray(fm.tags)||fm.tags.some(t=>typeof t!=='string')))throw new Error(`${relative}: Invalid tags`);
 if(fm.status!==undefined&&!['draft','review','approved','archived'].includes(fm.status as string))throw new Error(`${relative}: Invalid status`);
 const title=(fm.title as string|undefined)??(body.split(/\r?\n/).find(l=>l.startsWith('# '))?.slice(2).trim()||path.parse(relative).name.replace(/[-_]/g,' '));
 const tags=(fm.tags??[])as string[];const date=new Date(mtime).toISOString();
 return {id:documentId(relative),note_id:fm.id as string|undefined,relative_path:relative,sha256:sha,mtime_ms:mtime,title,category:KnowledgeCategorySchema.parse(fm.type??category),client:fm.client as string|undefined,project:fm.project as string|undefined,brand:fm.brand as string|undefined,tags,status:fm.status as string|undefined,created_at:(fm.created_at as string|undefined)??date,updated_at:(fm.updated_at as string|undefined)??date,tokens:tokenizeText(`${title} ${body} ${tags.join(' ')}`),content_preview:body.trim()};
}
function status(data:SearchIndexData|null):IndexStatusReport{
 const state=!data?'missing':data.version===2?'ready':'outdated';const cats:Record<string,number>={};let n=0;
 if(state==='ready')for(const d of Object.values(data!.documents)){cats[d.category]=(cats[d.category]??0)+1;n++;}
 return {state,total_indexed:n,last_indexed_at:data?.last_indexed_at??'',version:data?.version??2,indexed_categories:cats};
}
export class LocalSearchEngine implements SearchEngineContract{
 async getIndexStatus(vaultPath:string):Promise<IndexStatusReport>{const r=SafeDir.open(vaultPath);try{const s=r.dir('00_SYSTEM');try{return status(readIndex(s));}finally{s.close();}}finally{r.close();}}
 async indexVault(vaultPath:string):Promise<IndexStatusReport>{
  const root=SafeDir.open(vaultPath);let sys:SafeDir|undefined,lock:SafeDir|undefined;
  try{sys=root.dir('00_SYSTEM');
   try{sys.mkdir('.search-lock');}catch{
    const previous=sys.dir('.search-lock');try{const owner=JSON.parse(previous.read('owner.json'));if(!Number.isInteger(owner.pid)||owner.pid<2)throw new Error('Invalid search lock owner');let dead=false;try{process.kill(owner.pid,0);}catch(e){dead=(e as NodeJS.ErrnoException).code==='ESRCH';}if(!dead)throw new Error('Search lock held by active process');previous.unlinkFile('owner.json');sys.removeOwned('.search-lock',previous);}finally{previous.close();}sys.mkdir('.search-lock');
   }
   lock=sys.dir('.search-lock');lock.writeNew('owner.json',JSON.stringify({pid:process.pid}));const old=readIndex(sys);
   const data:SearchIndexData={version:2,last_indexed_at:'',documents:{}};
   const walk=(dir:SafeDir,rel:string,cat:string,depth:number)=>{if(depth>64)throw new Error('Directory depth exceeds 64');
    for(const name of dir.names()){if(name.startsWith('.'))continue;const full=`${rel}/${name}`;const fd=dir.open(name);let st;try{st=fs.fstatSync(fd);}finally{fs.closeSync(fd);}
     if(st.isDirectory()){const child=dir.dir(name);try{walk(child,full,cat,depth+1);}finally{child.close();}}else if(!st.isFile())throw new Error(`${full}: Not a regular file`);
     else if(/\.(md|markdown)$/i.test(name)){const {bytes,mtime}=readFile(dir,name);const sha=hash(bytes),cached=old?.version===2?old.documents[full]:undefined;
      data.documents[full]=cached?.sha256===sha&&cached.mtime_ms===mtime?cached:parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes).replace(/^\uFEFF/,''),full,cat,mtime,sha);
     }
    }
   };
   const names=root.names();for(const [dir,cat]of Object.entries(spec.categories)){if(!names.includes(dir))continue;const child=root.dir(dir);try{walk(child,dir,cat,0);}finally{child.close();}}
   data.last_indexed_at=new Date().toISOString();saveIndex(sys,data);return status(data);
  }finally{if(lock&&sys){try{lock.unlinkFile('owner.json');sys.removeOwned('.search-lock',lock);}finally{lock.close();}}sys?.close();root.close();}
 }
 async search(vaultPath:string,query:SearchQuery):Promise<SearchResultItem[]>{
  const limit=query.limit??50,offset=query.offset??0;
  if(!Number.isSafeInteger(limit)||limit<0||limit>200||!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new Error('Invalid search pagination');
  if(query.term!==undefined&&typeof query.term!=='string'||(query.term?.length??0)>2000||query.tags&&(!Array.isArray(query.tags)||query.tags.some(t=>typeof t!=='string')))throw new Error('Invalid search query');
  for(const key of ['client','project','status','category']as const)if(query[key]!==undefined&&typeof query[key]!=='string')throw new Error('Invalid search filter');
  const root=SafeDir.open(vaultPath);try{const sys=root.dir('00_SYSTEM');let data;try{data=readIndex(sys);}finally{sys.close();}
   if(!data||data.version!==2)throw new Error('Search index missing or outdated; re-index required');
   const docs=Object.values(data.documents),terms=[...new Set(tokenizeText(query.term??''))].sort(compare);
   if(query.term?.trim()&&!terms.length)return [];
   const df=new Map(terms.map(t=>[t,docs.filter(d=>d.tokens.includes(t)).length]));const results:SearchResultItem[]=[];
   for(const doc of docs){if(isAutomationPath(doc.relative_path)&&!isCurrentAutomationDocument(vaultPath,doc.relative_path,doc.sha256))continue;if(query.category&&doc.category!==query.category)continue;
    if((['client','project','status']as const).some(k=>query[k]&&normalizeText(doc[k]??'')!==normalizeText(query[k]!)))continue;
    if(query.tags?.some(t=>!doc.tags.map(normalizeText).includes(normalizeText(t))))continue;
    let score=terms.length?0:1;const tf=computeTermFrequencies(doc.tokens),title=tokenizeText(doc.title),tags=doc.tags.flatMap(tokenizeText);
    for(const t of terms){score+=(tf.get(t)??0)*(Math.log((docs.length+1)/((df.get(t)??0)+1))+1);if(title.includes(t))score+=10;if(tags.includes(t))score+=5;}
    if(score<=0)continue;
    if(hash(readPath(root,doc.relative_path))!==doc.sha256)throw new Error(`Search index stale: ${doc.relative_path}; re-index required`);
    results.push({id:doc.id,title:doc.title,relativePath:doc.relative_path,category:doc.category,client:doc.client,project:doc.project,tags:doc.tags,status:doc.status,snippet:extractSnippet(doc.content_preview,terms),score:Math.round(score*100)/100,updatedAt:doc.updated_at,sha256:doc.sha256});
   }
   results.sort((a,b)=>b.score-a.score||compare(b.updatedAt??'',a.updatedAt??'')||compare(a.relativePath,b.relativePath));return results.slice(offset,offset+limit);
  }finally{root.close();}
 }
}
