import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const resourceDir = path.resolve(testDir, '..');
const fixture = readFileSync(path.join(testDir, 'collection-recovery.integration.lua'), 'utf8');
const config = readFileSync(path.join(resourceDir, 'config.lua'), 'utf8');
const main = readFileSync(path.join(resourceDir, 'server', 'main.lua'), 'utf8');
const marker = '-- @PRODUCTION_MAIN_LOADER@';
assert.equal(fixture.split(marker).length - 1, 1, 'production loader marker must occur once');

let delimiter = '';
for (let count = 0; count < 16; count += 1) {
  const candidate = '='.repeat(count);
  if (!main.includes(`]${candidate}]`)) {
    delimiter = candidate;
    break;
  }
}
assert.notEqual(delimiter, '', 'could not quote production Lua source safely');
const open = `[${delimiter}[`;
const close = `]${delimiter}]`;
const loader = `local __productionMainSource = ${open}\n${main}\n${close}\nlocal function loadProductionMain()\n  local source = __productionMainSource .. [[\nFlecityTestHooks = {\n  playerInBoothBucket = playerInBoothBucket,\n  playerInSessionBucket = playerInSessionBucket,\n}\n]]\n  local chunk, err = load(source, "@server/main.lua")\n  assert(chunk, err)\n  chunk()\nend`;
const program = `${config}\n${fixture.replace(marker, loader)}`;
const fengariScript = process.env.FENGARI_NODE_SCRIPT;
const fengari = process.env.FENGARI_BIN || 'fengari';
if (!fengariScript && process.platform === 'win32' && /\.(cmd|bat)$/i.test(fengari)) {
  throw new Error('Windows .cmd runners are not executed through a shell. Set FENGARI_NODE_SCRIPT to fengari-node-cli/src/lua-cli.js.');
}
const result = spawnSync(fengariScript ? process.execPath : fengari,
  fengariScript ? [fengariScript, '-'] : ['-'], {
    cwd: resourceDir,
    input: program,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 4 * 1024 * 1024,
  });
if (result.error) throw result.error;
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
assert.equal(result.status, 0, `isolated Lua integration failed with exit ${result.status}`);
assert.match(result.stdout, /FLEPURI isolated accounting integration: 11\/11 PASS/);