import {TunnelPanel} from './TunnelPanel';
import {m7,operationId} from './proposal-ipc';
import React,{useEffect,useRef,useState} from 'react';
import {aiIpc,type AiAnswer,type AiPreview,type AiSource} from './ai-ipc';
const field:React.CSSProperties={padding:10,border:'1px solid #cbd5e1',borderRadius:6,font: 'inherit'};
const button:React.CSSProperties={...field,cursor:'pointer',background:'#0f172a',color:'white'};
export function AiPanel({vaultPath}:{vaultPath:string}){
 const [prompt,setPrompt]=useState('');const [model,setModel]=useState('');const [drafts,setDrafts]=useState(false);const [preview,setPreview]=useState<AiPreview|null>(null);const [answer,setAnswer]=useState<AiAnswer|null>(null);const [opened,setOpened]=useState<AiSource|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const seq=useRef(0);const ticket=useRef<string|null>(null);const saveOperation=useRef(operationId());const [saveMessage,setSaveMessage]=useState('');
 useEffect(()=>()=>{seq.current++;if(ticket.current)void aiIpc.cancel(ticket.current);},[]);
 function invalidate(){seq.current++;if(ticket.current)void aiIpc.cancel(ticket.current);ticket.current=null;setPreview(null);setAnswer(null);setOpened(null);setBusy(false);}
 async function prepare(){const id=++seq.current;setBusy(true);setError('');setAnswer(null);try{if(ticket.current)await aiIpc.cancel(ticket.current);const p=await aiIpc.preview(vaultPath,{prompt,model:model.trim(),includeDrafts:drafts,sourceIds:[]});if(id===seq.current){ticket.current=p.ticket;setPreview(p);}else await aiIpc.cancel(p.ticket);}catch(e){if(id===seq.current)setError(String(e));}finally{if(id===seq.current)setBusy(false);}}
 async function send(){if(!preview)return;const id=++seq.current;setBusy(true);setError('');try{const a=await aiIpc.ask(preview.ticket);if(id===seq.current){setAnswer(a);saveOperation.current=operationId();setSaveMessage('');setPreview(null);ticket.current=null;}}catch(e){if(id===seq.current){setError(String(e));setPreview(null);ticket.current=null;}}finally{if(id===seq.current)setBusy(false);}}
 return <div className="limen-card" style={{padding:24}}><h3>Ask Knowledge</h3><p>Preview local sources, then send only the displayed documents to OpenAI. Queries are read-only. SAVE OUTPUT creates a local draft only when requested.</p>
 <div style={{display:'grid',gap:12}}><input autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="OpenAI model" placeholder="API model available to your account" value={model} onChange={e=>{invalidate();setModel(e.target.value)}} style={field}/>
 <textarea aria-label="Question" placeholder="Ask about your Vault" maxLength={2000} value={prompt} onChange={e=>{invalidate();setPrompt(e.target.value)}} style={{...field,minHeight:90}}/>
 <label><input type="checkbox" checked={drafts} onChange={e=>{invalidate();setDrafts(e.target.checked)}}/> Include indexed drafts and unapproved notes (RAW archives are excluded)</label>
 <button style={button} disabled={busy||!prompt.trim()||!model.trim()} onClick={prepare}>PREVIEW SOURCES</button>
 {busy&&<button style={button} onClick={()=>{invalidate();setError('Cancelled. An already transmitted request may still be processed by the provider.');}}>CANCEL</button>}
 {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
 {preview&&<div><p>{preview.sources.length} source(s), {preview.contextBytes} bytes of context. Review before sending.</p>{preview.sources.map(s=><details key={s.documentId}><summary>{s.title} — {s.status??'unspecified'} — {s.relativePath}</summary><p style={{overflowWrap:'anywhere'}}>SHA-256: {s.sha256}</p><pre style={{whiteSpace:'pre-wrap'}}>{s.content}</pre></details>)}<button style={button} disabled={busy||preview.sources.length===0} onClick={send}>SEND DISPLAYED SOURCES TO OPENAI</button></div>}
 {answer&&<div><button disabled={busy||!!saveMessage} onClick={async()=>{setBusy(true);try{await m7(vaultPath,{action:'save',operationId:saveOperation.current,title:prompt.slice(0,200),content:answer.answer,provider:answer.provider,model:answer.model,sources:answer.citations});setSaveMessage('Saved locally as draft. Open AI Outputs. Re-index search explicitly.')}catch(e){setError(String(e))}finally{setBusy(false)}}}>SAVE OUTPUT AS DRAFT</button>{saveMessage&&<p role="status">{saveMessage}</p>}<p>{answer.provider} / {answer.model}{answer.tokensUsed!=null?` · ${answer.tokensUsed} tokens`:''}</p><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{answer.answer}</pre><p>Citations (matched to supplied source IDs; factual correctness still requires review):</p>{answer.citations.map(s=><button style={field} key={s.documentId} onClick={async()=>{const id=seq.current;try{const doc=await aiIpc.read(vaultPath,s,drafts);if(id===seq.current)setOpened(doc);}catch(e){if(id===seq.current)setError(String(e));}}}>{s.title} · {s.relativePath}</button>)}</div>}
 {opened&&<details open><summary>{opened.title} · SHA-256 {opened.sha256}</summary><pre style={{whiteSpace:'pre-wrap'}}>{opened.content}</pre></details>}
 </div></div>;
}
export function AiSettings({vaultPath}:{vaultPath:string}){
 const [key,setKey]=useState('');const [configured,setConfigured]=useState<boolean|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [connection,setConnection]=useState<{active:boolean;endpoint?:string;vaultId?:string;token?:string}>({active:false});
 useEffect(()=>{void aiIpc.mcpStatus().then(setConnection).catch(e=>setMessage(String(e)));},[]);
 async function action(f:()=>Promise<void>){setBusy(true);setMessage('');try{await f();}catch(e){setMessage(String(e));}finally{setBusy(false);}}
 return <div className="limen-card" style={{padding:24,marginTop:20}}><h3>AI connections</h3><p>API key stays in the macOS Keychain. Model availability is checked by the provider when you send a request.</p>
 <input type="password" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" aria-label="OpenAI API key" value={key} onChange={e=>setKey(e.target.value)} style={field}/>
 <button style={button} disabled={busy||!key} onClick={()=>{const value=key;setKey('');void action(async()=>{await aiIpc.saveKey(value);setConfigured(true);setMessage('Saved in Keychain');})}}>SAVE KEY</button>
 <button style={field} disabled={busy} onClick={()=>action(async()=>setConfigured(await aiIpc.status()))}>CHECK KEYCHAIN</button>
 <button style={field} disabled={busy} onClick={()=>action(async()=>{await aiIpc.deleteKey();setConfigured(false);})}>REMOVE KEY</button><p>{configured===null?'Keychain not checked':configured?'API key configured':'No API key configured'}</p>
 <h4>Read-only MCP · current Vault</h4><p>Only approved indexed knowledge is shared. This local endpoint does not automatically connect ChatGPT Business. External clients need a configured connection.</p>
 <button style={button} disabled={busy||connection.active} onClick={()=>action(async()=>{const c=await aiIpc.mcpStart(vaultPath,false);setConnection({...c,active:true});})}>ENABLE LOCAL MCP</button>
 <button style={field} disabled={busy||!connection.active} onClick={()=>action(async()=>{await aiIpc.mcpStop();setConnection({active:false});})}>REVOKE MCP</button>
 {connection.active&&<div><p>Active endpoint: {connection.endpoint}</p><p>Vault ID: {connection.vaultId}</p>{connection.token&&<details><summary>Show connection token — keep private</summary><input aria-label="MCP connection token" type="password" readOnly value={connection.token} style={{...field,width:'90%'}}/></details>}<p>Revocation invalidates this token. Restarting the app disables the connection.</p></div>}
 {message&&<p role="status">{message}</p>}<TunnelPanel vaultPath={vaultPath}/></div>;
}
