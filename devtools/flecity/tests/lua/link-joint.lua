-- Isolated production handlers; virtual identities/clock/transport/entitlement only.
-- No FXServer, network, database, billing or real clients.
local root=assert(arg[1]) local tick=100000 local actors={} local identities={} local events=0
for i=1,4 do actors[i]=72000+i identities[actors[i]]='JOINT_'..i end
GetGameTimer=function()return tick end
GetCurrentResourceName=function()return 'flecity_games' end
GetResourceMetadata=function()return 'joint-fixture' end
MySQL=setmetatable({},{__index=function()error('DB forbidden')end})
TriggerClientEvent=function(event,s,payload)
 assert(identities[s],'non-fixture recipient');events=events+1
 if event=='flecity_games:client:partyUpdate' and payload.roundState and not payload.roundState.complete then
  local q=payload.roundState
  assert(q.secret==nil and q.topics==nil and q.roles==nil and q.wolfIdentifier==nil and q.correctAnswer==nil,'private broadcast field')
  if q.gameId=='draw' and not q.isDrawer then assert(q.prompt==nil)end
  if q.gameId=='ng_word' and not q.isExplainer then assert(q.targetWord==nil and q.forbiddenWords==nil)end
  if q.gameId=='memory_chain' and q.phase=='input' then assert(q.sequence==nil)end
 end
end
FlecityGamesFramework={GetIdentifier=function(s)return assert(identities[s],'non-fixture identity')end,GetCharacterName=function(s)return '試験'..assert(identities[s])end}
local entitled=true
FlecityGamesPartyPlus={CachedActive=function()return true end,HasAccess=function()return entitled end,GetConfigFor=function()return {enabled=true,active=true}end}
math.randomseed(20261031)
for _,f in ipairs({'config/shared.lua','shared/game_registry.lua','server/core/text.lua','server/core/rate_limit.lua','server/data/party_plus_prompts.lua','server/core/party_fall.lua'})do dofile(root..'/'..f)end
local h=assert(io.open(arg[2]or(root..'/server/core/party.lua'),'rb'));local code=h:read('*a');h:close()
local private=assert(load(code..'\nreturn {rooms=rooms}','joint-private-copy'))()
local p=FlecityGamesParty
local function copy(t)if type(t)~='table'then return t end local o={}for k,v in pairs(t)do o[k]=copy(v)end return o end
local function call(fn,s,d,err)
 tick=tick+1000 local r=fn(s,d)
 if err then assert(not r.ok and r.error==err,tostring(r.error)..' expected '..err)else assert(r.ok,tostring(r.error))end return copy(r)
