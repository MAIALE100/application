import assert from 'node:assert/strict';
import vm from 'node:vm';
import { literalCreateTables } from './schema-smoke.mjs';
import {disposable} from '../database.mjs';
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
export async function db(ctx){
 const statements=literalCreateTables(ctx.read('server/main.lua'));
 await disposable(ctx,async fixture=>{
  await ctx.check('WAVE production Lua schema DDL in disposable MariaDB',async()=>{
   assert.equal(statements.length,19,'Expected 19 managed WAVE tables');
   const sql=statements.join(';\n')+';\n';
   await fixture.sql(sql);await fixture.sql(sql);
   const count=await fixture.sql("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE 'wave\\_%'");
   assert.equal(Number(count.trim()),19,'WAVE table count');
   const engines=await fixture.sql("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE 'wave\\_%' AND ENGINE<>'InnoDB'");
   assert.equal(Number(engines.trim()),0,'WAVE table engine');
   return '19 production CREATE TABLE statements imported twice; no existing DB';
  });
  ctx.skip('WAVE actual data/API integration','Live callbacks, permissions, payments and existing DB remain untested');
 });
}
export {prepare as nuiPrepare,scenario as nui} from '../ui/wave.mjs';
