import {labelIt, MessageIt} from './locale';
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
 return <div className="limen-card" style={{padding:24}}><h3>Chiedi al Vault</h3><p>Controlla le fonti locali, poi invia a OpenAI solo i documenti mostrati. Le domande non modificano le note. SALVA RISPOSTA COME BOZZA crea una bozza locale su tua richiesta.</p>
 <div style={{display:'grid',gap:12}}><input autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Modello OpenAI" placeholder="Modello API disponibile nel tuo account" value={model} onChange={e=>{invalidate();setModel(e.target.value)}} style={field}/>
 <textarea aria-label="Domanda" placeholder="Fai una domanda sul tuo Vault" maxLength={2000} value={prompt} onChange={e=>{invalidate();setPrompt(e.target.value)}} style={{...field,minHeight:90}}/>
 <label><input type="checkbox" checked={drafts} onChange={e=>{invalidate();setDrafts(e.target.checked)}}/> Includi bozze indicizzate e note non approvate (le fonti originali sono escluse)</label>
 <button style={button} disabled={busy||!prompt.trim()||!model.trim()} onClick={prepare}>ANTEPRIMA FONTI</button>
 {busy&&<button style={button} onClick={()=>{invalidate();setError('Annullato. Una richiesta già inviata potrebbe comunque essere elaborata dal fornitore.');}}>ANNULLA</button>}
 {error&&<p role="alert" style={{color:'#b91c1c'}}>{<MessageIt value={error}/>}</p>}
 {preview&&<div><p>{preview.sources.length} fonti, {preview.contextBytes} byte di contesto. Controlla prima di inviare.</p>{preview.sources.map(s=><details key={s.documentId}><summary>{s.title} — {labelIt(s.status)} — {s.relativePath}</summary><p style={{overflowWrap:'anywhere'}}>SHA-256: {s.sha256}</p><pre style={{whiteSpace:'pre-wrap'}}>{s.content}</pre></details>)}<button style={button} disabled={busy||preview.sources.length===0} onClick={send}>INVIA A OPENAI LE FONTI MOSTRATE</button></div>}
 {answer&&<div><button disabled={busy||!!saveMessage} onClick={async()=>{setBusy(true);try{await m7(vaultPath,{action:'save',operationId:saveOperation.current,title:prompt.slice(0,200),content:answer.answer,provider:answer.provider,model:answer.model,sources:answer.citations});setSaveMessage('Bozza salvata in locale. Apri Risposte AI e aggiorna l’indice di ricerca.')}catch(e){setError(String(e))}finally{setBusy(false)}}}>SALVA RISPOSTA COME BOZZA</button>{saveMessage&&<p role="status">{saveMessage}</p>}<p>{answer.provider} / {answer.model}{answer.tokensUsed!=null?` · ${answer.tokensUsed} tokens`:''}</p><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{answer.answer}</pre><p>Citazioni collegate alle fonti fornite: verifica sempre la correttezza della risposta.</p>{answer.citations.map(s=><button style={field} key={s.documentId} onClick={async()=>{const id=seq.current;try{const doc=await aiIpc.read(vaultPath,s,drafts);if(id===seq.current)setOpened(doc);}catch(e){if(id===seq.current)setError(String(e));}}}>{s.title} · {s.relativePath}</button>)}</div>}
 {opened&&<details open><summary>{opened.title} · SHA-256 {opened.sha256}</summary><pre style={{whiteSpace:'pre-wrap'}}>{opened.content}</pre></details>}
 </div></div>;
}
export function AiSettings({vaultPath}:{vaultPath:string}){
 const [key,setKey]=useState('');const [configured,setConfigured]=useState<boolean|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [connection,setConnection]=useState<{active:boolean;endpoint?:string;vaultId?:string;token?:string}>({active:false});
 useEffect(()=>{void aiIpc.mcpStatus().then(setConnection).catch(e=>setMessage(String(e)));},[]);
 async function action(f:()=>Promise<void>){setBusy(true);setMessage('');try{await f();}catch(e){setMessage(String(e));}finally{setBusy(false);}}
 return <div className="limen-card" style={{padding:24,marginTop:20}}><h3>Collegamenti AI</h3><p>La chiave API rimane nel Portachiavi macOS. La disponibilità del modello viene verificata dal fornitore all’invio della richiesta.</p>
 <input type="password" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" aria-label="Chiave API OpenAI" value={key} onChange={e=>setKey(e.target.value)} style={field}/>
 <button style={button} disabled={busy||!key} onClick={()=>{const value=key;setKey('');void action(async()=>{await aiIpc.saveKey(value);setConfigured(true);setMessage('Salvata nel Portachiavi');})}}>SALVA CHIAVE</button>
 <button style={field} disabled={busy} onClick={()=>action(async()=>setConfigured(await aiIpc.status()))}>VERIFICA PORTACHIAVI</button>
 <button style={field} disabled={busy} onClick={()=>action(async()=>{await aiIpc.deleteKey();setConfigured(false);})}>RIMUOVI CHIAVE</button><p>{configured===null?'Portachiavi non verificato':configured?'Chiave API configurata':'Nessuna chiave API configurata'}</p>
 <h4>MCP in sola lettura · Vault corrente</h4><p>Vengono condivise solo note approvate e indicizzate. L’indirizzo locale non collega automaticamente ChatGPT Business: il collegamento del client esterno va configurato.</p>
 <button style={button} disabled={busy||connection.active} onClick={()=>action(async()=>{const c=await aiIpc.mcpStart(vaultPath,false);setConnection({...c,active:true});})}>ATTIVA MCP LOCALE</button>
 <button style={field} disabled={busy||!connection.active} onClick={()=>action(async()=>{await aiIpc.mcpStop();setConnection({active:false});})}>REVOCA MCP</button>
 {connection.active&&<div><p>Indirizzo attivo: {connection.endpoint}</p><p>ID Vault: {connection.vaultId}</p>{connection.token&&<details><summary>Mostra il token di collegamento — mantienilo riservato</summary><input aria-label="Token di collegamento MCP" type="password" readOnly value={connection.token} style={{...field,width:'90%'}}/></details>}<p>La revoca invalida questo token. Il riavvio dell’app disattiva il collegamento.</p></div>}
 {message&&<p role="status">{<MessageIt value={message}/>}</p>}<TunnelPanel vaultPath={vaultPath}/></div>;
}
