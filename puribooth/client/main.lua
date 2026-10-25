local spawnedObjects = {}
local targetZones = {}
local sharedSessions = {}
local ownedSession = nil
local editorOpen = false
local countdownDisplay = nil

local function notify(kind, message)
    if GetResourceState("ox_lib") == "started" and lib and lib.notify then
        lib.notify({
            type = kind == "error" and "error" or "inform",
            description = message
        })
        return
    end

    BeginTextCommandThefeedPost("STRING")
    AddTextComponentSubstringPlayerName(message)
    EndTextCommandThefeedPostTicker(false, false)
end

RegisterNetEvent("puribooth:client:notify", notify)

local function requestModel(modelName)
    local model = joaat(modelName)
    if not IsModelInCdimage(model) or not IsModelValid(model) then
        return nil
    end

    RequestModel(model)
    local deadline = GetGameTimer() + 5000
    while not HasModelLoaded(model) and GetGameTimer() < deadline do
        Wait(0)
    end

    return HasModelLoaded(model) and model or nil
end

local function spawnBooth(boothId, booth)
    local model = requestModel(booth.model)
    if not model then
        print(("[puribooth] invalid model for %s: %s"):format(boothId, tostring(booth.model)))
        return
    end

    local c = booth.coords
    local object = CreateObjectNoOffset(model, c.x, c.y, c.z, false, false, false)
    SetEntityHeading(object, c.w)
    PlaceObjectOnGroundProperly(object)
    FreezeEntityPosition(object, true)
    SetEntityInvincible(object, true)
    SetEntityAsMissionEntity(object, true, true)
    spawnedObjects[boothId] = object
    SetModelAsNoLongerNeeded(model)
end

local function startSession(boothId)
    if editorOpen or ownedSession then
        notify("error", "すでにプリクラ撮影を準備中です。")
        return
    end
    TriggerServerEvent("puribooth:server:startSession", boothId)
end

local function registerInteraction(boothId, booth)
    if GetResourceState("ox_target") == "started" then
        local c = booth.coords
        targetZones[boothId] = exports.ox_target:addSphereZone({
            coords = vector3(c.x, c.y, c.z + 0.7),
            radius = Config.InteractDistance or 2.2,
            debug = Config.Debug == true,
            drawSprite = false,
            options = {
                {
                    name = ("puribooth_%s"):format(boothId),
                    icon = "fa-solid fa-camera-retro",
                    label = ("プリクラを撮る $%s"):format(Config.Price or 0),
                    distance = Config.InteractDistance or 2.2,
                    canInteract = function()
                        return not sharedSessions[boothId] and not editorOpen and not ownedSession
                    end,
                    onSelect = function()
                        startSession(boothId)
                    end
                }
            }
        })
    end
end

local function drawText2d(text, x, y, scale)
    SetTextFont(4)
    SetTextScale(scale or 0.55, scale or 0.55)
    SetTextCentre(true)
    SetTextColour(255, 255, 255, 255)
    SetTextOutline()
    BeginTextCommandDisplayText("STRING")
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayText(x, y)
end

local function sessionMarker(booth)
    local c = booth.captureCenter
    local s = booth.captureSize
    DrawMarker(
        1,
        c.x, c.y, c.z - 1.02,
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0,
        s.x, s.y, 0.20,
        255, 95, 180, 95,
        false, false, 2, false, nil, nil, false
    )
end

local function createBoothCamera(booth)
    local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    local c = booth.camera.coords
    local p = booth.camera.pointAt
    SetCamCoord(cam, c.x, c.y, c.z)
    PointCamAtCoord(cam, p.x, p.y, p.z)
    SetCamFov(cam, booth.camera.fov or 58.0)
    SetCamActive(cam, true)
    RenderScriptCams(true, false, 0, true, true)
    return cam
end

local function destroyBoothCamera(cam)
    RenderScriptCams(false, true, 350, true, true)
    if cam and DoesCamExist(cam) then
        DestroyCam(cam, false)
    end
end

local function captureFrame(callback)
    if GetResourceState("screenshot-basic") ~= "started" then
        callback(nil)
        return
    end

    exports["screenshot-basic"]:requestScreenshot({
        encoding = "jpg",
        quality = Config.ScreenshotQuality or 0.92
    }, function(data)
        callback(type(data) == "string" and data or nil)
    end)
end

local function openEditor(boothId, shots)
    editorOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = "open",
        boothId = boothId,
        shots = shots,
        label = Config.Booths[boothId].label or boothId
    })
end

RegisterNetEvent("puribooth:client:sessionState", function(boothId, state)
    sharedSessions[boothId] = state or nil
    if ownedSession and ownedSession.boothId == boothId and not state then
        ownedSession = nil
    end
end)

RegisterNetEvent("puribooth:client:sessionOpened", function(boothId, expiresAt)
    ownedSession = {
        boothId = boothId,
        expiresAt = expiresAt
    }
    notify("inform", "撮影範囲に集まったら、好きなタイミングで撮影を開始してください。")
end)

RegisterNetEvent("puribooth:client:countdown", function(boothId, shotIndex)
    local booth = Config.Booths[boothId]
    if not booth then return end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    if #(coords - booth.captureCenter) > 18.0 then return end

    CreateThread(function()
        local seconds = math.max(1, tonumber(Config.CountdownSeconds) or 3)
        for n = seconds, 1, -1 do
            countdownDisplay = ("PHOTO %d/%d   %d"):format(shotIndex, Config.ShotCount or 4, n)
            Wait(1000)
        end
        countdownDisplay = "SMILE!"
        Wait(450)
        countdownDisplay = nil
    end)
end)

