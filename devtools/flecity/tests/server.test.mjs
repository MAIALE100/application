import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {tool,luaRuntime,luaCompiler,command} from '../core.mjs';
import {validateCounts,assertIdle,dependencies,getEndpoint} from '../server/connection.mjs';
import {parseSelftest} from '../server/bridge-client.mjs';
import {assertBridgeApproval} from '../server/approval.mjs';
test('both player endpoints must agree on zero',()=>{
  const now=Date.now();
  assert.doesNotThrow(()=>assertIdle({healthy:true,testers:validateCounts({clients:0},[]),checkedAtMs:now},now));
  for(const [dynamic,players]of [[{clients:1},[{}]],[{clients:0},[{}]],[{clients:1},[]]])
    assert.throws(()=>assertIdle({healthy:true,testers:validateCounts(dynamic,players),checkedAtMs:now},now));
  assert.throws(()=>validateCounts({},[]));assert.throws(()=>validateCounts({clients:0},{}));
});
test('stale and uncertain observations hold updates',()=>{
  const testers={idle:true,consistent:true};
  assert.throws(()=>assertIdle({healthy:true,testers,checkedAtMs:0},3000));
  assert.throws(()=>assertIdle({healthy:false,testers,checkedAtMs:1000},1000));
  assert.throws(()=>assertIdle({healthy:true,testers,checkedAtMs:2000},1000));
});
test('only fixed read-only endpoints can be called',async()=>{
  for(const endpoint of ['quit','http://example.org','../server.cfg','rcon','info.json?token=bad'])await assert.rejects(getEndpoint(endpoint));
});
test('dependencies include only actual resource names',()=>{
  assert.deepEqual(dependencies("dependency 'oxmysql'\ndependencies {'lb-phone','qbx_core','/server:12913'}\n--dependency 'ignored'"),['oxmysql','lb-phone','qbx_core']);
});
test('retired server entry refuses startup before license access',async()=>{
  const {serve}=await import('../lab/supervisor.mjs');
  await assert.rejects(serve(),/startup disabled/);
  const {labCommand}=await import('../lab/client.mjs');
  await assert.rejects(labCommand('start'),/retired/);
});
test('real bridge policy allows only approved selftests and blocks occupied server',t=>{
  const lua=luaRuntime();if(!lua){t.skip('Lua 5.4 unavailable');return;}
  const r=command(lua,[path.join(tool,'tests/lua/bridge-policy.lua'),path.join(tool,'server-bridge/policy.lua')]);
  assert(r.ok,r.output);
});
test('old PASS and issued-only messages cannot pass a native test',()=>{
  const id='11111111-2222-3333-4444-555555555555';
  assert.equal(parseSelftest('[BASE] selftest PASS (0/8 failed)',id,'base'),null);
  assert.equal(parseSelftest('[FLECITY_AUTOTEST] BEGIN '+id+' base_selftest\nISSUED',id,'base'),null);
});
test('native summaries are correlated and duplicate summaries rejected',()=>{
  const id='11111111-2222-3333-4444-555555555555',marker='[FLECITY_AUTOTEST] BEGIN '+id+' base_selftest\n';
  assert.equal(parseSelftest(marker+'[BASE] selftest PASS (0/8 failed)',id,'base').status,'PASS');
  assert.equal(parseSelftest(marker+'[BASE] selftest FAIL (1/8 failed)',id,'base').status,'FAIL');
  assert.throws(()=>parseSelftest(marker+'[BASE] selftest PASS (0/8 failed)\n[BASE] selftest PASS (0/8 failed)',id,'base'));
  assert.equal(parseSelftest('[FLECITY_AUTOTEST] BEGIN '+id+' link_selftest\n[FlecityGames selftest] end failures=0',id,'link').status,'PASS');
});
test('staged bridge scripts compile without running server natives',t=>{
  const luac=luaCompiler();if(!luac){t.skip('Lua compiler unavailable');return;}
  for(const file of ['fxmanifest.lua','policy.lua','server.lua'])assert(command(luac,['-p',path.join(tool,'server-bridge',file)]).ok,file);
});
test('installation and native calls require rollback access and deployed-code audit',()=>{
  const a={userApproved:true,rollbackConsoleVerified:true,kind:'selftest-bridge-v1',planId:'11111111-2222-3333-4444-555555555555',auditedTargets:{base:'a'.repeat(64),link:'b'.repeat(64)}};
  assert.doesNotThrow(()=>assertBridgeApproval(a));
  assert.throws(()=>assertBridgeApproval({...a,rollbackConsoleVerified:false}));
  assert.throws(()=>assertBridgeApproval({...a,userApproved:false}));
  assert.throws(()=>assertBridgeApproval({...a,auditedTargets:{}}));
});
