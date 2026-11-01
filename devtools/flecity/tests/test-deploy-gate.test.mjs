import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {approvedServer} from '../deployment.mjs';
import {evaluateTestDeployment,deploymentState} from '../server/test-deploy-gate.mjs';

function fixture(players=0){
  const now=500000,resource='flecity_games',hash='a'.repeat(64),source='b'.repeat(64),code='c'.repeat(64);
  const plan={resource,serverRoot:approvedServer,target:path.resolve(approvedServer,'txData/Qbox_D233FD.base/resources/flecity_games'),changed:['web/shared/screen.css'],removed:[],beforeSha256:hash,afterSha256:source,targetHash:hash,sourceHash:source,testCodeHash:code};
  return {plan,policy:{serverRoot:approvedServer,production:'never',enabled:true,allowConnectedPlayers:true,interruptionApproved:true,
    resources:['flecity_games','wave'],allowedChanges:{flecity_games:['web/shared/screen.css'],wave:['client/main.lua']}},
    runtime:{kind:'authenticated-test-runtime-v1',profile:path.resolve(approvedServer,'txData/Qbox_D233FD.base'),pid:123,healthy:true,checkedAtMs:now,players,resources:{flecity_games:'started','lb-phone':'started',oxmysql:'started'}},
    backup:{resource,fullTree:true,verified:true,restoreVerified:true,targetHash:hash,createdAtMs:now},
    dbBackup:{allDatabases:true,verified:true,restoreVerified:true,createdAtMs:now},
    tests:[{status:'PASS',sourceHash:source,testCodeHash:code,checkedAtMs:now}],
    restart:{kind:'authenticated-resource-command',verified:true,resource,serverRoot:approvedServer},exclusive:true,now};
}
test('test-only connected-player consent permits 0, occupied and unknown public count with warning',()=>{
  for(const count of [0,2,null]){
    const input=fixture(count);if(count===null)input.runtime.publicPlayersStatus='UNKNOWN';
    const r=evaluateTestDeployment(input);assert.equal(r.status,'READY_FOR_TEST');
    if(count===2)assert(r.warnings.includes('CONNECTED_TESTERS_MAY_BE_INTERRUPTED'));
  }
});
for(const change of ['production','consent','backup','db','restart','runtime','diff','tests','mutex'])test('test deployment denies '+change,()=>{
  const f=fixture();
  if(change==='production')f.plan.serverRoot='D:/Production';
  if(change==='consent')f.policy.interruptionApproved=false;
  if(change==='backup')f.backup.verified=false;
  if(change==='db')f.dbBackup.restoreVerified=false;
  if(change==='restart')f.restart.verified=false;
  if(change==='runtime')f.runtime.kind='public-http';
  if(change==='diff')f.plan.changed=['server/main.lua'];
  if(change==='tests')f.tests[0].testCodeHash='d'.repeat(64);
  if(change==='mutex')f.exclusive=false;
  assert.equal(evaluateTestDeployment(f).status,'REVIEW_ONLY');
});
test('package state requires verified gate, actual application and health',()=>{
  const ready=evaluateTestDeployment(fixture());
  assert.equal(deploymentState('REVIEW_ONLY',{verification:ready}),'READY_FOR_TEST');
  assert.equal(deploymentState('READY_FOR_TEST',{verification:ready,applied:true,healthPass:true}),'DEPLOYED_TEST');
  assert.equal(deploymentState('READY_FOR_TEST',{verification:ready,applied:true,healthPass:false}),'FAILED');
});
