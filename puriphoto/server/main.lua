local function safeString(value, maxLength)
    if type(value) ~= "string" then
        return nil
    end

    value = value:gsub("%z", "")
    if #value > maxLength then
        return value:sub(1, maxLength)
    end

    return value
end

local function validHttpUrl(value)
    local cleaned = safeString(value, 2048)
    if not cleaned then
        return nil
    end

    if not cleaned:match("^https?://") then
        return nil
    end

    return cleaned
end

local function getCitizenId(source)
    if GetResourceState("qbx_core") ~= "started" then
        return nil
    end

    local ok, player = pcall(function()
        return exports.qbx_core:GetPlayer(source)
    end)

    if not ok or not player or not player.PlayerData then
        return nil
    end

    return player.PlayerData.citizenid
end

local function sendResponse(source, requestId, payload)
    local encoded = json.encode(payload)
    if encoded and #encoded > 60000 then
        TriggerLatentClientEvent("puriphoto:client:serverResponse", source, 500000, requestId, payload)
    else
        TriggerClientEvent("puriphoto:client:serverResponse", source, requestId, payload)
    end
end

local function normalizeLocation(location)
    if type(location) ~= "table" then
        return nil
    end

    local x = tonumber(location.x)
    local y = tonumber(location.y)
    local z = tonumber(location.z)

    if not x or not y or not z then
        return nil
    end

    return {
        label = safeString(location.label or "", 255) or "",
        street = safeString(location.street or "", 128) or "",
        zone = safeString(location.zone or "", 128) or "",
        x = x,
        y = y,
        z = z
    }
end

