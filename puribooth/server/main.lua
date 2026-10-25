local sessions = {}
local booths = {}
local databaseReady = false

local function notify(source, kind, message)
    TriggerClientEvent("puribooth:client:notify", source, kind, message)
end

local function getStableIdentifier(source)
    local identifiers = GetPlayerIdentifiers(source)

    for _, identifier in ipairs(identifiers) do
        if identifier:sub(1, 8) == "license:" then
            return identifier
        end
    end

    for _, identifier in ipairs(identifiers) do
        if identifier:sub(1, 6) == "fivem:" then
            return identifier
        end
    end

    return nil
end

local function isStoredAdmin(source)
    if not databaseReady then return false end

    local identifier = getStableIdentifier(source)
    if not identifier then return false end

    local exists = MySQL.scalar.await(
        "SELECT 1 FROM puribooth_admins WHERE identifier = ? LIMIT 1",
        { identifier }
    )

    return exists ~= nil
end

local function isAdmin(source)
    if source == 0 then return true end

    local ace = Config.AdminAce or "group.admin"

    if IsPlayerAceAllowed(source, ace)
        or IsPlayerAceAllowed(source, "group.god") then
        return true
    end

    return isStoredAdmin(source)
end

local function boothCount()
    local count = 0
    for _ in pairs(booths) do count = count + 1 end
    return count
end

local function normalizeBooth(row)
    if not row then return nil end

    local id = tostring(row.id)
    return {
        id = id,
        label = tostring(row.label or ("PURI #" .. id)),
        model = tostring(row.model or Config.DefaultModel),
        coords = {
            x = tonumber(row.x) or 0.0,
            y = tonumber(row.y) or 0.0,
            z = tonumber(row.z) or 0.0
        },
        heading = tonumber(row.heading) or 0.0
    }
end

local function getBooth(boothId)
    if boothId == nil then return nil end
    return booths[tostring(boothId)]
end

local function broadcastBooths(target)
    TriggerClientEvent("puribooth:client:syncBooths", target or -1, booths)
end

local function broadcastState(boothId)
    boothId = tostring(boothId)
    local session = sessions[boothId]

    TriggerClientEvent("puribooth:client:sessionState", -1, boothId, session and {
        owner = session.owner,
        capturing = session.capturing,
        expiresAt = session.expiresAt
    } or false)
end

local function releaseSession(boothId)
    boothId = tostring(boothId)
    if not sessions[boothId] then return end

    sessions[boothId] = nil
    broadcastState(boothId)
end

local function playerNearBooth(source, booth, maxDistance)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 or not booth then return false end

    local coords = GetEntityCoords(ped)
    local boothCoords = vector3(booth.coords.x, booth.coords.y, booth.coords.z)
    return #(coords - boothCoords) <= (maxDistance or 7.0)
end

local function loadBooths()
    local rows = MySQL.query.await([[
        SELECT id, label, model, x, y, z, heading
        FROM puribooth_booths
        ORDER BY id ASC
    ]]) or {}

    booths = {}
    for _, row in ipairs(rows) do
        local booth = normalizeBooth(row)
        booths[booth.id] = booth
    end

    if next(booths) == nil and Config.SeedLegacyBooth and Config.LegacyBooth then
        local seed = Config.LegacyBooth
        local insertedId = MySQL.insert.await([[
            INSERT INTO puribooth_booths
                (label, model, x, y, z, heading, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], {
            tostring(seed.label or "Legion PURI"),
            tostring(seed.model or Config.DefaultModel),
            tonumber(seed.x) or 0.0,
            tonumber(seed.y) or 0.0,
            tonumber(seed.z) or 0.0,
            tonumber(seed.heading) or 0.0,
            "legacy-seed"
        })

        if insertedId then
            local booth = {
                id = tostring(insertedId),
                label = tostring(seed.label or ("PURI #" .. insertedId)),
                model = tostring(seed.model or Config.DefaultModel),
                coords = {
                    x = tonumber(seed.x) or 0.0,
                    y = tonumber(seed.y) or 0.0,
                    z = tonumber(seed.z) or 0.0
                },
                heading = tonumber(seed.heading) or 0.0
            }
            booths[booth.id] = booth
        end
    end

    databaseReady = true
    print(("[puribooth] booth database ready (booths=%d)"):format(boothCount()))
    broadcastBooths(-1)
end

CreateThread(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS puribooth_admins (
            identifier VARCHAR(96) NOT NULL,
            player_name VARCHAR(96) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (identifier)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS puribooth_booths (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            label VARCHAR(64) NOT NULL,
            model VARCHAR(64) NOT NULL,
            x DOUBLE NOT NULL,
            y DOUBLE NOT NULL,
            z DOUBLE NOT NULL,
            heading DOUBLE NOT NULL DEFAULT 0,
            created_by VARCHAR(96) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )
    ]])

    loadBooths()
end)

