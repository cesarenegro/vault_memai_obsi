#!/usr/bin/env python3
"""Native M8 evidence bank. No simulated PASS and no deletion of evidence."""
import hashlib, json, os, pathlib, shutil, socket, subprocess, sys, tempfile, threading, signal, secrets
from http.server import HTTPServer, BaseHTTPRequestHandler
R = pathlib.Path(__file__).resolve().parent.parent
E = R / 'IMPLEMENTATION/M8_EVIDENCE'
E.mkdir(parents=True, exist_ok=True)
B = pathlib.Path(tempfile.mkdtemp(prefix='limen-m8-real-')).resolve()
results = []
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def inventory(v): return {str(p.relative_to(v)):sha(p) for p in sorted(v.rglob('*')) if p.is_file() and not p.is_symlink()}
def record(name, fn):
    try:
        detail=fn(); results.append({'criterion':name,'status':'PASS','detail':detail}); print('PASS '+name,flush=True)
    except Exception as ex:
        results.append({'criterion':name,'status':'FAIL','detail':str(ex)});print('FAIL '+name+': '+str(ex),flush=True)
appsrc=R/'apps/desktop/src-tauri/target/release/bundle/macos/LIMEN Vault.app'
checker=pathlib.Path(os.environ.get('LIMEN_VAULT_CHECK',str(R/'apps/desktop/src-tauri/target/release/vault-check')))
if not appsrc.exists() or not checker.exists():
    print('Missing compiled native artifacts; run scripts/m8-fallback-check.sh without --bank-only');sys.exit(2)
