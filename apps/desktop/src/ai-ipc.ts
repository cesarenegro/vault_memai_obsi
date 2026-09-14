import {invoke} from '@tauri-apps/api/core';
export interface AiOptions {prompt:string;model:string;includeDrafts:boolean;sourceIds:string[];category?:string;client?:string;project?:string;tags?:string[]}
export interface AiSource {documentId:string;relativePath:string;title:string;category:string;status?:string;sha256:string;content:string}
export interface AiPreview {ticket:string;sources:AiSource[];contextBytes:number}
export interface AiAnswer {answer:string;provider:string;model:string;citations:Omit<AiSource,'content'>[];tokensUsed?:number}
async function call<T>(command:string,args?:Record<string,unknown>):Promise<T>{if(!('__TAURI_INTERNALS__' in window))throw new Error('È necessaria l’applicazione nativa LIMEN');return invoke<T>(command,args);}
export const aiIpc={
 status:()=>call<boolean>('ai_key_status'),saveKey:(key:string)=>call<void>('ai_save_key',{key}),deleteKey:()=>call<void>('ai_delete_key'),
 preview:(vaultPath:string,options:AiOptions)=>call<AiPreview>('ai_preview',{vaultPath,options}),ask:(ticket:string)=>call<AiAnswer>('ai_ask',{ticket}),cancel:(ticket:string)=>call<void>('ai_cancel',{ticket}),
 read:(vaultPath:string,s:Omit<AiSource,'content'>,includeDrafts:boolean)=>call<AiSource>('ai_read_source',{vaultPath,documentId:s.documentId,sha256:s.sha256,includeDrafts}),
 mcpStatus:()=>call<{active:boolean;endpoint?:string;vaultId?:string}>('mcp_status'),mcpStart:(vaultPath:string,includeDrafts:boolean)=>call<{endpoint:string;token:string;vaultId:string}>('mcp_start',{vaultPath,includeDrafts}),mcpStop:()=>call<void>('mcp_stop'),tunnelStop:()=>call<void>('tunnel_stop')
};
