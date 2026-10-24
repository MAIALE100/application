local RESOURCE = GetCurrentResourceName()

local function add(results, ok, name, detail)
    results[#results + 1] = {
        ok = ok == true,
        name = name,
        detail = detail,
    }
end

local function isVector(value)
    return type(value) == 'vector3'
end

local function runSelfTest()
    local results = {}

    add(results, GetResourceState('qbx_core') == 'started', 'qbx_core', GetResourceState('qbx_core'))
    add(results, Config.MoneyType == 'cash' or Config.MoneyType == 'bank' or Config.MoneyType == 'crypto', 'money type', tostring(Config.MoneyType))
    add(results, tonumber(Config.MaxRawOre) and Config.MaxRawOre > 0, 'raw capacity', tostring(Config.MaxRawOre))
    add(results, type(Config.Economy) == 'table', 'economy config', type(Config.Economy))
    add(results, Config.Economy and Config.MoneyType == Config.Economy.moneyType, 'economy money alias', tostring(Config.MoneyType))
    add(results, tonumber(Config.MiningDurationMs) and Config.MiningDurationMs >= 1000, 'mining duration', tostring(Config.MiningDurationMs))
    add(results, tonumber(Config.ProcessingDurationMs) and Config.ProcessingDurationMs >= 1000, 'processing duration', tostring(Config.ProcessingDurationMs))
    add(results, tonumber(Config.SellingDurationMs) and Config.SellingDurationMs >= 500, 'selling duration', tostring(Config.SellingDurationMs))
    local cooldown = tonumber(Config.NodeCooldownMs)
    add(results, cooldown and cooldown >= 0, 'node cooldown', tostring(Config.NodeCooldownMs))
    local tolerance = tonumber(Config.ServerDistanceTolerance)
    add(results, tolerance and tolerance > 0 and tolerance <= 20.0, 'server distance tolerance', tostring(Config.ServerDistanceTolerance))
    local yieldMin = Config.RawYield and tonumber(Config.RawYield.min)
    local yieldMax = Config.RawYield and tonumber(Config.RawYield.max)
    local yieldOk = yieldMin and yieldMax and yieldMin >= 1 and yieldMax >= yieldMin
        and yieldMin % 1 == 0 and yieldMax % 1 == 0
    add(results, yieldOk, 'raw yield range', ('%s-%s'):format(tostring(yieldMin), tostring(yieldMax)))
    add(results, isVector(Config.Foreman and Config.Foreman.coords), 'foreman coords', tostring(Config.Foreman and Config.Foreman.coords))
    add(results, isVector(Config.Processor and Config.Processor.coords), 'processor coords', tostring(Config.Processor and Config.Processor.coords))

    local nodeIds = {}
    local nodesOk = type(Config.MiningNodes) == 'table' and #Config.MiningNodes > 0
    if nodesOk then
        for _, node in ipairs(Config.MiningNodes) do
            if not node.id or nodeIds[node.id] or not isVector(node.coords) then
                nodesOk = false
                break
            end
            nodeIds[node.id] = true
        end
    end
    add(results, nodesOk, 'mining nodes', ('count=%s'):format(type(Config.MiningNodes) == 'table' and #Config.MiningNodes or 0))

    local productIds = {}
    local productsOk = type(Config.RefinedProducts) == 'table' and #Config.RefinedProducts > 0
    local weightTotal = 0
    if productsOk then
        for _, product in ipairs(Config.RefinedProducts) do
            local weight = tonumber(product.weight) or 0
            local value = tonumber(product.value) or -1
            if not product.id or productIds[product.id] or weight <= 0 or value < 0 then
                productsOk = false
                break
            end
            productIds[product.id] = true
            weightTotal = weightTotal + weight
        end
    end
    add(results, productsOk and weightTotal > 0, 'refined products', ('count=%s weight=%s'):format(
        type(Config.RefinedProducts) == 'table' and #Config.RefinedProducts or 0,
        weightTotal
    ))

    local passed = 0
    for _, row in ipairs(results) do
        if row.ok then passed = passed + 1 end
    end

    return passed == #results, passed, #results, results
end

local function printResults()
    local ok, passed, total, results = runSelfTest()

    print(('[%s] selftest %s (%d/%d)'):format(
        RESOURCE,
        ok and 'PASS' or 'FAIL',
        passed,
        total
    ))

    for _, row in ipairs(results) do
        print(('  [%s] %s - %s'):format(row.ok and 'PASS' or 'FAIL', row.name, tostring(row.detail or '')))
    end

    return ok, passed, total
end

RegisterCommand('mining_selftest', function(src)
    local ok, passed, total = printResults()

    if src > 0 then
        TriggerClientEvent('flecity_mining:client:notify', src, ('Mining selftest: %s (%d/%d)'):format(
            ok and 'PASS' or 'FAIL',
            passed,
            total
        ))
    end
end, false)

RegisterCommand('mining_healthcheck', function(src)
    local qbxState = GetResourceState('qbx_core')
    local version = GetResourceMetadata(RESOURCE, 'version', 0) or 'unknown'
    local message = ('Mining %s | qbx_core=%s | nodes=%d | products=%d'):format(
        version,
        qbxState,
        type(Config.MiningNodes) == 'table' and #Config.MiningNodes or 0,
        type(Config.RefinedProducts) == 'table' and #Config.RefinedProducts or 0
    )

    print(('[%s] %s'):format(RESOURCE, message))
    if src > 0 then
        TriggerClientEvent('flecity_mining:client:notify', src, message)
    end
end, false)

CreateThread(function()
    Wait(1500)
    printResults()
end)
