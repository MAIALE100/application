local root=assert(arg[1])
dofile(root..'/config/shared.lua')
local queue,callbacks,messages,steps={},{},{},{}
local open,visible,stuck=true,true,false
local directOpens=true
local directRouteOnly=false
local registered,clock,openAt=nil,0,0
local function step(value)steps[#steps+1]=value end
GetCurrentResourceName=function()return 'wave' end
GetGameTimer=function()return 123 end
GetResourceState=function()return 'started' end
Wait=function(ms)clock=clock+(ms or 0)end
CreateThread=function(fn)queue[#queue+1]=fn end
AddEventHandler=function()end
RegisterNetEvent=function()end
RegisterNUICallback=function(name,fn)callbacks[name]=fn end
SendNUIMessage=function(message)messages[#messages+1]=message end
SetNuiFocus=function(keyboard,cursor)step('focus:'..tostring(keyboard)..':'..tostring(cursor))end
SetNuiFocusKeepInput=function()end
json={encode=function()return '{}' end}
exports={['lb-phone']={
 AddCustomApp=function(_,data)registered=data;return true end,RemoveCustomApp=function()return true end,
 ToggleOpen=function(_,value)open=value;if value then visible=true;openAt=clock elseif not stuck then visible=false end;if not value and registered then registered.onClose()end;step('phone:'..tostring(value))end,
 OpenApp=function(_,id)
  assert(id=='flecity_wave')
  if not open then
   if directRouteOnly then registered.onOpen();step('app:hidden');return end
   if not directOpens then error('phone must be open') end
   open=true;visible=true;openAt=clock-500
  end
  assert(clock-openAt>=500)
  registered.onOpen();step('app:'..id)
 end,
 IsOpen=function()return open end,IsPhoneOnScreen=function()return visible end,
 SetPhonePartiallyVisible=function()if not stuck then visible=false end end,
 SendCustomAppMessage=function(_,id,message)assert(id=='flecity_wave');messages[#messages+1]=message;return true end,
 AwaitCallback=function()return {ok=true}end
}}
assert(loadfile(root..'/client/main.lua'))()
local function runLast()local fn=assert(table.remove(queue));fn()end
runLast();assert(registered and registered.onOpen and registered.onClose);registered.onOpen()
local function call(action,payload,surface)
 local result
 callbacks['wave:callback']({action=action,payload=payload or {},surface=surface or 'phone'},function(value)result=value end)
 return result
end
local opened=call('waveScreenOpen',{state={view='studio',project={title='draft'}}})
assert(opened.ok and opened.lease)
local ready
callbacks['wave:callback']({action='waveScreenReady',payload={lease=opened.lease},surface='expanded'},function(value)ready=value end)
runLast()
assert(ready.ok and not open and not visible)
assert(steps[#steps]=='focus:true:true','focus must move after LB Phone is hidden')
local closed=call('waveScreenClose',{lease=opened.lease,state={view='studio',project={title='edited'}}},'expanded')
assert(closed.ok and not open)
assert(call('waveScreenClaim').parked,'hidden old iframe cannot claim before WAVE onOpen')
assert(call('bootstrap').ok,'new phone iframe must bootstrap before claiming return')
assert(call('listLibrary').error=='APP_SUSPENDED','other calls stay parked until claim')
runLast()
assert(steps[#steps]=='app:flecity_wave','return must select WAVE rather than phone home')
assert(messages[#messages].type=='waveScreenReturn')
local returned=call('waveScreenClaim')
assert(returned.ok and returned.state.project.title=='edited')
assert(call('waveScreenReturned',{lease=returned.lease}).ok)
stuck=true;open=true;visible=true
local failedOpen=call('waveScreenOpen',{state={view='library',project={title='safe'}}})
assert(failedOpen.ok)
local failedReady
callbacks['wave:callback']({action='waveScreenReady',payload={lease=failedOpen.lease},surface='expanded'},function(value)failedReady=value end)
local focusCount=#steps
runLast()
assert(failedReady.error=='PHONE_STILL_VISIBLE')
for i=focusCount+1,#steps do assert(steps[i]~='focus:true:true','never focus expanded NUI over a visible phone') end
runLast()
assert(steps[#steps]=='app:flecity_wave','failed expansion should reopen WAVE app')
local recovered=call('waveScreenClaim')
assert(recovered.ok and recovered.state.view=='library' and recovered.state.project.title=='safe')
assert(call('waveScreenReturned',{lease=recovered.lease}).ok)
stuck=false;directOpens=false;directRouteOnly=true
local fallbackOpen=call('waveScreenOpen',{state={view='profile',project={title='fallback'}}})
assert(fallbackOpen.ok)
local fallbackReady
callbacks['wave:callback']({action='waveScreenReady',payload={lease=fallbackOpen.lease},surface='expanded'},function(value)fallbackReady=value end)
runLast();assert(fallbackReady.ok)
assert(call('waveScreenClose',{lease=fallbackOpen.lease,state={view='profile',project={title='fallback'}}},'expanded').ok)
runLast()
assert(steps[#steps]=='app:flecity_wave','fallback must reopen WAVE after handset is open')
assert(call('waveScreenClaim').state.view=='profile')
print('PASS WAVE focus order, direct/fallback app return, visible-phone abort and state recovery')
