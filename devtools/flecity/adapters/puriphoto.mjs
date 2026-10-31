import assert from 'node:assert/strict';
import { schemaSmoke,literalCreateTables } from './schema-smoke.mjs';
export async function staticChecks(ctx){
  await ctx.check('PuriPhoto booth import and album persistence surface',()=>{
    const client=ctx.read('client/v11.lua'),server=ctx.read('server/main.lua');
    assert(client.includes('puriphotoGetBoothImport'));assert(client.includes('puriphotoConfirmBoothImport'));
    for(const name of ['getAlbum','saveProject','deleteProject'])assert(server.includes('puriphoto:server:'+name));
    assert(ctx.read('fxmanifest.lua').includes('ui/dist/index.html'));
    return 'Built UI and import/album hooks present; capture/edit persistence requires live test';
  });
}
export { staticChecks as static };
export async function db(ctx){await schemaSmoke(ctx,literalCreateTables(ctx.read('server/main.lua')).join(';\n'),'PuriPhoto');}
