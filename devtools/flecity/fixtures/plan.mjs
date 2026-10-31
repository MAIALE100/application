import path from 'node:path';import crypto from 'node:crypto';import fs from 'node:fs';
import {state,tool,project,inventory,sha,json,readJSON,noLinks} from '../core.mjs';
import {runProject} from '../checks.mjs';
export function createFixturePlan(){
 const id=crypto.randomUUID();
 const projects=['base','link'].map(id=>{const p=project(id);return {id,resource:p.resource,source:p.source,
  sourceHash:sha(JSON.stringify(inventory(p.source))),schema:id==='base'?'sql/schema.sql':'sql/001_initial.sql'};});
 const plan={version:1,id,kind:'disposable-db-only',created:new Date().toISOString(),approvalReceived:false,
  root:path.join(state,'db'),transport:'Unique named pipe; TCP disabled; actual datadir must match newly created private directory',
  databases:'New empty flecity_base_<random> and flecity_link_<random>; no existing database connection',
  projects,toolHash:sha(JSON.stringify(inventory(tool))),
  operations:['Initialize isolated MariaDB child instance for each project','Apply only copied BASE/LINK schemas in newly created DB','Run existing transaction, rollback, concurrency and constraint fixtures','Stop only the child process; retain private artifacts for diagnosis'],
  forbidden:['existing DB access','existing resource update/restart','real client connection','license access'],
  liveFixtureEnforcementReady:false,liveStatus:'BLOCKED',
  liveBlockers:['No server-side fixture routing/deny layer installed','QBox/LB Phone login and initialization writes not isolated','No dedicated licensed client identity configured']};
 const file=path.join(state,'fixture-plans',id,'plan.json');json(file,plan);return {file,plan};
}
export function assertFixtureApproval(plan,receipt){
 if(plan.kind!=='disposable-db-only'||receipt?.userApproved!==true||receipt?.planId!==plan.id||receipt?.planHash!==sha(JSON.stringify(plan)))throw Error('Explicit approval for this exact disposable DB plan is required');
 if(sha(JSON.stringify(inventory(tool)))!==plan.toolHash)throw Error('Fixture tools changed; create and review a new plan');
 for(const p of plan.projects){const current=project(p.id);if(current.source!==p.source||sha(JSON.stringify(inventory(current.source)))!==p.sourceHash)throw Error('Fixture source changed');}
}
export async function verifyFixtureDB(id){
 if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('Fixed fixture plan ID required');
 const file=path.join(state,'fixture-plans',id,'plan.json');noLinks(file);const plan=readJSON(file);
 const approval=path.join(state,'approvals','fixtures',id+'.json');noLinks(approval);
 assertFixtureApproval(plan,fs.existsSync(approval)?readJSON(approval):null);
 const runs=[];for(const p of plan.projects)runs.push(await runProject(project(p.id),'db'));
 json(path.join(path.dirname(file),'execution.json'),{planId:id,mode:'disposable-only',runs:runs.map(r=>({id:r.id,project:r.project,status:r.status,dir:r.dir}))});
 return runs.some(r=>r.status==='FAIL')?1:runs.every(r=>r.status==='PASS')?0:2;
}
