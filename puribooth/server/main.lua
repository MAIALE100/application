local sessions = {}
local booths = {}
local databaseReady = false
local themeSerial = 0
local clearThemeRecipients

local function notify(source, kind, message)
    TriggerClientEvent("puribooth:client:notify", source, kind, message)
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
    broadcastBooths(-1)

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
    print(("[puribooth] v0.8.11 starting (price=$%d, shots=%d)")
        :format(tonumber(Config.Price) or 0, tonumber(Config.ShotCount) or 4))
end)
