local resource = GetCurrentResourceName()
local shown,session,request,pending,lastUi = false,nil,0,nil,0
local peers = {}
local wires = {}
local function nui(data) SendNUIMessage(data) end
local function close(reason)
    local old = session
    shown,session,pending = false,nil,nil
    if old then TriggerServerEvent('flecity_jam:stop',old) end
    JamPresentation.stop()
    SetNuiFocus(false,false); SetNuiFocusKeepInput(false)
    nui({type='close',reason=reason})
end
local function open(instrument,listenOnly)
    if shown then close('toggle'); return end
    if IsNuiFocused() or IsPauseMenuActive() or IsEntityDead(PlayerPedId()) or IsPedInAnyVehicle(PlayerPedId(),false) or not JamConfig.CanStartClient() then
        nui({type='notice',message='他の画面を閉じ、安全な場所で /jam を入力してください。'}); return
    end
    shown,lastUi = true,GetGameTimer()
    SetNuiFocus(true,true); SetNuiFocusKeepInput(true)
    nui({type='open',instrument=instrument,listenOnly=listenOnly==true,range=JamConfig.Range,reserved=JamConfig.ReservedKeys})
end
RegisterCommand(JamConfig.Command,function(_,args) open(args[1],false) end,false)
RegisterCommand('jamstop',function() close('command') end,false)
RegisterCommand('jamlisten',function() open(nil,true) end,false)
RegisterCommand('jammute',function() nui({type='toggleMute'}) end,false)
exports('OpenInstrument',function(instrument) open(instrument,false) end)
exports('StopPerformance',function() close('external') end)
exports('IsPerforming',function() return session ~= nil end)
for id, exportName in pairs({piano='UsePiano',guitar='UseGuitar',bass='UseBass',clarinet='UseClarinet',drums='UseDrums'}) do
    exports(exportName,function(data)
        if GetResourceState('ox_inventory')~='started' then return end
        exports.ox_inventory:useItem(data,function(used)
            if used then open(id,false) end
        end)
    end)
end

RegisterNUICallback('ready',function(_,cb)
    nui({type='config',range=JamConfig.Range,reserved=JamConfig.ReservedKeys})
    cb({ok=true})
end)
RegisterNUICallback('pulse',function(_,cb) lastUi=GetGameTimer(); cb({ok=true}) end)
RegisterNUICallback('start',function(data,cb)
    if not shown or pending or session or type(data)~='table' or type(data.instrument) ~= 'string' or #data.instrument>32 or not JamConfig.CanStartClient() then cb({ok=false}); return end
    request=request+1; pending=request
    TriggerServerEvent('flecity_jam:start',data.instrument,request)
    cb({ok=true})
end)
RegisterNUICallback('input',function(data,cb)
    if session and type(data)=='table' and data.session==session then
        lastUi=GetGameTimer(); TriggerServerEvent('flecity_jam:input',data); cb({ok=true})
    else cb({ok=false}) end
end)
RegisterNUICallback('stop',function(_,cb)
    local old=session; session,pending=nil,nil
    if old then TriggerServerEvent('flecity_jam:stop',old) end
    JamPresentation.stop(); cb({ok=true})
end)
RegisterNUICallback('close',function(_,cb) close('ui'); cb({ok=true}) end)
RegisterNetEvent('flecity_jam:control',function(data)
    if source ~= 65535 then return end
    if data.kind=='started' then
        if not shown or pending~=data.request then TriggerServerEvent('flecity_jam:stop',data.session); return end
        pending=nil; session=data.session; lastUi=GetGameTimer()
        local expected=session
        CreateThread(function() JamPresentation.start(data.instrument,function() return session==expected end) end)
    elseif data.kind=='denied' then
        if data.request~=pending then return end
        pending=nil
    elseif data.kind=='stopped' then
        if data.session~=session then return end
        session=nil; JamPresentation.stop()
    elseif data.session~=session then return end
    nui({type='control',data=data})
end)
RegisterNetEvent('flecity_jam:remote',function(data)
    if source~=65535 or data.player==GetPlayerServerId(PlayerId()) then return end
    if type(data.wire)~='number' or data.wire<=(wires[data.player] or -1) then return end
    wires[data.player]=data.wire
    if data.kind=='stop' then peers[data.player]=nil
    else peers[data.player]={seen=GetGameTimer(),session=data.session,instrument=data.instrument or (peers[data.player] and peers[data.player].instrument)} end
    nui({type='remote',data=data})
end)

CreateThread(function()
    while true do
        Wait(shown and 0 or 200)
        if shown then
            for _,id in ipairs(JamConfig.DisableControls) do if id~=JamConfig.PttControl then DisableControlAction(0,id,true) end end
            DisablePlayerFiring(PlayerId(),true)
            if IsEntityDead(PlayerPedId()) or IsPedRagdoll(PlayerPedId()) or IsPedInAnyVehicle(PlayerPedId(),false)
                or IsPauseMenuActive() or not JamConfig.CanStartClient() or GetGameTimer()-lastUi>4500 then close('interrupted') end
        end
    end
end)
CreateThread(function()
    while true do
        Wait(next(peers) and 100 or 500)
        local positions, now = {}, GetGameTimer()
        for id,state in pairs(peers) do
            local index=GetPlayerFromServerId(id)
            local ped=index~=-1 and GetPlayerPed(index) or 0
            if now-state.seen>3500 then
                peers[id]=nil; nui({type='expire',player=id,session=state.session})
            elseif ped~=0 and DoesEntityExist(ped) then
                local p=GetEntityCoords(ped)
                positions[#positions+1]={player=id,x=p.x,y=p.y,z=p.z}
            end
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
end)
AddEventHandler('onClientResourceStop',function(name)
    if name==resource then close('resource_stop'); peers={}; JamPresentation.clearRemotes(); nui({type='reset'}) end
end)
