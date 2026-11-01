-- Forty independent virtual sources against the real room handlers. No FXServer/DB.
local root=assert(arg[1]);local roomTotal=tonumber(arg[2])==48 and 12 or 10
local players=roomTotal*4;local tick=100000;local ids={};local actors={}
for i=1,players do actors[i]=81000+i;ids[actors[i]]='LOAD_'..i end
GetGameTimer=function()return tick end
GetCurrentResourceName=function()return 'flecity_games' end
GetResourceMetadata=function()return 'isolated-load-test' end
MySQL=setmetatable({},{__index=function()error('DB forbidden')end})
TriggerClientEvent=function(_,source)assert(ids[source],'unexpected recipient')end
FlecityGamesFramework={GetIdentifier=function(source)return assert(ids[source])end,GetCharacterName=function(source)return 'Virtual'..ids[source]end}
FlecityGamesPartyPlus={CachedActive=function()return true end,HasAccess=function()return true end,GetConfigFor=function()return {enabled=true,active=true}end}
math.randomseed(20261102)
for _,file in ipairs({'config/shared.lua','shared/game_registry.lua','server/core/text.lua','server/core/rate_limit.lua','server/data/party_plus_prompts.lua','server/core/party_fall.lua','server/core/party.lua'})do dofile(root..'/'..file)end
local party=FlecityGamesParty;local rooms={};local started=os.clock();collectgarbage('collect');local initialKb=collectgarbage('count')
local function call(fn,source,data)
 tick=tick+1000;local result=fn(source,data);assert(result.ok,tostring(result.error));return result
end
for roomIndex=1,roomTotal do
 local base=(roomIndex-1)*4;local host=actors[base+1]
 local room=call(party.CreateRoom,host).room
 local gameId=roomIndex%2==0 and 'fall_battle' or 'ng_word'
 call(party.SelectGame,host,{gameId=gameId})
 for n=2,4 do call(party.JoinRoom,actors[base+n],{code=room.code})end
 for n=1,4 do call(party.SetReady,actors[base+n],{ready=true})end
 room=call(party.StartRound,host).room
 assert(room.roundState.gameId==gameId and room.roundState.token)
 rooms[#rooms+1]={code=room.code,token=room.roundState.token,base=base,gameId=gameId}
end
local distinct={};for _,room in ipairs(rooms)do assert(not distinct[room.token]);distinct[room.token]=true end
for _,room in ipairs(rooms)do
 for n=1,4 do
  local source=actors[room.base+n];local view=call(party.GetRoom,source).room
  assert(view.code==room.code and view.roundState.token==room.token)
  assert(view.roundState.secret==nil)
  if not view.roundState.isExplainer then assert(view.roundState.forbiddenWords==nil) end
 end
end
local roomsCount,membersCount=party.DebugCounts();assert(roomsCount==roomTotal and membersCount==players)
local peakKb=collectgarbage('count')
for _,room in ipairs(rooms)do for n=4,1,-1 do call(party.LeaveRoom,actors[room.base+n])end end
roomsCount,membersCount=party.DebugCounts();assert(roomsCount==0 and membersCount==0)
for roomIndex=1,4 do
 local host,guest=actors[(roomIndex-1)*2+1],actors[(roomIndex-1)*2+2]
 local room=call(party.CreateRoom,host).room
 call(party.SelectGame,host,{gameId=roomIndex%2==0 and 'telephone' or 'ng_word'})
 call(party.JoinRoom,guest,{code=room.code})
 call(party.SetPracticeAi,host,{enabled=true,count=2,difficulty='normal'})
 call(party.SetReady,host,{ready=true});call(party.SetReady,guest,{ready=true})
 room=call(party.StartRound,host).room
 assert(room.roundState and room.roundState.token)
 rooms[roomIndex]={host=host,guest=guest,code=room.code}
end
roomsCount,membersCount=party.DebugCounts();assert(roomsCount==4 and membersCount==16)
for roomIndex=1,4 do local room=rooms[roomIndex];call(party.LeaveRoom,room.guest);call(party.LeaveRoom,room.host)end
roomsCount,membersCount=party.DebugCounts();assert(roomsCount==0 and membersCount==0)
collectgarbage('collect')
print(('PASS virtual_players=%d rooms=%d ai_rooms=4 ai_members=8 cleanup_rooms=0 cleanup_members=0 peak_lua_kb=%.0f retained_lua_kb=%.0f elapsed_cpu_ms=%.1f scope=Lua_mock_not_FiveM_clients'):format(players,roomTotal,peakKb,collectgarbage('count')-initialKb,(os.clock()-started)*1000))
