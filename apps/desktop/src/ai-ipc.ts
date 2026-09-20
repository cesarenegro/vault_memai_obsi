import {invoke} from '@tauri-apps/api/core';
export interface AiOptions {prompt:string;model:string;includeDrafts:boolean;sourceIds:string[];category?:string;client?:string;project?:string;tags?:string[]}
export interface AiSource {documentId:string;relativePath:string;title:string;category:string;status?:string;sha256:string;content:string;locator?:string;passageId?:string;revision?:number}
export interface AiPreview {ticket:string;sources:AiSource[];contextBytes:number}
export interface AiAnswer {answer:string;provider:string;model:string;citations:Omit<AiSource,'content'>[];tokensUsed?:number}

export interface EmbeddingsProviderReport {
  provider: 'local' | 'openai';
  model: string;
  dimensions: number;
  endpoint: string;
  cacheDimensions: number;
  cacheEntries: number;
  needsReindex: boolean;
}

export interface LocalModelReport {
  installed: boolean;
  path: string;
  bytes: number;
  sha256Ok: boolean;
}

export interface LocalServerReport {
  running: boolean;
  port: number;
  model: string;
  healthy: boolean;
  lastError: string | null;
}

export interface LocalModelProgress {
  downloaded: number;
  total: number;
  percent: number;
}

async function call<T>(command:string,args?:Record<string,unknown>):Promise<T>{if(!('__TAURI_INTERNALS__' in window))throw new Error('È necessaria l’applicazione nativa LIMEN');return invoke<T>(command,args);}
export const aiIpc={
 models:()=>call<string[]>('ai_list_models'),
 status:()=>call<boolean>('ai_key_status'),saveKey:(key:string)=>call<void>('ai_save_key',{key}),deleteKey:()=>call<void>('ai_delete_key'),
 preview:(vaultPath:string,options:AiOptions)=>call<AiPreview>('ai_preview',{vaultPath,options}),ask:(ticket:string)=>call<AiAnswer>('ai_ask',{ticket}),cancel:(ticket:string)=>call<void>('ai_cancel',{ticket}),
 read:(vaultPath:string,s:Omit<AiSource,'content'>,includeDrafts:boolean)=>call<AiSource>('ai_read_source',{vaultPath,documentId:s.documentId,sha256:s.sha256,includeDrafts}),
 mcpStatus:()=>call<{active:boolean;endpoint?:string;vaultId?:string}>('mcp_status'),mcpStart:(vaultPath:string,includeDrafts:boolean)=>call<{endpoint:string;token:string;vaultId:string}>('mcp_start',{vaultPath,includeDrafts}),mcpStop:()=>call<void>('mcp_stop'),tunnelStop:()=>call<void>('tunnel_stop'),
 
 // Semantic & Local RAG IPC methods (Gate A04 / Compito 1)
 embeddingsGetProvider: (vaultPath: string) => call<EmbeddingsProviderReport>('embeddings_get_provider', { vaultPath }),
 embeddingsSetProvider: (vaultPath: string, provider: 'local' | 'openai') => call<EmbeddingsProviderReport>('embeddings_set_provider', { vaultPath, provider }),
 localModelStatus: () => call<LocalModelReport>('local_model_status'),
 localModelDownload: () => call<LocalModelReport>('local_model_download'),
 localModelSelectFile: (filePath: string) => call<LocalModelReport>('local_model_select_file', { filePath }),
 localModelPickAndInstall: () => call<LocalModelReport>('local_model_pick_and_install'),
 localServerStart: () => call<LocalServerReport>('local_server_start'),
 localServerStop: () => call<LocalServerReport>('local_server_stop'),
 localServerStatus: () => call<LocalServerReport>('local_server_status'),
 embeddingsCancelSync: () => call<void>('embeddings_cancel_sync'),
 embeddingsSyncVault: (vaultPath: string, apiKey?: string, model?: string) => call<any>('embeddings_sync_vault', { vaultPath, apiKey: apiKey ?? null, model: model ?? null })
};
