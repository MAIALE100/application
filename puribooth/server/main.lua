local sessions = {}
local booths = {}
local databaseReady = false
local themeSerial = 0
local clearThemeRecipients

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
        label = tostring(row.label or ("フレプリ #" .. id)),
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
    local session = sessions[boothId]
    if not session then return end

    clearThemeRecipients(boothId, session)
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

local function captureCenterForBooth(booth)
    if not booth then return nil end

    local geometry = Config.Geometry or {}
    local radians = math.rad(tonumber(booth.heading) or 0.0)
    local forwardX = -math.sin(radians)
    local forwardY = math.cos(radians)
    local rightX = math.cos(radians)
    local rightY = math.sin(radians)

    local forward = tonumber(geometry.captureForward) or 3.20
    local right = tonumber(geometry.captureRight) or 0.0
    local z = tonumber(geometry.captureZ) or 0.0

    return vector3(
        booth.coords.x + forwardX * forward + rightX * right,
        booth.coords.y + forwardY * forward + rightY * right,
        booth.coords.z + z
    )
end

local function playerNearCapture(source, booth, maxDistance)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 or not booth then return false end

    local center = captureCenterForBooth(booth)
    if not center then return false end

    return #(GetEntityCoords(ped) - center)
        <= (maxDistance or tonumber(Config.ThemeSyncDistance) or 5.5)
end

local function relevantBoothForPlayer(source, capturingOnly)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return nil end

    -- A payer always belongs to their own active booth.
    for boothId, session in pairs(sessions) do
        if session.owner == source
            and (not capturingOnly or session.capturing) then
            return tostring(boothId)
        end
    end

    local coords = GetEntityCoords(ped)
    local maxDistance =
        capturingOnly
            and (tonumber(Config.CountdownSyncDistance) or 5.5)
            or (tonumber(Config.ThemeSyncDistance) or 5.5)

    local bestId = nil
    local bestDistance = nil

    for boothId, session in pairs(sessions) do
        if not capturingOnly or session.capturing then
            local booth = getBooth(boothId)
            local center = booth and captureCenterForBooth(booth)

            if center then
                local distance = #(coords - center)
                if distance <= maxDistance
                    and (not bestDistance or distance < bestDistance) then
                    bestId = tostring(boothId)
                    bestDistance = distance
                end
            end
        end
    end

    return bestId
end

local function validThemeSurface(surface)
    if type(surface) ~= "table" then
        return { enabled = false, image = "" }
    end

    if surface.enabled ~= true then
        return { enabled = false, image = "" }
    end

    local image = surface.image
    if type(image) ~= "string"
        or #image < 32
        or #image > (8 * 1024 * 1024)
        or not image:sub(1, 32):lower():find("^data:image/") then

        return nil
    end

    return {
        enabled = true,
        image = image
    }
end

clearThemeRecipients = function(boothId, session)
    if not session or type(session.themeRecipients) ~= "table" then return end

    for playerId in pairs(session.themeRecipients) do
        if GetPlayerName(playerId) then
            TriggerClientEvent(
                "puribooth:client:themeClear",
                playerId,
                tostring(boothId),
                tonumber(session.themeVersion) or 0
            )
        end
    end

    session.themeRecipients = {}
end

