import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { luaRuntime } from '../core.mjs';
import { disposable } from '../database.mjs';
export { prepare as nuiPrepare,scenario as nui } from '../ui/base.mjs';
export async function staticChecks(ctx) {
  const guard=path.join(ctx.source,'tests/source-regression.mjs');
  if(fs.existsSync(guard))ctx.exec('BASE source regression',process.execPath,[guard]);
  else ctx.skip('BASE source regression','Regression file absent');
  const lua=luaRuntime();
  if(!lua)ctx.skip('BASE Lua regression','Lua 5.4 runtime unavailable; set FLECITY_LUA');
  else if(!fs.existsSync(path.join(ctx.source,'tests/custom-fields.lua')))ctx.skip('BASE Lua regression','Regression file absent');
  else ctx.exec('BASE Lua regression',lua,['flecity_base/tests/custom-fields.lua'],{cwd:path.dirname(ctx.source)});
  await ctx.check('BASE schema/callback/CSS invariants',()=>{
    const tables=text=>new Map([...text.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\([\s\S]*?\)\s*ENGINE\s*=\s*\w+\s+DEFAULT\s+CHARSET\s*=\s*\w+\s+COLLATE\s*=\s*\w+/g)].map(m=>[m[1],m[0].replace(/\s+/g,'')]));
    const a=tables(ctx.read('server/database.lua')),b=tables(ctx.read('sql/schema.sql'));
    assert.equal(a.size,12);assert.equal(b.size,12);
    for(const [name,sql] of a)assert.equal(b.get(name),sql,name);
    assert(!/\d+(?:\.\d+)?px/.test(ctx.read('web/app.css')));
    const client=ctx.read('client/main.lua'),block=client.slice(client.indexOf('local callbackMap ='),client.indexOf('RegisterNUICallback'));
    const names=[...block.matchAll(/'(flecity_base:[^']+)'/g)].map(m=>m[1]);assert(names.length>0);
    const server=ctx.read('server/main.lua');for(const name of names)assert(server.includes("['"+name+"'] = handlers."),name);
    return a.size+' definitions, '+names.length+' callbacks, no px';
  });
  await ctx.check('BASE known data-loss regression source guard',()=>{
    const service=ctx.read('server/custom_fields.lua');
    assert(/if value == nil then return false end/.test(service),'PR #7 invalid-text protection missing');
    assert(/seen\[fid\]/.test(service),'PR #7 duplicate field ID protection missing');
    return 'Source guards only; executable Lua/API tests are separate';
  });
}
export { staticChecks as static };
export async function db(ctx) {
  await disposable(ctx,async db=>{
    await ctx.check('BASE MariaDB schema / idempotent import',async()=>{
      await db.sql(ctx.read('sql/schema.sql'));await db.sql(ctx.read('sql/schema.sql'));
      assert.equal(Number((await db.sql('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()')).trim()),12);
    });
    await ctx.check('BASE SQL FK failure rollback',async()=>{
      await db.sql("INSERT INTO flecity_base_workspaces(id,owner_citizenid,name) VALUES(1,'FIXTURE','Fixture'); INSERT INTO flecity_base_stock_items(id,workspace_id,name,quantity,created_by) VALUES(1,1,'Fixture',10,'FIXTURE');");
      const failure=await db.sql("START TRANSACTION; UPDATE flecity_base_stock_items SET quantity=11 WHERE id=1; INSERT INTO flecity_base_stock_movements(workspace_id,item_id,actor_citizenid,delta,before_quantity,after_quantity) VALUES(1,999999,'FIXTURE',1,10,11); COMMIT;",{expectFailure:true});
      assert(failure.failed);assert.equal((await db.sql('SELECT quantity FROM flecity_base_stock_items WHERE id=1')).trim(),'10');
      assert.equal((await db.sql('SELECT COUNT(*) FROM flecity_base_stock_movements')).trim(),'0');
    });
    await ctx.check('BASE SQL concurrent quantity/history',async()=>{
      const adjust=delta=>'START TRANSACTION; SELECT quantity INTO @before FROM flecity_base_stock_items WHERE id=1 FOR UPDATE; DO SLEEP(0.03); UPDATE flecity_base_stock_items SET quantity=quantity+('+delta+') WHERE id=1; INSERT INTO flecity_base_stock_movements(workspace_id,item_id,actor_citizenid,delta,before_quantity,after_quantity) VALUES(1,1,\'FIXTURE\','+delta+',@before,@before+('+delta+')); COMMIT;';
      await Promise.all(Array.from({length:12},(_,i)=>db.sql(adjust(i%2?1:-1))));
      assert.equal((await db.sql('SELECT quantity FROM flecity_base_stock_items WHERE id=1')).trim(),'10');
      assert.equal((await db.sql('SELECT COUNT(*) FROM flecity_base_stock_movements')).trim(),'12');
      assert.equal((await db.sql('SELECT COUNT(*) FROM flecity_base_stock_movements WHERE after_quantity<>before_quantity+delta')).trim(),'0');
    });
    ctx.skip('BASE actual oxmysql/FiveM integration','SQL schema/locks only; handlers/invites/permissions need isolated FiveM harness');
  });
}
