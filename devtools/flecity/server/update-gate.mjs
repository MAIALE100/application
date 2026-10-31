import crypto from 'node:crypto';
import path from 'node:path';
import {approvedServer} from '../deployment.mjs';
import {inside,redact} from '../core.mjs';

export const defaultRequiredSuites=['static','db','nui','visual','game','virtual-multiplayer'];
export function defaultUpdatePolicy(){return {version:1,enabled:false,initialApprovalRequired:true,resources:{},requiredSuites:defaultRequiredSuites};}
function testTarget(plan,enrolled){
  try{return path.resolve(plan.serverRoot)===path.resolve(approvedServer)&&plan.serverType==='test'&&path.basename(plan.target)===plan.resource&&
    !!inside(inside(approvedServer,plan.resourcesRoot),path.relative(inside(approvedServer,plan.resourcesRoot),plan.target))&&path.basename(plan.resourcesRoot)==='resources'&&enrolled?.target===plan.target;}catch{return false;}
}

// Public HTTP counts are diagnostic only. Native proof must be fresh and tied to this challenge.
export function nativeIdle(proof,challenge,now=Date.now()){
  return proof?.kind==='flecity-native-observation-v1'&&proof.requestId===challenge&&
    typeof proof.instance==='string'&&proof.instance.length>=8&&proof.serverType==='test'&&
    proof.healthy===true&&Number.isSafeInteger(proof.players)&&proof.players===0&&
    Number.isFinite(proof.observedAtMs)&&proof.observedAtMs<=now&&now-proof.observedAtMs<=2000;
}
export function evaluateUpdate({plan,policy,proof,challenge,tests,backup,exclusive,registeredApps,now=Date.now()}){
  const blockers=[];const deny=(ok,why)=>{if(!ok)blockers.push(why);};
  const enrolled=policy?.resources?.[plan?.resource];
  deny(policy?.enabled===true,'AUTO_UPDATE_DISABLED');
  deny(enrolled?.approved===true&&enrolled.initialUpdateApproved===true&&typeof enrolled.approvalId==='string'&&enrolled.approvalId.length>0,'INITIAL_RESOURCE_APPROVAL_REQUIRED');
  deny(nativeIdle(proof,challenge,now),'NATIVE_ZERO_PLAYERS_UNVERIFIED');
  deny(exclusive===true,'EXCLUSIVE_LEASE_REQUIRED');
  deny(testTarget(plan,enrolled),'TEST_TARGET_NOT_ENROLLED');
  const impacted=[plan?.project,...(plan?.sharedWith||[])].sort();
  const registryImpact=Array.isArray(registeredApps)?registeredApps.filter(p=>p.resource===plan?.resource).map(p=>p.id).sort():null;
  deny(registryImpact?.length>0&&JSON.stringify(registryImpact)===JSON.stringify(impacted),'REGISTRY_IMPACT_UNVERIFIED');
  deny(Array.isArray(enrolled?.apps)&&JSON.stringify([...new Set(enrolled.apps)].sort())===JSON.stringify(impacted),'SHARED_APP_IMPACT_UNREVIEWED');
  deny(Array.isArray(plan?.dependencies)&&Array.isArray(enrolled?.dependencies)&&JSON.stringify([...plan.dependencies].sort())===JSON.stringify([...enrolled.dependencies].sort())&&
    plan.dependencies.every(name=>proof?.resources?.[name]==='started'),'DEPENDENCY_IMPACT_UNVERIFIED');
  deny(plan?.runtimeAudit==='PASS'&&plan?.existingDataWrites===false&&plan?.dbMigration===false&&enrolled?.runtimeAuditHash===plan?.sourceHash,'EXISTING_PLAYER_DATA_SAFETY_UNVERIFIED');
  deny(plan?.removed?.length===0&&plan?.sourceComplete===true,'INCOMPLETE_SOURCE_OR_REMOVALS');
  deny(/^[a-f0-9]{64}$/.test(plan?.sourceHash||'')&&/^[a-f0-9]{64}$/.test(plan?.targetHash||''),'PLAN_HASHES_REQUIRED');
  for(const id of impacted){
    const suites=enrolled?.requiredSuites?.[id];
    deny(Array.isArray(suites)&&defaultRequiredSuites.every(s=>suites.includes(s)),'MANDATORY_SUITES_UNREGISTERED:'+id);
    for(const suite of Array.isArray(suites)?suites:[]){
      const r=tests?.find(t=>t.app===id&&t.suite===suite);
      deny(r?.status==='PASS'&&r.sourceHash===plan.sourceHash&&Array.isArray(r.checks)&&r.checks.length>0&&r.checks.every(c=>c.status==='PASS')&&
        Number.isFinite(r.checkedAtMs)&&r.checkedAtMs<=now&&now-r.checkedAtMs<=12*3600000,'REQUIRED_TEST_NOT_PASS:'+id+':'+suite);
    }
  }
  deny(backup?.verified===true&&backup.targetHash===plan?.targetHash&&backup.resource===plan?.resource&&backup.restoreVerified===true&&typeof backup.id==='string','BACKUP_OR_RECOVERY_UNVERIFIED');
  deny(enrolled?.restartResource===plan?.resource&&proof?.resources?.[plan?.resource]==='started','TARGET_RESTART_SCOPE_UNVERIFIED');
  return {allowed:blockers.length===0,status:blockers.length?'BLOCKED':'PASS',blockers,impactedApps:impacted};
}

