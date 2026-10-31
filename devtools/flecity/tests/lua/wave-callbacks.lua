local root=assert(arg[1],'WAVE source path required')
dofile(root..'/config/shared.lua')
local callbacks={}
local tick=0
local charged,credited,transactions=0,0,0
local txSuccess=true
local walletBalance=5000
local trackStatus='public'
local adminAllowed=false
local streamSettlements=0
local schemaCreates,seedWrites=0,0
local artist={id=9,status='active',citizenid='CREATOR'}
local player={PlayerData={citizenid='BUYER',charinfo={firstname='Test',lastname='Buyer'},job={name='unemployed',isboss=false}},Functions={
 RemoveMoney=function(kind,amount) assert(kind=='bank');charged=charged+amount;return true end,
 AddMoney=function(kind,amount) assert(kind=='bank');credited=credited+amount;return true end
}}
exports={qbx_core={GetPlayer=function()return player end},['lb-phone']={RegisterCallback=function(_,name,fn)callbacks[name]=fn end}}
GetCurrentResourceName=function()return 'wave' end
GetResourceState=function()return 'started' end
GetResourceMetadata=function()return '0.3.5-test' end
GetGameTimer=function()return tick end
IsPlayerAceAllowed=function()return adminAllowed end
Wait=function()end
AddEventHandler=function()end
RegisterCommand=function()end
CreateThread=function(fn)fn()end
json={encode=function()return '{}' end,decode=function()return {} end}
MySQL={
 ready=function(fn)fn()end,
 query={await=function(sql)
  if sql:match('^CREATE TABLE IF NOT EXISTS') then schemaCreates=schemaCreates+1 end
  if sql:find('INSERT INTO wave_platform_wallet',1,true) or sql:find('INSERT INTO wave_schema_meta',1,true) then seedWrites=seedWrites+1 end
  if sql:find('wave_stream_daily',1,true) then streamSettlements=streamSettlements+1 end
  return {}
 end},
 single={await=function(sql)
  if sql:find('SELECT t.id,t.price,t.access_mode',1,true) then return {id=7,price=5000,access_mode='purchase',creator_citizenid='CREATOR'} end
  if sql:find('SELECT balance,lifetime_earned,frozen',1,true) then return {balance=walletBalance,lifetime_earned=9000,frozen=0} end
  if sql:find('SELECT * FROM wave_artists',1,true) then return artist end
  if sql:find('WHERE artist_id=? AND project_id=?',1,true) then return nil end
  if sql:find('SELECT id,status FROM wave_tracks',1,true) then return {id=7,status=trackStatus} end
  if sql:find('SELECT t.id,t.duration_seconds,t.access_mode',1,true) then return {id=7,duration_seconds=120,access_mode='purchase',creator_citizenid='CREATOR'} end
  return nil
 end},
 scalar={await=function(sql)
  if sql:find('wave_projects WHERE id=',1,true) then return 1 end
  return 0
 end},
 update={await=function()return 1 end},
 insert={await=function()return 42 end},
 transaction={await=function()transactions=transactions+1;return txSuccess end}
}
assert(loadfile(root..'/server/main.lua'))()
assert(schemaCreates==19 and seedWrites==2,'startup schema writes changed unexpectedly')
streamSettlements=0
local function call(name,data)
 tick=tick+2000
 local fn=assert(callbacks['wave:'..name],name..' callback missing')
 return fn(1,data or {})
end
assert(call('adminOverview').error=='FORBIDDEN')
assert(call('adminTrackAction',{trackId=7,action='delete'}).error=='FORBIDDEN')
assert(call('adminArtistAction',{artistId=9,action='freeze'}).error=='FORBIDDEN')
assert(call('adminReportAction',{reportId=2,action='dismiss'}).error=='FORBIDDEN')
local project={bpm=120,bars=1,title='Test',tracks={{name='Lead',instrument='sine',notes={{step=0,pitch=60,length=1,velocity=0.8}}}}}
assert(call('saveProject',{title='Test',project=project}).id==42)
local published=call('publishTrack',{requestId='mock-1',projectId=42,title='Test',project=project,rightsConfirmed=true,accessMode='purchase',price=5000})
assert(published.ok and published.id==42)
local purchase=call('purchaseTrack',{trackId=7})
assert(purchase.ok and purchase.price==5000 and purchase.creatorAmount==4250 and purchase.platformAmount==750)
assert(charged==5000 and credited==0 and transactions==1)
txSuccess=false
local failed=call('purchaseTrack',{trackId=7})
assert(failed.error=='LEDGER_FAILED' and charged==10000 and credited==5000 and transactions==2)
local payout=call('withdraw')
assert(payout.ok and payout.amount==walletBalance and credited==10000)
walletBalance=999
assert(call('withdraw').error=='NOTHING_TO_WITHDRAW')
artist.status='active';trackStatus='public'
assert(call('updateOwnTrack',{trackId=7,action='unpublish'}).status=='private')
trackStatus='private'
assert(call('updateOwnTrack',{trackId=7,action='publish'}).status=='public')
artist.status='suspended'
assert(call('updateOwnTrack',{trackId=7,action='publish'}).error=='ARTIST_SUSPENDED')
assert(call('recordStream',{trackId=7,validSeconds=30}).ignored=='PREVIEW')
assert(streamSettlements==0,'preview must not settle creator revenue')
adminAllowed=true
assert(call('adminOverview').ok)
assert(call('adminTrackAction',{trackId=7,action='suspend',reason='mock'}).status=='suspended')
assert(WaveConfig.Subscription.enabled==false)
print('PASS WAVE mocked callbacks: save/publish/private/public, preview no settlement, disabled subscription, purchase split/refund, withdrawal, ordinary/admin permission; no real bank/DB access')
