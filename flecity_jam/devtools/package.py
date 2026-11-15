"""Build a clean, hash-checked test resource ZIP. Does not deploy or touch a server."""
import hashlib, json, pathlib, zipfile
root=pathlib.Path(__file__).resolve().parents[1]
out=root.parent/'.flecity-dev'/'jam'/'dist'; out.mkdir(parents=True,exist_ok=True)
entries=[]
for folder in ['client','server','web','docs','licenses']:
    entries.extend(p for p in (root/folder).rglob('*') if p.is_file())
entries.extend(root/p for p in ['fxmanifest.lua','config.lua','README.md'])
entries.sort(key=lambda p:p.relative_to(root).as_posix())
files={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in entries}
runtime={p:h for p,h in files.items() if not p.startswith(('docs/','licenses/')) and p!='README.md'}
runtime_hash=hashlib.sha256(json.dumps(runtime,sort_keys=True,separators=(',',':')).encode()).hexdigest()
manifest=json.dumps(dict(version='0.1.0-test',releaseReady=False,liveFiveM='NOT_RUN',runtimeSha256=runtime_hash,files=files),ensure_ascii=False,indent=2)+'\n'
artifact=out/'Flecity_JAM_0.1.0_test.zip'
with zipfile.ZipFile(artifact,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for p in entries:archive.write(p,'flecity_jam/'+p.relative_to(root).as_posix())
    archive.writestr('flecity_jam/MANIFEST.json',manifest)
with zipfile.ZipFile(artifact) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist())==len(entries)+1
    for name,digest in files.items():
        assert hashlib.sha256(archive.read('flecity_jam/'+name)).hexdigest()==digest,name
    assert not any('/tests/' in p or '/devtools/' in p or '/.git/' in p or '..' in pathlib.PurePosixPath(p).parts for p in archive.namelist())
sha=hashlib.sha256(artifact.read_bytes()).hexdigest()
(out/'SHA256SUMS.txt').write_text(f'{sha}  {artifact.name}\n','utf-8')
record=dict(file=str(artifact),bytes=artifact.stat().st_size,sha256=sha,files=len(entries)+1,runtimeSha256=runtime_hash,status='PASS',releaseReady=False)
(out/'package-result.json').write_text(json.dumps(record,indent=2)+'\n','utf-8')
print(json.dumps(record))
