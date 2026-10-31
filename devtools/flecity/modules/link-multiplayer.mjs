import path from 'node:path';
import {luaRuntime,command,tool} from '../core.mjs';
import {jointTranscript} from '../fixtures/link-joint.mjs';
export async function run(ctx){
  const lua=luaRuntime();if(!lua)throw Error('Lua 5.4 required');
  const r=command(lua,[path.join(tool,'tests/lua/link-multiplayer.lua'),ctx.source]);
  if(!r.ok)throw Error(r.output);
  const t=jointTranscript(ctx.source);
  return r.output+'\n'+JSON.stringify({games:t.games.map(({id,players,checks,completed})=>({id,players,checks,completed})),events:t.events,premiumDenied:t.premiumDenied,scope:t.scope});
}
