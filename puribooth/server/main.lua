local sessions = {}
local sessionLocks = {}
local sourceSessionLocks = {}
local collectionLocks = {}
local booths = {}
local databaseReady = false
local themeSerial = 0
local sessionSerial = 0
local collectionSerial = 0
local collectionProcessRunning = false
local refundRetryRunning = false
local puriphotoUiCache = nil
local clearThemeRecipients

local function notify(source, kind, message)
    TriggerClientEvent("puribooth:client:notify", source, kind, message)
end

local function versionParts(value)
    local parts = {}

    for part in tostring(value or ""):gmatch("(%d+)") do
        parts[#parts + 1] = tonumber(part) or 0
        if #parts >= 4 then break end
    end

    return #parts > 0 and parts or nil
end

local function versionAtLeast(actual, minimum)
    local actualParts = versionParts(actual)
    local minimumParts = versionParts(minimum)

    if not actualParts or not minimumParts then
        return false
    end

    local count = math.max(#actualParts, #minimumParts)

    for index = 1, count do
        local current = actualParts[index] or 0
        local required = minimumParts[index] or 0

        if current > required then return true end
        if current < required then return false end
    end

    return true
end

local function resourceVersion(name)
    if GetResourceState(name) ~= "started" then return nil end

    if name == "qbx_core" then
        local ok, value = pcall(function()
            return exports.qbx_core:GetCoreVersion(GetCurrentResourceName())
        end)

        if ok and type(value) == "string" and value ~= "" then
            return value
        end
    end

    local value = GetResourceMetadata(name, "version", 0)
    if type(value) == "string" and value ~= "" then
        return value
    end

    return nil
end

local function resourceCompatibilityState(name)
    local state = GetResourceState(name)
    if state ~= "started" then
        return false, ("FAIL(state=%s)"):format(tostring(state)), nil
    end

    local minimum =
        tostring(((Config.MinimumVersions or {})[name]) or "")

    if minimum == "" then
        return true, "PASS", resourceVersion(name)
    end

    local actual = resourceVersion(name)
    if not actual then
        return false, ("FAIL(version=unknown,min=%s)"):format(minimum), nil
    end

    if not versionAtLeast(actual, minimum) then
        return false,
            ("FAIL(v%s<v%s)"):format(actual, minimum),
            actual
    end

    return true,
        ("PASS(v%s>=v%s)"):format(actual, minimum),
        actual
end

local function puriphotoUiState()
    if GetResourceState("puriphoto") ~= "started" then
        puriphotoUiCache = nil
        return false, "FAIL(resource)"
    end

    if puriphotoUiCache then
        return puriphotoUiCache.ok, puriphotoUiCache.state
    end

    local function finish(ok, state)
        puriphotoUiCache = {
            ok = ok == true,
            state = tostring(state)
        }
        return puriphotoUiCache.ok, puriphotoUiCache.state
    end

    local index = LoadResourceFile(
        "puriphoto",
        "ui/dist/index.html"
    )

    if type(index) ~= "string" or #index < 100 then
        return finish(false, "FAIL(ui-dist-index)")
    end

    local scriptPath =
        index:match('src=["\']([^"\']+%.js)["\']')

    if not scriptPath then
        return finish(false, "FAIL(ui-dist-script)")
    end

    scriptPath =
        scriptPath
            :gsub("^%./", "")
            :gsub("^/", "")
            :gsub("^ui/dist/", "")

    local bundle = LoadResourceFile(
        "puriphoto",
        "ui/dist/" .. scriptPath
    )

    if type(bundle) ~= "string" or #bundle < 1000 then
        return finish(false, "FAIL(ui-dist-bundle)")
    end

    local hasImportNotice =
        bundle:find("boothImportAvailable", 1, true) ~= nil
    local hasImportCallback =
        bundle:find("puriphotoGetBoothImport", 1, true) ~= nil
    local hasImportConfirm =
        bundle:find("puriphotoConfirmBoothImport", 1, true) ~= nil

    if not hasImportNotice
        or not hasImportCallback
        or not hasImportConfirm then
        return finish(false, "FAIL(stale-ui-no-flepri-import)")
    end

    local stylePath =
        index:match('href=["\']([^"\']+%.css)["\']')

    if not stylePath then
        return finish(false, "FAIL(ui-dist-style)")
    end

    stylePath =
        stylePath
            :gsub("^%./", "")
            :gsub("^/", "")
            :gsub("^ui/dist/", "")

    local style = LoadResourceFile(
        "puriphoto",
        "ui/dist/" .. stylePath
    )

    if type(style) ~= "string" or #style < 1000 then
        return finish(false, "FAIL(ui-dist-css)")
    end

    local bridge = LoadResourceFile(
        "puriphoto",
        "client/v11.lua"
    )

    if type(bridge) ~= "string"
        or bridge:find("OpenBoothImport", 1, true) == nil
        or bridge:find("CancelBoothImport", 1, true) == nil
        or bridge:find("boothImportConsumed", 1, true) == nil then
        return finish(false, "FAIL(client-flepri-bridge)")
    end

    return finish(
        true,
        ("PASS(index=%dB,bundle=%dB,css=%dB)")
            :format(#index, #bundle, #style)
    )
end

local function managementMinimumGrade(action)
    local management = Config.Management or {}

    if action == "place" then
        return tonumber(management.placeMinGrade) or 0
    elseif action == "remove" then
        return tonumber(management.removeMinGrade) or 0
    elseif action == "price" then
        return tonumber(management.priceMinGrade) or 0
    end

    return tonumber(management.salesMinGrade) or 0
end

local function managementPlayer(source, action)
    if source == 0 then
        return {
            job = "console",
            grade = 999,
            onduty = true
        }
    end

    local management = Config.Management or {}

    if management.allowAceOverride == true then
        local ace = tostring(management.ace or "group.admin")
        if IsPlayerAceAllowed(source, ace)
            or IsPlayerAceAllowed(source, "group.god") then
            return {
                job = "ace",
                grade = 999,
                onduty = true
            }
        end
    end

    if GetResourceState("qbx_core") ~= "started" then
        return nil
    end

    local player = exports.qbx_core:GetPlayer(source)
    local playerData = player and player.PlayerData
    local job = playerData and playerData.job

    if not job then return nil end

    local requiredJob = tostring(management.job or "weazel")
    if tostring(job.name or "") ~= requiredJob then
        return nil
    end

    if management.requireOnDuty == true and job.onduty ~= true then
        return nil
    end

    local grade =
        tonumber(job.grade and job.grade.level)
        or tonumber(playerData.jobs and playerData.jobs[requiredJob])
        or 0

    if grade < managementMinimumGrade(action) then
        return nil
    end

    return {
        player = player,
        playerData = playerData,
        job = requiredJob,
        grade = grade,
        onduty = job.onduty == true
    }
end

local function hasManagementAccess(source, action)
    return managementPlayer(source, action) ~= nil
end

local function requireManagementAccess(source, action)
    if hasManagementAccess(source, action) then
        return true
    end

    local management = Config.Management or {}
    notify(
        source,
        "error",
        ("この操作は %s job の権限者だけ使用できます。")
            :format(tostring(management.job or "weazel"))
    )
    return false
end

local function atSalesLocation(source)
    if source == 0 then return true end

    local management = Config.Management or {}
    if management.salesRequireLocation ~= true then
        return true
    end

    local coords = management.salesCoords or {}
    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)

    if not x or not y or not z then
        return false
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return false end

    local maxDistance = tonumber(management.salesDistance) or 12.0
    return #(GetEntityCoords(ped) - vector3(x, y, z)) <= maxDistance
end

local function requireSalesLocation(source)
    if atSalesLocation(source) then
        return true
    end

    notify(source, "error", "売上管理はWeazel本社の管理地点で行ってください。")
    return false
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
        heading = tonumber(row.heading) or 0.0,
        price = math.max(
            tonumber(Config.MinPrice) or 0,
            math.min(
                tonumber(Config.MaxPrice) or 100000,
                math.floor(tonumber(row.price) or tonumber(Config.Price) or 0)
            )
        )
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
    local maxBytes =
        math.max(
            256 * 1024,
            math.floor(
                tonumber(Config.MaxThemeImageBytes)
                or (4 * 1024 * 1024)
            )
        )

    if type(image) ~= "string"
        or #image < 32
        or #image > maxBytes
        or not image:sub(1, 32):lower():find("^data:image/jpeg;base64,") then

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
        SELECT id, label, model, x, y, z, heading, price
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
                (label, model, x, y, z, heading, price, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ]], {
            tostring(seed.label or "リージョンプリ"),
            tostring(seed.model or Config.DefaultModel),
            tonumber(seed.x) or 0.0,
            tonumber(seed.y) or 0.0,
            tonumber(seed.z) or 0.0,
            tonumber(seed.heading) or 0.0,
            math.floor(tonumber(Config.Price) or 0),
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
                heading = tonumber(seed.heading) or 0.0,
                price = math.floor(tonumber(Config.Price) or 0)
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
        CREATE TABLE IF NOT EXISTS puribooth_booths (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            label VARCHAR(64) NOT NULL,
            model VARCHAR(64) NOT NULL,
            x DOUBLE NOT NULL,
            y DOUBLE NOT NULL,
            z DOUBLE NOT NULL,
            heading DOUBLE NOT NULL DEFAULT 0,
            price INT UNSIGNED NULL,
            balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
            lifetime_sales BIGINT UNSIGNED NOT NULL DEFAULT 0,
            completed_sales INT UNSIGNED NOT NULL DEFAULT 0,
            collected_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
            last_sale_at DATETIME NULL,
            last_collected_at DATETIME NULL,
            created_by VARCHAR(96) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )
    ]])

    -- Existing development databases are migrated in place.
    MySQL.query.await([[
        ALTER TABLE puribooth_booths
            ADD COLUMN IF NOT EXISTS price INT UNSIGNED NULL,
            ADD COLUMN IF NOT EXISTS balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lifetime_sales BIGINT UNSIGNED NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS completed_sales INT UNSIGNED NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS collected_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_sale_at DATETIME NULL,
            ADD COLUMN IF NOT EXISTS last_collected_at DATETIME NULL
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS puribooth_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id VARCHAR(64) NULL,
            booth_id INT UNSIGNED NULL,
            citizenid VARCHAR(64) NULL,
            event_type VARCHAR(48) NOT NULL,
            amount BIGINT NOT NULL DEFAULT 0,
            money_type VARCHAR(16) NULL,
            detail VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_puribooth_events_session (session_id),
            INDEX idx_puribooth_events_citizen (citizenid),
            INDEX idx_puribooth_events_booth_created (booth_id, created_at)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS puribooth_refunds (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id VARCHAR(64) NOT NULL,
            booth_id INT UNSIGNED NULL,
            citizenid VARCHAR(64) NOT NULL,
            money_type VARCHAR(16) NOT NULL,
            amount BIGINT UNSIGNED NOT NULL,
            reason VARCHAR(96) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            attempts INT UNSIGNED NOT NULL DEFAULT 0,
            last_error VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_attempt_at DATETIME NULL,
            resolved_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_puribooth_refunds_session (session_id),
            INDEX idx_puribooth_refunds_status (status, created_at),
            INDEX idx_puribooth_refunds_citizen (citizenid)
        )
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS puribooth_collections (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            collection_id VARCHAR(80) NOT NULL,
            collector_citizenid VARCHAR(64) NULL,
            target VARCHAR(32) NOT NULL,
            amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
            destination VARCHAR(96) NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'preparing',
            allocations LONGTEXT NOT NULL,
            last_error VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            resolved_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_puribooth_collections_id (collection_id),
            INDEX idx_puribooth_collections_status (status, created_at)
        )
    ]])

    MySQL.update.await(
        "UPDATE puribooth_booths SET price = ? WHERE price IS NULL",
        {
            math.max(
                tonumber(Config.MinPrice) or 0,
                math.min(
                    tonumber(Config.MaxPrice) or 100000,
                    math.floor(tonumber(Config.Price) or 0)
                )
            )
        }
    )

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

