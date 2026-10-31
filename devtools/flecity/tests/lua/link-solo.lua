-- Real Party APIs in a separate Lua process. Framework/Plus/clock are fixtures.
-- DB, network and non-fixture actors fail closed. Never run inside FXServer.
local root=assert(arg[1])
local source=71001
local tick=100000
GetGameTimer=function() return tick end
GetCurrentResourceName=function() return 'flecity_games' end
GetResourceMetadata=function() return 'offline-solo-test' end
TriggerClientEvent=function(_,target) assert(target==source,'non-fixture event target') end
MySQL=setmetatable({},{__index=function() error('DB forbidden in solo fixture') end})
FlecityGamesFramework={GetIdentifier=function(s) assert(s==source,'non-fixture identity');return 'FCT_OFFLINE_SOLO' end,
 GetCharacterName=function(s) assert(s==source);return 'Fixture' end}
FlecityGamesPartyPlus={CachedActive=function()return false end,HasAccess=function()return true end,
 GetConfigFor=function()return {enabled=false} end}
dofile(root..'/config/shared.lua')
dofile(root..'/shared/game_registry.lua')
dofile(root..'/server/core/text.lua')
dofile(root..'/server/core/rate_limit.lua')
local handle=assert(io.open(root..'/server/core/party.lua','rb'));local code=handle:read('*a');handle:close()
local expose=[[
 return {rooms=rooms,allMoves=miniShogiAllMoves,check=miniShogiInCheck,
 reversiAi=reversiAiMove,connectDrop=connect4DropCell,guess=codeBreakAiGuess}
]]
local rules=assert(load(code..expose,'production-party-private-copy'))()
local function encode(value)
 local t=type(value)
 if t=='nil' then return 'null' end
 if t=='boolean' or t=='number' then return tostring(value) end
 if t=='string' then return '"'..value:gsub('[%z\1-\31\\"]',function(c)
  if c=='"' then return '\\"' elseif c=='\\' then return '\\\\' end
  return ('\\u%04x'):format(c:byte()) end)..'"' end
 assert(t=='table','JSON type '..t)
 local n,count=#value,0 for _ in pairs(value) do count=count+1 end
 local arr=n==count local out={}
 if arr then for i=1,n do out[#out+1]=encode(value[i]) end
 else for k,v in pairs(value) do out[#out+1]=encode(tostring(k))..':'..encode(v) end table.sort(out) end
 return (arr and '[' or '{')..table.concat(out,',')..(arr and ']' or '}')
end
local games={}
for seed,game in ipairs({'code_break','reversi','connect4','mini_shogi'}) do
 math.randomseed(1200+seed)
 local p=FlecityGamesParty local steps={}
 local function call(action,fn,data,expectError)
  tick=tick+1000
  local response=fn(source,data)
  if expectError then assert(response.ok==false and response.error==expectError,response.error or action)
  else assert(response.ok==true,action..':'..tostring(response.error)) end
  steps[#steps+1]='{"action":'..encode(action)..',"payload":'..encode(data or {})..',"response":'..encode(response)..'}'
  return response
 end
 local config=p.GetConfig(source)
 call('partyCreateRoom',p.CreateRoom)
 call('partySelectGame',p.SelectGame,{gameId=game})
 if game=='mini_shogi' then call('partySetShogiOptions',p.SetShogiOptions,{aiDifficulty='easy'}) end
 if game=='code_break' then
  call('partySetMastermindOptions',p.SetMastermindOptions,{aiDifficulty='hard',allowDuplicates=true,turnLimit=true,firstTurn='random'})
  call('partySetMastermindOptions',p.SetMastermindOptions,{aiDifficulty='hard',allowDuplicates=true,turnLimit=false,firstTurn='random'})
  call('partySetMastermindOptions',p.SetMastermindOptions,{aiDifficulty='hard',allowDuplicates=true,turnLimit=false,firstTurn='host'})
 end
 call('partySetReady',p.SetReady,{ready=true})
 local response=call('partyStartRound',p.StartRound)
 assert(response.room.roundState.aiEnabled==true,'AI not enabled')
 local callbacks={code_break={'partySubmitCodeBreak',p.SubmitCodeBreak},reversi={'partySubmitReversi',p.SubmitReversi},
  connect4={'partySubmitConnect4',p.SubmitConnect4},mini_shogi={'partySubmitMiniShogi',p.SubmitMiniShogi}}
 local callback=callbacks[game]
 local before=encode(p.GetRoom(source).room)
 tick=tick+1000
 local invalid=callback[2](source,{token='wrong'})
 assert(not invalid.ok and invalid.error=='ROUND_TOKEN_MISMATCH','invalid token accepted')
 assert(encode(p.GetRoom(source).room.roundState)==encode(response.room.roundState),'invalid token changed state')
 local turns=0
 while not response.room.roundState.complete do
  local rs=response.room.roundState local data={token=rs.token}
  if game=='code_break' then data.guess=rules.guess(rs.history,'hard',true)
  elseif game=='reversi' then data.cell=rules.reversiAi(rs.board,'B')
  elseif game=='connect4' then for col=1,7 do if rules.connectDrop(rs.board,col) then data.column=col break end end
  else
   local moves=rs.legalMoves assert(#moves>0,'no player move')
   local move=moves[((turns*7)%#moves)+1]
   for k,v in pairs(move) do data[k]=v end
  end
  response=call(callback[1],callback[2],data);turns=turns+1
  if game=='mini_shogi' and turns==4 then
   -- A named local tactical fixture tests actual legal-move and checkmate handling.
   -- Full initial-position shogi match is separate coverage, not claimed here.
   local room for _,r in pairs(rules.rooms) do room=r break end
   local rs=room.roundState rs.board={} for i=1,81 do rs.board[i]='' end
   rs.board[1]='WK';rs.board[81]='BK';rs.board[11]='BR';rs.board[20]='BG';rs.board[12]='BG'
   rs.hands={B={R=0,B=0,G=0,S=0,N=0,L=0,P=0},W={R=0,B=0,G=0,S=0,N=0,L=0,P=0}}
   response=call('partyGetRoom',p.GetRoom)
   response=call(callback[1],callback[2],{token=rs.token,type='move',from=11,to=10,promote=false})
   assert(response.room.roundState.complete and response.room.roundState.results.reason=='CHECKMATE','tactical mate failed')
  end
  assert(turns<90,'bounded match did not finish')
 end
 assert(response.room.roundState.results,'missing result')
 local final=response.room.roundState.results
 call('partyLeaveRoom',p.LeaveRoom)
 local roomCount,memberCount=p.DebugCounts();assert(roomCount==0 and memberCount==0,'room cleanup failed')
 games[#games+1]='{"game":'..encode(game)..',"turns":'..turns..',"tacticalFixture":'..tostring(game=='mini_shogi')..',"config":'..encode(config)..',"result":'..encode(final)..',"steps":['..table.concat(steps,',')..']}'
end
print('{"mode":"offline-real-lua","dbWrites":0,"nonFixtureActors":0,"games":['..table.concat(games,',')..']}')
