local pendingRequests = {}
local nextRequestId = 0

local function replyLater(callback, action, payload)
    nextRequestId = nextRequestId + 1
    local requestId = nextRequestId

    pendingRequests[requestId] = callback

    local eventName = ("puriphoto:server:%s"):format(action)
    if action == "saveProject" then
        TriggerLatentServerEvent(eventName, 500000, requestId, payload)
    else
        TriggerServerEvent(eventName, requestId, payload)
    end

    SetTimeout(12000, function()
        local pending = pendingRequests[requestId]
        if not pending then
            return
        end

        pendingRequests[requestId] = nil
        pending({
            ok = false,
            error = "server_timeout"
        })
    end)
end

RegisterNetEvent("puriphoto:client:serverResponse", function(requestId, payload)
    local callback = pendingRequests[requestId]
    if not callback then
        return
    end

    pendingRequests[requestId] = nil
    callback(payload)
end)

local function getLocation()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)

    local street = streetHash ~= 0 and GetStreetNameFromHashKey(streetHash) or ""
    local crossing = crossingHash ~= 0 and GetStreetNameFromHashKey(crossingHash) or ""

    local zoneCode = GetNameOfZone(coords.x, coords.y, coords.z)
    local zone = zoneCode and GetLabelText(zoneCode) or ""
    if not zone or zone == "" or zone == "NULL" then
        zone = zoneCode or ""
    end

    local streetLabel = street
    if crossing ~= "" and crossing ~= street then
        streetLabel = streetLabel ~= "" and (streetLabel .. " / " .. crossing) or crossing
    end

    local label = streetLabel
    if zone ~= "" then
        label = label ~= "" and (label .. " - " .. zone) or zone
    end

    if label == "" then
        label = "場所情報なし"
    end

    return {
        label = label,
        street = streetLabel,
        zone = zone,
        x = coords.x,
        y = coords.y,
        z = coords.z
    }
end

RegisterNUICallback("puriphotoGetCaptureLocation", function(_, cb)
    cb({
        ok = true,
        location = getLocation()
    })
end)

RegisterNUICallback("puriphotoGetAlbum", function(_, cb)
    replyLater(cb, "getAlbum", {})
end)

RegisterNUICallback("puriphotoSaveProject", function(data, cb)
    replyLater(cb, "saveProject", data)
end)

RegisterNUICallback("puriphotoGetProject", function(data, cb)
    replyLater(cb, "getProject", data)
end)

RegisterNUICallback("puriphotoDeleteProject", function(data, cb)
    replyLater(cb, "deleteProject", data)
end)

RegisterNUICallback("puriphotoUpdateProjectMeta", function(data, cb)
    replyLater(cb, "updateProjectMeta", data)
end)

RegisterNUICallback("puriphotoGetPhotoSpots", function(_, cb)
    cb({
        ok = true,
        spots = Config.PhotoSpots or {}
    })
end)

RegisterNUICallback("puriphotoGetMySpots", function(_, cb)
    replyLater(cb, "getMySpots", {})
end)

RegisterNUICallback("puriphotoSaveMySpot", function(data, cb)
    data = type(data) == "table" and data or {}
    data.location = getLocation()
    replyLater(cb, "saveMySpot", data)
end)

RegisterNUICallback("puriphotoDeleteMySpot", function(data, cb)
    replyLater(cb, "deleteMySpot", data)
end)

RegisterNUICallback("puriphotoSetMySpotWaypoint", function(data, cb)
    local x = type(data) == "table" and tonumber(data.x) or nil
    local y = type(data) == "table" and tonumber(data.y) or nil

    if not x or not y or math.abs(x) > 10000 or math.abs(y) > 10000 then
        cb({
            ok = false,
            error = "invalid_coords"
        })
        return
    end

    SetNewWaypoint(x + 0.0, y + 0.0)
    cb({
        ok = true
    })
end)