shutil.copytree(appsrc,B/'LIMEN Vault.app',symlinks=True)
shutil.copy2(checker,B/'vault-check')
app=B/'LIMEN Vault.app/Contents/MacOS/limen-vault'
template=B/'LIMEN Vault.app/Contents/Resources/vault-template'
assert app.is_file() and template.is_dir(), 'Bundle/template missing'
policy=B/'runtime.sb'
policy.write_text('(version 1)\n(allow default)\n(deny network*)\n(deny file-read* (subpath '+json.dumps(str(R))+'))\n')
env={'PATH':'/usr/bin:/bin','HOME':str(B),'TMPDIR':str(B),'LANG':'en_US.UTF-8'}
logs=[]
def run(args, expect=0):
    p=subprocess.run(['/usr/bin/sandbox-exec','-f',str(policy),*map(str,args)],cwd=B,env=env,capture_output=True,text=True,timeout=25)
    logs.append({'args':list(map(str,args)),'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
    if expect is not None: assert p.returncode==expect, f'{args[0]} exit={p.returncode}: {p.stderr[:300]}'
    return p
v=B/'Vault Unicode àèé'
def call(cmd,*args,expect=0):
    p=run([B/'vault-check',cmd,v,*args],expect)
    return json.loads(p.stdout) if p.returncode==0 else p
class Handler(BaseHTTPRequestHandler):
    def do_GET(self): self.send_response(200);self.end_headers();self.wfile.write(b'probe')
    def log_message(self,*args):pass
server=HTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
def isolation():
    url=f'http://127.0.0.1:{server.server_port}'
    assert subprocess.run(['/usr/bin/curl','-fsS',url],capture_output=True,timeout=5).returncode==0
    assert run(['/usr/bin/curl','--max-time','3',url],None).returncode!=0
    assert run(['/bin/cat',R/'package.json'],None).returncode!=0
    assert run(['/bin/sh','-c','command -v node'],None).returncode!=0
    return 'Loopback HTTP works outside sandbox and is denied inside; checkout read and Node lookup denied.'
record('Isolation enforced',isolation);server.shutdown()
def local():
    created=call('create',template);assert created['state']=='READY'; assert call('open')['validation']['is_valid']
    (v/'20_RAW_SOURCES/source.txt').write_text('Aurora local compilation test àèé.')
    note=v/'01_CLIENTS/approved.md';note.write_text('---\nschema_version: 1\nid: m8-approved\ntitle: Aurora\ntype: client\nclient: Acme\nproject: Aurora\nstatus: approved\ncreated_at: "2026-09-12T00:00:00Z"\nupdated_at: "2026-09-12T00:00:00Z"\ntags: [offline]\nsource_ids: []\n---\nAurora local offline verification.\n')
    raw=sha(v/'20_RAW_SOURCES/source.txt')
    assert len(call('knowledge','01_CLIENTS'))==1
    assert call('compile','20_RAW_SOURCES/source.txt')['status']=='compiled'
    assert sha(v/'20_RAW_SOURCES/source.txt')==raw
    call('search-index');found=call('search',json.dumps({'term':'Aurora'}));assert found
    snap=call('snapshot','M8 offline snapshot');assert call('snapshot-verify',snap['id'])['is_integrity_valid']
    (B/'snapshot.json').write_text(json.dumps(snap));return 'Actual native create/open, RAW compilation, search/index and snapshot verification; no cloud.'
record('S1 native local operations offline',local)
def restart():
    before=inventory(v);assert call('open');assert call('sources');assert call('proposals');assert call('snapshots');assert call('search',json.dumps({'term':'Aurora'}));assert inventory(v)==before
    return 'Each call starts a new native process; persistent records recovered; complete inventory unchanged.'
record('S3 native persistence and read-only inventory',restart)
def corrupt():
    p=v/'00_SYSTEM/SEARCH_INDEX.json';original=p.read_bytes();p.write_text('{bad')
    try:
        assert call('search',json.dumps({'term':'Aurora'}),expect=None).returncode!=0
        assert p.read_text()=='{bad'
    finally:p.write_bytes(original)
    p.unlink();call('search-index');assert call('search',json.dumps({'term':'Aurora'}))
    return 'Corrupt index fails and is preserved; absent index explicitly rebuilt.'
record('S6 corrupt and missing index',corrupt)
def paths():
    outside=B/'outside.txt';outside.write_text('Outside vault must never be compiled')
    link=v/'20_RAW_SOURCES/link.txt';link.symlink_to(outside)
    try:assert call('compile','20_RAW_SOURCES/link.txt')['status']=='error'
    finally:link.unlink()
    assert call('compile','20_RAW_SOURCES/../00_SYSTEM/HOME.md')['status']=='error'
    note=v/'01_CLIENTS/approved.md';note.chmod(0)
    try:assert call('search',json.dumps({'term':'Aurora'}),expect=None).returncode!=0
    finally:note.chmod(0o600)
    snap=json.loads((B/'snapshot.json').read_text());target=pathlib.Path(snap['snapshot_path'])/'01_CLIENTS/approved.md';target.write_text('tamper')
    assert not call('snapshot-verify',snap['id'])['is_integrity_valid']
    return 'RAW symlink/traversal rejected, unreadable source rejected, altered snapshot detected.'
record('S7 confinement, permission and snapshot corruption',paths)
def staging():
    lock=v/'00_SYSTEM/.compiler-lock';lock.mkdir()
    try:assert call('compile','20_RAW_SOURCES/source.txt')['status']=='error';assert lock.is_dir()
    finally:lock.rmdir()
    pending=v/'00_SYSTEM/SNAPSHOTS/.pending-m8';pending.mkdir(parents=True);(pending/'partial').write_text('incomplete')
    assert all(x['id']!='.pending-m8' for x in call('snapshots'));assert (pending/'partial').read_text()=='incomplete'
    return 'Pre-existing interrupted state is preserved and unpublished; actual kill-during-write NOT tested here.'
record('S8 partial: existing lock/staging',staging)
def mcp():
    call('search-index');before=inventory(v)
    requests=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'m8-bank','version':'1'}}},{'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'list_vaults','arguments':{}}}]
    p=subprocess.run(['/usr/bin/sandbox-exec','-f',str(policy),str(app),'--mcp-stdio',str(v)],input=''.join(json.dumps(q)+'\n' for q in requests),cwd=B,env=env,text=True,capture_output=True,timeout=15)
    assert p.returncode==0,p.stderr
    responses=[json.loads(l) for l in p.stdout.splitlines()];assert len(responses)==3
    tools=responses[1]['result']['tools'];assert {t['name'] for t in tools}=={'list_vaults','search_vault','read_document'}
    assert 'error' not in responses[2];assert inventory(v)==before
    (B/'mcp-responses.json').write_text(json.dumps(responses,indent=2));return 'Copied release app stdio works without network or checkout; read-only tool surface. GUI not inferred from CLI.'
record('Release bundle MCP offline',mcp)
def m7_workflow():
    raw=sha(v/'20_RAW_SOURCES/source.txt')
    def request(q): return call('m7',json.dumps(q))
    created=request({'action':'create','operationId':secrets.token_hex(32),'title':'M8 human review','category':'client','content':'Aurora offline review'})
    item=next(i for i in created['items'] if i['title']=='M8 human review');revision=item['revisions'][-1]
    approved=request({'action':'approve','operationId':secrets.token_hex(32),'id':item['id'],'revision':1,'expectedSha256':revision['sha256'],'targetPath':'01_CLIENTS/m8-reviewed.md'})
    assert next(i for i in approved['items'] if i['id']==item['id'])['workflowStatus']=='approved'
    assert sha(v/'20_RAW_SOURCES/source.txt')==raw
    for stage in ['journal','document','index']:
        operation={'action':'create','operationId':secrets.token_hex(32),'title':'Killed '+stage,'category':'client','content':'Recover exact bytes'}
        killed=subprocess.run(['/usr/bin/sandbox-exec','-f',str(policy),str(B/'vault-check'),'m7-interrupt',str(v),json.dumps(operation)],env={**env,'LIMEN_TEST_KILL_STAGE':stage},cwd=B,text=True,capture_output=True,timeout=25)
        logs.append({'stage':stage,'exit':killed.returncode,'stdout':killed.stdout,'stderr':killed.stderr})
        assert killed.returncode==-signal.SIGKILL
        recovered=request({'action':'recover'});assert request(operation)==recovered
        matches=[i for i in recovered['items'] if i['id']==operation['operationId']];assert len(matches)==1
        assert sha(v/matches[0]['revisions'][0]['relativePath'])==matches[0]['revisions'][0]['sha256']
    call('search-index');assert call('search',json.dumps({'term':'Aurora','status':'approved'}))
    return 'Native approval offline, RAW preserved, actual SIGKILL at journal/document/index, explicit recovery/idempotence, re-index and approved search.'
record('S2/S8 native M7 approval and actual interrupted writes',m7_workflow)
# These are mandatory and may not be inferred from unit tests or CLI operations.
for name,why in [
 ('S1 GUI offline','Native operations passed separately; GUI full flow not executed by this bank.'),
 ('S2 M7 desktop review/approval','Native M7 and UI implemented; desktop acceptance requires direct observation.'),
 ('S4 interrupted provider / responsive GUI','Requires GUI operation and cancellation while network/service unavailable.'),
 ('S5 external client unavailable','M6 evidence is baseline; no integrated M8 client scenario executed here.'),
 ('Obsidian integrated acceptance','Requires actual Obsidian opening of this Vault; not tested here.')]:
    results.append({'criterion':name,'status':'NOT_VERIFIED','detail':why})
report={'bank':str(B),'platform':os.uname().sysname+' '+os.uname().machine,'app_sha256':sha(app),'harness_sha256':sha(B/'vault-check'),'bundle_inventory':inventory(B/'LIMEN Vault.app'),'policy':policy.read_text(),'results':results,'commands':logs,'acceptance':'FAIL' if any(x['status']=='FAIL' for x in results) else 'INCOMPLETE'}
(E/'native-bank.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');(B/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print('M8 '+report['acceptance']+'; evidence retained at '+str(B),flush=True)
sys.exit(1 if report['acceptance']=='FAIL' else 2)
