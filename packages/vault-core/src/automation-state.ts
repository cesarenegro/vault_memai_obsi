import {createHash} from 'node:crypto';
import {SafeDir} from './safe-fs.js';
export function isAutomationPath(relative:string):boolean { return /(?:^|\/)auto-(source|wiki)-[^/]+\.md$/.test(relative); }
/** Read-only parity with the native ingestion registry. Frontmatter alone is never authorization. */
export function isCurrentAutomationDocument(vault:string,relative:string,hash:string):boolean {
 if(!isAutomationPath(relative))return false;
 let root:SafeDir|undefined,system:SafeDir|undefined;
 try {
  root=SafeDir.open(vault);system=root.dir('00_SYSTEM');
  if(!system.names().includes('AUTO_KNOWLEDGE.json'))return false;
  const bytes=system.readBytes('AUTO_KNOWLEDGE.json');if(bytes.length>16*1024*1024)return false;
  const state=JSON.parse(bytes.toString('utf8'));
  if(state.version!==1||!state.jobs||typeof state.jobs!=='object')return false;
  const matches=(p:string,h:unknown)=>{
   if(typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)||typeof p!=='string')return false;
   const parts=p.split('/');if(parts.length<2||parts.some(x=>!x||x==='.'||x==='..'||/[\\\0]/.test(x)))return false;
   const dirs:SafeDir[]=[];let d=root!;
   try {for(const part of parts.slice(0,-1)){d=d.dir(part);dirs.push(d);}return createHash('sha256').update(d.readBytes(parts.at(-1)!)).digest('hex')===h;}catch{return false;}finally{dirs.reverse().forEach(d=>d.close());}
  };
  return Object.values(state.jobs).some((value:unknown)=>{
   const j=value as {status?:string;output?:string;outputHash?:string;parts?:Record<string,string>;dependencies?:Record<string,string>};
   return j?.status==='ready'&&(j.output===relative&&j.outputHash===hash||j.parts?.[relative]===hash)&&!!j.output&&matches(j.output,j.outputHash)&&!!j.dependencies&&Object.keys(j.dependencies).length>0&&Object.entries(j.dependencies).every(([p,h])=>matches(p,h))&&Object.entries(j.parts??{}).every(([p,h])=>matches(p,h));
  });
 }catch{return false;}finally{system?.close();root?.close();}
}