local function createSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS puriphoto_projects (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            citizenid VARCHAR(64) NOT NULL,
            source_url TEXT NOT NULL,
            finished_url TEXT NOT NULL,
            edit_data LONGTEXT NOT NULL,
            location_label VARCHAR(255) NULL,
            location_street VARCHAR(128) NULL,
            location_zone VARCHAR(128) NULL,
            location_x DOUBLE NULL,
            location_y DOUBLE NULL,
            location_z DOUBLE NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_puriphoto_owner_updated (citizenid, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
end

MySQL.ready(function()
    local ok, err = pcall(createSchema)
    if ok then
        print("[puriphoto] album schema ready")
    else
        print(("[puriphoto] failed to prepare album schema: %s"):format(err))
    end
end)

RegisterNetEvent("puriphoto:server:getAlbum", function(requestId)
    local source = source
    local citizenid = getCitizenId(source)

    if not citizenid then
        sendResponse(source, requestId, {
            ok = false,
            error = "player_unavailable"
        })
        return
    end

    local limit = math.max(1, math.min(200, tonumber(Config.AlbumLimit) or 100))
    local sql = ([[
        SELECT id, source_url, finished_url,
               location_label, location_street, location_zone,
               location_x, location_y, location_z,
               created_at, updated_at
        FROM puriphoto_projects
        WHERE citizenid = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT %d
    ]]):format(limit)

    local rows = MySQL.query.await(sql, { citizenid }) or {}
    local projects = {}

    for _, row in ipairs(rows) do
        projects[#projects + 1] = {
            id = row.id,
            sourceUrl = row.source_url,
            finishedUrl = row.finished_url,
            location = row.location_x and {
                label = row.location_label or "",
                street = row.location_street or "",
                zone = row.location_zone or "",
                x = row.location_x,
                y = row.location_y,
                z = row.location_z
            } or nil,
            createdAt = row.created_at,
            updatedAt = row.updated_at
        }
    end

    sendResponse(source, requestId, {
        ok = true,
        projects = projects
    })
end)

RegisterNetEvent("puriphoto:server:getProject", function(requestId, payload)
    local source = source
    local citizenid = getCitizenId(source)
    local projectId = type(payload) == "table" and tonumber(payload.id) or nil

    if not citizenid or not projectId or projectId <= 0 then
        sendResponse(source, requestId, {
            ok = false,
            error = "invalid_request"
        })
        return
    end

    local rows = MySQL.query.await([[
        SELECT id, source_url, finished_url, edit_data,
               location_label, location_street, location_zone,
               location_x, location_y, location_z,
               created_at, updated_at
        FROM puriphoto_projects
        WHERE id = ? AND citizenid = ?
        LIMIT 1
    ]], { projectId, citizenid }) or {}

    local row = rows[1]
    if not row then
        sendResponse(source, requestId, {
            ok = false,
            error = "project_not_found"
        })
        return
    end

    sendResponse(source, requestId, {
        ok = true,
        project = {
            id = row.id,
            sourceUrl = row.source_url,
            finishedUrl = row.finished_url,
            editData = row.edit_data,
            location = row.location_x and {
                label = row.location_label or "",
                street = row.location_street or "",
                zone = row.location_zone or "",
                x = row.location_x,
                y = row.location_y,
                z = row.location_z
            } or nil,
            createdAt = row.created_at,
            updatedAt = row.updated_at
        }
    })
end)

RegisterNetEvent("puriphoto:server:saveProject", function(requestId, payload)
    local source = source
    local citizenid = getCitizenId(source)

    if not citizenid then
        sendResponse(source, requestId, {
            ok = false,
            error = "player_unavailable"
        })
        return
    end

    if type(payload) ~= "table" then
        sendResponse(source, requestId, {
            ok = false,
            error = "invalid_payload"
        })
        return
    end

    local sourceUrl = validHttpUrl(payload.sourceUrl)
    local finishedUrl = validHttpUrl(payload.finishedUrl)
    local editData = safeString(payload.editData, tonumber(Config.ProjectDataMaxBytes) or 2000000)
    local location = normalizeLocation(payload.location)

    if not sourceUrl or not finishedUrl or not editData or editData == "" then
        sendResponse(source, requestId, {
            ok = false,
            error = "invalid_project"
        })
        return
    end

    local decodedOk = pcall(json.decode, editData)
    if not decodedOk then
        sendResponse(source, requestId, {
            ok = false,
            error = "invalid_edit_data"
        })
        return
    end

    local projectId = tonumber(payload.id)
    if projectId and projectId > 0 then
        local affected = MySQL.update.await([[
            UPDATE puriphoto_projects
            SET source_url = ?, finished_url = ?, edit_data = ?,
                location_label = ?, location_street = ?, location_zone = ?,
                location_x = ?, location_y = ?, location_z = ?
            WHERE id = ? AND citizenid = ?
        ]], {
            sourceUrl,
            finishedUrl,
            editData,
            location and location.label or nil,
            location and location.street or nil,
            location and location.zone or nil,
            location and location.x or nil,
            location and location.y or nil,
            location and location.z or nil,
            projectId,
            citizenid
        })

        if affected and affected > 0 then
            sendResponse(source, requestId, {
                ok = true,
                id = projectId
            })
            return
        end
    end

    local insertedId = MySQL.insert.await([[
        INSERT INTO puriphoto_projects (
            citizenid, source_url, finished_url, edit_data,
            location_label, location_street, location_zone,
            location_x, location_y, location_z
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        citizenid,
        sourceUrl,
        finishedUrl,
        editData,
        location and location.label or nil,
        location and location.street or nil,
        location and location.zone or nil,
        location and location.x or nil,
        location and location.y or nil,
        location and location.z or nil
    })

    local limit = math.max(1, math.min(200, tonumber(Config.AlbumLimit) or 100))
    local pruneSql = ([[
        DELETE FROM puriphoto_projects
        WHERE citizenid = ?
          AND id NOT IN (
              SELECT id FROM (
                  SELECT id
                  FROM puriphoto_projects
                  WHERE citizenid = ?
                  ORDER BY updated_at DESC, id DESC
                  LIMIT %d
              ) AS keep_rows
          )
    ]]):format(limit)

    MySQL.query.await(pruneSql, { citizenid, citizenid })

    sendResponse(source, requestId, {
        ok = true,
        id = insertedId
    })
end)

RegisterNetEvent("puriphoto:server:deleteProject", function(requestId, payload)
    local source = source
    local citizenid = getCitizenId(source)
    local projectId = type(payload) == "table" and tonumber(payload.id) or nil

    if not citizenid or not projectId or projectId <= 0 then
        sendResponse(source, requestId, {
            ok = false,
            error = "invalid_request"
        })
        return
    end

    local affected = MySQL.update.await(
        "DELETE FROM puriphoto_projects WHERE id = ? AND citizenid = ?",
        { projectId, citizenid }
    )

    sendResponse(source, requestId, {
        ok = true,
        deleted = affected and affected > 0 or false
    })
end)
