-- Runs the production puribooth/server/main.lua against an in-memory MySQL
-- transaction adapter and a mock Renewed-Banking export. No real DB/bank is used.
local function copy(value)
    if type(value) ~= "table" then return value end
    local result = {}
    for key, item in pairs(value) do result[key] = copy(item) end
    return result
end

local Mock = {
    db = { booths = {}, collections = {} },
    bankBalance = 0,
    payoutCalls = 0,
    transactionCalls = 0,
    failTransactionCall = nil,
    failTransactionQuery = nil,
    bankBehavior = "success",
    beforeNextSingle = nil,
    duringPayout = nil,
    encoded = {},
    encodedSerial = 0,
    timer = 0,
    playerBuckets = { [10] = 0 },
}

local function norm(sql)
    return tostring(sql or ""):gsub("%s+", " "):lower()
end

local function collection(id, db)
    return (db or Mock.db).collections[tostring(id)]
end

local function unresolvedCount(db)
    local count = 0
    for _, row in pairs((db or Mock.db).collections) do
        if row.status ~= "resolved" and row.status ~= "rolled_back" then
            count = count + 1
        end
    end
    return count
end

local function applyUpdate(sql, values, db)
    local q = norm(sql)
    values = values or {}

    if q:find("update puribooth_collections", 1, true)
        and q:find("set status = ?, last_error = ?", 1, true)
        and q:find("last_error <=> ?", 1, true) then
        local row = collection(values[3], db)
        if not row or row.status ~= values[4] or row.last_error ~= values[5] then return 0 end
        row.status, row.last_error = values[1], values[2]
        return 1
    end

    if q:find("update puribooth_collections", 1, true)
        and q:find("set status = ?, last_error = ?", 1, true) then
        local row = collection(values[3], db)
        if not row or row.status ~= values[4] then return 0 end
        row.status, row.last_error = values[1], values[2]
        return 1
    end

    if q:find("update puribooth_collections", 1, true)
        and q:find("set status = 'finalizing', destination = ?", 1, true) then
        local row = collection(values[2], db)
        if not row or row.status ~= "paying" then return 0 end
        row.status, row.destination, row.last_error = "finalizing", values[1], nil
        return 1
    end

    if q:find("update puribooth_collections", 1, true)
        and q:find("set destination = ?", 1, true) then
        local row = collection(values[2], db)
        if not row then return 0 end
        row.destination = values[1]
        return 1
    end

    if q:find("update puribooth_collections", 1, true)
        and q:find("set status = 'rolled_back'", 1, true) then
        local row = collection(values[1], db)
        if not row then return 0 end
        if q:find("and status = 'preparing'", 1, true) and row.status ~= "preparing" then return 0 end
        row.status = "rolled_back"
        if q:find("atomic-claim-failed", 1, true) then row.last_error = "atomic-claim-failed" end
        return 1
    end

    error("Unhandled mock MySQL.update query: " .. q)
end

local function applyTransactionQuery(query, db)
    local q, values = norm(query.query), query.values or {}
    if q:find("update puribooth_booths", 1, true)
        and q:find("set balance = balance - ?", 1, true) then
        local booth = db.booths[tonumber(values[2])]
        if not booth or booth.balance < values[1] then return false end
        booth.balance = booth.balance - values[1]
        return true
    end
    if q:find("update puribooth_booths", 1, true)
        and q:find("set balance = balance + ?", 1, true) then
        local booth = db.booths[tonumber(values[2])]
        if not booth then return false end
        booth.balance = booth.balance + values[1]
        return true
    end
    if q:find("update puribooth_booths", 1, true)
        and q:find("set collected_total = collected_total + ?", 1, true) then
        local booth = db.booths[tonumber(values[2])]
        if not booth then return false end
        if q:find("and exists", 1, true) then
            local ledger = collection(values[3], db)
            if not ledger or ledger.status ~= "finalizing_retry" or ledger.last_error ~= values[4] then return true end
        end
        booth.collected_total = booth.collected_total + values[1]
        return true
    end
    if q:find("update puribooth_collections", 1, true)
        and q:find("set amount = ?", 1, true)
        and q:find("status = 'claimed'", 1, true) then
        local row = collection(values[3], db)
        if not row or row.status ~= "preparing" then return false end
        row.amount, row.allocations, row.status, row.last_error = values[1], values[2], "claimed", nil
        return true
    end
    if q:find("update puribooth_collections", 1, true)
        and q:find("set status = 'resolved'", 1, true) then
        local row = collection(values[1], db)
        if not row then return false end
        if q:find("finalizing_retry", 1, true) then
            if row.status ~= "finalizing_retry" or row.last_error ~= values[2] then return false end
        elseif row.status ~= "finalizing" then
            return false
        end
        row.status, row.last_error = "resolved", nil
        return true
    end
    if q:find("update puribooth_collections", 1, true)
        and q:find("set status = 'rolled_back'", 1, true) then
        local row = collection(values[1], db)
        if not row then return false end
        if q:find("restoring_retry", 1, true) then
            if row.status ~= "restoring_retry" or row.last_error ~= values[2] then return false end
        elseif row.status ~= "restoring" then
            return false
        end
        row.status, row.last_error = "rolled_back", nil
        return true
    end
    error("Unhandled mock transaction query: " .. q)
