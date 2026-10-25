local sessions = {}

local function getBooth(boothId)
    if type(boothId) ~= "string" then return nil end
    return Config.Booths and Config.Booths[boothId] or nil
end

local function notify(source, kind, message)
    TriggerClientEvent("puribooth:client:notify", source, kind, message)
end

local function playerNearBooth(source, booth)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return false end

    local coords = GetEntityCoords(ped)
    local boothCoords = vector3(booth.coords.x, booth.coords.y, booth.coords.z)
    return #(coords - boothCoords) <= 7.0
end

local function broadcastState(boothId)
    local session = sessions[boothId]
    TriggerClientEvent("puribooth:client:sessionState", -1, boothId, session and {
        owner = session.owner,
        capturing = session.capturing,
        expiresAt = session.expiresAt
    } or false)
end

local function releaseSession(boothId)
    if not sessions[boothId] then return end
    sessions[boothId] = nil
    broadcastState(boothId)
end

RegisterNetEvent("puribooth:server:startSession", function(boothId)
    local source = source
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
                local paid = exports.qbx_core:RemoveMoney(source, moneyType, price, "puribooth-session")
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
        expiresAt = os.time() + math.max(30, tonumber(Config.SessionTimeoutSeconds) or 120)
    }

    broadcastState(boothId)
    TriggerClientEvent("puribooth:client:sessionOpened", source, boothId, sessions[boothId].expiresAt)
end)

RegisterNetEvent("puribooth:server:beginCapture", function(boothId)
    local source = source
    local booth = getBooth(boothId)
    local session = sessions[boothId]

    if not booth or not session or session.owner ~= source then
        return
    end

    if session.capturing then return end
    if session.expiresAt <= os.time() then
        releaseSession(boothId)
        notify(source, "error", "撮影準備時間が終了しました。")
        return
    end

    if not playerNearBooth(source, booth) then
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
    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

    shotIndex = math.max(1, math.min(tonumber(Config.ShotCount) or 4, math.floor(tonumber(shotIndex) or 1)))
    TriggerClientEvent("puribooth:client:countdown", -1, boothId, shotIndex)
end)

RegisterNetEvent("puribooth:server:captureComplete", function(boothId)
    local source = source
    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end
    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:finishSession", function(boothId)
    local source = source
    local session = sessions[boothId]
    if not session or session.owner ~= source then return end
    releaseSession(boothId)
end)

RegisterNetEvent("puribooth:server:technicalFailure", function(boothId)
    local source = source
    local session = sessions[boothId]
    if not session or session.owner ~= source or not session.capturing then return end

    -- A failed client capture is refundable, but only while a real capture
    -- session is active. Every refund is logged through the Qbox money reason.
    if session.paid and session.paid > 0 then
        exports.qbx_core:AddMoney(source, session.moneyType or "cash", session.paid, "puribooth-technical-refund")
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

    local boothCount = 0
    for _ in pairs(Config.Booths or {}) do boothCount = boothCount + 1 end

    local qbx = resourceState("qbx_core")
    local phone = resourceState("lb-phone")
    local screenshot = resourceState("screenshot-basic")
    local overall = qbx == "PASS" and phone == "PASS" and screenshot == "PASS" and boothCount > 0

    print(("[puribooth] selftest %s (qbx_core=%s, lb-phone=%s, screenshot-basic=%s, booths=%d)")
        :format(overall and "PASS" or "FAIL", qbx, phone, screenshot, boothCount))

    if screenshot ~= "PASS" then
        print("[puribooth] screenshot-basic is required for automatic fixed-camera booth photos.")
    end
end, false)

CreateThread(function()
    Wait(1000)
    local boothCount = 0
    for _ in pairs(Config.Booths or {}) do boothCount = boothCount + 1 end
    print(("[puribooth] v0.1.0 ready (booths=%d, price=$%d, shots=%d)")
        :format(boothCount, tonumber(Config.Price) or 0, tonumber(Config.ShotCount) or 4))
end)
