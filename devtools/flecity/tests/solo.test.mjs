import test from 'node:test';import assert from 'node:assert/strict';
import {project,luaRuntime} from '../core.mjs';
import {soloTranscript,verifySoloTranscript} from '../fixtures/link-solo.mjs';
test('four real Lua solo APIs reject stale tokens, finish, and clean up; independent result checks reject corruption',t=>{
 if(!luaRuntime()){t.skip('Lua 5.4 unavailable');return;}
 const r=soloTranscript(project('link').source);assert.equal(verifySoloTranscript(r),true);
 for(const change of [r=>r.games[1].result.blackCount++,r=>r.games[2].result.winningCells[0]=1,r=>r.games[3].result.winnerName='AI']){
   const corrupt=structuredClone(r);change(corrupt);assert.throws(()=>verifySoloTranscript(corrupt));
 }
});
