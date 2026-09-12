/** Version 2 native workflow contract. Immutable revisions; local transport only. */
export interface WorkflowRevision {revision:number;relativePath:string;sha256:string;createdAt:string}
export interface WorkflowItem {id:string;kind:'output'|'proposal';title:string;category:string;workflowStatus:string;revisions:WorkflowRevision[];versions:{revision:number;markdown:string}[];sources:unknown[];sourceWarnings:string[];origin:string;provider?:string;model?:string;decision?:Record<string,unknown>}
export interface WorkflowState {version:number;generation:number;items:WorkflowItem[];reindexRequired:boolean}
export type WorkflowTransport=(vaultPath:string,request:Record<string,unknown>)=>Promise<WorkflowState>;
export class GovernedWorkflow {
 constructor(private transport:WorkflowTransport){}
 async execute(vaultPath:string,request:Record<string,unknown>){
  const r=await this.transport(vaultPath,request);
  if(r.version!==2||!Number.isSafeInteger(r.generation)||!Array.isArray(r.items))throw new Error('Unsupported native workflow state');
  for(const i of r.items){if(!['output','proposal'].includes(i.kind)||!['pending','approved','rejected'].includes(i.workflowStatus)||!i.revisions.length)throw new Error('Invalid workflow item');for(const [n,v]of i.revisions.entries()){if(v.revision!==n+1||!/^[a-f0-9]{64}$/.test(v.sha256))throw new Error('Invalid revision contract');}}
  return r;
 }
}
