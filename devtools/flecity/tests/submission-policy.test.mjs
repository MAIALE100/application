import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {command,sha,inventory} from '../core.mjs';
import {submissionTasks,submissionDecision,submissionGates} from '../submission-priority.mjs';
import {prepareLocalChange,applyLocalChange,rollbackLocalChange,localRegressionGate,finishLocalChange} from '../local-change.mjs';
test('submission order isolates maintenance and held apps; missing live evidence cannot become a candidate',()=>{
 const policy={apps:{flepri:{track:'maintenance',automation:'ACTIVE'},photo_diary:{track:'hold',automation:'PAUSED'}}};
 assert.deepEqual(submissionTasks(policy).map(t=>t.id),['toolkit','loop','base','link','wave','flepri']);
 const good={track:'submission',auditedSourceHash:'hash',gates:Object.fromEntries(submissionGates.map(g=>[g,'PASS']))};
 assert.equal(submissionDecision(good,'hash').status,'SUBMISSION_CANDIDATE');assert.equal(submissionDecision(good,'changed').status,'NOT_READY');
 assert.equal(submissionDecision({...good,gates:{...good.gates,liveFiveM:'NOT_RUN'}},'hash').status,'NOT_READY');assert.equal(submissionDecision(good,'hash').mayPublish,false);
});
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-local-change-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'app'));fs.writeFileSync(path.join(root,'app/main.js'),'// original\n');
 const git=args=>{const r=command('git',args,{cwd:root});assert(r.ok,r.output);};
 git(['init']);git(['checkout','-b','codex/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@invalid']);git(['add','--','app/main.js']);git(['-c','core.hooksPath=NUL','commit','-m','fixture']);
 fs.mkdirSync(path.join(root,'.flecity-dev/proposals'),{recursive:true});
 const policy={mode:'submission-priority',apps:{loop:{track:'submission',automation:'ACTIVE',source:'app',sharedWith:['link']},flepri:{track:'maintenance',automation:'ACTIVE',source:'app'}}};
 const p=path.join(root,'.flecity-dev/proposals/fixture.json');
 const proposal={app:'loop',reason:'fixture regression',changes:[{path:'main.js',baseSha256:sha('// original\n'),content:'// fixed\n'}]};
 const save=()=>fs.writeFileSync(p,JSON.stringify(proposal));save();return {root,policy,p,proposal,save,file:path.join(root,'app/main.js')};
}
test('proposal applies only exact clean bytes and rollback restores only its own changes',t=>{
 const f=fixture(t),c=prepareLocalChange(f.p,f.policy,f.root);applyLocalChange(c);assert.equal(fs.readFileSync(f.file,'utf8'),'// fixed\n');rollbackLocalChange(c);assert.equal(fs.readFileSync(f.file,'utf8'),'// original\n');
});
test('maintenance, path escape, source mismatch and pre-existing edits refuse proposals',t=>{
 const f=fixture(t);f.proposal.app='flepri';f.save();assert.throws(()=>prepareLocalChange(f.p,f.policy,f.root));
 f.proposal.app='loop';f.proposal.changes[0].path='../other.js';f.save();assert.throws(()=>prepareLocalChange(f.p,f.policy,f.root));
 f.proposal.changes[0].path='main.js';f.proposal.changes[0].baseSha256='wrong';f.save();assert.throws(()=>prepareLocalChange(f.p,f.policy,f.root));
 f.proposal.changes[0].baseSha256=sha('// original\n');f.save();fs.writeFileSync(f.file,'// user edit\n');assert.throws(()=>prepareLocalChange(f.p,f.policy,f.root));
});
test('rollback refuses intervening user edits; failed regression cannot commit',t=>{
 const f=fixture(t),c=applyLocalChange(prepareLocalChange(f.p,f.policy,f.root));fs.writeFileSync(f.file,'// concurrent user edit\n');
 assert.throws(()=>rollbackLocalChange(c));assert.equal(finishLocalChange(c,[]).status,'REVIEW_REQUIRED');assert.equal(fs.readFileSync(f.file,'utf8'),'// concurrent user edit\n');
});
test('shared-app regressions are mandatory but an unrelated failure does not stop a verified app',()=>{
 const result=(id,suites)=>({id,status:'PASS',sourceUnchanged:true,suites:suites.map(suite=>({suite,status:'PASS'}))});
 const rows=[result('toolkit',[]),result('base',['static','nui']),result('loop',['static','nui']),result('link',['static','nui','game','virtual-multiplayer']),{id:'wave',status:'FAIL'}];
 assert(localRegressionGate('base',[],rows));assert(localRegressionGate('loop',['link'],rows));rows[3].suites[0].status='FAIL';assert(!localRegressionGate('loop',['link'],rows));
});
test('verified proposal saves app-scoped Git and commits only selected files',t=>{
 const f=fixture(t),c=applyLocalChange(prepareLocalChange(f.p,f.policy,f.root));
 fs.writeFileSync(path.join(f.root,'unrelated.txt'),'must remain untracked');
 const sourceHash=sha(JSON.stringify(inventory(path.join(f.root,'app'))));
 const results=[{id:'toolkit',status:'PASS'},...['loop','link'].map(id=>({id,sourceHash,sourceUnchanged:true,suites:['static','nui','game','virtual-multiplayer'].map(suite=>({suite,status:'PASS'}))}))];
 const r=finishLocalChange(c,results);assert.equal(r.status,'COMMITTED',JSON.stringify(r));assert(r.appCommits.loop&&r.appCommits.link);
 const diff=command('git',['show','--pretty=format:','--name-only','HEAD'],{cwd:f.root});assert.equal(diff.output.trim(),'app/main.js');
});
