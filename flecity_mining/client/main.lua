local state = {
    active = false,
    rawOre = 0,
    maxRawOre = Config.MaxRawOre,
    refined = {},
    refinedCount = 0,
    nodeCooldowns = {},
    cooldownSyncedAt = 0,
}

local busy = false
local currentActionToken = nil
local routeBlip = nil
local activeMineProp = nil
local activeMineSound = nil
local activeMineTarget = nil

local function clearRoute()
    if routeBlip and DoesBlipExist(routeBlip) then
        RemoveBlip(routeBlip)
    end
    routeBlip = nil
end

local function setRoute(coords, label)
    clearRoute()
    routeBlip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(routeBlip, 1)
    SetBlipColour(routeBlip, 5)
    SetBlipScale(routeBlip, 0.75)
    SetBlipRoute(routeBlip, true)
    SetBlipRouteColour(routeBlip, 5)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(label)
    EndTextCommandSetBlipName(routeBlip)
end

local function nodeCooldownRemaining(nodeId)
    local initial = tonumber(state.nodeCooldowns[tostring(nodeId)]) or 0
    if initial <= 0 then return 0 end

    local elapsed = math.max(0, GetGameTimer() - (state.cooldownSyncedAt or 0))
    return math.max(0, initial - elapsed)
end

local function nearestMiningNode()
    local playerCoords = GetEntityCoords(PlayerPedId())
    local nearest, nearestDistance = nil, nil
    local fallback, fallbackDistance = nil, nil

    for _, node in ipairs(Config.MiningNodes) do
        local distance = #(playerCoords - node.coords)

        if not fallbackDistance or distance < fallbackDistance then
            fallback = node
            fallbackDistance = distance
        end

        if nodeCooldownRemaining(node.id) <= 0 and (not nearestDistance or distance < nearestDistance) then
            nearest = node
            nearestDistance = distance
        end
    end

    return nearest or fallback
end

local function findNode(nodeId)
    nodeId = tonumber(nodeId)
    if not nodeId then return nil end
    for _, node in ipairs(Config.MiningNodes) do
        if tonumber(node.id) == nodeId then
            return node
        end
    end
    return nil
end

local function updateGuidanceRoute()
    if not state.active then
        clearRoute()
        return
    end

    if (state.refinedCount or 0) > 0 and (state.rawOre or 0) <= 0 then
        setRoute(Config.Foreman.coords, '鉱山受付 / 買取')
        return
    end

    if (state.rawOre or 0) >= (state.maxRawOre or Config.MaxRawOre) then
        setRoute(Config.Processor.coords, '選鉱設備')
        return
    end

    local node = nearestMiningNode()
    if node then setRoute(node.coords, node.label or '採掘地点') end
end

local function notify(message)
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(tostring(message))
    EndTextCommandThefeedPostTicker(false, false)
end

local function draw3DText(coords, text)
    local onScreen, x, y = World3dToScreen2d(coords.x, coords.y, coords.z)
    if not onScreen then return end

    SetTextScale(0.32, 0.32)
    SetTextFont(0)
    SetTextProportional(true)
    SetTextColour(255, 255, 255, 235)
    SetTextCentre(true)
    SetTextDropshadow(1, 0, 0, 0, 180)
    SetTextEntry('STRING')
    AddTextComponentString(text)
    DrawText(x, y)
end

local function drawScreenText(text)
    SetTextFont(0)
    SetTextScale(0.42, 0.42)
    SetTextColour(255, 255, 255, 235)
    SetTextCentre(true)
    SetTextDropshadow(1, 0, 0, 0, 200)
    SetTextEntry('STRING')
    AddTextComponentString(text)
    DrawText(0.5, 0.88)
end