RegisterNUICallback("puriphotoSetPhotoSpotWaypoint", function(data, cb)
    local wantedId = type(data) == "table" and data.id or nil
    local selected = nil

    for _, spot in ipairs(Config.PhotoSpots or {}) do
        if spot.id == wantedId then
            selected = spot
            break
        end
    end

    if not selected or not selected.coords then
        cb({
            ok = false,
            error = "spot_not_found"
        })
        return
    end

    SetNewWaypoint(selected.coords.x + 0.0, selected.coords.y + 0.0)

    cb({
        ok = true
    })
end)


local pendingBoothImport = nil
local boothImportSerial = 0

local function openBoothImport(image, metadata)
    if type(image) ~= "string"
        or #image < 100
        or #image > (12 * 1024 * 1024) then
        return false, "invalid_image"
    end

    if GetResourceState("lb-phone") ~= "started" then
        return false, "lb_phone_not_started"
    end

    metadata = type(metadata) == "table" and metadata or {}

    local ped = PlayerPedId()
    local current = GetEntityCoords(ped)

    local x = tonumber(metadata.x) or current.x
    local y = tonumber(metadata.y) or current.y
    local z = tonumber(metadata.z) or current.z

    if math.abs(x) > 100000
        or math.abs(y) > 100000
        or math.abs(z) > 100000 then
        x, y, z = current.x, current.y, current.z
    end

    boothImportSerial = boothImportSerial + 1
    local token =
        ("%d:%d:%d")
            :format(
                GetGameTimer(),
                PlayerId(),
                boothImportSerial
            )

    pendingBoothImport = {
        token = token,
        image = image,
        location = {
            label = tostring(metadata.label or "フレプリ"),
            street = tostring(metadata.street or ""),
            zone = tostring(metadata.zone or ""),
            x = x,
            y = y,
            z = z
        }
    }

    local opened, openResult = pcall(function()
        return exports["lb-phone"]:OpenApp(Config.Identifier)
    end)

    if not opened or openResult == false then
        pendingBoothImport = nil
        return false, "open_app_failed"
    end

    CreateThread(function()
        Wait(350)

        pcall(function()
            exports["lb-phone"]:SendCustomAppMessage(
                Config.Identifier,
                { action = "boothImportAvailable" }
            )
        end)

        Wait(650)

        if pendingBoothImport then
            pcall(function()
                exports["lb-phone"]:SendCustomAppMessage(
                    Config.Identifier,
                    { action = "boothImportAvailable" }
                )
            end)
        end
    end)

    return true, token
end

exports("OpenBoothImport", openBoothImport)

exports("CancelBoothImport", function(token)
    token = tostring(token or "")

    if pendingBoothImport
        and tostring(pendingBoothImport.token or "") == token then
        pendingBoothImport = nil
        return true
    end

    return false
end)

RegisterNetEvent("puriphoto:client:openBoothImport", function(image, metadata)
    local ok, reason = openBoothImport(image, metadata)

    if not ok then
        print(
            ("[PuriPhoto] booth import rejected: %s")
                :format(tostring(reason or "unknown"))
        )
    end
end)

RegisterNUICallback("puriphotoGetBoothImport", function(_, cb)
    if not pendingBoothImport then
        cb({
            ok = false,
            error = "no_pending_booth_import"
        })
        return
    end

    cb({
        ok = true,
        import = {
            token = pendingBoothImport.token,
            image = pendingBoothImport.image,
            location = pendingBoothImport.location
        }
    })
end)

RegisterNUICallback("puriphotoConfirmBoothImport", function(data, cb)
    local token =
        type(data) == "table"
        and tostring(data.token or "")
        or ""

    if token == ""
        or not pendingBoothImport
        or tostring(pendingBoothImport.token or "") ~= token then
        cb({
            ok = false,
            error = "booth_import_token_mismatch"
        })
        return
    end

    pendingBoothImport = nil

    cb({ ok = true })

    TriggerEvent(
        "puriphoto:client:boothImportConsumed",
        token
    )
end)
