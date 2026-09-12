import crypto from 'node:crypto';
import {SafeDir} from '@limen-vault/vault-core';
import {KnowledgeCategorySchema} from '@limen-vault/vault-schema';
import type {SearchIndexData,SearchDocumentRecord} from './index.js';
import spec from './search-spec.json' with {type:'json'};
export const SEARCH_INDEX_RELATIVE_PATH='00_SYSTEM/SEARCH_INDEX.json';
export const hash=(bytes:string|Buffer)=>crypto.createHash('sha256').update(bytes).digest('hex');
export const documentId=(relative:string)=>`doc_${hash(relative)}`;
export function relativeParts(relative:string):string[]{
 const p=relative.split('/');if(p.length<2||p.some(x=>!x||x==='.'||x==='..'||x.includes('\\')||x.includes('\0'))||!Object.hasOwn(spec.categories,p[0]))throw new Error('Invalid indexed path');return p;
}
export function validateIndex(data:SearchIndexData):SearchIndexData{
 if(!data||data.version!==2||typeof data.last_indexed_at!=='string'||!data.documents||typeof data.documents!=='object'||Array.isArray(data.documents))throw new Error('Invalid search index');
 for(const [key,d] of Object.entries(data.documents)){
  relativeParts(key);if(!d||d.relative_path!==key||d.id!==documentId(key)||!/^[a-f0-9]{64}$/.test(d.sha256)||!Number.isSafeInteger(d.mtime_ms)||d.mtime_ms<0
   ||![d.title,d.created_at,d.updated_at,d.content_preview].every(v=>typeof v==='string')||![d.tags,d.tokens].every(v=>Array.isArray(v)&&v.every(t=>typeof t==='string'))
   ||![d.client,d.project,d.brand,d.note_id,d.status].every(v=>v===undefined||typeof v==='string')||d.status!==undefined&&!['draft','review','approved','archived'].includes(d.status))throw new Error('Invalid search document');
  KnowledgeCategorySchema.parse(d.category);
 }return data;
}
export function readIndex(system:SafeDir):SearchIndexData|null{
 if(!system.names().includes('SEARCH_INDEX.json'))return null;
 const data=JSON.parse(system.read('SEARCH_INDEX.json'));
 // Version 1 is never queried or reused: its metadata was incomplete. Explicit reindex rebuilds it.
 if(data?.version===1&&data.documents&&typeof data.documents==='object'&&!Array.isArray(data.documents))return {version:1,last_indexed_at:typeof data.last_indexed_at==='string'?data.last_indexed_at:'',documents:{}};
 return validateIndex(data);
}
export function loadSearchIndex(vaultRoot:string):SearchIndexData{
 const root=SafeDir.open(vaultRoot);try{const sys=root.dir('00_SYSTEM');try{const data=readIndex(sys);if(!data||data.version!==2)throw new Error('Search index missing or outdated; re-index required');return data;}finally{sys.close();}}finally{root.close();}
}
export function saveIndex(system:SafeDir,data:SearchIndexData):void{
 validateIndex(data);const name=`.search-index-${crypto.randomUUID()}`;system.writeNew(name,JSON.stringify(data,null,2));
 try{system.replaceFile(name,'SEARCH_INDEX.json');}catch(e){system.unlinkFile(name);throw e;}
}
