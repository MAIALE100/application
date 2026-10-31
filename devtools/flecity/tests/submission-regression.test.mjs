import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {project,luaRuntime,tool,command} from '../core.mjs';
import {jointTranscript} from '../fixtures/link-joint.mjs';
test('all registered LINK games use isolated 2–4 actor lifecycle and role projections',t=>{
 if(!luaRuntime()){t.skip('Lua 5.4 unavailable');return;}
 const result=jointTranscript(project('link').source);
 assert.equal(result.games.filter(g=>g.completed).length,14);
 assert(result.premiumDenied>0);assert(result.events>0);
});
for(const [name,file,source] of [
 ['BASE server roles and note preservation','tests/server-access.lua','base'],
 ['LOOP real rule invariants','tests/lua/loop-logic.lua','loop'],
 ['shared LOOP/LINK disabled boundary','tests/lua/app-disable.lua','link']
])test(name,t=>{
 const lua=luaRuntime();if(!lua){t.skip('Lua 5.4 unavailable');return;}
 const script=source==='base'?path.join(project('base').source,'tests/server-access.lua'):path.join(tool,file);
 const r=command(lua,[script,project(source).source]);assert(r.ok,r.output);
});