// No production adapter is supplied by this module. Real mutation remains disabled pending review.
// The backend must own the global mutex for this complete transaction and preserve its journal.
export async function guardedUpdate(input,backend){
  const journal={resource:input.plan.resource,phase:'PENDING',updated:false,restarted:false,recovery:'NOT_REQUIRED',events:[]};
  const record=async phase=>{journal.phase=phase;journal.events.push(phase);await backend.saveJournal(structuredClone(journal));};
  if(typeof backend.withExclusive!=='function')return {...journal,status:'BLOCKED',blockers:['EXCLUSIVE_LEASE_REQUIRED']};
  return backend.withExclusive(async()=>{
    let instance;
    async function gate(stage,backup){
      const challenge=crypto.randomUUID(),proof=await backend.observe(challenge,stage);
      const result=evaluateUpdate({...input,backup,proof,challenge,exclusive:true,now:backend.now?.()??Date.now()});
      if(instance&&proof?.instance!==instance){result.allowed=false;result.blockers.push('SERVER_INSTANCE_CHANGED');}
      if(!result.allowed)throw Error(result.blockers.join('; '));
      instance=proof.instance;journal.instance=instance;return proof;
    }
    try{
      await record('PREFLIGHT');
      // Backup verification is an independent prerequisite; never infer it from zero players.
      const backup=await backend.verifyBackup(input.backup);
      journal.backupId=backup?.id;
      await gate('before-update',backup);await record('READY');
      // The mutation adapter must recheck native zero and the same instance at its actual commit.
      journal.writeAttempted=true;journal.recovery='POSSIBLE_PARTIAL_WRITE';await record('COMMITTING');
      await backend.replaceIfIdle({plan:input.plan,instance,verify:()=>gate('at-file-commit',backup)});
      journal.updated=true;journal.recovery='PENDING';await record('FILES_REPLACED');
      await gate('before-restart',backup);
      const ack=await backend.restartIfIdle({resource:input.plan.resource,instance,verify:()=>gate('at-restart-dispatch',backup)});
      if(ack?.resource!==input.plan.resource||ack?.executed!==true||ack?.nativeZeroVerified!==true||ack?.instance!==instance)throw Error('Native guarded restart acknowledgement missing');
      journal.restarted=true;await record('RESTARTED');
      if(await backend.verifyHealth()!==true)throw Error('Post-update health unverified');
      journal.recovery='NOT_REQUIRED';await record('COMPLETE');return {...journal,status:'PASS'};
    }catch(e){
      // A player joining after file replacement forbids further writes/restarts, including rollback.
      if(journal.writeAttempted)journal.recovery='DEFERRED_UNTIL_SAFE_REVIEW';
      await record('HELD');return {...journal,status:'BLOCKED',blockers:[redact(e.message)]};
    }
  });
}

export async function guardedRecovery(input,backend){
  return backend.withExclusive(async()=>{
    try{
      if(input.journal?.resource!==input.plan.resource||input.journal?.updated!==true||input.journal?.recovery!=='DEFERRED_UNTIL_SAFE_REVIEW'||input.journal.instance!==input.instance)throw Error('Exact pending recovery journal required');
      const enrolled=input.policy?.resources?.[input.plan.resource];
      if(input.policy?.enabled!==true||enrolled?.approved!==true||enrolled.initialUpdateApproved!==true||!testTarget(input.plan,enrolled))throw Error('Recovery target approval missing');
      const backup=await backend.verifyBackup(input.backup);
      const verify=async()=>{
        const challenge=crypto.randomUUID(),proof=await backend.observe(challenge,'recovery');
        if(!nativeIdle(proof,challenge,backend.now?.()??Date.now())||proof.resources?.[input.plan.resource]!=='stopped'||proof.instance!==input.instance)throw Error('Recovery requires fresh native zero, same instance, and stopped target');
        if(backup?.verified!==true||backup.restoreVerified!==true||backup.targetHash!==input.plan.targetHash||backup.resource!==input.plan.resource||backup.id!==input.journal.backupId)throw Error('Recovery backup mismatch');
      };
      await verify();await backend.restoreIfIdle({plan:input.plan,backup,verify});
      await backend.saveJournal({...input.journal,phase:'RECOVERED',recovery:'COMPLETE',restarted:false});
      return {status:'PASS',phase:'RECOVERED',restarted:false};
    }catch(e){return {status:'BLOCKED',phase:'RECOVERY_HELD',reason:redact(e.message)};}
  });
}
