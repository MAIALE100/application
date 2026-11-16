local handlers,callbacks,commands,threads,sent,messages={},{},{},{},{},{}
local clock,dead,focused,keepInput,otherUi=1000,false,false,false,false
local focusWrites,keepInputWrites=0,0
local currentPed=99
local remotePresent=false
local exported={}
source=65535
LocalPlayer={state={}}
function GetCurrentResourceName()return 'flecity_jam'end
function GetGameTimer()return clock end
function PlayerPedId()return currentPed end
function PlayerId()return 0 end
function GetPlayerServerId()return 1 end
function SendNUIMessage(data)messages[#messages+1]=data end
function SetNuiFocus(value)focusWrites=focusWrites+1;focused=value end
function SetNuiFocusKeepInput(value)keepInputWrites=keepInputWrites+1;keepInput=value end
function IsNuiFocused()return focused or otherUi end
function IsPauseMenuActive()return false end
function IsEntityDead()return dead end
function IsPedRagdoll()return false end
function IsPedInAnyVehicle()return false end
function RegisterCommand(name,fn)commands[name]=fn end
function RegisterNUICallback(name,fn)callbacks[name]=fn end
function RegisterNetEvent(name,fn)handlers[name]=fn end
function AddEventHandler(name,fn)handlers[name]=fn end
function TriggerServerEvent(name,...)sent[#sent+1]={name=name,args={...}}end
function CreateThread(fn)threads[#threads+1]=coroutine.create(fn)end
function Wait(ms)coroutine.yield(ms)end
function DisableControlAction(_,id)assert(id~=249,'PTT must not be disabled')end
function DisablePlayerFiring()end
function DoesEntityExist(ped)return remotePresent and ped==103 end
function GetPlayerFromServerId(id)return id==3 and 3 or -1 end
function GetPlayerPed(index)return index+100 end
function GetEntityCoords(ped)
    if ped==currentPed then return {x=0,y=0,z=0} end
    return {x=2,y=0,z=0}
end
function GetGameplayCamRot()return {x=0,z=0} end
exports=function(name,fn)exported[name]=fn end
dofile('config.lua')
dofile('client/presentation.lua')
dofile('client/main.lua')
local count=0
local function test(name,fn)local ok,e=pcall(fn);assert(ok,name..': '..tostring(e));count=count+1;print('PASS '..name)end
local function call(name,data)
    local calls,result=0,nil
    callbacks[name](data or {},function(value)calls=calls+1;result=value end)
    assert(calls==1,'NUI callback must always respond exactly once');return result
end
test('another focused UI blocks opening without focus theft',function()
    otherUi=true;commands.jam(nil,{});assert(not focused);otherUi=false
end)
test('jamstop while another UI is focused does not release its focus',function()
    otherUi=true
    local beforeFocus,beforeKeep=focusWrites,keepInputWrites
    commands.jamstop()
    assert(focusWrites==beforeFocus and keepInputWrites==beforeKeep and IsNuiFocused())
    otherUi=false
end)
test('opening sets focus while keeping PTT input available',function()
    commands.jam(nil,{});assert(focused and keepInput);assert(call('ready').ok);assert(call('pulse').ok)
end)
test('start callback awaits matching server session',function()
    assert(call('start',{instrument='piano'}).ok);assert(not call('start',{instrument='piano'}).ok)
    local request=sent[#sent].args[2]
    source=1;handlers['flecity_jam:control']({kind='started',session='forged',request=request});source=65535
    assert(not call('input',{session='forged'}).ok)
    handlers['flecity_jam:control']({kind='started',session='s1',request=request,instrument='piano'})
    assert(call('input',{session='s1',kind='sync'}).ok)
end)
test('old wire data does not resurrect stopped remote session',function()
    handlers['flecity_jam:remote']({kind='snapshot',player=2,session='a',wire=2})
    handlers['flecity_jam:remote']({kind='stop',player=2,session='a',wire=3})
    local before=#messages;handlers['flecity_jam:remote']({kind='snapshot',player=2,session='a',wire=1});assert(#messages==before)
end)
test('first remote position precedes short note and retries when ped streams in',function()
    remotePresent=false
    local before=#messages
    handlers['flecity_jam:remote']({kind='snapshot',player=3,session='p1',wire=10,instrument='drums'})
    assert(messages[before+1].type=='remote')
    assert(messages[before+2].type=='positions' and #messages[before+2].sources==0)
    remotePresent=true
    before=#messages
    handlers['flecity_jam:remote']({kind='delta',player=3,session='p1',wire=11,ops={{kind='on',id=1,pitch=36},{kind='off',id=1}}})
    assert(messages[before+1].type=='positions' and messages[before+1].sources[1].player==3)
    assert(messages[before+2].type=='remote' and messages[before+2].data.kind=='delta')
    before=#messages
    handlers['flecity_jam:remote']({kind='delta',player=3,session='p1',wire=12,ops={{kind='on',id=2,pitch=38}}})
    assert(#messages==before+1 and messages[#messages].type=='remote','known position should not be resent per note')
    before=#messages
    handlers['flecity_jam:remote']({kind='snapshot',player=3,session='p1',wire=13,instrument='drums'})
    assert(messages[before+1].type=='remote' and messages[before+2].type=='positions',
        'a healing snapshot must position a recreated NUI slot')
    handlers['flecity_jam:remote']({kind='stop',player=3,session='p1',wire=14})
    before=#messages
    handlers['flecity_jam:remote']({kind='snapshot',player=3,session='p2',wire=15,instrument='drums'})
    assert(messages[before+1].type=='remote' and messages[before+2].type=='positions',
        'a replacement session must create its slot before positioning it')
    remotePresent=false
end)
test('NUI failure watchdog releases focus and held session',function()
    assert(coroutine.resume(threads[1]));clock=clock+5000;assert(coroutine.resume(threads[1]));assert(not focused and not keepInput)
    assert(not call('input',{session='s1'}).ok)
end)
test('late grant after closing is immediately cancelled',function()
    commands.jam(nil,{});call('start',{instrument='piano'});local request=sent[#sent].args[2];call('close')
    handlers['flecity_jam:control']({kind='started',session='late',request=request,instrument='piano'})
    assert(sent[#sent].name=='flecity_jam:stop' and sent[#sent].args[1]=='late');assert(not focused)
end)
test('death and resource stop cannot leave NUI focus',function()
    commands.jam(nil,{});dead=true;assert(coroutine.resume(threads[1]));assert(not focused and not keepInput)
    dead=false;commands.jam(nil,{});handlers.onClientResourceStop('flecity_jam');assert(not focused and not keepInput)
end)
test('permission adapters fail closed for unavailable inventory',function()
    dofile('server/access.lua');JamConfig.Access='open';assert(JamHasAccess(1,'piano'))
    JamConfig.Access='ace';function IsPlayerAceAllowed()return false end;assert(not JamHasAccess(1,'piano'))
    JamConfig.Access='ox_inventory';function GetResourceState()return 'stopped'end;assert(not JamHasAccess(1,'piano'))
    function GetResourceState()return 'started'end
    exports={ox_inventory={Search=function(_,src,mode,item)assert(src==1 and mode=='count' and item=='jam_piano');return 1 end}}
    assert(JamHasAccess(1,'piano'));exports.ox_inventory.Search=function()error('inventory failure')end;assert(not JamHasAccess(1,'piano'))
end)
test('item exports require a successful inventory use callback',function()
    exports={ox_inventory={useItem=function(_,data,cb)cb(false)end}}
    exported.UseGuitar({slot=1});assert(not focused)
    exports.ox_inventory.useItem=function(_,data,cb)assert(data.slot==1);cb(data)end
    exported.UseGuitar({slot=1});assert(focused);call('close');assert(not focused)
end)
print(('RESULT %d PASS / 0 FAIL (mocked FiveM client/access; NOT live FiveM)'):format(count))
