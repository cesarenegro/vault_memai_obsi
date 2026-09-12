import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {SafeDir} from '@limen-vault/vault-core';
import {component,emptyReport,readManifest,verify,walk,VaultIntegrityReport} from './manifest-verifier.js';
export class SnapshotAlreadyExistsError extends Error {}
export class SnapshotCreationError extends Error {}
export interface SnapshotItem{id:string;vaultPath:string;snapshotPath:string;createdAt:string;note?:string;manifestFileCount:number;integrityStatus:'valid'|'corrupted'|'incomplete'}
function container(root:SafeDir,create=false):SafeDir|undefined{
  const sys=root.dir('00_SYSTEM');try{
    try{return sys.dir('SNAPSHOTS');}catch(e){if((e as {errno?:number}).errno!==2)throw e;if(!create)return undefined;}
    try{sys.mkdir('SNAPSHOTS');}catch(e){if((e as {errno?:number}).errno!==17)throw e;}return sys.dir('SNAPSHOTS');
  }finally{sys.close();}
}
export class SnapshotManager{
  static getSnapshotsDir(root:string){return path.join(fs.realpathSync(root),'00_SYSTEM/SNAPSHOTS');}
  static createSnapshot(vaultRoot:string,note?:string):SnapshotItem{
    let root:SafeDir|undefined,c:SafeDir|undefined,stage:SafeDir|undefined;let pending='';let published=false;
    try{
      const real=fs.realpathSync(vaultRoot);root=SafeDir.open(real);readManifest(root);c=container(root,true)!;
      const date=new Date().toISOString();const id=`snap-${date.replace(/[:.]/g,'-')}-${crypto.randomUUID()}`;pending=`.pending-${id}`;
      c.mkdir(pending);stage=c.dir(pending);
      const files=[...walk(root,false,stage).values()];
      const m={schema_version:1,vault_id:`snapshot-${id}`,vault_name:`Snapshot ${id}`,snapshot_id:id,created_at:date,updated_at:date,note:note??'',files};
      stage.writeNew('snapshot_manifest.json',JSON.stringify(m,null,2));
      const report=verify(stage,true,id);if(!report.isIntegrityValid)throw new Error(`Snapshot verification failed: ${JSON.stringify(report)}`);
      c.renameExclusive(pending,id);published=true;
      return{id,vaultPath:real,snapshotPath:path.join(real,'00_SYSTEM/SNAPSHOTS',id),createdAt:date,note,manifestFileCount:files.length,integrityStatus:'valid'};
    }catch(e){
      let message=(e as Error).message;
      if(stage&&c&&!published){try{c.removeOwned(pending,stage);}catch(cleanup){message+=`; staging cleanup failed: ${(cleanup as Error).message}`;}}
      throw new SnapshotCreationError(message);
    }finally{stage?.close();c?.close();root?.close();}
  }
  static listSnapshots(vaultRoot:string):SnapshotItem[]{
    const real=fs.realpathSync(vaultRoot);const root=SafeDir.open(real);let c:SafeDir|undefined;
    try{
      c=container(root);if(!c)return[];const out:SnapshotItem[]=[];
      for(const id of c.names().filter(n=>n.startsWith('snap-'))){
        const item:SnapshotItem={id,vaultPath:real,snapshotPath:path.join(real,'00_SYSTEM/SNAPSHOTS',id),createdAt:'',manifestFileCount:0,integrityStatus:'corrupted'};
        let d:SafeDir|undefined;
        try{d=c.dir(id);const m=readManifest(d,true,id);item.createdAt=m.created_at;item.note=m.note;item.manifestFileCount=m.files.length;item.integrityStatus=verify(d,true,id).isIntegrityValid?'valid':'corrupted';}
        catch(e){if(d&&(e as {errno?:number}).errno===2)item.integrityStatus='incomplete';}
        finally{d?.close();}out.push(item);
      }return out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    }finally{c?.close();root.close();}
  }
  static verifySnapshotIntegrity(vaultRoot:string,id:string):VaultIntegrityReport{
    let root:SafeDir|undefined,c:SafeDir|undefined,d:SafeDir|undefined;
    try{component(id);if(!id.startsWith('snap-'))throw new Error('Invalid snapshot id');root=SafeDir.open(vaultRoot);c=container(root);if(!c)throw new Error('No snapshots directory');d=c.dir(id);return verify(d,true,id);}
    catch(e){return{...emptyReport(),errors:[(e as Error).message]};}finally{d?.close();c?.close();root?.close();}
  }
}
