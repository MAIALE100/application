-- Real Lua handlers with four independent virtual identities; no network, DB or real clients.
local root=assert(arg[1]) local tick=100000 local actors={71001,71002,71003,71004}
local valid={} for _,s in ipairs(actors) do valid[s]=true end
math.randomseed(20261031)
GetGameTimer=function()return tick end
GetCurrentResourceName=function()return 'flecity_games' end
GetResourceMetadata=function()return 'offline-multiplayer-fixture' end
TriggerClientEvent=function(_,s)assert(valid[s],'non-fixture recipient')end
MySQL=setmetatable({},{__index=function()error('DB forbidden')end})
FlecityGamesFramework={GetIdentifier=function(s)assert(valid[s]);return 'FCT_MULTI_'..s end,GetCharacterName=function(s)assert(valid[s]);return 'Fixture'..s end}
FlecityGamesPartyPlus={CachedActive=function()return false end,HasAccess=function()return true end,GetConfigFor=function()return {enabled=false}end}
dofile(root..'/config/shared.lua') dofile(root..'/shared/game_registry.lua')
dofile(root..'/server/core/text.lua') dofile(root..'/server/core/rate_limit.lua') dofile(root..'/server/core/party.lua')
local p=FlecityGamesParty
local function call(fn,s,data,expected)
 tick=tick+2000 local r=fn(s,data)
 if expected then assert(not r.ok and r.error==expected,tostring(r.error))else assert(r.ok,tostring(r.error))end return r
end
local room=call(p.CreateRoom,actors[1]).room
for i=2,4 do call(p.JoinRoom,actors[i],{code=room.code}) end
assert(call(p.GetRoom,actors[1]).room.playerCount==4)
call(p.JoinRoom,actors[4],{code=room.code}) -- duplicate join must not add another member
assert(call(p.GetRoom,actors[1]).room.playerCount==4)
call(p.SelectGame,actors[2],{gameId='connect4'},'HOST_ONLY')
for i=3,4 do call(p.LeaveRoom,actors[i])end
call(p.SelectGame,actors[1],{gameId='connect4'})
call(p.StartRound,actors[2],nil,'HOST_ONLY')
for i=1,2 do call(p.SetReady,actors[i],{ready=true})end
room=call(p.StartRound,actors[1]).room
assert(room.roundState.aiEnabled==false)
local first=call(p.GetRoom,actors[1]).room.roundState.isCurrent and actors[1] or actors[2]
local second=first==actors[1] and actors[2] or actors[1]
local token=room.roundState.token
call(p.SubmitConnect4,first,{column=1,token='stale'},'ROUND_TOKEN_MISMATCH')
call(p.SubmitConnect4,second,{column=2,token=token},'NOT_YOUR_TURN')
call(p.SubmitConnect4,first,{column=1,token=token})
call(p.SubmitConnect4,first,{column=1,token=token},'NOT_YOUR_TURN') -- duplicate/out-of-turn
for turn=2,7 do room=call(p.SubmitConnect4,turn%2==1 and first or second,{column=turn%2==1 and 1 or 2,token=token}).room end
assert(room.roundState.complete and room.roundState.results.reason=='FOUR_IN_ROW')
assert(room.roundState.results.winnerName=='Fixture'..first)
for i=1,2 do call(p.LeaveRoom,actors[i])end
local rooms,members=p.DebugCounts()assert(rooms==0 and members==0)
print('PASS: 4-actor lobby, duplicate join, host authorization, 2-actor connect4, stale/duplicate/out-of-turn rejection, victory, cleanup; seed=20261031; DB/network writes=0; deterministic interleaving, not live synchronization')
