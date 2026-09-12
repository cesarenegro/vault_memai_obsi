import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import yaml from 'js-yaml';
import { SafeDir } from '@limen-vault/vault-core';
import { FrontmatterSchema } from '@limen-vault/vault-schema';
import { COMPILER_VERSION, type KnowledgeCompilerContract, type CompileOptions, type CompilationItemResult, type BatchCompilerReport } from './index.js';
import { components, readPath, readIndex, saveIndex, hash, generateStableSourceId } from './provenance.js';
import { extractDeterministicContent } from './extractor.js';
export class KnowledgeCompiler implements KnowledgeCompilerContract {
  async compileSourceToDraft(vaultRoot:string,relativeSourcePath:string,options?:CompileOptions):Promise<CompilationItemResult>{
    let root:SafeDir|undefined,system:SafeDir|undefined,lock:SafeDir|undefined,proposals:SafeDir|undefined;
    try{
      if(components(relativeSourcePath).length<2||!relativeSourcePath.startsWith('20_RAW_SOURCES/'))throw new Error('Source must be inside 20_RAW_SOURCES');
      if(options?.categoryProposal && options.categoryProposal!=='proposal')throw new Error('Compiler outputs must be proposals');
      root=SafeDir.open(vaultRoot);system=root.dir('00_SYSTEM');
      system.mkdir('.compiler-lock');lock=system.dir('.compiler-lock');
      const index=readIndex(system);
      const bytes=readPath(root,relativeSourcePath);
      if(!['.md','.markdown','.txt','.html','.htm'].includes(path.extname(relativeSourcePath).toLowerCase()))return {source_relative_path:relativeSourcePath,status:'unsupported'};
      const extracted=extractDeterministicContent(new TextDecoder('utf-8',{fatal:true}).decode(bytes),relativeSourcePath);
      if(!extracted.isSupported)return {source_relative_path:relativeSourcePath,status:'unsupported'};
      const sha=hash(bytes),old=index.records[relativeSourcePath];
      proposals=root.dir('90_PROPOSALS');
      if(!options?.forceRecompile&&old?.sha256===sha&&old.compiler_version===COMPILER_VERSION&&old.draft_relative_path){
        const name=components(old.draft_relative_path)[1];
        if(proposals.names().includes(name)){proposals.readBytes(name);return {source_relative_path:relativeSourcePath,status:'unchanged',draft_relative_path:old.draft_relative_path};}
      }
      const now=new Date().toISOString(),id=generateStableSourceId(relativeSourcePath),revision=crypto.randomUUID();
      const name=`${id}-${sha.slice(0,16)}-${revision}.md`,relative=`90_PROPOSALS/${name}`;
      const fm=FrontmatterSchema.parse({schema_version:1,id:`prop_${id}_${revision}`,title:extracted.title,type:'proposal',status:'draft',source_ids:[id],created_at:now,updated_at:now,tags:['compiled',extracted.extension.slice(1)]});
      const text=`---\n${yaml.dump(fm,{lineWidth:-1})}---\n\n# ${extracted.title}\n\n> Source: ${relativeSourcePath}\n> SHA-256: ${sha}\n> Compiler: ${COMPILER_VERSION}\n\n${extracted.body}\n`;
      const stage=`.compiler-${revision}`;
      proposals.writeNew(stage,text);
      try{proposals.renameExclusive(stage,name);}catch(e){proposals.unlinkFile(stage);throw e;}
      try {
        index.records[relativeSourcePath]={source_relative_path:relativeSourcePath,source_id:id,sha256:sha,first_compiled_at:old?.first_compiled_at??now,last_compiled_at:now,compiler_version:COMPILER_VERSION,draft_relative_path:relative};
        saveIndex(system,index);
      }catch(e){proposals.unlinkFile(name);throw e;}
      return {source_relative_path:relativeSourcePath,status:'compiled',draft_relative_path:relative,frontmatter:fm};
    }catch(e){return {source_relative_path:relativeSourcePath,status:'error',error:String(e)};}
    finally{proposals?.close();if(lock&&system){try{system.removeOwned('.compiler-lock',lock);}finally{lock.close();}}system?.close();root?.close();}
  }
  async batchCompile(vaultRoot:string,options?:CompileOptions):Promise<BatchCompilerReport>{
    const items:CompilationItemResult[]=[],paths:string[]=[];const root=SafeDir.open(vaultRoot);
    const walk=(dir:SafeDir,relative:string,depth:number)=>{
      if(depth>64)throw new Error('Directory depth exceeds 64');
      for(const name of dir.names()){
        if(name.startsWith('.'))continue;
        const rel=`${relative}/${name}`;
        try{const fd=dir.open(name);let isDir;try{isDir=fs.fstatSync(fd).isDirectory();}finally{fs.closeSync(fd);}
          if(isDir){const child=dir.dir(name);try{walk(child,rel,depth+1);}finally{child.close();}}else paths.push(rel);
        }catch(e){items.push({source_relative_path:rel,status:'error',error:String(e)});}
      }
    };
    try{const raw=root.dir('20_RAW_SOURCES');try{walk(raw,'20_RAW_SOURCES',0);}finally{raw.close();}}finally{root.close();}
    for(const rel of paths)items.push(await this.compileSourceToDraft(vaultRoot,rel,options));
    return {items,compiled_count:items.filter(i=>i.status==='compiled').length,unchanged_count:items.filter(i=>i.status==='unchanged').length,unsupported_count:items.filter(i=>i.status==='unsupported').length,error_count:items.filter(i=>i.status==='error').length};
  }
}
