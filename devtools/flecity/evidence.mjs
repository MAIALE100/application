import fs from 'node:fs';
import path from 'node:path';
import { inside,noLinks,state,repo,local,readJSON,json,redact } from './core.mjs';
import { approvedServer } from './deployment.mjs';
export function logFile(){
  const server=local().server;
  if(server?.type!=='test'||path.resolve(server.root)!==path.resolve(approvedServer))throw Error('Only test-server logs permitted');
  const file=inside(server.root,server.logFile);noLinks(file);return file;
}
export function bookmark(){
  try{const file=logFile(),s=fs.statSync(file);return {file,size:s.size,birthtime:s.birthtimeMs};}
  catch{return null;}
}
export function collect(config,runId){
  if(!/^[0-9TZ-]+-[a-f0-9]{6}$/.test(runId))throw Error('Invalid run ID');
  const runDir=path.join(state,'projects',config.id,'runs',runId),run=readJSON(path.join(runDir,'result.json'));
  const file=logFile(),s=fs.statSync(file);
  if(!run.logStart||run.logStart.file!==file)throw Error('Run has no matching start bookmark; historical logs cannot prove test success');
  if(s.birthtimeMs!==run.logStart.birthtime||s.size<run.logStart.size)throw Error('Log rotated; explicit rotated-log review required');
  const size=s.size-run.logStart.size;if(size>8*1024*1024)throw Error('Log delta too large; review rotation manually');
  const fd=fs.openSync(file,'r'),buf=Buffer.alloc(size);
  try{fs.readSync(fd,buf,0,size,run.logStart.size);}finally{fs.closeSync(fd);}
  const lines=buf.toString('utf8').replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)
    .filter(line=>(config.logTags||[]).some(tag=>line.includes(tag)));
  noLinks(runDir);fs.writeFileSync(path.join(runDir,'logs','server-resource.txt'),redact(lines.join('\n')));
  json(path.join(runDir,'logs','server-resource.meta.json'),{file,start:run.logStart.size,end:s.size,collected:new Date().toISOString(),lines:lines.length,proofOfSuccess:false});
  console.log(lines.length+' resource log lines saved; test result unchanged');
}
export function attach(config,file,kind='note'){
  if(!['screenshot','note'].includes(kind))throw Error('Expected screenshot or note');
  noLinks(file);if(!fs.statSync(file).isFile())throw Error('Expected file');
  const ext=path.extname(file).toLowerCase(),bytes=fs.readFileSync(file);
  if(bytes.length>25*1024*1024)throw Error('Evidence exceeds 25 MB');
  if(kind==='screenshot'&&!['.png','.jpg','.jpeg','.webp'].includes(ext))throw Error('Expected image extension');
  if(kind==='note'&&!['.txt','.md','.json'].includes(ext))throw Error('Expected text evidence');
  const run=readJSON(path.join(state,'projects',config.id,'latest.json')),folder=path.join(run.dir,kind==='screenshot'?'screenshots':'logs');
  inside(state,path.relative(state,folder));noLinks(folder);
  const dest=path.join(folder,Date.now()+'-'+kind+ext);
  fs.writeFileSync(dest,kind==='note'?redact(bytes.toString('utf8')):bytes,{flag:'wx'});
  console.log('Attached manual evidence: '+path.relative(repo,dest)+' (does not change test status)');
}
