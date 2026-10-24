local pendingRequests = {}
local nextRequestId = 0

local function replyLater(callback, action, payload)
    nextRequestId = nextRequestId + 1
    local requestId = nextRequestId

    pendingRequests[requestId] = callback
    TriggerServerEvent(("puriphoto:server:%s"):format(action), requestId, payload)

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

RegisterNUICallback("puriphotoDeleteProject", function(data, cb)
    replyLater(cb, "deleteProject", data)
end)

RegisterNUICallback("puriphotoGetPhotoSpots", function(_, cb)
    cb({
        ok = true,
        spots = Config.PhotoSpots or {}
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