local function refinedSummary()
    local parts = {}

    for _, product in ipairs(Config.RefinedProducts) do
        local count = tonumber(state.refined[product.id]) or 0
        if count > 0 then
            parts[#parts + 1] = ('%s×%d'):format(product.label, count)
        end
    end

    if #parts == 0 then return 'なし' end
    return table.concat(parts, ' / ')
end

local function showStatus()
    notify(('原石 %d/%d | 精製鉱石 %s'):format(
        state.rawOre or 0,
        state.maxRawOre or Config.MaxRawOre,
        refinedSummary()
    ))
end

local function createBlip()
    if not Config.Blip.enabled then return end

    local blip = AddBlipForCoord(Config.Blip.coords.x, Config.Blip.coords.y, Config.Blip.coords.z)
    SetBlipSprite(blip, Config.Blip.sprite)
    SetBlipColour(blip, Config.Blip.colour)
    SetBlipScale(blip, Config.Blip.scale)
    SetBlipAsShortRange(blip, true)

    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(Config.Blip.label)
    EndTextCommandSetBlipName(blip)
end

local function requestModelWithTimeout(model, timeoutMs)
    local hash = type(model) == 'number' and model or GetHashKey(model)
    if not IsModelInCdimage(hash) or not IsModelValid(hash) then return nil end

    RequestModel(hash)
    local started = GetGameTimer()
    while not HasModelLoaded(hash) do
        if GetGameTimer() - started > timeoutMs then return nil end
        Wait(0)
    end
    return hash
end

local function requestAnimWithTimeout(dict, timeoutMs)
    RequestAnimDict(dict)
    local started = GetGameTimer()
    while not HasAnimDictLoaded(dict) do
        if GetGameTimer() - started > timeoutMs then return false end
        Wait(0)
    end
    return true
end

local function requestPtfxWithTimeout(dict, timeoutMs)
    RequestNamedPtfxAsset(dict)
    local started = GetGameTimer()
    while not HasNamedPtfxAssetLoaded(dict) do
        if GetGameTimer() - started > timeoutMs then return false end
        Wait(0)
    end
    return true
end

local function headingTo(fromCoords, toCoords)
    return GetHeadingFromVector_2d(toCoords.x - fromCoords.x, toCoords.y - fromCoords.y)
end

local function stopDrillPresentation()
    if activeMineSound then
        StopSound(activeMineSound)
        ReleaseSoundId(activeMineSound)
        activeMineSound = nil
    end

    if activeMineProp and DoesEntityExist(activeMineProp) then
        DeleteEntity(activeMineProp)
        activeMineProp = nil
    end

    activeMineTarget = nil
end

local function startDrillPresentation(ped, node)
    local cfg = Config.DrillVisuals or {}
    if cfg.enabled ~= true or not node or type(node.target) ~= 'vector3' then
        return false
    end

    local timeoutMs = math.max(500, tonumber(cfg.loadTimeoutMs) or 2500)
    local model = requestModelWithTimeout(cfg.model or 'hei_prop_heist_drill', timeoutMs)
    local animOk = requestAnimWithTimeout(cfg.animDict or 'anim@heists@fleeca_bank@drilling', timeoutMs)

    if not model or not animOk then
        if model then SetModelAsNoLongerNeeded(model) end
        return false
    end

    local pedCoords = GetEntityCoords(ped)
    SetEntityHeading(ped, headingTo(pedCoords, node.target))

    local prop = CreateObject(model, pedCoords.x, pedCoords.y, pedCoords.z, false, false, false)
    if not prop or prop == 0 then
        SetModelAsNoLongerNeeded(model)
        return false
    end

    AttachEntityToEntity(
        prop,
        ped,
        GetPedBoneIndex(ped, 57005),
        0.14, 0.0, -0.01,
        90.0, -90.0, 180.0,
        false, false, false, false, 2, true
    )

    TaskPlayAnim(
        ped,
        cfg.animDict or 'anim@heists@fleeca_bank@drilling',
        cfg.animName or 'drill_straight_fail',
        3.0, 3.0, -1, 1, 0.0,
        false, false, false
    )

    activeMineProp = prop
    activeMineTarget = node.target

    if cfg.sound == true then
        local soundId = GetSoundId()
        PlaySoundFromEntity(soundId, 'Drill', prop, 'DLC_HEIST_FLEECA_SOUNDSET', true, 0)
        activeMineSound = soundId
    end

    if cfg.dust == true then
        CreateThread(function()
            local ptfxOk = requestPtfxWithTimeout('core', timeoutMs)
            if not ptfxOk then return end

            while busy and activeMineTarget and activeMineProp and DoesEntityExist(activeMineProp) do
                UseParticleFxAssetNextCall('core')
                StartParticleFxNonLoopedAtCoord(
                    'ent_dst_rocks',
                    activeMineTarget.x, activeMineTarget.y, activeMineTarget.z,
                    0.0, 0.0, GetEntityHeading(ped) - 180.0,
                    0.55,
                    false, false, false
                )
                Wait(math.max(250, tonumber(cfg.dustIntervalMs) or 550))
            end

            RemoveNamedPtfxAsset('core')
        end)
    end

    SetModelAsNoLongerNeeded(model)
    return true
end

local scenarios = {
    process = 'WORLD_HUMAN_WELDING',
    sell = 'WORLD_HUMAN_CLIPBOARD',
}

local function runApprovedAction(data)
    if busy then return end

    local token = tostring(data.token or '')
    local duration = math.max(500, tonumber(data.durationMs) or 1000)
    local actionType = tostring(data.type or '')
    local label = tostring(data.label or '作業中')

    busy = true
    currentActionToken = token

    local ped = PlayerPedId()
    local usedDrill = false

    if actionType == 'mine' then
        local node = findNode(data.nodeId)
        usedDrill = startDrillPresentation(ped, node)
        if not usedDrill then
            TaskStartScenarioInPlace(ped, 'WORLD_HUMAN_CONST_DRILL', 0, true)
        end
    else
        local scenario = scenarios[actionType]
        if scenario then TaskStartScenarioInPlace(ped, scenario, 0, true) end
    end

    FreezeEntityPosition(ped, true)

    local started = GetGameTimer()
    local cancelled = false

    while GetGameTimer() - started < duration do
        Wait(0)

        DisableControlAction(0, 21, true)
        DisableControlAction(0, 22, true)
        DisableControlAction(0, 23, true)
        DisableControlAction(0, 24, true)
        DisableControlAction(0, 25, true)
        DisableControlAction(0, 30, true)
        DisableControlAction(0, 31, true)
        DisableControlAction(0, 75, true)

        local remaining = math.max(0, duration - (GetGameTimer() - started))
        drawScreenText(('%s... %.1f秒'):format(label, remaining / 1000))

        if IsEntityDead(ped) then
            cancelled = true
            break
        end
    end

    stopDrillPresentation()
    ClearPedTasks(ped)
    FreezeEntityPosition(ped, false)

    busy = false
    currentActionToken = nil

    if cancelled then
        TriggerServerEvent('flecity_mining:server:cancelAction', token)
        notify('作業を中断しました。')
    else
        TriggerServerEvent('flecity_mining:server:finishAction', token)
    end
end

RegisterNetEvent('flecity_mining:client:notify', function(message)
    notify(message)
end)

RegisterNetEvent('flecity_mining:client:state', function(newState)
    if type(newState) ~= 'table' then return end

    state.active = newState.active == true
    state.rawOre = tonumber(newState.rawOre) or 0
    state.maxRawOre = tonumber(newState.maxRawOre) or Config.MaxRawOre
    state.refined = type(newState.refined) == 'table' and newState.refined or {}
    state.refinedCount = tonumber(newState.refinedCount) or 0
    state.nodeCooldowns = type(newState.nodeCooldowns) == 'table' and newState.nodeCooldowns or {}
    state.cooldownSyncedAt = GetGameTimer()
    updateGuidanceRoute()
end)

RegisterNetEvent('flecity_mining:client:actionApproved', function(data)
    if type(data) ~= 'table' then return end
    CreateThread(function()
        runApprovedAction(data)
    end)
end)

CreateThread(function()
    if Config.MineInterior and Config.MineInterior.enabled == true and Config.MineInterior.ipl then
        RequestIpl(Config.MineInterior.ipl)
    end

    createBlip()
    Wait(1000)
    TriggerServerEvent('flecity_mining:server:requestState')

    while true do
        local waitMs = 1000
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)

        local foremanDistance = #(coords - Config.Foreman.coords)
        local foremanMarker = Config.Markers.foreman
        if foremanDistance <= (foremanMarker.visibleDistance or Config.DrawDistance) then
            waitMs = 0

            if foremanMarker.enabled ~= false then
                DrawMarker(
                    foremanMarker.type,
                    Config.Foreman.coords.x, Config.Foreman.coords.y, Config.Foreman.coords.z - 0.82,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    foremanMarker.scale.x, foremanMarker.scale.y, foremanMarker.scale.z,
                    60, 180, 90, 150,
                    false, false, 2, false, nil, nil, false
                )
            end

            if foremanDistance <= Config.InteractDistance then
                if not state.active then
                    draw3DText(Config.Foreman.coords + vector3(0.0, 0.0, 1.0), '[E] 鉱山作業を開始')
                    if not busy and IsControlJustReleased(0, 38) then
                        TriggerServerEvent('flecity_mining:server:startShift')
                    end
                elseif state.refinedCount > 0 then
                    draw3DText(Config.Foreman.coords + vector3(0.0, 0.0, 1.0), '[E] 精製鉱石を売却')
                    if not busy and IsControlJustReleased(0, 38) then
                        TriggerServerEvent('flecity_mining:server:beginSell')
                    end
                else
                    draw3DText(
                        Config.Foreman.coords + vector3(0.0, 0.0, 1.0),
                        '[E] 作業状況を確認  [G] 鉱山作業を終了'
                    )
                    if not busy and IsControlJustReleased(0, 38) then
                        showStatus()
                    elseif not busy and IsControlJustReleased(0, 47) then
                        TriggerServerEvent('flecity_mining:server:endShift')
                    end
                end
            end
        end

        if state.active then
            local processorDistance = #(coords - Config.Processor.coords)
            local processorMarker = Config.Markers.processor
            if processorDistance <= (processorMarker.visibleDistance or Config.DrawDistance) then
                waitMs = 0

                if processorMarker.enabled ~= false then
                    DrawMarker(
                        processorMarker.type,
                        Config.Processor.coords.x, Config.Processor.coords.y, Config.Processor.coords.z - 0.82,
                        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                        processorMarker.scale.x, processorMarker.scale.y, processorMarker.scale.z,
                        220, 160, 60, 150,
                        false, false, 2, false, nil, nil, false
                    )
                end

                if processorDistance <= Config.InteractDistance then
                    if state.rawOre > 0 then
                        draw3DText(
                            Config.Processor.coords + vector3(0.0, 0.0, 1.0),
                            ('[E] 原石を選鉱 (%d個)'):format(state.rawOre)
                        )

                        if not busy and IsControlJustReleased(0, 38) then
                            TriggerServerEvent('flecity_mining:server:beginProcess')
                        end
                    else
                        draw3DText(Config.Processor.coords + vector3(0.0, 0.0, 1.0), '原石を採掘してください')
                    end
                end
            end

            for _, node in ipairs(Config.MiningNodes) do
                local nodeDistance = #(coords - node.coords)
                local mineMarker = Config.Markers.mine
                local visibleDistance = mineMarker.visibleDistance or 4.0

                if nodeDistance <= visibleDistance then
                    waitMs = 0

                    if mineMarker.enabled ~= false then
                        DrawMarker(
                            mineMarker.type,
                            node.coords.x, node.coords.y, node.coords.z + 0.05,
                            0.0, 0.0, 0.0, 0.0, 180.0, 0.0,
                            mineMarker.scale.x, mineMarker.scale.y, mineMarker.scale.z,
                            150, 150, 150, 95,
                            false, false, 2, false, nil, nil, false
                        )
                    end

                    if nodeDistance <= Config.InteractDistance then
                        if state.rawOre < state.maxRawOre then
                            draw3DText(
                                node.coords + vector3(0.0, 0.0, 0.75),
                                ('[E] 壁面をドリル採掘  原石 %d/%d'):format(state.rawOre, state.maxRawOre)
                            )

                            if not busy and IsControlJustReleased(0, 38) then
                                TriggerServerEvent('flecity_mining:server:beginMine', node.id)
                            end
                        else
                            draw3DText(node.coords + vector3(0.0, 0.0, 0.75), '原石が満載です')
                        end
                    end
                end
            end
        end

        Wait(waitMs)
    end
end)

