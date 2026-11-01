import path from 'node:path';
import {approvedServer} from '../deployment.mjs';

export const packageStates=['REVIEW_ONLY','READY_FOR_TEST','DEPLOYED_TEST','FAILED'];
const resourcePaths={
  flecity_games:'txData/Qbox_D233FD.base/resources/flecity_games',
  wave:'txData/Qbox_D233FD.base/resources/[lb-phone]/wave'
};
const allowedFiles={flecity_games:['web/shared/screen.css'],wave:['client/main.lua']};
const sha256=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

// This is a separate TEST-SERVER gate. Production/other targets never inherit connected-player consent.
export function evaluateTestDeployment({plan,policy,runtime,backup,dbBackup,tests,restart,exclusive,now=Date.now()}){
  const blockers=[],warnings=[];
  const deny=(valid,code)=>{if(!valid)blockers.push(code);};
  const resource=plan?.resource,relative=resourcePaths[resource];
  deny(!!relative&&path.resolve(plan?.serverRoot||'')===path.resolve(approvedServer)&&
    path.resolve(plan?.target||'')===path.resolve(approvedServer,relative),'TEST_TARGET_MISMATCH');
  deny(policy?.serverRoot===approvedServer&&policy?.production==='never'&&policy?.allowConnectedPlayers===true&&
    policy?.interruptionApproved===true&&policy?.enabled===true&&
    policy?.resources?.includes(resource)===true&&
    JSON.stringify(policy?.allowedChanges?.[resource])===JSON.stringify(allowedFiles[resource]),
    'TEST_INTERRUPTION_NOT_APPROVED');
  deny(exclusive===true,'EXCLUSIVE_LEASE_REQUIRED');
  deny(Array.isArray(plan?.changed)&&plan.changed.length===1&&
    plan.changed[0]===allowedFiles[resource]?.[0]&&Array.isArray(plan.removed)&&plan.removed.length===0,
    'UNREVIEWED_FILE_DIFF');
  deny(sha256(plan?.beforeSha256)&&sha256(plan?.afterSha256)&&plan.beforeSha256!==plan.afterSha256,
    'FILE_HASH_UNVERIFIED');
  deny(runtime?.kind==='authenticated-test-runtime-v1'&&runtime?.profile===path.resolve(approvedServer,'txData/Qbox_D233FD.base')&&
    Number.isSafeInteger(runtime?.pid)&&runtime.pid>0&&runtime.healthy===true&&
    Number.isFinite(runtime?.checkedAtMs)&&runtime.checkedAtMs<=now&&now-runtime.checkedAtMs<=5000,
    'TEST_RUNTIME_IDENTITY_UNVERIFIED');
  deny(runtime?.resources?.[resource]==='started'&&runtime?.resources?.['lb-phone']==='started'&&
    runtime?.resources?.oxmysql==='started','DEPENDENCIES_NOT_STARTED');
  deny(backup?.resource===resource&&backup?.fullTree===true&&backup?.verified===true&&
    backup?.restoreVerified===true&&backup?.targetHash===plan?.targetHash&&
    Number.isFinite(backup?.createdAtMs)&&now-backup.createdAtMs<=15*60*1000,
    'FRESH_RESOURCE_BACKUP_REQUIRED');
  deny(dbBackup?.allDatabases===true&&dbBackup?.verified===true&&dbBackup?.restoreVerified===true&&
    Number.isFinite(dbBackup?.createdAtMs)&&now-dbBackup.createdAtMs<=15*60*1000,
    'FRESH_DB_BACKUP_REQUIRED');
  deny(Array.isArray(tests)&&tests.length>0&&tests.every(t=>t.status==='PASS'&&t.sourceHash===plan?.sourceHash&&
    t.testCodeHash===plan?.testCodeHash&&Number.isFinite(t.checkedAtMs)&&now-t.checkedAtMs<=12*60*60*1000),
    'EXACT_TEST_EVIDENCE_REQUIRED');
  deny(restart?.kind==='authenticated-resource-command'&&restart?.verified===true&&
    restart?.resource===resource&&restart?.serverRoot===approvedServer,'AUTHORIZED_TARGET_RESTART_REQUIRED');
  if(Number.isInteger(runtime?.players)&&runtime.players>0)warnings.push('CONNECTED_TESTERS_MAY_BE_INTERRUPTED');
  if(runtime?.publicPlayersStatus==='UNKNOWN')warnings.push('PUBLIC_PLAYER_COUNT_UNAVAILABLE');
  return {status:blockers.length?'REVIEW_ONLY':'READY_FOR_TEST',allowed:blockers.length===0,blockers,warnings};
}
export function deploymentState(previous,{verification,applied=false,healthPass=false}={}){
  if(!packageStates.includes(previous))throw Error('Invalid package state');
  if(verification?.status==='FAILED')return 'FAILED';
  if(applied)return previous==='READY_FOR_TEST'&&healthPass?'DEPLOYED_TEST':'FAILED';
  return verification?.allowed===true?'READY_FOR_TEST':'REVIEW_ONLY';
}
