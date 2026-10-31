import path from 'node:path';
import {luaRuntime,command,tool} from '../core.mjs';
export async function run(ctx){
  const lua=luaRuntime();if(!lua)throw Error('Lua 5.4 required');
  const r=command(lua,[path.join(tool,'tests/lua/link-multiplayer.lua'),ctx.source]);
  if(!r.ok)throw Error(r.output);return r.output;
}
