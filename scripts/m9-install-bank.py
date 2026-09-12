#!/usr/bin/env python3
"""Exercise manual staged installation/recovery on a bounded disposable disk image."""
import pathlib,tempfile,subprocess,json,hashlib,os,shutil,time,signal
R=pathlib.Path(__file__).resolve().parent.parent
E=R/'IMPLEMENTATION/M9_EVIDENCE';B=pathlib.Path(tempfile.mkdtemp(prefix='limen-m9-install-')).resolve()
APP=R/'apps/desktop/src-tauri/target/release/bundle/macos/LIMEN Vault.app'
report={'bank':str(B),'checks':[]}
def call(args,check=True):
 p=subprocess.run(list(map(str,args)),capture_output=True,text=True,timeout=90)
 if check and p.returncode:raise RuntimeError(p.stderr[:1000])
 return p
def inventory(p):return {str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file() and not f.is_symlink()}
volume=B/'Volume';volume.mkdir();image=B/'disk.sparseimage'
call(['hdiutil','create','-size','384m','-fs','APFS','-type','SPARSE','-volname','LIMEN Update QA',image]);call(['hdiutil','attach','-nobrowse','-mountpoint',volume,image]);mounted=True
try:
 installed=volume/'Applications/LIMEN Vault.app';installed.parent.mkdir();call(['ditto',APP,installed]);original=inventory(installed)
 vault=B/'Vault';shutil.copytree(R/'vault-template',vault);(vault/'20_RAW_SOURCES/keep.txt').write_text('Preserve external Vault');data=inventory(vault)
 assert inventory(installed)==inventory(APP);call(['codesign','--verify','--deep','--strict',installed]);report['checks'].append('PASS clean directory installation: exact signed bundle inventory, external Vault retained')
 # Real ENOSPC inside a 384 MiB image only; never fill the host filesystem.
 capacity=os.statvfs(volume);assert capacity.f_blocks*capacity.f_frsize<1024**3
 filler=volume/'space-pressure';chunk=b'x'*(1024*1024)
 with filler.open('wb') as f:
  while os.statvfs(volume).f_bavail*os.statvfs(volume).f_frsize>12*1024*1024:f.write(chunk);f.flush()
 partial=volume/'update-incomplete.app';failed=call(['ditto',APP,partial],check=False);assert failed.returncode!=0;assert 'space' in failed.stderr.lower(),failed.stderr
 assert inventory(installed)==original and inventory(vault)==data
 (B/'enospc.txt').write_text(failed.stderr);report['checks'].append('PASS actual ENOSPC: old app and external Vault unchanged; incomplete copy never replaces installed app')
 filler.unlink();shutil.rmtree(partial)
 # Kill a real staged copy after its first files appear. The installed app stays untouched.
 interrupted=volume/'interrupted.app';process=subprocess.Popen(['ditto',str(APP),str(interrupted)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 deadline=time.monotonic()+5
 while time.monotonic()<deadline and process.poll() is None:
  if interrupted.exists() and any(p.is_file() for p in interrupted.rglob('*')):process.kill();break
  time.sleep(.001)
 process.wait();assert process.returncode==-signal.SIGKILL,'Copy finished before interruption; do not claim interruption'
 assert inventory(installed)==original and inventory(vault)==data;report['checks'].append('PASS actual SIGKILL during staged copy: previous app and Vault preserved')
 shutil.rmtree(interrupted)
 candidate=volume/'New LIMEN Vault.app';call(['ditto',APP,candidate]);call(['codesign','--verify','--deep','--strict',candidate]);backup=volume/'Previous LIMEN Vault.app';installed.rename(backup);candidate.rename(installed)
 assert inventory(installed)==original and inventory(backup)==original and inventory(vault)==data
 # Restore previous compatible package by explicit rename, no data migration.
 restored=volume/'Restored candidate.app';installed.rename(restored);backup.rename(installed);assert inventory(installed)==original
 report['checks'].append('PASS staged replacement and compatible rollback preserve exact data; same-version package rehearsal, no migration inferred')
 shutil.rmtree(installed);assert inventory(vault)==data;report['checks'].append('PASS removing only the test app preserves external Vault')
 report['status']='PASS'
except Exception as ex:
 report['status']='FAIL';report['error']=str(ex)
finally:
 call(['hdiutil','detach',volume]);report['host']='macOS '+call(['sw_vers','-productVersion']).stdout.strip();(E/'install-bank.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2));raise SystemExit(0 if report['status']=='PASS' else 1)
