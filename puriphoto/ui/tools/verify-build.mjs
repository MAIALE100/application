import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
const clientLua = await readFile(path.resolve(here, '../../client/v11.lua'), 'utf8');
const appSource = await readFile(path.resolve(here, '../src/App.tsx'), 'utf8');
const manifest = await readFile(path.resolve(here, '../../fxmanifest.lua'), 'utf8');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');

assert.match(html, /<html lang="ja">/i, 'built page keeps Japanese document language');
assert.doesNotMatch(html, /\/src\/index\.tsx|localhost:3000/, 'built page must not point to Vite source/dev server');
assert.match(manifest, /version\s+"1\.1\.1"/, 'resource manifest version matches the source release');
assert.match(manifest, /ui_page\s+"ui\/dist\/index\.html"/, 'resource loads the verified production UI');
for (const marker of ['OpenBoothImport', 'CancelBoothImport', 'puriphotoGetBoothImport', 'puriphotoConfirmBoothImport', 'boothImportConsumed']) {
  assert.ok(clientLua.includes(marker), `client handoff contract exists: ${marker}`);
}
assert.match(appSource, /puriphotoConfirmBoothImport/);
assert.match(appSource, /lastAppliedBoothImportToken/);

const entries = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
  .map((match) => match[1])
  .filter((url) => !/^https?:\/\//i.test(url));
assert.ok(entries.some((url) => url.endsWith('.js')), 'built JavaScript entry is linked');
assert.ok(entries.some((url) => url.endsWith('.css')), 'built CSS entry is linked');

function diskPath(url) {
  const pathname = new URL(url, 'https://puriphoto.invalid').pathname;
  const relative = pathname.replace(/^\/ui\/dist\//, '').replace(/^\//, '');
  assert.ok(!relative.startsWith('..'), `entry stays inside the UI dist: ${url}`);
  return path.join(dist, relative);
}

let jsFile;
let cssFile;
for (const entry of entries) {
  const file = diskPath(entry);
  const info = await stat(file);
  assert.ok(info.isFile() && info.size > 1000, `built entry exists and is non-empty: ${entry}`);
  if (entry.endsWith('.js')) jsFile = file;
  if (entry.endsWith('.css')) cssFile = file;
}

const [bundle, css] = await Promise.all([
  readFile(jsFile, 'utf8'),
  readFile(cssFile, 'utf8'),
]);
for (const marker of ['boothImportAvailable', 'puriphotoGetBoothImport', 'puriphotoConfirmBoothImport']) {
  assert.ok(bundle.includes(marker), `built bundle retains FLEPURI handoff support: ${marker}`);
}

for (const asset of [
  'icon.svg',
  'icon.webp',
  'screenshot-dark.png',
  'screenshot-light.png',
  'frames/frame01-landscape.webp',
  'frames/frame01-portrait.webp',
]) {
  const info = await stat(path.join(dist, asset));
  assert.ok(info.isFile() && info.size > 0, `required public asset exists: ${asset}`);
}

console.log(`PuriPhoto built UI verified: JS ${Buffer.byteLength(bundle)} B, CSS ${Buffer.byteLength(css)} B, FLEPURI bridge and public assets present.`);
