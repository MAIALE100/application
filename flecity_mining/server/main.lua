local RESOURCE = GetCurrentResourceName()

local sessions = {}
local requestLocks = {}
local tokenSequence = 0

math.randomseed(os.time())
math.random(); math.random(); math.random()

local configReady = false
local configError = nil

local function validateRuntimeConfig()
    if Config.MoneyType ~= 'cash' and Config.MoneyType ~= 'bank' and Config.MoneyType ~= 'crypto' then
        return false, 'invalid MoneyType'
    end

    if type(Config.RefinedProducts) ~= 'table' or #Config.RefinedProducts == 0 then
        return false, 'refined products are empty'
    end

    local ids = {}
    local totalWeight = 0
    for index, product in ipairs(Config.RefinedProducts) do
        if type(product) ~= 'table' or not product.id or tostring(product.id) == '' then
            return false, ('product #%d has no id'):format(index)
        end
        if ids[product.id] then
            return false, ('duplicate product id: %s'):format(tostring(product.id))
        end
        ids[product.id] = true

        local weight = tonumber(product.weight)
        local value = tonumber(product.value)
        if not weight or weight <= 0 then
            return false, ('invalid weight for %s'):format(tostring(product.id))
        end
        if not value or value < 0 then
            return false, ('invalid value for %s'):format(tostring(product.id))
        end
        totalWeight = totalWeight + weight
    end

    if totalWeight <= 0 then return false, 'total product weight is zero' end

    local capacity = tonumber(Config.MaxRawOre)
    if not capacity or capacity < 1 or capacity % 1 ~= 0 then return false, 'invalid MaxRawOre' end

    local cooldown = tonumber(Config.NodeCooldownMs)
    if not cooldown or cooldown < 0 then return false, 'invalid NodeCooldownMs' end

    local miningDuration = tonumber(Config.MiningDurationMs)
    local processingDuration = tonumber(Config.ProcessingDurationMs)
    local sellingDuration = tonumber(Config.SellingDurationMs)
    if not miningDuration or miningDuration < 1000 then return false, 'invalid MiningDurationMs' end
    if not processingDuration or processingDuration < 1000 then return false, 'invalid ProcessingDurationMs' end
    if not sellingDuration or sellingDuration < 500 then return false, 'invalid SellingDurationMs' end

    local yieldMin = Config.RawYield and tonumber(Config.RawYield.min)
    local yieldMax = Config.RawYield and tonumber(Config.RawYield.max)
    if not yieldMin or not yieldMax or yieldMin < 1 or yieldMax < yieldMin
        or yieldMin % 1 ~= 0 or yieldMax % 1 ~= 0 then
        return false, 'invalid RawYield min/max'
    end

    local tolerance = tonumber(Config.ServerDistanceTolerance)
    if not tolerance or tolerance <= 0 or tolerance > 20.0 then
        return false, 'invalid ServerDistanceTolerance'
    end

    if not Config.Foreman or type(Config.Foreman.coords) ~= 'vector3' then return false, 'invalid Foreman coords' end
    if not Config.Processor or type(Config.Processor.coords) ~= 'vector3' then return false, 'invalid Processor coords' end
    if type(Config.MiningNodes) ~= 'table' or #Config.MiningNodes == 0 then return false, 'mining nodes are empty' end

    local nodeIds = {}
    local nodeCoords = {}
    for index, node in ipairs(Config.MiningNodes) do
        if type(node) ~= 'table' or node.id == nil then
            return false, ('mining node #%d has no id'):format(index)
        end
        if nodeIds[node.id] then
            return false, ('duplicate mining node id: %s'):format(tostring(node.id))
        end
        if type(node.coords) ~= 'vector3' then
            return false, ('invalid coords for mining node %s'):format(tostring(node.id))
        end

        -- Duplicate coordinates create two logical nodes at the same world
        -- position, allowing a player to alternate IDs and bypass per-node
        -- cooldowns. Treat near-identical configured positions as invalid.
        local coordKey = ('%.2f:%.2f:%.2f'):format(node.coords.x, node.coords.y, node.coords.z)
        if nodeCoords[coordKey] then
            return false, ('duplicate mining node coords: %s and %s'):format(
                tostring(nodeCoords[coordKey]), tostring(node.id)
            )
        end

        nodeIds[node.id] = true
        nodeCoords[coordKey] = node.id
    end

    return true
end

local function refreshConfigHealth()
    configReady, configError = validateRuntimeConfig()
    if not configReady then
        print(('[%s] CONFIG ERROR: %s. Player mining is disabled until configuration is fixed.'):format(
            RESOURCE, tostring(configError)
        ))
    end
