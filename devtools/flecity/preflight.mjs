import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {project,state,local,inventory,sha,newRun,result,saveRun,readJSON,inside,noLinks} from './core.mjs';
import {targetFor,approvedServer} from './deployment.mjs';
export async function serverInfo(){
  return await new Promise((resolve,reject)=>{
    const request=http.get('http://127.0.0.1:30120/info.json',{timeout:4000},response=>{
      if(response.statusCode!==200){response.resume();reject(Error('info.json HTTP '+response.statusCode));return;}
      let bytes=0,text='';
      response.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024){response.destroy(Error('info.json too large'));return;}text+=chunk;});
      response.on('error',reject);response.on('end',()=>{try{resolve(JSON.parse(text));}catch(e){reject(e);}});
    });
    request.on('timeout',()=>request.destroy(Error('Read-only info.json timeout')));request.on('error',reject);
  });
}
export async function preflight(config){
  const run=newRun(config.id,'preflight');
  try{
    const target=targetFor(config);
    run.sourceHash=sha(JSON.stringify(inventory(config.source)));
    run.targetHash=sha(JSON.stringify(inventory(target,true)));
    result(run,'Target identity','PASS',target);
    const cfgFile=inside(approvedServer,'txData/default/config.json');noLinks(cfgFile);
    const active=readJSON(cfgFile).server?.dataPath;
    if(!active||!path.resolve(target).startsWith(path.resolve(active)+path.sep))throw Error('Active txAdmin profile does not contain target');
    result(run,'Active profile','PASS','Configured profile matches target');
    for(const suite of ['static','nui']){
      const file=path.join(state,'projects',config.id,suite+'-latest.json');
      const prior=fs.existsSync(file)?readJSON(file):null;
      result(run,'Exact-source '+suite,prior?.status==='PASS'&&prior.sourceHash===run.sourceHash?'PASS':'BLOCKED',prior?.id||'No matching result');
    }
    const info=await serverInfo(),names=[config.resource,'qbx_core','oxmysql','lb-phone'];
    const reported=names.filter(name=>(info.resources||[]).includes(name));
    result(run,'Read-only server baseline',reported.length===names.length?'PASS':'BLOCKED','info.json reports '+reported.join(', ')+'; no commands issued');
    result(run,'Shared resource scope','PASS',config.sharedWith?.length?'Restart affects '+config.sharedWith.join(', '):'Dedicated resource');
    if(local().server.deploymentEnabled!==false)throw Error('Expected deployment disabled during preparation');
    result(run,'Live execution authorization','BLOCKED','Deployment/restart and existing-DB writes require explicit approval; DB isolation/backup not yet confirmed');
    result(run,'FiveM integration','NOT_RUN','HTTP baseline and offline UI do not establish live callback/game behavior');
    const steps=config.id==='base'?[
      'BASE candidate and exact plan must be reviewed before file updates.',
      'Use a separate test DB/server, or confirm verified DB backup and allowed test-record changes.',
      'Only after approval: update only flecity_base; operator restarts only flecity_base and runs base_selftest.',
      'Expect all 8 checks; capture new logs. In LB Phone verify existing text values survive invalid input, explicit clear, hide/show and stock history.',
      'Use disposable data and two testers for concurrency/authorization; no failure injection in existing DB.'
    ]:[
      'LINK and LOOP share flecity_games. Approve their shared interruption before any restart.',
      'No LINK file change is currently proposed; current deployed source is the offline UI/rule test source.',
      'Use a separate test DB/server, or confirm verified DB backup and allowed test records.',
      'After approval, run the reviewed game_selftest. game_preflight is excluded because it calls database Ensure and may change schema.',
      'Do not start subscriptions, billing/refunds, destructive tests or other resources as part of this check.'
    ];
    fs.writeFileSync(path.join(run.dir,'manual-steps.md'),'# Pending live validation — NOT RUN\n\n'+steps.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n');
  }catch(e){result(run,'Live preparation','BLOCKED',e.message);}
  return saveRun(run);
}
