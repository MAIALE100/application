local dynamicBooths = {}
local spawnedObjects = {}
local targetZones = {}
local sharedSessions = {}

local ownedSession = nil
local editorOpen = false
local editorBooth = nil

local countdownDisplay = nil
local captureInProgress = false
local cameraPreviewActive = false
local previewCam = nil
local previewBoothId = nil

local placementMode = false
local placementObject = nil
local placementOrigin = nil
local placementReferenceHeading = 0.0
local placementHeading = 0.0
local placementPosition = nil
local placementHeightOffset = 0.0
local placementCameraPreviewActive = false
local placementCamera = nil

local activeTheme = nil
local themeDui = {
    background = {
        dui = nil,
        txd = nil,
        txdName = "puribooth_bg_txd",
        txnName = "surface"
    },
    floor = {
        dui = nil,
        txd = nil,
        txdName = "puribooth_floor_txd",
        txnName = "surface"
    }
}

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

local function getBasis(heading)
    local radians = math.rad(tonumber(heading) or 0.0)

    local forwardX = -math.sin(radians)
    local forwardY = math.cos(radians)
    local rightX = math.cos(radians)
    local rightY = math.sin(radians)

    return forwardX, forwardY, rightX, rightY
end

local function offsetFromBooth(booth, right, forward, zOffset)
    local forwardX, forwardY, rightX, rightY = getBasis(booth.heading)
    local c = booth.coords

    return vector3(
        c.x + forwardX * forward + rightX * right,
        c.y + forwardY * forward + rightY * right,
        c.z + (zOffset or 0.0)
    )
end

local function prepareBooth(raw, fallbackId)
    if type(raw) ~= "table" or type(raw.coords) ~= "table" then
        return nil
    end

    local booth = {
        id = tostring(raw.id or fallbackId),
        label = tostring(raw.label or "Street PURI"),
        model = tostring(raw.model or Config.DefaultModel),
        coords = {
            x = tonumber(raw.coords.x) or 0.0,
            y = tonumber(raw.coords.y) or 0.0,
            z = tonumber(raw.coords.z) or 0.0
        },
        heading = tonumber(raw.heading) or 0.0
    }

    local geometry = Config.Geometry or {}
    local size = geometry.captureSize or { x = 3.4, y = 2.6, z = 1.0 }

    booth.captureCenter = offsetFromBooth(
        booth,
        tonumber(geometry.captureRight) or 0.0,
        tonumber(geometry.captureForward) or 3.2,
        tonumber(geometry.captureZ) or 0.0
    )

    booth.captureSize = vector3(
        tonumber(size.x) or 3.4,
        tonumber(size.y) or 2.6,
        tonumber(size.z) or 1.0
    )

    booth.camera = {
        coords = offsetFromBooth(
            booth,
            tonumber(geometry.cameraRight) or 0.0,
            tonumber(geometry.cameraForward) or 1.28,
            tonumber(geometry.cameraZ) or 1.09
        ),
        pointAt = offsetFromBooth(
            booth,
            tonumber(geometry.pointRight) or 0.0,
            tonumber(geometry.pointForward) or 3.2,
            tonumber(geometry.pointZ) or 0.49
        ),
        fov = tonumber(geometry.fov) or 68.0
    }

    return booth
end


local function encodeQueryValue(value)
    return tostring(value or ""):gsub("([^%w%-_%.~])", function(char)
        return string.format("%%%02X", string.byte(char))
    end)
end

local function validThemePreset(value)
    local preset = tostring(value or "pink"):lower()
    local allowed = {
        pink = true,
        white = true,
        black = true,
        y2k = true,
        hearts = true,
        none = true
    }

    return allowed[preset] and preset or "pink"
end

local function validThemeUrl(value)
    if value == nil or value == "" then return "" end
    if type(value) ~= "string" or #value > 2048 then return nil end

    local lower = value:lower()
    if lower:sub(1, 8) == "https://" or lower:sub(1, 7) == "http://" then
        return value
    end

    return nil
end

local function themeSurfaceUrl(spec)
    local resource = GetCurrentResourceName()
    local preset = validThemePreset(spec and spec.preset)
    local imageUrl = validThemeUrl(spec and spec.url) or ""

    return ("https://cfx-nui-%s/ui/surface.html?preset=%s&url=%s")
        :format(
            resource,
            encodeQueryValue(preset),
            encodeQueryValue(imageUrl)
        )
end

local function ensureThemeDui(kind)
    local slot = themeDui[kind]
    if not slot then return nil end

    if not slot.dui then
        slot.dui = CreateDui(
            themeSurfaceUrl({ preset = "pink", url = "" }),
            1024,
            1024
        )

        local handle = GetDuiHandle(slot.dui)
        slot.txd = CreateRuntimeTxd(slot.txdName)
        CreateRuntimeTextureFromDuiHandle(
            slot.txd,
            slot.txnName,
            handle
        )
    end

    return slot
