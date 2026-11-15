JamPresentation = { prop = nil, ped = nil, active = nil, remotes = {} }
-- Optional stock GTA guitar pose. Other instruments deliberately don't borrow an incorrect pose.
local guitar = { dict='amb@world_human_musician@guitar@male@base', anim='base', model='prop_acc_guitar_01',
    bone=24818, pos={-0.1,0.31,0.1}, rot={0.0,20.0,150.0} }
function JamPresentation.stop()
    local p = JamPresentation
    if p.prop and DoesEntityExist(p.prop) then DeleteEntity(p.prop) end
    if p.active and p.ped and DoesEntityExist(p.ped) then StopAnimTask(p.ped,p.active.dict,p.active.anim,2.0) end
    p.prop,p.ped,p.active = nil,nil,nil
end

function JamPresentation.updateRemotes(peers)
    if not JamConfig.Presentation then return end
    local p=JamPresentation
    for id,slot in pairs(p.remotes) do
        local peer=peers[id]
        local index=GetPlayerFromServerId(id)
        if not peer or peer.instrument~='guitar' or index==-1 or GetPlayerPed(index)~=slot.ped then
            if DoesEntityExist(slot.prop) then DeleteEntity(slot.prop) end
            p.remotes[id]=nil
        end
    end
    for id,peer in pairs(peers) do
        if peer.instrument=='guitar' and not p.remotes[id] then
            local index=GetPlayerFromServerId(id)
            local ped=index~=-1 and GetPlayerPed(index) or 0
            if ped~=0 and DoesEntityExist(ped) then
                local model=joaat(guitar.model);RequestModel(model)
                if HasModelLoaded(model) then
                    local at=GetEntityCoords(ped)
                    local prop=CreateObject(model,at.x,at.y,at.z,false,false,false)
                    if prop~=0 then
                        AttachEntityToEntity(prop,ped,GetPedBoneIndex(ped,guitar.bone),guitar.pos[1],guitar.pos[2],guitar.pos[3],guitar.rot[1],guitar.rot[2],guitar.rot[3],true,true,false,true,1,true)
                        p.remotes[id]={prop=prop,ped=ped}
                    end
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end
function JamPresentation.clearRemotes()
    for _,slot in pairs(JamPresentation.remotes) do if DoesEntityExist(slot.prop) then DeleteEntity(slot.prop) end end
    JamPresentation.remotes={}
end
function JamPresentation.start(instrument, stillActive)
    JamPresentation.stop()
    if not JamConfig.Presentation or instrument ~= 'guitar' then return end
    local spec, model = guitar, joaat(guitar.model)
    RequestAnimDict(spec.dict); RequestModel(model)
    local deadline = GetGameTimer()+2500
    while (not HasAnimDictLoaded(spec.dict) or not HasModelLoaded(model)) and GetGameTimer()<deadline and stillActive() do Wait(25) end
    if not stillActive() or not HasAnimDictLoaded(spec.dict) or not HasModelLoaded(model) then SetModelAsNoLongerNeeded(model); return end
    local ped=PlayerPedId()
    local pos=GetEntityCoords(ped)
    local prop=CreateObject(model,pos.x,pos.y,pos.z,false,false,false)
    if prop ~= 0 then
        AttachEntityToEntity(prop,ped,GetPedBoneIndex(ped,spec.bone),spec.pos[1],spec.pos[2],spec.pos[3],spec.rot[1],spec.rot[2],spec.rot[3],true,true,false,true,1,true)
        JamPresentation.prop=prop
    end
    TaskPlayAnim(ped,spec.dict,spec.anim,4.0,-4.0,-1,49,0,false,false,false)
    JamPresentation.ped,JamPresentation.active=ped,spec
    SetModelAsNoLongerNeeded(model)
end
