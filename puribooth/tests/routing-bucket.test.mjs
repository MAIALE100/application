import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const server = await readFile(new URL('../server/main.lua', import.meta.url), 'utf8');
const config = await readFile(new URL('../config.lua', import.meta.url), 'utf8');

function eventBlock(name) {
  const marker = `RegisterNetEvent("puribooth:server:${name}"`;
  const start = server.indexOf(marker);
  assert.notEqual(start, -1, `missing event ${name}`);
  const next = server.indexOf('RegisterNetEvent("puribooth:server:', start + marker.length);
  return server.slice(start, next < 0 ? server.length : next);
}

test('booths are scoped to a configured bucket without a database migration', () => {
  assert.match(config, /Config\.BoothRoutingBucket\s*=\s*0/);
  assert.match(server, /local function configuredRoutingBucket\(\)/);
  assert.match(server, /local function currentRoutingBucket\(source\)[\s\S]*?pcall\(GetPlayerRoutingBucket, source\)/);
  assert.match(server, /local function playerInBoothBucket\(source, booth\)[\s\S]*?bucket ~= nil and bucket == expected/);
  assert.doesNotMatch(server, /ALTER\s+TABLE[\s\S]{0,120}routing_bucket/i);
});

test('a capture session remains bound to the routing bucket where it started', () => {
  const start = eventBlock('startSession');
  assert.match(start, /if not playerNearBooth\(source, booth\) then/);
  assert.match(start, /routingBucket = currentRoutingBucket\(source\)/);

  for (const name of [
    'setTheme', 'beginCapture', 'announceCountdown', 'captureComplete',
    'cancelSession', 'finishSession', 'technicalFailure',
  ]) {
    assert.match(eventBlock(name), /playerInSessionBucket\(source, session, booth\)/, `${name} checks the session bucket`);
  }
});

test('nearby sync and session state do not cross routing buckets', () => {
  const state = server.slice(server.indexOf('local function broadcastState'), server.indexOf('local function releaseSession'));
  const nearby = server.slice(server.indexOf('local function syncThemeToNearby'), server.indexOf('local function loadBooths'));
  const selection = server.slice(server.indexOf('local function relevantBoothForPlayer'), server.indexOf('local function validThemeSurface'));
  const nearest = server.slice(server.indexOf('local function nearestBooth'), server.indexOf('local function clampPrice'));

  assert.match(state, /currentRoutingBucket\(playerId\) == bucket/);
  assert.match(nearby, /playerInSessionBucket\(playerId, session, booth\)/);
  assert.match(selection, /tonumber\(session\.routingBucket\) == playerBucket/);
  assert.match(nearest, /playerBucket == boothBucket/);
  assert.match(eventBlock('requestSync'), /playerInSessionBucket\(source, session, booth\)/);
});
