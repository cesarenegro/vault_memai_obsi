import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {sha,canonical} from '../services/vault-sync-api/worker.mjs';
const connection=JSON.parse(fs.readFileSync('.local/m10-private/connection.json','utf8'));
const call=(path,method='GET',body,token=connection.token)=>fetch(connection.endpoint+'/v1/'+path,{method,body,headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
const results=[];
const check=(name,ok)=>{results.push({name,pass:ok});assert.ok(ok,name);};
try {
 const scope=await(await call('status')).json();
 if(!scope.tenantId?.startsWith('m10-e2e-'))throw Error('Only isolated test grants permitted');
 check('anonymous denied',(await fetch(connection.endpoint+'/v1/status')).status===401);
 check('invalid grant denied',(await call('status','GET',undefined,'invalid')).status===403);
 const current=await(await call('published/current')).json();
 const content='Synthetic M10 gateway acceptance fixture. No customer data.';
 const h=await sha(content);
 const m={schemaVersion:1,formatVersion:1,tenantId:scope.tenantId,vaultId:scope.vaultId,channel:'published',releaseId:'e2e-'+crypto.randomUUID(),parentReleaseId:current?.releaseId??null,deviceId:'http-acceptance',createdAt:new Date().toISOString(),documents:[{id:'fixture',relativePath:'01_CLIENTS/http-fixture.md',title:'Synthetic fixture',category:'01_CLIENTS',status:'approved',sizeBytes:Buffer.byteLength(content),sha256:h,objectRef:h}]};
 m.manifestHash=await sha(canonical(m));
 check('cross-channel commit denied',(await call('private/commit','POST',JSON.stringify(m))).status===400);
 check('corrupt object denied',(await call('published/object/'+h,'PUT','corrupt')).status===400);
 check('upload',(await call('published/object/'+h,'PUT',content)).status===200);
 check('commit',(await call('published/commit','POST',JSON.stringify(m))).status===200);
 check('idempotent commit',(await call('published/commit','POST',JSON.stringify(m))).status===200);
 check('download matches',await(await call('published/release/'+m.releaseId+'/'+h)).text()===content);
 const versions=await(await call('published/releases')).json();
 check('history includes committed version',versions[0]?.releaseId===m.releaseId);
 const next=async()=>{const n={...m,releaseId:'e2e-'+crypto.randomUUID(),parentReleaseId:m.releaseId};delete n.manifestHash;n.manifestHash=await sha(canonical(n));return n;};
 const candidates=await Promise.all([next(),next()]);
 const responses=await Promise.all(candidates.map(n=>call('published/commit','POST',JSON.stringify(n))));
 check('concurrent writers: one winner',responses.map(r=>r.status).sort().join(',')==='200,409');
 check('old published release denied',(await call('published/release/'+m.releaseId)).status===409);
 check('revoke',(await call('published/revoke','POST')).status===200);
 check('read after revoke denied',(await call('published/release/'+m.releaseId)).status===403);
 const winner=candidates[responses.findIndex(r=>r.status===200)];
 check('revoked replay denied',(await call('published/commit','POST',JSON.stringify(winner))).status===409);
} catch(e) {results.push({name:'failure',pass:false,error:e.message});process.exitCode=1;}
finally {const report={date:new Date().toISOString(),endpoint:connection.endpoint,scope:'HTTPS deployed Worker and real R2, isolated synthetic grant',results};fs.writeFileSync('IMPLEMENTATION/M10_EVIDENCE/worker-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