end

local function applyThemeSurface(kind, spec)
    local slot = ensureThemeDui(kind)
    if not slot then return end

    SetDuiUrl(slot.dui, themeSurfaceUrl(spec))
end

local function clearTheme()
    activeTheme = nil
    SendNUIMessage({ action = "resetTheme" })

    for _, slot in pairs(themeDui) do
        if slot.dui then
            SetDuiUrl(slot.dui, "about:blank")
        end
    end
end

local function drawTexturedQuad(a, b, c1, d, txd, txn)
    -- Front side.
    DrawSpritePoly(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        c1.x, c1.y, c1.z,
        255, 255, 255, 255,
        txd, txn,
        0.0, 1.0, 1.0,
        0.0, 0.0, 1.0,
        1.0, 1.0, 1.0
    )

    DrawSpritePoly(
        b.x, b.y, b.z,
        d.x, d.y, d.z,
        c1.x, c1.y, c1.z,
        255, 255, 255, 255,
        txd, txn,
        0.0, 0.0, 1.0,
        1.0, 0.0, 1.0,
        1.0, 1.0, 1.0
    )

    -- Reverse side so the surface remains visible regardless of winding.
    DrawSpritePoly(
        c1.x, c1.y, c1.z,
        b.x, b.y, b.z,
        a.x, a.y, a.z,
        255, 255, 255, 255,
        txd, txn,
        1.0, 1.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 1.0, 1.0
    )

    DrawSpritePoly(
        c1.x, c1.y, c1.z,
        d.x, d.y, d.z,
        b.x, b.y, b.z,
        255, 255, 255, 255,
        txd, txn,
        1.0, 1.0, 1.0,
        1.0, 0.0, 1.0,
        0.0, 0.0, 1.0
    )
end

local function renderThemeSurfaces(booth)
    if not booth or not activeTheme then return end

    local surfaces = Config.ThemeSurfaces or {}
    local forwardX, forwardY, rightX, rightY = getBasis(booth.heading)

    local backgroundSpec = activeTheme.background
    if backgroundSpec
        and (
            validThemePreset(backgroundSpec.preset) ~= "none"
            or (validThemeUrl(backgroundSpec.url) or "") ~= ""
        ) then

        local bg = surfaces.background or {}
        local center = offsetFromBooth(
            booth,
            tonumber(bg.right) or 0.0,
            tonumber(bg.forward) or 4.70,
            tonumber(bg.bottomZ) or 0.0
        )

        local halfWidth = (tonumber(bg.width) or 5.2) * 0.5
        local height = tonumber(bg.height) or 3.0

        local bottomLeft = vector3(
            center.x - rightX * halfWidth,
            center.y - rightY * halfWidth,
            center.z
        )
        local topLeft = vector3(
            bottomLeft.x,
            bottomLeft.y,
            center.z + height
        )
        local bottomRight = vector3(
            center.x + rightX * halfWidth,
            center.y + rightY * halfWidth,
            center.z
        )
        local topRight = vector3(
            bottomRight.x,
            bottomRight.y,
            center.z + height
        )

        local slot = themeDui.background
        if slot and slot.dui then
            drawTexturedQuad(
                bottomLeft,
                topLeft,
                bottomRight,
                topRight,
                slot.txdName,
                slot.txnName
            )
        end
    end

    local floorSpec = activeTheme.floor
    if floorSpec
        and (
            validThemePreset(floorSpec.preset) ~= "none"
            or (validThemeUrl(floorSpec.url) or "") ~= ""
        ) then

        local floor = surfaces.floor or {}
        local center = offsetFromBooth(
            booth,
            tonumber(floor.right) or 0.0,
            tonumber(floor.forward) or 3.20,
            tonumber(floor.z) or 0.035
        )

        local halfWidth = (tonumber(floor.width) or 4.6) * 0.5
        local halfDepth = (tonumber(floor.depth) or 3.8) * 0.5

        local function floorCorner(rightOffset, forwardOffset)
            return vector3(
                center.x + rightX * rightOffset + forwardX * forwardOffset,
                center.y + rightY * rightOffset + forwardY * forwardOffset,
                center.z
            )
        end

        local backLeft = floorCorner(-halfWidth, -halfDepth)
        local frontLeft = floorCorner(-halfWidth, halfDepth)
        local backRight = floorCorner(halfWidth, -halfDepth)
        local frontRight = floorCorner(halfWidth, halfDepth)

        local slot = themeDui.floor
        if slot and slot.dui then
            drawTexturedQuad(
                backLeft,
                frontLeft,
                backRight,
                frontRight,
                slot.txdName,
                slot.txnName
            )
        end
    end
