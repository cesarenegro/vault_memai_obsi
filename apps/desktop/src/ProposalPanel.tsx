import {useEffect,useState} from 'react';
import {m7,operationId,type M7Item} from './proposal-ipc';
import {invoke} from '@tauri-apps/api/core';
const categories=['client','project','brand','positioning','packaging','method','case_study','research','competitor','approved_output'];
const dirs=['01_CLIENTS','02_PROJECTS','03_BRANDS','04_POSITIONING','05_PACKAGING_KNOWLEDGE','06_METHODS','07_CASE_STUDIES','08_MARKET_RESEARCH','09_COMPETITORS','10_APPROVED_OUTPUTS'];
const field={padding:8,border:'1px solid #cbd5e1',borderRadius:6};
export function ProposalPanel({vaultPath,kind}:{vaultPath:string;kind:'output'|'proposal'}){
 const [items,setItems]=useState<M7Item[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[category,setCategory]=useState('client'),[drafts,setDrafts]=useState<{relative_path:string;title:string;markdown:string}[]>([]);
 async function action(q:Record<string,unknown>){setBusy(true);setError('');try{const r=await m7(vaultPath,q);setItems(r.items);}catch(e){setError(String(e));}finally{setBusy(false);}}
 useEffect(()=>{let live=true;setItems([]);void m7(vaultPath,{action:'list'}).then(r=>{if(live)setItems(r.items)}).catch(e=>{if(live)setError(String(e))});if(kind==='proposal')void invoke<typeof drafts>('list_proposals',{vaultPath}).then(r=>{if(live)setDrafts(r)}).catch(e=>{if(live)setError(String(e))});return()=>{live=false}},[vaultPath,kind]);
 return <div className="limen-card" style={{padding:24}}><h3>{kind==='output'?'Saved AI Outputs':'Review Proposals'}</h3><p>Changes remain local. Publishing requires approval of the displayed revision. Re-index search explicitly after changes; manifest discrepancies remain visible.</p>
 <button disabled={busy} onClick={()=>action({action:'list'})}>REFRESH</button> <button disabled={busy} onClick={()=>action({action:'recover'})}>RECOVER INTERRUPTED OPERATION</button>
 {error&&<p role="alert">{error}</p>}
 <label>Category <select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
 {items.filter(i=>i.kind===kind).map(i=><Review key={i.id} item={i} busy={busy} category={category} action={action}/>)}
 {kind==='proposal'&&<details><summary>Import a compiler draft for review</summary><p>Imports a preserved copy with provenance. Original M4 files and compiler index are unchanged.</p>{drafts.map(d=><details key={d.relative_path}><summary>{d.title} · {d.relative_path}</summary><pre style={{whiteSpace:'pre-wrap'}}>{d.markdown}</pre><button disabled={busy} onClick={async()=>{const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d.markdown));const hash=Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');await action({action:'import',operationId:operationId(),sourcePath:d.relative_path,expectedSha256:hash,title:d.title,category});}}>IMPORT DISPLAYED DRAFT</button></details>)}</details>}
 </div>
}
function Review({item:i,busy,category,action}:{item:M7Item;busy:boolean;category:string;action:(r:Record<string,unknown>)=>Promise<void>}){
 const latest=i.revisions[i.revisions.length-1];const text=i.versions[i.versions.length-1].markdown;
 const [edit,setEdit]=useState(''),[reason,setReason]=useState(''),[target,setTarget]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{setEdit('');setConfirm(false)},[latest.sha256]);
 const base={id:i.id,revision:latest.revision,expectedSha256:latest.sha256};
 return <details style={{padding:12,borderBottom:'1px solid #ddd'}}><summary>{i.title} · {i.workflowStatus} · revision {latest.revision}</summary><p>{i.origin} {i.provider} {i.model}</p><p style={{overflowWrap:'anywhere'}}>SHA-256 {latest.sha256}</p>{i.sourceWarnings.map(w=><p role="status" key={w}>{w}</p>)}<pre style={{whiteSpace:'pre-wrap'}}>{text}</pre>
 <details><summary>Sources and provenance (review validity)</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(i.sources,null,2)}</pre></details>
 <details><summary>Preserved revision history</summary>{i.versions.map(v=><div key={v.revision}><h4>Revision {v.revision}</h4><pre style={{whiteSpace:'pre-wrap'}}>{v.markdown}</pre></div>)}</details>
 {i.kind==='output'?<button disabled={busy} onClick={()=>action({action:'create',operationId:operationId(),id:i.id,expectedSha256:latest.sha256,title:i.title,category})}>CREATE PROPOSAL FROM SAVED OUTPUT</button>:i.workflowStatus==='pending'&&<div style={{display:'grid',gap:8}}>
 <label>New revision body<textarea aria-label="New revision body" value={edit} onChange={e=>setEdit(e.target.value)} style={{...field,width:'100%',minHeight:100}}/></label>
 {edit.trim()&&<details open><summary>Compare the current body with the proposed revision</summary><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}><div><h4>Current body</h4><pre style={{whiteSpace:'pre-wrap'}}>{text.replace(/^---\n[\s\S]*?\n---\n/,'')}</pre></div><div><h4>Proposed body</h4><pre style={{whiteSpace:'pre-wrap'}}>{edit}</pre></div></div></details>}
 <button disabled={busy||!edit.trim()} onClick={()=>action({...base,action:'revise',operationId:operationId(),content:edit})}>SAVE NEW REVISION (PRESERVE PREVIOUS)</button>
 <label>Rejection reason<input aria-label="Rejection reason" value={reason} onChange={e=>setReason(e.target.value)} style={field}/></label><button disabled={busy||!reason.trim()} onClick={()=>action({...base,action:'reject',operationId:operationId(),reason})}>REJECT DISPLAYED REVISION</button>
 <label>New destination (.md)<input aria-label="Approval destination" value={target} placeholder={`${dirs[categories.indexOf(i.category)]}/new-note.md`} onChange={e=>{setTarget(e.target.value);setConfirm(false)}} style={field}/></label><p>Only a new file in the proposal category is permitted. Existing notes are never overwritten.</p>
 <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>I reviewed this exact revision and destination.</label><button disabled={busy||!confirm||!target} onClick={()=>action({...base,action:'approve',operationId:operationId(),targetPath:target})}>APPROVE DISPLAYED REVISION</button>
 </div>}{i.decision&&<pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(i.decision,null,2)}</pre>}</details>
}
