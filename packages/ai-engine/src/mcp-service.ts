import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import { VaultSearchProvider, readDocument } from './context-selector.js';
import type { MCPToolCall, MCPToolResult } from './index.js';
// In-process reference service. Native transport is implemented in desktop Rust.
export class LIMENMcpService {
 private vaults=new Map<string,{path:string;name:string}>();
 private token:string|null=randomBytes(32).toString('hex');
 constructor(private readonly includeDrafts=false){}
 connectionToken(){if(!this.token)throw new Error('Session revoked');return this.token;}
 authorizeVault(id:string,vaultPath:string,name='LIMEN Vault'){if(!id)throw new Error('Vault ID required');this.vaults.set(id,{path:fs.realpathSync(vaultPath),name});}
 revokeVault(id:string){this.vaults.delete(id);}
 revokeSession(){this.token=null;this.vaults.clear();}
 private authorized(token:string){return !!this.token&&typeof token==='string'&&Buffer.byteLength(token)===Buffer.byteLength(this.token)&&timingSafeEqual(Buffer.from(token),Buffer.from(this.token));}
 async executeToolCall(call:MCPToolCall,token:string):Promise<MCPToolResult>{
  if(!this.authorized(token))return {callId:call.id,success:false,error:'Unauthenticated or revoked'};
  try{
   const a=call.arguments;let data:unknown;
   if(call.name==='list_vaults')data=[...this.vaults].map(([id,v])=>({id,name:v.name}));
   else {
    if(typeof a.vault_id!=='string'||!this.vaults.has(a.vault_id))throw new Error('Vault access denied');
    const v=this.vaults.get(a.vault_id)!;
    if(call.name==='search_vault'){
     if(typeof a.term!=='string'||a.term.length>2000)throw new Error('Invalid query');
     data=await new VaultSearchProvider().queryDocuments(v.path,a.term,undefined,undefined,{provider:'openai',prompt:a.term,includeRawAndDrafts:this.includeDrafts});
    }else if(call.name==='read_document'){
     if(typeof a.document_id!=='string'||typeof a.sha256!=='string')throw new Error('Document ID and expected hash required');
     data=readDocument(v.path,a.document_id,a.sha256,this.includeDrafts);
    }else throw new Error('Unsupported tool: service is READ-ONLY');
   }
   if(!this.authorized(token))throw new Error('Session revoked');
   return {callId:call.id,success:true,data};
  }catch{return {callId:call.id,success:false,error:'Read-only request denied or source unavailable; re-index if needed'};}
 }
}
