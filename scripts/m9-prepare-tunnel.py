#!/usr/bin/env python3
"""Restore pinned official auxiliaries. Never downloads or executes at app startup."""
import hashlib, json, pathlib, sys, urllib.request, zipfile, io
ROOT=pathlib.Path(__file__).resolve().parent.parent
VERSION='v0.0.14'
ARCHIVE='tunnel-client-v0.0.14-darwin-arm64.zip'
SHA256='b540493c5bdbcdbb755700c8e2e16597e28b1569e425007e0f73111047bd6a64'
URL=f'https://github.com/openai/tunnel-client/releases/download/{VERSION}/{ARCHIVE}'
blob=pathlib.Path(sys.argv[1]).read_bytes() if len(sys.argv)>1 else urllib.request.urlopen(URL,timeout=60).read()
if hashlib.sha256(blob).hexdigest()!=SHA256: raise SystemExit('Archive checksum mismatch; nothing installed')
dest=ROOT/'apps/desktop/src-tauri/resources/mcp';dest.mkdir(parents=True,exist_ok=True)
names=['tunnel-client','cloudflared','cloudflared-manifest.json','LICENSE','NOTICE',f'tunnel-client-{VERSION}-darwin-arm64-licenses.txt',f'tunnel-client-{VERSION}-darwin-arm64.spdx.json']
with zipfile.ZipFile(io.BytesIO(blob)) as archive:
    assert sorted(archive.namelist())==sorted(names),'Unexpected archive contents'
    inventory={}
    for name in names:
        body=archive.read(name);out=dest/name
        assert not out.is_symlink(),'Resource symlink rejected'
        out.write_bytes(body);out.chmod(0o755 if name in names[:2] else 0o644)
        inventory[name]=hashlib.sha256(body).hexdigest()
(dest/'upstream-manifest.json').write_text(json.dumps({'version':VERSION,'url':URL,'archive_sha256':SHA256,'unsigned_files':inventory,'packaging_change':'Mach-O binaries are re-signed with the application Developer ID; final hashes are recorded in release evidence.'},indent=2)+'\n')
print('PASS pinned official archive and bundled license inventory')
