import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require=createRequire(import.meta.url);
const core=require('../payload/web/ringtone-core.js');
const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../payload');
const read=relative=>readFile(path.join(sourceRoot,relative),'utf8');

test('accepts and rounds a valid segment within the published track',()=>{
  const result=core.normalizeSelection({startSeconds:1.234,endSeconds:8.567,fadeInMs:240.4,fadeOutMs:500.2,gain:1.2345},30);
  assert.equal(result.ok,true);
  assert.deepEqual(result.value,{startSeconds:1.23,endSeconds:8.57,fadeInMs:240,fadeOutMs:500,gain:1.235});
});

test('rejects selections shorter than two seconds or longer than fifteen seconds',()=>{
  assert.equal(core.normalizeSelection({startSeconds:0,endSeconds:1.99,fadeInMs:0,fadeOutMs:0,gain:1},30).error,'INVALID_RINGTONE_RANGE');
  assert.equal(core.normalizeSelection({startSeconds:0,endSeconds:15.01,fadeInMs:0,fadeOutMs:0,gain:1},30).error,'INVALID_RINGTONE_RANGE');
});

test('rejects a segment that reaches beyond the source track',()=>{
  assert.equal(core.normalizeSelection({startSeconds:18,endSeconds:22,fadeInMs:0,fadeOutMs:0,gain:1},20).error,'INVALID_RINGTONE_RANGE');
});

test('rejects null, missing, nonfinite, and empty numeric input',()=>{
  for(const value of [null,undefined,'',NaN,Infinity]){
    assert.equal(core.normalizeSelection({startSeconds:value,endSeconds:5,fadeInMs:0,fadeOutMs:0,gain:1},20).ok,false);
  }
});

test('rejects fade durations that exceed limits or overlap beyond the segment',()=>{
  assert.equal(core.normalizeSelection({startSeconds:0,endSeconds:3,fadeInMs:3001,fadeOutMs:0,gain:1},20).error,'INVALID_RINGTONE_FADE');
  assert.equal(core.normalizeSelection({startSeconds:0,endSeconds:3,fadeInMs:2000,fadeOutMs:1500,gain:1},20).error,'INVALID_RINGTONE_FADE');
});

test('rejects gain outside the server-supported range',()=>{
  assert.equal(core.normalizeSelection({startSeconds:0,endSeconds:3,fadeInMs:0,fadeOutMs:0,gain:.49},20).error,'INVALID_RINGTONE_GAIN');
  assert.equal(core.normalizeSelection({startSeconds:0,endSeconds:3,fadeInMs:0,fadeOutMs:0,gain:1.51},20).error,'INVALID_RINGTONE_GAIN');
});

test('clips ordinary notes to the requested interval and offsets them from its start',()=>{
  const result=core.clipEvents([
    {at:.5,duration:1,pitch:60,volume:.8},
    {at:2,duration:.7,pitch:62,volume:.7},
    {at:3.5,duration:1,pitch:64,volume:.7}
  ],1,4);
  assert.deepEqual(result.map(({at,duration,pitch})=>({at,duration,pitch})),[
    {at:0,duration:.5,pitch:60},
    {at:1,duration:.7,pitch:62},
    {at:2.5,duration:.5,pitch:64}
  ]);
});

test('clips phrase segments at both ends while preserving pitch and velocity',()=>{
  const result=core.clipEvents([{at:.5,duration:3,phrase:[
    {offset:0,duration:1,pitch:60,velocity:.4},
    {offset:1,duration:1,pitch:62,velocity:.7},
    {offset:2,duration:1,pitch:64,velocity:.9}
  ]}],1,3);
  assert.equal(result.length,1);
  assert.deepEqual(result[0].phrase,[
    {offset:0,duration:.5,pitch:60,velocity:.4},
    {offset:.5,duration:1,pitch:62,velocity:.7},
    {offset:1.5,duration:.5,pitch:64,velocity:.9}
  ]);
});

test('ignores malformed and non-overlapping events',()=>{
  assert.deepEqual(core.clipEvents([{at:0,duration:1},{at:3,duration:1},{at:'x',duration:1}],1,2),[]);
});

test('envelope starts and ends silent with the configured fade values',()=>{
  assert.deepEqual(core.envelopePoints(5,9,500,1000,.8),[
    {at:5,value:0},{at:5.5,value:.8},{at:8,value:.8},{at:9,value:0}
  ]);
});

