import {useEffect,useState} from 'react';import {invoke} from '@tauri-apps/api/core';
export function TunnelPanel({vaultPath}:{vaultPath:string}){
 const [tunnelId,setTunnel]=useState(''),[organizationId,setOrg]=useState(''),[key,setKey]=useState(''),[state,setState]=useState<{active:boolean;ready:boolean;error?:string}>({active:false,ready:false}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function check(){setState(await invoke('tunnel_status'))}
 useEffect(()=>{let live=true;void invoke<{tunnelId:string;organizationId:string}|null>('tunnel_config').then(c=>{if(live&&c){setTunnel(c.tunnelId);setOrg(c.organizationId)}}).catch(e=>{if(live)setMessage(String(e))});const timer=setInterval(()=>{void check().catch(()=>{})},3000);return()=>{live=false;clearInterval(timer)}},[]);
 async function action(fn:()=>Promise<unknown>){setBusy(true);setMessage('');try{await fn();await check()}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 return <section style={{marginTop:24}}><h4>ChatGPT Business · private tunnel</h4><p>Optional. Shares approved indexed sources from the selected Vault. The Mac and this app must remain running. Configure the matching tunnel, workspace and organization in your OpenAI account.</p>
 <label>Tunnel ID<input aria-label="Business tunnel ID" value={tunnelId} onChange={e=>setTunnel(e.target.value)} autoCapitalize="none" autoCorrect="off"/></label>
 <label>Organization ID<input aria-label="Business organization ID" value={organizationId} onChange={e=>setOrg(e.target.value)} autoCapitalize="none" autoCorrect="off"/></label>
 <label>Tunnel runtime key<input type="password" autoComplete="off" aria-label="Tunnel runtime key" value={key} onChange={e=>setKey(e.target.value)} autoCapitalize="none" autoCorrect="off"/></label>
 <button disabled={busy||!key} onClick={()=>{const value=key;setKey('');void action(()=>invoke('tunnel_save_key',{key:value}))}}>SAVE TUNNEL KEY</button>
 <button disabled={busy||state.active||!tunnelId||!organizationId} onClick={()=>action(()=>invoke('tunnel_start',{config:{tunnelId:tunnelId.trim(),organizationId:organizationId.trim(),vaultPath}}))}>START BUSINESS TUNNEL</button>
 <button disabled={busy||!state.active} onClick={()=>action(()=>invoke('tunnel_stop'))}>STOP BUSINESS TUNNEL</button>
 <p role="status">{state.active?(state.ready?'Local tunnel ready — verify connection in ChatGPT Business':'Starting tunnel'): 'Tunnel stopped'}{state.error?` · ${state.error}`:''}</p><p>Stopping prevents new local reads. Disconnect the plugin in ChatGPT to revoke its remote connection too. No automatic start at login.</p>{message&&<p role="alert">{message}</p>}
 </section>
}
