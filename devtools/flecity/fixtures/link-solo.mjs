import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {command,luaRuntime,tool,json,sha} from '../core.mjs';
export function soloTranscript(source){
 const lua=luaRuntime();if(!lua)throw Error('Verified Lua runtime required');
 const r=command(lua,[path.join(tool,'tests/lua/link-solo.lua'),source],{timeout:60000});
 if(!r.ok)throw Error(r.output||r.error);
 const transcript=JSON.parse(r.output);assert.equal(transcript.games.length,4);assert.equal(transcript.dbWrites,0);
 transcript.sourceHash=sha(fs.readFileSync(path.join(source,'server/core/party.lua')));verifySoloTranscript(transcript);return transcript;
}
export function verifySoloTranscript(t){
 assert.deepEqual(t.games.map(g=>g.game),['code_break','reversi','connect4','mini_shogi']);
 for(const g of t.games){
  const start=g.steps.find(s=>s.action==='partyStartRound').response.room.roundState;assert.equal(start.aiEnabled,true);
  const end=g.steps.filter(s=>s.action.startsWith('partySubmit')).at(-1).response.room.roundState;
  assert.equal(end.complete,true);assert.deepEqual(end.results,g.result);
  if(g.game==='reversi'){
   const b=g.result.board.filter(x=>x==='B').length,w=g.result.board.filter(x=>x==='W').length;
   assert.equal(g.result.blackCount,b);assert.equal(g.result.whiteCount,w);
   assert.equal(g.result.winnerName,b>w?'Fixture':w>b?'AI':undefined);
  }else if(g.game==='connect4'){
   const cells=g.result.winningCells;assert.equal(cells.length,4);
   const mark=g.result.winnerName==='AI'?'Y':'R';assert(cells.every(i=>g.result.board[i-1]===mark));
   const delta=cells[1]-cells[0];assert([1,6,7,8].includes(Math.abs(delta)));
   assert(cells.every((i,n)=>i===cells[0]+n*delta));
   const positions=cells.map(i=>({r:Math.floor((i-1)/7),c:(i-1)%7}));
   for(let n=1;n<4;n++){assert(Math.abs(positions[n].r-positions[n-1].r)<=1);assert(Math.abs(positions[n].c-positions[n-1].c)<=1);}
  }else if(g.game==='code_break'){
   const winner=g.result.entries.find(e=>e.winner);assert(winner?.solved);
   const history=winner.name==='AI'?end.aiHistory:end.history;
   assert(history.some(h=>h.guess.every((n,i)=>n===g.result.secret[i])));
  }else{
   assert.equal(g.tacticalFixture,true);assert.equal(g.result.reason,'CHECKMATE');assert.equal(g.result.winnerName,'Fixture');
   assert.equal(g.result.board[9],'BR');assert.equal(g.result.board[10],'');assert.equal(g.result.board[0],'WK');
  }
 }
 return true;
}
export async function installSoloFixture(ctx,page){
 const transcript=soloTranscript(ctx.source);json(path.join(ctx.run.dir,'link-solo-transcript.json'),transcript);
 let active=null,position=0,room=null;const calls=[],errors=[];
 ctx.solo={transcript,activate(game){active=game;position=0;room=null;},position:()=>position,
   tactical(){const s=active.steps[position];assert.equal(s.action,'partyGetRoom');room=s.response.room;position++;},
   verify(){assert.equal(position,active.steps.length);},errors};
 await page.exposeFunction('__linkSolo',request=>{
  if(!active)return {active:false};
  const {action,payload={}}=request;calls.push({game:active.game,action,payload});
  if(action==='screenClaim')return {active:true,response:{ok:true}};
  if(action==='bridgePing')return {active:true,response:{ok:true}};
  if(action==='partyGetConfig')return {active:true,response:active.config};
  if(action==='profileGetSettings')return {active:true,response:{ok:true,settings:{sound:false,reducedMotion:true}}};
  if(action==='partyGetRoom')return {active:true,response:room?{ok:true,room}:{ok:false,error:'NOT_IN_ROOM'}};
  try{
   const expected=active.steps[position];assert(expected,'Unexpected extra callback '+action);
   assert.equal(action,expected.action);assert.deepEqual(payload,Object.keys(expected.payload).length?expected.payload:{});
   position++;if(expected.response.room)room=expected.response.room;if(action==='partyLeaveRoom')room=null;
   return {active:true,response:expected.response};
  }catch(e){errors.push(e.message);return {active:true,response:{ok:false,error:'FIXTURE_SCOPE_DENIED'}};}
 });
 await page.addInitScript(()=>{
  const original=globalThis.fetchNui;
  globalThis.fetchNui=async(event,request)=>{const r=await globalThis.__linkSolo(request);return r.active?r.response:original(event,request);};
 });
 return {cleanup(){json(path.join(ctx.run.dir,'logs','link-solo-callbacks.json'),calls);
  assert.deepEqual(errors,[]);if(active)ctx.solo.verify();return 'Real Lua transcripts consumed exactly; fixture rooms removed; no network/DB';}};
}
