import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClientPlan} from '../server/client-plan.mjs';
test('new resources receive a disabled client plan and no implied test success',()=>{
  const p=buildClientPlan({id:'new_app',resource:'new_resource'});
  assert.equal(p.executionEnabled,false);assert.equal(p.status,'NOT_RUN');assert.deepEqual(p.scenarios,[]);
});
test('client plans preserve shared-resource and data effects without trusting scenario claims',()=>{
  const p=buildClientPlan({id:'link',resource:'flecity_games',sharedWith:['loop']},[
    {id:'open',dataEffect:'read-only',description:'Open app'},
    {id:'ranking',dataEffect:'persistent',description:'Ranking write'}]);
  assert.deepEqual(p.sharedWith,['loop']);
  for(const s of p.scenarios){assert.equal(s.status,'NOT_RUN');assert.equal(s.codeAuditVerified,false);}
  assert.throws(()=>buildClientPlan({},[{id:'x',description:'missing effect'}]));
  assert.throws(()=>buildClientPlan({},[{id:'x',dataEffect:'unknown',description:'x'},{id:'x',dataEffect:'unknown',description:'x'}]));
});