local function syncThemeToNearby(boothId, session)
    local booth = getBooth(boothId)
    if not booth or not session or not session.theme then return end

    session.themeRecipients = session.themeRecipients or {}
    local syncDistance = tonumber(Config.ThemeSyncDistance) or 5.5
    local bps = math.max(
        100000,
        math.floor(tonumber(Config.ThemeSyncBytesPerSecond) or 750000)
    )

    local nearbyNow = {}

    for _, playerIdText in ipairs(GetPlayers()) do
        local playerId = tonumber(playerIdText)

        if playerId
            and playerNearCapture(playerId, booth, syncDistance)
            and relevantBoothForPlayer(playerId, false) == tostring(boothId) then

            nearbyNow[playerId] = true

            if session.themeRecipients[playerId] ~= session.themeVersion then
                TriggerLatentClientEvent(
                    "puribooth:client:themeSync",
                    playerId,
                    bps,
                    tostring(boothId),
                    session.theme,
                    session.themeVersion
                )
                session.themeRecipients[playerId] = session.themeVersion
            end
        end
    end

    for playerId in pairs(session.themeRecipients) do
        if not nearbyNow[playerId] then
            if GetPlayerName(playerId) then
                TriggerClientEvent(
                    "puribooth:client:themeClear",
                    playerId,
                    tostring(boothId),
                    tonumber(session.themeVersion) or 0
                )
            end
            session.themeRecipients[playerId] = nil
        end
    end
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
            tostring(seed.label or "リージョンプリ"),
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
        notify(source, "error", "フレプリ台データベースを準備中です。")
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
        "フレプリ",
        Config.DefaultModel,
        x, y, z, heading,
        GetPlayerName(source) or ("source:" .. source)
    })

    if not insertedId then
        notify(source, "error", "フレプリ台を保存できませんでした。")
        return
    end

    local booth = {
        id = tostring(insertedId),
        label = ("フレプリ #%d"):format(insertedId),
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
    notify(source, "inform", ("フレプリ台 #%d を設置しました。"):format(insertedId))
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
        notify(source, "error", "近くに撤去できるフレプリ台がありません。")
        return
    end

    if sessions[nearestId] then
        notify(source, "error", "使用中のフレプリ台は撤去できません。")
        return
    end

    local numericId = tonumber(nearestId)
    local affected = MySQL.update.await(
        "DELETE FROM puribooth_booths WHERE id = ?",
        { numericId }
    )

    if not affected or affected < 1 then
        notify(source, "error", "フレプリ台を撤去できませんでした。")
        return
    end

    booths[nearestId] = nil
    TriggerClientEvent("puribooth:client:removeBooth", -1, nearestId)
    notify(source, "inform", ("フレプリ台 #%s を撤去しました。"):format(nearestId))
end

local function claimFirstAdmin(source)
    if not Config.AllowFirstAdminClaim then
        notify(source, "error", "初回管理者登録は無効です。")
        return
    end

    if not databaseReady then
        notify(source, "error", "フレプリ台データベースを準備中です。")
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
        print("[puribooth] プレイヤー用: /puribooth place | remove | list")
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
        notify(source, "inform", ("設置済みフレプリ台: %d台"):format(boothCount()))
        return
    end

    notify(source, "inform", "管理: /puribooth claimadmin　設置: /puribooth place　撤去: /puribooth remove　一覧: /puribooth list")
end, false)

RegisterNetEvent("puribooth:server:startSession", function(boothId)
    local source = source
    boothId = tostring(boothId)
    local booth = getBooth(boothId)

    if not booth then
        notify(source, "error", "フレプリ台の設定が見つかりません。")
        return
    end

    if not playerNearBooth(source, booth) then
        notify(source, "error", "フレプリ台の近くで操作してください。")
        return
    end

    if GetResourceState("screenshot-basic") ~= "started" then
        notify(source, "error", "撮影機能が準備できていません。スタッフへお知らせください。")
        return
    end

    if GetResourceState("lb-phone") ~= "started"
        or GetResourceState("qbx_core") ~= "started"
        or GetResourceState("puriphoto") ~= "started" then

        notify(
            source,
            "error",
            "PuriPhoto連携が準備できていないため、現在は課金せず利用を停止しています。"
        )
        return
    end

    local existing = sessions[boothId]
    if existing and existing.expiresAt > os.time() then
        notify(source, "error", "このフレプリ台は使用中です。")
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
        expiresAt = os.time() + math.max(30, tonumber(Config.SessionTimeoutSeconds) or 180),
        theme = nil,
        themeVersion = 0,
        themeRecipients = {}
    }

    broadcastState(boothId)
    TriggerClientEvent(
        "puribooth:client:sessionOpened",
        source,
        boothId,
        sessions[boothId].expiresAt
    )