end

refreshConfigHealth()

local function nowMs()
    return GetGameTimer()
end

local function notify(src, message)
    TriggerClientEvent('flecity_mining:client:notify', src, tostring(message))
end

local function getPlayerData(src)
    if GetResourceState('qbx_core') ~= 'started' then return nil end

    local ok, player = pcall(function()
        return exports.qbx_core:GetPlayer(src)
    end)

    if not ok or not player or not player.PlayerData then
        return nil
    end

    return player.PlayerData
end

local function getPlayerCoords(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

local function isNear(src, target, radius)
    local coords = getPlayerCoords(src)
    if not coords then return false end
    return #(coords - target) <= (radius or Config.ServerDistanceTolerance)
end

local function isPlayerAlive(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return false end

    local ok, health = pcall(GetEntityHealth, ped)
    if not ok or not health then return false end

    return health > 0
end

local function allowRequest(src, key, windowMs)
    local now = nowMs()
    requestLocks[src] = requestLocks[src] or {}

    local previous = requestLocks[src][key] or 0
    if now - previous < (windowMs or 350) then
        return false
    end

    requestLocks[src][key] = now
    return true
end

local function emptyRefined()
    local data = {}
    for _, product in ipairs(Config.RefinedProducts) do
        data[product.id] = 0
    end
    return data
end

local function refinedCount(session)
    local count = 0
    for _, amount in pairs(session.refined or {}) do
        count = count + math.max(0, tonumber(amount) or 0)
    end
    return count
end

local function makeSession(src)
    local pd = getPlayerData(src)
    if not pd or not pd.citizenid then
        return nil
    end

    return {
        citizenid = tostring(pd.citizenid),
        active = true,
        rawOre = 0,
        refined = emptyRefined(),
        nodeCooldowns = {},
        action = nil,
        startedAt = os.time(),
    }
end

local function getOwnedSession(src, notifyOnMismatch)
    local session = sessions[src]
    if not session then return nil end

    local pd = getPlayerData(src)
    if not pd or not pd.citizenid then
        -- QBox/player data can be briefly unavailable during framework or
        -- character transitions. Keep the session in memory, but never allow
        -- an action or payout until ownership can be verified again.
        return nil
    end

    local currentCitizenId = tostring(pd.citizenid)
    if currentCitizenId ~= tostring(session.citizenid) then
        print(('[%s] discarded stale mining session source=%s owner=%s current=%s'):format(
            RESOURCE,
            tostring(src),
            tostring(session.citizenid),
            currentCitizenId
        ))
        sessions[src] = nil
        requestLocks[src] = nil
        if notifyOnMismatch then
            notify(src, 'キャラクターが変更されたため、以前の鉱山作業を終了しました。受付から開始してください。')
        end
        return nil
    end

    return session
end

local function publicState(session)
    if not session then
        return {
            active = false,
            rawOre = 0,
            maxRawOre = Config.MaxRawOre,
            refined = emptyRefined(),
            refinedCount = 0,
            nodeCooldowns = {},
        }
    end

    local refined = {}
    for _, product in ipairs(Config.RefinedProducts) do
        refined[product.id] = tonumber(session.refined[product.id]) or 0
    end

    local cooldowns = {}
    local now = nowMs()
    for nodeId, cooldownUntil in pairs(session.nodeCooldowns or {}) do
        local remaining = math.max(0, (tonumber(cooldownUntil) or 0) - now)
        if remaining > 0 then
            cooldowns[tostring(nodeId)] = remaining
        end
    end

    return {
        active = session.active == true,
        rawOre = tonumber(session.rawOre) or 0,
        maxRawOre = Config.MaxRawOre,
        refined = refined,
        refinedCount = refinedCount(session),
        nodeCooldowns = cooldowns,
    }
end

local function syncState(src)
    local session = sessions[src] and getOwnedSession(src, true) or nil
    TriggerClientEvent('flecity_mining:client:state', src, publicState(session))
end

local function findNode(nodeId)
    nodeId = tonumber(nodeId)
    if not nodeId then return nil end

    for _, node in ipairs(Config.MiningNodes) do
        if tonumber(node.id) == nodeId then
            return node
        end
    end

    return nil
end

local function newToken(src, actionType)
    tokenSequence = tokenSequence + 1
    return ('%s:%s:%s:%s'):format(src, actionType, nowMs(), tokenSequence)
end

local function clearExpiredAction(session)
    if not session or not session.action then return end

    if nowMs() > session.action.expiresAt then
        session.action = nil
    end
end

local function beginAction(src, actionType, durationMs, targetCoords, data, label)
    if not configReady then
        notify(src, '鉱山設定に問題があるため作業を開始できません。運営へお知らせください。')
        return false
    end

    local session = getOwnedSession(src, true)
    if not session or not session.active then
        notify(src, '先に鉱山受付で作業を開始してください。')
        return false
    end

    clearExpiredAction(session)

    if session.action then
        notify(src, '別の作業中です。')
        return false
    end

    if not isPlayerAlive(src) then
        notify(src, '行動不能な状態では作業できません。')
        return false
    end

    if not isNear(src, targetCoords) then
        notify(src, '作業地点から離れすぎています。')
        return false
    end

    local token = newToken(src, actionType)
    local start = nowMs()

    session.action = {
        type = actionType,
        token = token,
        startedAt = start,
        minFinishAt = start + math.max(500, durationMs - 650),
        expiresAt = start + durationMs + 15000,
        target = targetCoords,
        data = data or {},
    }

    TriggerClientEvent('flecity_mining:client:actionApproved', src, {
        type = actionType,
        token = token,
        durationMs = durationMs,
        label = label,
    })

    return true
end

local function chooseProduct()
    local totalWeight = 0
    for _, product in ipairs(Config.RefinedProducts) do
        totalWeight = totalWeight + math.max(0, tonumber(product.weight) or 0)
    end

    if totalWeight <= 0 then
        return Config.RefinedProducts[1]
    end

    local roll = math.random(1, totalWeight)
    local cursor = 0

    for _, product in ipairs(Config.RefinedProducts) do
        cursor = cursor + math.max(0, tonumber(product.weight) or 0)
        if roll <= cursor then
            return product
        end
    end

    return Config.RefinedProducts[#Config.RefinedProducts]
end

local function finishMining(src, session, action)
    local node = findNode(action.data.nodeId)
    if not node then
        notify(src, '採掘地点の検証に失敗しました。')
        return
    end

    if not isNear(src, node.coords) then
        notify(src, '採掘地点から離れたため採掘を中止しました。')
        return
    end

    if session.rawOre >= Config.MaxRawOre then
        notify(src, '原石が満載です。選鉱設備へ運んでください。')
        return
    end

    local yield = math.random(Config.RawYield.min, Config.RawYield.max)
    yield = math.min(yield, Config.MaxRawOre - session.rawOre)

    session.rawOre = session.rawOre + yield
    session.nodeCooldowns[node.id] = nowMs() + Config.NodeCooldownMs

    notify(src, ('原石を %d 個採掘しました。 [%d/%d]'):format(yield, session.rawOre, Config.MaxRawOre))
end

local function finishProcessing(src, session, action)
    if not isNear(src, Config.Processor.coords) then
        notify(src, '選鉱設備から離れたため処理を中止しました。')
        return
    end

    local amount = math.min(
        math.max(0, tonumber(action.data.amount) or 0),
        math.max(0, tonumber(session.rawOre) or 0)
    )

    if amount <= 0 then
        notify(src, '処理できる原石がありません。')
        return
    end

    session.rawOre = session.rawOre - amount

    local summary = {}
    for _ = 1, amount do
        local product = chooseProduct()
        session.refined[product.id] = (session.refined[product.id] or 0) + 1
        summary[product.id] = (summary[product.id] or 0) + 1
    end

    local parts = {}
    for _, product in ipairs(Config.RefinedProducts) do
        local count = summary[product.id] or 0
        if count > 0 then
            parts[#parts + 1] = ('%s×%d'):format(product.label, count)
        end
    end

    notify(src, ('選鉱完了: %s'):format(table.concat(parts, ' / ')))
end

local function calculatePayout(session)
    local payout = 0
    local breakdown = {}

    for _, product in ipairs(Config.RefinedProducts) do
        local count = math.max(0, tonumber(session.refined[product.id]) or 0)
        if count > 0 then
            payout = payout + (count * math.max(0, tonumber(product.value) or 0))
            breakdown[#breakdown + 1] = {
                id = product.id,
                label = product.label,
                count = count,
                unitValue = math.max(0, tonumber(product.value) or 0),
            }
        end
    end

    return math.floor(payout), breakdown
end

local function finishSelling(src, session)
    if not isNear(src, Config.Foreman.coords) then
        notify(src, '受付から離れたため売却を中止しました。')
        return
    end

    local payout, breakdown = calculatePayout(session)
    if payout <= 0 then
        notify(src, '売却できる精製鉱石がありません。')
        return
    end

    local ok, result = pcall(function()
        return exports.qbx_core:AddMoney(src, Config.MoneyType, payout, Config.MoneyReason)
    end)

    if not ok or result == false then
        print(('[%s] AddMoney failed source=%s payout=%s result=%s'):format(
            RESOURCE, src, payout, tostring(result)
        ))
        notify(src, '報酬の支払いに失敗しました。鉱石は保持されています。')
        return
    end

    session.refined = emptyRefined()

    local detail = {}
    for _, row in ipairs(breakdown) do
        detail[#detail + 1] = ('%s×%d'):format(row.label, row.count)
    end

    notify(src, ('$%d を受け取りました。 (%s)'):format(payout, table.concat(detail, ' / ')))
end

RegisterNetEvent('flecity_mining:server:startShift', function()
    local src = source
    if not configReady then
        notify(src, '鉱山設定に問題があるため現在利用できません。運営へお知らせください。')
        return
    end
    if not allowRequest(src, 'startShift', 750) then return end

    if not isNear(src, Config.Foreman.coords) then
        return
    end

    -- Keep shift creation subject to the same authoritative life-state check
    -- as mining/processing/selling. A dead or incapacitated player should not
    -- be able to create a session by calling the server event directly.
    if not isPlayerAlive(src) then
        notify(src, '行動不能な状態では鉱山作業を開始できません。')
        return
    end

    if sessions[src] then
        local existing = getOwnedSession(src, true)
        if existing and existing.active then
            syncState(src)
            notify(src, 'すでに鉱山作業中です。')
            return
        end
    end

    local session = makeSession(src)
    if not session then
        notify(src, 'キャラクター情報を取得できませんでした。少し待って再度お試しください。')
        return
    end

    sessions[src] = session
    syncState(src)
    notify(src, '鉱山作業を開始しました。採掘地点で原石を集めてください。')
end)

RegisterNetEvent('flecity_mining:server:requestState', function()
    local src = source
    if not allowRequest(src, 'requestState', 300) then return end
    syncState(src)
end)

RegisterNetEvent('flecity_mining:server:beginMine', function(nodeId)
    local src = source
    if not allowRequest(src, 'beginMine', 500) then return end

    local session = getOwnedSession(src, true)
    if not session or not session.active then
        notify(src, '先に鉱山受付で作業を開始してください。')
        return
    end

    if session.rawOre >= Config.MaxRawOre then
        notify(src, '原石が満載です。選鉱設備へ運んでください。')
        return
    end

    local node = findNode(nodeId)
    if not node or not isNear(src, node.coords) then
        return
    end

    local cooldownUntil = session.nodeCooldowns[node.id] or 0
    local remaining = cooldownUntil - nowMs()
    if remaining > 0 then
        notify(src, ('この場所は崩した直後です。あと約 %d 秒待ってください。'):format(
            math.ceil(remaining / 1000)
        ))
        return
    end

    beginAction(
        src,
        'mine',
        Config.MiningDurationMs,
        node.coords,
        { nodeId = node.id },
        '採掘中'
    )
end)

RegisterNetEvent('flecity_mining:server:beginProcess', function()
    local src = source
    if not allowRequest(src, 'beginProcess', 500) then return end

    local session = getOwnedSession(src, true)
    if not session or not session.active then
        notify(src, '先に鉱山受付で作業を開始してください。')
        return
    end

    if session.rawOre <= 0 then
        notify(src, '処理する原石がありません。')
        return
    end

    beginAction(
        src,
        'process',
        Config.ProcessingDurationMs,
        Config.Processor.coords,
        { amount = session.rawOre },
        '選鉱中'
    )
end)

RegisterNetEvent('flecity_mining:server:beginSell', function()
    local src = source
    if not allowRequest(src, 'beginSell', 500) then return end

    local session = getOwnedSession(src, true)
    if not session or not session.active then
        notify(src, '先に鉱山受付で作業を開始してください。')
        return
    end

    if refinedCount(session) <= 0 then
        notify(src, '売却できる精製鉱石がありません。')
        return
    end

    beginAction(
        src,
        'sell',
        Config.SellingDurationMs,
        Config.Foreman.coords,
        {},
        '精算中'
    )
end)

RegisterNetEvent('flecity_mining:server:finishAction', function(token)
    local src = source
    if not allowRequest(src, 'finishAction', 250) then return end

    local session = getOwnedSession(src, true)
    if not configReady then
        if session and session.action then
            session.action = nil
        end
        notify(src, '鉱山設定に問題が検出されたため作業を中断しました。鉱石や報酬は変更されていません。')
        syncState(src)
        return
    end
    if not session or not session.action then
        return
    end

    local action = session.action
    if tostring(token or '') ~= action.token then
        return
    end

    if not isPlayerAlive(src) then
        session.action = nil
        notify(src, '行動不能になったため作業を中断しました。')
        syncState(src)
        return
    end

    local now = nowMs()
    if now < action.minFinishAt then
        print(('[%s] rejected early action source=%s type=%s delta=%sms'):format(
            RESOURCE, src, action.type, action.minFinishAt - now
        ))
        session.action = nil
        notify(src, '作業時間の検証に失敗しました。')
        syncState(src)
        return
    end

    if now > action.expiresAt then
        session.action = nil
        notify(src, '作業がタイムアウトしました。')
        syncState(src)
        return
    end

    session.action = nil

    if action.type == 'mine' then
        finishMining(src, session, action)
    elseif action.type == 'process' then
        finishProcessing(src, session, action)
    elseif action.type == 'sell' then
        finishSelling(src, session)
    end

    syncState(src)
end)

RegisterNetEvent('flecity_mining:server:cancelAction', function(token)
    local src = source
    local session = getOwnedSession(src, false)
    if not session or not session.action then return end

    if tostring(token or '') == session.action.token then
        session.action = nil
        syncState(src)
    end
end)

RegisterNetEvent('flecity_mining:server:endShift', function()
    local src = source
    if not allowRequest(src, 'endShift', 750) then return end

    local session = getOwnedSession(src, true)
    if not session then
        syncState(src)
        return
    end

    if not isNear(src, Config.Foreman.coords) then
        notify(src, '作業終了は鉱山受付で行ってください。')
        return
    end

    clearExpiredAction(session)
    if session.action then
        notify(src, '作業中は終了できません。作業完了後に受付でもう一度お試しください。')
        return
    end

    if session.rawOre > 0 or refinedCount(session) > 0 then
        notify(src, '未処理または未売却の鉱石があります。先に精算してください。')
        return
    end

    sessions[src] = nil
    syncState(src)
    notify(src, '鉱山作業を終了しました。')
end)

AddEventHandler('playerDropped', function()
    local src = source
    sessions[src] = nil
    requestLocks[src] = nil
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= RESOURCE then return end
    sessions = {}
    requestLocks = {}
end)

RegisterCommand('mining_configcheck', function(src)
    refreshConfigHealth()
    local message = configReady and 'Mining config: PASS' or ('Mining config: FAIL - ' .. tostring(configError))
    print(('[%s] %s'):format(RESOURCE, message))
    if src > 0 then notify(src, message) end
end, false)

RegisterCommand('mining_server_status', function(src)
    if src ~= 0 then return end

    local active = 0
    for _ in pairs(sessions) do
        active = active + 1
    end

    print(('[%s] active sessions: %d'):format(RESOURCE, active))
end, true)


local function economySnapshot()
    local totalWeight = 0
    local weightedValue = 0

    for _, product in ipairs(Config.RefinedProducts or {}) do
        local weight = math.max(0, tonumber(product.weight) or 0)
        local value = math.max(0, tonumber(product.value) or 0)
        totalWeight = totalWeight + weight
        weightedValue = weightedValue + (weight * value)
    end

    local expectedPerRaw = totalWeight > 0 and (weightedValue / totalWeight) or 0
    local expectedFullLoad = expectedPerRaw * math.max(0, tonumber(Config.MaxRawOre) or 0)

    return totalWeight, expectedPerRaw, expectedFullLoad
end

RegisterCommand('mining_economy', function(src)
    local totalWeight, expectedPerRaw, expectedFullLoad = economySnapshot()

    local lines = {
        ('Mining economy | weight=%d | expected/raw=$%.1f | expected/full-load=$%.1f'):format(
            totalWeight,
            expectedPerRaw,
            expectedFullLoad
        )
    }

    for _, product in ipairs(Config.RefinedProducts or {}) do
        local chance = totalWeight > 0 and ((math.max(0, tonumber(product.weight) or 0) / totalWeight) * 100) or 0
        lines[#lines + 1] = ('  %s (%s): %.1f%% | $%d each'):format(
            tostring(product.label or product.id),
            tostring(product.id),
            chance,
            math.floor(math.max(0, tonumber(product.value) or 0))
        )
    end

    for _, line in ipairs(lines) do
        print(('[%s] %s'):format(RESOURCE, line))
    end

    if src > 0 then
        notify(src, ('期待値: 原石1個 約$%.1f / 満載 約$%.1f'):format(expectedPerRaw, expectedFullLoad))
    end
end, false)
