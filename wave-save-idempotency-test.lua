-- WAVE save regression test: run with lua5.4 wave-save-idempotency-test.lua path/to/wave
local root = arg[1] or 'wave-check/wave'
local file = assert(io.open(root .. '/server/main.lua', 'rb'))
local source = file:read('*a')
file:close()

local function extract(name)
    local marker = 'local function ' .. name .. '('
    local start = assert(source:find(marker, 1, true), 'Missing ' .. name)
    local nextStart = source:find('\nlocal function ', start + #marker, true)
    return source:sub(start, nextStart and nextStart - 1 or #source) .. '\nreturn ' .. name
end

local function runCase(name, changed, exists, expectedOk, expectedError, expectSelect)
    local calls = {updates = 0, selects = 0}
    local env = setmetatable({
        WaveConfig = {Limits = {
            projectTitle = 80, projectJsonBytes = 65536,
            playlistName = 80, playlistDescription = 400, maxPlaylists = 20
        }},
        limited = function() return false end,
        getCitizenId = function() return 'owner-csn' end,
        clampText = function(value) return tostring(value or '') end,
        textLength = function(value) return #value end,
        encodeProject = function() return '{}', {title = 'Demo'}, nil end,
        json = {encode = function() return '{"title":"Demo"}' end},
        listOwnPlaylists = function() return {} end,
        MySQL = {
            update = {await = function(sql, params)
                calls.updates = calls.updates + 1
                assert(sql:find('citizenid=?', 1, true), 'Save update lacks owner condition')
                assert(sql:find('deleted_at IS NULL', 1, true), 'Save update lacks soft-delete condition')
                assert(params[#params] == 'owner-csn', 'Wrong owner passed to update')
                return changed
            end},
            scalar = {await = function(sql, params)
                calls.selects = calls.selects + 1
                assert(sql:find('citizenid=?', 1, true), 'Save existence query lacks owner condition')
                assert(sql:find('deleted_at IS NULL', 1, true), 'Save existence query lacks soft-delete condition')
                assert(params[#params] == 'owner-csn', 'Wrong owner passed to existence query')
                return exists
            end}
        }
    }, {__index = _G})
    local chunk = assert(load(extract(name), name, 't', env))
    local fn = chunk()
    local data = name == 'cbSaveProject'
        and {id = 123, title = 'Demo', project = {}}
        or {id = 123, name = 'Demo', description = '', isPublic = false}
    local result = fn(1, data)
    assert(result.ok == expectedOk, name .. ' returned wrong ok for changed=' .. tostring(changed))
    assert(result.error == expectedError, name .. ' returned wrong error for changed=' .. tostring(changed))
    assert(calls.updates == 1, name .. ' must issue exactly one UPDATE')
    assert(calls.selects == expectSelect, name .. ' must only query existence for no-op UPDATE')
    if expectedOk then assert(result.id == 123, name .. ' lost saved ID') end
end

for _, item in ipairs({
    {'cbSaveProject', 'PROJECT_NOT_FOUND'},
    {'cbSavePlaylist', 'PLAYLIST_NOT_FOUND'}
}) do
    local name, notFound = item[1], item[2]
    runCase(name, 1, 0, true, nil, 0)
    runCase(name, 0, 1, true, nil, 1)
    runCase(name, 0, 0, false, notFound, 1)
    runCase(name, nil, 1, false, 'DB_TRANSACTION_FAILED', 0)
    print('PASS: ' .. name .. ' changed/no-op/missing/DB-error and owner checks')
end
print('WAVE idempotent save tests: PASS')
