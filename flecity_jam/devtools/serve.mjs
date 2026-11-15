import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../web/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.ogg':'audio/ogg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
  try {
    const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
    const file=path.resolve(root,relative);if(!file.startsWith(root)||!fs.statSync(file).isFile())throw Error('Not found');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(17840,'127.0.0.1',()=>console.log('JAM preview: http://127.0.0.1:17840 (local only; no FiveM/DB)'));
