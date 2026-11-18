local handlers,callbacks,commands,threads,sent,messages={},{},{},{},{},{}
local clock,dead,paused,focused,keepInput,otherUi=1000,false,false,false,false,false
local focusWrites,keepInputWrites=0,0
local controlWrites,detectedTalking,pttEnabled={},false,true
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
function IsPauseMenuActive()return paused end
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
function SetControlNormal(pad,id,value)
    assert(id==249 and (pad==0 or pad==1 or pad==2) and value==1.0,'only held PTT input may be injected')
    controlWrites[#controlWrites+1]={pad=pad,id=id,value=value}
end
function IsControlEnabled()return pttEnabled end
function IsControlPressed()return #controlWrites>0 end
function IsNuiFocusKeepingInput()return keepInput end
function MumbleIsPlayerTalking()return detectedTalking and 1 or 0 end
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
local function voiceConfig()
    for i=#messages,1,-1 do if messages[i].voice then return messages[i].voice end end
    error('voice configuration missing')
end
local function frame()
    assert(coroutine.resume(threads[1]))
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
test('opening gives JAM exclusive keyboard focus without changing other resources',function()
    local beforeFocus,beforeKeep=focusWrites,keepInputWrites
    commands.jam(nil,{})
    assert(focused and not keepInput and focusWrites==beforeFocus+1 and keepInputWrites==beforeKeep+1)
    assert(call('ready').ok);assert(call('pulse').ok)
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
test('clock rollback releases JAM focus pending starts and held PTT before a late grant',function()
    local savedClock=clock
    commands.jam(nil,{});clock=2147483640;assert(call('pulse').ok)
    assert(call('start',{instrument='piano'}).ok);local request=sent[#sent].args[2]
    local token=voiceConfig().token;assert(call('voice',{token=token,seq=1,held=true}).ok)
    clock=-2147479136;local writes=#controlWrites
    handlers['flecity_jam:control']({kind='started',session='wrapped-late',request=request,instrument='piano'})
    assert(not focused and not keepInput and not voiceConfig().enabled)
    assert(sent[#sent].name=='flecity_jam:stop' and sent[#sent].args[1]=='wrapped-late')
    frame();assert(#controlWrites==writes)
    clock=savedClock;commands.jam(nil,{});assert(call('start',{instrument='piano'}).ok);call('close')
end)

test('clock rollback and exact heartbeat deadline release UI without waiting for another callback',function()
    local savedClock=clock
    for _,delta in ipairs({-2147483648,4500})do
        commands.jam(nil,{});assert(focused);clock=clock+delta;frame()
        assert(not focused and not keepInput and not voiceConfig().enabled)
        clock=savedClock
    end
end)

test('clock rollback expires remote peer state instead of sending stale positions indefinitely',function()
    local savedClock=clock;remotePresent=true;clock=2147483640
    handlers['flecity_jam:remote']({kind='snapshot',player=3,session='wrapped-peer',wire=1000,instrument='piano'})
    assert(coroutine.resume(threads[2]))
    local before=#messages;clock=-2147479136
    assert(coroutine.resume(threads[2]))
    local expired=false
    for i=before+1,#messages do if messages[i].type=='expire' and messages[i].session=='wrapped-peer' then expired=true end end
    assert(expired,'wrapped game timer must not retain remote peer state')
    clock=savedClock;remotePresent=false
end)

test('optional guitar loading stops at timeout or clock rollback without spawning a prop',function()
    local savedClock=clock;local released,spawned=0,0
    function joaat(name)return name end
    function RequestAnimDict()end
    function RequestModel()end
    function HasAnimDictLoaded()return false end
    function HasModelLoaded()return false end
    function SetModelAsNoLongerNeeded()released=released+1 end
    function CreateObject()spawned=spawned+1;return 0 end
    JamConfig.Presentation=true
    for _,delta in ipairs({-2147483648,2500})do
        local task=coroutine.create(function()JamPresentation.start('guitar',function()return true end)end)
        assert(coroutine.resume(task));clock=clock+delta
        assert(coroutine.resume(task));assert(coroutine.status(task)=='dead')
        clock=savedClock
    end
    assert(released==2 and spawned==0);JamConfig.Presentation=false
end)

test('stopping performance keeps JAM focus until panel exit',function()
    commands.jam(nil,{});assert(focused and not keepInput)
    assert(call('stop').ok);assert(focused and not keepInput)
    commands.jam(nil,{});assert(not focused and not keepInput)
end)
test('late grant after closing is immediately cancelled',function()
    commands.jam(nil,{});call('start',{instrument='piano'});local request=sent[#sent].args[2];call('close')
    handlers['flecity_jam:control']({kind='started',session='late',request=request,instrument='piano'})
    assert(sent[#sent].name=='flecity_jam:stop' and sent[#sent].args[1]=='late');assert(not focused and not keepInput)
end)
test('denied pending start remains in JAM until the player closes it',function()
    commands.jam(nil,{});assert(call('start',{instrument='piano'}).ok)
    local request=sent[#sent].args[2]
    handlers['flecity_jam:control']({kind='denied',reason='permission',request=request})
    assert(focused and not keepInput)
    call('close');assert(not focused and not keepInput)
end)
test('death and resource stop cannot leave NUI focus',function()
    commands.jam(nil,{});dead=true;assert(coroutine.resume(threads[1]));assert(not focused and not keepInput)
    dead=false;commands.jam(nil,{});handlers.onClientResourceStop('flecity_jam');assert(not focused and not keepInput)
end)
test('pause and access loss release only JAM focus',function()
    commands.jam(nil,{});paused=true;assert(coroutine.resume(threads[1]));assert(not focused and not keepInput)
    paused=false;commands.jam(nil,{});LocalPlayer.state.invOpen=true
    assert(coroutine.resume(threads[1]));assert(not focused and not keepInput)
    LocalPlayer.state.invOpen=false
end)
test('resource stop while another UI owns focus does not release that UI',function()
    otherUi=true
    local beforeFocus,beforeKeep=focusWrites,keepInputWrites
    handlers.onClientResourceStop('flecity_jam')
    assert(focusWrites==beforeFocus and keepInputWrites==beforeKeep and IsNuiFocused())
    otherUi=false
end)

test('NUI PTT requires a current epoch strict boolean and monotonic bounded sequence',function()
    commands.jam(nil,{});local config=voiceConfig();assert(config.enabled and type(config.token)=='string')
    for _,data in ipairs({{token='stale',seq=1,held=true},{token=config.token,seq=1,held=1},
        {token=config.token,seq=0,held=true},{token=config.token,seq=1.5,held=true},
        {token=config.token,seq=2147483648,held=true},{token=config.token,seq=0/0,held=true}}) do
        assert(not call('voice',data).ok)
    end
    assert(call('voice',{token=config.token,seq=1,held=true}).held)
    assert(not call('voice',{token=config.token,seq=1,held=false}).ok)
    assert(call('voice',{token=config.token,seq=2,held=false}).ok)
    call('close');assert(not call('voice',{token=config.token,seq=3,held=true}).ok)
end)

test('PTT injects only native 249 every held frame without enabling game input or flooding NUI',function()
    commands.jam(nil,{});local token=voiceConfig().token
    assert(call('voice',{token=token,seq=1,held=true}).ok)
    frame();local writes,beforeMessages=#controlWrites,#messages;frame()
    assert(#controlWrites==writes+3 and #messages==beforeMessages)
    assert(controlWrites[writes+1].pad==0 and controlWrites[writes+2].pad==1 and controlWrites[writes+3].pad==2)
    assert(focused and not keepInput)
    detectedTalking=true;frame();assert(messages[#messages].type=='voiceState' and messages[#messages].talking)
    detectedTalking=false;assert(call('voice',{token=token,seq=2,held=false}).ok)
    writes=#controlWrites;frame();assert(#controlWrites==writes)
    call('close')
end)

test('PTT renewals expire within 900ms and old renewals cannot resurrect an expired lease',function()
    commands.jam(nil,{});local token=voiceConfig().token
    assert(call('voice',{token=token,seq=1,held=true}).ok)
    clock=clock+200;assert(call('voice',{token=token,seq=2,held=true}).ok)
    clock=clock+899;local writes=#controlWrites;frame();assert(#controlWrites==writes+3)
    clock=clock+1;writes=#controlWrites;frame();assert(#controlWrites==writes)
    assert(messages[#messages].type=='voiceState' and not messages[#messages].held and messages[#messages].expired)
    assert(voiceConfig().token~=token)
    assert(not call('voice',{token=token,seq=3,held=true}).ok)
    call('close')
end)

test('a late renewal cannot extend an expired PTT lease before the next client frame',function()
    commands.jam(nil,{});local token=voiceConfig().token
    assert(call('voice',{token=token,seq=1,held=true}).ok)
    clock=clock+901;local writes=#controlWrites
    assert(not call('voice',{token=token,seq=2,held=true}).ok)
    assert(voiceConfig().token~=token and messages[#messages].expired and not messages[#messages].held)
    frame();assert(#controlWrites==writes);call('close')
end)

test('performance stop rotates the PTT epoch and key release or close never writes a zero control',function()
    commands.jam(nil,{});local token=voiceConfig().token
    assert(call('voice',{token=token,seq=1,held=true}).ok);frame()
    local writes=#controlWrites;assert(call('stop').ok);assert(voiceConfig().token~=token)
    assert(not call('voice',{token=token,seq=2,held=true}).ok);frame();assert(#controlWrites==writes)
    token=voiceConfig().token;assert(call('voice',{token=token,seq=1,held=true}).ok)
    assert(call('voice',{token=token,seq=2,held=false}).ok);frame();assert(#controlWrites==writes)
    call('close');assert(not voiceConfig().enabled);frame();assert(#controlWrites==writes)
end)

test('PTT fails closed on timer rollover and server stop or denial invalidate queued holds',function()
    commands.jam(nil,{});local token=voiceConfig().token
    assert(call('voice',{token=token,seq=1,held=true}).ok)
    local beforeClock,writes=clock,#controlWrites;clock=clock-2147483648;frame()
    assert(#controlWrites==writes and voiceConfig().token~=token and not focused and not voiceConfig().enabled)
    clock=beforeClock;commands.jam(nil,{});assert(call('pulse').ok)
    assert(call('start',{instrument='piano'}).ok);local request=sent[#sent].args[2]
    token=voiceConfig().token;assert(call('voice',{token=token,seq=1,held=true}).ok)
    handlers['flecity_jam:control']({kind='denied',request=request,reason='permission'})
    assert(voiceConfig().token~=token and not call('voice',{token=token,seq=2,held=true}).ok)
    assert(call('start',{instrument='piano'}).ok);request=sent[#sent].args[2]
    handlers['flecity_jam:control']({kind='started',request=request,session='voice-test',instrument='piano'})
    token=voiceConfig().token;assert(call('voice',{token=token,seq=1,held=true}).ok)
    handlers['flecity_jam:control']({kind='stopped',session='voice-test'})
    assert(voiceConfig().token~=token and not call('voice',{token=token,seq=2,held=true}).ok)
    call('close')
end)

test('death focus loss disabled PTT and resource stop release a pending voice hold',function()
    commands.jam(nil,{});local token=voiceConfig().token
    assert(call('voice',{token=token,seq=1,held=true}).ok);dead=true;local writes=#controlWrites;frame()
    assert(not focused and #controlWrites==writes and not voiceConfig().enabled);dead=false
    commands.jam(nil,{});token=voiceConfig().token;assert(call('voice',{token=token,seq=1,held=true}).ok)
    focused=false;writes=#controlWrites;frame();assert(#controlWrites==writes and voiceConfig().token~=token)
    assert(not call('voice',{token=voiceConfig().token,seq=1,held=true}).ok);call('close')
    JamConfig.PttControl=1;commands.jam(nil,{});token=voiceConfig().token
    assert(not voiceConfig().enabled and not call('voice',{token=token,seq=1,held=true}).ok);call('close');JamConfig.PttControl=249
    commands.jam(nil,{});token=voiceConfig().token;assert(call('voice',{token=token,seq=1,held=true}).ok)
    handlers.onClientResourceStop('flecity_jam');assert(not focused and not voiceConfig().enabled)
    commands.jam(nil,{});assert(voiceConfig().token~=token)
    assert(not call('voice',{token=token,seq=2,held=true}).ok);call('close')
end)
local function startVoiceSession(id)
    commands.jam(nil,{})
    assert(call('start',{instrument='piano'}).ok)
    local request=sent[#sent].args[2]
    handlers['flecity_jam:control']({kind='started',request=request,session=id,instrument='piano'})
    return voiceConfig().token
end

test('automatic conversation requires an authenticated current performance rather than opening or listening',function()
    commands.jamlisten();local token=voiceConfig().token
    assert(not call('voice',{token=token,seq=1,held=true,automatic=true,session='none'}).ok)
    assert(call('start',{instrument='piano'}).ok);local request=sent[#sent].args[2]
    assert(not call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-start'}).ok)
    handlers['flecity_jam:control']({kind='started',request=request,session='auto-start',instrument='piano'})
    assert(not call('voice',{token=token,seq=1,held=true,automatic='true',session='auto-start'}).ok)
    assert(not call('voice',{token=token,seq=1,held=true,automatic=true,session='old'}).ok)
    assert(not call('voice',{token=token,seq=1,held=true,automatic=true}).ok)
    assert(call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-start'}).ok)
    local writes=#controlWrites;frame();assert(#controlWrites==writes+3)
    assert(messages[#messages].type=='voiceState' and messages[#messages].held and messages[#messages].automatic)
    call('close')
end)

test('automatic conversation renews a 900ms lease and expiry cannot resume without a fresh explicit request',function()
    local token=startVoiceSession('auto-lease')
    assert(call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-lease'}).ok)
    clock=clock+200;assert(call('voice',{token=token,seq=2,held=true,automatic=true,session='auto-lease'}).ok)
    clock=clock+899;local writes=#controlWrites;frame();assert(#controlWrites==writes+3)
    clock=clock+1;writes=#controlWrites;frame();assert(#controlWrites==writes)
    local state=messages[#messages];assert(state.expired and not state.held and not state.automatic and state.voice.token~=token)
    assert(not call('voice',{token=token,seq=3,held=true,automatic=true,session='auto-lease'}).ok)
    frame();assert(#controlWrites==writes,'expiry must not automatically reacquire voice')
    token=voiceConfig().token
    assert(call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-lease'}).ok)
    frame();assert(#controlWrites==writes+3)
    assert(call('voice',{token=token,seq=2,held=false,automatic=true,session='auto-lease'}).ok)
    writes=#controlWrites;frame();assert(#controlWrites==writes)
    assert(not messages[#messages].automatic and not messages[#messages].held);call('close')
end)

test('disabled or unavailable native PTT stays disabled and invalidates automatic input without a forced zero',function()
    local token=startVoiceSession('auto-disabled')
    assert(call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-disabled'}).ok)
    local writes=#controlWrites;pttEnabled=false;frame();assert(#controlWrites==writes)
    assert(not voiceConfig().enabled and voiceConfig().token~=token and messages[#messages].expired)
    assert(not call('voice',{token=voiceConfig().token,seq=1,held=true,automatic=true,session='auto-disabled'}).ok)
    pttEnabled=true;frame();assert(voiceConfig().enabled and #controlWrites==writes)
    token=voiceConfig().token;assert(call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-disabled'}).ok)
    local native=IsControlEnabled;IsControlEnabled=nil;frame();assert(#controlWrites==writes and not voiceConfig().enabled)
    assert(not call('voice',{token=voiceConfig().token,seq=1,held=true,automatic=true,session='auto-disabled'}).ok)
    IsControlEnabled=native;frame();assert(#controlWrites==writes and voiceConfig().enabled);call('close')
end)

test('automatic conversation stops at session end while the legacy held schema remains available as an explicit fallback',function()
    local token=startVoiceSession('auto-stop')
    assert(call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-stop'}).ok);frame()
    local writes=#controlWrites;assert(call('stop').ok);frame();assert(#controlWrites==writes)
    assert(not call('voice',{token=token,seq=2,held=true,automatic=true,session='auto-stop'}).ok)
    token=voiceConfig().token
    assert(not call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-stop'}).ok)
    assert(call('voice',{token=token,seq=1,held=true}).ok);frame();assert(#controlWrites==writes+3)
    assert(messages[#messages].held and not messages[#messages].automatic)
    assert(call('voice',{token=token,seq=2,held=false}).ok);call('close')
end)

test('automatic conversation releases on focus loss death pause clock rollover and resource shutdown',function()
    for _,reason in ipairs({'focus','death','pause','clock','resource'})do
        local beforeClock=clock;local token=startVoiceSession('auto-'..reason)
        assert(call('voice',{token=token,seq=1,held=true,automatic=true,session='auto-'..reason}).ok)
        local writes=#controlWrites
        if reason=='focus' then focused=false
        elseif reason=='death' then dead=true
        elseif reason=='pause' then paused=true
        elseif reason=='clock' then clock=clock-2147483648
        else handlers.onClientResourceStop('flecity_jam') end
        frame();assert(#controlWrites==writes and voiceConfig().token~=token,reason)
        assert(not call('voice',{token=token,seq=2,held=true,automatic=true,session='auto-'..reason}).ok,reason)
        dead,paused=false,false;clock=beforeClock;call('close')
    end
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
test('additional instrument exports keep inventory consent and configured item boundaries',function()
    for instrument,name in pairs({electric_guitar='UseElectricGuitar',flute='UseFlute',violin='UseViolin'}) do
        assert(type(exported[name])=='function' and JamConfig.Items[instrument]=='jam_'..instrument)
        exports={ox_inventory={useItem=function(_,data,cb)cb(false)end}}
        exported[name]({slot=2});assert(not focused)
        exports.ox_inventory.useItem=function(_,data,cb)cb(data)end
        exported[name]({slot=2});assert(focused and messages[#messages].instrument==instrument)
        call('close');assert(not focused)
    end
end)
test('range choices reach NUI and selected range reaches the server start request',function()
    for _,range in ipairs({5,10,15,20,25})do
        commands.jam(nil,{})
        assert(messages[#messages].range==15 and #messages[#messages].rangeOptions==5)
        assert(call('ready').ok and messages[#messages].rangeOptions[5]==25)
        assert(call('start',{instrument='piano',range=range}).ok)
        local event=sent[#sent]
        assert(event.name=='flecity_jam:start' and event.args[3]==range)
        call('close')
    end
end)

test('invalid NUI ranges do not create a server request',function()
    commands.jam(nil,{})
    for _,range in ipairs({'25',0,7,30,math.huge,0/0})do
        local before=#sent
        assert(not call('start',{instrument='piano',range=range}).ok and #sent==before)
    end
    call('close')
end)

test('only current server session range acknowledgements reach NUI',function()
    commands.jam(nil,{})
    assert(call('start',{instrument='piano',range=5}).ok)
    handlers['flecity_jam:control']({kind='started',session='range-owner',request=sent[#sent].args[2],instrument='piano',range=5})
    local before=#messages
    handlers['flecity_jam:control']({kind='range',session='someone-else',range=25,seq=2})
    assert(#messages==before)
    handlers['flecity_jam:control']({kind='range',session='range-owner',range=10,seq=3})
    assert(messages[#messages].data.range==10 and messages[#messages].data.seq==3)
    call('close')
end)
print(('RESULT %d PASS / 0 FAIL (mocked FiveM client/access; NOT live FiveM)'):format(count))