end

local function removeInteraction(boothId)
    local zoneId = targetZones[boothId]
    if not zoneId then return end

    if GetResourceState("ox_target") == "started" then
        pcall(function()
            exports.ox_target:removeZone(zoneId)
        end)
    end

    targetZones[boothId] = nil
end

local function removeSpawnedBooth(boothId)
    removeInteraction(boothId)

    local object = spawnedObjects[boothId]
    if object and DoesEntityExist(object) then
        DeleteEntity(object)
    end

    spawnedObjects[boothId] = nil
end

local function spawnBooth(boothId, booth)
    removeSpawnedBooth(boothId)

    local model = requestModel(booth.model)
    if not model then
        print(("[puribooth] invalid model for %s: %s")
            :format(boothId, tostring(booth.model)))
        return
    end

    local c = booth.coords
    local object = CreateObjectNoOffset(
        model,
        c.x,
        c.y,
        c.z,
        false,
        false,
        false
    )

    SetEntityHeading(object, booth.heading)
    PlaceObjectOnGroundProperly(object)
    FreezeEntityPosition(object, true)
    SetEntityInvincible(object, true)
    SetEntityAsMissionEntity(object, true, true)

    spawnedObjects[boothId] = object
    SetModelAsNoLongerNeeded(model)
end


local function stopPlacementCameraPreview()
    if placementCamera and DoesCamExist(placementCamera) then
        RenderScriptCams(false, true, 200, true, true)
        DestroyCam(placementCamera, false)
    elseif placementCameraPreviewActive then
        RenderScriptCams(false, true, 200, true, true)
    end

    placementCamera = nil
    placementCameraPreviewActive = false
end

local function cleanupPlacement()
    stopPlacementCameraPreview()

    if placementObject and DoesEntityExist(placementObject) then
        DeleteEntity(placementObject)
    end

    placementMode = false
    placementObject = nil
    placementOrigin = nil
    placementPosition = nil
    placementHeightOffset = 0.0
end

local function startPlacementPreview()
    if placementMode then
        notify("inform", "すでに配置モードです。")
        return
    end

    if editorOpen or ownedSession or captureInProgress then
        notify("error", "撮影中・編集中は配置できません。")
        return
    end

    local model = requestModel(Config.DefaultModel)
    if not model then
        notify("error", "プリクラ台モデルを読み込めませんでした。")
        return
    end

    local ped = PlayerPedId()
    local origin = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    local preview = Config.PlacementPreview or {}
    local distance = tonumber(preview.initialDistance) or 2.0
    local forwardX, forwardY = getBasis(heading)

    local x = origin.x + forwardX * distance
    local y = origin.y + forwardY * distance
    local z = origin.z + 0.5

    local object = CreateObjectNoOffset(
        model,
        x,
        y,
        z,
        false,
        false,
        false
    )

    SetEntityHeading(object, heading)
    PlaceObjectOnGroundProperly(object)

    local grounded = GetEntityCoords(object)

    SetEntityCollision(object, false, false)
    FreezeEntityPosition(object, true)
    SetEntityInvincible(object, true)
    SetEntityAlpha(
        object,
        math.max(40, math.min(220, tonumber(preview.alpha) or 145)),
        false
    )
    SetEntityAsMissionEntity(object, true, true)

    placementMode = true
    placementObject = object
    placementOrigin = origin
    placementReferenceHeading = heading
    placementHeading = heading
    placementPosition = vector3(grounded.x, grounded.y, grounded.z)
    placementHeightOffset = 0.0

    SetModelAsNoLongerNeeded(model)

    notify(
        "inform",
        "半透明プレビューを表示しました。矢印キーで移動、Q/Eで回転、PageUp/PageDownで高さ調整、Enterで設置です。"
    )
end

local function snapPlacementToGround()
    if not placementObject or not DoesEntityExist(placementObject) then
        return
    end

    local pos = GetEntityCoords(placementObject)

    SetEntityCoordsNoOffset(
        placementObject,
        pos.x,
        pos.y,
        pos.z + 1.5,
        false,
        false,
        false
    )

    PlaceObjectOnGroundProperly(placementObject)

    local grounded = GetEntityCoords(placementObject)
    placementPosition = vector3(
        grounded.x,
        grounded.y,
        grounded.z + placementHeightOffset
    )

    SetEntityCoordsNoOffset(
        placementObject,
        placementPosition.x,
        placementPosition.y,
        placementPosition.z,
        false,
        false,
        false
    )
end

