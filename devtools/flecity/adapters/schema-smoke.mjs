import assert from 'node:assert/strict';
import { disposable } from '../database.mjs';
export function literalCreateTables(lua){
  const statements=[...lua.matchAll(/\[\[([\s\S]*?)\]\]/g)].map(m=>m[1].trim()).filter(sql=>/^CREATE TABLE IF NOT EXISTS\s+\w+\s*\(/.test(sql));
  if(!statements.length)throw Error('No literal CREATE TABLE Lua blocks found');
  for(const sql of statements)assert(!/\]\]|\.\.|%s/.test(sql),'Dynamic DDL requires dedicated adapter');
  return statements;
}
export async function schemaSmoke(ctx,sql,label){
  await disposable(ctx,async db=>{
    await ctx.check(label+' disposable schema import',async()=>{
      await db.sql(sql);await db.sql(sql);
      assert.equal((await db.sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND engine<>'InnoDB'")).trim(),'0');
      return 'DDL imported twice in isolated fixture';
    });
    ctx.skip(label+' actual data/API integration','DDL smoke only; Lua migrations, permissions, payments and live features not exercised');
  });
}
