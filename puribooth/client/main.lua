local dynamicBooths = {}
local spawnedObjects = {}
local targetZones = {}
local sharedSessions = {}

local ownedSession = nil
local editorOpen = false
local editorBooth = nil

local countdownDisplay = nil
local countdownGeneration = 0
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
local poseReadyForNextShot = false
local poseAdvanceRequested = false
local poseShotIndex = 0
local captureCancelledByUser = false
local captureGuideVisible = true

local themeRuntimeNonce = ("%d_%d"):format(GetGameTimer(), PlayerId())
local themeTextureGeneration = 0
local themeTextures = {
    background = nil,
    floor = nil
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

local function localizeBoothLabel(value)
    local label = tostring(value or "")

    local streetNumber = label:match("^Street PURI #(%d+)$")
    if streetNumber then
        return ("ストリートプリ #%s"):format(streetNumber)
    end

    if label == "Street PURI" then
        return "ストリートプリ"
    end

    if label == "Legion PURI" then
        return "リージョンプリ"
    end

    if label == "PURI" then
        return "プリクラ"
    end

    if label == "" then
        return "ストリートプリ"
    end

    return label
end

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
        label = localizeBoothLabel(raw.label or "ストリートプリ"),
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


local function validThemeImage(value)
    if type(value) ~= "string" then return nil end
    if #value < 32 or #value > (8 * 1024 * 1024) then return nil end

    local lower = value:sub(1, 32):lower()
    if lower:find("^data:image/") then
        return value
    end

    return nil
end

local function createThemeTexture(kind, image)
    themeTextureGeneration = themeTextureGeneration + 1

    local slot = {
        txdName = ("puribooth_%s_txd_%s_%d")
            :format(kind, themeRuntimeNonce, themeTextureGeneration),
        txnName = "surface"
    }

    slot.txd = CreateRuntimeTxd(slot.txdName)
    if not slot.txd then
        print(("[puribooth] runtime txd create failed: %s"):format(kind))
        return false
    end

    slot.texture = CreateRuntimeTextureFromImage(
        slot.txd,
        slot.txnName,
        image
    )

    if not slot.texture then
        print(("[puribooth] runtime image texture create failed: %s"):format(kind))
        return false
    end

    themeTextures[kind] = slot
    return true
end

local function clearTheme()
    activeTheme = nil
    themeTextures.background = nil
    themeTextures.floor = nil
    SendNUIMessage({ action = "resetTheme" })
end

local function drawTexturedQuad(topLeft, topRight, bottomLeft, bottomRight, txd, txn)
    local function tri(a, b, c1, au, av, bu, bv, cu, cv)
        DrawTexturedPoly(
            a.x, a.y, a.z,
            b.x, b.y, b.z,
            c1.x, c1.y, c1.z,
            255, 255, 255, 255,
            txd, txn,
            au, av, 1.0,
            bu, bv, 1.0,
            cu, cv, 1.0
        )
    end

    -- Same winding/UV layout used by working FiveM world-space DUI panels.
    tri(
        topLeft,
        topRight,
        bottomLeft,
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0
    )

    tri(
        bottomLeft,
        topRight,
        bottomRight,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0
    )

    -- Reverse winding so both sides remain visible.
    tri(
        bottomLeft,
        topRight,
        topLeft,
        0.0, 1.0,
        1.0, 0.0,
        0.0, 0.0
    )

    tri(
        bottomRight,
        topRight,
        bottomLeft,
        1.0, 1.0,
        1.0, 0.0,
        0.0, 1.0
    )
end

local function renderPhotoLighting(booth)
    local lighting = Config.PhotoLighting or {}
    if lighting.enabled == false or not booth then return end

    local camera = booth.camera and booth.camera.coords
    if not camera then return end

    local forwardX, forwardY, rightX, rightY = getBasis(booth.heading)

    local sideOffset = tonumber(lighting.sideOffset) or 1.25
    local forwardOffset = tonumber(lighting.forwardOffset) or 0.45
    local heightOffset = tonumber(lighting.heightOffset) or 0.55
    local range = tonumber(lighting.range) or 7.0
    local intensity = tonumber(lighting.intensity) or 2.2

    local color = lighting.color or {}
    local r = tonumber(color.r) or 255
    local g = tonumber(color.g) or 238
    local b = tonumber(color.b) or 244

    local baseX = camera.x + forwardX * forwardOffset
    local baseY = camera.y + forwardY * forwardOffset
    local baseZ = camera.z + heightOffset

    DrawLightWithRange(
        baseX,
        baseY,
        baseZ,
        r,
        g,
        b,
        range,
        intensity
    )

    DrawLightWithRange(
        baseX + rightX * sideOffset,
        baseY + rightY * sideOffset,
        baseZ - 0.12,
        r,
        g,
        b,
        range,
        intensity * 0.78
    )

    DrawLightWithRange(
        baseX - rightX * sideOffset,
        baseY - rightY * sideOffset,
        baseZ - 0.12,
        r,
        g,
        b,
        range,
        intensity * 0.78
    )
end

local function renderThemeSurfaces(booth)
    if not booth or not activeTheme then return end

    local surfaces = Config.ThemeSurfaces or {}
    local forwardX, forwardY, rightX, rightY = getBasis(booth.heading)

    local backgroundSpec = activeTheme.background
    if backgroundSpec and backgroundSpec.enabled then

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

        local slot = themeTextures.background
        if slot and slot.texture then
            drawTexturedQuad(
                topLeft,
                topRight,
                bottomLeft,
                bottomRight,
                slot.txdName,
                slot.txnName
            )
        end
    end

    local floorSpec = activeTheme.floor
    if floorSpec and floorSpec.enabled then

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

        local slot = themeTextures.floor
        if slot and slot.texture then
            drawTexturedQuad(
                backLeft,
                backRight,
                frontLeft,
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
        label = "設置プレビュー",
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
    local slot = "main"

    if (tonumber(scale) or 0.0) >= 0.8 then
        slot = "countdown"
    elseif (tonumber(y) or 0.0) >= 0.86 then
        slot = "secondary"
    end

    SendNUIMessage({
        action = "shootHudLine",
        slot = slot,
        text = tostring(text or "")
    })
end

local function setCameraSafeFrame(visible)
    SendNUIMessage({
        action = "shootSafeFrame",
        visible = visible == true
    })
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

local function captureGuideDimensions(booth)
    local guide = Config.CaptureGuide or {}
    local camera = booth.camera and booth.camera.coords
    local center = booth.captureCenter

    if not camera or not center then
        return 1.2, 1.35, 1.5
    end

    local dx = center.x - camera.x
    local dy = center.y - camera.y
    local horizontalDistance = math.max(0.5, math.sqrt(dx * dx + dy * dy))

    local aspect = GetAspectRatio(false)
    if not aspect or aspect < 1.0 or aspect > 3.0 then
        aspect = 16.0 / 9.0
    end

    local verticalFov = math.rad(
        tonumber(booth.camera.fov) or 68.0
    )

    local visibleHalfWidth =
        math.tan(verticalFov * 0.5)
        * aspect
        * horizontalDistance

    local captureHalfWidth =
        math.max(
            0.8,
            (tonumber(booth.captureSize.x) or 3.4) * 0.5
        )

    local outerHalfWidth = math.min(
        captureHalfWidth,
        visibleHalfWidth
            * (tonumber(guide.outerWidthScale) or 0.94)
    )

    local safeHalfWidth = math.min(
        outerHalfWidth * 0.92,
        visibleHalfWidth
            * (tonumber(guide.safeWidthScale) or 0.78)
    )

    local safeDepth = math.max(
        0.7,
        tonumber(guide.depth) or 1.35
    )

    return safeHalfWidth, safeDepth, outerHalfWidth
end

local function drawCaptureGuide(booth)
    local guide = Config.CaptureGuide or {}
    if guide.enabled == false or not captureGuideVisible or not booth then
        return
    end

    local center = booth.captureCenter
    local safeHalfWidth, safeDepth, outerHalfWidth =
        captureGuideDimensions(booth)

    local forwardX, forwardY, rightX, rightY =
        getBasis(booth.heading)

    local groundZ = center.z + 0.045
    local halfDepth = safeDepth * 0.5

    local function worldPoint(rightOffset, forwardOffset, zOffset)
        return vector3(
            center.x
                + rightX * rightOffset
                + forwardX * forwardOffset,
            center.y
                + rightY * rightOffset
                + forwardY * forwardOffset,
            groundZ + (zOffset or 0.0)
        )
    end

    local function drawRect(halfWidth, depthHalf, r, g, b, a)
        local a1 = worldPoint(-halfWidth, -depthHalf, 0.0)
        local b1 = worldPoint( halfWidth, -depthHalf, 0.0)
        local c1 = worldPoint( halfWidth,  depthHalf, 0.0)
        local d1 = worldPoint(-halfWidth,  depthHalf, 0.0)

        DrawLine(a1.x, a1.y, a1.z, b1.x, b1.y, b1.z, r, g, b, a)
        DrawLine(b1.x, b1.y, b1.z, c1.x, c1.y, c1.z, r, g, b, a)
        DrawLine(c1.x, c1.y, c1.z, d1.x, d1.y, d1.z, r, g, b, a)
        DrawLine(d1.x, d1.y, d1.z, a1.x, a1.y, a1.z, r, g, b, a)
    end

    -- 白枠: カメラ上で写る目安。緑枠: 人物が切れにくい安全範囲。
    drawRect(outerHalfWidth, halfDepth, 255, 255, 255, 220)
    drawRect(safeHalfWidth, halfDepth * 0.78, 95, 235, 180, 235)

    DrawMarker(
        1,
        center.x,
        center.y,
        center.z - 1.02,
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0,
        safeHalfWidth * 2.0,
        safeDepth * 0.78,
        0.10,
        95, 235, 180, 36,
        false, false, 2, false, nil, nil, false
    )

    local centerBack = worldPoint(0.0, -halfDepth, 0.0)
    local centerFront = worldPoint(0.0, halfDepth, 0.0)
    DrawLine(
        centerBack.x, centerBack.y, centerBack.z,
        centerFront.x, centerFront.y, centerFront.z,
        255, 255, 255, 135
    )

    -- 最大4人で使える立ち位置目安。2人なら中央寄りの2点が使いやすい。
    local markerCount = math.max(
        1,
        math.min(
            4,
            tonumber(guide.positionMarkers) or 4
        )
    )

    for i = 1, markerCount do
        local normalized =
            markerCount == 1
            and 0.0
            or (-0.72 + ((i - 1) / (markerCount - 1)) * 1.44)

        local point = worldPoint(
            safeHalfWidth * normalized,
            0.0,
            0.0
        )

        DrawMarker(
            1,
            point.x,
            point.y,
            center.z - 1.015,
            0.0, 0.0, 0.0,
            0.0, 0.0, 0.0,
            0.34, 0.34, 0.075,
            255, 255, 255, 185,
            false, false, 2, false, nil, nil, false
        )
    end

    -- 縦方向の安全フレーム。頭がこの高さを大きく超えると切れやすい。
    local frameHeight = math.max(
        1.8,
        tonumber(guide.frameHeight) or 2.25
    )

    local leftBottom = worldPoint(-safeHalfWidth, 0.0, 0.0)
    local rightBottom = worldPoint(safeHalfWidth, 0.0, 0.0)
    local leftTop = worldPoint(-safeHalfWidth, 0.0, frameHeight)
    local rightTop = worldPoint(safeHalfWidth, 0.0, frameHeight)

    DrawLine(
        leftBottom.x, leftBottom.y, leftBottom.z,
        leftTop.x, leftTop.y, leftTop.z,
        95, 235, 180, 185
    )
    DrawLine(
        rightBottom.x, rightBottom.y, rightBottom.z,
        rightTop.x, rightTop.y, rightTop.z,
        95, 235, 180, 185
    )
    DrawLine(
        leftTop.x, leftTop.y, leftTop.z,
        rightTop.x, rightTop.y, rightTop.z,
        95, 235, 180, 185
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
    setCameraSafeFrame(false)

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
    setCameraSafeFrame(true)

    DisplayRadar(false)
    TriggerEvent("lb-phone:toggleHud", true)

    notify(
        "inform",
        "撮影画角を確認中です。白枠が写る目安、緑枠が安全範囲です。立ち位置やポーズを整えて[E]で撮影を開始してください。"
    )
end

local function leaveCameraPreview()
    if ownedSession and ownedSession.phase == "preview" then
        ownedSession.phase = "gathering"
    end

    setCameraSafeFrame(false)
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
            label = "ストリートプリ",
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
        label = localizeBoothLabel(booth.label or "ストリートプリ"),
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
        label = booth and localizeBoothLabel(booth.label) or "ストリートプリ"
    })
end

RegisterNetEvent("puribooth:client:sessionState", function(boothId, state)
    boothId = tostring(boothId)
    sharedSessions[boothId] = state or nil

    if not state then
        countdownGeneration = countdownGeneration + 1
        countdownDisplay = nil
    end

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
        return
    end

    if phase == "capturing" then
        captureCancelledByUser = true
        captureInProgress = false
        countdownGeneration = countdownGeneration + 1
        countdownDisplay = nil
        destroyPreviewCamera(true)
        clearTheme()
        notify(
            "error",
            "撮影セッションが終了しました。必要ならもう一度プリクラ台から開始してください。"
        )
    end
end)

local function reopenThemeSelection()
    if not ownedSession then return end

    local phase = ownedSession.phase
    if phase ~= "gathering" and phase ~= "preview" then
        return
    end

    destroyPreviewCamera(true)
    clearTheme()
    ownedSession.phase = "theme"
    SetNuiFocus(true, true)
    SendNUIMessage({ action = "openTheme" })

    notify(
        "inform",
        "背景と床を選び直せます。追加料金はかかりません。"
    )
end

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

    countdownGeneration = countdownGeneration + 1
    local myGeneration = countdownGeneration

    CreateThread(function()
        local seconds = math.max(
            1,
            tonumber(Config.CountdownSeconds) or 3
        )

        for n = seconds, 1, -1 do
            if myGeneration ~= countdownGeneration then
                return
            end

            countdownDisplay =
                ("%d枚目 / %d枚　あと%d秒")
                :format(
                    shotIndex,
                    Config.ShotCount or 4,
                    n
                )

            local untilTime = GetGameTimer() + 1000
            while myGeneration == countdownGeneration
                and GetGameTimer() < untilTime do
                Wait(0)
            end
        end

        if myGeneration ~= countdownGeneration then
            return
        end

        countdownDisplay = "はい、チーズ！"

        local smileUntil = GetGameTimer() + 450
        while myGeneration == countdownGeneration
            and GetGameTimer() < smileUntil do
            Wait(0)
        end

        if myGeneration == countdownGeneration then
            countdownDisplay = nil
        end
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
        captureCancelledByUser = false
        setCameraSafeFrame(false)

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
        local shotCount = math.max(
            1,
            tonumber(Config.ShotCount) or 4
        )

        for shotIndex = 1, shotCount do
            if shotIndex > 1 then
                poseShotIndex = shotIndex
                poseAdvanceRequested = false
                poseReadyForNextShot = true
                setCameraSafeFrame(true)

                while captureInProgress and not poseAdvanceRequested do
                    Wait(0)
                end

                poseReadyForNextShot = false
                poseAdvanceRequested = false
                setCameraSafeFrame(false)

                if not captureInProgress then
                    failed = true
                    break
                end
            end

            TriggerServerEvent(
                "puribooth:server:announceCountdown",
                boothId,
                shotIndex
            )

            local countdownDeadline =
                GetGameTimer()
                + (
                    math.max(
                        1,
                        tonumber(Config.CountdownSeconds) or 3
                    ) * 1000
                )
                + 550

            while captureInProgress and GetGameTimer() < countdownDeadline do
                Wait(0)
            end

            if not captureInProgress then
                break
            end

            -- Countdown/SMILE overlay has now finished.

            local finished = false
            local frame = nil

            captureFrame(function(data)
                frame = data
                finished = true
            end)

            local deadline = GetGameTimer() + 12000

            while captureInProgress
                and not finished
                and GetGameTimer() < deadline do
                Wait(25)
            end

            if not captureInProgress then
                break
            end

            if not frame then
                failed = true
                break
            end

            shots[#shots + 1] = frame

            local nextShotAt =
                GetGameTimer()
                + math.max(
                    500,
                    tonumber(Config.ShotIntervalMs) or 1800
                )

            while captureInProgress and GetGameTimer() < nextShotAt do
                Wait(0)
            end

            if not captureInProgress then
                break
            end
        end

        poseReadyForNextShot = false
        poseAdvanceRequested = false
        poseShotIndex = 0
        captureInProgress = false
        destroyPreviewCamera(true)
        clearTheme()

        if captureCancelledByUser then
            TriggerServerEvent(
                "puribooth:server:cancelSession",
                boothId
            )

            notify("inform", "撮影を中止しました。")
            ownedSession = nil
            return
        end

        if failed or #shots == 0 then
            TriggerServerEvent(
                "puribooth:server:technicalFailure",
                boothId
            )

            notify("error", "写真を取得できませんでした。")
            ownedSession = nil
            return
        end

        ownedSession.phase = "editing"

        TriggerServerEvent(
            "puribooth:server:captureComplete",
            boothId
        )

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

    local backgroundEnabled = background and background.enabled == true
    local floorEnabled = floor and floor.enabled == true
    local backgroundImage = backgroundEnabled and validThemeImage(background.image) or nil
    local floorImage = floorEnabled and validThemeImage(floor.image) or nil

    if backgroundEnabled and not backgroundImage then
        cb({ ok = false, error = "invalid_background_image" })
        return
    end

    if floorEnabled and not floorImage then
        cb({ ok = false, error = "invalid_floor_image" })
        return
    end

    if backgroundEnabled and not createThemeTexture("background", backgroundImage) then
        cb({ ok = false, error = "background_texture_failed" })
        return
    end

    if floorEnabled and not createThemeTexture("floor", floorImage) then
        cb({ ok = false, error = "floor_texture_failed" })
        return
    end

    activeTheme = {
        background = { enabled = backgroundEnabled },
        floor = { enabled = floorEnabled }
    }

    -- Do not retain the large base64 strings after runtime textures are made.
    backgroundImage = nil
    floorImage = nil

    ownedSession.phase = "gathering"
    SetNuiFocus(false, false)
    SendNUIMessage({ action = "closeTheme" })

    notify(
        "inform",
        "背景と床を反映しました。白枠・緑枠を見ながら並び、[E]で撮影画角を確認できます。[G]でガイド表示を切り替えられます。"
    )

    cb({ ok = true })
end)

RegisterNUICallback("puriboothThemeCancel", function(_, cb)
    SetNuiFocus(false, false)
    SendNUIMessage({ action = "closeTheme" })

    if ownedSession then
        TriggerServerEvent(
            "puribooth:server:cancelSession",
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

    if GetResourceState("puriphoto") ~= "started" then
        notify(
            "error",
            "PuriPhotoが停止中です。編集内容はこの画面に残してあります。起動後にもう一度送信してください。"
        )

        cb({
            ok = false,
            error = "puriphoto_not_started"
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

    TriggerEvent(
        "puriphoto:client:openBoothImport",
        image,
        metadata
    )

    cb({
        ok = true,
        handoff = "puriphoto"
    })
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
        local captureGuideNearby = false

        for boothId, booth in pairs(dynamicBooths) do
            local state = sharedSessions[boothId]

            if state and not state.capturing then
                local distance = #(coords - booth.captureCenter)

                if distance < 35.0 then
                    wait = 0
                    captureGuideNearby = true
                    sessionMarker(booth)
                    drawCaptureGuide(booth)
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
                        ("プリクラ撮影  $%s   [E]")
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

        if captureGuideNearby then
            wait = 0

            if captureGuideVisible then
                drawText2d(
                    "白枠＝写る目安　緑枠＝安全範囲　白い丸＝立ち位置　[G] 表示切替",
                    0.5,
                    0.88,
                    0.30
                )
            end

            local guideControl =
                tonumber(
                    (Config.CaptureGuide or {}).toggleControl
                ) or 47

            DisableControlAction(0, guideControl, true)

            if IsDisabledControlJustReleased(0, guideControl) then
                captureGuideVisible = not captureGuideVisible

                notify(
                    "inform",
                    captureGuideVisible
                        and "撮影範囲ガイドを表示しました。白枠が写る目安、緑枠が安全範囲です。"
                        or "撮影範囲ガイドを非表示にしました。"
                )
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
                        "撮影カメラ確認　[C] 戻る　[BACKSPACE] 戻る",
                        0.5,
                        0.82,
                        0.42
                    )
                else
                    drawText2d(
                        "ピンク枠＝撮影範囲　矢印＝移動　Q/E＝回転　PageUp/PageDown＝高さ",
                        0.5,
                        0.80,
                        0.34
                    )

                    drawText2d(
                        "[C] カメラ確認　[SHIFT] 高速移動　[ENTER] 設置　[BACKSPACE] 中止",
                        0.5,
                        0.84,
                        0.38
                    )
                end
            end
        end

        if ownedSession and not editorOpen then
            local booth = dynamicBooths[ownedSession.boothId]

            if booth
                and activeTheme
                and (cameraPreviewActive or captureInProgress) then

                wait = 0
                renderThemeSurfaces(booth)
                renderPhotoLighting(booth)
            end

            if booth then
                local phase = ownedSession.phase or "gathering"

                if phase == "gathering" then
                    wait = 0

                    drawText2d(
                        "手順 1/2　[E] カメラ確認　[R] 背景・床　[G] ガイド　[BACKSPACE] 中止",
                        0.5,
                        0.82,
                        0.42
                    )

                    if IsControlJustReleased(0, 38) then
                        enterCameraPreview(ownedSession.boothId)
                    elseif IsControlJustReleased(0, 45) then
                        reopenThemeSelection()
                    elseif IsControlJustReleased(0, 177) then
                        TriggerServerEvent(
                            "puribooth:server:cancelSession",
                            ownedSession.boothId
                        )

                        clearTheme()
                        ownedSession = nil
                        notify("inform", "撮影を中止しました。")
                    end
                elseif phase == "preview" then
                    wait = 0

                    drawText2d(
                        "手順 2/2　[E] 撮影開始　[R] 背景・床　[G] ガイド　[BACKSPACE] 戻る",
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
                    elseif IsControlJustReleased(0, 45) then
                        reopenThemeSelection()
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

            if IsControlJustReleased(0, 177) then
                captureCancelledByUser = true
                captureInProgress = false
                countdownGeneration = countdownGeneration + 1
                countdownDisplay = nil
            elseif poseReadyForNextShot then
                drawText2d(
                    ("%d枚目 / %d枚　ポーズを決めたら [E] カウント開始　[BACKSPACE] 中止")
                        :format(
                            poseShotIndex,
                            tonumber(Config.ShotCount) or 4
                        ),
                    0.5,
                    0.82,
                    0.36
                )

                if IsControlJustReleased(0, 38) then
                    poseAdvanceRequested = true
                end
            end
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
    setCameraSafeFrame(false)
    destroyPreviewCamera(false)
    cleanupPlacement()
    clearTheme()

    for boothId in pairs(spawnedObjects) do
        removeSpawnedBooth(boothId)
    end
end)
