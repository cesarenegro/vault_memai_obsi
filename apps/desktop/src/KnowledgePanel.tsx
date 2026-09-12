import {useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
const folders:Record<string,string>={clients:'01_CLIENTS',projects:'02_PROJECTS',brands:'03_BRANDS',positioning:'04_POSITIONING',packaging:'05_PACKAGING_KNOWLEDGE',methods:'06_METHODS',case_studies:'07_CASE_STUDIES',research:'08_MARKET_RESEARCH',competitors:'09_COMPETITORS',approved_outputs:'10_APPROVED_OUTPUTS'};
type Note={relativePath:string;title:string;status:string;sha256:string;markdown:string};
export function KnowledgePanel({vaultPath,category}:{vaultPath:string;category:string}){
 const [notes,setNotes]=useState<Note[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;setBusy(true);setError('');setNotes([]);void invoke<Note[]>('list_knowledge',{vaultPath,folder:folders[category]}).then(r=>{if(live)setNotes(r)}).catch(e=>{if(live)setError(String(e))}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[vaultPath,category,refresh]);
 return <div className="limen-card" style={{padding:24}}><h3>{folders[category]}</h3><p>Read directly from local Markdown files. No search index or network required.</p><button disabled={busy} onClick={()=>setRefresh(n=>n+1)}>REFRESH KNOWLEDGE</button>{busy?<p role="status">Loading local notes...</p>:error?<p role="alert">{error}</p>:notes.length===0?<p>No Markdown notes in this category.</p>:notes.map(n=><details key={n.relativePath}><summary>{n.title} · {n.status} · {n.relativePath}</summary><p style={{overflowWrap:'anywhere'}}>SHA-256 {n.sha256}</p><pre style={{whiteSpace:'pre-wrap'}}>{n.markdown}</pre></details>)}</div>
}
