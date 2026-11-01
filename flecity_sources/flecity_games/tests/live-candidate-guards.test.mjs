import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('web/party/app.js'),html=read('web/party/index.html');
test('telephone missing drawing fails closed with explicit recovery UI',()=>{
 assert.match(html,/id="telephoneRetry"/);
 assert.match(js,/validDrawing=Array\.isArray\(rs\.promptStrokes\)/);
 assert.match(js,/telephoneTextControls\.classList\.remove\('hidden'\)/);
 assert.match(js,/if\(!validDrawing\)/);
 assert.match(js,/telephoneRetry\.onclick=.*refresh/);
});
test('telephone outgoing drawing and text resolve uncertain ack by refresh, not replay',()=>{
 assert.match(js,/function submitTelephoneText\(/);
 assert.match(js,/partySubmitTelephoneDrawing/);
 assert.match(js,/partySubmitTelephoneText/);
 assert.match(js,/送信結果を確認しています/);
 assert(!/setTimeout\(.*partySubmitTelephoneDrawing/.test(js));
});
test('taboo uncertain ack leaves the clue intact and checks the server',()=>{
 const body=js.slice(js.indexOf('async function submitNgWordClue('),js.indexOf('async function submitNgWordGuess('));
 assert.match(body,/NUI_REQUEST_TIMEOUT/);
 assert.match(body,/await refresh\(\)/);
 assert.match(body,/res\.matchedTerm/);
});
