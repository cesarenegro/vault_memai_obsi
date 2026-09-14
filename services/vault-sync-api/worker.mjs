// Optional authenticated gateway. R2 credentials never reach a client.
export const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export async function sha(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?new TextEncoder().encode(bytes):bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,150}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const categories=['01_CLIENTS','02_PROJECTS','03_BRANDS','04_POSITIONING','05_PACKAGING_KNOWLEDGE','06_METHODS','07_CASE_STUDIES','08_MARKET_RESEARCH','09_COMPETITORS','10_APPROVED_OUTPUTS'];
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function body(request,max){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('LIMIT');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
export async function validate(m,grant){
 if(m?.schemaVersion!==1||m.formatVersion!==1||m.tenantId!==grant.tenantId||m.vaultId!==grant.vaultId||!grant.channels.includes(m.channel)||!id(m.releaseId)||!id(m.deviceId)||!Array.isArray(m.documents)||m.documents.length>1000)throw Error('MANIFEST');
 const paths=new Set();let total=0;
 for(const d of m.documents){if(!digest(d.sha256)||d.objectRef!==d.sha256||!Number.isSafeInteger(d.sizeBytes)||d.sizeBytes<0||d.sizeBytes>8*1024*1024||typeof d.relativePath!=='string'||d.relativePath.length>1024||d.relativePath.includes('\\')||d.relativePath.includes('\0'))throw Error('MANIFEST');const parts=d.relativePath.split('/');if(parts.length>32||parts.some(p=>!p||p==='..'||p.startsWith('.'))||['LOCK','M7_PENDING.json','SYNC_PROFILE.json'].includes(parts.at(-1)))throw Error('PATH');const key=d.relativePath.normalize('NFC').toLowerCase();if(paths.has(key))throw Error('COLLISION');paths.add(key);total+=d.sizeBytes;if(m.channel==='published'&&(!categories.includes(parts[0])||d.status!=='approved'||!d.relativePath.endsWith('.md')))throw Error('NOT_APPROVED');}
 if(total>256*1024*1024)throw Error('LIMIT');
 const {manifestHash,...payload}=m;payload.parentReleaseId??=null;payload.documents=[...m.documents].sort((a,b)=>a.relativePath<b.relativePath?-1:a.relativePath>b.relativePath?1:0);
 if(await sha(canonical(payload))!==manifestHash)throw Error('HASH');
}
export default {async fetch(request,env){
 try{
 const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];if(!token)return json({error:'AUTH_REQUIRED'},401);
 const grants=JSON.parse(env.ACCESS_GRANTS||'[]');const hash=await sha(token);const grant=grants.find(g=>g.tokenHash===hash&&!g.revoked&&Date.parse(g.expiresAt)>Date.now());if(!grant||!id(grant.tenantId)||!id(grant.vaultId))return json({error:'FORBIDDEN'},403);
 const url=new URL(request.url);const parts=url.pathname.split('/').filter(Boolean);if(parts[0]!=='v1')return json({error:'NOT_FOUND'},404);
 if(parts.length===2&&parts[1]==='status')return json({status:'READY',bucket:'m3mai-core-vault',tenantId:grant.tenantId,vaultId:grant.vaultId,channels:grant.channels});
 const channel=parts[1];if(!['private','published'].includes(channel)||!grant.channels.includes(channel))return json({error:'FORBIDDEN'},403);
 const prefix=`limen/${grant.tenantId}/${grant.vaultId}/${channel}`;const key=prefix+'/current.json';
 if(parts[2]==='current'&&request.method==='GET'){const current=await env.VAULT.get(key);return current?json(await current.json()):json(null);}
 if(parts[2]==='releases'&&parts.length===3&&request.method==='GET'){
  const obj=await env.VAULT.get(key);const current=obj?await obj.json():null;if(!current||current.revoked)return json([]);
  const releases=[];const seen=new Set();let release=current.releaseId;
  while(release&&releases.length<100){if(!id(release)||seen.has(release))throw Error('RELEASE_CHAIN');seen.add(release);const stored=await env.VAULT.get(prefix+'/releases/'+release+'/manifest.json');if(!stored)throw Error('RELEASE_CHAIN');const m=await stored.json();await validate(m,grant);releases.push({releaseId:m.releaseId,createdAt:m.createdAt,manifestHash:m.manifestHash,documentCount:m.documents.length});release=m.parentReleaseId;}
  return json(releases);
 }
 if(parts[2]==='object'&&parts.length===4&&digest(parts[3])&&request.method==='PUT'){
  if(!grant.write)return json({error:'FORBIDDEN'},403);const bytes=await body(request,8*1024*1024);if(await sha(bytes)!==parts[3])throw Error('HASH');
  await env.VAULT.put(prefix+'/objects/'+parts[3],bytes,{onlyIf:new Headers({'If-None-Match':'*'}),sha256:parts[3]});return json({status:'STORED'});
 }
 if(parts[2]==='commit'&&request.method==='POST'){
  if(!grant.write)return json({error:'FORBIDDEN'},403);const m=JSON.parse(new TextDecoder().decode(await body(request,2*1024*1024)));await validate(m,grant);if(m.channel!==channel)throw Error('CHANNEL');
  const before=await env.VAULT.get(key);const current=before?await before.json():null;
  if(current?.releaseId===m.releaseId&&current.revoked)return json({error:'REVOKED_RELEASE'},409);
  if(current?.releaseId===m.releaseId&&current.manifestHash===m.manifestHash)return json({status:'COMMITTED',releaseId:m.releaseId,manifestHash:m.manifestHash});
  if((current?.releaseId??null)!==(m.parentReleaseId??null))return json({error:'CONFLICT'},409);
  for(const doc of m.documents){const object=await env.VAULT.get(prefix+'/objects/'+doc.sha256);if(!object||object.size!==doc.sizeBytes||await sha(await object.arrayBuffer())!==doc.sha256)throw Error('OBJECT_INTEGRITY');}
  const manifestKey=prefix+'/releases/'+m.releaseId+'/manifest.json';const text=JSON.stringify(m);const stored=await env.VAULT.put(manifestKey,text,{onlyIf:new Headers({'If-None-Match':'*'})});if(!stored){const existing=await env.VAULT.get(manifestKey);if(!existing||canonical(await existing.json())!==canonical(m))return json({error:'CONFLICT'},409);}
  const pointer={releaseId:m.releaseId,manifestHash:m.manifestHash,committedAt:new Date().toISOString()};
  const committed=await env.VAULT.put(key,JSON.stringify(pointer),{onlyIf:before?{etagMatches:before.etag}:new Headers({'If-None-Match':'*'})});return committed?json({status:'COMMITTED',...pointer}):json({error:'CONFLICT'},409);
 }
 if(parts[2]==='release'&&id(parts[3])&&request.method==='GET'){
  const active=await env.VAULT.get(key);const current=active?await active.json():null;if(!current||current.revoked)return json({error:'REVOKED'},403);
  const stored=await env.VAULT.get(prefix+'/releases/'+parts[3]+'/manifest.json');if(!stored)return json({error:'NOT_FOUND'},404);const m=await stored.json();await validate(m,grant);
  // Published consumers may only read the active release; revoked or replaced releases fail closed.
  if(channel==='published'&&current.releaseId!==m.releaseId)return json({error:'RELEASE_CHANGED'},409);
  if(parts.length===4)return json(m);
  if(parts.length===5&&digest(parts[4])&&m.documents.some(d=>d.sha256===parts[4])){const obj=await env.VAULT.get(prefix+'/objects/'+parts[4]);if(!obj)return json({error:'NOT_FOUND'},404);return new Response(obj.body,{headers:{'Cache-Control':'no-store','Content-Type':'application/octet-stream'}});}
 }
 if(parts[2]==='revoke'&&request.method==='POST'&&grant.write){const before=await env.VAULT.get(key);if(!before)return json({status:'REVOKED'});const next={...await before.json(),revoked:true};const saved=await env.VAULT.put(key,JSON.stringify(next),{onlyIf:{etagMatches:before.etag}});return saved?json({status:'REVOKED'}):json({error:'CONFLICT'},409);}
 return json({error:'NOT_FOUND'},404);
 }catch(e){const invalid=e instanceof SyntaxError||['LIMIT','MANIFEST','PATH','COLLISION','NOT_APPROVED','HASH','CHANNEL','OBJECT_INTEGRITY','RELEASE_CHAIN'].includes(e?.message);return json({error:invalid?'INVALID_REQUEST':'STORAGE_UNAVAILABLE'},invalid?400:503);}
}};
