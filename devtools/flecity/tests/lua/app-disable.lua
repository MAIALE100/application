-- Tests the real shared dispatcher and LINK+ disabled boundary without any engine/DB/bank calls.
local root=assert(arg[1])
GetGameTimer=function()return 100000 end
CreateThread=function()end RegisterCommand=function()end RegisterNetEvent=function()end AddEventHandler=function()end
MySQL=setmetatable({},{__index=function()error('DB forbidden in disabled app fixture')end})
FlecityGamesFramework={GetIdentifier=function()return 'FIXTURE'end,RemoveMoney=function()error('Bank forbidden')end,AddMoney=function()error('Bank forbidden')end}
dofile(root..'/config/shared.lua')
local f=assert(io.open(root..'/server/main.lua','rb'));local code=f:read('*a');f:close()
local dispatch=assert(load(code..'\nreturn safeCall','real-shared-dispatch'))()
local calls=0 local action=function()calls=calls+1;return {ok=true}end
assert(dispatch('flecity_games:party:createRoom',action,71001,{}).ok)
FlecityGamesConfig.Apps.Party.enabled=false
for _,name in ipairs({'getConfig','createRoom','startRound','subscribePlus','getPlus','cancelPlus'})do
 local before=calls local r=dispatch('flecity_games:party:'..name,action,71001,{})
 assert(r.error=='APP_DISABLED' and calls==before)
end
assert(dispatch('flecity_games:play:bootstrap',action,71001,{}).ok)
dofile(root..'/server/core/party_plus.lua')
assert(FlecityGamesPartyPlus.Subscribe(71001).error=='PARTY_PLUS_DISABLED')
local status=FlecityGamesPartyPlus.GetStatus(71001,true)
assert(status.ok and status.status.active==false and status.status.autoRenew==false)
FlecityGamesConfig.Apps.Party.enabled=true
FlecityGamesConfig.Apps.Play.enabled=false
assert(dispatch('flecity_games:play:startSession',action,71001,{}).error=='APP_DISABLED')
assert(dispatch('flecity_games:party:createRoom',action,71001,{}).ok)
print('PASS: disabled app callbacks never dispatch, LOOP-only mode cannot charge/renew LINK+, enabled sibling still works; no DB/bank/engine actions')
