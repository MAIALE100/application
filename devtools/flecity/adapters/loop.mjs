import assert from 'node:assert/strict';
import path from 'node:path';
import {luaRuntime,tool} from '../core.mjs';
export {prepare as nuiPrepare,scenario as nui} from '../ui/loop.mjs';
export async function staticChecks(ctx) {
  const lua=luaRuntime();
  if(lua)ctx.exec('LOOP real Lua game/rate/timing invariants (JSON codec excluded)',lua,[path.join(tool,'tests/lua/loop-logic.lua'),ctx.source]);
  else ctx.skip('LOOP Lua algorithms','Lua 5.4 unavailable');
  if(lua)ctx.exec('LOOP/LINK disabled callback and billing boundary',lua,[path.join(tool,'tests/lua/app-disable.lua'),ctx.source]);
  await ctx.check('LOOP game registry',()=>{
    const ids=[...ctx.read('shared/game_registry.lua').matchAll(/\bid='([^']+)'/g)].map(m=>m[1]);
    assert(ids.length>0);assert.equal(new Set(ids).size,ids.length);assert(ctx.read('config/shared.lua').includes("name = 'LOOP'"));
    return ids.length+' IDs; game execution is separate';
  });
}
export { staticChecks as static };
export { db } from './link.mjs';