local function movePlacement(dx, dy)
    if not placementPosition or not placementOrigin then return end

    local preview = Config.PlacementPreview or {}
    local maxOffset = tonumber(preview.maxHorizontalOffset) or 6.0

    local nextX = placementPosition.x + dx
    local nextY = placementPosition.y + dy

    local fromOrigin = vector2(
        nextX - placementOrigin.x,
        nextY - placementOrigin.y
    )

    if #fromOrigin > maxOffset then
        return
    end

    placementPosition = vector3(
        nextX,
        nextY,
        placementPosition.z
    )

    SetEntityCoordsNoOffset(
        placementObject,
        nextX,
        nextY,
        placementPosition.z,
        false,
        false,
        false
    )

    snapPlacementToGround()
end

local function confirmPlacement()
    if not placementMode
        or not placementObject
        or not DoesEntityExist(placementObject) then
        return
    end

    local coords = GetEntityCoords(placementObject)
    local heading = placementHeading

    cleanupPlacement()

    TriggerServerEvent("puribooth:server:adminPlace", {
        x = coords.x,
        y = coords.y,
        z = coords.z,
        heading = heading
    })
end

local function buildPlacementBooth()
    if not placementObject or not DoesEntityExist(placementObject) then
        return nil
    end

    local pos = GetEntityCoords(placementObject)

    return prepareBooth({
        id = "placement-preview",
        label = "Placement Preview",
        model = Config.DefaultModel,
        coords = {
            x = pos.x,
            y = pos.y,
            z = pos.z
        },
        heading = placementHeading
    }, "placement-preview")
end

local function togglePlacementCameraPreview()
    if not placementMode then return end

    if placementCameraPreviewActive then
        stopPlacementCameraPreview()
        return
    end

    local booth = buildPlacementBooth()
    if not booth then return end

    local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    local cc = booth.camera.coords
    local pp = booth.camera.pointAt

    SetCamCoord(cam, cc.x, cc.y, cc.z)
    PointCamAtCoord(cam, pp.x, pp.y, pp.z)
    SetCamFov(cam, booth.camera.fov or 68.0)
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 200, true, true)

    placementCamera = cam
    placementCameraPreviewActive = true
end

local function drawPlacementZone(booth)
    if not booth then return end

    local center = booth.captureCenter
    local size = booth.captureSize
    local halfRight = (size.x or 3.4) * 0.5
    local halfForward = (size.y or 2.6) * 0.5
    local forwardX, forwardY, rightX, rightY = getBasis(booth.heading)
    local z = center.z + 0.035

    local function corner(rightOffset, forwardOffset)
        return vector3(
            center.x + rightX * rightOffset + forwardX * forwardOffset,
            center.y + rightY * rightOffset + forwardY * forwardOffset,
            z
        )
    end

    local a = corner(-halfRight, -halfForward)
    local b = corner( halfRight, -halfForward)
    local c1 = corner( halfRight,  halfForward)
    local d = corner(-halfRight,  halfForward)

    DrawLine(a.x, a.y, a.z, b.x, b.y, b.z, 255, 95, 180, 235)
    DrawLine(b.x, b.y, b.z, c1.x, c1.y, c1.z, 255, 95, 180, 235)
    DrawLine(c1.x, c1.y, c1.z, d.x, d.y, d.z, 255, 95, 180, 235)
    DrawLine(d.x, d.y, d.z, a.x, a.y, a.z, 255, 95, 180, 235)

    DrawLine(
        a.x, a.y, a.z,
        c1.x, c1.y, c1.z,
        255, 95, 180, 90
    )
    DrawLine(
        b.x, b.y, b.z,
        d.x, d.y, d.z,
        255, 95, 180, 90
    )

    for _, p in ipairs({ a, b, c1, d }) do
        DrawMarker(
            28,
            p.x, p.y, p.z + 0.08,
            0.0, 0.0, 0.0,
            0.0, 0.0, 0.0,
            0.16, 0.16, 0.16,
            255, 95, 180, 230,
            false, false, 2, false, nil, nil, false
        )
    end

    DrawMarker(
        28,
        center.x, center.y, z + 0.10,
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0,
        0.25, 0.25, 0.25,
        255, 255, 255, 220,
        false, false, 2, false, nil, nil, false
    )

    local boothPos = GetEntityCoords(placementObject)
    local camPos = booth.camera.coords

    DrawLine(
        boothPos.x,
        boothPos.y,
        boothPos.z + 0.7,
        center.x,
        center.y,
        z + 0.15,
        255,
        95,
        180,
        230
    )

    DrawLine(
        camPos.x,
        camPos.y,
        camPos.z,
        center.x,
        center.y,
        center.z + 0.5,
        255,
        255,
        255,
        210
    )
end

RegisterNetEvent("puribooth:client:adminPlaceHere", function()
    startPlacementPreview()
end)

