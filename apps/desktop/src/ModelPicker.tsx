import {useEffect,useState} from 'react';
import {aiIpc} from './ai-ipc';
function isChatModel(id:string):boolean{
 const l=id.toLowerCase();
 if(l.includes('whisper')||l.includes('dall-e')||l.includes('tts')||l.includes('embedding')||l.includes('moderation')||l.includes('realtime')||l.includes('audio')||l.includes('babbage')||l.includes('davinci'))return false;
 return l.startsWith('gpt-')||l.startsWith('o1')||l.startsWith('o3')||l.startsWith('o4')||l.startsWith('chatgpt')||l.includes('turbo');
}
export function ModelPicker({value,onChange,label='Modello OpenAI'}:{value:string;onChange:(value:string)=>void;label?:string}){
 const [models,setModels]=useState<string[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError('');void aiIpc.models().then(list=>{if(live)setModels(list.filter(isChatModel))}).catch(e=>{if(live)setError(String(e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[revision]);
 return <div><label>{label}{' '}<select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} disabled={loading} style={{padding:10,maxWidth:'100%'}}><option value="">{loading?'Caricamento modelli…':'Seleziona un modello del tuo account'}</option>{value&&!models.includes(value)&&<option value={value}>{value} (configurato)</option>}{models.map(m=><option key={m} value={m}>{m}</option>)}</select></label>{' '}<button disabled={loading} onClick={()=>setRevision(n=>n+1)}>AGGIORNA MODELLI</button>{error&&<p role="alert">{error}</p>}{!loading&&!error&&models.length===0&&<p>Nessun modello restituito dall’account.</p>}<small style={{display:'block'}}>Elenco fornito da OpenAI usando la chiave salvata in Impostazioni. Scegli un modello di testo: la compatibilità con la funzione viene verificata alla richiesta. Il caricamento dell’elenco non invia documenti.</small><details><summary>Inserisci manualmente il nome di un modello</summary><input aria-label={`${label} manuale`} value={value} onChange={e=>onChange(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false}/></details></div>
}