RegisterNetEvent("puribooth:client:captureOwner", function(boothId)
    local booth = Config.Booths[boothId]
    if not booth or not ownedSession or ownedSession.boothId ~= boothId then return end

    CreateThread(function()
        local cam = createBoothCamera(booth)
        DisplayRadar(false)
        TriggerEvent("lb-phone:toggleHud", true)

        local shots = {}
        local failed = false

        for shotIndex = 1, math.max(1, tonumber(Config.ShotCount) or 4) do
            TriggerServerEvent("puribooth:server:announceCountdown", boothId, shotIndex)
            Wait(math.max(1, tonumber(Config.CountdownSeconds) or 3) * 1000)
            -- Countdown/SMILE text is intentionally cleared before screenshot-basic
            -- captures the rendered game view.
            Wait(550)

            local finished = false
            local frame = nil
            captureFrame(function(data)
                frame = data
                finished = true
            end)

            local deadline = GetGameTimer() + 12000
            while not finished and GetGameTimer() < deadline do
                Wait(25)
            end

            if not frame then
                failed = true
                break
            end

            shots[#shots + 1] = frame
            Wait(math.max(500, tonumber(Config.ShotIntervalMs) or 1800))
        end

        TriggerEvent("lb-phone:toggleHud", false)
        DisplayRadar(true)
        destroyBoothCamera(cam)

        if failed or #shots == 0 then
            TriggerServerEvent("puribooth:server:technicalFailure", boothId)
            notify("error", "写真を取得できませんでした。")
            ownedSession = nil
            return
        end

        -- The physical booth becomes available immediately after the photos are
        -- taken. The payer can spend as long as needed in the editor without
        -- blocking the next group.
        TriggerServerEvent("puribooth:server:captureComplete", boothId)
        openEditor(boothId, shots)
    end)
end)

RegisterNUICallback("puriboothFinish", function(data, cb)
    local boothId = ownedSession and ownedSession.boothId or (type(data) == "table" and data.boothId)
    local image = type(data) == "table" and data.image or nil

    if type(image) ~= "string" or #image < 100 or #image > (12 * 1024 * 1024) then
        cb({ ok = false, error = "invalid_image" })
        return
    end

    SetNuiFocus(false, false)
    editorOpen = false
    SendNUIMessage({ action = "close" })

    if boothId then
        TriggerServerEvent("puribooth:server:finishSession", boothId)
    end

    ownedSession = nil

    if GetResourceState("puriphoto") == "started" then
        TriggerEvent("puriphoto:client:openBoothImport", image, {
            label = "Legion Square PURI",
            street = "Legion Square",
            zone = "Pillbox Hill"
        })
        cb({ ok = true, handoff = "puriphoto" })
    else
        notify("error", "PuriPhotoが起動していないため画像を渡せませんでした。")
        cb({ ok = false, error = "puriphoto_not_started" })
    end
end)

RegisterNUICallback("puriboothCancel", function(_, cb)
    SetNuiFocus(false, false)
    editorOpen = false
    SendNUIMessage({ action = "close" })
    if ownedSession then
        TriggerServerEvent("puribooth:server:finishSession", ownedSession.boothId)
    end
    ownedSession = nil
    cb({ ok = true })
end)

CreateThread(function()
    for boothId, booth in pairs(Config.Booths or {}) do
        spawnBooth(boothId, booth)
        registerInteraction(boothId, booth)
    end

    while true do
        local wait = 800
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)

        for boothId, booth in pairs(Config.Booths or {}) do
            if sharedSessions[boothId] then
                local distance = #(coords - booth.captureCenter)
                if distance < 35.0 then
                    wait = 0
                    sessionMarker(booth)
                end
            end

            if GetResourceState("ox_target") ~= "started" and not sharedSessions[boothId] and not ownedSession and not editorOpen then
                local bc = vector3(booth.coords.x, booth.coords.y, booth.coords.z)
                if #(coords - bc) <= (Config.InteractDistance or 2.2) then
                    wait = 0
                    drawText2d(("~p~[E]~s~ プリクラを撮る  $%s"):format(Config.Price or 0), 0.5, 0.86, 0.42)
                    if IsControlJustReleased(0, 38) then
                        startSession(boothId)
                    end
                end
            end
        end

        if ownedSession and not editorOpen then
            local booth = Config.Booths[ownedSession.boothId]
            if booth then
                wait = 0
                sessionMarker(booth)
                drawText2d("撮影範囲に集まったら ~p~[E]~s~ 撮影開始", 0.5, 0.82, 0.48)
                if IsControlJustReleased(0, 38) then
                    TriggerServerEvent("puribooth:server:beginCapture", ownedSession.boothId)
                end
            end
        end

        if countdownDisplay then
            wait = 0
            drawText2d(countdownDisplay, 0.5, 0.43, 1.05)
        end

        Wait(wait)
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end

    SetNuiFocus(false, false)
    for boothId, object in pairs(spawnedObjects) do
        if DoesEntityExist(object) then DeleteEntity(object) end
        spawnedObjects[boothId] = nil
    end

    if GetResourceState("ox_target") == "started" then
        for _, zoneId in pairs(targetZones) do
            pcall(function()
                exports.ox_target:removeZone(zoneId)
            end)
        end
    end
end)
