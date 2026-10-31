import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const state=path.join(repo,'.flecity-dev');
export const tool=path.dirname(fileURLToPath(import.meta.url));
export function identifier(value) {
  if(typeof value!=='string'||!/^[a-z][a-z0-9_-]{0,62}$/.test(value)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value)) throw Error('Invalid identifier');
  return value;
}
export function inside(root,relative) {
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||/^[a-z]:/i.test(relative)) throw Error('Expected relative path');
  const result=path.resolve(root,relative), rel=path.relative(path.resolve(root),result);
  if(!rel||rel.startsWith('..')||path.isAbsolute(rel)) throw Error('Path escapes root or targets root');
  return result;
}
export function noLinks(target) {
  let cursor=path.resolve(target);
  while(true) {
    try{if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Symlink/junction refused: '+cursor);}
    catch(e){if(e.code!=='ENOENT')throw e;}
    const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;
  }
}
export function files(root,exclude=['.git','.flecity-dev']) {
  noLinks(root);
  const output=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})) {
    const full=path.join(root,entry.name);
    if(entry.isSymbolicLink()) throw Error('Symlink/junction refused: '+full);
    if(exclude.includes(entry.name))continue;
    if(entry.isDirectory())output.push(...files(full,exclude));
    else if(entry.isFile())output.push(full);
    else throw Error('Special file refused');
  }
  return output.sort();
}
export const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const inventory=(root,includeAll=false)=>Object.fromEntries(files(root,includeAll?[]:undefined).map(f=>[path.relative(root,f).split(path.sep).join('/'),sha(fs.readFileSync(f))]));
export function json(file,value) {
  noLinks(file);fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,file);
}
export const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
export function local(){const p=path.join(state,'local.json');return fs.existsSync(p)?readJSON(p):{};}
export const saveLocal=config=>json(path.join(state,'local.json'),config);
export function project(id) {
  identifier(id);const config=readJSON(path.join(tool,'projects',id+'.json'));
  if(config.id!==id)throw Error('Project ID mismatch');identifier(config.resource);
  if(!['resource','lb-phone','job','game'].includes(config.kind))throw Error('Invalid project kind');
  const source=inside(repo,local().sources?.[id]?.path||config.source);noLinks(source);
  return {...config,source};
}
export function redact(value) {
  return String(value).replace(/mysql:\/\/[^\s"']+/gi,'mysql://[REDACTED]')
    .replace(/cfxk_[A-Za-z0-9_-]+/g,'[LICENSE REDACTED]')
    .replace(/((?:password|token|secret|licenseKey|mysql_connection_string)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]')
    .replace(/(?:license|discord|steam):[a-z0-9]+/gi,'[IDENTIFIER]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]+\b/gi,'[EMAIL]');
}
export function command(exe,args=[],options={}) {
  const r=spawnSync(exe,args,{cwd:options.cwd||repo,encoding:'utf8',timeout:options.timeout||60000,windowsHide:true,shell:false,maxBuffer:8*1024*1024,input:options.input,env:options.env||process.env});
  return {ok:!r.error&&r.status===0,status:r.status,missing:r.error?.code==='ENOENT',output:redact((r.stdout||'')+(r.stderr||'')),error:r.error?.code||null};
}
export const launch=(exe,args,options={})=>spawn(exe,args,{cwd:options.cwd||repo,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe'],...options});
export function executable(names) {
  for(const name of names){const r=command(name,['-v'],{timeout:5000});if(r.ok&&/Lua 5\.4/.test(r.output))return name;}
  return null;
}
export const luaRuntime=()=>executable([process.env.FLECITY_LUA||local().lua||'lua5.4','lua54','lua']);
export const luaCompiler=()=>executable([process.env.FLECITY_LUAC||local().luac||'luac5.4','luac54','luac']);
export function newRun(id,suite) {
  identifier(id);const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
  const dir=path.join(state,'projects',id,'runs',runId);noLinks(dir);
  fs.mkdirSync(path.join(dir,'screenshots'),{recursive:true});fs.mkdirSync(path.join(dir,'logs'));
  return {id:runId,project:id,suite,started:new Date().toISOString(),dir,checks:[]};
}
export function result(run,name,status,detail='') {
  if(!['PASS','FAIL','NOT_RUN','BLOCKED'].includes(status))throw Error('Invalid status');
  run.checks.push({name,status,suite:run.activeSuite||run.suite,detail:redact(detail)});
  console.log(status.padEnd(8)+' '+name+(detail?' — '+redact(detail).split('\n')[0]:''));
}
export function saveRun(run) {
  run.finished=new Date().toISOString();
  run.status=run.checks.some(c=>c.status==='FAIL')?'FAIL':run.checks.some(c=>c.status==='BLOCKED')?'BLOCKED':run.checks.some(c=>c.status==='NOT_RUN')||!run.checks.length?'NOT_RUN':'PASS';
  const git=command('git',['rev-parse','HEAD']);run.gitHead=git.ok?git.output.trim():null;
  const changed=command('git',['status','--porcelain','--untracked-files=no']);run.dirtyPaths=changed.ok?changed.output.split('\n').filter(Boolean):[];
  json(path.join(run.dir,'result.json'),run);json(path.join(state,'projects',run.project,'latest.json'),run);
  json(path.join(state,'projects',run.project,run.suite+'-latest.json'),run);
  if(run.suite==='all')for(const suite of ['static','db','nui','visual','game','virtual-multiplayer','live']){
    const checks=run.checks.filter(c=>c.suite===suite);
    const status=checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='BLOCKED')?'BLOCKED':
      !checks.length||checks.some(c=>c.status==='NOT_RUN')?'NOT_RUN':'PASS';
    json(path.join(state,'projects',run.project,suite+'-latest.json'),{...run,suite,checks,status});
  }
  fs.appendFileSync(path.join(state,'projects',run.project,'history.jsonl'),JSON.stringify({id:run.id,status:run.status,suite:run.suite,gitHead:run.gitHead,started:run.started,sourceHash:run.sourceHash||null})+'\n');
  fs.writeFileSync(path.join(run.dir,'summary.md'),['# '+run.project+' — '+run.status,'',...run.checks.map(c=>'- '+c.status+' '+c.name+': '+c.detail),''].join('\n'));
  console.log('Result: '+run.status+' | '+path.relative(repo,run.dir));return run;
}
export function copyTree(source,destination,includeAll=false) {
  const list=files(source,includeAll?[]:undefined);noLinks(destination);if(fs.existsSync(destination))throw Error('Destination already exists');
  fs.mkdirSync(destination,{recursive:true});
  for(const file of list){const target=inside(destination,path.relative(source,file));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);}
}
export function locked(name,fn) {
  identifier(name);const dir=path.join(state,'locks');noLinks(dir);fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,name+'.lock'),fd=fs.openSync(file,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));
  return Promise.resolve().then(fn).finally(()=>{fs.closeSync(fd);fs.unlinkSync(file);});
}
