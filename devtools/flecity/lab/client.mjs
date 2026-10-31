import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {labPath,initialize,readiness,labRoot,loadLicense,registry} from './runtime.mjs';
import {repo,tool,readJSON,newRun,result,saveRun,json,project,identifier,inside,noLinks} from '../core.mjs';
export async function request(endpoint,body){
  const c=readJSON(labPath('connection.json'));
  return await new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:c.port,path:endpoint,method:body===undefined?'GET':'POST',
      headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},timeout:70000},res=>{
      let text='';res.on('data',d=>text+=d);res.on('end',()=>{try{const value=JSON.parse(text);if(res.statusCode!==200)reject(Error(value.error));else resolve(value);}catch(e){reject(e);}});
    });
    req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Private lab control timeout')));
    req.end(body===undefined?undefined:JSON.stringify(body));
  });
}
export async function labCommand(action,id,options={}){
  throw Error('Dedicated FXServer lab retired by user policy; use flecity server check/logs/verify. No license file was read.');
  if(action==='register'){
    identifier(id);const config=project(id),data=registry();
    if(data[id])throw Error('Already registered in private lab');
    if(Object.values(data).some(p=>p.resource===config.resource))throw Error('Shared resource already registered; provide an adapter under its canonical project');
    let adapter=options.adapter;
    if(!adapter){
      adapter='devtools/flecity/lab/adapters/'+id+'.lua';const file=inside(repo,adapter);noLinks(file);
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,"return function(ctx)\n    ctx.skip('Server contract','Implement project-specific assertions')\nend\n",{flag:'wx'});
    }
    noLinks(inside(repo,adapter));
    if(!adapter.endsWith('.lua')||!fs.existsSync(inside(repo,adapter)))throw Error('Expected existing local Lua adapter');
    data[id]={resource:config.resource,adapter};json(labPath('projects.json'),data);
    console.log('Private lab project registered; restart private lab to stage it');return;
  }
  if(action==='recover'){
    try{await request('/stop',{});await new Promise(r=>setTimeout(r,9000));}catch{}
    const lock=labPath('owner.lock');
    if(fs.existsSync(lock)){
      const pid=Number(fs.readFileSync(lock,'utf8'));let dead=false;
      try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')dead=true;}
      if(!dead)throw Error('Owner still exists; refusing PID-based termination');
      fs.renameSync(lock,labPath('stale-owner-'+Date.now()+'.lock'));
    }
    return labCommand('start');
  }
  if(action==='logs'){
    const data=await request('/logs'),run=newRun(id||'lab','lab-logs');
    fs.writeFileSync(path.join(run.dir,'logs','process.log'),data.process);
    fs.writeFileSync(path.join(run.dir,'logs','database.log'),data.database);
    result(run,'Private log collection','PASS','Redacted logs from owned instance '+data.instance);saveRun(run);return;
  }
  if(action==='init'){const capacity=await readiness();initialize();console.log(JSON.stringify(capacity));return;}
  if(action==='start'){
    try{const status=await request('/status');if(status.active){console.log(JSON.stringify(status));return;}}catch{}
    if(fs.existsSync(labPath('owner.lock')))throw Error('Existing supervisor lock; inspect private status before recovery');
    loadLicense();
    await readiness();initialize();
    if(fs.existsSync(labPath('startup-error.json')))fs.renameSync(labPath('startup-error.json'),labPath('startup-error-'+Date.now()+'.json'));
    const child=spawn(process.execPath,[path.join(tool,'lab/supervisor.mjs')],{cwd:repo,detached:true,windowsHide:true,stdio:'ignore'});child.unref();
    const deadline=Date.now()+120000;
    while(Date.now()<deadline){
      try{const status=await request('/status');if(status.active){console.log(JSON.stringify(status));return;}}catch{}
      if(fs.existsSync(labPath('startup-error.json'))&&!fs.existsSync(labPath('owner.lock')))throw Error(readJSON(labPath('startup-error.json')).error);
      await new Promise(r=>setTimeout(r,500));
    }
    throw Error('Private lab startup timeout; inspect '+labRoot);
  }
  if(action==='status'){console.log(JSON.stringify(await request('/status'),null,2));return;}
  if(action==='stop'){console.log(JSON.stringify(await request('/stop',{})));return;}
  if(['update','restore'].includes(action)){console.log(JSON.stringify(await request('/'+action,{project:id}),null,2));return;}
  if(action==='test'){
    const run=newRun(id,'server');
    try{
      const value=await request('/test',{project:id});
      for(const check of value.checks)result(run,check.name,check.status,check.detail||'');
      json(path.join(run.dir,'harness.json'),value);
      result(run,'Full QBox/LB Phone integration','NOT_RUN','Boundary doubles used; actual FXServer/oxmysql/MariaDB');
    }catch(e){result(run,'Private server test','FAIL',e.message);}
    const status=saveRun(run);process.exitCode=status.status==='FAIL'?1:status.status==='PASS'?0:2;return;
  }
  throw Error('Expected lab init|start|status|test|update|restore|stop');
}
