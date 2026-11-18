local resource = GetCurrentResourceName()
local shown,session,request,pending,lastUi = false,nil,0,nil,0
local peers = {}
local wires = {}
local function nui(data) SendNUIMessage(data) end
local function uiExpired()
    local elapsed=GetGameTimer()-lastUi
    return elapsed<0 or elapsed>=4500
end
local voiceEpoch,voiceSeq,voiceHeld,voiceUntil = 0,0,false,0
local voiceAutomatic,voiceSession = false,nil
local voiceToken,lastVoice = nil,nil
local function voiceControlEnabled()
    if JamConfig.PttControl~=249 or type(IsControlEnabled)~='function' then return false end
    local enabled=IsControlEnabled(0,249)
    return enabled==true or enabled==1
end
local function voiceConfig()
    return {token=voiceToken,enabled=shown and voiceControlEnabled()}
end
local function talking()
    if type(MumbleIsPlayerTalking)~='function' then return false end
    local value=MumbleIsPlayerTalking(PlayerId())
    return value==true or value==1
end
local function publishVoice(expired)
    local detected=shown and talking() or false
    local config=voiceConfig()
    if not lastVoice or lastVoice.held~=voiceHeld or lastVoice.automatic~=voiceAutomatic or lastVoice.talking~=detected
        or lastVoice.token~=voiceToken or lastVoice.enabled~=config.enabled then
        lastVoice={held=voiceHeld,automatic=voiceAutomatic,talking=detected,token=voiceToken,enabled=config.enabled}
        nui({type='voiceState',held=voiceHeld,automatic=voiceAutomatic,talking=detected,expired=expired==true,voice=config})
    end
end
local function resetVoice(expired)
    voiceEpoch=voiceEpoch+1
    voiceToken=('%d:%d'):format(GetGameTimer(),voiceEpoch)
    voiceSeq,voiceHeld,voiceUntil=0,false,0
    voiceAutomatic,voiceSession=false,nil
    publishVoice(expired)
end
local function hasVoiceLease()
    local remaining=voiceUntil-GetGameTimer()
    return voiceHeld and remaining>0 and remaining<=900
end
local function updateVoice()
    if voiceHeld and (not hasVoiceLease() or not IsNuiFocused() or not voiceControlEnabled()
        or (voiceAutomatic and voiceSession~=session)) then
        resetVoice(true);return
    end
    if shown and voiceHeld then
        -- Same secondary-PTT input as pma-voice; never enable/mute/change Voice itself.
        SetControlNormal(0,249,1.0);SetControlNormal(1,249,1.0);SetControlNormal(2,249,1.0)
    end
    publishVoice(false)
end
local function close(reason)
    local old = session
    local ownedFocus = shown
    shown,session,pending = false,nil,nil
    resetVoice()
    if old then TriggerServerEvent('flecity_jam:stop',old) end
    JamPresentation.stop()
    if ownedFocus then SetNuiFocus(false,false); SetNuiFocusKeepInput(false) end
    nui({type='close',reason=reason})
end
local function open(instrument,listenOnly)
    if shown then close('toggle'); return end
    if IsNuiFocused() or IsPauseMenuActive() or IsEntityDead(PlayerPedId()) or IsPedInAnyVehicle(PlayerPedId(),false) or not JamConfig.CanStartClient() then
        nui({type='notice',message='他の画面を閉じ、安全な場所で /jam を入力してください。'}); return
    end
    shown,lastUi = true,GetGameTimer()
    SetNuiFocus(true,true); SetNuiFocusKeepInput(false)
    resetVoice()
    nui({type='open',instrument=instrument,listenOnly=listenOnly==true,range=JamConfig.Range,rangeOptions=JamConfig.RangeOptions,reserved=JamConfig.ReservedKeys,voice=voiceConfig()})
