import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const html=read('web/party/index.html');
const script=read('web/party/app.js');
const css=read('web/shared/app.css');
const errors=read('web/shared/errors.js');

test('LINK+ account controls are inside collapsible Settings, not a top-of-page banner',()=>{
 const appStart=html.indexOf('<main class="wrap">');
 const entry=html.indexOf('<section id="entry"');
 const settings=html.indexOf('<details class="card settings-card global-settings"');
 const plus=html.indexOf('<details id="partyPlusCard"');
 const end=html.indexOf('</main>');
 assert(appStart>=0 && entry>appStart && settings>entry && plus>settings && plus<end);
 assert.equal((html.match(/id="partyPlusCard"/g)||[]).length,1);
 assert(!html.includes('<details id="partyPlusCard" open'));
});

test('premium selection rejection opens its Settings panel; payment remains explicit',()=>{
 assert.match(script,/function openLinkPlusSettings\(\)/);
 assert.match(script,/partyPlusCard\.closest\('details\.global-settings'\)/);
 assert.match(script,/if\(res\.error==='PARTY_PLUS_REQUIRED'\)openLinkPlusSettings\(\)/);
 assert.match(script,/partyPlusConfirmUntil=now\+2500/);
 assert.match(script,/FlecityBridge\.call\('partySubscribePlus'/);
 assert(!css.includes('background:linear-gradient(135deg,#f5edc9,#efe2a8)'));
});

test('legacy PARTY+ copy never appears in user-facing error messages',()=>{
 assert(!errors.includes('PARTY+'));
 assert.match(errors,/PARTY_PLUS_REQUIRED: 'このゲームはホストのLINK\+加入が必要です'/);
 assert.match(errors,/SUBSCRIPTION_SAVE_FAILED: 'LINK\+の有効期限を保存できませんでした'/);
});
