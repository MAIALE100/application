import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {state,tool,local,inside,noLinks,copyTree,inventory,json,readJSON} from '../core.mjs';
import {approvedServer} from '../deployment.mjs';
export function bridgePlan(){
  const server=local().server;
  if(server?.type!=='test'||path.resolve(server.root)!==path.resolve(approvedServer))throw Error('Existing test server only');
  const destination=inside(server.root,server.resourcesRoot+'/flecity_validation_bridge');noLinks(destination);
  if(fs.existsSync(destination))throw Error('Bridge already exists; explicit versioned update plan required');
  const id=crypto.randomUUID(),dir=path.join(state,'bridge-plans',id),source=path.join(dir,'flecity_validation_bridge');
  copyTree(path.join(tool,'server-bridge'),source);
  json(path.join(source,'private.json'),{token:crypto.randomBytes(32).toString('hex'),allowed:{base_selftest:true,link_selftest:true}});
  const files=inventory(source);
  // Never include file contents or the capability token in the review summary.
  const plan={id,kind:'INITIAL_APPROVAL_REQUIRED',destination,source,files,
    operations:['base_selftest -> base_selftest','link_selftest -> game_selftest'],
    restartOperations:[],dbWrites:false,existingAppFilesChanged:false,testerGate:'0 native players required at dispatch',
    acl:['add_ace resource.flecity_validation_bridge command.base_selftest allow'],
    activation:['refresh','ensure flecity_validation_bridge'],
    rollback:['stop flecity_validation_bridge','remove_ace resource.flecity_validation_bridge command.base_selftest allow','Move only the bridge folder back to its private staging area after stopping it'],
    forbidden:['game_preflight (database bootstrap)','full server restart','application resource restart','license access'],
    approvalReceived:false,created:new Date().toISOString()};
  json(path.join(dir,'plan.json'),plan);
  console.log('Approval plan: '+path.join(dir,'plan.json'));
  console.log('Install new flecity_validation_bridge only; no BASE/LINK file update or restart; native selftest commands require approval');
  return plan;
}
