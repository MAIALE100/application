-- Real LOOP algorithm selftests, with engine and JSON codec isolated.
local root=assert(arg[1])
GetGameTimer=function()return 100000 end GetCurrentResourceName=function()return 'flecity_games'end
GetResourceMetadata=function()return 'offline-regression'end
MySQL=setmetatable({},{__index=function()error('DB forbidden in pure LOOP rules')end})
local encoded={} local serial=0
json={encode=function(t)serial=serial+1;local s='fixture-json-'..serial;encoded[s]=t;return s end,decode=function(s)return encoded[s]end}
dofile(root..'/config/shared.lua') dofile(root..'/shared/game_registry.lua') dofile(root..'/server/core/text.lua') dofile(root..'/server/core/play.lua')
local count,skipped=0,0
for name,ok in pairs(FlecityGamesPlay.DebugSelftest())do
 if name=='saveRoundTrip' or name=='saveWithinLimit' then skipped=skipped+1
 else assert(ok==true,'LOOP algorithm failed: '..name);count=count+1 end
end
assert(count>50 and skipped==2)
print('PASS: '..count..' real LOOP rule/replay/score/timing invariants; NOT_RUN: 2 JSON-codec checks; DB/network/FiveM=not used')
