import type {AIEngineContract,AIQueryOptions,AIQueryResult} from './index.js';
import {ContextSelector} from './context-selector.js';
export type HttpRequester=(url:string,options:{method:string;headers:Record<string,string>;body:string;timeoutMs?:number;signal?:AbortSignal})=>Promise<{statusCode:number;body:string}>;
export class OpenAIAdapter implements AIEngineContract {
 private selector=new ContextSelector();
 constructor(private apiKey:string|null=null,private requester?:HttpRequester){}
 setApiKey(key:string|null){this.apiKey=key?.trim()||null;} clearApiKey(){this.apiKey=null;} isConfigured(){return !!this.apiKey;}
 setContextSelector(s:ContextSelector){this.selector=s;}
 async askKnowledge(o:AIQueryOptions):Promise<AIQueryResult>{
  if(!this.apiKey)throw new Error('OpenAI API key is missing');
  if(o.provider!=='openai'||!o.model?.trim()||!o.vaultPath)throw new Error('Explicit OpenAI model and Vault required');
  const selection=await this.selector.selectContext(o.vaultPath,o);
  if(!selection.sources.length)throw new Error('No eligible context; no data sent');
  const body=JSON.stringify({model:o.model,store:false,max_output_tokens:o.maxTokens??1000,input:[{role:'system',content:selection.formattedSystemPrompt},{role:'user',content:selection.formattedUserPrompt}],text:{format:{type:'json_schema',name:'vault_answer',strict:true,schema:{type:'object',properties:{answer:{type:'string'},citation_ids:{type:'array',items:{type:'string'}}},required:['answer','citation_ids'],additionalProperties:false}}}});
  const signal=o.signal?AbortSignal.any([o.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000);
  const args={method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.apiKey}`},body,timeoutMs:30000,signal}; const start=Date.now();
  let res:{statusCode:number;body:string};
  try {if(this.requester)res=await this.requester('https://api.openai.com/v1/responses',args);else{
   const r=await fetch('https://api.openai.com/v1/responses',{...args,redirect:'error'});let size=0;const chunks:Uint8Array[]=[];const reader=r.body?.getReader();
   if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw new Error('Response too large');chunks.push(value);}}finally{await reader.cancel();}
   res={statusCode:r.status,body:Buffer.concat(chunks).toString('utf8')};
  }}catch{throw new Error(signal.aborted?'AI request cancelled or timed out':'AI network request failed');}
  if(signal.aborted)throw new Error('AI request cancelled or timed out');
  if(res.statusCode!==200)throw new Error(`OpenAI HTTP ${res.statusCode}`);
  const r=JSON.parse(res.body);if(r.status!=='completed'||typeof r.model!=='string')throw new Error('Incomplete or malformed API response');
  const texts=r.output?.flatMap((x:any)=>x.type==='message'?x.content??[]:[]).filter((x:any)=>x.type==='output_text');
  if(!Array.isArray(texts)||texts.length!==1)throw new Error('Missing answer or refusal');
  const answer=JSON.parse(texts[0].text);
  if(typeof answer.answer!=='string'||!answer.answer.trim()||!Array.isArray(answer.citation_ids)||answer.citation_ids.some((id:unknown)=>typeof id!=='string'||!selection.citations.some(c=>c.documentId===id)))throw new Error('Invalid or unknown citations');
  return {answer:answer.answer,provider:'openai',model:r.model,citations:selection.citations.filter(c=>answer.citation_ids.includes(c.documentId)),tokensUsed:Number.isSafeInteger(r.usage?.total_tokens)?r.usage.total_tokens:undefined,latencyMs:Date.now()-start};
 }
}
