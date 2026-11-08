import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const payloadRoot=path.join(packageRoot,'payload');
const baseline=JSON.parse(await readFile(path.join(packageRoot,'manifests','v19-baseline.json'),'utf8'));
const target=JSON.parse(await readFile(path.join(packageRoot,'manifests','v20-target.json'),'utf8'));
const allowed=['client/main.lua','config/shared.lua','fxmanifest.lua','server/main.lua','web/app.css','web/app.js','web/background-player.js','web/index.html','web/ringtone-core.js','web/screen/index.html'];
const server=await readFile(path.join(payloadRoot,'server','main.lua'),'utf8');
const client=await readFile(path.join(payloadRoot,'client','main.lua'),'utf8');
const appJs=await readFile(path.join(payloadRoot,'web','app.js'),'utf8');

async function filesBelow(root,prefix=''){
  const out=[];
  for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
    const child=path.posix.join(prefix.replaceAll('\\','/'),entry.name);
    if(entry.isDirectory())out.push(...await filesBelow(root,child));
    else if(entry.isFile())out.push(child);
  }
  return out.sort();
}

async function sha256(file){return createHash('sha256').update(await readFile(file)).digest('hex').toUpperCase();}

function functionBlock(source,name){
  const start=source.indexOf(`local function ${name}(`);
  assert.notEqual(start,-1,`missing server function ${name}`);
  const next=source.indexOf('\nlocal function ',start+1);
  return source.slice(start,next<0?source.length:next);
}

test('v19 installed baseline is preserved and v20 adds one resource file',()=>{
  assert.equal(Object.keys(baseline).length,273);
  assert.equal(Object.keys(target).length,274);
  const added=Object.keys(target).filter(file=>!(file in baseline));
  const removed=Object.keys(baseline).filter(file=>!(file in target));
  assert.deepEqual(added,['web/ringtone-core.js']);
  assert.deepEqual(removed,[]);
});

test('source changes are restricted to the ten reviewed WAVE files',()=>{
  const changed=[...Object.keys(baseline).filter(file=>baseline[file]!==target[file]),...Object.keys(target).filter(file=>!(file in baseline))].sort();
  assert.deepEqual(changed,[...allowed].sort());
});

test('payload contains exactly ten files with their approved SHA256 hashes',async()=>{
  assert.deepEqual(await filesBelow(payloadRoot),[...allowed].sort());
  for(const file of allowed)assert.equal(await sha256(path.join(payloadRoot,file)),target[file],file);
});

test('version and additive schema target are v20 test values',async()=>{
  const manifest=await readFile(path.join(payloadRoot,'fxmanifest.lua'),'utf8');
  const config=await readFile(path.join(payloadRoot,'config','shared.lua'),'utf8');
  assert.match(manifest,/version\s+'0\.3\.6-test'/);
  assert.match(config,/SchemaVersion\s*=\s*4/);
});

test('ringtone callbacks are registered on both the server and NUI client',()=>{
  for(const [action,event] of [['getRingtone','wave:getRingtone'],['saveRingtone','wave:saveRingtone'],['clearRingtone','wave:clearRingtone']]){
    assert.ok(server.includes(`['${event}']`),`server callback missing ${event}`);
    assert.ok(client.includes(`${action} = '${event}'`),`NUI action missing ${action}`);
  }
});

test('only a public active track with author opt-in and full listening access can be saved',()=>{
  const block=functionBlock(server,'getEligibleRingtoneTrack');
  assert.match(block,/t\.status='public' AND a\.status='active'/);
  assert.match(block,/track\.rights\.ringtone~=true/);
  assert.match(block,/track\.preview or not track\.project/);
});

test('saved ringtone identity is derived from the QBox citizenid on the server',()=>{
  const save=functionBlock(server,'cbSaveRingtone');
  const load=functionBlock(server,'loadSavedRingtone');
  const clear=functionBlock(server,'cbClearRingtone');
  assert.match(save,/local citizenid=getCitizenId\(source\)/);
  assert.match(save,/INSERT INTO wave_ringtones/);
  assert.doesNotMatch(save,/data\.citizenid/);
  assert.match(load,/WHERE r\.citizenid=\?/);
  assert.match(clear,/DELETE FROM wave_ringtones WHERE citizenid=\?/);
  assert.doesNotMatch(clear,/data\.citizenid/);
});