local function nearestBooth(source, maxDistance)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return nil end

    local coords = GetEntityCoords(ped)
    local nearestId = nil
    local nearest = nil
    local nearestDistance = tonumber(maxDistance) or 6.0

    for boothId, booth in pairs(booths) do
        local distance =
            #(coords - vector3(
                booth.coords.x,
                booth.coords.y,
                booth.coords.z
            ))

        if distance <= nearestDistance then
            nearestId = tostring(boothId)
            nearest = booth
            nearestDistance = distance
        end
    end

    return nearestId, nearest, nearestDistance
end

local function clampPrice(value)
    local minimum = math.max(0, math.floor(tonumber(Config.MinPrice) or 0))
    local maximum = math.max(
        minimum,
        math.floor(tonumber(Config.MaxPrice) or 100000)
    )

    local price = math.floor(tonumber(value) or -1)
    if price < minimum or price > maximum then
        return nil, minimum, maximum
    end

    return price, minimum, maximum
end

local function addCompanyMoney(source, amount)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then
        return false, "回収額がありません。"
    end

    local payout = Config.Payout or {}
    if payout.enabled == false then
        return false, "会社口座への売上回収が無効です。"
    end

    local mode = tostring(payout.mode or "renewed-banking")

    if mode == "renewed-banking" then
        local resource = tostring(payout.resource or "Renewed-Banking")
        if GetResourceState(resource) ~= "started" then
            return false, ("%s が起動していません。"):format(resource)
        end

        local account = tostring(
            payout.account
            or ((Config.Management or {}).job)
            or "weazel"
        )

        local ok, result = pcall(function()
            return exports[resource]:addAccountMoney(account, amount)
        end)

        if not ok or result == false then
            return false, "会社口座への入金に失敗しました。"
        end

        local title = tostring(
            payout.transactionTitle
            or "FLEPURI売上"
        )

        local historyOk, historyResult = pcall(function()
            return exports[resource]:handleTransaction(
                account,
                title,
                amount,
                "FLEPURI未回収売上の回収",
                "FLEPURI",
                account,
                "deposit"
            )
        end)

        if not historyOk or not historyResult then
            print(
                ("[puribooth] WARN payout succeeded but transaction history failed account=%s amount=%d")
                    :format(account, amount)
            )
        end

        return true, account
    end

    if mode == "player-bank" then
        local added = exports.qbx_core:AddMoney(
            source,
            "bank",
            amount,
            "puribooth-sales-collection"
        )

        if not added then
            return false, "回収者の銀行口座へ入金できませんでした。"
        end

        return true, "player-bank"
    end

    return false, ("未対応の売上入金方式です: %s"):format(mode)
end