local function startSession(boothId)
    if editorOpen or ownedSession then
        notify("error", "すでにプリクラ撮影を準備中です。")
        return
    end

    TriggerServerEvent("puribooth:server:startSession", boothId)
end

local function registerInteraction(boothId, booth)
    removeInteraction(boothId)

    if GetResourceState("ox_target") ~= "started" then
        return
    end

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
                    return not sharedSessions[boothId]
                        and not editorOpen
                        and not ownedSession
                        and not placementMode
                end,
                onSelect = function()
                    startSession(boothId)
                end
            }
        }
    })
end

local function syncBooths(incoming)
    for boothId in pairs(spawnedObjects) do
        removeSpawnedBooth(boothId)
    end

    dynamicBooths = {}

    if type(incoming) ~= "table" then
        return
    end

    for incomingId, raw in pairs(incoming) do
        local booth = prepareBooth(raw, incomingId)

        if booth then
            local boothId = booth.id
            dynamicBooths[boothId] = booth
            spawnBooth(boothId, booth)
            registerInteraction(boothId, booth)
        end
    end
end

RegisterNetEvent("puribooth:client:syncBooths", function(incoming)
    syncBooths(incoming)
end)

RegisterNetEvent("puribooth:client:removeBooth", function(boothId)
    boothId = tostring(boothId)

    removeSpawnedBooth(boothId)
    dynamicBooths[boothId] = nil
    sharedSessions[boothId] = nil
end)


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
        c.x,
        c.y,
        c.z - 1.02,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        s.x,
        s.y,
        0.20,
        255,
        95,
        180,
        95,
        false,
        false,
        2,
        false,
        nil,
        nil,
        false
    )
end

local function createBoothCamera(booth)
    local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    local c = booth.camera.coords
    local p = booth.camera.pointAt

    SetCamCoord(cam, c.x, c.y, c.z)
    PointCamAtCoord(cam, p.x, p.y, p.z)
    SetCamFov(cam, booth.camera.fov or 68.0)
    SetCamActive(cam, true)
    RenderScriptCams(true, false, 0, true, true)

    return cam
end

local function destroyPreviewCamera(transition)
    if previewCam and DoesCamExist(previewCam) then
        RenderScriptCams(
            false,
            transition == true,
            transition == true and 250 or 0,
            true,
            true
        )
        DestroyCam(previewCam, false)
    elseif cameraPreviewActive then
        RenderScriptCams(false, transition == true, 250, true, true)
    end

    previewCam = nil
    previewBoothId = nil
    cameraPreviewActive = false

    DisplayRadar(true)
    TriggerEvent("lb-phone:toggleHud", false)
end

local function enterCameraPreview(boothId)
    local booth = dynamicBooths[boothId]
    if not booth or not ownedSession then return end

    destroyPreviewCamera(false)

    previewCam = createBoothCamera(booth)
    previewBoothId = boothId
    cameraPreviewActive = true
    ownedSession.phase = "preview"

    DisplayRadar(false)
    TriggerEvent("lb-phone:toggleHud", true)

    notify(
        "inform",
        "画角を固定しました。エモートや立ち位置を整えて、もう一度Eで撮影開始です。"
    )
end

local function leaveCameraPreview()
    if ownedSession and ownedSession.phase == "preview" then
        ownedSession.phase = "gathering"
    end

    destroyPreviewCamera(true)
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

local function locationMetadata(booth)
    if not booth then
        return {
            label = "Street PURI",
            street = "",
            zone = ""
        }
    end

    local c = booth.coords
    local streetHash = GetStreetNameAtCoord(c.x, c.y, c.z)
    local street = ""

    if streetHash and streetHash ~= 0 then
        street = GetStreetNameFromHashKey(streetHash)
    end

    local zoneCode = GetNameOfZone(c.x, c.y, c.z)
    local zone = zoneCode or ""

    if zoneCode and zoneCode ~= "" then
        local translated = GetLabelText(zoneCode)
        if translated and translated ~= "NULL" then
            zone = translated
        end
    end

    return {
        label = booth.label or "Street PURI",
        street = street or "",
        zone = zone or ""
    }
end

local function openEditor(boothId, shots)
    local booth = dynamicBooths[boothId]

    editorOpen = true
    editorBooth = booth and {
        id = boothId,
        label = booth.label,
        coords = booth.coords
    } or nil

    SetNuiFocus(true, true)

    SendNUIMessage({
        action = "open",
        boothId = boothId,
        shots = shots,
        label = booth and booth.label or "Street PURI"
    })
end

RegisterNetEvent("puribooth:client:sessionState", function(boothId, state)
    boothId = tostring(boothId)
    sharedSessions[boothId] = state or nil

    if not ownedSession or ownedSession.boothId ~= boothId or state then
        return
    end

    local phase = ownedSession.phase

    if phase == "theme"
        or phase == "gathering"
        or phase == "preview"
        or phase == "starting" then

        SetNuiFocus(false, false)
        SendNUIMessage({ action = "closeTheme" })
        destroyPreviewCamera(true)
        clearTheme()
        ownedSession = nil
    end
end)

