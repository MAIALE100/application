local RESOURCE = GetCurrentResourceName()
local TARGET = 'flecity_mining'
local REQUEST_FILE = 'reload.request'
local RESULT_FILE = 'last-result.txt'

local lastRequest = nil
local processing = false

local function trim(value)
    if type(value) ~= 'string' then return '' end
    return (value:gsub('^%s+', ''):gsub('%s+$', ''))
end

local function writeResult(token, status, detail)
    local line = table.concat({
        tostring(token or ''),
        tostring(status or 'UNKNOWN'),
        tostring(detail or ''),
        os.date('!%Y-%m-%dT%H:%M:%SZ'),
    }, '|')

    SaveResourceFile(RESOURCE, RESULT_FILE, line, #line)
end

local function runVerification()
    ExecuteCommand('mining_selftest')
    ExecuteCommand('mining_healthcheck')
    ExecuteCommand('mining_configcheck')
    ExecuteCommand('mining_economy')
end

local function handleRequest(token)
    if processing then return end
    processing = true

    print(('[%s] Reload request received: %s'):format(RESOURCE, token))

    ExecuteCommand(('restart %s'):format(TARGET))

    local deadline = GetGameTimer() + 12000
    while GetGameTimer() < deadline do
        Wait(250)
        if GetResourceState(TARGET) == 'started' then
            Wait(500)
            runVerification()
            writeResult(token, 'PASS', 'resource-started-and-verification-issued')
            print(('[%s] Reload complete: %s'):format(RESOURCE, token))
            processing = false
            return
        end
    end

    local state = GetResourceState(TARGET)
    writeResult(token, 'FAIL', ('resource-state=%s'):format(tostring(state)))
    print(('[%s] Reload failed: %s state=%s'):format(RESOURCE, token, tostring(state)))
    processing = false
end

CreateThread(function()
    print(('[%s] DEV bridge ready. Watching %s'):format(RESOURCE, REQUEST_FILE))

    while true do
        Wait(500)

        local raw = LoadResourceFile(RESOURCE, REQUEST_FILE)
        local token = trim(raw)

        if token ~= '' and token ~= lastRequest then
            lastRequest = token
            CreateThread(function()
                handleRequest(token)
            end)
        end
    end
end)
