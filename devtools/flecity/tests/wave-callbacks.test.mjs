import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {command,luaRuntime,repo,tool} from '../core.mjs';

test('WAVE production Lua callback guards and economy paths in isolated mocks',()=>{
 const lua=luaRuntime();assert(lua,'Lua runtime required');
 const result=command(lua,[path.join(tool,'tests','lua','wave-callbacks.lua'),path.join(repo,'wave')]);
 assert(result.ok,result.output);
 assert.match(result.output,/PASS WAVE mocked callbacks/);
});