local function showSalesReport(source)
    if not requireManagementAccess(source, "sales")
        or not requireSalesLocation(source) then
        return
    end

    local rows = MySQL.query.await([[
        SELECT
            id,
            label,
            price,
            balance,
            lifetime_sales,
            completed_sales,
            collected_total,
            last_sale_at,
            last_collected_at
        FROM puribooth_booths
        ORDER BY id ASC
    ]]) or {}

    local totalBalance = 0
    local totalLifetime = 0
    local totalCount = 0

    for _, row in ipairs(rows) do
        totalBalance = totalBalance + (tonumber(row.balance) or 0)
        totalLifetime = totalLifetime + (tonumber(row.lifetime_sales) or 0)
        totalCount = totalCount + (tonumber(row.completed_sales) or 0)
    end

    notify(
        source,
        "inform",
        ("FLEPURI売上: %d台 / 未回収 $%d / 累計 $%d / 撮影 %d回")
            :format(#rows, totalBalance, totalLifetime, totalCount)
    )

    for _, row in ipairs(rows) do
        notify(
            source,
            "inform",
            ("#%s 料金$%d / 未回収$%d / 累計$%d / %d回")
                :format(
                    tostring(row.id),
                    tonumber(row.price) or 0,
                    tonumber(row.balance) or 0,
                    tonumber(row.lifetime_sales) or 0,
                    tonumber(row.completed_sales) or 0
                )
        )
    end
end

local function nextCollectionId(source)
    collectionSerial = collectionSerial + 1

    return ("%d-%d-%d-%d")
        :format(
            os.time(),
            GetGameTimer(),
            tonumber(source) or 0,
            collectionSerial
        )
end

local function collectionTransaction(queries)
    if type(queries) ~= "table" or #queries == 0 then
        return true
    end

    local ok, success = pcall(function()
        return MySQL.transaction.await(queries)
    end)

    return ok and success == true
end

local function collectionRestoreQueries(claimed)
    local queries = {}

    for _, item in ipairs(claimed or {}) do
        queries[#queries + 1] = {
            query = [[
                UPDATE puribooth_booths
                SET balance = balance + ?
                WHERE id = ?
            ]],
            values = { item.amount, item.id }
        }
    end

    return queries
end

local function collectionFinalizeQueries(claimed)
    local queries = {}

    for _, item in ipairs(claimed or {}) do
        queries[#queries + 1] = {
            query = [[
                UPDATE puribooth_booths
                SET
                    collected_total = collected_total + ?,
                    last_collected_at = NOW()
                WHERE id = ?
            ]],
            values = { item.amount, item.id }
        }
    end

    return queries
end

local function collectionClaimQueries(claimed, collectionId, total, allocations)
    local queries = {}

    for _, item in ipairs(claimed or {}) do
        queries[#queries + 1] = {
            query = [[
                UPDATE puribooth_booths
                SET balance = balance - ?
                WHERE id = ?
            ]],
            values = { item.amount, item.id }
        }
    end

    queries[#queries + 1] = {
        query = [[
            UPDATE puribooth_collections
            SET
                amount = ?,
                allocations = ?,
                status = 'claimed',
                last_error = NULL
            WHERE collection_id = ? AND status = 'preparing'
        ]],
        values = { total, allocations, collectionId }
    }

    return queries
end

local function setCollectionLocks(claimed, collectionId)
    for _, item in ipairs(claimed or {}) do
        collectionLocks[tostring(item.id)] = collectionId or true
    end
end

local function clearCollectionLocks(claimed, collectionId)
    for _, item in ipairs(claimed or {}) do
        local key = tostring(item.id)
        if collectionId == nil or collectionLocks[key] == collectionId then
            collectionLocks[key] = nil
        end
    end
end

local function transitionCollection(collectionId, fromStatus, toStatus, errorText)
    local affected = MySQL.update.await([[
        UPDATE puribooth_collections
        SET
            status = ?,
            last_error = ?
        WHERE collection_id = ? AND status = ?
    ]], {
        tostring(toStatus),
        errorText and safeAuditDetail(errorText) or nil,
        tostring(collectionId),
        tostring(fromStatus)
    })

    return affected and affected > 0
end

local function finalizeCollection(collectionId, claimed)
    local queries = collectionFinalizeQueries(claimed)
    queries[#queries + 1] = {
        query = [[
            UPDATE puribooth_collections
            SET
                status = 'resolved',
                last_error = NULL,
                resolved_at = NOW()
            WHERE collection_id = ? AND status = 'finalizing'
        ]],
        values = { tostring(collectionId) }
    }

    return collectionTransaction(queries)
end

local function restoreCollection(collectionId, claimed)
    local queries = collectionRestoreQueries(claimed)
    queries[#queries + 1] = {
        query = [[
            UPDATE puribooth_collections
            SET
                status = 'rolled_back',
                last_error = NULL,
                resolved_at = NOW()
            WHERE collection_id = ? AND status = 'restoring'
        ]],
        values = { tostring(collectionId) }
    }

    return collectionTransaction(queries)
end

local function collectSales(source, target)
    if collectionProcessRunning then
        notify(source, "error", "別の売上回収処理が進行中です。")
        return
    end

    collectionProcessRunning = true

    local ok, err = xpcall(function()
        if not requireManagementAccess(source, "sales")
            or not requireSalesLocation(source) then
            return
        end

        local unresolvedCollections = tonumber(MySQL.scalar.await([[
            SELECT COUNT(*)
            FROM puribooth_collections
            WHERE status NOT IN ('resolved', 'rolled_back')
        ]])) or 0

        if unresolvedCollections > 0 then
            notify(
                source,
                "error",
                "未解決の売上回収処理があります。新しい回収は停止中です。開発側で puribooth_collections を確認してください。"
            )
            return
        end

        target = string.lower(tostring(target or ""))
        if target == "" then
            notify(
                source,
                "inform",
                "回収: /puribooth collect all または /puribooth collect <台ID>"
            )
            return
        end

        local collectorCitizenId = nil
        local collector = exports.qbx_core:GetPlayer(source)
        if collector and collector.PlayerData then
            collectorCitizenId = collector.PlayerData.citizenid
        end

        local collectionId = nextCollectionId(source)
        local ledgerOk, ledgerId = pcall(function()
            return MySQL.insert.await([[
                INSERT INTO puribooth_collections
                    (
                        collection_id,
                        collector_citizenid,
                        target,
                        amount,
                        status,
                        allocations
                    )
                VALUES (?, ?, ?, 0, 'preparing', '[]')
            ]], {
                collectionId,
                collectorCitizenId,
                target
            })
        end)

        if not ledgerOk or not ledgerId then
            notify(source, "error", "売上回収の保守台帳を開始できませんでした。回収は行っていません。")
            return
        end

        local rows

        if target == "all" then
            rows = MySQL.query.await([[
                SELECT id, balance
                FROM puribooth_booths
                WHERE balance > 0
                ORDER BY id ASC
            ]]) or {}
        else
            local numericId = tonumber(target)
            if not numericId then
                MySQL.update.await(
                    "UPDATE puribooth_collections SET status = 'rolled_back', last_error = 'invalid-target', resolved_at = NOW() WHERE collection_id = ?",
                    { collectionId }
                )
                notify(source, "error", "台IDは数字で指定してください。")
                return
            end

            rows = MySQL.query.await([[
                SELECT id, balance
                FROM puribooth_booths
                WHERE id = ? AND balance > 0
                LIMIT 1
            ]], { numericId }) or {}
        end

        if #rows == 0 then
            MySQL.update.await(
                "UPDATE puribooth_collections SET status = 'rolled_back', last_error = 'no-balance', resolved_at = NOW() WHERE collection_id = ?",
                { collectionId }
            )
            notify(source, "inform", "回収できる未回収売上はありません。")
            return
        end

        local claimed = {}
        local total = 0

        for _, row in ipairs(rows) do
            local boothId = tonumber(row.id)
            local amount = math.max(0, math.floor(tonumber(row.balance) or 0))

            if boothId and amount > 0 then
                claimed[#claimed + 1] = {
                    id = boothId,
                    amount = amount
                }
                total = total + amount
            end
        end

        if total <= 0 then
            MySQL.update.await(
                "UPDATE puribooth_collections SET status = 'rolled_back', last_error = 'nothing-to-claim', resolved_at = NOW() WHERE collection_id = ?",
                { collectionId }
            )
            notify(source, "inform", "回収できる未回収売上はありません。")
            return
        end

        local allocations = json.encode(claimed)
        setCollectionLocks(claimed, collectionId)

        local claimedOk =
            collectionTransaction(
                collectionClaimQueries(
                    claimed,
                    collectionId,
                    total,
                    allocations
                )
            )

        if not claimedOk then
            clearCollectionLocks(claimed, collectionId)
            MySQL.update.await([[
                UPDATE puribooth_collections
                SET
                    status = 'rolled_back',
                    last_error = 'atomic-claim-failed',
                    resolved_at = NOW()
                WHERE collection_id = ? AND status = 'preparing'
            ]], { collectionId })

            notify(
                source,
                "error",
                "売上回収のDB確保に失敗したため、会社口座への入金は行っていません。"
            )
            return
        end

        if not transitionCollection(
            collectionId,
            "claimed",
            "paying",
            nil
        ) then
            clearCollectionLocks(claimed, collectionId)
            print(
                ("[puribooth] CRITICAL collection could not enter paying state id=%s")
                    :format(collectionId)
            )
            notify(
                source,
                "error",
                ("売上回収を安全に続行できません。会社口座への入金は行っていません。collection_id=%s")
                    :format(collectionId)
            )
            return
        end

        local paid, destination = addCompanyMoney(source, total)

        if not paid then
            local moved = transitionCollection(
                collectionId,
                "paying",
                "restoring",
                destination or "payout-failed"
            )

            if not moved then
                clearCollectionLocks(claimed, collectionId)
                print(
                    ("[puribooth] CRITICAL payout failed but collection state transition failed id=%s")
                        :format(collectionId)
                )
                notify(
                    source,
                    "error",
                    ("会社口座への入金は失敗しましたがDB復元状態へ移れませんでした。collection_id=%s")
                        :format(collectionId)
                )
                return
            end

            local restored = restoreCollection(collectionId, claimed)
            clearCollectionLocks(claimed, collectionId)

            if not restored then
                print(
                    ("[puribooth] CRITICAL collection rollback transaction failed id=%s")
                        :format(collectionId)
                )
                notify(
                    source,
                    "error",
                    ("会社口座への入金は失敗し、DB復元も未完了です。collection_id=%s")
                        :format(collectionId)
                )
                return
            end

            notify(
                source,
                "error",
                ("売上回収を取り消しました: %s")
                    :format(tostring(destination or "入金失敗"))
            )
            return
        end

        local finalizeState = MySQL.update.await([[
            UPDATE puribooth_collections
            SET
                status = 'finalizing',
                destination = ?,
                last_error = NULL
            WHERE collection_id = ? AND status = 'paying'
        ]], {
            tostring(destination or ""),
            collectionId
        })

        local enteredFinalize =
            finalizeState and finalizeState > 0

        if not enteredFinalize then
            clearCollectionLocks(claimed, collectionId)
            print(
                ("[puribooth] CRITICAL payout succeeded but finalizing state write failed id=%s amount=%d destination=%s")
                    :format(collectionId, total, tostring(destination))
            )
            notify(
                source,
                "error",
                ("会社口座へ $%d は入金済みですがDB確定待ちです。再回収せず collection_id=%s を開発側へ共有してください。")
                    :format(total, collectionId)
            )
            return
        end

        local finalized = finalizeCollection(collectionId, claimed)
        clearCollectionLocks(claimed, collectionId)

        if not finalized then
            print(
                ("[puribooth] CRITICAL collection finalization transaction failed id=%s amount=%d destination=%s")
                    :format(collectionId, total, tostring(destination))
            )

            notify(
                source,
                "error",
                ("会社口座へ $%d は入金済みですがDB確定に失敗しました。再回収せず puribooth_collection_retry %s を使用してください。")
                    :format(total, collectionId)
            )
            return
        end

        MySQL.update.await(
            "UPDATE puribooth_collections SET destination = ? WHERE collection_id = ?",
            { tostring(destination or ""), collectionId }
        )

        notify(
            source,
            "inform",
            ("FLEPURI売上 $%d を %s へ回収しました。")
                :format(total, tostring(destination))
        )
    end, debug.traceback)

    collectionProcessRunning = false

    if not ok then
        print(
            ("[puribooth] ERROR collection worker failed: %s")
                :format(tostring(err))
        )
        notify(
            source,
            "error",
            "売上回収処理で予期しないエラーが発生しました。再回収せず開発側で状態を確認してください。"
        )
    end
end

local function changeBoothPrice(source, amountText, boothIdText)
    if not requireManagementAccess(source, "price") then
        return
    end

    local price, minimum, maximum = clampPrice(amountText)
    if not price then
        notify(
            source,
            "error",
            ("料金は $%d ～ $%d で指定してください。")
                :format(minimum, maximum)
        )
        return
    end

    local boothId
    local booth

    if boothIdText and tostring(boothIdText) ~= "" then
        boothId = tostring(math.floor(tonumber(boothIdText) or -1))
        booth = booths[boothId]
    else
        boothId, booth = nearestBooth(
            source,
            tonumber(Config.AdminRemoveDistance) or 6.0
        )
    end

    if not boothId or not booth then
        notify(source, "error", "料金を変更するフレプリ台が見つかりません。")
        return
    end

    local affected = MySQL.update.await(
        "UPDATE puribooth_booths SET price = ? WHERE id = ?",
        { price, tonumber(boothId) }
    )

    if not affected or affected < 1 then
        notify(source, "error", "料金を保存できませんでした。")
        return
    end

    booth.price = price
    TriggerClientEvent(
        "puribooth:client:updateBoothPrice",
        -1,
        boothId,
        price
    )

    notify(
        source,
        "inform",
        ("フレプリ台 #%s の料金を $%d に変更しました。")
            :format(boothId, price)
    )
end

RegisterNetEvent("puribooth:server:adminPlace", function(data)
    local source = source
    if not requireManagementAccess(source, "place") then
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
    local maxPlaceDistance = tonumber(Config.AdminPlaceMaxDistance) or 15.0
    if #(playerCoords - vector3(x, y, z)) > maxPlaceDistance then
        notify(source, "error", "自分の現在地付近にだけ設置できます。")
        return
    end

    heading = heading % 360.0
    local initialPrice =
        math.floor(tonumber(Config.Price) or 0)

    local insertedId = MySQL.insert.await([[
        INSERT INTO puribooth_booths
            (label, model, x, y, z, heading, price, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        "フレプリ",
        Config.DefaultModel,
        x, y, z, heading,
        initialPrice,
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
        heading = heading,
        price = initialPrice
    }

    MySQL.update.await(
        "UPDATE puribooth_booths SET label = ? WHERE id = ?",
        { booth.label, insertedId }
    )

    booths[booth.id] = booth
    broadcastBooths(-1)
    notify(
        source,
        "inform",
        ("フレプリ台 #%d を設置しました。初期料金 $%d")
            :format(insertedId, initialPrice)
    )
end)

local function removeNearestBooth(source)
    if not requireManagementAccess(source, "remove") then
        return
    end

    local nearestId = nearestBooth(
        source,
        tonumber(Config.AdminRemoveDistance) or 6.0
    )

    if not nearestId then
        notify(source, "error", "近くに撤去できるフレプリ台がありません。")
        return
    end

    if sessions[nearestId] then
        notify(source, "error", "使用中のフレプリ台は撤去できません。")
        return
    end

    if collectionLocks[nearestId] then
        notify(source, "error", "売上回収処理中のフレプリ台は撤去できません。")
        return
    end

    local unresolvedCollections = tonumber(MySQL.scalar.await([[
        SELECT COUNT(*)
        FROM puribooth_collections
        WHERE status NOT IN ('resolved', 'rolled_back')
    ]])) or 0

    if unresolvedCollections > 0 then
        notify(source, "error", "未解決の売上回収があるため、台の撤去を停止しています。")
        return
    end

    local balance = tonumber(MySQL.scalar.await(
        "SELECT balance FROM puribooth_booths WHERE id = ?",
        { tonumber(nearestId) }
    )) or 0

    if balance > 0 then
        notify(
            source,
            "error",
            ("台 #%s に未回収売上 $%d があります。先に回収してください。")
                :format(nearestId, balance)
        )
        return
    end

    local affected = MySQL.update.await(
        "DELETE FROM puribooth_booths WHERE id = ?",
        { tonumber(nearestId) }
    )

    if not affected or affected < 1 then
        notify(source, "error", "フレプリ台を撤去できませんでした。")
        return
    end

    booths[nearestId] = nil
    TriggerClientEvent("puribooth:client:removeBooth", -1, nearestId)
    notify(source, "inform", ("フレプリ台 #%s を撤去しました。"):format(nearestId))
end

RegisterCommand("puribooth", function(source, args)
    if source == 0 then
        print("[puribooth] place | remove | list | price <amount> [id] | sales | collect <all|id>")
        return
    end

    local action = string.lower(tostring(args[1] or ""))

    if action == "place" then
        if requireManagementAccess(source, "place") then
            TriggerClientEvent("puribooth:client:adminPlaceHere", source)
        end
        return
    end

    if action == "remove" then
        removeNearestBooth(source)
        return
    end

    if action == "list" then
        if requireManagementAccess(source, "sales") then
            notify(
                source,
                "inform",
                ("設置済みフレプリ台: %d台")
                    :format(boothCount())
            )
        end
        return
    end

    if action == "price" then
        changeBoothPrice(source, args[2], args[3])
        return
    end

    if action == "sales" then
        showSalesReport(source)
        return
    end

    if action == "collect" then
        collectSales(source, args[2])
        return
    end

    notify(
        source,
        "inform",
        "FLEPURI: /puribooth place | remove | price <料金> [台ID] | sales | collect <all|台ID> | list"
    )
end, false)

local function nextSessionId(source, boothId)
    sessionSerial = sessionSerial + 1

    return ("%d-%d-%d-%s-%d")
        :format(
            os.time(),
            GetGameTimer(),
            tonumber(source) or 0,
            tostring(boothId or "0"),
            sessionSerial
        )
end

local function safeAuditDetail(value)
    local detail = tostring(value or "")
    if #detail > 255 then
        detail = detail:sub(1, 255)
    end
    return detail
end

local function beginSettlement(session, kind)
    if not session or session.settling then
        return false
    end

    session.settling = tostring(kind or "unknown")
    return true
end

local function auditEvent(session, boothId, eventType, amount, detail)
    if not databaseReady then return false end

    local ok, result = pcall(function()
        return MySQL.insert.await([[
            INSERT INTO puribooth_events
                (session_id, booth_id, citizenid, event_type, amount, money_type, detail)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], {
            session and session.sessionId or nil,
            tonumber(boothId or (session and session.boothId)),
            session and session.refundIdentifier or nil,
            tostring(eventType or "unknown"),
            math.floor(tonumber(amount) or 0),
            session and session.moneyType or nil,
            safeAuditDetail(detail)
        })
    end)

    if not ok or not result then
        print(
            ("[puribooth] WARN audit write failed event=%s booth=%s")
                :format(
                    tostring(eventType or "unknown"),
                    tostring(boothId or (session and session.boothId) or "?")
                )
        )
        return false
    end

    return true
end

local function queueRefund(session, reason, errorText)
    if not databaseReady or not session then return false end

    local sessionId = tostring(session.sessionId or "")
    local citizenid = tostring(session.refundIdentifier or "")
    local amount = math.max(0, math.floor(tonumber(session.paid) or 0))

    if sessionId == "" or citizenid == "" or amount <= 0 then
        return false
    end

    local ok, affected = pcall(function()
        return MySQL.update.await([[
            INSERT INTO puribooth_refunds
                (
                    session_id,
                    booth_id,
                    citizenid,
                    money_type,
                    amount,
                    reason,
                    status,
                    attempts,
                    last_error
                )
            VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)
            ON DUPLICATE KEY UPDATE
                reason = VALUES(reason),
                last_error = VALUES(last_error),
                status = IF(status IN ('resolved', 'processing'), status, 'pending')
        ]], {
            sessionId,
            tonumber(session.boothId),
            citizenid,
            tostring(session.moneyType or "cash"),
            amount,
            tostring(reason or "puribooth-refund"),
            safeAuditDetail(errorText)
        })
    end)

    local queued = ok and affected ~= nil
    session.refundQueued = queued

    if queued then
        auditEvent(
            session,
            session.boothId,
            "refund_queued",
            amount,
            reason
        )
    else
        print(
            ("[puribooth] CRITICAL refund queue write failed session=%s booth=%s amount=%d")
                :format(sessionId, tostring(session.boothId or "?"), amount)
        )
    end

    return queued
end

local function queueRefundReview(session, reason, errorText)
    if not databaseReady or not session then return false end

    local sessionId = tostring(session.sessionId or "")
    local citizenid = tostring(session.refundIdentifier or "")
    local amount = math.max(0, math.floor(tonumber(session.paid) or 0))

    if sessionId == "" or citizenid == "" or amount <= 0 then
        return false
    end

    local ok, affected = pcall(function()
        return MySQL.update.await([[
            INSERT INTO puribooth_refunds
                (
                    session_id,
                    booth_id,
                    citizenid,
                    money_type,
                    amount,
                    reason,
                    status,
                    attempts,
                    last_error
                )
            VALUES (?, ?, ?, ?, ?, ?, 'processing', 0, ?)
            ON DUPLICATE KEY UPDATE
                reason = VALUES(reason),
                last_error = VALUES(last_error),
                status = IF(status = 'resolved', status, 'processing')
        ]], {
            sessionId,
            tonumber(session.boothId),
            citizenid,
            tostring(session.moneyType or "cash"),
            amount,
            tostring(reason or "puribooth-refund-review"),
            safeAuditDetail(errorText)
        })
    end)

    local queued = ok and affected ~= nil
    session.refundQueued = queued

    if queued then
        auditEvent(
            session,
            session.boothId,
            "refund_review_required",
            amount,
            reason
        )
    else
        print(
            ("[puribooth] CRITICAL refund review write failed session=%s booth=%s amount=%d")
                :format(sessionId, tostring(session.boothId or "?"), amount)
        )
    end

    return queued
end

local function recordCompletedSale(boothId, session, reason)
    boothId = tostring(boothId)

    if not session then
        return false
    end

    if session.saleRecorded then
        return true
    end

    if session.saleRecording then
        return nil
    end

    session.saleRecording = true

    local amount = math.max(0, math.floor(tonumber(session.paid) or 0))
    local ok, affected = pcall(function()
        return MySQL.update.await([[
        UPDATE puribooth_booths
        SET
            balance = balance + ?,
            lifetime_sales = lifetime_sales + ?,
            completed_sales = completed_sales + 1,
            last_sale_at = NOW()
        WHERE id = ?
        ]], {
            amount,
            amount,
            tonumber(boothId)
        })
    end)

    session.saleRecording = false

    if not ok or not affected or affected < 1 then
        print(
            ("[puribooth] ERROR failed to record sale booth=%s amount=%d reason=%s")
                :format(
                    boothId,
                    amount,
                    tostring(reason or "capture-complete")
                )
        )
        auditEvent(
            session,
            boothId,
            "sale_record_failed",
            amount,
            reason
        )
        return false
    end

    session.saleRecorded = true
    auditEvent(
        session,
        boothId,
        "sale_recorded",
        amount,
        reason
    )
    return true
end

local function refundSession(session, fallbackSource, reason)
    if not session then return false end
    if session.refunded == true then return true end
    if session.refundQueued == true then return false end
    if session.refundInProgress == true then return false end

    session.refundInProgress = true

    local amount = math.max(0, math.floor(tonumber(session.paid) or 0))
    if amount <= 0 then
        session.refunded = true
        session.refundInProgress = false
        return true
    end

    local identifier =
        session.refundIdentifier
        or fallbackSource
        or session.owner

    if not identifier then
        queueRefund(session, reason, "missing-refund-identifier")
        session.refundInProgress = false
        return false
    end

    if GetResourceState("qbx_core") ~= "started" then
        queueRefund(session, reason, "qbx_core-not-started")
        session.refundInProgress = false
        return false
    end

    local ok, added = pcall(function()
        return exports.qbx_core:AddMoney(
            identifier,
            session.moneyType or "cash",
            amount,
            reason or "puribooth-refund"
        )
    end)

    if ok and added == true then
        session.refunded = true
        auditEvent(
            session,
            session.boothId,
            "refund_completed",
            amount,
            reason
        )
        session.refundInProgress = false
        return true
    end

    queueRefund(
        session,
        reason,
        ok and "qbx-addmoney-returned-false" or "qbx-addmoney-error"
    )
    session.refundInProgress = false
    return false
end

local function expireSession(boothId, session, reason)
    boothId = tostring(boothId)
    if not session or sessions[boothId] ~= session then
        return false
    end

    if not beginSettlement(session, reason or "expired") then
        return nil
    end

    local refunded = true
    if session.paid and session.paid > 0 then
        refunded = refundSession(
            session,
            session.owner,
            reason
                or (
                    session.capturing
                        and "puribooth-capture-timeout-refund"
                        or "puribooth-setup-timeout-refund"
                )
        )
    end

    auditEvent(
        session,
        boothId,
        "session_expired",
        session.paid or 0,
        reason
    )
    releaseSession(boothId)
    return refunded
end

local function retryPendingRefunds(limit)
    if refundRetryRunning or not databaseReady then
        return 0, 0
    end

    if GetResourceState("qbx_core") ~= "started" then
        return 0, 0
    end

    refundRetryRunning = true

    local ok, attempted, resolved = pcall(function()
        limit = math.max(
            1,
            math.min(
                100,
                math.floor(
                    tonumber(limit)
                    or tonumber(Config.RefundRetryBatch)
                    or 25
                )
            )
        )

        local rows = MySQL.query.await(
            ("SELECT id, session_id, booth_id, citizenid, money_type, amount, reason FROM puribooth_refunds WHERE status = 'pending' ORDER BY id ASC LIMIT %d")
                :format(limit)
        ) or {}

        local attemptedCount = 0
        local resolvedCount = 0

        for _, row in ipairs(rows) do
            local claimed = MySQL.update.await([[
                UPDATE puribooth_refunds
                SET
                    status = 'processing',
                    attempts = attempts + 1,
                    last_attempt_at = NOW(),
                    last_error = NULL
                WHERE id = ? AND status = 'pending'
            ]], { tonumber(row.id) })

            if claimed and claimed > 0 then
                attemptedCount = attemptedCount + 1

                local moneyOk, added = pcall(function()
                    return exports.qbx_core:AddMoney(
                        tostring(row.citizenid),
                        tostring(row.money_type or "cash"),
                        math.max(0, math.floor(tonumber(row.amount) or 0)),
                        tostring(row.reason or "puribooth-refund-retry")
                    )
                end)

                if moneyOk and added == true then
                    local marked = MySQL.update.await([[
                        UPDATE puribooth_refunds
                        SET
                            status = 'resolved',
                            resolved_at = NOW(),
                            last_error = NULL
                        WHERE id = ? AND status = 'processing'
                    ]], { tonumber(row.id) })

                    if marked and marked > 0 then
                        resolvedCount = resolvedCount + 1
                        auditEvent(
                            {
                                sessionId = tostring(row.session_id),
                                boothId = tonumber(row.booth_id),
                                refundIdentifier = tostring(row.citizenid),
                                moneyType = tostring(row.money_type or "cash")
                            },
                            row.booth_id,
                            "refund_retry_resolved",
                            row.amount,
                            row.reason
                        )
                    else
                        print(
                            ("[puribooth] CRITICAL refund paid but resolution write failed session=%s; manual review required")
                                :format(tostring(row.session_id))
                        )
                    end
                else
                    MySQL.update.await([[
                        UPDATE puribooth_refunds
                        SET
                            status = 'pending',
                            last_error = ?
                        WHERE id = ? AND status = 'processing'
                    ]], {
                        moneyOk and "qbx-addmoney-returned-false" or "qbx-addmoney-error",
                        tonumber(row.id)
                    })
                end
            end
        end

        return attemptedCount, resolvedCount
    end)

    refundRetryRunning = false

    if not ok then
        print(
            ("[puribooth] ERROR refund retry worker failed: %s")
                :format(tostring(attempted))
        )
        return 0, 0
    end

    attempted = tonumber(attempted) or 0
    resolved = tonumber(resolved) or 0

    if attempted > 0 then
        print(
            ("[puribooth] refund retry attempted=%d resolved=%d pending=%d")
                :format(attempted, resolved, attempted - resolved)
        )
    end

    return attempted, resolved
end

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

    local qbxCompatible, qbxState =
        resourceCompatibilityState("qbx_core")
    local puriphotoCompatible, puriphotoState =
        resourceCompatibilityState("puriphoto")
    local puriphotoUiReady, puriphotoUi =
        puriphotoUiState()

    if GetResourceState("lb-phone") ~= "started"
        or not qbxCompatible
        or not puriphotoCompatible
        or not puriphotoUiReady then

        print(
            ("[puribooth] session blocked qbx_core=%s puriphoto=%s puriphoto_ui=%s lb-phone=%s")
                :format(
                    qbxState,
                    puriphotoState,
                    puriphotoUi,
                    GetResourceState("lb-phone")
                )
        )

        notify(
            source,
            "error",
            "FLEPURI連携の互換性を確認できないため、課金せず利用を停止しています。スタッフへお知らせください。"
        )
        return
    end

    local player = exports.qbx_core:GetPlayer(source)
    local citizenid =
        player
        and player.PlayerData
        and player.PlayerData.citizenid

    if not citizenid then
        notify(source, "error", "プレイヤーデータを確認できないため利用できません。")
        return
    end

    for activeBoothId, activeSession in pairs(sessions) do
        if activeSession.owner == source then
            if activeSession.expiresAt > os.time() then
                notify(source, "error", "すでに別のフレプリ撮影を開始しています。")
                return
            end

            local expired = expireSession(
                activeBoothId,
                activeSession,
                "puribooth-stale-owner-session-refund"
            )

            if expired == nil then
                notify(source, "error", "前のフレプリ利用を精算中です。少ししてから再度お試しください。")
                return
            end
        end
    end

    local existing = sessions[boothId]
    if existing and existing.expiresAt > os.time() then
        notify(source, "error", "このフレプリ台は使用中です。")
        return
    elseif existing then
        local expired = expireSession(
            boothId,
            existing,
            "puribooth-stale-booth-session-refund"
        )

        if expired == nil then
            notify(source, "error", "このフレプリ台は前の利用を精算中です。")
            return
        end
    end

    if sessionLocks[boothId] then
        notify(source, "error", "このフレプリ台は別の利用者が開始処理中です。")
        return
    end

    if sourceSessionLocks[source] then
        notify(source, "error", "別のフレプリ台の開始処理が進行中です。")
        return
    end

    sessionLocks[boothId] = source
    sourceSessionLocks[source] = boothId

    local function unlockSessionStart()
        if sessionLocks[boothId] == source then
            sessionLocks[boothId] = nil
        end

        if sourceSessionLocks[source] == boothId then
            sourceSessionLocks[source] = nil
        end
    end

    local price =
        math.max(
            tonumber(Config.MinPrice) or 0,
            math.min(
                tonumber(Config.MaxPrice) or 100000,
                math.floor(
                    tonumber(booth.price)
                    or tonumber(Config.Price)
                    or 0
                )
            )
        )
    local paidWith = nil

    if price > 0 then
        for _, moneyType in ipairs(Config.PaymentMethods or { "cash", "bank" }) do
            if moneyType == "cash" or moneyType == "bank" then
                local ok, paid = pcall(function()
                    return exports.qbx_core:RemoveMoney(
                        source,
                        moneyType,
                        price,
                        "puribooth-session"
                    )
                end)

                if not ok then
                    unlockSessionStart()
                    print(
                        ("[puribooth] ERROR payment export failed source=%s booth=%s method=%s")
                            :format(source, boothId, moneyType)
                    )
                    notify(
                        source,
                        "error",
                        "支払い処理に失敗したため課金を開始しませんでした。スタッフへお知らせください。"
                    )
                    return
                end

                if paid then
                    paidWith = moneyType
                    break
                end
            end
        end

        if not paidWith then
            unlockSessionStart()
            notify(source, "error", ("料金 $%s を支払えませんでした。"):format(price))
            return
        end
    end

    local sessionId = nextSessionId(source, boothId)

    sessions[boothId] = {
        sessionId = sessionId,
        boothId = tonumber(boothId),
        owner = source,
        refundIdentifier = citizenid,
        paid = price,
        moneyType = paidWith or "cash",
        capturing = false,
        expiresAt = os.time() + math.max(30, tonumber(Config.SessionTimeoutSeconds) or 180),
        theme = nil,
        themeVersion = 0,
        themeRecipients = {},
        lastThemeUpdateAt = 0,
        lastCountdownShot = 0,
        lastCountdownAt = 0
    }

    local auditWritten = auditEvent(
        sessions[boothId],
        boothId,
        price > 0 and "session_charged" or "session_opened",
        price,
        paidWith or "free"
    )

    if price > 0 and not auditWritten then
        local session = sessions[boothId]
        local refunded = refundSession(
            session,
            source,
            "puribooth-audit-write-failed-refund"
        )

        releaseSession(boothId)
        unlockSessionStart()

        notify(
            source,
            "error",
            refunded
                and "保守記録を保存できなかったため課金を取り消しました。"
                or "保守記録を保存できず、返金は自動再試行待ちです。"
        )
        return
    end

    unlockSessionStart()
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

    local now = GetGameTimer()
    local cooldown =
        math.max(
            250,
            math.floor(
                tonumber(Config.ThemeUpdateCooldownMs)
                or 1000
            )
        )

    if now - (tonumber(session.lastThemeUpdateAt) or 0) < cooldown then
        return
    end

    session.lastThemeUpdateAt = now

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
        local refunded = expireSession(
            boothId,
            session,
            "puribooth-begin-after-expiry-refund"
        )
        notify(
            source,
            "error",
            refunded == nil
                and "撮影セッションを精算中です。"
                or (
                    refunded
                        and "撮影準備時間が終了したため料金を返金しました。"
                        or "撮影準備時間が終了しました。返金は自動再試行待ちです。"
                )
        )
        return
    end

    if not playerNearBooth(source, booth, 12.0) then
        notify(source, "error", "フレプリ台から離れすぎています。")
        return
    end

    session.capturing = true
    session.captureStartedAt = os.time()
    session.lastCountdownShot = 0
    session.lastCountdownAt = 0
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

    local expectedShot =
        (tonumber(session.lastCountdownShot) or 0) + 1

    if shotIndex ~= expectedShot then
        return
    end

    local now = GetGameTimer()
    local minimumInterval =
        math.max(
            1000,
            (math.max(1, tonumber(Config.CountdownSeconds) or 3) * 1000)
            + 250
        )

    if (tonumber(session.lastCountdownAt) or 0) > 0
        and now - session.lastCountdownAt < minimumInterval then
        return
    end

    session.lastCountdownShot = shotIndex
    session.lastCountdownAt = now

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

    local requiredShots =
        math.max(1, math.floor(tonumber(Config.ShotCount) or 4))

    if (tonumber(session.lastCountdownShot) or 0) < requiredShots then
        print(
            ("[puribooth] WARN rejected premature captureComplete source=%s booth=%s progress=%s/%s")
                :format(
                    source,
                    boothId,
                    tostring(session.lastCountdownShot or 0),
                    tostring(requiredShots)
                )
        )
        return
    end

    if not beginSettlement(session, "capture-complete") then
        return
    end

    local recorded =
        recordCompletedSale(boothId, session, "capture-complete")

    if recorded == nil then
        session.settling = nil
        return
    end

    if not recorded then
        local refunded = refundSession(
            session,
            source,
            "puribooth-sale-record-failed-refund"
        )

        notify(
            source,
            "error",
            refunded
                and "売上記録に失敗したため料金を返金しました。"
                or "売上記録と返金に失敗しました。スタッフへお知らせください。"
        )
    end

    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:cancelSession", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source then return end

    if not beginSettlement(session, "cancel-session") then
        return
    end

    local refund = not session.capturing

    if refund and session.paid and session.paid > 0 then
        local refunded = refundSession(
            session,
            source,
            "puribooth-user-cancel-refund"
        )

        notify(
            source,
            refunded and "inform" or "error",
            refunded
                and ("撮影開始前のキャンセルなので $%s を返金しました。")
                    :format(session.paid)
                or "返金に失敗しました。スタッフへお知らせください。"
        )
    elseif session.capturing then
        local recorded =
            recordCompletedSale(
                boothId,
                session,
                "user-cancel-after-capture-start"
            )

        if recorded == nil then
            session.settling = nil
            return
        end

        if recorded then
            notify(
                source,
                "inform",
                "撮影開始後のキャンセルのため料金は返金されません。"
            )
        else
            local refunded = refundSession(
                session,
                source,
                "puribooth-sale-record-failed-refund"
            )

            notify(
                source,
                "error",
                refunded
                    and "売上記録に失敗したため料金を返金しました。"
                    or "売上記録と返金に失敗しました。スタッフへお知らせください。"
            )
        end
    end

    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:finishSession", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source then return end

    print(
        ("[puribooth] WARN ignored unexpected finishSession source=%s booth=%s phase=%s")
            :format(
                source,
                boothId,
                session.capturing and "capturing" or "setup"
            )
    )
    auditEvent(
        session,
        boothId,
        "unexpected_finish_ignored",
        session.paid or 0,
        session.capturing and "capturing" or "setup"
    )
end)

RegisterNetEvent("puribooth:server:technicalFailure", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

    if not beginSettlement(session, "technical-failure") then
        return
    end

    if session.paid and session.paid > 0 then
        local refunded = refundSession(
            session,
            source,
            "puribooth-technical-refund"
        )

        notify(
            source,
            "error",
            refunded
                and "撮影に失敗したため料金を返金しました。"
                or "撮影に失敗し、返金にも失敗しました。スタッフへお知らせください。"
        )
    end

    releaseSession(boothId)
end)

AddEventHandler("onResourceStart", function(resource)
    if resource == "puriphoto" then
        puriphotoUiCache = nil
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource == "puriphoto" then
        puriphotoUiCache = nil
        return
    end

    if resource ~= GetCurrentResourceName() then return end

    for _, session in pairs(sessions) do
        if session.paid and session.paid > 0 then
            if session.saleRecorded == true then
                auditEvent(
                    session,
                    session.boothId,
                    "resource_stop_sale_already_recorded",
                    session.paid,
                    "no-refund"
                )
            elseif session.saleRecording == true
                or session.refundInProgress == true
                or session.settling == "capture-complete" then

                queueRefundReview(
                    session,
                    "puribooth-resource-stop-uncertain",
                    "settlement-state-uncertain"
                )
            else
                refundSession(
                    session,
                    session.owner,
                    "puribooth-resource-restart-refund"
                )
            end
        end
    end
end)

AddEventHandler("playerDropped", function()
    local source = source

    sourceSessionLocks[source] = nil

    for boothId, lockedSource in pairs(sessionLocks) do
        if lockedSource == source then
            sessionLocks[boothId] = nil
        end
    end

    for boothId, session in pairs(sessions) do
        if session.owner == source then
            if not beginSettlement(session, "player-dropped") then
                goto continue_session
            end

            if session.capturing then
                local recorded =
                    recordCompletedSale(
                        boothId,
                        session,
                        "player-dropped-after-capture-start"
                    )

                if recorded == nil then
                    session.settling = nil
                    goto continue_session
                end

                if not recorded then
                    refundSession(
                        session,
                        source,
                        "puribooth-sale-record-failed-refund"
                    )
                end
            elseif session.paid and session.paid > 0 then
                refundSession(
                    session,
                    source,
                    "puribooth-disconnect-refund"
                )
            end

            releaseSession(boothId)
        end

        ::continue_session::
    end
end)

CreateThread(function()
    while true do
        Wait(5000)

        local now = os.time()
        for boothId, session in pairs(sessions) do
            if session.expiresAt <= now then
                local wasCapturing = session.capturing == true
                local refunded = expireSession(
                    boothId,
                    session,
                    wasCapturing
                        and "puribooth-capture-timeout-refund"
                        or "puribooth-setup-timeout-refund"
                )

                if refunded ~= nil and GetPlayerName(session.owner) then
                    notify(
                        session.owner,
                        "error",
                        refunded
                            and (
                                wasCapturing
                                    and "撮影セッションがタイムアウトしたため料金を返金しました。"
                                    or "撮影準備時間が終了したため料金を返金しました。"
                            )
                            or "撮影セッションが終了しました。返金は自動再試行待ちです。"
                    )
                end
            end
        end
    end
end)

CreateThread(function()
    Wait(10000)

    while true do
        retryPendingRefunds()

        Wait(
            math.max(
                30,
                math.floor(
                    tonumber(Config.RefundRetrySeconds)
                    or 60
                )
            ) * 1000
        )
    end
end)

CreateThread(function()
    Wait(15000)

    while true do
        local keepDays =
            math.max(
                7,
                math.min(
                    365,
                    math.floor(
                        tonumber(Config.SupportHistoryDays)
                        or 90
                    )
                )
            )

        if databaseReady then
            MySQL.update.await(
                ("DELETE FROM puribooth_events WHERE created_at < (NOW() - INTERVAL %d DAY)")
                    :format(keepDays)
            )

            MySQL.update.await(
                ("DELETE FROM puribooth_refunds WHERE status = 'resolved' AND resolved_at < (NOW() - INTERVAL %d DAY)")
                    :format(keepDays)
            )

            MySQL.update.await(
                ("DELETE FROM puribooth_collections WHERE status IN ('resolved', 'rolled_back') AND resolved_at < (NOW() - INTERVAL %d DAY)")
                    :format(keepDays)
            )
        end

        Wait(21600000)
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
    if state ~= "started" then
        return ("FAIL(%s)"):format(tostring(state))
    end

    local version = resourceVersion(name)
    if version then
        return ("PASS(v%s)"):format(version)
    end

    return "PASS"
end

local function managementJobState()
    if GetResourceState("qbx_core") ~= "started" then
        return "FAIL(qbx_core)"
    end

    local jobName = tostring((Config.Management or {}).job or "weazel")
    local job = exports.qbx_core:GetJob(jobName)
    return job and "PASS" or ("FAIL(" .. jobName .. ")")
end

local function payoutState()
    local payout = Config.Payout or {}
    if payout.enabled == false then
        return "DISABLED"
    end

    local mode = tostring(payout.mode or "renewed-banking")
    if mode == "player-bank" then
        return "PASS(player-bank)"
    end

    if mode == "renewed-banking" then
        local resource = tostring(payout.resource or "Renewed-Banking")
        if GetResourceState(resource) ~= "started" then
            return ("FAIL(%s=%s)")
                :format(resource, GetResourceState(resource))
        end

        local account = tostring(
            payout.account
            or ((Config.Management or {}).job)
            or ""
        )

        if account == "" then
            return "FAIL(account=empty)"
        end

        local ok, balance = pcall(function()
            return exports[resource]:getAccountMoney(account)
        end)

        if not ok then
            return "FAIL(getAccountMoney)"
        end

        if balance == false or balance == nil then
            return ("FAIL(account=%s)"):format(account)
        end

        return ("PASS(%s=$%s)")
            :format(account, tostring(balance))
    end

    return "FAIL(mode=" .. mode .. ")"
end

local function databaseSchemaState()
    if not databaseReady then
        return "FAIL(not-ready)"
    end

    local ok, rows = pcall(function()
        return MySQL.query.await([[
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'puribooth_booths'
        ]])
    end)

    if not ok or type(rows) ~= "table" then
        return "FAIL(schema-query)"
    end

    local found = {}
    for _, row in ipairs(rows) do
        found[tostring(row.COLUMN_NAME or row.column_name or "")] = true
    end

    local required = {
        "id",
        "label",
        "model",
        "x",
        "y",
        "z",
        "heading",
        "price",
        "balance",
        "lifetime_sales",
        "completed_sales",
        "collected_total",
        "last_sale_at",
        "last_collected_at",
        "created_by",
        "created_at"
    }

    local missing = {}
    for _, column in ipairs(required) do
        if not found[column] then
            missing[#missing + 1] = column
        end
    end

    if #missing > 0 then
        return ("FAIL(missing=%s)")
            :format(table.concat(missing, ","))
    end

    local tableRows = MySQL.query.await([[
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('puribooth_events', 'puribooth_refunds', 'puribooth_collections')
    ]]) or {}

    local operational = {}
    for _, row in ipairs(tableRows) do
        operational[tostring(row.TABLE_NAME or row.table_name or "")] = true
    end

    if not operational.puribooth_events then
        return "FAIL(missing-table=puribooth_events)"
    end

    if not operational.puribooth_refunds then
        return "FAIL(missing-table=puribooth_refunds)"
    end

    if not operational.puribooth_collections then
        return "FAIL(missing-table=puribooth_collections)"
    end

    return "PASS"
end

local function boothDataState()
    if not databaseReady then
        return "FAIL(not-ready)"
    end

    local minPrice =
        math.max(0, math.floor(tonumber(Config.MinPrice) or 0))
    local maxPrice =
        math.max(
            minPrice,
            math.floor(tonumber(Config.MaxPrice) or 100000)
        )

    local ok, invalid = pcall(function()
        return MySQL.scalar.await([[
            SELECT COUNT(*)
            FROM puribooth_booths
            WHERE
                price IS NULL
                OR price < ?
                OR price > ?
                OR lifetime_sales <> (balance + collected_total)
        ]], {
            minPrice,
            maxPrice
        })
    end)

    if not ok then
        return "FAIL(query)"
    end

    invalid = tonumber(invalid) or 0
    if invalid > 0 then
        return ("FAIL(invalid-booths=%d)"):format(invalid)
    end

    return "PASS"
end

local function configState()
    local minPrice = math.floor(tonumber(Config.MinPrice) or 0)
    local maxPrice = math.floor(tonumber(Config.MaxPrice) or 0)
    local defaultPrice = math.floor(tonumber(Config.Price) or -1)

    if minPrice < 0 or maxPrice < minPrice then
        return "FAIL(price-range)"
    end

    if defaultPrice < minPrice or defaultPrice > maxPrice then
        return "FAIL(default-price)"
    end

    if math.floor(tonumber(Config.ShotCount) or 0) ~= 4 then
        return "FAIL(ShotCount-must-be-4)"
    end

    local hasPaymentMethod = false
    for _, moneyType in ipairs(Config.PaymentMethods or {}) do
        if moneyType == "cash" or moneyType == "bank" then
            hasPaymentMethod = true
            break
        end
    end

    if not hasPaymentMethod then
        return "FAIL(payment-methods)"
    end

    if tostring((Config.Management or {}).job or "") == "" then
        return "FAIL(management-job)"
    end

    local handoffTimeout =
        math.floor(tonumber(Config.PuriPhotoHandoffTimeoutMs) or 0)
    if handoffTimeout < 3000 or handoffTimeout > 60000 then
        return "FAIL(puriphoto-handoff-timeout)"
    end

    local maxThemeBytes =
        math.floor(tonumber(Config.MaxThemeImageBytes) or 0)
    if maxThemeBytes < (256 * 1024)
        or maxThemeBytes > (8 * 1024 * 1024) then
        return "FAIL(theme-image-limit)"
    end

    local themeCooldown =
        math.floor(tonumber(Config.ThemeUpdateCooldownMs) or 0)
    if themeCooldown < 250 or themeCooldown > 10000 then
        return "FAIL(theme-update-cooldown)"
    end

    local retrySeconds =
        math.floor(tonumber(Config.RefundRetrySeconds) or 0)
    if retrySeconds < 30 or retrySeconds > 3600 then
        return "FAIL(refund-retry-seconds)"
    end

    local retryBatch =
        math.floor(tonumber(Config.RefundRetryBatch) or 0)
    if retryBatch < 1 or retryBatch > 100 then
        return "FAIL(refund-retry-batch)"
    end

    local historyDays =
        math.floor(tonumber(Config.SupportHistoryDays) or 0)
    if historyDays < 7 or historyDays > 365 then
        return "FAIL(support-history-days)"
    end

    return "PASS"
end

local function fontState()
    local files = {
        "ui/fonts/PopRumKiwi-Telop.ttf",
        "ui/fonts/galmojigothicfree.ttf",
        "ui/fonts/HitoriGothic.ttf",
        "ui/fonts/HachiMaruPop-Regular.ttf"
    }

    local count = 0
    for _, file in ipairs(files) do
        local data = LoadResourceFile(GetCurrentResourceName(), file)
        if type(data) == "string" and #data > 0 then
            count = count + 1
        end
    end

    if count == #files then
        return ("PASS(%d/%d)"):format(count, #files)
    end

    return ("OPTIONAL(%d/%d)"):format(count, #files)
end

local function refundQueueState()
    if not databaseReady then
        return "FAIL(database-not-ready)", 0, 0
    end

    local rows = MySQL.query.await([[
        SELECT status, COUNT(*) AS count
        FROM puribooth_refunds
        WHERE status <> 'resolved'
        GROUP BY status
    ]]) or {}

    local pending = 0
    local processing = 0

    for _, row in ipairs(rows) do
        local count = tonumber(row.count) or 0
        if tostring(row.status) == "pending" then
            pending = pending + count
        elseif tostring(row.status) == "processing" then
            processing = processing + count
        end
    end

    if pending == 0 and processing == 0 then
        return "PASS(0)", pending, processing
    end

    return ("FAIL(pending=%d,processing=%d)")
        :format(pending, processing), pending, processing
end

local function collectionQueueState()
    if not databaseReady then
        return "FAIL(database-not-ready)", 0
    end

    local rows = MySQL.query.await([[
        SELECT status, COUNT(*) AS count
        FROM puribooth_collections
        WHERE status NOT IN ('resolved', 'rolled_back')
        GROUP BY status
    ]]) or {}

    local total = 0
    local parts = {}

    for _, row in ipairs(rows) do
        local count = tonumber(row.count) or 0
        total = total + count
        parts[#parts + 1] =
            ("%s=%d"):format(tostring(row.status or "?"), count)
    end

    if total == 0 then
        return "PASS(0)", 0
    end

    return ("FAIL(%s)"):format(table.concat(parts, ",")), total
end

local function decodeCollectionAllocations(value)
    local ok, decoded = pcall(function()
        return json.decode(tostring(value or "[]"))
    end)

    if not ok or type(decoded) ~= "table" then
        return nil
    end

    local normalized = {}

    for _, item in ipairs(decoded) do
        local id = tonumber(item.id)
        local amount = math.max(0, math.floor(tonumber(item.amount) or 0))

        if not id or amount <= 0 then
            return nil
        end

        normalized[#normalized + 1] = {
            id = id,
            amount = amount
        }
    end

    if #normalized == 0 then
        return nil
    end

    return normalized
end

local function activeSessionCount()
    local count = 0
    for _ in pairs(sessions) do count = count + 1 end
    return count
end

RegisterCommand("puribooth_support", function(source, args)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local refunds, pending, processing = refundQueueState()
    local collections = collectionQueueState()
    print(("[puribooth] support version=1.0.3 database=%s booths=%d active_sessions=%d start_locks=%d refunds=%s collections=%s")
        :format(
            databaseReady and "PASS" or "FAIL",
            boothCount(),
            activeSessionCount(),
            (function()
                local count = 0
                for _ in pairs(sessionLocks) do count = count + 1 end
                return count
            end)(),
            refunds,
            collections
        ))

    local query = tostring(args[1] or "")
    if query == "" then
        if pending > 0 or processing > 0 then
            print("[puribooth] support hint: run puribooth_refunds for unresolved refund details.")
        end
        return
    end

    local rows = MySQL.query.await([[
        SELECT
            id,
            session_id,
            booth_id,
            citizenid,
            event_type,
            amount,
            money_type,
            detail,
            created_at
        FROM puribooth_events
        WHERE session_id = ? OR citizenid = ?
        ORDER BY id DESC
        LIMIT 30
    ]], { query, query }) or {}

    print(("[puribooth] support trace query=%s events=%d"):format(query, #rows))
    for index = #rows, 1, -1 do
        local row = rows[index]
        print(
            ("[puribooth]   %s session=%s booth=%s event=%s amount=%s method=%s detail=%s")
                :format(
                    tostring(row.created_at or "?"),
                    tostring(row.session_id or "-"),
                    tostring(row.booth_id or "-"),
                    tostring(row.event_type or "-"),
                    tostring(row.amount or 0),
                    tostring(row.money_type or "-"),
                    tostring(row.detail or "-")
                )
        )
    end
end, false)

RegisterCommand("puribooth_collections", function(source)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local rows = MySQL.query.await([[
        SELECT
            collection_id,
            collector_citizenid,
            target,
            amount,
            destination,
            status,
            last_error,
            created_at,
            updated_at
        FROM puribooth_collections
        WHERE status NOT IN ('resolved', 'rolled_back')
        ORDER BY id ASC
        LIMIT 50
    ]]) or {}

    print(("[puribooth] unresolved collections=%d"):format(#rows))
    for _, row in ipairs(rows) do
        print(
            ("[puribooth]   id=%s status=%s amount=%s target=%s destination=%s collector=%s error=%s")
                :format(
                    tostring(row.collection_id or "?"),
                    tostring(row.status or "?"),
                    tostring(row.amount or 0),
                    tostring(row.target or "?"),
                    tostring(row.destination or "-"),
                    tostring(row.collector_citizenid or "-"),
                    tostring(row.last_error or "-")
                )
        )
    end

    if #rows > 0 then
        print("[puribooth] NOTE: finalizing / restoring は puribooth_collection_retry <collection_id> で安全に再処理できます。")
        print("[puribooth] NOTE: paying は銀行履歴を照合し、puribooth_collection_review <collection_id> <paid|notpaid> を使用してください。")
    end
end, false)

RegisterCommand("puribooth_collection_retry", function(source, args)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local collectionId = tostring(args[1] or "")
    if collectionId == "" then
        print("[puribooth] usage: puribooth_collection_retry <collection_id>")
        return
    end

    local row = MySQL.single.await([[
        SELECT collection_id, status, allocations
        FROM puribooth_collections
        WHERE collection_id = ?
        LIMIT 1
    ]], { collectionId })

    if not row then
        print(("[puribooth] collection not found: %s"):format(collectionId))
        return
    end

    local status = tostring(row.status or "")
    local claimed = decodeCollectionAllocations(row.allocations)

    if status == "preparing" then
        local updated = MySQL.update.await([[
            UPDATE puribooth_collections
            SET
                status = 'rolled_back',
                last_error = 'manual-cleanup-preparing',
                resolved_at = NOW()
            WHERE collection_id = ? AND status = 'preparing'
        ]], { collectionId })

        print(
            updated and updated > 0
                and ("[puribooth] collection preparing row closed: %s"):format(collectionId)
                or ("[puribooth] collection preparing cleanup failed: %s"):format(collectionId)
        )
        return
    end

    if not claimed then
        print(("[puribooth] collection allocations invalid: %s"):format(collectionId))
        return
    end

    if status == "claimed" then
        if not transitionCollection(
            collectionId,
            "claimed",
            "restoring",
            "manual-recovery-before-payout"
        ) then
            print(("[puribooth] collection claim recovery lock failed: %s"):format(collectionId))
            return
        end
        status = "restoring"
    elseif status == "paid_unfinalized" then
        if not transitionCollection(
            collectionId,
            "paid_unfinalized",
            "finalizing",
            "legacy-recovery"
        ) then
            print(("[puribooth] collection legacy finalize lock failed: %s"):format(collectionId))
            return
        end
        status = "finalizing"
    elseif status == "rollback_failed" then
        if not transitionCollection(
            collectionId,
            "rollback_failed",
            "restoring",
            "legacy-recovery"
        ) then
            print(("[puribooth] collection legacy restore lock failed: %s"):format(collectionId))
            return
        end
        status = "restoring"
    end

    if status == "finalizing" then
        local finalized = finalizeCollection(collectionId, claimed)
        print(
            finalized
                and ("[puribooth] collection finalized: %s"):format(collectionId)
                or ("[puribooth] collection finalize retry failed; state remains finalizing: %s"):format(collectionId)
        )
        return
    end

    if status == "restoring" then
        local restored = restoreCollection(collectionId, claimed)
        print(
            restored
                and ("[puribooth] collection rollback restored: %s"):format(collectionId)
                or ("[puribooth] collection restore retry failed; state remains restoring: %s"):format(collectionId)
        )
        return
    end

    if status == "paying" then
        print(
            ("[puribooth] collection %s is paying/ambiguous. Check Renewed-Banking first, then use puribooth_collection_review %s <paid|notpaid>")
                :format(collectionId, collectionId)
        )
        return
    end

    print(
        ("[puribooth] collection %s status=%s does not need automatic recovery")
            :format(collectionId, status)
    )
end, false)

RegisterCommand("puribooth_collection_review", function(source, args)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local collectionId = tostring(args[1] or "")
    local verdict = string.lower(tostring(args[2] or ""))

    if collectionId == ""
        or (verdict ~= "paid" and verdict ~= "notpaid") then

        print("[puribooth] usage: puribooth_collection_review <collection_id> <paid|notpaid>")
        print("[puribooth]   paid    = Renewed-Banking側で入金済みを確認")
        print("[puribooth]   notpaid = Renewed-Banking側で未入金を確認")
        return
    end

    local row = MySQL.single.await([[
        SELECT collection_id, status, allocations
        FROM puribooth_collections
        WHERE collection_id = ?
        LIMIT 1
    ]], { collectionId })

    if not row then
        print(("[puribooth] collection not found: %s"):format(collectionId))
        return
    end

    if tostring(row.status or "") ~= "paying" then
        print(
            ("[puribooth] collection %s status=%s is not awaiting bank review")
                :format(collectionId, tostring(row.status or "?"))
        )
        return
    end

    local claimed = decodeCollectionAllocations(row.allocations)
    if not claimed then
        print(("[puribooth] collection allocations invalid: %s"):format(collectionId))
        return
    end

    if verdict == "paid" then
        if not transitionCollection(
            collectionId,
            "paying",
            "finalizing",
            "manual-confirmed-bank-paid"
        ) then
            print(("[puribooth] collection review lock failed: %s"):format(collectionId))
            return
        end

        local finalized = finalizeCollection(collectionId, claimed)
        print(
            finalized
                and ("[puribooth] collection bank-paid finalization complete: %s"):format(collectionId)
                or ("[puribooth] collection finalization failed; state remains finalizing: %s"):format(collectionId)
        )
        return
    end

    if not transitionCollection(
        collectionId,
        "paying",
        "restoring",
        "manual-confirmed-bank-not-paid"
    ) then
        print(("[puribooth] collection review lock failed: %s"):format(collectionId))
        return
    end

    local restored = restoreCollection(collectionId, claimed)
    print(
        restored
            and ("[puribooth] collection bank-not-paid rollback complete: %s"):format(collectionId)
            or ("[puribooth] collection rollback failed; state remains restoring: %s"):format(collectionId)
    )
end, false)

RegisterCommand("puribooth_refunds", function(source)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local rows = MySQL.query.await([[
        SELECT
            session_id,
            booth_id,
            citizenid,
            money_type,
            amount,
            reason,
            status,
            attempts,
            last_error,
            created_at,
            last_attempt_at
        FROM puribooth_refunds
        WHERE status <> 'resolved'
        ORDER BY id ASC
        LIMIT 50
    ]]) or {}

    print(("[puribooth] unresolved refunds=%d"):format(#rows))
    for _, row in ipairs(rows) do
        print(
            ("[puribooth]   status=%s session=%s booth=%s citizenid=%s amount=%s method=%s attempts=%s reason=%s last_error=%s")
                :format(
                    tostring(row.status or "?"),
                    tostring(row.session_id or "?"),
                    tostring(row.booth_id or "-"),
                    tostring(row.citizenid or "?"),
                    tostring(row.amount or 0),
                    tostring(row.money_type or "?"),
                    tostring(row.attempts or 0),
                    tostring(row.reason or "?"),
                    tostring(row.last_error or "-")
                )
        )
    end

    if #rows > 0 then
        print("[puribooth] NOTE: status=processing は二重返金防止のため自動再試行しません。手動照合してください。")
    end
end, false)

RegisterCommand("puribooth_retry_refunds", function(source)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local attempted, resolved = retryPendingRefunds()
    print(
        ("[puribooth] manual refund retry attempted=%d resolved=%d")
            :format(attempted, resolved)
    )
end, false)

RegisterCommand("puribooth_refund_review", function(source, args)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local sessionId = tostring(args[1] or "")
    local action = string.lower(tostring(args[2] or ""))

    if sessionId == "" or (action ~= "resolved" and action ~= "retry") then
        print("[puribooth] usage: puribooth_refund_review <session_id> <resolved|retry>")
        print("[puribooth]   resolved = QBox側ですでに返金済みと確認した場合")
        print("[puribooth]   retry    = 未返金と確認し、自動再試行へ戻す場合")
        return
    end

    local affected

    if action == "resolved" then
        affected = MySQL.update.await([[
            UPDATE puribooth_refunds
            SET
                status = 'resolved',
                resolved_at = NOW(),
                last_error = 'manual-confirmed-refunded'
            WHERE session_id = ? AND status = 'processing'
        ]], { sessionId })
    else
        affected = MySQL.update.await([[
            UPDATE puribooth_refunds
            SET
                status = 'pending',
                last_error = 'manual-approved-retry'
            WHERE session_id = ? AND status = 'processing'
        ]], { sessionId })
    end

    if affected and affected > 0 then
        print(
            ("[puribooth] refund review session=%s action=%s updated")
                :format(sessionId, action)
        )

        if action == "retry" then
            retryPendingRefunds(1)
        end
    else
        print(
            ("[puribooth] refund review session=%s not found or not processing")
                :format(sessionId)
        )
    end
end, false)

RegisterCommand("puribooth_selftest", function(source)
    if source ~= 0 then
        notify(source, "error", "このコマンドはサーバーコンソール専用です。")
        return
    end

    local _, qbx = resourceCompatibilityState("qbx_core")
    local phone = resourceState("lb-phone")
    local screenshot = resourceState("screenshot-basic")
    local mysql = resourceState("oxmysql")
    local _, puriphoto = resourceCompatibilityState("puriphoto")
    local _, puriphotoUi = puriphotoUiState()
    local job = managementJobState()
    local payout = payoutState()
    local database = databaseSchemaState()
    local accounting = boothDataState()
    local config = configState()
    local refunds = refundQueueState()
    local collections = collectionQueueState()
    local fonts = fontState()

    local payoutRequired =
        (Config.Payout or {}).enabled ~= false

    local payoutPass =
        not payoutRequired
        or payout:sub(1, 4) == "PASS"

    local overall =
        qbx:sub(1, 4) == "PASS"
        and phone:sub(1, 4) == "PASS"
        and screenshot:sub(1, 4) == "PASS"
        and mysql:sub(1, 4) == "PASS"
        and puriphoto:sub(1, 4) == "PASS"
        and puriphotoUi:sub(1, 4) == "PASS"
        and job == "PASS"
        and payoutPass
        and database == "PASS"
        and accounting == "PASS"
        and config == "PASS"
        and refunds:sub(1, 4) == "PASS"
        and collections:sub(1, 4) == "PASS"

    print(("[puribooth] selftest %s"):format(overall and "PASS" or "FAIL"))
    print(("[puribooth]   qbx_core=%s"):format(qbx))
    print(("[puribooth]   oxmysql=%s"):format(mysql))
    print(("[puribooth]   lb-phone=%s"):format(phone))
    print(("[puribooth]   screenshot-basic=%s"):format(screenshot))
    print(("[puribooth]   puriphoto=%s"):format(puriphoto))
    print(("[puribooth]   puriphoto_ui=%s"):format(puriphotoUi))
    print(("[puribooth]   management_job=%s"):format(job))
    print(("[puribooth]   payout=%s"):format(payout))
    print(("[puribooth]   database=%s"):format(database))
    print(("[puribooth]   accounting=%s"):format(accounting))
    print(("[puribooth]   config=%s"):format(config))
    print(("[puribooth]   refunds=%s"):format(refunds))
    print(("[puribooth]   collections=%s"):format(collections))
    print(("[puribooth]   fonts=%s"):format(fonts))
    print(("[puribooth]   booths=%d"):format(boothCount()))

    if qbx:sub(1, 4) ~= "PASS" then
        print("[puribooth]   FIX: qbx_core 2.5.4+ を起動し、FLEPURIより先にensureしてください。")
    end

    if puriphoto:sub(1, 4) ~= "PASS"
        or puriphotoUi:sub(1, 4) ~= "PASS" then
        print("[puribooth]   FIX: PuriPhoto 1.1.0+ と ui/dist のproduction buildを確認してください。")
    end

    if phone:sub(1, 4) ~= "PASS" then
        print("[puribooth]   FIX: lb-phoneをFLEPURIより先に起動してください。")
    end

    if screenshot:sub(1, 4) ~= "PASS" then
        print("[puribooth]   FIX: screenshot-basicを起動してください。")
    end

    if payoutRequired and not payoutPass then
        print("[puribooth]   FIX: Renewed-Bankingとweazel会社口座の作成状態を確認してください。")
    end

    if database ~= "PASS" then
        print("[puribooth]   FIX: oxmysql接続とpuribooth_boothsの自動migration結果を確認してください。")
    end

    if accounting ~= "PASS" then
        print("[puribooth]   FIX: 各台の料金と lifetime_sales = balance + collected_total を確認してください。")
    end

    if config ~= "PASS" then
        print("[puribooth]   FIX: config.luaを確認してください。v1.0系のShotCountは4固定です。")
    end

    if refunds:sub(1, 4) ~= "PASS" then
        print("[puribooth]   FIX: puribooth_refunds / puribooth_retry_refunds で未解決返金を確認してください。")
    end

    if collections:sub(1, 4) ~= "PASS" then
        print("[puribooth]   FIX: puribooth_collections で未解決の会社売上回収を確認してください。")
    end

    if fonts:sub(1, 4) ~= "PASS" then
        print("[puribooth]   NOTE: フォントは任意導入です。未導入時はフォールバック書体で動作します。")
    end
end, false)

CreateThread(function()
    Wait(1500)

    local _, qbx = resourceCompatibilityState("qbx_core")
    local _, puriphoto = resourceCompatibilityState("puriphoto")

    print(("[puribooth] v1.0.3 starting (price=$%d, shots=%d, qbx_core=%s, puriphoto=%s)")
        :format(
            tonumber(Config.Price) or 0,
            tonumber(Config.ShotCount) or 4,
            qbx,
            puriphoto
        ))

    if qbx:sub(1, 4) ~= "PASS"
        or puriphoto:sub(1, 4) ~= "PASS" then
        print("[puribooth] WARNING incompatible dependency detected; paid sessions will remain blocked.")
    end
end)
