"""Emit only this new resource for the authorized GitHub branch save."""
import argparse, base64, hashlib, json, pathlib
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--list',action='store_true');p.add_argument('--texts',action='store_true');p.add_argument('--file');args=p.parse_args()
if args.list or args.texts:
    out=[]
    for f in sorted(root.rglob('*')):
        if not f.is_file() or '__pycache__' in f.parts:continue
        data=f.read_bytes();record=dict(path='flecity_jam/'+f.relative_to(root).as_posix(),bytes=len(data),sha=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest())
        if args.texts:
            if f.suffix in ['.ogg','.wav']:continue
            record['content']=data.decode('utf-8')
        out.append(record)
    print(json.dumps(out))
else:
    relative=pathlib.PurePosixPath(args.file)
    if relative.parts[0]!='flecity_jam' or '..' in relative.parts:raise ValueError('Outside resource')
    f=root.joinpath(*relative.parts[1:]).resolve()
    if not f.is_relative_to(root):raise ValueError('Outside resource')
    data=f.read_bytes()
    print(json.dumps(dict(content=base64.b64encode(data).decode(),encoding='base64',sha=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest())))
