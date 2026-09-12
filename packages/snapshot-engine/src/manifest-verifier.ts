import fs from 'fs';
import crypto from 'crypto';
import { VaultManifestSchema } from '@limen-vault/vault-schema';
import { SafeDir } from '@limen-vault/vault-core';
export interface VaultIntegrityReport {
  isIntegrityValid: boolean; manifestPresent: boolean; totalManifestedFiles: number; verifiedFilesCount: number;
  modifiedFiles: string[]; missingFiles: string[]; addedFiles: string[]; errors: string[];
}
export const emptyReport=():VaultIntegrityReport=>({isIntegrityValid:false,manifestPresent:false,totalManifestedFiles:0,verifiedFilesCount:0,modifiedFiles:[],missingFiles:[],addedFiles:[],errors:[]});
export function computeSHA256(content: Buffer | string):string{return crypto.createHash('sha256').update(content).digest('hex');}
export function computeFileSHA256(filePath:string):string{return computeSHA256(fs.readFileSync(filePath));}
export function component(s:string){if(!s || s==='.' || s==='..' || /[/\\\0]/.test(s))throw new Error('Unsafe path component');}
export function relative(s:string){s.split('/').forEach(component);}
export const excluded=(rel:string)=>rel==='00_SYSTEM/SNAPSHOTS'||rel.startsWith('00_SYSTEM/SNAPSHOTS/')||rel.split('/').some(n=>['.git','node_modules','.DS_Store','.gitkeep','.obsidian'].includes(n));
export function readPath(root:SafeDir,rel:string):Buffer {
  relative(rel);const parts=rel.split('/');let d=root;const opened:SafeDir[]=[];
  try{for(const p of parts.slice(0,-1)){d=d.dir(p);opened.push(d);}return d.readBytes(parts.at(-1)!);}
  finally{opened.reverse().forEach(d=>d.close());}
}
export type FileEntry={path:string;sha256:string;size:number};
export function walk(root:SafeDir,snapshot:boolean,dest?:SafeDir,rel='',depth=0,files=new Map<string,FileEntry>()):Map<string,FileEntry>{
  if(depth>64)throw new Error('Directory depth exceeds 64');
  for(const name of root.names()){
    const label=rel?`${rel}/${name}`:name;
    if((!snapshot&&excluded(label))||(snapshot&&label==='snapshot_manifest.json'))continue;
    const fd=root.open(name);let directory:boolean;
    try{const st=fs.fstatSync(fd);directory=st.isDirectory();if(!directory&&!st.isFile())throw new Error('Not a regular file');}finally{fs.closeSync(fd);}
    if(directory){
      const child=root.dir(name);let target:SafeDir|undefined;
      try{if(dest){dest.mkdir(name);target=dest.dir(name);}walk(child,snapshot,target,label,depth+1,files);}finally{target?.close();child.close();}
    }else{
      const bytes=root.readBytes(name);dest?.writeNew(name,bytes);
      files.set(label,{path:label,sha256:computeSHA256(bytes),size:bytes.length});
    }
  }return files;
}
export function readManifest(root:SafeDir,snapshot=false,id?:string){
  const raw=JSON.parse(readPath(root,snapshot?'snapshot_manifest.json':'00_SYSTEM/VAULT_MANIFEST.json').toString('utf8'));
  const parsed=VaultManifestSchema.parse(raw);
  if(snapshot&&(parsed.snapshot_id!==id || (raw.note!==undefined&&typeof raw.note!=='string')))throw new Error('Invalid snapshot identity or note');
  const seen=new Set<string>();
  for(const f of parsed.files){relative(f.path);if(!/^[0-9a-f]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.size)||seen.has(f.path))throw new Error('Invalid or duplicate manifest entry');
    if(excluded(f.path)||(snapshot&&f.path==='snapshot_manifest.json'))throw new Error('Excluded path in manifest');seen.add(f.path);
  }
  return {...parsed,note:raw.note as string|undefined};
}
export function verify(root:SafeDir,snapshot=false,id?:string):VaultIntegrityReport{
  const r=emptyReport();
  try{
    const manifest=readManifest(root,snapshot,id);r.manifestPresent=true;
    const actual=walk(root,snapshot);const self=snapshot?'snapshot_manifest.json':'00_SYSTEM/VAULT_MANIFEST.json';actual.delete(self);
    for(const f of manifest.files){if(f.path===self)continue;r.totalManifestedFiles++;
      const a=actual.get(f.path);if(!a)r.missingFiles.push(f.path);else if(a.sha256!==f.sha256||a.size!==f.size)r.modifiedFiles.push(f.path);else r.verifiedFilesCount++;actual.delete(f.path);
    }
    r.addedFiles=[...actual.keys()].sort();r.modifiedFiles.sort();r.missingFiles.sort();
    r.isIntegrityValid=!r.modifiedFiles.length&&!r.missingFiles.length&&!r.addedFiles.length;
  }catch(e){r.errors.push((e as Error).message);}return r;
}
export class ManifestVerifier{
  static verifyIntegrity(vaultRoot:string):VaultIntegrityReport{
    let d:SafeDir|undefined;try{d=SafeDir.open(vaultRoot);return verify(d);}catch(e){return {...emptyReport(),errors:[(e as Error).message]};}finally{d?.close();}
  }
}
