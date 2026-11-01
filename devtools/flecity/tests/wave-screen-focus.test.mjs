import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {command,luaRuntime,repo,tool} from '../core.mjs';

test('WAVE hands focus to an expanded NUI only after LB Phone is hidden',()=>{
 const result=command(luaRuntime(),[path.join(tool,'tests/lua/wave-screen-focus.lua'),path.join(repo,'wave')]);
 assert(result.ok,result.output);
 assert.match(result.output,/PASS WAVE focus order/);
});