end
RegisterCommand(JamConfig.Command,function(_,args) open(args[1],false) end,false)
RegisterCommand('jamstop',function() close('command') end,false)
RegisterCommand('jamlisten',function() open(nil,true) end,false)
RegisterCommand('jammute',function() nui({type='toggleMute'}) end,false)
RegisterCommand('jam_voice_diag',function()
    local enabled=type(IsControlEnabled)=='function' and IsControlEnabled(0,249) or false
    local pressed=type(IsControlPressed)=='function' and IsControlPressed(0,249) or false
    local keep=type(IsNuiFocusKeepingInput)=='function' and IsNuiFocusKeepingInput() or false
    print(('[JAM] voice automatic=%s held=%s lease=%s control249_enabled=%s pressed=%s mumble_detected=%s focused=%s keepInput=%s; hearing NOT_VERIFIED')
        :format(tostring(voiceAutomatic),tostring(voiceHeld),tostring(shown and hasVoiceLease()),tostring(enabled),tostring(pressed),tostring(talking()),tostring(IsNuiFocused()),tostring(keep)))
end,false)
exports('OpenInstrument',function(instrument) open(instrument,false) end)
exports('StopPerformance',function() close('external') end)
exports('IsPerforming',function() return session ~= nil end)
for id, exportName in pairs({piano='UsePiano',guitar='UseGuitar',bass='UseBass',clarinet='UseClarinet',drums='UseDrums',electric_guitar='UseElectricGuitar',flute='UseFlute',violin='UseViolin'}) do
    exports(exportName,function(data)
        if GetResourceState('ox_inventory')~='started' then return end
        exports.ox_inventory:useItem(data,function(used)
            if used then open(id,false) end
        end)
    end)
end

