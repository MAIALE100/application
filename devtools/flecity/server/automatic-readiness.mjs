import fs from 'node:fs';
import path from 'node:path';
import {tool,state,readJSON,inventory,sha,local,inside,noLinks} from '../core.mjs';
import {targetFor,approvedServer} from '../deployment.mjs';
import {dependencies} from './connection.mjs';
import {evaluateUpdate} from './update-gate.mjs';

// Read local evidence independently of server availability. No backup creation or dispatch.
export function automaticReadiness(config,policy){
  const profiles=fs.readdirSync(path.join(tool,'projects')).filter(f=>f.endsWith('.json')).map(f=>readJSON(path.join(tool,'projects',f)));
  const peers=profiles.filter(p=>p.resource===config.resource&&p.id!==config.id).map(p=>p.id);
  const enrolled=policy.resources?.[config.resource];
  let target=null,targetHash=null;
  try{target=targetFor(config);targetHash=sha(JSON.stringify(inventory(target,true)));}catch{}
  const sourceHash=sha(JSON.stringify(inventory(config.source)));
  const plan={project:config.id,resource:config.resource,sharedWith:peers,serverType:local().server?.type,serverRoot:approvedServer,
    resourcesRoot:local().server?.resourcesRoot,target,targetHash,sourceHash,dependencies:dependencies(fs.readFileSync(path.join(config.source,'fxmanifest.lua'),'utf8')),
    sourceComplete:enrolled?.completeSourceAuditHash===sourceHash,runtimeAudit:enrolled?.runtimeAuditHash===sourceHash?'PASS':'NOT_RUN',
    existingDataWrites:enrolled?.existingDataWrites,dbMigration:enrolled?.dbMigration,removed:enrolled?.reviewedRemoved};
  const tests=[];
  for(const app of [config.id,...peers])for(const suite of enrolled?.requiredSuites?.[app]||policy.requiredSuites||[]){
    const file=path.join(state,'projects',app,suite+'-latest.json');noLinks(file);
    if(fs.existsSync(file)){const r=readJSON(file);tests.push({app,suite,status:r.status,sourceHash:r.sourceHash,checks:r.checks,checkedAtMs:Date.parse(r.finished)});}
  }
  let backup=null;
  if(enrolled?.backupReceipt){const file=inside(state,enrolled.backupReceipt);noLinks(file);if(fs.existsSync(file))backup=readJSON(file);}
  const decision=evaluateUpdate({plan,policy,tests,backup,proof:null,challenge:null,exclusive:true,registeredApps:profiles});
  return {app:config.id,resource:config.resource,status:'BLOCKED',reasons:[...decision.blockers,'LIVE_MUTATION_ADAPTER_NOT_ENABLED'],
    localTests:tests.map(({app,suite,status})=>({app,suite,status})),impactedApps:[config.id,...peers],sourceHash,mutated:false};
}
