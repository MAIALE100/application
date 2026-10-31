import path from 'node:path';
import {repo,inside,noLinks,readJSON,newRun,result,saveRun,json} from '../core.mjs';
import {snapshot} from './connection.mjs';

// Descriptions only: no client driver, callback dispatch, SQL or engine commands.
export function buildClientPlan(config,scenarios=[]){
  if(!Array.isArray(scenarios))throw Error('Client scenarios must be an array');
  const ids=new Set();
  for(const s of scenarios){
    if(!/^[a-z][a-z0-9-]*$/.test(s.id||'')||ids.has(s.id))throw Error('Invalid or duplicate client scenario');
    ids.add(s.id);
    if(!['read-only','session','persistent','unknown'].includes(s.dataEffect)||typeof s.description!=='string')throw Error('Scenario effect and description required');
  }
  return {version:1,project:config.id,resource:config.resource,sharedWith:config.sharedWith||[],
    executionEnabled:false,status:'NOT_RUN',
    prerequisites:[
      'Review current official FiveM and LB Phone terms before choosing a client driver',
      'User-controlled licensed FiveM client, signed in by its owner; never copy credentials',
      'Audit every UI callback and startup path, including implicit profile/session writes',
      'Read-only scenarios must be proven read-only before use on existing data',
      'Session/persistent scenarios require isolated fixtures and explicit data/cleanup approval',
      'Bind evidence to deployed hashes, client build, scenario ID and a fresh run marker',
      'Abort on unexpected players, target/hash changes, errors or unknown side effects'
    ],
    scenarios:scenarios.map(s=>({...s,status:'NOT_RUN',codeAuditVerified:false})),
    evidence:['screenshots/','logs/','result.json','deployed SHA-256','client/LB Phone versions'],
    forbidden:['memory injection','anti-cheat bypass','credential extraction','unreviewed callback replay','automatic existing-data cleanup']};
}
export async function prepareClient(config){
  const run=newRun(config.id,'client-plan');
  try{
    let scenarios=[];
    if(config.clientPlan){const file=inside(repo,config.clientPlan);noLinks(file);scenarios=readJSON(file);}
    const plan=buildClientPlan(config,scenarios);
    json(path.join(run.dir,'client-plan.json'),plan);
    const current=await snapshot(config);run.sourceHash=current.sourceHash;run.targetHash=current.targetHash;
    json(path.join(run.dir,'connection.json'),current);
    result(run,'Client scenario plan','PASS',scenarios.length+' descriptions saved; no client actions executed');
    result(run,'FiveM client execution','NOT_RUN','Client driver, callback audit and isolated test identity are not configured');
  }catch(e){result(run,'Client preparation','BLOCKED',e.message);}
  return saveRun(run);
}
