local state = {
    active = false,
    rawOre = 0,
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
local cancelCurrentAction = false
local drillPresentationGeneration = 0
local mineAccessCooldownUntil = 0

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

local function isInsideMine()
    local ped = PlayerPedId()
    local expectedId = Config.MineInterior and tonumber(Config.MineInterior.interiorId) or nil
    if expectedId and expectedId > 0 and GetInteriorFromEntity(ped) == expectedId then
        return true
    end

    -- Fallback for map variants where the interior id differs: once the ped is
    -- well past the stock door and close to the known mine network, treat it
    -- as inside for GPS guidance only.
    local access = Config.MineAccess
    if access and access.inside then
        local inside = vector3(access.inside.x, access.inside.y, access.inside.z)
        return #(GetEntityCoords(ped) - inside) < 180.0
            and #(GetEntityCoords(ped) - Config.Foreman.coords) > 12.0
    end

    return false
end

local function updateGuidanceRoute()
    if not state.active then
        clearRoute()
        return
    end

    local inside = isInsideMine()

    if (state.refinedCount or 0) > 0 and (state.rawOre or 0) <= 0 then
        setRoute(Config.Foreman.coords, '鉱山受付 / 買取')
        return
    end

    if not inside then
        if (state.rawOre or 0) > 0 then
            setRoute(Config.Processor.coords, '選鉱設備')
        elseif Config.MineAccess and Config.MineAccess.outside then
            local p = Config.MineAccess.outside
            setRoute(vector3(p.x, p.y, p.z), '坑道入口')
        end
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
    notify(('原石 %d個 | 精製鉱石 %s'):format(
        state.rawOre or 0,
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

local function requestMineIpls()
    local interior = Config.MineInterior
    if not interior or interior.enabled ~= true or type(interior.ipls) ~= 'table' then return end

    for _, ipl in ipairs(interior.ipls) do
        if type(ipl) == 'string' and ipl ~= '' then
            RequestIpl(ipl)
        end
    end

    if type(interior.anchor) == 'vector3' then
        RequestCollisionAtCoord(interior.anchor.x, interior.anchor.y, interior.anchor.z)
    end
end

local function transitionMineAccess(target)
    if not target then return false end
    if GetGameTimer() < mineAccessCooldownUntil then return false end

    local ped = PlayerPedId()
    if busy or IsEntityDead(ped) then return false end

    mineAccessCooldownUntil = GetGameTimer() + math.max(
        1000,
        tonumber(Config.MineAccess and Config.MineAccess.transitionCooldownMs) or 1800
    )

    requestMineIpls()

    -- Keep mine access deliberately simple. The previous v0.3.3 path used
    -- NewLoadScene/InteriorReady waits and could strand the client on a black
    -- loading screen. This version always has bounded waits and always fades
    -- the player back in.
    DoScreenFadeOut(200)
    local fadeDeadline = GetGameTimer() + 800
    while not IsScreenFadedOut() and GetGameTimer() < fadeDeadline do
        Wait(0)
    end

    local destination = vector3(target.x, target.y, target.z)
    FreezeEntityPosition(ped, true)

    RequestCollisionAtCoord(destination.x, destination.y, destination.z)
    SetEntityCoordsNoOffset(ped, destination.x, destination.y, destination.z + 0.05, false, false, false)
    SetEntityHeading(ped, tonumber(target.w) or GetEntityHeading(ped))

    local collisionDeadline = GetGameTimer() + 2500
    while GetGameTimer() < collisionDeadline do
        RequestCollisionAtCoord(destination.x, destination.y, destination.z)
        if HasCollisionLoadedAroundEntity(ped) then break end
        Wait(50)
    end

    FreezeEntityPosition(ped, false)
    ClearFocus()
    NewLoadSceneStop()

    updateGuidanceRoute()

    if IsScreenFadedOut() or IsScreenFadingOut() then
        DoScreenFadeIn(250)
    end

    return true
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

local function raycastWorld(fromCoords, toCoords, ignoredEntity)
    local handle = StartShapeTestRay(
        fromCoords.x, fromCoords.y, fromCoords.z,
        toCoords.x, toCoords.y, toCoords.z,
        1,
        ignoredEntity or 0,
        0
    )

    for _ = 1, 8 do
        local status, hit, endCoords = GetShapeTestResult(handle)
        if status == 2 then
            return hit == 1, endCoords
        end
        if status == 0 then break end
        Wait(0)
    end

    return false, nil
end

local function findNearestWallTarget(ped, originCoords)
    local origin = originCoords + vector3(0.0, 0.0, 0.9)
    local nearest = nil
    local nearestDistance = nil

    -- Sample a full horizontal circle. We only raycast for static world
    -- collision so floors/ceilings are avoided by keeping the rays level.
    for degrees = 0, 337.5, 22.5 do
        local radians = math.rad(degrees)
        local direction = vector3(math.cos(radians), math.sin(radians), 0.0)
        local target = origin + (direction * 3.0)
        local hit, endCoords = raycastWorld(origin, target, ped)

        if hit and endCoords then
            local distance = #(endCoords - origin)
            if distance >= 0.35 and distance <= 3.0
                and (not nearestDistance or distance < nearestDistance) then
                nearest = endCoords
                nearestDistance = distance
            end
        end
    end

    return nearest, nearestDistance
end

local function stopDrillPresentation()
    -- Invalidate any dust worker belonging to the presentation being stopped.
    -- A cancelled action can be followed by a new action before the old worker
    -- wakes from Wait(); without a generation guard the old worker could keep
    -- emitting dust against the new drill prop/target.
    drillPresentationGeneration = drillPresentationGeneration + 1

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

local function cleanupScenarioDrillProps(coords)
    local cfg = Config.DrillVisuals or {}
    local props = type(cfg.cleanupProps) == 'table' and cfg.cleanupProps or {
        'prop_tool_jackham',
        'prop_tool_drill',
    }

    for _, modelName in ipairs(props) do
        local hash = GetHashKey(modelName)
        local object = GetClosestObjectOfType(
            coords.x, coords.y, coords.z,
            4.0,
            hash,
            false, false, false
        )
        if object and object ~= 0 and DoesEntityExist(object) then
            SetEntityAsMissionEntity(object, true, true)
            DeleteObject(object)
            if DoesEntityExist(object) then DeleteEntity(object) end
        end
    end
end

local function startDrillPresentation(ped, node)
    local cfg = Config.DrillVisuals or {}
    if cfg.enabled ~= true or not node then
        return false
    end

    local pedCoords = GetEntityCoords(ped)
    local wallTarget = findNearestWallTarget(ped, pedCoords)

    if not wallTarget then
        local forward = GetEntityForwardVector(ped)
        wallTarget = pedCoords + (forward * 1.25) + vector3(0.0, 0.0, 0.9)
    end

    ClearPedTasksImmediately(ped)
    SetCurrentPedWeapon(ped, GetHashKey('WEAPON_UNARMED'), true)
    SetEntityHeading(ped, headingTo(pedCoords, wallTarget))

    local scenario = cfg.scenario or 'WORLD_HUMAN_CONST_DRILL'
    TaskStartScenarioInPlace(ped, scenario, 0, true)

    -- Give GTA a moment to create the scenario task/prop.
    Wait(250)

    activeMineTarget = wallTarget
    activeMineProp = nil
    drillPresentationGeneration = drillPresentationGeneration + 1
    local presentationGeneration = drillPresentationGeneration
    local presentationTarget = wallTarget

    if cfg.sound == true then
        local soundId = GetSoundId()
        PlaySoundFromCoord(
            soundId,
            'Drill',
            presentationTarget.x, presentationTarget.y, presentationTarget.z,
            'DLC_HEIST_FLEECA_SOUNDSET',
            false,
            0,
            false
        )
        activeMineSound = soundId
    end

    if cfg.dust == true then
        CreateThread(function()
            local timeoutMs = math.max(500, tonumber(cfg.loadTimeoutMs) or 3000)
            local ptfxOk = requestPtfxWithTimeout('core', timeoutMs)
            if not ptfxOk then return end

            while busy
                and drillPresentationGeneration == presentationGeneration
                and activeMineTarget do
                UseParticleFxAssetNextCall('core')
                StartParticleFxNonLoopedAtCoord(
                    'ent_dst_rocks',
                    presentationTarget.x, presentationTarget.y, presentationTarget.z,
                    0.0, 0.0, GetEntityHeading(ped) - 180.0,
                    math.max(0.05, tonumber(cfg.dustScale) or 0.20),
                    false, false, false
                )
                Wait(math.max(250, tonumber(cfg.dustIntervalMs) or 700))
            end

            if drillPresentationGeneration == presentationGeneration then
                RemoveNamedPtfxAsset('core')
            end
        end)
    end

    return true
end

local scenarios = {
    process = 'WORLD_HUMAN_WELDING',
    sell = 'WORLD_HUMAN_CLIPBOARD',
}

local function preloadDrillPresentation()
    local cfg = Config.DrillVisuals or {}
    if cfg.enabled ~= true then return end

    if cfg.dust == true then
        requestPtfxWithTimeout('core', math.max(500, tonumber(cfg.loadTimeoutMs) or 3000))
    end
end

local function runApprovedAction(data)
    if busy then return end

    local token = tostring(data.token or '')
    local duration = math.max(500, tonumber(data.durationMs) or 1000)
    local actionType = tostring(data.type or '')
    local label = tostring(data.label or '作業中')

    busy = true
    currentActionToken = token
    cancelCurrentAction = false

    local ped = PlayerPedId()
    local usedDrill = false

    if actionType == 'mine' then
        local node = findNode(data.nodeId)
        usedDrill = startDrillPresentation(ped, node)
        if not usedDrill then
            notify('ドリル演出の読み込みに失敗したため簡易採掘へ切り替えました。')
            TaskStartScenarioInPlace(ped, 'WORLD_HUMAN_HAMMERING', 0, true)
        end
    else
        local scenario = scenarios[actionType]
        if scenario then TaskStartScenarioInPlace(ped, scenario, 0, true) end
    end

    local started = GetGameTimer()
    local cancelled = false

    while GetGameTimer() - started < duration do
        Wait(0)

        -- Do not allow a completed-looking drill/process/sale after the player
        -- has been displaced by another resource/admin action. The server also
        -- validates distance at finishAction; cancelling here keeps the UX in
        -- sync and immediately releases the freeze/presentation.
        local expectedCoords = nil
        if actionType == 'mine' then
            local node = findNode(data.nodeId)
            expectedCoords = node and node.coords or nil
        elseif actionType == 'process' then
            expectedCoords = Config.Processor.coords
        elseif actionType == 'sell' then
            expectedCoords = Config.Foreman.coords
        end

        if expectedCoords and #(GetEntityCoords(ped) - expectedCoords) > (Config.ServerDistanceTolerance or 4.5) then
            cancelled = true
            break
        end

        DisableControlAction(0, 21, true)
        DisableControlAction(0, 22, true)
        DisableControlAction(0, 23, true)
        DisableControlAction(0, 24, true)
        DisableControlAction(0, 25, true)
        DisableControlAction(0, 30, true)
        DisableControlAction(0, 31, true)
        DisableControlAction(0, 75, true)

        if actionType == 'mine' and usedDrill then
            local cfg = Config.DrillVisuals or {}
            local scenario = cfg.scenario or 'WORLD_HUMAN_CONST_DRILL'
            if not IsPedUsingScenario(ped, scenario) then
                TaskStartScenarioInPlace(ped, scenario, 0, true)
            end
        end

        local remaining = math.max(0, duration - (GetGameTimer() - started))
        drawScreenText(('%s... %.1f秒  [G] 中断'):format(label, remaining / 1000))

        -- G is intentionally handled inside the approved-action loop rather
        -- than the ambient interaction loop. This makes manual cancellation
        -- work while the player is frozen and keeps the server token cleanup
        -- on the same path as death/session/displacement cancellation.
        if IsControlJustReleased(0, 47) then
            cancelCurrentAction = true
        end

        if IsEntityDead(ped) or cancelCurrentAction then
            cancelled = true
            break
        end
    end

    local cleanupCoords = GetEntityCoords(ped)
    stopDrillPresentation()
    ClearPedTasksImmediately(ped)
    cleanupScenarioDrillProps(cleanupCoords)
    -- Recovery only. Normal actions no longer freeze the ped; keeping this
    -- ensures a previous resource version cannot leave the player stuck.
    FreezeEntityPosition(ped, false)

    busy = false
    currentActionToken = nil
    cancelCurrentAction = false

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
    state.refined = type(newState.refined) == 'table' and newState.refined or {}
    state.refinedCount = tonumber(newState.refinedCount) or 0
    state.nodeCooldowns = type(newState.nodeCooldowns) == 'table' and newState.nodeCooldowns or {}
    state.cooldownSyncedAt = GetGameTimer()

    -- The server is authoritative for shift ownership. Character switches,
    -- framework state loss, or an operator-side session reset can make the
    -- session inactive while a client presentation is still running. Abort
    -- locally instead of leaving the player frozen with a drill until the
    -- original timer expires.
    if not state.active and busy then
        cancelCurrentAction = true
    end

    updateGuidanceRoute()
end)

RegisterNetEvent('flecity_mining:client:actionApproved', function(data)
    if type(data) ~= 'table' then return end
    CreateThread(function()
        runApprovedAction(data)
    end)
end)

CreateThread(function()
    -- Mine access recovery guard. If a previous resource version left the
    -- client in a loading/faded state, restarting flecity_mining recovers it.
    Wait(250)
    NewLoadSceneStop()
    ClearFocus()
    local recoveryPed = PlayerPedId()
    FreezeEntityPosition(recoveryPed, false)
    if IsScreenFadedOut() or IsScreenFadingOut() then
        DoScreenFadeIn(500)
    end

    requestMineIpls()
    createBlip()

    -- Preload presentation assets in parallel with the initial state sync so
    -- the first wall-drill action has the same perceived duration as later
    -- actions. Failure is harmless: startDrillPresentation still retries and
    -- falls back to the native drill scenario.
    CreateThread(preloadDrillPresentation)

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
                elseif (state.rawOre or 0) <= 0 and Config.MineAccess and Config.MineAccess.inside then
                    draw3DText(
                        Config.Foreman.coords + vector3(0.0, 0.0, 1.0),
                        '[E] 坑道へ入る  [G] 鉱山作業を終了'
                    )
                    if not busy and IsControlJustReleased(0, 38) then
                        transitionMineAccess(Config.MineAccess.inside)
                    elseif not busy and IsControlJustReleased(0, 47) then
                        TriggerServerEvent('flecity_mining:server:endShift')
                    end
                else
                    draw3DText(Config.Foreman.coords + vector3(0.0, 0.0, 1.0), '[E] 作業状況を確認')
                    if not busy and IsControlJustReleased(0, 38) then
                        showStatus()
                    end
                end
            end
        end

        if state.active and isInsideMine() then
            local lighting = Config.MineLighting or {}
            if lighting.enabled == true then
                local drawDistance = tonumber(lighting.drawDistance) or 35.0
                local height = tonumber(lighting.height) or 1.65
                local range = tonumber(lighting.range) or 8.0
                local intensity = tonumber(lighting.intensity) or 1.35
                local red = math.floor(tonumber(lighting.red) or 255)
                local green = math.floor(tonumber(lighting.green) or 210)
                local blue = math.floor(tonumber(lighting.blue) or 160)

                for _, node in ipairs(Config.MiningNodes) do
                    if #(coords - node.coords) <= drawDistance then
                        DrawLightWithRange(
                            node.coords.x, node.coords.y, node.coords.z + height,
                            red, green, blue,
                            range, intensity
                        )
                    end
                end

                if Config.MineAccess and Config.MineAccess.inside then
                    local accessPos = vector3(
                        Config.MineAccess.inside.x,
                        Config.MineAccess.inside.y,
                        Config.MineAccess.inside.z
                    )
                    if #(coords - accessPos) <= drawDistance then
                        DrawLightWithRange(
                            accessPos.x, accessPos.y, accessPos.z + height,
                            red, green, blue,
                            range, intensity
                        )
                    end
                end
                waitMs = 0
            end
        end

        if state.active then
            local access = Config.MineAccess
            if access and access.inside then
                local insideAccess = vector3(access.inside.x, access.inside.y, access.inside.z)
                local accessDistance = #(coords - insideAccess)
                local accessMarker = Config.Markers.access or Config.Markers.mine

                if accessDistance <= (tonumber(access.markerDistance) or 8.0) then
                    waitMs = 0

                    if accessMarker and accessMarker.enabled ~= false then
                        DrawMarker(
                            accessMarker.type or 1,
                            insideAccess.x, insideAccess.y, insideAccess.z - 0.9,
                            0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                            accessMarker.scale.x, accessMarker.scale.y, accessMarker.scale.z,
                            80, 150, 220, 120,
                            false, false, 2, false, nil, nil, false
                        )
                    end

                    if accessDistance <= (tonumber(access.interactDistance) or Config.InteractDistance)
                        and GetGameTimer() >= mineAccessCooldownUntil then
                        draw3DText(insideAccess + vector3(0.0, 0.0, 0.8), '[E] 坑道から出る')
                        if not busy and IsControlJustReleased(0, 38) then
                            transitionMineAccess(access.outside)
                        end
                    end
                end
            end

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
                        local batchSize = math.max(1, tonumber(Config.ProcessingBatchSize) or 100)
                        local batch = math.min(state.rawOre, batchSize)
                        local label = state.rawOre > batch
                            and ('[E] 原石を選鉱 (%d/%d個)'):format(batch, state.rawOre)
                            or ('[E] 原石を選鉱 (%d個)'):format(state.rawOre)
                        draw3DText(
                            Config.Processor.coords + vector3(0.0, 0.0, 1.0),
                            label
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
                        draw3DText(
                            node.coords + vector3(0.0, 0.0, 0.75),
                            ('[E] 壁面をドリル採掘  原石 %d個'):format(state.rawOre)
                        )

                        if not busy and IsControlJustReleased(0, 38) then
                            TriggerServerEvent('flecity_mining:server:beginMine', node.id)
                        end
                    end
                end
            end
        end

        Wait(waitMs)
    end
end)

RegisterCommand('mine_drilltest', function()
    if Config.DevTools ~= true then return end
    if busy then
        notify('作業中はドリルテストできません。')
        return
    end

    CreateThread(function()
        busy = true
        local ped = PlayerPedId()
        local ok = startDrillPresentation(ped, {
            id = -1,
            coords = GetEntityCoords(ped),
            label = 'ドリルテスト',
        })

        if ok then
            notify('ドリルテスト開始: 約5秒間モーションを確認してください。')
            Wait(5000)
        else
            notify('ドリルテスト失敗: animation/propの開始に失敗しました。')
        end

        local cleanupCoords = GetEntityCoords(ped)
        stopDrillPresentation()
        ClearPedTasksImmediately(ped)
        cleanupScenarioDrillProps(cleanupCoords)
        FreezeEntityPosition(ped, false)
        busy = false
    end)
end, false)

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

RegisterCommand('mine_escape', function()
    if Config.DevTools ~= true then return end
    if busy then
        cancelCurrentAction = true
        Wait(100)
    end

    if Config.MineAccess and Config.MineAccess.outside then
        transitionMineAccess(Config.MineAccess.outside)
        notify('鉱山入口へ退避しました。')
    end
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

    local hit, endCoords = raycastWorld(from, to, ped)

    if hit and endCoords then
        local text = ('target = vector3(%.2f, %.2f, %.2f)'):format(endCoords.x, endCoords.y, endCoords.z)
        print('[flecity_mining] ' .. text)
        notify(text)
    else
        notify('5m以内の壁面を検出できませんでした。壁へ正面を向いて再実行してください。')
    end
end, false)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    cancelCurrentAction = true
    clearRoute()
    stopDrillPresentation()

    local cfg = Config.DrillVisuals or {}
    if type(cfg.animDict) == 'string' and cfg.animDict ~= '' then
        RemoveAnimDict(cfg.animDict)
    end
    RemoveNamedPtfxAsset('core')

    -- Do not RemoveIpl here. These map IPLs can be shared with another map/
    -- interior resource; unloading them during a development restart could
    -- break other resources that expect the mine to remain available.

    NewLoadSceneStop()
    ClearFocus()

    local ped = PlayerPedId()
    local cleanupCoords = GetEntityCoords(ped)
    ClearPedTasksImmediately(ped)
    cleanupScenarioDrillProps(cleanupCoords)
    FreezeEntityPosition(ped, false)

    if IsScreenFadedOut() or IsScreenFadingOut() then
        DoScreenFadeIn(250)
    end
end)
