import {labelIt, MessageIt} from './locale';
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
 return <div className="limen-card" style={{padding:24}}><h3>{kind==='output'?'Risposte AI salvate':'Revisione delle proposte'}</h3><p>Le modifiche restano locali. L’inserimento nella conoscenza richiede l’approvazione della revisione mostrata. Dopo le modifiche aggiorna l’indice di ricerca; le differenze rispetto al manifesto restano visibili.</p>
 <button disabled={busy} onClick={()=>action({action:'list'})}>AGGIORNA</button> <button disabled={busy} onClick={()=>action({action:'recover'})}>RECUPERA OPERAZIONE INTERROTTA</button>
 {error&&<p role="alert">{<MessageIt value={error}/>}</p>}
 <label>Categoria <select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{labelIt(c)}</option>)}</select></label>
 {items.filter(i=>i.kind===kind).map(i=><Review key={i.id} item={i} busy={busy} category={category} action={action}/>)}
 {kind==='proposal'&&<details><summary>Importa una bozza compilata da revisionare</summary><p>Importa una copia conservando la provenienza. Le bozze originali e l’indice di compilazione restano invariati.</p>{drafts.map(d=><details key={d.relative_path}><summary>{d.title} · {d.relative_path}</summary><pre style={{whiteSpace:'pre-wrap'}}>{d.markdown}</pre><button disabled={busy} onClick={async()=>{const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d.markdown));const hash=Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');await action({action:'import',operationId:operationId(),sourcePath:d.relative_path,expectedSha256:hash,title:d.title,category});}}>IMPORTA BOZZA MOSTRATA</button></details>)}</details>}
 </div>
}
function Review({item:i,busy,category,action}:{item:M7Item;busy:boolean;category:string;action:(r:Record<string,unknown>)=>Promise<void>}){
 const latest=i.revisions[i.revisions.length-1];const text=i.versions[i.versions.length-1].markdown;
 const [edit,setEdit]=useState(''),[reason,setReason]=useState(''),[target,setTarget]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{setEdit('');setConfirm(false)},[latest.sha256]);
 const base={id:i.id,revision:latest.revision,expectedSha256:latest.sha256};
 return <details style={{padding:12,borderBottom:'1px solid #ddd'}}><summary>{i.title} · {labelIt(i.workflowStatus)} · revisione {latest.revision}</summary><p>{labelIt(i.origin)} {i.provider} {i.model}</p><p style={{overflowWrap:'anywhere'}}>SHA-256 {latest.sha256}</p>{i.sourceWarnings.map(w=><p role="status" key={w}>{<MessageIt value={w}/>}</p>)}<pre style={{whiteSpace:'pre-wrap'}}>{text}</pre>
 <details><summary>Fonti e provenienza (verifica la validità)</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(i.sources,null,2)}</pre></details>
 <details><summary>Cronologia delle revisioni conservate</summary>{i.versions.map(v=><div key={v.revision}><h4>Revisione {v.revision}</h4><pre style={{whiteSpace:'pre-wrap'}}>{v.markdown}</pre></div>)}</details>
 {i.kind==='output'?<button disabled={busy} onClick={()=>action({action:'create',operationId:operationId(),id:i.id,expectedSha256:latest.sha256,title:i.title,category})}>CREA PROPOSTA DALLA RISPOSTA SALVATA</button>:i.workflowStatus==='pending'&&<div style={{display:'grid',gap:8}}>
 <label>Testo della nuova revisione<textarea aria-label="Testo della nuova revisione" value={edit} onChange={e=>setEdit(e.target.value)} style={{...field,width:'100%',minHeight:100}}/></label>
 {edit.trim()&&<details open><summary>Confronta il testo attuale con la revisione proposta</summary><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}><div><h4>Testo attuale</h4><pre style={{whiteSpace:'pre-wrap'}}>{text.replace(/^---\n[\s\S]*?\n---\n/,'')}</pre></div><div><h4>Testo proposto</h4><pre style={{whiteSpace:'pre-wrap'}}>{edit}</pre></div></div></details>}
 <button disabled={busy||!edit.trim()} onClick={()=>action({...base,action:'revise',operationId:operationId(),content:edit})}>SALVA NUOVA REVISIONE (CONSERVA LA PRECEDENTE)</button>
 <label>Motivo del rifiuto<input aria-label="Motivo del rifiuto" value={reason} onChange={e=>setReason(e.target.value)} style={field}/></label><button disabled={busy||!reason.trim()} onClick={()=>action({...base,action:'reject',operationId:operationId(),reason})}>RIFIUTA REVISIONE MOSTRATA</button>
 <label>Nuova destinazione (.md)<input aria-label="Destinazione della nota approvata" value={target} placeholder={`${dirs[categories.indexOf(i.category)]}/nuova-nota.md`} onChange={e=>{setTarget(e.target.value);setConfirm(false)}} style={field}/></label><p>Indica un file nuovo nella categoria della proposta. Le note esistenti non vengono sovrascritte.</p>
 <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Ho verificato questa revisione e la destinazione indicata.</label><button disabled={busy||!confirm||!target} onClick={()=>action({...base,action:'approve',operationId:operationId(),targetPath:target})}>APPROVA REVISIONE MOSTRATA</button>
 </div>}{i.decision&&<pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(i.decision,null,2)}</pre>}</details>
}
