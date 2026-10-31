import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tool,luaCompiler,command} from '../core.mjs';
import {ports,freePort,parseLicense,safeLog,artifactAllowed,labPath,labRoot} from '../lab/runtime.mjs';
test('lab cannot bind existing service ports',async()=>{
  for(const port of [30120,3306,40120,0])await assert.rejects(freePort(port),/Unregistered/);
  assert.deepEqual(Object.values(ports),[30130,33130,43130]);
});
test('lab paths cannot escape private root',()=>{
  assert.throws(()=>labPath('../server.cfg'));assert.throws(()=>labPath('D:\\FiveM_Test_Server\\server'));
  assert(path.relative(labRoot,labPath('instances/fixture')).startsWith('instances'));
});
test('license file rejects extra commands and missing key',()=>{
  assert.throws(()=>parseLicense('set sv_licenseKey ""'));
  assert.throws(()=>parseLicense('set sv_licenseKey "cfxk_'+'x'.repeat(30)+'"\nexec server.cfg'));
  assert.throws(()=>parseLicense('set sv_licenseKey "abc"; quit'));
  assert.equal(parseLicense('# private\nset sv_licenseKey "cfxk_'+'x'.repeat(30)+'"'),'cfxk_'+'x'.repeat(30));
});
test('known secrets, URIs and bearer tokens are redacted',()=>{
  const license='cfxk_'+'x'.repeat(30),password='fixturepassword';
  const out=safeLog(license+' '+password+' mysql://user:pass@localhost/db Authorization: Bearer fakeAuth',[license,password]);
  for(const value of [license,password,'user:pass','fakeAuth'])assert(!out.includes(value));
});
test('artifact copy excludes existing credentials and configuration',()=>{
  for(const file of ['server-monitor-token.key','server-tls.crt','server.cfg','server.cfg.bkp','txData/default/config.json','logs/server.log','admins.json'])assert(!artifactAllowed(file),file);
  for(const file of ['FXServer.exe','components.json','citizen/scripting/lua/natives_server.lua'])assert(artifactAllowed(file),file);
});
test('lab resources compile under verified Lua 5.4',t=>{
  const luac=luaCompiler();if(!luac){t.skip('Lua 5.4 unavailable');return;}
  for(const resource of ['qbx_core','lb-phone','flecity_validation']){
    for(const file of ['fxmanifest.lua','server.lua'])assert(command(luac,['-p',path.join(tool,'lab/resources',resource,file)]).ok,resource+'/'+file);
  }
});
