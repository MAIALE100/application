import assert from 'node:assert/strict';
import path from 'node:path';
import {command,luaRuntime,tool} from '../core.mjs';
export function jointTranscript(source){
 const r=command(luaRuntime(),[path.join(tool,'tests/lua/link-joint.lua'),source],{timeout:60000});
 if(!r.ok)throw Error(r.output);
 const t=JSON.parse(r.output);assert.equal(t.games.length,15);assert.equal(t.dbWrites,0);
 assert.equal(new Set(t.games.map(g=>g.id)).size,15);
 for(const g of t.games){assert([2,4].includes(g.players));assert.equal(g.views.length,g.players);assert(g.checks.includes('disconnect-new-source-reconnect-stable-member'));}
 return t;
}
