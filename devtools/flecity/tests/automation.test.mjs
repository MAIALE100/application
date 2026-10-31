import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {eligible,isolatedJobs,runNode} from '../automation-control.mjs';
import {repo,state,inside,noLinks,readJSON,inventory} from '../core.mjs';

test('paused or blocked app does not disable independent ready apps',()=>{
  const policy={apps:{base:{automation:'ACTIVE',migration:'IMPORTED'},puriphoto:{automation:'PAUSED',migration:'PAUSED'},wave:{automation:'ACTIVE',migration:'BLOCKED'}}};
  assert(eligible('base',policy,{},100));assert(!eligible('puriphoto',policy,{},100));assert(!eligible('wave',policy,{},100));assert(!eligible('unknown',policy,{},100));
});
test('one app exception preserves subsequent app execution and isolated history',async()=>{
  const seen=[],history={};
  const results=await isolatedJobs([{id:'base'},{id:'link'}],async job=>{seen.push(job.id);if(job.id==='base')throw Error('fixture failure');return {status:'PASS'};},history,100);
  assert.deepEqual(seen,['base','link']);assert.deepEqual(results.map(r=>r.status),['FAIL','PASS']);assert.equal(history.base.failures,1);assert.equal(history.link.failures,0);
});
test('three consecutive failures back off one app for 24 hours without a retry loop',async()=>{
  const history={},policy={apps:{base:{automation:'ACTIVE',migration:'IMPORTED'},link:{automation:'ACTIVE',migration:'IMPORTED'}}};
  for(let n=0;n<3;n++)await isolatedJobs([{id:'base'}],async()=>({status:'FAIL'}),history,100);
  assert.equal(history.base.nextEligibleAt,100+86400000);assert(!eligible('base',policy,history,101));assert(eligible('link',policy,history,101));assert(eligible('base',policy,history,100+86400001));
});
test('bounded child timeout terminates its owned child and reports failure',{timeout:10000},async()=>{
  const started=Date.now();
  const r=await runNode(['-e','setInterval(()=>{},1000)'],{cwd:repo,timeout:100});assert.equal(r.timedOut,true);assert.equal(r.status,'FAIL');assert(Date.now()-started<5000);
});
test('production migration policy keeps puriphoto held and LINK/LOOP on one source',()=>{
  const p=readJSON(path.join(repo,'devtools/flecity/MIGRATION_STATE.json'));
  assert(!eligible('puriphoto',p,{}));assert.equal(p.apps.link.source,p.apps.loop.source);
  assert.deepEqual(inventory(path.join(repo,'puriphoto')),readJSON(path.join(repo,'devtools/flecity/reports/independent-20261031/puriphoto-protected.json')));
  const held=readJSON(path.join(repo,'devtools/flecity/reports/independent-20261031/puriphoto-diff.json'));
  assert.equal(held.rows.length,255);assert(held.rows.every(r=>r.held));
});

function probe(id,milliseconds){
  const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(repo,'devtools/flecity/automation-run.ps1'),'-GuardProbeId',id,'-GuardProbeMilliseconds',String(milliseconds)],{cwd:repo,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const done=new Promise((resolve,reject)=>{let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('error',reject);child.on('close',code=>resolve({code,output}));});return {child,done};
}
async function ready(file){for(let n=0;n<100;n++){if(fs.existsSync(file))return;await new Promise(r=>setTimeout(r,50));}throw Error('Probe failed to acquire mutex');}
function fixture(t){
  const id=crypto.randomBytes(16).toString('hex'),dir=inside(state,'automation/probes/'+id);noLinks(dir);
  t.after(()=>{noLinks(dir);fs.rmSync(dir,{recursive:true,force:true});});return {id,dir,lease:path.join(dir,'lease.json')};
}
test('Windows mutex rejects a simultaneous independent invocation',{skip:process.platform!=='win32',timeout:15000},async t=>{
  const f=fixture(t),first=probe(f.id,3000);t.after(()=>first.child.kill());await ready(f.lease);
  const second=await probe(f.id,1).done;assert.equal(second.code,75,second.output);assert.equal((await first.done).code,0);
});
test('Windows abandoned mutex recovers after owner crash and preserves old lease evidence',{skip:process.platform!=='win32',timeout:15000},async t=>{
  const f=fixture(t),first=probe(f.id,9000);t.after(()=>first.child.kill());await ready(f.lease);first.child.kill();await first.done;
  const second=await probe(f.id,1).done;assert.equal(second.code,0,second.output);assert(fs.readdirSync(f.dir).some(x=>x.startsWith('abandoned-')));assert(!fs.existsSync(f.lease));
});