end

MySQL = {
    scalar = { await = function(sql)
        if norm(sql):find("from puribooth_collections", 1, true) then return unresolvedCount() end
        error("Unhandled mock MySQL.scalar query: " .. norm(sql))
    end },
    query = { await = function(sql, values)
        local q = norm(sql)
        if q:find("from puribooth_booths", 1, true) then
            local rows = {}
            for _, booth in pairs(Mock.db.booths) do
                if booth.balance > 0 and (not values or #values == 0 or booth.id == tonumber(values[1])) then
                    rows[#rows + 1] = { id = booth.id, balance = booth.balance }
                end
            end
            table.sort(rows, function(a, b) return a.id < b.id end)
            return rows
        end
        error("Unhandled mock MySQL.query query: " .. q)
    end },
    insert = { await = function(sql, values)
        if not norm(sql):find("insert into puribooth_collections", 1, true) then
            error("Unhandled mock MySQL.insert query")
        end
        local id = tostring(values[1])
        if Mock.db.collections[id] then return nil end
        Mock.db.collections[id] = {
            collection_id = id,
            collector_citizenid = values[2],
            target = values[3],
            amount = 0,
            allocations = "[]",
            status = "preparing",
            last_error = nil,
        }
        return #Mock.db.collections
    end },
    update = { await = function(sql, values) return applyUpdate(sql, values, Mock.db) end },
    single = { await = function(sql, values)
        local id = values and values[1]
        local row = collection(id)
        local selected = row and copy(row) or nil
        if Mock.beforeNextSingle then
            local callback = Mock.beforeNextSingle
            Mock.beforeNextSingle = nil
            callback(id)
        end
        return selected
    end },
    transaction = { await = function(queries)
        Mock.transactionCalls = Mock.transactionCalls + 1
        local callNumber = Mock.transactionCalls
        if Mock.failTransactionCall == callNumber then return false end
        local pending = copy(Mock.db)
        for index, query in ipairs(queries) do
            if Mock.failTransactionQuery == index then
                Mock.failTransactionQuery = nil
                return false
            end
            if not applyTransactionQuery(query, pending) then return false end
        end
        Mock.db = pending
        return true
    end },
}

local players = {
    [10] = { PlayerData = { citizenid = "mock-owner", job = { name = "weazel", grade = { level = 3 } } } }
}
local qbx = {
    GetPlayer = function(_, source) return players[source] end,
    GetJob = function(_, job)
        if job ~= "weazel" and job ~= "reporter" then return nil end
        return { grades = { ["0"] = {}, ["1"] = {}, ["3"] = {} } }
    end,
}
local bank = {
    getAccountMoney = function() return Mock.bankBalance end,
    addAccountMoney = function(_, account, amount)
        assert(account == "weazel", "payout uses the configured company account")
        Mock.payoutCalls = Mock.payoutCalls + 1
        if Mock.duringPayout then Mock.duringPayout() end
        if Mock.bankBehavior == "failure" then return false end
        Mock.bankBalance = Mock.bankBalance + amount
        if Mock.bankBehavior == "response_lost" then error("simulated bank response loss") end
        return true
    end,
    handleTransaction = function() return true end,
}
exports = setmetatable({ qbx_core = qbx }, { __index = function(_, name)
    if name == "Renewed-Banking" then return bank end
    return {}
end })

json = {
    encode = function(value)
        Mock.encodedSerial = Mock.encodedSerial + 1
        local key = "mock-json:" .. Mock.encodedSerial
        Mock.encoded[key] = copy(value)
        return key
    end,
    decode = function(value)
        local decoded = Mock.encoded[tostring(value)]
        if not decoded then error("unknown mock JSON value") end
        return copy(decoded)
    end,
}

local commands = {}
RegisterCommand = function(name, callback) commands[name] = callback end
RegisterNetEvent = function() end
AddEventHandler = function() end
CreateThread = function() end
SetTimeout = function() end
TriggerClientEvent = function() end
GetResourceState = function() return "started" end
GetPlayerRoutingBucket = function(source) return Mock.playerBuckets[source] end
GetGameTimer = function() Mock.timer = Mock.timer + 1; return Mock.timer end
GetPlayerName = function() return "Mock owner" end
GetPlayers = function() return { "10" } end
GetCurrentResourceName = function() return "puribooth" end
GetResourceMetadata = function() return nil end

-- @PRODUCTION_MAIN_LOADER@
loadProductionMain()

local passed = 0
local function check(name, callback)
    local ok, err = xpcall(callback, debug.traceback)
    if not ok then
        io.stderr:write("FAIL " .. name .. "\n" .. tostring(err) .. "\n")
        os.exit(1)
    end
    passed = passed + 1
    print("PASS " .. name)
end

local function reset(balance)
    Mock.db = { booths = { [1] = { id = 1, balance = balance or 600, collected_total = 200 } }, collections = {} }
    Mock.bankBalance, Mock.payoutCalls, Mock.transactionCalls = 0, 0, 0
    Mock.failTransactionCall, Mock.failTransactionQuery = nil, nil
    Mock.bankBehavior, Mock.beforeNextSingle, Mock.duringPayout = "success", nil, nil
    Mock.encoded, Mock.encodedSerial, Mock.timer = {}, 0, 0
end

local function startCollection()
    commands.puribooth(10, { "collect", "all" })
end

local function onlyCollection()
    for _, row in pairs(Mock.db.collections) do return row end
    error("expected a collection ledger row")
end

local function putRecovery(status, lastError)
    Mock.encoded["fixture-allocation"] = { { id = 1, amount = 600 } }
    Mock.db.collections["fixture-collection"] = {
        collection_id = "fixture-collection", target = "all", amount = 600,
        allocations = "fixture-allocation", status = status, last_error = lastError,
    }
end

check("routing bucket helpers isolate booths and sessions across instances", function()
    Mock.playerBuckets[10], Mock.playerBuckets[11] = 0, 25
    local booth = { routingBucket = 0 }
    local session = { routingBucket = 0 }
    assert(FlecityTestHooks.playerInBoothBucket(10, booth))
    assert(not FlecityTestHooks.playerInBoothBucket(11, booth))
    assert(FlecityTestHooks.playerInSessionBucket(10, session, booth))
    assert(not FlecityTestHooks.playerInSessionBucket(11, session, booth))
    Mock.playerBuckets[11] = nil
end)

check("normal collection pays once and atomically finalizes ledger and booth", function()
    reset()
    startCollection()
    local row = onlyCollection()
    assert(row.status == "resolved")
    assert(row.amount == 600 and row.destination == "weazel")
    assert(Mock.db.booths[1].balance == 0 and Mock.db.booths[1].collected_total == 800)
    assert(Mock.bankBalance == 600 and Mock.payoutCalls == 1)
end)

check("definitive bank failure restores booth balance without payout", function()
    reset()
    Mock.bankBehavior = "failure"
    startCollection()
    local row = onlyCollection()
    assert(row.status == "rolled_back")
    assert(Mock.db.booths[1].balance == 600 and Mock.db.booths[1].collected_total == 200)
    assert(Mock.bankBalance == 0 and Mock.payoutCalls == 1)
end)

check("claim transaction failing midway leaves every booth balance unchanged", function()
    reset()
    Mock.failTransactionQuery = 2
    startCollection()
    local row = onlyCollection()
    assert(row.status == "rolled_back" and row.last_error == "atomic-claim-failed")
    assert(Mock.db.booths[1].balance == 600 and Mock.db.booths[1].collected_total == 200)
    assert(Mock.bankBalance == 0 and Mock.payoutCalls == 0)
end)

check("bank success with lost response stays paying and never auto-pays again", function()
    reset()
    Mock.bankBehavior = "response_lost"
    startCollection()
    local row = onlyCollection()
    assert(row.status == "paying")
    assert(Mock.db.booths[1].balance == 0 and Mock.db.booths[1].collected_total == 200)
    assert(Mock.bankBalance == 600 and Mock.payoutCalls == 1)
    commands.puribooth_collection_retry(0, { row.collection_id })
    assert(Mock.bankBalance == 600 and Mock.payoutCalls == 1)
    commands.puribooth_collection_review(0, { row.collection_id, "paid" })
    row = collection(row.collection_id)
    assert(row.status == "resolved" and Mock.db.booths[1].collected_total == 800)
    assert(Mock.bankBalance == 600 and Mock.payoutCalls == 1)
end)

check("finalize DB failure can be retried once without a second payout", function()
    reset()
    Mock.failTransactionCall = 2
    startCollection()
    local row = onlyCollection()
    assert(row.status == "finalizing" and Mock.bankBalance == 600 and Mock.payoutCalls == 1)
    commands.puribooth_collection_retry(0, { row.collection_id })
    row = collection(row.collection_id)
    assert(row.status == "resolved" and Mock.db.booths[1].collected_total == 800)
    commands.puribooth_collection_retry(0, { row.collection_id })
    assert(row.status == "resolved" and Mock.db.booths[1].collected_total == 800)
    assert(Mock.bankBalance == 600 and Mock.payoutCalls == 1)
end)

check("restore failure remains recoverable and does not double-credit booth", function()
    reset()
    Mock.bankBehavior = "failure"
    Mock.failTransactionCall = 2
    startCollection()
    local row = onlyCollection()
    assert(row.status == "restoring" and Mock.db.booths[1].balance == 0)
    commands.puribooth_collection_retry(0, { row.collection_id })
    row = collection(row.collection_id)
    assert(row.status == "rolled_back" and Mock.db.booths[1].balance == 600)
    commands.puribooth_collection_retry(0, { row.collection_id })
    assert(Mock.db.booths[1].balance == 600 and Mock.bankBalance == 0 and Mock.payoutCalls == 1)
end)

check("reentrant retry is blocked while another recovery holds the lock", function()
    reset()
    putRecovery("finalizing", "needs-finalize")
    Mock.beforeNextSingle = function(id)
        commands.puribooth_collection_retry(0, { id })
    end
    commands.puribooth_collection_retry(0, { "fixture-collection" })
    local row = collection("fixture-collection")
    assert(row.status == "resolved" and Mock.db.booths[1].collected_total == 800)
    assert(Mock.db.booths[1].balance == 600 and Mock.bankBalance == 0 and Mock.payoutCalls == 0)
end)

check("normal collection cannot overlap recovery during bank call", function()
    reset()
    Mock.duringPayout = function()
        commands.puribooth_collection_retry(0, { "missing-id" })
    end
    startCollection()
    assert(onlyCollection().status == "resolved")
    assert(Mock.bankBalance == 600 and Mock.payoutCalls == 1)
end)

check("restart during ambiguous bank state requires reconciliation, not another payout", function()
    reset()
    Mock.bankBehavior = "response_lost"
    startCollection()
    local row = onlyCollection()
    assert(row.status == "paying" and Mock.bankBalance == 600 and Mock.payoutCalls == 1)
    -- Loading the actual resource script again resets in-memory flags but keeps mock DB/bank state.
    loadProductionMain()
    commands.puribooth_collection_retry(0, { row.collection_id })
    assert(row.status == "paying" and Mock.bankBalance == 600 and Mock.payoutCalls == 1)
    commands.puribooth_collection_review(0, { row.collection_id, "paid" })
    row = collection(row.collection_id)
    assert(row.status == "resolved" and Mock.bankBalance == 600 and Mock.payoutCalls == 1)
end)

check("unresolved ledger blocks new collection and survives a resource reload", function()
    reset()
    putRecovery("paying", "bank-outcome-unknown")
    loadProductionMain()
    local before = Mock.bankBalance
    startCollection()
    assert(next(Mock.db.collections) == "fixture-collection")
    assert(Mock.bankBalance == before and Mock.payoutCalls == 0)
end)

print(("FLEPURI isolated accounting integration: %d/%d PASS"):format(passed, passed))