RegisterNUICallback('ready',function(_,cb)
    nui({type='config',range=JamConfig.Range,rangeOptions=JamConfig.RangeOptions,reserved=JamConfig.ReservedKeys})
    cb({ok=true})
end)
RegisterNUICallback('pulse',function(_,cb) lastUi=GetGameTimer(); cb({ok=true}) end)
RegisterNUICallback('voice',function(data,cb)
    if voiceHeld and not hasVoiceLease() then resetVoice(true) end
    if not shown or not voiceControlEnabled() or type(data)~='table' or data.token~=voiceToken
        or type(data.held)~='boolean' or type(data.seq)~='number' or data.seq<1 or data.seq>2147483647
        or data.seq%1~=0 or data.seq<=voiceSeq
        or (data.automatic~=nil and type(data.automatic)~='boolean') then cb({ok=false});return end
    if data.automatic and (not session or data.session~=session) then cb({ok=false});return end
    if data.held and (not IsNuiFocused() or IsPauseMenuActive() or IsEntityDead(PlayerPedId()) or not JamConfig.CanStartClient()) then cb({ok=false});return end
    voiceSeq,voiceHeld=data.seq,data.held
    voiceAutomatic=data.held and data.automatic==true
    voiceSession=voiceAutomatic and session or nil
    voiceUntil=data.held and GetGameTimer()+900 or 0
    publishVoice(false);cb({ok=true,held=voiceHeld})
end)
RegisterNUICallback('start',function(data,cb)
    if not shown or pending or session or type(data)~='table' or type(data.instrument) ~= 'string' or #data.instrument>32 or not JamConfig.CanStartClient() then cb({ok=false}); return end
    if data.range~=nil then
        local allowed=false
        for _,value in ipairs(JamConfig.RangeOptions or {JamConfig.Range}) do if type(data.range)=='number' and data.range==value then allowed=true end end
        if not allowed then cb({ok=false});return end
    end
    request=request+1; pending=request
    TriggerServerEvent('flecity_jam:start',data.instrument,request,data.range)
    cb({ok=true})
end)
RegisterNUICallback('input',function(data,cb)
    if session and type(data)=='table' and data.session==session then
        lastUi=GetGameTimer(); TriggerServerEvent('flecity_jam:input',data); cb({ok=true})
    else cb({ok=false}) end
end)
RegisterNUICallback('stop',function(_,cb)
    local old=session; session,pending=nil,nil
    resetVoice()
    if old then TriggerServerEvent('flecity_jam:stop',old) end
    JamPresentation.stop(); cb({ok=true})
end)
RegisterNUICallback('close',function(_,cb) close('ui'); cb({ok=true}) end)
RegisterNetEvent('flecity_jam:control',function(data)
    if source ~= 65535 then return end
    if shown and uiExpired() then close('interrupted') end
    if data.kind=='started' then
        if not shown or pending~=data.request then TriggerServerEvent('flecity_jam:stop',data.session); return end
        pending=nil; session=data.session; lastUi=GetGameTimer()
        local expected=session
        CreateThread(function() JamPresentation.start(data.instrument,function() return session==expected end) end)
    elseif data.kind=='denied' then
        if data.request~=pending then return end
        pending=nil;resetVoice()
    elseif data.kind=='stopped' then
        if data.session~=session then return end
        session=nil;resetVoice();JamPresentation.stop()
    elseif data.session~=session then return end
    nui({type='control',data=data})
end)
local function publishPositions()
    local positions, now = {}, GetGameTimer()
    for id,state in pairs(peers) do
        local index=GetPlayerFromServerId(id)
        local ped=index~=-1 and GetPlayerPed(index) or 0
        local age=now-state.seen
        if age<0 or age>=3500 then
            peers[id]=nil; nui({type='expire',player=id,session=state.session})
        elseif ped~=0 and DoesEntityExist(ped) then
            local p=GetEntityCoords(ped)
            positions[#positions+1]={player=id,x=p.x,y=p.y,z=p.z}
            state.positioned=true
        else state.positioned=false end
    end
    JamPresentation.updateRemotes(peers)
    if #positions>0 or next(peers) then
        local p=GetEntityCoords(PlayerPedId())
        local rot=GetGameplayCamRot(2)
        local yaw=math.rad(rot.z); local pitch=math.rad(rot.x)
        nui({type='positions',sources=positions,listener={x=p.x,y=p.y,z=p.z,
            fx=-math.sin(yaw)*math.cos(pitch),fy=math.cos(yaw)*math.cos(pitch),fz=math.sin(pitch)}})
    end
end
RegisterNetEvent('flecity_jam:remote',function(data)
    if source~=65535 or data.player==GetPlayerServerId(PlayerId()) then return end
    if type(data.wire)~='number' or data.wire<=(wires[data.player] or -1) then return end
    wires[data.player]=data.wire
    if data.kind=='stop' then peers[data.player]=nil
    else
        local previous=peers[data.player]
        local newSession=not previous or previous.session~=data.session
        local needsPosition=newSession or not previous.positioned
        peers[data.player]={seen=GetGameTimer(),session=data.session,
            instrument=data.instrument or (previous and previous.instrument),positioned=not needsPosition}
        if needsPosition and not newSession and data.kind~='snapshot' then
            -- The existing NUI slot needs a position before a short on/off delta.
            publishPositions()
        end
        nui({type='remote',data=data})
        if newSession or data.kind=='snapshot' then
            -- A snapshot can recreate the NUI slot after a lost delta.
            publishPositions()
        end
        return
    end
    nui({type='remote',data=data})
end)

CreateThread(function()
    while true do
        Wait(shown and 0 or 200)
        if shown then
            for _,id in ipairs(JamConfig.DisableControls) do if id~=JamConfig.PttControl then DisableControlAction(0,id,true) end end
            DisablePlayerFiring(PlayerId(),true)
            if IsEntityDead(PlayerPedId()) or IsPedRagdoll(PlayerPedId()) or IsPedInAnyVehicle(PlayerPedId(),false)
                or IsPauseMenuActive() or not JamConfig.CanStartClient() or uiExpired() then close('interrupted') end
            if shown then updateVoice() end
        end
    end
end)
CreateThread(function()
    while true do
        Wait(next(peers) and 100 or 500)
        publishPositions()
    end
end)
AddEventHandler('onClientResourceStop',function(name)
    if name==resource then close('resource_stop'); peers={}; JamPresentation.clearRemotes(); nui({type='reset'}) end
end)
