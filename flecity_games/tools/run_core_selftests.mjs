import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  'flecity_games/config/shared.lua',
  'flecity_games/shared/game_registry.lua',
  'flecity_games/server/core/text.lua',
  'flecity_games/server/core/party_fall.lua',
  'flecity_games/server/data/party_plus_prompts.lua',
  'flecity_games/server/core/party.lua',
  'flecity_games/server/core/play.lua',
];

const sources = files.map((file) => [file, readFileSync(path.join(root, file), 'utf8')]);
const luaQuote = (source) => {
  for (let i = 0; i < 16; i += 1) {
    const eq = '='.repeat(i);
    if (!source.includes(`]${eq}]`)) return `[${eq}[${source}]${eq}]`;
  }
  throw new Error('Could not quote Lua source safely');
};

let lua = `FlecityGamesFramework = { GetIdentifier = function() return 'fixture' end, GetCharacterName = function() return 'fixture' end }
FlecityGamesPartyPlus = { HasAccess = function() return true end }
RegisterNetEvent = function() end
AddEventHandler = function() end
RegisterCommand = function() end
CreateThread = function() end
SetTimeout = function() end
TriggerClientEvent = function() end
GetGameTimer = function() return 0 end
GetPlayers = function() return {} end
`;
for (const [name, source] of sources) {
  lua += `do local chunk, err = load(${luaQuote(source)}, ${luaQuote(`@${name}`)}); assert(chunk, err); chunk() end\n`;
}
lua += `
-- FiveM provides its own JSON codec; the local harness reports those two checks as NOT_RUN.
json = { encode = function() return '{}' end, decode = function() return nil end }
local games = FlecityGamesRegistry.List(nil, true)
local loop = FlecityGamesRegistry.List('play', true)
local link = FlecityGamesRegistry.List('party', true)
print(('REGISTERED games=%d LOOP=%d LINK=%d'):format(#games,#loop,#link))
for _, appGames in ipairs({loop, link}) do
  for _, game in ipairs(appGames) do print(('GAME %s | %s'):format(game.app, game.name)) end
end
assert(#games == 30 and #loop == 15 and #link == 15, 'game registry inventory changed')

local suites = {
  text = FlecityGamesText.DebugSelftest,
  play = FlecityGamesPlay.DebugSelftest,
  party = FlecityGamesParty.DebugSelftest,
  party_fall = FlecityGamesPartyFall.DebugSelftest,
}
local total, passed = 0, 0
for name, run in pairs(suites) do
  local result = run()
  for key, ok in pairs(result) do
    if name == 'play' and (key == 'saveRoundTrip' or key == 'saveWithinLimit') then
      print(('NOT_RUN %s.%s requires the FiveM JSON runtime'):format(name,key))
    else
      total = total + 1
      if ok == true then passed = passed + 1 else io.stderr:write('FAIL ', name, '.', key, '\\n') end
    end
  end
end
print(('Flecity games core selftests: %d/%d PASS'):format(passed,total))
assert(total > 0 and passed == total, 'one or more selftests failed')
`;

const fengariScript = process.env.FENGARI_NODE_SCRIPT;
const executable = fengariScript ? process.execPath : (process.env.FENGARI_BIN || 'fengari');
const args = fengariScript ? [fengariScript, '-'] : ['-'];
const result = spawnSync(executable, args, { input: lua, encoding: 'utf8', shell: false, maxBuffer: 4 * 1024 * 1024 });
if (result.error) throw result.error;
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
assert.equal(result.status, 0, `Flecity games core selftests failed with exit ${result.status}`);
