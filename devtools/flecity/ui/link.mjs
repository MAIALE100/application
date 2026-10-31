import assert from 'node:assert/strict';
import {installSoloFixture} from '../fixtures/link-solo.mjs';
import {soloScenario} from './link-solo.mjs';
export async function prepare(ctx,page){
  await page.addInitScript(()=>{
    let room=null;
    globalThis.__fixtureCalls=[];
    globalThis.fetchNui=async (event,request)=>{
      if(event!=='flecityGames:callback')throw Error('Unexpected mock event');
      globalThis.__fixtureCalls.push(request);
      const {action,payload}=request;
      if(action==='bridgePing')return {ok:true};
      if(action==='partyGetConfig')return {ok:true,config:{version:'offline-fixture',roomCodeLength:4,minPlayers:1,maxPlayers:2,plus:{enabled:false},
        games:[{id:'code_break',name:'ヒット＆ブロー',minPlayers:1,maxPlayers:2,description:'試験'},{id:'fall_battle',name:'FALL BATTLE',minPlayers:1,maxPlayers:2,description:'試験'}]}};
      if(action==='profileGetSettings')return {ok:true,settings:{sound:false,reducedMotion:true}};
      if(action==='partyGetRoom')return room?{ok:true,room}:{ok:false,error:'NOT_IN_ROOM'};
      if(action==='partyJoinRoom')return {ok:false,error:'ROOM_NOT_FOUND'};
      if(action==='partyCreateRoom'){
        room={code:'2468',revision:1,state:'lobby',selectedGame:'code_break',isHost:true,selfReady:false,connectedCount:1,
          players:[{memberId:'fixture',name:'試験プレイヤー',isHost:true,ready:false,appOpen:true,disconnected:false}]};
        return {ok:true,room};
      }
      if(action==='partySetReady'){room.selfReady=payload.ready;room.players[0].ready=payload.ready;room.revision++;return {ok:true,room};}
      return {ok:false,error:'UNMOCKED_ACTION'};
    };
  });
  return installSoloFixture(ctx,page);
}
export async function scenario(ctx,page){
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('LINK 準備完了'));
  await page.locator('#code').fill('12ab');
  assert.equal(await page.locator('#code').inputValue(),'12');
  await page.locator('#code').fill('1234');
  assert.equal(await page.locator('#code').inputValue(),'1234');
  await page.locator('#join').click();
  await page.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));
  assert(await page.locator('#entry').isVisible());
  await page.locator('#create').click();
  await page.locator('#room').waitFor();
  assert.equal(await page.locator('#roomCode').textContent(),'2468');
  assert(await page.locator('#start').isDisabled(),'Unready player must not start');
  await page.locator('#ready').click();
  await page.waitForFunction(()=>document.querySelector('#ready').textContent==='準備解除');
  assert(!(await page.locator('#start').isDisabled()));
  await page.setViewportSize({width:360,height:780});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at phone width');
  assert((await page.evaluate(()=>globalThis.__fixtureCalls)).every(r=>['bridgePing','partyGetConfig','profileGetSettings','partyGetRoom','partyJoinRoom','partyCreateRoom','partySetReady'].includes(r.action)));
  await soloScenario(ctx,page);
}