test('server checks author permission, full access, and owner-scoped saved settings',async()=>{
  const server=await read('server/main.lua');
  assert.match(server,/track\.rights\.ringtone~=true/);
  assert.match(server,/track\.preview or not track\.project/);
  assert.match(server,/WHERE r\.citizenid=\? AND t\.status='public' AND a\.status='active'/);
  assert.match(server,/INSERT INTO wave_ringtones/);
  assert.match(server,/DELETE FROM wave_ringtones WHERE citizenid=\?/);
  assert.match(server,/local tables=\{[^\n]*'wave_ringtones'/);
});

test('ringtone data is additive and does not attach cascading deletes to songs or purchases',async()=>{
  const server=await read('server/main.lua');
  const start=server.indexOf('CREATE TABLE IF NOT EXISTS wave_ringtones');
  assert.notEqual(start,-1);
  const end=server.indexOf(']],',start);
  const schema=server.slice(start,end);
  assert.match(schema,/PRIMARY KEY \(citizenid\)/);
  assert.doesNotMatch(schema,/FOREIGN KEY|ON DELETE CASCADE/i);
  assert.match(server,/wave_ringtones.*SchemaVersion|SchemaVersion.*wave_ringtones/s);
});

test('documented LB Phone native sound check is enabled and falls back until ringtone audio is ready',async()=>{
  const config=await read('config/shared.lua');
  const client=await read('client/main.lua');
  assert.match(config,/nativeIntegration\s*=\s*true/);
  assert.match(config,/nativeSoundType\s*=\s*'ringtone'/);
  assert.match(client,/soundType or ''\)~=WaveConfig\.Ringtone\.nativeSoundType then return true/);
  assert.match(client,/not waveRingtoneSelection or not waveRingtoneUiReady or not waveRingtoneAudioReady then return true/);
  assert.match(client,/SendNUIMessage\(\{type='waveRingtoneStart'\}\)\s*return false/);
});

test('saved ringtone readiness follows the current selection and ignores stale preload results',async()=>{
  const player=await read('web/background-player.js');
  assert.match(player,/generation!==ringer\.generation\|\|ringer\.settings!==settings/);
  assert.match(player,/ringer\.ready=true;reportRingtoneAudioState\(true\)/);
  assert.match(player,/ringer\.ready=false;reportRingtoneAudioState\(false\)/);
});

test('preview playback stays separate from the saved incoming ringtone',async()=>{
  const player=await read('web/background-player.js');
  const start=player.indexOf('async function playRingtone(data,loop=false)');
  const end=player.indexOf('\nfunction pump(){',start);
  assert.notEqual(start,-1);
  assert.notEqual(end,-1);
  const preview=player.slice(start,end);
  assert.match(preview,/ringer\.playback=\{track,selection:normalized\.value,prepared\}/);
  assert.doesNotMatch(preview,/ringer\.settings\s*=/);
  assert.match(player,/scheduleRingtoneCycle\(c,ringer\.playback\.selection,ringer\.nextAt,ringer\.playback\.prepared/);
});

test('UI exposes the opt-in permission and guarded clip controls',async()=>{
  const html=await read('web/index.html');
  const app=await read('web/app.js');
  assert.match(html,/rightRingtone[^>]*> 着信音としての利用を許可/);
  assert.match(html,/ringtoneCurrentTitle/);
  assert.match(app,/rights\.ringtone===true&&!t\.preview/);
  assert.match(app,/bridge\('saveRingtone'/);
  assert.match(app,/bridge\('clearRingtone'/);
  assert.match(app,/bridge\('previewRingtone'/);
});

test('default ringtone preview is clearly unavailable until a WAVE ringtone is set',async()=>{
  const html=await read('web/index.html');
  const app=await read('web/app.js');
  const css=await read('web/app.css');
  assert.match(html,/id="previewCurrentRingtone"[^>]*disabled/);
  assert.match(html,/id="ringtoneStatusHint"/);
  assert.match(app,/preview\.disabled=true/);
  assert.match(app,/if\(reset\)reset\.disabled=true/);
  assert.match(app,/初期着信音はLB Phone側が管理するため、WAVE内では試聴できません/);
  assert.match(css,/\.wave-ringtone-card button:disabled\{opacity:[^}]*cursor:not-allowed/);
});
