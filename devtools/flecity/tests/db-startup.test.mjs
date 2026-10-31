import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {command,luaRuntime,repo,tool} from '../core.mjs';

test('startup Ensure uses conditional DDL on current and legacy schema metadata',()=>{
 const lua=luaRuntime();assert(lua,'Lua runtime required');
 const result=command(lua,[path.join(tool,'tests','lua','database-ensure.lua'),path.join(repo,'flecity_sources','flecity_games','server','core','database.lua')]);
 assert(result.ok,result.output);
 assert.match(result.output,/PASS startup Ensure metadata paths/);
});
