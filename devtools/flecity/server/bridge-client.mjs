import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {state,local,inside,noLinks,readJSON,sha,json,newRun,result,saveRun,redact} from '../core.mjs';
import {approvedServer} from '../deployment.mjs';
import {snapshot,assertIdle,getEndpoint} from './connection.mjs';
import {bookmark,logFile} from '../evidence.mjs';
import {assertBridgeApproval} from './approval.mjs';
const operations={base:'base_selftest',link:'link_selftest'};
export function parseSelftest(text,id,project){
  if(!/^[a-f0-9-]{36}$/.test(id)||!operations[project])throw Error('Invalid native test identity');
  const marker='[FLECITY_AUTOTEST] BEGIN '+id+' '+operations[project],index=text.indexOf(marker);
  if(index<0)return null;
  const fresh=text.slice(index+marker.length);
  const matches=project==='base'?[...fresh.matchAll(/\[BASE\] selftest (PASS|FAIL) \((\d+)\/(\d+) failed\)/g)]:
    [...fresh.matchAll(/\[FlecityGames selftest\] end failures=(\d+)/g)];
  if(matches.length>1)throw Error('Ambiguous native selftest summaries');
  if(!matches.length)return null;
  const m=matches[0];
  if(project==='base')return {status:m[1]==='PASS'&&Number(m[2])===0&&Number(m[3])>=8?'PASS':'FAIL',summary:m[0]};
  return {status:Number(m[1])===0?'PASS':'FAIL',summary:m[0]};
}
function readDelta(start){
  const file=logFile(),stat=fs.statSync(file);
  if(!start||file!==start.file||stat.birthtimeMs!==start.birthtime||stat.size<start.size)throw Error('Log rotated; cannot correlate native test');
  if(stat.size-start.size>2*1024*1024)throw Error('Log window too large');
  const buffer=Buffer.alloc(stat.size-start.size),fd=fs.openSync(file,'r');
  try{fs.readSync(fd,buffer,0,buffer.length,start.size);}finally{fs.closeSync(fd);}
  return buffer.toString('utf8').replace(/\x1b\[[0-9;]*m/g,'');
}
export async function runNative(config){
  const run=newRun(config.id,'server-native');
  try{return await runAuthorized(config,run);}
  catch(e){result(run,'Native execution gate','BLOCKED',e.message);return saveRun(run);}
}
async function runAuthorized(config,run){
  if(!operations[config.id])throw Error('No approved native selftest operation registered');
  const approvalFile=path.join(state,'approvals','bridge.json');noLinks(approvalFile);
  if(!fs.existsSync(approvalFile))throw Error('Initial real-resource bridge installation/start approval has not been received');
  const approval=readJSON(approvalFile);
  assertBridgeApproval(approval);
  const plan=readJSON(path.join(state,'bridge-plans',approval.planId,'plan.json'));
  const destination=inside(approvedServer,local().server.resourcesRoot+'/flecity_validation_bridge');noLinks(destination);
  if(plan.destination!==destination||plan.approvalReceived===false&&approval.userApproved!==true)throw Error('Bridge plan identity mismatch');
  for(const [relative,hash]of Object.entries(plan.files)){
    const file=inside(destination,relative);noLinks(file);
    if(sha(fs.readFileSync(file))!==hash)throw Error('Installed bridge differs from approved files');
  }
  const control=readJSON(path.join(destination,'private.json'));
  if(typeof control.token!=='string'||control.token.length<48)throw Error('Bridge capability unavailable');
  const current=await snapshot(config);assertIdle(current);
  if(current.targetHash!==approval.auditedTargets[config.id])throw Error('Deployed code changed since the read-only selftest audit');
  const info=await getEndpoint('info.json');
  if(!info.resources?.includes('flecity_validation_bridge'))throw Error('Approved bridge is not reported as started');
  const id=crypto.randomUUID();
  run.sourceHash=current.sourceHash;run.targetHash=current.targetHash;run.logStart=bookmark();
  try{
    assertIdle(await snapshot(config));
    json(path.join(destination,'request.json'),{id,operation:operations[config.id],token:control.token,expiresAt:Math.floor(Date.now()/1000)+7});
    const deadline=Date.now()+20000;let summary=null,ack=null,text='';
    while(Date.now()<deadline){
      const response=path.join(destination,'response.json');
      if(fs.existsSync(response)){const parsed=readJSON(response);if(parsed.id===id)ack=parsed;}
      if(ack?.status==='BLOCKED'){result(run,'Native dispatch gate','BLOCKED',ack.reason);break;}
      if(ack?.status==='FAIL'){result(run,'Native dispatch','FAIL',ack.detail||'Dispatch failed');break;}
      text=readDelta(run.logStart);summary=parseSelftest(text,id,config.id);
      if(summary){await new Promise(r=>setTimeout(r,300));text=readDelta(run.logStart);summary=parseSelftest(text,id,config.id);break;}
      await new Promise(r=>setTimeout(r,200));
    }
    const selected=text.split(/\r?\n/).filter(line=>line.includes('[FLECITY_AUTOTEST]')||line.includes('[BASE] selftest')||line.includes('[FlecityGames selftest]'));
    fs.writeFileSync(path.join(run.dir,'logs','native-selftest.txt'),redact(selected.join('\n')));
    if(summary)result(run,'Correlated native selftest',summary.status,summary.summary);
    else if(!run.checks.length)result(run,'Native summary','NOT_RUN','No unique summary observed; an issued command is not PASS');
    result(run,'Client and data-changing callback coverage','NOT_RUN','No automated game client or test-data writes performed');
  }catch(e){result(run,'Native test','BLOCKED',e.message);}
  return saveRun(run);
}
