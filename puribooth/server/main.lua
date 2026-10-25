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
    if not session or session.owner ~= source then return end

    if session.paid and session.paid > 0 then
        exports.qbx_core:AddMoney(source, session.moneyType or "cash", session.paid, "puribooth-technical-refund")
        notify(source, "error", "撮影を開始できなかったため料金を返金しました。")
    end

    releaseSession(boothId)
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
