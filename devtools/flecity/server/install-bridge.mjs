import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {state,local,inside,noLinks,readJSON,json,inventory,sha,copyTree,project} from '../core.mjs';
import {snapshot,assertIdle} from './connection.mjs';
import {approvedServer} from '../deployment.mjs';
import {assertBridgeApproval} from './approval.mjs';
export async function installApprovedBridge(){
  const approval=readJSON(path.join(state,'approvals','bridge.json'));
  assertBridgeApproval(approval);
  const plan=readJSON(path.join(state,'bridge-plans',approval.planId,'plan.json'));
  const destination=inside(approvedServer,local().server.resourcesRoot+'/flecity_validation_bridge');noLinks(destination);
  if(destination!==plan.destination||fs.existsSync(destination))throw Error('Unexpected or existing bridge destination');
  noLinks(plan.source);
  if(JSON.stringify(inventory(plan.source))!==JSON.stringify(plan.files))throw Error('Approved staged bridge changed');
  const before={};
  for(const id of ['base','link']){
    const observed=await snapshot(project(id));assertIdle(observed);
    if(observed.targetHash!==approval.auditedTargets?.[id])throw Error('Audited '+id+' resource changed');
    before[id]=observed;
  }
  const journal=path.join(state,'bridge-install',plan.id,'journal.json');
  json(journal,{planId:plan.id,destination,originallyAbsent:true,permissionsFileChanged:false,licenseAccessed:false,before,phase:'prepared'});
  // Must be invoked through the shell's approved write permission for the test-server directory.
  assertIdle(await snapshot(project('base')));
  let created=false;
  try{
    fs.mkdirSync(destination);created=true;
    for(const relative of Object.keys(plan.files)){
      const source=inside(plan.source,relative),target=inside(destination,relative);noLinks(source);noLinks(target);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
    }
    if(JSON.stringify(inventory(destination))!==JSON.stringify(plan.files))throw Error('Installed bridge hash mismatch');
    const after=await snapshot(project('base'));assertIdle(after);
    json(journal,{planId:plan.id,destination,originallyAbsent:true,permissionsFileChanged:false,licenseAccessed:false,before,phase:'files-installed-not-started'});
    console.log('Approved bridge files installed and hash-verified; no resource start, restart, SQL or ACL action executed.');
  }catch(e){
    if(created){
      const recovery=path.join(state,'bridge-install',plan.id,'rolled-back','flecity_validation_bridge');noLinks(recovery);
      fs.mkdirSync(path.dirname(recovery),{recursive:true});
      fs.renameSync(destination,recovery);
    }
    json(journal,{planId:plan.id,phase:'rolled-back-before-activation',reason:e.message});
    throw e;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await installApprovedBridge();
