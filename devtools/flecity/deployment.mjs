import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { inside,noLinks,local,state,repo,copyTree,inventory,sha,json,readJSON,locked,identifier,files,saveLocal } from './core.mjs';

// No configurable production destination. Additional hosts require code review.
export const approvedServer=String.raw`D:\FiveM_Test_Server`;
export function targetFor(config,env=local().server) {
  if(!env||env.type!=='test'||path.resolve(env.root)!==path.resolve(approvedServer))throw Error('Only the inspected test server is permitted');
  const relative=env.targets?.[config.id];if(!relative)throw Error('No explicit resource destination');
  const target=inside(env.root,relative);
  const resources=inside(env.root,env.resourcesRoot);
  if(path.basename(resources)!=='resources')throw Error('Expected explicitly enrolled resources root');
  inside(resources,path.relative(resources,target));
  if(path.basename(target)!==config.resource)throw Error('Resource leaf mismatch');
  noLinks(target);return target;
}
export function backupTree(source,root,metadata={}) {
  noLinks(root);
  const before=inventory(source,true),id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex');
  const dir=inside(root,id);copyTree(source,path.join(dir,'resource'),true);
  assert.deepEqual(inventory(path.join(dir,'resource'),true),before,'Backup inventory mismatch');
  assert.deepEqual(inventory(source,true),before,'Resource changed during backup');
  json(path.join(dir,'backup.json'),{id,...metadata,created:new Date().toISOString(),files:before,hash:sha(JSON.stringify(before))});
  return dir;
}
export function backup(config) {
  const target=targetFor(config);
  const dir=backupTree(target,path.join(state,'projects',config.id,'backups'),{resource:config.resource,target});
  console.log('Backup: '+path.relative(repo,dir));return dir;
}
export function mergeCandidate(source,deployed,destination){
  const original=inventory(deployed,true),incoming=files(source);
  copyTree(deployed,destination,true);
  const changed=[],added=[];
  for(const file of incoming){
    const relative=path.relative(source,file),target=inside(destination,relative),bytes=fs.readFileSync(file);
    noLinks(target);
    if(fs.existsSync(target)){
      const prior=fs.readFileSync(target);
      const text=/\.(lua|js|mjs|css|html|sql|md|txt|json|cfg|svg)$/i.test(relative);
      if(prior.equals(bytes)||(text&&prior.toString('utf8').replace(/\r\n/g,'\n').trimEnd()===bytes.toString('utf8').replace(/\r\n/g,'\n').trimEnd()))continue;
      changed.push(relative);
    }else added.push(relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
  }
  assert.deepEqual(inventory(deployed,true),original,'Deployed resource changed during candidate preparation');
  return {changed,added,preserved:Object.keys(original).filter(f=>!incoming.some(p=>path.relative(source,p).split(path.sep).join('/')===f))};
}
export function prepareCandidate(config){
  const target=targetFor(config),dir=path.join(state,'candidates',config.id,crypto.randomUUID()),destination=path.join(dir,config.resource);
  const changes=mergeCandidate(config.source,target,destination);
  const metadata={project:config.id,resource:config.resource,source:config.source,deployed:target,created:new Date().toISOString(),...changes,removed:[],sourceHash:sha(JSON.stringify(inventory(destination))),approvalRequired:true};
  json(path.join(dir,'candidate.json'),metadata);
  const cfg=local();cfg.sources??={};cfg.sources[config.id]={path:path.relative(repo,destination),inspectionOnly:false,candidateReviewRequired:true,provenance:'Full deployed resource plus locally audited source overlay; see '+path.relative(repo,path.join(dir,'candidate.json'))};saveLocal(cfg);
  console.log('Local candidate: '+destination+' | changed='+changes.changed.length+' added='+changes.added.length+' removed=0; no server write');
  return metadata;
}
export function plan(config,backupId=null) {
  const target=targetFor(config);
  let source=config.source;
  if(backupId) {
    identifierBackup(backupId);
    const b=path.join(state,'projects',config.id,'backups',backupId),meta=readJSON(path.join(b,'backup.json'));
    if(meta.target!==target||meta.resource!==config.resource)throw Error('Backup destination mismatch');
    source=path.join(b,'resource');assert.deepEqual(inventory(source,true),meta.files,'Backup tampered');
  }
  const src=inventory(source,!!backupId),dst=inventory(target,true),id=crypto.randomUUID();
  const dir=path.join(state,'projects',config.id,'plans',id);
  // Pin all deployment bytes now; later source edits cannot change the plan.
  copyTree(source,path.join(dir,'resource'),!!backupId);
  const p={id,project:config.id,resource:config.resource,target,sourceHash:sha(JSON.stringify(src)),targetHash:sha(JSON.stringify(dst)),
    files:src,created:new Date().toISOString(),restoreFrom:backupId,sharedWith:config.sharedWith||[],
    changed:Object.keys(src).filter(f=>src[f]!==dst[f]),removed:Object.keys(dst).filter(f=>!(f in src)),
    requires:[backupId?'verified original backup identity':'PASS static checks for exact bytes','target resource stopped by operator','DB backup/isolated DB confirmation','explicit local deploymentEnabled']};
  p.blockers=[];
  if(!backupId&&local().sources?.[config.id]?.inspectionOnly)p.blockers.push('Imported inspection snapshot is not a reviewed complete deployment source');
  if(!backupId&&local().sources?.[config.id]?.candidateReviewRequired)p.blockers.push('Assembled candidate needs explicit review of this exact plan');
  if(p.removed.length)p.blockers.push('Plan removes files: explicit removal approval required');
  json(path.join(dir,'plan.json'),p);
  console.log('Plan: '+p.id+' | '+config.id+' -> '+target);
  console.log('Changed='+p.changed.length+' removed='+p.removed.length+' sharedWith='+p.sharedWith.join(','));
  for(const blocker of p.blockers)console.log('BLOCKED: '+blocker);
  console.log('Review: '+path.relative(repo,path.join(dir,'plan.json')));return p;
}
function identifierBackup(value){if(!/^[0-9TZ-]+-[a-f0-9]{8}$/.test(value))throw Error('Invalid backup ID');}
export function replaceTree(source,target,root,expectedHash,failpoint=null) {
  // This primitive is also exercised against temporary fixture targets in tests.
  inside(root,path.relative(root,target));noLinks(target);noLinks(source);
  if(sha(JSON.stringify(inventory(target,true)))!==expectedHash)throw Error('Target changed since plan');
  const suffix=crypto.randomUUID(),stage=path.join(path.dirname(target),'.'+path.basename(target)+'.stage-'+suffix);
  const previous=path.join(path.dirname(target),'.'+path.basename(target)+'.previous-'+suffix);
  copyTree(source,stage,true);assert.deepEqual(inventory(stage,true),inventory(source,true));
  let moved=false;
  try{
    if(failpoint==='before')throw Error('Injected before switch');
    // Re-check after staging to reject concurrent changes.
    if(sha(JSON.stringify(inventory(target,true)))!==expectedHash)throw Error('Concurrent target modification');
    fs.renameSync(target,previous);moved=true;
    if(failpoint==='after')throw Error('Injected after rename');
    fs.renameSync(stage,target);
  }catch(e){if(moved&&!fs.existsSync(target))fs.renameSync(previous,target);throw e;}
  return {target,previous}; // Retain old files; never recursively delete a resource.
}
export async function apply(config,planId,options={}) {
  if(!/^[a-f0-9-]{36}$/.test(planId||''))throw Error('Expected plan UUID');
  return locked('deploy-'+config.resource,async()=>{
    const env=local().server,target=targetFor(config);
    if(env.deploymentEnabled!==true)throw Error('Deployment is disabled in local config');
    if(local().sources?.[config.id]?.inspectionOnly&&!readJSON(path.join(state,'projects',config.id,'plans',planId,'plan.json')).restoreFrom)throw Error('Inspection-only source cannot be deployed');
    if(options.offline!==config.resource)throw Error('Operator must confirm only the target resource is stopped');
    if(options.dbBackupConfirmed!==true)throw Error('DB backup or disposable DB confirmation required');
    if(config.sharedWith?.length&&!options.shared)throw Error('Shared resource affects '+config.sharedWith.join(','));
    const dir=path.join(state,'projects',config.id,'plans',planId),p=readJSON(path.join(dir,'plan.json')),source=path.join(dir,'resource');
    const {snapshot,assertIdle}=await import('./server/connection.mjs');
    assertIdle(await snapshot(config,{allowStoppedTarget:true}));
    if(!p.restoreFrom&&local().sources?.[config.id]?.candidateReviewRequired&&options.reviewed!==planId)throw Error('Exact candidate plan review confirmation required');
    if(p.removed.length&&!options.removals)throw Error('Explicit approval of planned file removals required');
    if(p.target!==target||p.resource!==config.resource||p.project!==config.id)throw Error('Plan identity mismatch');
    if(sha(JSON.stringify(inventory(source,true)))!==p.sourceHash)throw Error('Staged source changed');
    if(p.restoreFrom){
      identifierBackup(p.restoreFrom);
      const b=path.join(state,'projects',config.id,'backups',p.restoreFrom),meta=readJSON(path.join(b,'backup.json'));
      if(meta.target!==target||meta.resource!==config.resource||meta.hash!==p.sourceHash)throw Error('Restore backup identity mismatch');
      assert.deepEqual(inventory(path.join(b,'resource'),true),meta.files,'Restore backup tampered');
    }else{
      const test=readJSON(path.join(state,'projects',config.id,'static-latest.json'));
      if(test.status!=='PASS'||test.sourceHash!==p.sourceHash)throw Error('Exact staged bytes must have PASS static result');
    }
    const b=backupTree(target,path.join(state,'projects',config.id,'backups'),{resource:config.resource,target});
    assertIdle(await snapshot(config,{allowStoppedTarget:true}));
    const replaced=replaceTree(source,target,approvedServer,p.targetHash);
    json(path.join(dir,'applied.json'),{...replaced,backup:b,at:new Date().toISOString(),databaseChanged:false,restartExecuted:false});
    console.log('Files replaced. No restart or SQL executed. Backup: '+b);
  });
}
