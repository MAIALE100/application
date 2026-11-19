// LINK presentation only. The existing app owns every NUI request and game state.
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 // Registered before the shared surface controller: Escape closes a modal first.
 window.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||event.isComposing)return;
  const dialog=document.querySelector('#linkSettingsDialog[open],#linkProfileDialog[open]');
  if(!dialog)return;
  event.preventDefault();event.stopImmediatePropagation();dialog.close();
 },true);
 const paths={
  back:'m15 18-6-6 6-6',plus:'M12 5v14M5 12h14',
  rooms:'M8 10H5v4m-2-2h4m9-2h.01M19 14h.01M7 6h10a4 4 0 0 1 4 4l1 7a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l1-7a4 4 0 0 1 4-4Z',
  settings:'m9 3-.6 3-2.6 1-2.5-1.1-2 3.4 2 2.1-.1 2.9-2 1.9 2 3.5 2.8-.8 2.4 1L9 23h4l.6-3 2.6-1 2.5 1.1 2-3.4-2-2.1.1-2.9 2-1.9-2-3.5-2.8.8-2.4-1L13 3Z M14.7 13a3.7 3.7 0 1 1-7.4 0 3.7 3.7 0 0 1 7.4 0',
  person:'M20 21v-2a6 6 0 0 0-12 0v2M14 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8',
  door:'M4 21h16M5 21V3h14v18M5 3l10 3v15M11 12h.01',
  copy:'M9 8h11v13H9zM15 8V3H4v13h5',
  check:'m5 12 4 4L19 6',lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  crown:'m3 5 4 5 5-7 5 7 4-5-3 14H6L3 5ZM6 22h12',
  link:'M10 13a5 5 0 0 0 7 .5l4-4a5 5 0 0 0-7-7l-2.3 2.3M14 11a5 5 0 0 0-7-.5l-4 4a5 5 0 0 0 7 7l2.3-2.3',
  search:'M21 21l-5-5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0',
  info:'M12 11v6M12 7h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0'
 };
 const icon=(name,cls='')=>'<svg class="link-icon '+cls+'" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name]||paths.rooms)+'"/></svg>';
 let access=null,view='home',wasInRoom=false,lastName='',cardsKey='';
 function setView(next,focus=true){
  if(!access)return;
  const room=access.getRoom();
  if(room){render(room,access.getConfig());return;}
  view=next;
  for(const [name,id] of [['home','linkHome'],['join','linkJoinView'],['create','linkCreateView']])$(id).classList.toggle('hidden',name!==view);
  document.body.dataset.linkView=view;
  $('linkPageTitle').textContent=({home:'LINK',join:'ルーム参加',create:'ルーム作成'})[view];
  $('linkBack').classList.toggle('hidden',view==='home');
  $('linkNavRooms').setAttribute('aria-current',view==='join'?'page':'false');
  $('linkNavCreate').setAttribute('aria-current',view==='create'?'page':'false');
  $('linkNavCreate').disabled=false;
  if(focus){
   window.scrollTo({top:0,behavior:'instant'});
   if(view==='join')$('code').focus({preventScroll:true});
   else if(view==='create')$('create').focus({preventScroll:true});
   else $('linkProfile').focus({preventScroll:true});
  }
 }
 function updateProfile(config){
  const active=config?.plus?.active===true;
  $('linkProfile').classList.toggle('is-member',active);
  $('linkProfileName').textContent=lastName||'プロフィール';
  $('linkProfileDisplayName').textContent=lastName||'プレイヤー';
  $('linkProfileHelp').textContent=lastName?'ゲーム内のプレイヤー名':'ルームに入るとプレイヤー名を表示します。';
  $('linkMembership').textContent=active?'LINK+ 加入中':'LINK';
  $('linkProfileCrown').classList.toggle('hidden',!active);
 }
 const symbols={code_break:'●●',reversi:'◑',vote:'✓',gomoku:'五',connect4:'●',mini_shogi:'将',word_wolf:'狼',liar:'？',draw:'✎',telephone:'↔',ng_word:'禁',fake_answer:'偽',bomb:'♧',memory_chain:'◇',fall_battle:'▦'};
 function renderCards(room,config){
  const games=Array.isArray(config.games)?config.games:[];
  const key=JSON.stringify(games.map(g=>[g.id,g.name,g.premium,g.minPlayers,g.maxPlayers]));
  if(key!==cardsKey){
   cardsKey=key;$('linkGameCards').replaceChildren();
   for(const game of games){
    const b=document.createElement('button');b.type='button';b.className='link-game-card';b.dataset.game=game.id;
    const art=document.createElement('span');art.className='link-game-art';art.textContent=symbols[game.id]||'◇';
    const title=document.createElement('span');title.className='link-game-name';title.textContent=game.name;
    const badge=document.createElement('span');badge.className='link-game-badge';badge.innerHTML=icon('crown');badge.append('LINK+');
    badge.classList.toggle('hidden',!game.premium);
    const selected=document.createElement('span');selected.className='link-game-check';selected.innerHTML=icon('check');
    const lock=document.createElement('span');lock.className='link-game-lock';lock.innerHTML=icon('lock');
    b.append(art,badge,title,selected,lock);$('linkGameCards').append(b);
   }
  }
  for(const b of $('linkGameCards').children){
   const game=games.find(g=>g.id===b.dataset.game),chosen=b.dataset.game===room.selectedGame;
   const locked=!!game?.premium&&!room.hostPlusActive;
   b.disabled=!room.isHost;
   b.classList.toggle('is-selected',chosen);b.classList.toggle('is-locked',locked);
   b.setAttribute('aria-pressed',String(chosen));
   b.setAttribute('aria-label',String(game?.name||b.dataset.game)+(locked?' · ホストのLINK+加入が必要':''));
   b.querySelector('.link-game-lock').classList.toggle('hidden',!locked);
  }
 }
 function render(room,config){
  if(!access)return;
  updateProfile(config);
  if(!room)return;
  wasInRoom=true;
  const self=(room.players||[]).find(p=>p.memberId===room.selfMemberId);
  if(self?.name){lastName=String(self.name);updateProfile(config);}
  const host=(room.players||[]).find(p=>p.isHost);
  $('linkRoomName').textContent=host?.name?String(host.name)+'のルーム':'ルーム';
  const selected=(config.games||[]).find(g=>g.id===room.selectedGame);
  const capacity=Math.min(Number(config.maxPlayers)||10,Number(selected?.maxPlayers)||10);
  $('linkParticipantCount').textContent='参加者（'+(room.players||[]).filter(p=>!p.disconnected).length+'/'+capacity+'）';
  $('linkHostBadge').textContent=room.isHost?'ホストのみ':'閲覧のみ';
  $('linkNavCreate').disabled=true;
  const inRound=room.state!=='lobby';
  document.body.dataset.linkView=inRound?'round':'lobby';
  $('linkPageTitle').textContent='ルームロビー';$('linkBack').classList.add('hidden');
  $('linkNavRooms').setAttribute('aria-current','page');$('linkNavCreate').setAttribute('aria-current','false');
  if(!inRound){
   renderCards(room,config);
   const game=(config.games||[]).find(g=>g.id===room.selectedGame);
   $('linkGameSettingsTitle').textContent='ゲーム設定'+(game?'（'+String(game.name)+'）':'');
   $('linkSettingsEmpty').classList.toggle('hidden',['mastermindLobbyOptions','shogiLobbyOptions','drawingLobbyOptions','practiceAiOptions'].some(id=>!$(id).classList.contains('hidden')));
   $('linkReadyState').textContent=$('start').disabled?$('start').textContent:'全員準備完了';
   $('linkReadyState').classList.toggle('is-ready',!$('start').disabled);
  }
 }
 async function copyCode(){
  const text=$('roomCode').textContent;
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
   else{
    const field=document.createElement('textarea');field.value=text;field.className='link-copy-field';document.body.append(field);field.select();
    const copied=document.execCommand('copy');field.remove();if(!copied)throw Error('copy unavailable');
   }
   access.status('ルームIDをコピーしました。','good');
  }catch(_){access.status('コピーできませんでした。ルームID: '+text,'warn');}
 }
 function openSettings(){
  $('linkProfileDialog').close();
  $('linkSettingsDialog').querySelector('details.global-settings').open=true;
  if(!$('linkSettingsDialog').open)$('linkSettingsDialog').showModal();
 }
 window.LinkUi={
  init(value){
   access=value;
   document.body.classList.add('link-v2');
   document.querySelectorAll('[data-link-icon]').forEach(el=>el.innerHTML=icon(el.dataset.linkIcon));
   $('linkNavRooms').onclick=()=>setView('join');$('linkNavCreate').onclick=()=>setView('create');
   $('linkBack').onclick=()=>setView('home');
   $('linkSettings').onclick=openSettings;
   $('linkProfile').onclick=()=>{updateProfile(access.getConfig());$('linkProfileDialog').showModal();};
   $('linkProfileSettings').onclick=openSettings;
   $('linkCopyCode').onclick=copyCode;
   document.querySelectorAll('[data-link-close]').forEach(b=>b.onclick=()=>$(b.dataset.linkClose).close());
   for(const id of ['linkSettingsDialog','linkProfileDialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
   $('linkGameCards').onclick=e=>{
    const b=e.target.closest('button[data-game]');if(!b||b.disabled)return;
    const room=access.getRoom();if(!room?.isHost||room.state!=='lobby'||b.dataset.game===room.selectedGame)return;
    $('game').value=b.dataset.game;$('game').dispatchEvent(new Event('change',{bubbles:true}));
   };
   $('code').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('join').click();}});
   setView('home',false);updateProfile(access.getConfig());
  },
  enter(){if(wasInRoom){view='home';wasInRoom=false;}setView(view,false);},
  render,updateProfile,openSettings,avatarIcon:()=>icon('person'),
  snapshot:()=>({view,lastName}),
  restore(state){
   if(!state)return;
   if(['home','join','create'].includes(state.view))view=state.view;
   if(typeof state.lastName==='string')lastName=state.lastName;
   wasInRoom=false;
  }
 };
})();