RegisterNetEvent("puribooth:server:requestSync", function()
    local source = source
    broadcastBooths(source)

    for boothId, session in pairs(sessions) do
        TriggerClientEvent("puribooth:client:sessionState", source, boothId, {
            owner = session.owner,
            capturing = session.capturing,
            expiresAt = session.expiresAt
        })
    end
end)

RegisterNetEvent("puribooth:server:adminPlace", function(data)
    local source = source
    if not isAdmin(source) then
        notify(source, "error", "この操作には管理権限が必要です。")
        return
    end

    if not databaseReady then
        notify(source, "error", "プリクラ台データベースを準備中です。")
        return
    end

    if type(data) ~= "table" then return end

    local x = tonumber(data.x)
    local y = tonumber(data.y)
    local z = tonumber(data.z)
    local heading = tonumber(data.heading) or 0.0

    if not x or not y or not z
        or math.abs(x) > 100000.0
        or math.abs(y) > 100000.0
        or math.abs(z) > 100000.0 then
        return
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return end

    local playerCoords = GetEntityCoords(ped)
    local maxPlaceDistance = tonumber(Config.AdminPlaceMaxDistance) or 7.0
    if #(playerCoords - vector3(x, y, z)) > maxPlaceDistance then
        notify(source, "error", "自分の現在地付近にだけ設置できます。")
        return
    end

    heading = heading % 360.0

    local insertedId = MySQL.insert.await([[
        INSERT INTO puribooth_booths
            (label, model, x, y, z, heading, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        "Street PURI",
        Config.DefaultModel,
        x, y, z, heading,
        GetPlayerName(source) or ("source:" .. source)
    })

    if not insertedId then
        notify(source, "error", "プリクラ台を保存できませんでした。")
        return
    end

    local booth = {
        id = tostring(insertedId),
        label = ("Street PURI #%d"):format(insertedId),
        model = Config.DefaultModel,
        coords = { x = x, y = y, z = z },
        heading = heading
    }

    MySQL.update.await(
        "UPDATE puribooth_booths SET label = ? WHERE id = ?",
        { booth.label, insertedId }
    )

    booths[booth.id] = booth
    broadcastBooths(-1)
    notify(source, "inform", ("プリクラ台 #%d を設置しました。"):format(insertedId))
end)

local function removeNearestBooth(source)
    if not isAdmin(source) then
        notify(source, "error", "この操作には管理権限が必要です。")
        return
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return end

    local coords = GetEntityCoords(ped)
    local nearestId = nil
    local nearestDistance = tonumber(Config.AdminRemoveDistance) or 6.0

    for boothId, booth in pairs(booths) do
        local distance = #(coords - vector3(booth.coords.x, booth.coords.y, booth.coords.z))
        if distance <= nearestDistance then
            nearestId = boothId
            nearestDistance = distance
        end
    end

    if not nearestId then
        notify(source, "error", "近くに撤去できるプリクラ台がありません。")
        return
    end

    if sessions[nearestId] then
        notify(source, "error", "使用中のプリクラ台は撤去できません。")
        return
    end

    local numericId = tonumber(nearestId)
    local affected = MySQL.update.await(
        "DELETE FROM puribooth_booths WHERE id = ?",
        { numericId }
    )

    if not affected or affected < 1 then
        notify(source, "error", "プリクラ台を撤去できませんでした。")
        return
    end

    booths[nearestId] = nil
    TriggerClientEvent("puribooth:client:removeBooth", -1, nearestId)
    notify(source, "inform", ("プリクラ台 #%s を撤去しました。"):format(nearestId))
end

local function claimFirstAdmin(source)
    if not Config.AllowFirstAdminClaim then
        notify(source, "error", "初回管理者登録は無効です。")
        return
    end

    if not databaseReady then
        notify(source, "error", "プリクラ台データベースを準備中です。")
        return
    end

    local adminCount = tonumber(MySQL.scalar.await(
        "SELECT COUNT(*) FROM puribooth_admins"
    )) or 0

    if adminCount > 0 then
        if isAdmin(source) then
            notify(source, "inform", "すでにPuriBooth管理権限があります。")
        else
            notify(source, "error", "初回管理者はすでに登録済みです。")
        end
        return
    end

    local identifier = getStableIdentifier(source)
    if not identifier then
        notify(source, "error", "プレイヤー識別子を取得できませんでした。")
        return
    end

    local inserted = MySQL.insert.await([[
        INSERT INTO puribooth_admins
            (identifier, player_name)
        VALUES (?, ?)
    ]], {
        identifier,
        GetPlayerName(source) or "unknown"
    })

    if not inserted then
        notify(source, "error", "管理者登録に失敗しました。")
        return
    end

    notify(source, "inform", "PuriBooth管理者として登録しました。")
    print(("[puribooth] first admin claimed by source %d"):format(source))
end

RegisterCommand("puribooth", function(source, args)
    if source == 0 then
        print("[puribooth] player usage: /puribooth place | remove | list")
        return
    end

    local action = string.lower(tostring(args[1] or ""))

    if action == "claimadmin" then
        claimFirstAdmin(source)
        return
    end

    if not isAdmin(source) then
        notify(source, "error", "このコマンドには管理権限が必要です。")
        return
    end

    if action == "place" then
        TriggerClientEvent("puribooth:client:adminPlaceHere", source)
        return
    end

    if action == "remove" then
        removeNearestBooth(source)
        return
    end

    if action == "list" then
        notify(source, "inform", ("設置済みプリクラ台: %d台"):format(boothCount()))
        return
    end

    notify(source, "inform", "/puribooth claimadmin  /puribooth place  /puribooth remove  /puribooth list")
end, false)

RegisterNetEvent("puribooth:server:startSession", function(boothId)
    local source = source
    boothId = tostring(boothId)
    local booth = getBooth(boothId)

    if not booth then
        notify(source, "error", "プリクラ台の設定が見つかりません。")
        return
    end

    if not playerNearBooth(source, booth) then
        notify(source, "error", "プリクラ台の近くで操作してください。")
        return
    end

    if GetResourceState("screenshot-basic") ~= "started" then
        notify(source, "error", "撮影機能が準備できていません。スタッフへお知らせください。")
        return
    end

    if GetResourceState("lb-phone") ~= "started" or GetResourceState("qbx_core") ~= "started" then
        notify(source, "error", "プリクラ台を利用できません。")
        return
    end

    local existing = sessions[boothId]
    if existing and existing.expiresAt > os.time() then
        notify(source, "error", "このプリクラ台は使用中です。")
        return
    elseif existing then
        releaseSession(boothId)
    end

    local price = math.max(0, math.floor(tonumber(Config.Price) or 0))
    local paidWith = nil

    if price > 0 then
        for _, moneyType in ipairs(Config.PaymentMethods or { "cash", "bank" }) do
            if moneyType == "cash" or moneyType == "bank" then
                local paid = exports.qbx_core:RemoveMoney(
                    source,
                    moneyType,
                    price,
                    "puribooth-session"
                )

                if paid then
                    paidWith = moneyType
                    break
                end
            end
        end

        if not paidWith then
            notify(source, "error", ("料金 $%s を支払えませんでした。"):format(price))
            return
        end
    end

    sessions[boothId] = {
        owner = source,
        paid = price,
        moneyType = paidWith or "cash",
        capturing = false,
        expiresAt = os.time() + math.max(30, tonumber(Config.SessionTimeoutSeconds) or 180)
    }

    broadcastState(boothId)
    TriggerClientEvent(
        "puribooth:client:sessionOpened",
        source,
        boothId,
        sessions[boothId].expiresAt
    )
end)

RegisterNetEvent("puribooth:server:beginCapture", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local booth = getBooth(boothId)
    local session = sessions[boothId]

    if not booth or not session or session.owner ~= source then return end
    if session.capturing then return end

    if session.expiresAt <= os.time() then
        releaseSession(boothId)
        notify(source, "error", "撮影準備時間が終了しました。")
        return
    end

    if not playerNearBooth(source, booth, 12.0) then
        notify(source, "error", "プリクラ台から離れすぎています。")
        return
    end

    session.capturing = true
    session.captureStartedAt = os.time()
    session.expiresAt = os.time() + 90

    broadcastState(boothId)
    TriggerClientEvent("puribooth:client:captureOwner", source, boothId)
end)

RegisterNetEvent("puribooth:server:announceCountdown", function(boothId, shotIndex)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

    shotIndex = math.max(
        1,
        math.min(
            tonumber(Config.ShotCount) or 4,
            math.floor(tonumber(shotIndex) or 1)
        )
    )

    TriggerClientEvent("puribooth:client:countdown", -1, boothId, shotIndex)
end)

RegisterNetEvent("puribooth:server:captureComplete", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:finishSession", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source then return end

    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:technicalFailure", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

    if session.paid and session.paid > 0 then
        exports.qbx_core:AddMoney(
            source,
            session.moneyType or "cash",
            session.paid,
            "puribooth-technical-refund"
        )
        notify(source, "error", "撮影に失敗したため料金を返金しました。")
    end

    releaseSession(boothId)
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if GetResourceState("qbx_core") ~= "started" then return end

    for _, session in pairs(sessions) do
        if session.paid and session.paid > 0 and GetPlayerName(session.owner) then
            pcall(function()
                exports.qbx_core:AddMoney(
                    session.owner,
                    session.moneyType or "cash",
                    session.paid,
                    "puribooth-resource-restart-refund"
                )
            end)
        end
    end
end)

AddEventHandler("playerDropped", function()
    local source = source

    for boothId, session in pairs(sessions) do
        if session.owner == source then
            releaseSession(boothId)
        end
    end
end)

CreateThread(function()
    while true do
        Wait(5000)

        local now = os.time()
        for boothId, session in pairs(sessions) do
            if session.expiresAt <= now then
                releaseSession(boothId)
            end
        end
    end
end)

local function resourceState(name)
    local state = GetResourceState(name)
    return state == "started" and "PASS" or ("FAIL(" .. state .. ")")
end

RegisterCommand("puribooth_selftest", function(source)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local qbx = resourceState("qbx_core")
    local phone = resourceState("lb-phone")
    local screenshot = resourceState("screenshot-basic")
    local mysql = resourceState("oxmysql")

    local overall =
        qbx == "PASS"
        and phone == "PASS"
        and screenshot == "PASS"
        and mysql == "PASS"
        and databaseReady

    print(("[puribooth] selftest %s (qbx_core=%s, oxmysql=%s, lb-phone=%s, screenshot-basic=%s, database=%s, booths=%d)")
        :format(
            overall and "PASS" or "FAIL",
            qbx,
            mysql,
            phone,
            screenshot,
            databaseReady and "PASS" or "FAIL",
            boothCount()
        ))
end, false)

CreateThread(function()
    Wait(1000)
    print(("[puribooth] v0.3.0 starting (price=$%d, shots=%d)")
        :format(tonumber(Config.Price) or 0, tonumber(Config.ShotCount) or 4))
end)