RegisterNetEvent("puribooth:client:sessionOpened", function(boothId, expiresAt)
    boothId = tostring(boothId)

    clearTheme()

    ownedSession = {
        boothId = boothId,
        expiresAt = expiresAt,
        phase = "theme"
    }

    SetNuiFocus(true, true)
    SendNUIMessage({ action = "openTheme" })

    notify(
        "inform",
        "最初に撮影背景と床を選んでください。設定はこの撮影だけに使われます。"
    )
end)

RegisterNetEvent("puribooth:client:countdown", function(boothId, shotIndex)
    boothId = tostring(boothId)
    local booth = dynamicBooths[boothId]
    if not booth then return end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)

    if #(coords - booth.captureCenter) > 18.0 then
        return
    end

    CreateThread(function()
        local seconds = math.max(
            1,
            tonumber(Config.CountdownSeconds) or 3
        )

        for n = seconds, 1, -1 do
            countdownDisplay =
                ("PHOTO %d/%d   %d")
                :format(
                    shotIndex,
                    Config.ShotCount or 4,
                    n
                )

            Wait(1000)
        end

        countdownDisplay = "SMILE!"
        Wait(450)
        countdownDisplay = nil
    end)
end)

RegisterNetEvent("puribooth:client:captureOwner", function(boothId)
    boothId = tostring(boothId)

    local booth = dynamicBooths[boothId]
    if not booth or not ownedSession or ownedSession.boothId ~= boothId then
        return
    end

    CreateThread(function()
        ownedSession.phase = "capturing"
        captureInProgress = true

        if not previewCam
            or not DoesCamExist(previewCam)
            or previewBoothId ~= boothId then

            destroyPreviewCamera(false)
            previewCam = createBoothCamera(booth)
            previewBoothId = boothId
            cameraPreviewActive = true
        end

        DisplayRadar(false)
        TriggerEvent("lb-phone:toggleHud", true)

        local shots = {}
        local failed = false

        for shotIndex = 1, math.max(
            1,
            tonumber(Config.ShotCount) or 4
        ) do
            TriggerServerEvent(
                "puribooth:server:announceCountdown",
                boothId,
                shotIndex
            )

            Wait(
                math.max(
                    1,
                    tonumber(Config.CountdownSeconds) or 3
                ) * 1000
            )

            -- Let the countdown/SMILE overlay disappear before screenshot-basic
            -- captures the fixed scripted-camera render.
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

            Wait(
                math.max(
                    500,
                    tonumber(Config.ShotIntervalMs) or 1800
                )
            )
        end

        captureInProgress = false
        destroyPreviewCamera(true)
        clearTheme()

        if failed or #shots == 0 then
            TriggerServerEvent(
                "puribooth:server:technicalFailure",
                boothId
            )

            notify("error", "写真を取得できませんでした。")
            ownedSession = nil
            return
        end

        TriggerServerEvent(
            "puribooth:server:captureComplete",
            boothId
        )

        ownedSession.phase = "editing"
        openEditor(boothId, shots)
    end)
end)

RegisterNUICallback("puriboothThemeConfirm", function(data, cb)
    if not ownedSession or ownedSession.phase ~= "theme" then
        cb({ ok = false, error = "no_session" })
        return
    end

    local background = type(data) == "table" and data.background or {}
    local floor = type(data) == "table" and data.floor or {}

    local backgroundUrl = validThemeUrl(background and background.url)
    local floorUrl = validThemeUrl(floor and floor.url)

    if backgroundUrl == nil or floorUrl == nil then
        cb({ ok = false, error = "invalid_url" })
        return
    end

    activeTheme = {
        background = {
            preset = validThemePreset(background and background.preset),
            url = backgroundUrl
        },
        floor = {
            preset = validThemePreset(floor and floor.preset),
            url = floorUrl
        }
    }

    applyThemeSurface("background", activeTheme.background)
    applyThemeSurface("floor", activeTheme.floor)

    ownedSession.phase = "gathering"
    SetNuiFocus(false, false)
    SendNUIMessage({ action = "closeTheme" })

    notify(
        "inform",
        "背景と床を反映しました。Eで撮影画角を確認できます。"
    )

    cb({ ok = true })
end)

RegisterNUICallback("puriboothThemeCancel", function(_, cb)
    SetNuiFocus(false, false)
    SendNUIMessage({ action = "closeTheme" })

    if ownedSession then
        TriggerServerEvent(
            "puribooth:server:finishSession",
            ownedSession.boothId
        )
    end

    clearTheme()
    ownedSession = nil
    cb({ ok = true })
end)

