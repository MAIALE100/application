local root=assert(arg[1])
dofile(root..'/config/shared.lua')
local queue,callbacks,messages,steps={},{},{},{}
local open,visible,stuck=true,true,false
local function step(value)steps[#steps+1]=value end
GetCurrentResourceName=function()return 'wave' end
GetGameTimer=function()return 123 end
GetResourceState=function()return 'started' end
Wait=function()end
CreateThread=function(fn)queue[#queue+1]=fn end
AddEventHandler=function()end
RegisterNetEvent=function()end
RegisterNUICallback=function(name,fn)callbacks[name]=fn end
SendNUIMessage=function(message)messages[#messages+1]=message end
SetNuiFocus=function(keyboard,cursor)step('focus:'..tostring(keyboard)..':'..tostring(cursor))end
SetNuiFocusKeepInput=function()end
json={encode=function()return '{}' end}
exports={['lb-phone']={
 AddCustomApp=function()return true end,RemoveCustomApp=function()return true end,
 ToggleOpen=function(_,value)open=value;if value then visible=true elseif not stuck then visible=false end;step('phone:'..tostring(value))end,
 IsOpen=function()return open end,IsPhoneOnScreen=function()return visible end,
 SetPhonePartiallyVisible=function()if not stuck then visible=false end end,
 SendCustomAppMessage=function(_,id,message)assert(id=='flecity_wave');messages[#messages+1]=message;return true end,
 AwaitCallback=function()return {ok=true}end
}}
assert(loadfile(root..'/client/main.lua'))()
local function runLast()local fn=assert(table.remove(queue));fn()end
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
assert(closed.ok and open)
runLast()
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
local recovered=call('waveScreenClaim')
assert(recovered.ok and recovered.state.view=='library' and recovered.state.project.title=='safe')
print('PASS WAVE focus order, Studio return, visible-phone abort and state recovery')
