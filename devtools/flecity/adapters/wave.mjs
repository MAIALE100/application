import assert from 'node:assert/strict';
import vm from 'node:vm';
import { schemaSmoke } from './schema-smoke.mjs';
export async function staticChecks(ctx){
  await ctx.check('WAVE app/CSS contract',()=>{
    assert(ctx.read('config/shared.lua').includes("identifier = 'flecity_wave'"));
    assert(!/\d+(?:\.\d+)?px/.test(ctx.read('web/app.css')));
  });
  await ctx.check('WAVE score navigation pure functions',()=>{
    const sandbox=vm.createContext({module:{exports:{}}});
    vm.runInContext(ctx.read('web/score-tools.js'),sandbox,{timeout:1000});
    const api=sandbox.module.exports;
    assert.equal(api.validBars(-1),1);assert.equal(api.validBars(999),128);assert.equal(api.validBars(NaN),1);
    assert.equal(api.validIndex(-9,16),0);assert.equal(api.validIndex(99,16),15);
    assert.equal(api.durationSeconds(4,120),8);assert.equal(api.durationSeconds(4,0),8);
    assert.equal(api.durationLabel(32,120),'1:04');
    return 'Bounds and tempo fallback; no project data mutated';
  });
}
export { staticChecks as static };
export async function db(ctx){await schemaSmoke(ctx,ctx.read('sql/wave.sql'),'WAVE');}
export {prepare as nuiPrepare,scenario as nui} from '../ui/wave.mjs';
