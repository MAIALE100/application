local sessions = {}
local sessionLocks = {}
local sourceSessionLocks = {}
local booths = {}
local databaseReady = false
local themeSerial = 0
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
        return false, "FAIL(resource)"
    end

    local index = LoadResourceFile(
        "puriphoto",
        "ui/dist/index.html"
    )

    if type(index) ~= "string" or #index < 100 then
        return false, "FAIL(ui-dist-index)"
    end

    local scriptPath =
        index:match('src=["\']([^"\']+%.js)["\']')

    if not scriptPath then
        return false, "FAIL(ui-dist-script)"
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
        return false, "FAIL(ui-dist-bundle)"
    end

    local hasImportNotice =
        bundle:find("boothImportAvailable", 1, true) ~= nil
    local hasImportCallback =
        bundle:find("puriphotoGetBoothImport", 1, true) ~= nil

    if not hasImportNotice or not hasImportCallback then
        return false, "FAIL(stale-ui-no-flepri-import)"
    end

    return true,
        ("PASS(index=%dB,bundle=%dB)")
            :format(#index, #bundle)
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

local function collectSales(source, target)
    if not requireManagementAccess(source, "sales")
        or not requireSalesLocation(source) then
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
        notify(source, "inform", "回収できる未回収売上はありません。")
        return
    end

    local claimed = {}
    local total = 0

    for _, row in ipairs(rows) do
        local boothId = tonumber(row.id)
        local amount = math.max(0, math.floor(tonumber(row.balance) or 0))

        if boothId and amount > 0 then
            local affected = MySQL.update.await([[
                UPDATE puribooth_booths
                SET balance = balance - ?
                WHERE id = ? AND balance >= ?
            ]], {
                amount,
                boothId,
                amount
            })

            if affected and affected > 0 then
                claimed[#claimed + 1] = {
                    id = boothId,
                    amount = amount
                }
                total = total + amount
            end
        end
    end

    if total <= 0 then
        notify(source, "inform", "他の担当者が先に売上を回収しました。")
        return
    end

    local paid, destination = addCompanyMoney(source, total)

    if not paid then
        for _, item in ipairs(claimed) do
            MySQL.update.await(
                "UPDATE puribooth_booths SET balance = balance + ? WHERE id = ?",
                { item.amount, item.id }
            )
        end

        notify(
            source,
            "error",
            ("売上回収を取り消しました: %s")
                :format(tostring(destination or "入金失敗"))
        )
        return
    end

    for _, item in ipairs(claimed) do
        MySQL.update.await([[
            UPDATE puribooth_booths
            SET
                collected_total = collected_total + ?,
                last_collected_at = NOW()
            WHERE id = ?
        ]], {
            item.amount,
            item.id
        })
    end

    notify(
        source,
        "inform",
        ("FLEPURI売上 $%d を %s へ回収しました。")
            :format(total, tostring(destination))
    )
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

local function recordCompletedSale(boothId, session, reason)
    boothId = tostring(boothId)

    if not session or session.saleRecorded then
        return true
    end

    local amount = math.max(0, math.floor(tonumber(session.paid) or 0))
    local affected = MySQL.update.await([[
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

    if not affected or affected < 1 then
        print(
            ("[puribooth] ERROR failed to record sale booth=%s amount=%d reason=%s")
                :format(
                    boothId,
                    amount,
                    tostring(reason or "capture-complete")
                )
        )
        return false
    end

    session.saleRecorded = true
    return true
end

local function refundSession(session, fallbackSource, reason)
    if not session then return false end

    local amount = math.max(0, math.floor(tonumber(session.paid) or 0))
    if amount <= 0 then return true end

    local identifier =
        session.refundIdentifier
        or fallbackSource
        or session.owner

    if not identifier then return false end

    local ok, added = pcall(function()
        return exports.qbx_core:AddMoney(
            identifier,
            session.moneyType or "cash",
            amount,
            reason or "puribooth-refund"
        )
    end)

    return ok and added == true
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

            releaseSession(activeBoothId)
        end
    end

    local existing = sessions[boothId]
    if existing and existing.expiresAt > os.time() then
        notify(source, "error", "このフレプリ台は使用中です。")
        return
    elseif existing then
        releaseSession(boothId)
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

    sessions[boothId] = {
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

    local recorded =
        recordCompletedSale(boothId, session, "capture-complete")

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

    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:technicalFailure", function(boothId)
    local source = source
    boothId = tostring(boothId)

    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

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

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if GetResourceState("qbx_core") ~= "started" then return end

    for _, session in pairs(sessions) do
        if session.paid and session.paid > 0 then
            refundSession(
                session,
                session.owner,
                "puribooth-resource-restart-refund"
            )
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
            if session.capturing then
                local recorded =
                    recordCompletedSale(
                        boothId,
                        session,
                        "player-dropped-after-capture-start"
                    )

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
    end
end)

CreateThread(function()
    while true do
        Wait(5000)

        local now = os.time()
        for boothId, session in pairs(sessions) do
            if session.expiresAt <= now then
                if session.paid and session.paid > 0 then
                    local refunded = refundSession(
                        session,
                        session.owner,
                        session.capturing
                            and "puribooth-capture-timeout-refund"
                            or "puribooth-setup-timeout-refund"
                    )

                    if GetPlayerName(session.owner) then
                        notify(
                            session.owner,
                            "error",
                            refunded
                                and (
                                    session.capturing
                                        and "撮影セッションがタイムアウトしたため料金を返金しました。"
                                        or "撮影準備時間が終了したため料金を返金しました。"
                                )
                                or "撮影セッションが終了しましたが返金に失敗しました。スタッフへお知らせください。"
                        )
                    end
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
    local config = configState()
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
        and config == "PASS"

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
    print(("[puribooth]   config=%s"):format(config))
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

    if config ~= "PASS" then
        print("[puribooth]   FIX: config.luaを確認してください。v1.0系のShotCountは4固定です。")
    end

    if fonts:sub(1, 4) ~= "PASS" then
        print("[puribooth]   NOTE: フォントは任意導入です。未導入時はフォールバック書体で動作します。")
    end
end, false)

CreateThread(function()
    Wait(1500)

    local _, qbx = resourceCompatibilityState("qbx_core")
    local _, puriphoto = resourceCompatibilityState("puriphoto")

    print(("[puribooth] v1.0.1 starting (price=$%d, shots=%d, qbx_core=%s, puriphoto=%s)")
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
