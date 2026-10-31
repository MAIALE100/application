import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {defaultUpdatePolicy,defaultRequiredSuites,evaluateUpdate,guardedUpdate,guardedRecovery,nativeIdle} from '../server/update-gate.mjs';
import {observePublicState,localThenObservation} from '../server/state-observer.mjs';
import {validateCounts} from '../server/connection.mjs';
import {backupTree,replaceTree,approvedServer} from '../deployment.mjs';
import {inventory,sha,readJSON} from '../core.mjs';
import {scaffold} from '../scaffold.mjs';

function setup(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-gate-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const target=path.join(root,'resource'),source=path.join(root,'candidate');fs.mkdirSync(target);fs.mkdirSync(source);
  fs.writeFileSync(path.join(target,'main.lua'),'-- original\n');fs.writeFileSync(path.join(source,'main.lua'),'-- candidate\n');
  const oldHash=sha(JSON.stringify(inventory(target,true))),newHash=sha(JSON.stringify(inventory(source,true)));
  const b=backupTree(target,path.join(root,'backups'),{resource:'flecity_games'}),meta=readJSON(path.join(b,'backup.json'));
  const plan={project:'link',resource:'flecity_games',sharedWith:['loop'],serverType:'test',serverRoot:approvedServer,resourcesRoot:'txData/Qbox_D233FD.base/resources',target:path.join(approvedServer,'txData/Qbox_D233FD.base/resources/flecity_games'),dependencies:['lb-phone','oxmysql'],sourceHash:newHash,targetHash:oldHash,removed:[],sourceComplete:true,runtimeAudit:'PASS',existingDataWrites:false,dbMigration:false};
  const policy={...defaultUpdatePolicy(),enabled:true,resources:{flecity_games:{approved:true,initialUpdateApproved:true,approvalId:'fixture-only-approval',target:plan.target,apps:['link','loop'],dependencies:plan.dependencies,restartResource:'flecity_games',runtimeAuditHash:newHash,requiredSuites:{link:[...defaultRequiredSuites],loop:[...defaultRequiredSuites]}}}};
  const now=10000,instance='fixture-instance';
  const tests=['link','loop'].flatMap(app=>defaultRequiredSuites.map(suite=>({app,suite,status:'PASS',sourceHash:newHash,checkedAtMs:now,checks:[{status:'PASS'}]})));
  const backup={id:meta.id,verified:true,restoreVerified:true,resource:plan.resource,targetHash:oldHash};
  const proof={kind:'flecity-native-observation-v1',requestId:'challenge',instance,serverType:'test',healthy:true,players:0,observedAtMs:now,resources:{flecity_games:'started','lb-phone':'started',oxmysql:'started'}};
  const input={plan,policy,tests,backup,registeredApps:[{id:'link',resource:'flecity_games'},{id:'loop',resource:'flecity_games'}]};let writes=0,restarts=0,restores=0,held=false;const journals=[];
  const backend={now:()=>now,observe:async challenge=>({...structuredClone(proof),requestId:challenge}),
    async withExclusive(fn){if(held)throw Error('BUSY');held=true;try{return await fn();}finally{held=false;}},
    saveJournal:async j=>journals.push(j),verifyBackup:async()=>({...backup,verified:sha(JSON.stringify(inventory(path.join(b,'resource'),true)))===oldHash}),
    replaceIfIdle:async({verify})=>{await verify();replaceTree(source,target,root,oldHash);writes++;},
    restartIfIdle:async({resource,verify})=>{await verify();restarts++;return {resource,executed:true,nativeZeroVerified:true,instance};},verifyHealth:async()=>true,
    restoreIfIdle:async({verify})=>{await verify();replaceTree(path.join(b,'resource'),target,root,newHash);restores++;}};
  return {input,backend,proof,now,instance,target,b,journals,effects:()=>({writes,restarts,restores}),gate:()=>evaluateUpdate({...input,proof,challenge:'challenge',exclusive:true,now})};
}
test('all eight gates pass only for the approved exact shared resource and bytes',async t=>{
  const f=setup(t);assert(f.gate().allowed);const r=await guardedUpdate(f.input,f.backend);assert.equal(r.status,'PASS');assert.deepEqual(f.effects(),{writes:1,restarts:1,restores:0});assert.equal(fs.readFileSync(path.join(f.target,'main.lua'),'utf8'),'-- candidate\n');
});
for(const scenario of ['one-player','unknown-count','stopped','stale','future','public-only','wrong-challenge','wrong-instance','dependency-stopped'])test('holds before any mutation: '+scenario,async t=>{
  const f=setup(t);
  if(scenario==='one-player')f.proof.players=1;
  if(scenario==='unknown-count')f.proof.players=null;
  if(scenario==='stopped')f.proof.healthy=false;
  if(scenario==='stale')f.proof.observedAtMs=1;
  if(scenario==='future')f.proof.observedAtMs=f.now+1;
  if(scenario==='public-only')f.proof.kind='public-http';
  if(scenario==='wrong-instance')f.proof.instance='';
  if(scenario==='dependency-stopped')f.proof.resources.oxmysql='stopped';
  if(scenario==='wrong-challenge')f.backend.observe=async()=>({...f.proof,requestId:'old-request'});
  const r=await guardedUpdate(f.input,f.backend);assert.equal(r.status,'BLOCKED');assert.deepEqual(f.effects(),{writes:0,restarts:0,restores:0});
});
test('transport failure is unknown and never causes writes or server startup',async t=>{
  const f=setup(t);f.backend.observe=async()=>{throw Error('ECONNREFUSED');};assert.equal((await guardedUpdate(f.input,f.backend)).status,'BLOCKED');assert.equal(f.effects().writes,0);
  const r=await observePublicState(async()=>{throw Error('ECONNREFUSED');});assert.equal(r.status,'UNREACHABLE');assert.equal(r.players,null);
});
test('native proof never treats null, false, text, negative, or fractional counts as zero',()=>{
  for(const clients of [null,false,'',undefined,{},-1,0.1])assert.throws(()=>validateCounts({clients},[]));
  for(const players of [null,false,'0',NaN,-1,0.1])assert(!nativeIdle({kind:'flecity-native-observation-v1',requestId:'id',instance:'instance1',serverType:'test',healthy:true,players,observedAtMs:1},'id',1));
});
for(const condition of ['approval','tests','test-check','test-hash','suite-policy','backup','restore','shared-app','data-audit','removal','production','mutex'])test('refuses missing prerequisite: '+condition,t=>{
  const f=setup(t);
  if(condition==='approval')f.input.policy.resources.flecity_games.initialUpdateApproved=false;
  if(condition==='tests')f.input.tests.pop();
  if(condition==='test-check')f.input.tests[0].checks[0].status='NOT_RUN';
  if(condition==='test-hash')f.input.tests[0].sourceHash='c'.repeat(64);
  if(condition==='suite-policy')f.input.policy.resources.flecity_games.requiredSuites.link=['static'];
  if(condition==='backup')f.input.backup.verified=false;
  if(condition==='restore')f.input.backup.restoreVerified=false;
  if(condition==='shared-app')f.input.policy.resources.flecity_games.apps=['link'];
  if(condition==='data-audit')f.input.plan.existingDataWrites=true;
  if(condition==='removal')f.input.plan.removed=['player-photos'];
  if(condition==='production')f.input.plan.serverRoot='D:/Production';
  const r=evaluateUpdate({...f.input,proof:f.proof,challenge:'challenge',exclusive:condition!=='mutex',now:f.now});assert(!r.allowed);
});
test('join at actual file commit aborts without replacing files',async t=>{
  const f=setup(t);const observe=f.backend.observe;f.backend.observe=async(id,stage)=>({...await observe(id),players:stage==='at-file-commit'?1:0});
  const r=await guardedUpdate(f.input,f.backend);assert.equal(r.status,'BLOCKED');assert.equal(f.effects().writes,0);assert.equal(f.effects().restarts,0);
});
test('join after replacement defers restart and rollback; exact backup recovery requires fresh idle stopped target',async t=>{
  const f=setup(t),observe=f.backend.observe;
  f.backend.observe=async(id,stage)=>({...await observe(id),players:stage==='before-restart'?1:0});
  const r=await guardedUpdate(f.input,f.backend);assert.equal(r.recovery,'DEFERRED_UNTIL_SAFE_REVIEW');assert.deepEqual(f.effects(),{writes:1,restarts:0,restores:0});
  const recovery={...f.input,journal:r,instance:f.instance};
  f.backend.observe=async id=>({...await observe(id),players:1});assert.equal((await guardedRecovery(recovery,f.backend)).status,'BLOCKED');
  f.backend.observe=observe;assert.equal((await guardedRecovery(recovery,f.backend)).status,'BLOCKED'); // still started
  f.backend.observe=async id=>{const p=await observe(id);p.resources.flecity_games='stopped';return p;};
  assert.equal((await guardedRecovery(recovery,f.backend)).status,'PASS');assert.deepEqual(f.effects(),{writes:1,restarts:0,restores:1});assert.equal(fs.readFileSync(path.join(f.target,'main.lua'),'utf8'),'-- original\n');
});
test('join immediately before native restart dispatch prevents restart',async t=>{
  const f=setup(t),observe=f.backend.observe;f.backend.observe=async(id,stage)=>({...await observe(id),players:stage==='at-restart-dispatch'?1:0});
  const r=await guardedUpdate(f.input,f.backend);assert.equal(r.status,'BLOCKED');assert.equal(f.effects().restarts,0);
});
for(const failure of ['stop','transport-failure'])test('server loss after files changed defers restart and recovery: '+failure,async t=>{
  const f=setup(t),observe=f.backend.observe;
  f.backend.observe=async(id,stage)=>{if(stage==='before-restart'&&failure==='transport-failure')throw Error('ECONNREFUSED');const p=await observe(id);if(stage==='before-restart')p.healthy=false;return p;};
  const r=await guardedUpdate(f.input,f.backend);assert.equal(r.status,'BLOCKED');assert.equal(r.recovery,'DEFERRED_UNTIL_SAFE_REVIEW');assert.deepEqual(f.effects(),{writes:1,restarts:0,restores:0});
});
test('registry detects an omitted shared app even if the plan and policy both omit it',t=>{
  const f=setup(t);f.input.plan.sharedWith=[];f.input.policy.resources.flecity_games.apps=['link'];assert(f.gate().blockers.includes('REGISTRY_IMPACT_UNVERIFIED'));
});
test('server instance change, bad backup, or concurrent operation fails closed',async t=>{
  const f=setup(t),observe=f.backend.observe;f.backend.observe=async(id,stage)=>({...await observe(id),instance:stage==='at-file-commit'?'new-instance':f.instance});
  assert.equal((await guardedUpdate(f.input,f.backend)).status,'BLOCKED');assert.equal(f.effects().writes,0);
  f.backend.observe=observe;fs.writeFileSync(path.join(f.b,'resource/main.lua'),'tampered');assert.equal((await guardedUpdate(f.input,f.backend)).status,'BLOCKED');assert.equal(f.effects().writes,0);
  f.backend.withExclusive=async()=>{throw Error('BUSY');};await assert.rejects(guardedUpdate(f.input,f.backend),/BUSY/);
});
test('new resources default to disabled, and public counts cannot authorize updates',async()=>{
  assert.equal(defaultUpdatePolicy().enabled,false);assert.deepEqual(defaultUpdatePolicy().resources,{});
  const r=await observePublicState(async e=>e==='info.json'?{server:'fixture',resources:[]}:e==='dynamic.json'?{clients:0}:[]);
  assert.equal(r.status,'RUNNING');assert.equal(r.players,0);assert.equal(r.authoritative,false);
});
test('newly scaffolded apps inherit unapproved updates and mandatory test definitions',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-enroll-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const registry=path.join(root,'devtools/flecity/projects');
  scaffold('fixture_app','resource',root,registry);
  const config=readJSON(path.join(registry,'fixture_app.json'));
  assert.equal(config.autoUpdate.enabled,false);assert.equal(config.autoUpdate.initialApprovalRequired,true);assert.deepEqual(config.autoUpdate.resources,{});assert(config.autoUpdate.requiredSuites.includes('visual'));
});
for(const state of ['idle','occupied','stopped','fetch-failed'])test('local work always finishes independently before observing server: '+state,async()=>{
  const order=[];
  const r=await localThenObservation(async()=>{order.push('local');return [{id:'base',status:'PASS'},{id:'link',status:'PASS'}];},async()=>{
    order.push('server');if(state==='fetch-failed')throw Error('Unavailable');return {status:state==='stopped'?'UNREACHABLE':'RUNNING',players:state==='occupied'?2:state==='idle'?0:null};
  });
  assert.deepEqual(order,['local','server']);assert(r.results.every(r=>r.status==='PASS'));if(state==='fetch-failed')assert.equal(r.serverObservation.status,'UNKNOWN');
});
