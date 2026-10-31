import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {command,luaRuntime,repo,tool} from '../core.mjs';

test('WAVE client never removes an LB Phone app with unknown ownership',()=>{
 const lua=luaRuntime();assert(lua,'Lua runtime required');
 const result=command(lua,[path.join(tool,'tests','lua','wave-client-registration.lua'),path.join(repo,'wave')]);
 assert(result.ok,result.output);
 assert.match(result.output,/PASS WAVE LB Phone identifier collision/);
});
