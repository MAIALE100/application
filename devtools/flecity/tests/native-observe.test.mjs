import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {tool,project,luaRuntime,command} from '../core.mjs';
test('staged native observation reports real native counts without commands or identities',t=>{
 const lua=luaRuntime();if(!lua){t.skip('Lua unavailable');return;}
 const r=command(lua,[path.join(tool,'tests/lua/bridge-observe.lua'),path.join(tool,'server-bridge/policy.lua'),path.join(tool,'server-bridge/server.lua')]);assert(r.ok,r.output);
});
test('virtual four-actor lobby and two-actor game use actual Lua handlers without DB/network',t=>{
 const lua=luaRuntime();if(!lua){t.skip('Lua unavailable');return;}
 const r=command(lua,[path.join(tool,'tests/lua/link-multiplayer.lua'),project('link').source]);assert(r.ok,r.output);assert(r.output.includes('seed=20261031'));
});
