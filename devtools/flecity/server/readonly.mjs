import fs from 'node:fs';
import path from 'node:path';
import {newRun,result,saveRun,json,redact,local,project} from '../core.mjs';
import {snapshot,assertIdle} from './connection.mjs';
import {logFile,bookmark} from '../evidence.mjs';
import {runProject} from '../checks.mjs';
import {bridgePlan} from './bridge-plan.mjs';
import {runNative} from './bridge-client.mjs';
import {prepareClient} from './client-plan.mjs';
export function resourceTail(config,maxBytes=262144){
  const file=logFile(),stat=fs.statSync(file),start=Math.max(0,stat.size-maxBytes);
  const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(stat.size-start);
  try{fs.readSync(fd,buffer,0,buffer.length,start);}finally{fs.closeSync(fd);}
  let lines=buffer.toString('utf8').replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/);
  if(start)lines.shift();
  lines=lines.filter(line=>(config.logTags||[]).some(tag=>line.includes(tag)));
  return {file,start,end:stat.size,lines:redact(lines.join('\n')),historical:true,proofOfTestPass:false,count:lines.length};
}
export async function readOnlyCheck(config){
  const run=newRun(config.id,'server-readonly');run.logStart=bookmark();
  try{
    const observed=await snapshot(config);run.sourceHash=observed.sourceHash;run.targetHash=observed.targetHash;
    json(path.join(run.dir,'connection.json'),observed);
    result(run,'Existing FiveM connection','PASS',observed.serverVersion);
    result(run,'Target and dependency reporting','PASS',observed.resource+'; '+observed.dependencies.map(d=>d.name).join(', '));
    try{assertIdle(observed);result(run,'Tester gate','PASS','dynamic.json and players.json both report 0');}
    catch(e){result(run,'Tester gate','BLOCKED',e.message);}
    result(run,'Shared-resource impact','PASS',observed.sharedWith.length?observed.resource+' also contains '+observed.sharedWith.join(', '):'Dedicated resource');
    const tail=resourceTail(config);fs.writeFileSync(path.join(run.dir,'logs','server-resource-history.txt'),tail.lines);
    json(path.join(run.dir,'logs','metadata.json'),{...tail,lines:undefined});
    result(run,'Read-only resource log collection','PASS',tail.count+' historical tagged lines; not a current test result');
    result(run,'Native resource selftest','NOT_RUN','This read-only check does not dispatch tests; use server run with an approved audited bridge');
    result(run,'Client/callback integration','NOT_RUN','No fake actors, injected clients or existing-DB test writes performed');
  }catch(e){result(run,'Existing-server readiness','BLOCKED',e.message);}
  return saveRun(run);
}
export async function serverCommand(action,id){
  if(action==='prepare-client'){const r=await prepareClient(project(id));process.exitCode=r.status==='FAIL'?1:r.status==='PASS'?0:2;return;}
  if(action==='plan-bridge'){bridgePlan();return;}
  if(action==='run'){const r=await runNative(project(id));process.exitCode=r.status==='FAIL'?1:r.status==='PASS'?0:2;return;}
  if(!['check','logs','verify'].includes(action))throw Error('Only read-only check/logs/verify are enabled pending initial approval');
  const config=project(id);
  let localFailure=false;
  if(action==='verify'){
    const s=await runProject(config,'static'),u=await runProject(config,'nui');
    localFailure=[s,u].some(r=>r.status==='FAIL');
  }
  const run=await readOnlyCheck(config);
  process.exitCode=localFailure||run.status==='FAIL'?1:run.status==='PASS'?0:2;
}
