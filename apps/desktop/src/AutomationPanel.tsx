import {ModelPicker} from './ModelPicker';
import {useCallback,useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import './AutomationPanel.css';

type Job={status:string;error?:string;attempts:number;output?:string;parts:Record<string,string>};
type Report={config:{enabled:boolean;model:string};state:{jobs:Record<string,Job>;indexDirty:boolean};message:string;sourceCount:number;readySourceCount:number;blockedSourceCount:number;readyWikiCount:number};
const labels:Record<string,string>={pending:'In coda',waiting:'In attesa della connessione AI',processing:'Elaborazione',converting:'Conversione in Markdown',ready:'Pronto',error:'Da controllare',unsupported:'Non leggibile',removed:'Originale rimosso',obsolete:'Sostituito'};
export function useAutomation(vaultPath:string|null){
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[running,setRunning]=useState(false),[revision,setRevision]=useState(0);
 const flight=useRef(false);
 useEffect(()=>{if(!vaultPath||!('__TAURI_INTERNALS__' in window))return;let live=true;let failures=0;let timer:ReturnType<typeof setTimeout>;
 const tick=async()=>{if(flight.current){timer=setTimeout(tick,2000);return;}flight.current=true;try{const state=await invoke<Report>('automation_status',{vaultPath});if(!live)return;setReport(state);if(state.config.enabled){setRunning(true);const result=await invoke<Report>('automation_run',{vaultPath});if(live){setReport(result);setError('');failures=0;}}}catch(e){failures++;if(live)setError(String(e)+(failures>=3?' · Automazione sospesa dopo tre errori consecutivi.':''));}finally{flight.current=false;if(live){setRunning(false);if(failures<3)timer=setTimeout(tick,15000);}}};
 setReport(null);setError('');void tick();return()=>{live=false;clearTimeout(timer);};},[vaultPath,revision]);
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 return {report,error,running,refresh};
}
export function AutomationPanel({vaultPath,automation}:{vaultPath:string;automation:ReturnType<typeof useAutomation>}){
 const {report,error,running,refresh}=automation;const [model,setModel]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(report)setModel(report.config.model);},[report?.config.model]);
 async function action(command:string,args:Record<string,unknown>={}){setBusy(true);setMessage('');try{await invoke(command,{vaultPath,...args});refresh();}catch(e){setMessage(String(e));}finally{setBusy(false);}}
 async function upload(){setBusy(true);setMessage('');try{const results=await invoke<{name:string;path?:string;error?:string}[]>('automation_choose_files',{vaultPath});const n=results.filter(r=>r.path).length;setMessage(results.length?`${n} file caricati. ${results.filter(r=>r.error).map(r=>`${r.name}: ${r.error}`).join(' · ')}`:'Selezione annullata.');refresh();}catch(e){setMessage(String(e));}finally{setBusy(false);}}

 const jobs=Object.entries(report?.state.jobs??{});
 return <section className="limen-card" style={{padding:24,marginBottom:20}}><h3>Carica i file. LIMEN organizza la conoscenza.</h3>
 <p>Conversione in Markdown, normalizzazione, categorie, collegamenti, ricerca e wiki AI automatici. Gli originali restano nel Vault.</p>
 <button className="limen-upload-button" aria-label="Carica documenti grezzi" aria-busy={busy} disabled={busy} onClick={()=>void upload()}>{busy?'CARICAMENTO…':'CARICA DOCUMENTI'}</button>
 <p>PDF e scansioni, Word (DOC/DOCX), ODT/RTF, PowerPoint (PPTX), Excel/ODS, immagini e testi. Elaborazione mentre LIMEN è aperta; ripresa automatica alla riapertura. Massimo 32 MB per file.</p>
 <details open={!report?.config.enabled}><summary>Configurazione dell’automazione</summary><p>Una sola configurazione: chiave API in Impostazioni e modello API per classificazione e wiki. L’attivazione autorizza l’invio automatico del testo estratto a OpenAI per classificazione e wiki; conversione e OCR avvengono sul Mac, con consumo API. Non pubblica i documenti nel CRM.</p>
 <ModelPicker label="Modello per automazione" value={model} onChange={setModel}/>
 <button disabled={busy||running||!model.trim()} onClick={()=>void action('automation_configure',{config:{enabled:true,model:model.trim()}})}>ATTIVA AUTOMAZIONE</button>{' '}
 <button disabled={busy||running||!report?.config.enabled} onClick={()=>void action('automation_configure',{config:{enabled:false,model:model.trim()}})}>METTI IN PAUSA</button></details>
 <p role="status">{!report?'Controllo dei file caricati…':<>{running?'Elaborazione automatica in corso…':report.config.enabled?'Automazione attiva':report.config.model?'Automazione in pausa':'Automazione da configurare'} · {report.sourceCount} originali caricati · {report.readySourceCount} pronti · {Math.max(0,report.sourceCount-report.readySourceCount-report.blockedSourceCount)} in attesa · {report.blockedSourceCount} da controllare · {report.readyWikiCount} pagine wiki</>}</p>
 {report&&!report.config.enabled&&report.sourceCount>0&&<p role="note"><strong>I file sono nel Vault.</strong> {report.config.model?'Riprendi l’automazione per elaborare i documenti in attesa.':'Completa la configurazione iniziale qui sopra e attiva l’automazione: poi LIMEN elabora tutti gli originali già caricati e quelli aggiunti in seguito.'}</p>}
 {report?.message&&<p>{report.message}</p>}
 <p>Le note automatiche sono consultabili dall’AI e distinguibili dalle note approvate da una persona.</p>
 {(error||message)&&<p role="alert">{error||message}</p>}
 {(error||jobs.some(([,j])=>j.status==='error'))&&<button disabled={busy||running} onClick={()=>void action('automation_retry')}>RIPROVA LE ECCEZIONI RISOLTE</button>}
 {jobs.length>0&&<details><summary>Avanzamento e documenti</summary>{jobs.filter(([,j])=>j.status!=='obsolete').map(([key,j])=><div key={key} style={{padding:'8px 0',overflowWrap:'anywhere'}}><strong>{key.startsWith('wiki:')?'Wiki':key.replace('20_RAW_SOURCES/','')}</strong> — {labels[j.status]??j.status}{j.error&&<p>{j.error}{j.attempts>=3?' · Tentativi automatici esauriti.':''}</p>}{j.output&&<small>{j.output}</small>}</div>)}</details>}
 </section>;
}