end
local function encode(v)
 local t=type(v)if t=='nil'then return 'null' elseif t=='number'or t=='boolean'then return tostring(v)elseif t=='string'then return '"'..v:gsub('[%z\1-\31\\"]',function(c)if c=='"'then return '\\"'elseif c=='\\'then return '\\\\'end return ('\\u%04x'):format(c:byte())end)..'"'end
 assert(t=='table')local n,count=#v,0 for _ in pairs(v)do count=count+1 end local arr=n==count local out={}
 if arr then for i=1,n do out[#out+1]=encode(v[i])end else for k,x in pairs(v)do out[#out+1]=encode(tostring(k))..':'..encode(x)end table.sort(out)end
 return (arr and '['or'{')..table.concat(out,',')..(arr and ']'or'}')
end
local config=call(p.GetConfig,actors[1]).config local games={} local premiumDenied=0
assert(#config.games==15,'registry changed: audit coverage')
for _,g in ipairs(config.games)do
 local count=g.maxPlayers==2 and 2 or 4
 local room=call(p.CreateRoom,actors[1]).room
 for i=2,count do call(p.JoinRoom,actors[i],{code=room.code})end
 call(p.SelectGame,actors[2],{gameId=g.id},'HOST_ONLY')
 if g.premium then entitled=false;call(p.SelectGame,actors[1],{gameId=g.id},'PARTY_PLUS_REQUIRED');entitled=true;premiumDenied=premiumDenied+1 end
 call(p.SelectGame,actors[1],{gameId=g.id})
 for i=1,count do call(p.SetReady,actors[i],{ready=true})end
 room=call(p.StartRound,actors[1]).room
 local raw for _,r in pairs(private.rooms)do if r.code==room.code then raw=r break end end
 local rs=assert(raw).roundState local views={} local checks={'lobby','host-authorization','ready','start'}
 if g.id=='memory_chain' and not arg[2] then assert(rs.deadlineDurationSec==15,'memorize duration')end
 for i=1,count do
  local v=call(p.GetRoom,actors[i]).room views[i]=v local q=v.roundState local id=identities[actors[i]]
  assert(q.gameId==g.id and not q.complete)
  assert(q.secret==nil and q.wolfIdentifier==nil and q.topics==nil and q.roles==nil and q.correctAnswer==nil)
  if g.id=='word_wolf'then assert(q.secretTopic==rs.topics[id])end
  if g.id=='liar'then assert(q.role==rs.roles[id])end
  if g.id=='draw'then assert((q.prompt~=nil)==(id==rs.drawerIdentifier))end
  if g.id=='ng_word'then assert((q.targetWord~=nil)==(id==rs.explainerIdentifier))end
  if g.id=='telephone'then assert(q.chain==nil);if not q.isCurrent then assert(q.promptText==nil and q.promptStrokes==nil)end end
 end
 checks[#checks+1]='per-viewer-public-snapshot-privacy'
 local token=rs.token local completed=false
 local function currentActor()for i=1,count do if identities[actors[i]]==rs.currentIdentifier then return actors[i]end end error('missing current actor')end
 if g.id=='code_break'then
  call(p.SubmitCodeBreak,currentActor(),{token=token,guess=copy(rs.secret)});completed=true
 elseif g.id=='reversi'then
  for turn=1,64 do if rs.complete then break end local a=currentActor()local v=call(p.GetRoom,a).room.roundState
   call(p.SubmitReversi,a,{token=token,cell=assert(v.validMoves[1])})end completed=true
 elseif g.id=='gomoku'then
  local first=rs.currentIdentifier
  for turn=1,9 do local cell=rs.currentIdentifier==first and math.floor((turn+1)/2)or 11+math.floor(turn/2)
   call(p.SubmitGomoku,currentActor(),{token=token,cell=cell})end completed=true
 elseif g.id=='connect4'then
  local first=rs.currentIdentifier
  for turn=1,7 do call(p.SubmitConnect4,currentActor(),{token=token,column=rs.currentIdentifier==first and 1 or 2})end completed=true
 elseif g.id=='mini_shogi'then
  local a=currentActor()local move=call(p.GetRoom,a).room.roundState.legalMoves[1];assert(move)
  move.token=token;call(p.SubmitMiniShogi,a,move);checks[#checks+1]='public-legal-move-action'
 elseif g.id=='ng_word'then
  local explainer,guesser for i=1,count do if identities[actors[i]]==rs.explainerIdentifier then explainer=actors[i]else guesser=actors[i]end end
  call(p.SubmitNgWordClue,explainer,{token=token,clue='これは'..rs.forbiddenWords[1]..'です'},'TABOO_FORBIDDEN_WORD')
  assert(rs.phase=='clue' and rs.clue==nil,'rejected clue changed round')
  call(p.SubmitNgWordClue,explainer,{token=token,clue='x'},'INVALID_TEXT')
  assert(rs.phase=='clue' and rs.clue==nil,'invalid input counted as guess')
  call(p.SubmitNgWordClue,explainer,{token=token,clue='架空の説明テキスト'})
  call(p.SubmitNgWordGuess,guesser,{token=token,guess='絶対に違う答え'})
  assert(not rs.complete and rs.phase=='guess','wrong answer ended round')
  for i=1,count do if actors[i]~=explainer and actors[i]~=guesser then guesser=actors[i] break end end
  call(p.SubmitNgWordGuess,guesser,{token=token,guess=rs.targetWord});completed=true
 elseif g.id=='memory_chain'then
  tick=rs.deadlineTick+1;p.Cleanup()
  if arg[3]=='deadline-evidence'then print(encode({config=config,room=call(p.GetRoom,actors[1]).room,scope='memory deadline isolated real handler'}));os.exit(0)end
  assert(rs.phase=='input' and rs.deadlineDurationSec==30)
  for i=1,count do local view=call(p.GetRoom,actors[i]).room.roundState;assert(view.sequence==nil)end
  for i=1,count do call(p.SubmitMemoryChain,actors[i],{token=token,answer=table.concat(rs.sequence)})end
  assert(rs.stage==2 and rs.phase=='memorize' and not rs.complete,'successful answers must advance stage')
  checks[#checks+1]='successful-stage-advances-with-new-memorize-deadline'
  tick=rs.deadlineTick+1;p.Cleanup();assert(rs.phase=='input' and not rs.complete and rs.deadlineDurationSec==30)
  local expected=table.concat(rs.sequence) local wrong=expected:gsub('A','Z'):gsub('[BCD]','A'):gsub('Z','B')
  for i=1,count do call(p.SubmitMemoryChain,actors[i],{token=token,answer=i==count and expected or wrong})end completed=true
 elseif g.id=='bomb'then
  call(p.SubmitBombPass,currentActor(),{token=token});assert(rs.passes==1)
  tick=rs.bombFuseTick+1;call(p.SubmitBombPass,currentActor(),{token=token});completed=true
 elseif g.id=='word_wolf'or g.id=='liar'or g.id=='vote'then
  tick=tick+80000
  local fn=g.id=='word_wolf'and p.SubmitWordWolfVote or g.id=='liar'and p.SubmitLiarVote or p.SubmitVote
  for i=1,count do local target=views[i%count+1].players local targetId=nil for _,m in ipairs(target)do if m.name=='試験'..identities[actors[i%count+1]]then targetId=m.memberId end end
   call(fn,actors[i],{token=token,targetMemberId=assert(targetId)})end completed=true
 elseif g.id=='draw'then
  local drawer,other for i=1,count do if identities[actors[i]]==rs.drawerIdentifier then drawer=actors[i]else other=actors[i]end end
  local points={{x=.1,y=.2},{x=.8,y=.7}}
  call(p.AddDrawStroke,other,{token=token,points=points},'DRAWER_ONLY');call(p.AddDrawStroke,drawer,{token=token,points=points})
  for i=1,count do if actors[i]~=drawer then local r=call(p.GetRoom,actors[i]);assert(#r.room.roundState.strokes==1);assert(r.room.roundState.prompt==nil);call(p.SubmitDrawGuess,actors[i],{token=token,guess=rs.prompt})end end completed=true
 elseif g.id=='telephone'then
  for step=1,count do
   local actor for i=1,count do if identities[actors[i]]==rs.currentIdentifier then actor=actors[i]end end
   if rs.mode=='draw'then call(p.SubmitTelephoneDrawing,assert(actor),{token=token,strokes={{{x=.1,y=.1},{x=.7,y=.7}}}})
   else call(p.SubmitTelephoneText,assert(actor),{token=token,text='試験のお題'})end
  end completed=true
 elseif g.id=='fake_answer'then
  for i=1,count do call(p.SubmitFakeAnswer,actors[i],{token=token,answer='仮の答え'..i})end
  assert(rs.phase=='vote')
  for i=1,count do local option for _,v in ipairs(rs.options)do if v.creatorIdentifier~=identities[actors[i]]then option=v.id break end end call(p.SubmitFakeVote,actors[i],{token=token,optionId=option})end completed=true
 elseif g.id=='fall_battle'then
  for i=1,count do call(p.SubmitFallBattle,actors[i],{token=token,history={{x=3,rotation=0,hold=false,t=100}}})end completed=true
 end
 local resultView
 if completed then assert(rs.complete,g.id..' did not complete');resultView=call(p.GetRoom,actors[1]).room;checks[#checks+1]='real-handler-actions-to-results';call(p.ReturnLobby,actors[1]);checks[#checks+1]='return-lobby'
  if g.id=='memory_chain'then
   for i=1,count do call(p.SetReady,actors[i],{ready=true})end call(p.StartRound,actors[1]);local timeout=raw.roundState
   tick=timeout.deadlineTick+1;p.Cleanup();assert(timeout.phase=='input' and not timeout.complete)
   tick=timeout.deadlineTick+1;p.Cleanup();assert(timeout.complete and timeout.results,'unanswered input must resolve')
   checks[#checks+1]='unanswered-input-deadline-resolves';call(p.ReturnLobby,actors[1])
  end
  for i=1,count do call(p.SetReady,actors[i],{ready=true})end call(p.StartRound,actors[1]);checks[#checks+1]='next-round-restart'
 else checks[#checks+1]='full-game-completion-NOT_RUN'end
 -- Disconnect during lobby or active round; stable member identity on a new source.
 local old=actors[count] local oldId=identities[old] local before=call(p.GetRoom,old).room
 local memberId for _,m in ipairs(before.players)do if m.name=='試験'..oldId then memberId=m.memberId end end
 p.DropSource(old)
 local disconnected=call(p.GetRoom,actors[1]).room local found=false
 for _,m in ipairs(disconnected.players)do if m.memberId==memberId then assert(m.disconnected);found=true end end assert(found)
 local fresh=old+100 identities[fresh]=oldId actors[count]=fresh
 local resumed=call(p.GetRoom,fresh).room local same=false
 for _,m in ipairs(resumed.players)do if m.memberId==memberId then assert(not m.disconnected);same=true end end assert(same and resumed.playerCount==count)
 checks[#checks+1]='disconnect-new-source-reconnect-stable-member'
 for i=1,count do call(p.LeaveRoom,actors[i])end
 local rooms,members=p.DebugCounts()assert(rooms==0 and members==0)
 games[#games+1]={id=g.id,players=count,views=views,resultView=resultView,checks=checks,completed=completed}
end
print(encode({games=games,config=config,events=events,premiumDenied=premiumDenied,dbWrites=0,scope='isolated Lua handlers; virtual transport; not real multiplayer'}))
