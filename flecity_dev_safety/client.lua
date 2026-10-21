local revivePending = false
local lastSafeCoords = nil

local function isUsablePed(ped)
    return ped and ped ~= 0 and DoesEntityExist(ped)
end

CreateThread(function()
    while true do
        Wait(1000)
        local ped = PlayerPedId()
        if isUsablePed(ped) and not IsEntityDead(ped) then
            lastSafeCoords = GetEntityCoords(ped)
        end
    end
end)

CreateThread(function()
    while true do
        Wait(500)
        local ped = PlayerPedId()
        if isUsablePed(ped) and IsEntityDead(ped) and not revivePending then
            revivePending = true
            CreateThread(function()
                Wait(1800)
                local currentPed = PlayerPedId()
                if isUsablePed(currentPed) and IsEntityDead(currentPed) then
                    local coords = lastSafeCoords or GetEntityCoords(currentPed)
                    local heading = GetEntityHeading(currentPed)
                    NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z + 0.15, heading, true, false)
                    currentPed = PlayerPedId()
                    ClearPedBloodDamage(currentPed)
                    ClearPedTasksImmediately(currentPed)
                    SetEntityHealth(currentPed, GetEntityMaxHealth(currentPed))
                    SetPedArmour(currentPed, 0)
                    ResetPedVisibleDamage(currentPed)
                    TriggerServerEvent('flecity_dev_safety:restoreNeeds')
                end
                revivePending = false
            end)
        end
    end
end)

RegisterNetEvent('flecity_dev_safety:clientRestore', function()
    local ped = PlayerPedId()
    if isUsablePed(ped) and not IsEntityDead(ped) and GetEntityHealth(ped) < GetEntityMaxHealth(ped) then
        SetEntityHealth(ped, GetEntityMaxHealth(ped))
    end
end)
