import assert from 'node:assert/strict';
export async function staticChecks(ctx) {
  await ctx.check('LOOP game registry',()=>{
    const ids=[...ctx.read('shared/game_registry.lua').matchAll(/\bid='([^']+)'/g)].map(m=>m[1]);
    assert(ids.length>0);assert.equal(new Set(ids).size,ids.length);assert(ctx.read('config/shared.lua').includes("name = 'LOOP'"));
    return ids.length+' IDs; game execution is separate';
  });
}
export { staticChecks as static };
export { db } from './link.mjs';