RegisterNUICallback("puriboothFinish", function(data, cb)
    local boothId =
        (type(data) == "table" and data.boothId)
        or (editorBooth and editorBooth.id)
        or (ownedSession and ownedSession.boothId)

    if boothId then
        boothId = tostring(boothId)
    end

    local image = type(data) == "table" and data.image or nil

    if type(image) ~= "string"
        or #image < 100
        or #image > (12 * 1024 * 1024) then

        cb({
            ok = false,
            error = "invalid_image"
        })
        return
    end

    SetNuiFocus(false, false)
    editorOpen = false
    SendNUIMessage({ action = "close" })

    if boothId then
        TriggerServerEvent(
            "puribooth:server:finishSession",
            boothId
        )
    end

    local booth = boothId and dynamicBooths[boothId] or nil
    local metadata = locationMetadata(booth)

    ownedSession = nil
    editorBooth = nil

    if GetResourceState("puriphoto") == "started" then
        TriggerEvent(
            "puriphoto:client:openBoothImport",
            image,
            metadata
        )

        cb({
            ok = true,
            handoff = "puriphoto"
        })
    else
        notify(
            "error",
            "PuriPhotoが起動していないため画像を渡せませんでした。"
        )

        cb({
            ok = false,
            error = "puriphoto_not_started"
        })
    end
end)

RegisterNUICallback("puriboothCancel", function(_, cb)
    SetNuiFocus(false, false)
    editorOpen = false
    SendNUIMessage({ action = "close" })

    if ownedSession then
        TriggerServerEvent(
            "puribooth:server:finishSession",
            ownedSession.boothId
        )
    end

    destroyPreviewCamera(true)
    clearTheme()

    ownedSession = nil
    editorBooth = nil

    cb({ ok = true })
end)

