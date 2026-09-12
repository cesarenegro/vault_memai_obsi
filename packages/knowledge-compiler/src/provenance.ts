import crypto from 'node:crypto';
import { SafeDir } from '@limen-vault/vault-core';
import type { CompilerIndex } from './index.js';
export const COMPILER_INDEX_RELATIVE_PATH = '00_SYSTEM/COMPILER_INDEX.json';
export const hash = (bytes: string | Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
export const generateStableSourceId = (relative: string) => `src_${hash(relative)}`;
export function components(relative: string): string[] {
  const parts=relative.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||p.includes('\\')||p.includes('\0')))throw new Error('Unsafe relative path');
  return parts;
}
export function readPath(root: SafeDir, relative: string): Buffer {
  const parts=components(relative);let dir=root;const opened:SafeDir[]=[];
  try {for(const part of parts.slice(0,-1)){dir=dir.dir(part);opened.push(dir);}return dir.readBytes(parts.at(-1)!);}
  finally {opened.reverse().forEach(d=>d.close());}
}
export function readIndex(system: SafeDir): CompilerIndex {
  if(!system.names().includes('COMPILER_INDEX.json'))return {version:1,records:{}};
  const index=JSON.parse(system.read('COMPILER_INDEX.json')) as CompilerIndex;
  if(index.version!==1||!index.records||typeof index.records!=='object'||Array.isArray(index.records))throw new Error('Invalid compiler index');
  for(const [key,r] of Object.entries(index.records)){
    components(key);
    // Explicit migration of legacy first-compilation timestamp; never call it an import date.
    r.first_compiled_at ??= (r as unknown as {imported_at:string}).imported_at;
    if(!key.startsWith('20_RAW_SOURCES/')||r.source_relative_path!==key||!/^src_[a-f0-9]+$/.test(r.source_id)
      || !/^[a-f0-9]{64}$/.test(r.sha256)||![r.first_compiled_at,r.last_compiled_at,r.compiler_version].every(v=>typeof v==='string'&&v.length>0)
      ||!r.draft_relative_path||components(r.draft_relative_path).length!==2||!r.draft_relative_path.startsWith('90_PROPOSALS/'))throw new Error('Invalid compiler record');
  }
  return index;
}
export function loadCompilerIndex(vaultRoot: string): CompilerIndex {
  const root=SafeDir.open(vaultRoot);try {const system=root.dir('00_SYSTEM');try{return readIndex(system);}finally{system.close();}}finally{root.close();}
}
export function saveIndex(system:SafeDir,index:CompilerIndex):void {
  const temp=`.compiler-index-${crypto.randomUUID()}`;
  try {system.writeNew(temp,JSON.stringify(index,null,2));system.replaceFile(temp,'COMPILER_INDEX.json');}
  catch(e){if(system.names().includes(temp))system.unlinkFile(temp);throw e;}
}