end)

RegisterNetEvent("puribooth:server:setTheme", function(boothId, theme)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    local booth = getBooth(boothId)

    if not session or not booth or session.owner ~= source then return end
    if session.capturing then return end
    if not playerNearBooth(source, booth, 12.0) then return end
    if type(theme) ~= "table" then return end

    local background = validThemeSurface(theme.background)
    local floor = validThemeSurface(theme.floor)

    if not background or not floor then
        notify(source, "error", "背景・床の共有データが不正です。")
        return
    end

    clearThemeRecipients(boothId, session)

    themeSerial = themeSerial + 1

    session.theme = {
        background = background,
        floor = floor
    }
    session.themeVersion = themeSerial
    session.themeRecipients = {}

    syncThemeToNearby(boothId, session)
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
        notify(source, "error", "フレプリ台から離れすぎています。")
        return
    end

    session.capturing = true
    session.captureStartedAt = os.time()
    session.expiresAt =
        os.time()
        + math.max(
            120,
            tonumber(Config.CaptureTimeoutSeconds) or 600
        )

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

    local booth = getBooth(boothId)
    local distance = tonumber(Config.CountdownSyncDistance) or 5.5

    if booth then
        for _, playerIdText in ipairs(GetPlayers()) do
            local playerId = tonumber(playerIdText)

            if playerId
                and playerNearCapture(playerId, booth, distance)
                and relevantBoothForPlayer(playerId, true) == boothId then

                TriggerClientEvent(
                    "puribooth:client:countdown",
                    playerId,
                    boothId,
                    shotIndex
                )
            end
        end
    end
end)

RegisterNetEvent("puribooth:server:captureComplete", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:cancelSession", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source then return end

    local refund = not session.capturing

    if refund and session.paid and session.paid > 0 then
        exports.qbx_core:AddMoney(
            source,
            session.moneyType or "cash",
            session.paid,
            "puribooth-user-cancel-refund"
        )

        notify(
            source,
            "inform",
            ("撮影開始前のキャンセルなので $%s を返金しました。")
                :format(session.paid)
        )
    elseif session.capturing then
        notify(
            source,
            "inform",
            "撮影開始後のキャンセルのため料金は返金されません。"
        )
    end

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
                if session.paid and session.paid > 0 and GetPlayerName(session.owner) then
                    pcall(function()
                        exports.qbx_core:AddMoney(
                            session.owner,
                            session.moneyType or "cash",
                            session.paid,
                            session.capturing
                                and "puribooth-capture-timeout-refund"
                                or "puribooth-setup-timeout-refund"
                        )
                    end)

                    notify(
                        session.owner,
                        "error",
                        session.capturing
                            and "撮影セッションがタイムアウトしたため料金を返金しました。"
                            or "撮影準備時間が終了したため料金を返金しました。"
                    )
                end

                releaseSession(boothId)
            end
        end
    end
end)

CreateThread(function()
    while true do
        Wait(1000)

        for boothId, session in pairs(sessions) do
            if session.theme then
                syncThemeToNearby(boothId, session)
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
    local puriphoto = resourceState("puriphoto")

    local overall =
        qbx == "PASS"
        and phone == "PASS"
        and screenshot == "PASS"
        and mysql == "PASS"
        and puriphoto == "PASS"
        and databaseReady

    print(("[puribooth] selftest %s (qbx_core=%s, oxmysql=%s, lb-phone=%s, screenshot-basic=%s, puriphoto=%s, database=%s, booths=%d)")
        :format(
            overall and "PASS" or "FAIL",
            qbx,
            mysql,
            phone,
            screenshot,
            puriphoto,
            databaseReady and "PASS" or "FAIL",
            boothCount()
        ))
end, false)

CreateThread(function()
    Wait(1000)
    print(("[puribooth] v0.8.4 starting (price=$%d, shots=%d)")
        :format(tonumber(Config.Price) or 0, tonumber(Config.ShotCount) or 4))
end)
