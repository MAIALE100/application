import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {repo} from '../core.mjs';

const read=(root,file)=>fs.readFileSync(path.join(repo,root,file),'utf8');
const values=(text,re)=>[...text.matchAll(re)].map(m=>m[1]);
test('LOOP, LINK and WAVE LB Phone identifiers and callback namespaces are disjoint',()=>{
 const gamesConfig=read('flecity_sources/flecity_games','config/shared.lua');
 const waveConfig=read('wave','config/shared.lua');
 const gamesClient=read('flecity_sources/flecity_games','client/main.lua');
 const waveClient=read('wave','client/main.lua');
 const gamesServer=read('flecity_sources/flecity_games','server/main.lua');
 const waveServer=read('wave','server/main.lua');
 const ids=[...values(gamesConfig,/identifier\s*=\s*'([^']+)'/g),...values(waveConfig,/identifier\s*=\s*'([^']+)'/g)];
 assert.deepEqual(ids.sort(),['flecity_party','flecity_play','flecity_wave']);
 const nui=[...values(gamesClient,/RegisterNUICallback\('([^']+)'/g),...values(waveClient,/RegisterNUICallback\('([^']+)'/g)];
 assert.deepEqual(nui.sort(),['flecityGames:callback','wave:callback']);
 const gameCallbacks=new Set(values(gamesServer,/\['(flecity_games:[^']+)'\]\s*=/g));
 const waveCallbacks=new Set(values(waveServer,/\['(wave:[^']+)'\]\s*=/g));
 assert(gameCallbacks.size>20&&waveCallbacks.size>20);
 assert([...gameCallbacks].every(x=>!waveCallbacks.has(x)));
});
