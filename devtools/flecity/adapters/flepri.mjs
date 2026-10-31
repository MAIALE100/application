import assert from 'node:assert/strict';
import { schemaSmoke,literalCreateTables } from './schema-smoke.mjs';
export async function staticChecks(ctx){
  await ctx.check('FLEPURI/PuriPhoto import compatibility surface',()=>{
    const server=ctx.read('server/main.lua');
    assert(ctx.read('fxmanifest.lua').includes('"puriphoto"'));
    assert(server.includes('puriphotoGetBoothImport'));assert(server.includes('puriphotoConfirmBoothImport'));
    assert(server.includes('puribooth:server:startSession'));assert(server.includes('puribooth:server:cancelSession'));
    return 'Import/session hooks present; camera/payment/refund behavior not tested';
  });
}
export { staticChecks as static };
export async function db(ctx){await schemaSmoke(ctx,literalCreateTables(ctx.read('server/main.lua')).join(';\n'),'FLEPURI');}
