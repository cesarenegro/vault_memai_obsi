import json, sys, time, urllib.request
port, n = int(sys.argv[1]), int(sys.argv[2])
idx = json.load(open("/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/tests/scratch/vault_collaudo_ricalcolo_cache/00_SYSTEM/SEARCH_INDEX.json"))
texts = []
for d in idx["documents"].values():
    for p in d.get("passages", []):
        t = p.get("text", "")
        if len(t) > 800:
            texts.append(t)
        if len(texts) >= n: break
    if len(texts) >= n: break
body = json.dumps({"input": texts}).encode()
req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/embeddings", data=body, headers={"Content-Type": "application/json"})
t0 = time.time()
resp = json.load(urllib.request.urlopen(req, timeout=900))
dt = time.time() - t0
dims = len(resp["data"][0]["embedding"])
print(f"porta {port}: {len(texts)} passaggi (media {sum(map(len,texts))//len(texts)} caratteri) in {dt:.1f} s = {dt/len(texts):.2f} s/passaggio, dim {dims}")