RegisterCommand('mine_status', function()
    TriggerServerEvent('flecity_mining:server:requestState')
    Wait(100)
    showStatus()
end, false)

RegisterCommand('mine_end', function()
    if busy then
        notify('作業中は終了できません。')
        return
    end
    TriggerServerEvent('flecity_mining:server:endShift')
end, false)

RegisterCommand('mine_devpos', function()
    if Config.DevTools ~= true then return end
    local ped = PlayerPedId()
    local c = GetEntityCoords(ped)
    local h = GetEntityHeading(ped)
    local text = ('stand = vector3(%.2f, %.2f, %.2f), heading = %.2f'):format(c.x, c.y, c.z, h)
    print('[flecity_mining] ' .. text)
    notify(text)
end, false)

RegisterCommand('mine_devwall', function()
    if Config.DevTools ~= true then return end

    local ped = PlayerPedId()
    local from = GetEntityCoords(ped) + vector3(0.0, 0.0, 0.9)
    local forward = GetEntityForwardVector(ped)
    local to = from + (forward * 5.0)

    local ray = StartShapeTestRay(from.x, from.y, from.z, to.x, to.y, to.z, 1, ped, 0)
    local _, hit, endCoords = GetShapeTestResult(ray)

    if hit == 1 then
        local text = ('target = vector3(%.2f, %.2f, %.2f)'):format(endCoords.x, endCoords.y, endCoords.z)
        print('[flecity_mining] ' .. text)
        notify(text)
    else
        notify('5m以内の壁面を検出できませんでした。壁へ正面を向いて再実行してください。')
    end
end, false)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    clearRoute()
    stopDrillPresentation()

    local ped = PlayerPedId()
    ClearPedTasksImmediately(ped)
    FreezeEntityPosition(ped, false)
end)