CreateThread(function()
    Wait(1000)
    TriggerServerEvent("puribooth:server:requestSync")

    while true do
        local wait = 800
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)

        for boothId, booth in pairs(dynamicBooths) do
            local state = sharedSessions[boothId]

            if state
                and not state.capturing
                and not (
                    ownedSession
                    and ownedSession.boothId == boothId
                    and (
                        ownedSession.phase == "preview"
                        or ownedSession.phase == "starting"
                        or captureInProgress
                    )
                ) then

                local distance = #(coords - booth.captureCenter)

                if distance < 35.0 then
                    wait = 0
                    sessionMarker(booth)
                end
            end

            if GetResourceState("ox_target") ~= "started"
                and not state
                and not ownedSession
                and not editorOpen
                and not placementMode then

                local bc = vector3(
                    booth.coords.x,
                    booth.coords.y,
                    booth.coords.z
                )

                if #(coords - bc) <= (Config.InteractDistance or 2.2) then
                    wait = 0

                    drawText2d(
                        ("PURI  $%s   [E]")
                            :format(Config.Price or 0),
                        0.5,
                        0.86,
                        0.42
                    )

                    if IsControlJustReleased(0, 38) then
                        startSession(boothId)
                    end
                end
            end
        end

        if placementMode
            and placementObject
            and DoesEntityExist(placementObject) then

            wait = 0

            local preview = Config.PlacementPreview or {}
            local fast = IsControlPressed(0, 21)
            local speedMultiplier = fast and 4.0 or 1.0
            local moveStep = (tonumber(preview.moveStep) or 0.035) * speedMultiplier
            local rotateStep = (tonumber(preview.rotateStep) or 1.0) * speedMultiplier
            local heightStep = (tonumber(preview.heightStep) or 0.02) * speedMultiplier

            DisableControlAction(0, 172, true)
            DisableControlAction(0, 173, true)
            DisableControlAction(0, 174, true)
            DisableControlAction(0, 175, true)
            DisableControlAction(0, 44, true)
            DisableControlAction(0, 38, true)
            DisableControlAction(0, 10, true)
            DisableControlAction(0, 11, true)
            DisableControlAction(0, 191, true)
            DisableControlAction(0, 177, true)
            DisableControlAction(0, 26, true)

            local forwardX, forwardY, rightX, rightY =
                getBasis(placementReferenceHeading)

            if IsDisabledControlPressed(0, 172) then
                movePlacement(
                    forwardX * moveStep,
                    forwardY * moveStep
                )
            end

            if IsDisabledControlPressed(0, 173) then
                movePlacement(
                    -forwardX * moveStep,
                    -forwardY * moveStep
                )
            end

            if IsDisabledControlPressed(0, 174) then
                movePlacement(
                    -rightX * moveStep,
                    -rightY * moveStep
                )
            end

            if IsDisabledControlPressed(0, 175) then
                movePlacement(
                    rightX * moveStep,
                    rightY * moveStep
                )
            end

            if IsDisabledControlPressed(0, 44) then
                placementHeading =
                    (placementHeading + rotateStep) % 360.0
                SetEntityHeading(
                    placementObject,
                    placementHeading
                )
            end

            if IsDisabledControlPressed(0, 38) then
                placementHeading =
                    (placementHeading - rotateStep) % 360.0
                SetEntityHeading(
                    placementObject,
                    placementHeading
                )
            end

            if IsDisabledControlPressed(0, 10) then
                placementHeightOffset =
                    placementHeightOffset + heightStep

                placementPosition = vector3(
                    placementPosition.x,
                    placementPosition.y,
                    placementPosition.z + heightStep
                )

                SetEntityCoordsNoOffset(
                    placementObject,
                    placementPosition.x,
                    placementPosition.y,
                    placementPosition.z,
                    false,
                    false,
                    false
                )
            end

            if IsDisabledControlPressed(0, 11) then
                placementHeightOffset =
                    placementHeightOffset - heightStep

                placementPosition = vector3(
                    placementPosition.x,
                    placementPosition.y,
                    placementPosition.z - heightStep
                )

                SetEntityCoordsNoOffset(
                    placementObject,
                    placementPosition.x,
                    placementPosition.y,
                    placementPosition.z,
                    false,
                    false,
                    false
                )
            end

            if IsDisabledControlJustReleased(0, 26) then
                togglePlacementCameraPreview()
            elseif IsDisabledControlJustReleased(0, 191) then
                confirmPlacement()
            elseif IsDisabledControlJustReleased(0, 177) then
                if placementCameraPreviewActive then
                    stopPlacementCameraPreview()
                else
                    cleanupPlacement()
                    notify("inform", "プリクラ台の配置をキャンセルしました。")
                end
            end

            if placementMode
                and placementObject
                and DoesEntityExist(placementObject) then

                local previewBooth = buildPlacementBooth()
                drawPlacementZone(previewBooth)

                if placementCameraPreviewActive then
                    drawText2d(
                        "CAMERA PREVIEW   [C] BACK   [BACKSPACE] BACK",
                        0.5,
                        0.82,
                        0.42
                    )
                else
                    drawText2d(
                        "PINK BOX = PHOTO ZONE   ARROWS MOVE   Q/E ROTATE   PGUP/PGDN HEIGHT",
                        0.5,
                        0.80,
                        0.34
                    )

                    drawText2d(
                        "[C] CAMERA   [SHIFT] FAST   [ENTER] PLACE   [BACKSPACE] CANCEL",
                        0.5,
                        0.84,
                        0.38
                    )
                end
            end
        end

        if ownedSession and not editorOpen then
            local booth = dynamicBooths[ownedSession.boothId]

            if booth and activeTheme then
                wait = 0
                renderThemeSurfaces(booth)
            end

            if booth then
                local phase = ownedSession.phase or "gathering"

                if phase == "gathering" then
                    wait = 0
                    sessionMarker(booth)

                    drawText2d(
                        "STEP 1/2   [E] CAMERA PREVIEW",
                        0.5,
                        0.82,
                        0.46
                    )

                    if IsControlJustReleased(0, 38) then
                        enterCameraPreview(ownedSession.boothId)
                    end
                elseif phase == "preview" then
                    wait = 0

                    drawText2d(
                        "STEP 2/2   [E] START   [BACKSPACE] BACK",
                        0.5,
                        0.82,
                        0.44
                    )

                    if IsControlJustReleased(0, 38) then
                        ownedSession.phase = "starting"

                        TriggerServerEvent(
                            "puribooth:server:beginCapture",
                            ownedSession.boothId
                        )
                    elseif IsControlJustReleased(0, 177) then
                        leaveCameraPreview()
                    end
                end
            end
        end

        if cameraPreviewActive and not captureInProgress then
            wait = 0
            DisplayRadar(false)
        end

        if captureInProgress then
            wait = 0
            HideHudAndRadarThisFrame()
            HideHelpTextThisFrame()
            ThefeedHideThisFrame()
        end

        if countdownDisplay then
            wait = 0
            drawText2d(
                countdownDisplay,
                0.5,
                0.43,
                1.05
            )
        end

        Wait(wait)
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then
        return
    end

    SetNuiFocus(false, false)
    destroyPreviewCamera(false)
    cleanupPlacement()
    clearTheme()

    for _, slot in pairs(themeDui) do
        if slot.dui then
            DestroyDui(slot.dui)
            slot.dui = nil
            slot.txd = nil
        end
    end

    for boothId in pairs(spawnedObjects) do
        removeSpawnedBooth(boothId)
    end
end)
