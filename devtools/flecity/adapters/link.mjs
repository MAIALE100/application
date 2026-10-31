import assert from 'node:assert/strict';
import { disposable } from '../database.mjs';
import path from 'node:path';
import {luaRuntime,tool} from '../core.mjs';
export { prepare as nuiPrepare,scenario as nui } from '../ui/link.mjs';
export async function staticChecks(ctx) {
  const lua=luaRuntime();
  if(lua)ctx.exec('LINK Lua rule/rate regressions',lua,[path.join(tool,'tests/lua/link-rules.lua'),ctx.source]);
  else ctx.skip('LINK Lua rule/rate regressions','Lua 5.4 runtime unavailable');
  if(lua)ctx.exec('Shared app disabled callback and billing boundary',lua,[path.join(tool,'tests/lua/app-disable.lua'),ctx.source]);
  await ctx.check('LINK/PARTY identity and callback surface',()=>{
    const config=ctx.read('config/shared.lua');
    assert(config.includes("identifier = 'flecity_party'"));assert(/name\s*=\s*'(LINK|PARTY)'/.test(config));
    assert(ctx.read('fxmanifest.lua').includes('server/core/party.lua'));
    assert(ctx.read('client/main.lua').includes('FlecityGamesConfig.Apps'));
    assert(ctx.read('server/core/party.lua').includes('ticTacWinner'));
    return 'Legacy PARTY identity retained; real multiplayer tests are separate';
  });
}
export { staticChecks as static };
export async function db(ctx){
  await disposable(ctx,async db=>{
    await ctx.check('LINK/LOOP MariaDB schema / idempotent import',async()=>{
      const sql=ctx.read('sql/001_initial.sql');
      await db.sql(sql);await db.sql(sql);
      const expected=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS/g)].length;
      assert.equal(Number((await db.sql('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()')).trim()),expected);
    });
    const insert=token=>"INSERT INTO flecity_game_scores(player_identifier,game_id,score,duration_ms,session_token) VALUES('FIXTURE','fall_battle',100,1000,'"+token+"');";
    await ctx.check('LINK/LOOP duplicate score transaction rollback',async()=>{
      await db.sql(insert('duplicate'));
      const failure=await db.sql('START TRANSACTION;'+insert('must_rollback')+insert('duplicate')+'COMMIT;',{expectFailure:true});
      assert(failure.failed);assert.equal((await db.sql('SELECT COUNT(*) FROM flecity_game_scores')).trim(),'1');
    });
    await ctx.check('LINK/LOOP concurrent duplicate session rejection',async()=>{
      const results=await Promise.all(Array.from({length:8},()=>db.sql(insert('concurrent'),{expectFailure:true})));
      assert.equal(results.filter(r=>!r.failed).length,1);
      assert.equal((await db.sql("SELECT COUNT(*) FROM flecity_game_scores WHERE session_token='concurrent'")).trim(),'1');
    });
    ctx.skip('LINK actual server/room/AI integration','Direct schema/constraint tests only; real callbacks/membership and multi-player synchronization require FiveM');
  });
}