test('ringtone table is additive and has no cascade into songs or purchases',()=>{
  const start=server.indexOf('CREATE TABLE IF NOT EXISTS wave_ringtones');
  assert.notEqual(start,-1);
  const end=server.indexOf(']],',start);
  const ddl=server.slice(start,end);
  assert.match(ddl,/PRIMARY KEY \(citizenid\)/);
  assert.doesNotMatch(ddl,/FOREIGN KEY|ON DELETE CASCADE/i);
  assert.match(server,/wave_ringtones.*SchemaVersion|SchemaVersion.*wave_ringtones/s);
  assert.match(server,/local tables=\{[^\n]*'wave_ringtones'/);
});

test('invalid segment, fade, and gain values are rejected server-side',()=>{
  const block=functionBlock(server,'normalizedRingtoneSelection');
  for(const token of ['INVALID_RINGTONE_RANGE','INVALID_RINGTONE_FADE','INVALID_RINGTONE_GAIN','WaveConfig.Ringtone.minSeconds','WaveConfig.Ringtone.maxSeconds','WaveConfig.Ringtone.maxFadeMilliseconds'])assert.ok(block.includes(token),`missing bound: ${token}`);
});

test('native LB Phone sound interception remains disabled until call audio is verified',async()=>{
  const config=await readFile(path.join(payloadRoot,'config','shared.lua'),'utf8');
  assert.match(config,/nativeIntegration\s*=\s*false/);
  assert.match(client,/not waveRingtoneUiReady or not waveRingtoneAudioReady then return true/);
});

test('saved and preview ringtone settings remain separate and stale preloads cannot win',async()=>{
  const player=await readFile(path.join(payloadRoot,'web','background-player.js'),'utf8');
  assert.match(player,/generation!==ringer\.generation\|\|ringer\.settings!==settings/);
  assert.match(player,/ringer\.playback=\{track,selection:normalized\.value,prepared\}/);
  const start=player.indexOf('async function playRingtone(data,loop=false)');
  const end=player.indexOf('\nfunction pump(){',start);
  const preview=player.slice(start,end);
  assert.doesNotMatch(preview,/ringer\.settings\s*=/);
  assert.match(player,/scheduleRingtoneCycle\(c,ringer\.playback\.selection,ringer\.nextAt,ringer\.playback\.prepared/);
});

test('Library and playlist changes stay owner-scoped and preserve original tracks and transactions',()=>{
  const removeLibrary=functionBlock(server,'cbRemoveLibraryTrack');
  const removePlaylist=functionBlock(server,'cbRemovePlaylistTrack');
  const deletePlaylist=functionBlock(server,'cbDeletePlaylist');
  assert.match(removeLibrary,/local citizenid=getCitizenId\(source\)/);
  assert.match(removeLibrary,/DELETE FROM wave_favorites WHERE citizenid=\? AND track_id=\?/);
  assert.doesNotMatch(removeLibrary,/DELETE\s+FROM\s+wave_(tracks|purchases|transactions|wallets)/i);
  assert.match(removePlaylist,/getOwnPlaylist\(citizenid,playlistId\)/);
  assert.match(removePlaylist,/DELETE FROM wave_playlist_tracks WHERE playlist_id=\? AND track_id=\?/);
  assert.match(deletePlaylist,/UPDATE wave_playlists SET deleted_at=NOW\(\) WHERE id=\? AND citizenid=\?/);
});

test('playlist duplicate handling, sorting, and membership removal are covered by existing logic',()=>{
  assert.match(server,/INSERT IGNORE INTO wave_playlist_tracks/);
  assert.match(server,/ORDER BY position ASC,added_at ASC,track_id ASC/);
  assert.match(server,/MySQL\.transaction\.await/);
  for(const token of ['ライブラリから外す','プレイリストから外す','プレイリストを削除','曲本体・公開情報・販売記録・購入権利は残ります'])assert.ok(appJs.includes(token),`missing UX protection: ${token}`);
});

test('existing player controls, persistent player state, and queue logic remain in the update scope',async()=>{
  const player=await readFile(path.join(payloadRoot,'web','background-player.js'),'utf8');
  for(const token of ["$('miniPrev')","$('miniNext')","$('miniPlay')","$('miniShuffle')","$('miniRepeat')",'document.visibilityState','wavePlayerRefresh()','wavePlayerCommand'])assert.ok(appJs.includes(token)||player.includes(token),`missing player behavior: ${token}`);
});

test('updater enforces exact hashes, full pre-update backup, and allowlisted rollback only',async()=>{
  const updater=await readFile(path.join(packageRoot,'scripts','WAVE_v20_Update.ps1'),'utf8');
  for(const token of ['CONFLICT_STOP','Assert-ExactTree','pre-update full WAVE resource backup','backup-metadata.json',"'Rollback'",'ROLLBACK PASS','databaseChangedByUpdater = $false','wave_ringtones'])assert.ok(updater.includes(token),`missing update guard: ${token}`);
});

test('each CMD records both outcomes and stays open for review',async()=>{
  for(const name of ['01_PLAN_ONLY.cmd','02_UPDATE_TEST.cmd','03_VERIFY_AFTER_UPDATE.cmd','04_ROLLBACK_TEST.cmd']){
    const text=await readFile(path.join(packageRoot,'scripts',name),'utf8');
    assert.match(text,/WAVE_v20_.*\.log/);
    assert.match(text,/RESULT=FAIL; EXIT_CODE=/);
    assert.match(text,/pause >nul/i);
    assert.match(text,/exit \/b %RC%/i);
  }
});

test('deployment payload contains no SQL migration or sample bank replacement',async()=>{
  const files=await filesBelow(payloadRoot);
  assert.ok(!files.some(file=>file.startsWith('sql/')));
  assert.ok(!files.some(file=>file.startsWith('web/samples/')));
});
