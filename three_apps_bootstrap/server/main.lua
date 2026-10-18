local managed = { 'puriphoto', 'photo_diary', 'frame' }

local function stripSqlComments(sql)
    local out = {}
    for line in tostring(sql or ''):gmatch('[^\r\n]+') do
        if not line:match('^%s*%-%-') then
            out[#out + 1] = line
        end
    end
    return table.concat(out, '\n')
end

local function splitStatements(sql)
    sql = stripSqlComments(sql)
    local statements = {}
    for statement in sql:gmatch('([^;]+);') do
        statement = statement:match('^%s*(.-)%s*$')
        if statement and statement ~= '' then
            statements[#statements + 1] = statement
        end
    end
    return statements
end

local function runSqlFile(path)
    local raw = LoadResourceFile(GetCurrentResourceName(), path)
    if not raw then error(('missing SQL file: %s'):format(path)) end

    for index, statement in ipairs(splitStatements(raw)) do
        local ok, err = pcall(function() MySQL.query.await(statement) end)
        if not ok then error(('SQL migration failed (%s #%d): %s'):format(path, index, tostring(err))) end
    end
end

local function restartManagedApps()
    for _, resource in ipairs(managed) do
        local state = GetResourceState(resource)
        if state == 'started' or state == 'starting' then
            StopResource(resource)
            Wait(250)
        end
        local started = StartResource(resource)
        print(('[3APPS] %s -> %s'):format(resource, tostring(started)))
    end
end

CreateThread(function()
    while GetResourceState('oxmysql') ~= 'started' or GetResourceState('lb-phone') ~= 'started' do
        Wait(500)
    end

    MySQL.ready(function()
        local ok, err = pcall(function()
            runSqlFile('sql/photo_diary.sql')
            runSqlFile('sql/frame.sql')
        end)

        if not ok then
            print(('[3APPS] database bootstrap FAILED: %s'):format(tostring(err)))
            return
        end

        print('[3APPS] database schema ready')
        restartManagedApps()
        print('[3APPS] PuriPhoto / Photo Diary / FRAME started')
    end)
end)
