import {invoke} from '@tauri-apps/api/core';
import {GovernedWorkflow,type WorkflowItem,type WorkflowState,type WorkflowRevision} from '@limen-vault/proposal-engine';
export type M7Item=WorkflowItem;export type M7State=WorkflowState;export type M7Revision=WorkflowRevision;
export function operationId(){return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')}
const workflow=new GovernedWorkflow(async(vaultPath,request)=>{
 if(!('__TAURI_INTERNALS__' in window))throw new Error('È necessaria l’applicazione nativa LIMEN');
 return invoke<WorkflowState>('m7_execute',{vaultPath,request});
});
export const m7=(vaultPath:string,request:Record<string,unknown>)=>workflow.execute(vaultPath,request);
