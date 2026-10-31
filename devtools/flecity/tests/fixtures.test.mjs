import test from 'node:test';import assert from 'node:assert/strict';
import {FixtureScope,assertProtectedUnchanged} from '../fixtures/scope.mjs';
import {assertFixtureApproval} from '../fixtures/plan.mjs';
test('database fixture execution refuses missing, stale and unrelated approval before DB startup',()=>{
 const p={id:'test',kind:'disposable-db-only'};
 for(const receipt of [null,{userApproved:false},{userApproved:true,planId:'other'},{userApproved:true,planId:'test',planHash:'stale'}])assert.throws(()=>assertFixtureApproval(p,receipt));
});
const workspace='flecity_base_workspaces',stock='flecity_base_stock_items';
function setup(){const f=new FixtureScope('base',{[workspace]:{'1':{id:1,owner_citizenid:'CANARY',name:'protected'}}});f.insert(workspace,100,{id:100,owner_citizenid:f.owner,name:f.label});return f;}
test('exact run ownership blocks existing rows, foreign identity, cross-parent writes and collisions',()=>{
 const f=setup();assert.throws(()=>f.update(workspace,1,{name:'changed'}));
 assert.throws(()=>f.insert(workspace,1,{id:1,owner_citizenid:f.owner}));
 assert.throws(()=>f.insert(workspace,101,{id:101,owner_citizenid:'OTHER'}));
 assert.throws(()=>f.insert(stock,200,{id:200,workspace_id:1,created_by:f.owner}));
 f.insert(stock,200,{id:200,workspace_id:100,created_by:f.owner,quantity:10});
 assert.throws(()=>f.update(stock,200,{workspace_id:1}));assert.throws(()=>f.update(stock,200,{id:201}));
 assert.throws(()=>f.insert('players',1,{}));assert.throws(()=>f.update(workspace,100,{owner_citizenid:'OTHER'}));
 assert.throws(()=>f.insert(workspace,'__proto__',{owner_citizenid:f.owner}));
 assert.throws(()=>f.insert(workspace,102,{id:1,owner_citizenid:f.owner}));
});
test('failed multi-row writes roll back the fixture and its ownership journal atomically',()=>{
 const f=setup(),before=f.receipt();assert.throws(()=>f.transaction(()=>{
  f.update(workspace,100,{name:'partial'});f.insert(stock,200,{workspace_id:1,created_by:f.owner});
 }));assert.deepEqual(f.receipt(),before);
});
test('cleanup uses exact reviewed rows, detects stale/broadened plans and preserves canaries',()=>{
 const f=setup(),p=f.cleanupPlan();f.update(workspace,100,{name:'new'});assert.throws(()=>f.cleanup(p));
 const fresh=f.cleanupPlan();assert.throws(()=>f.cleanup({...fresh,deleteExact:[...fresh.deleteExact,{table:workspace,id:'1'}]}));
 f.cleanup(fresh);assert.equal(f.read(workspace,1).name,'protected');assert.equal(f.read(workspace,100),null);
 assert.throws(()=>f.update(workspace,100,{name:'again'}));
});
test('snapshot review detects protected edits/deletions, prefix spoofing and unaudited new rows',()=>{
 const f=setup();for(const mutation of [r=>r.rows[workspace]['1'].name='bad',r=>delete r.rows[workspace]['1'],r=>r.rows[workspace]['999']={name:f.label}]){
   const r=f.receipt();mutation(r);assert.throws(()=>assertProtectedUnchanged(r));
 }
 assertProtectedUnchanged(f.receipt());
 const other=setup();assert.notEqual(other.owner,f.owner);assert.throws(()=>other.insert(workspace,102,{owner_citizenid:f.owner}));
});
