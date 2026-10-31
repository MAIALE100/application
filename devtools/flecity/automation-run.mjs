import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {repo,state,tool,readJSON,json,inventory,sha,noLinks,inside,project} from './core.mjs';
import {eligible,isolatedJobs,runNode} from './automation-control.mjs';
import {localThenObservation} from './server/state-observer.mjs';
import {automaticReadiness} from './server/automatic-readiness.mjs';

const root=path.join(state,'automation');noLinks(root);
const lease=readJSON(path.join(root,'lease.json'));
if(!process.env.FLECITY_AUTODEV_LEASE||lease.nonce!==process.env.FLECITY_AUTODEV_LEASE||lease.pid!==process.ppid||path.resolve(lease.workspace)!==repo)throw Error('Run through automation-run.ps1 with its OS mutex');
const policy=readJSON(path.join(tool,'MIGRATION_STATE.json'));
if(path.resolve(policy.workspace)!==repo||policy.mode!=='offline-validation')throw Error('Unexpected automation policy');
const started=Date.now(),deadline=started+20*60000,runId=new Date(started).toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
const out=path.join(root,'runs',runId);fs.mkdirSync(out,{recursive:true});
// Stop growth instead of silently deleting evidence, user photos, or backups.
function measure(dir){let total=0;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);noLinks(p);total+=e.isDirectory()?measure(p):fs.statSync(p).size;}return total;}
if(measure(state)>1024**3)throw Error('Local evidence exceeds 1 GiB; review archive before continuing');
const oldEvidence=fs.readdirSync(path.join(root,'runs')).filter(name=>/^\d{4}-/.test(name)).some(name=>started-fs.statSync(path.join(root,'runs',name)).mtimeMs>30*86400000);
if(oldEvidence)throw Error('Evidence older than 30 days requires archive review; no automatic deletion');
const historyPath=path.join(root,'state.json'),history=fs.existsSync(historyPath)?readJSON(historyPath):{};
function protectedSnapshot(){try{return inventory(path.join(repo,'puriphoto'));}catch{return null;}}
const protectedBefore=protectedSnapshot();
const tasks=[{id:'toolkit',suites:['tests']},...['base','link','loop','wave','flepri'].map(id=>({id,suites:id==='base'?['static','db','nui','visual']:id==='link'?['static','db','game','virtual-multiplayer','nui','visual']:id==='loop'?['static','db','virtual-multiplayer','visual']:['static','db','nui','visual']}))];
const {results,serverObservation}=await localThenObservation(async()=>{
const results=[];
for(const task of tasks){
  if(!eligible(task.id,policy,history,started)){results.push({id:task.id,status:policy.apps[task.id]?.automation==='PAUSED'?'PAUSED':'BLOCKED',reason:'App policy or failure backoff'});continue;}
  const source=policy.apps[task.id]?.source;
  const entries=await isolatedJobs([task],async job=>{
    // Source/path failures belong to this app; they must not abort the remaining apps.
    const sourceRoot=source?inside(repo,source):null;
    const before=sourceRoot?inventory(sourceRoot):null;
    const suites=[];
    for(const suite of job.suites){
      if(Date.now()>=deadline){suites.push({suite,status:'BLOCKED',reason:'20 minute deadline'});break;}
      const args=suite==='tests'?['--test','--test-reporter=tap',...fs.readdirSync(path.join(tool,'tests')).filter(f=>f.endsWith('.test.mjs')).map(f=>path.join(tool,'tests',f))]:[path.join(tool,'cli.mjs'),'test',job.id,'--suite',suite];
      const result=await runNode(args,{cwd:repo,timeout:Math.min(120000,deadline-Date.now())});
      const log=path.join(out,job.id+'-'+suite+'.log');fs.writeFileSync(log,result.output);
      const stats=suite==='tests'?Object.fromEntries(['tests','pass','fail','skipped'].map(k=>[k,Number(result.output.match(new RegExp('^# '+k+' (\\d+)','m'))?.[1])])):undefined;
      const status=stats&&(!Number.isFinite(stats.tests)||stats.tests<64)?'FAIL':stats?.skipped>0&&result.status==='PASS'?'NOT_RUN':result.status;
      suites.push({suite,status,code:result.code,timedOut:result.timedOut,stats,log:path.relative(repo,log)});
    }
    const unchanged=!sourceRoot||JSON.stringify(before)===JSON.stringify(inventory(sourceRoot));
    return {status:!unchanged||suites.some(s=>s.status==='FAIL')?'FAIL':suites.some(s=>s.status==='BLOCKED')?'BLOCKED':suites.some(s=>s.status==='NOT_RUN')?'NOT_RUN':'PASS',suites,sourceUnchanged:unchanged,sourceHash:before?sha(JSON.stringify(before)):null};
  },history,started);
  results.push(...entries);json(historyPath,history);
}
results.push({id:'puriphoto',status:'PAUSED',protectedUnchanged:protectedBefore!==null&&JSON.stringify(protectedBefore)===JSON.stringify(protectedSnapshot()),reason:'User withheld migration approval; no commands or writes'});
return results;
});
// Observe only after independent local work. A stopped/unreachable server never cancels local work.
const updatePolicy=readJSON(path.join(tool,'UPDATE_POLICY.json'));
const heldUpdates=tasks.filter(t=>t.id!=='toolkit').map(t=>{
  try{
  return automaticReadiness(project(t.id),updatePolicy);
  }catch{return {app:t.id,status:'BLOCKED',reasons:['SOURCE_OR_REGISTRATION_UNAVAILABLE'],mutated:false};}
});
const summary={runId,started:new Date(started).toISOString(),finished:new Date().toISOString(),mode:policy.mode,results,serverObservation,heldUpdates,updatedResources:[],status:results.some(r=>r.status==='FAIL'||r.protectedUnchanged===false)?'FAIL':results.some(r=>r.status==='BLOCKED')?'BLOCKED':results.some(r=>r.status==='NOT_RUN')?'NOT_RUN':'PASS'};
json(path.join(out,'summary.json'),summary);json(path.join(root,'latest.json'),summary);
fs.writeFileSync(path.join(out,'REPORT_JA.md'),'# 定期検証結果\n\n## 開発・ローカル検証\n\n'+results.map(r=>'- '+r.id+': '+r.status).join('\n')+
  '\n\n## サーバー状態\n\n'+JSON.stringify(serverObservation)+'\n\n## 更新・保留\n\n更新したリソース: なし。\n'+heldUpdates.map(r=>'- '+r.app+': 保留 ('+r.reasons.join(', ')+')').join('\n')+
  '\n\n## 不具合・次回作業\n\nFAILは個別ログを確認。承認済みUI基準画像、未登録の仮想テスト、初回更新承認・ネイティブ観測/再起動アダプターが未整備の項目はNOT_RUN/BLOCKED。既存DB・リソース更新・実FiveM操作なし。プリフォトは保留。使い捨てDBだけでSQLを検証。\n');
console.log(JSON.stringify(summary,null,2));process.exitCode=summary.status==='FAIL'||summary.status==='BLOCKED'?1:summary.status==='NOT_RUN'?2:0;
