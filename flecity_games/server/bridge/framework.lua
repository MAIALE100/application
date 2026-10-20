FlecityGamesFramework = FlecityGamesFramework or {}

local warned = {}

local function getQboxPlayerData(source)
    if GetResourceState('qbx_core') ~= 'started' then return nil end
    local src = tonumber(source)
    if not src then return nil end

    local ok, player = pcall(function() return exports.qbx_core:GetPlayer(src) end)
    if ok and player and player.PlayerData and player.PlayerData.citizenid then return player.PlayerData end

    local okList, list = pcall(function() return exports.qbx_core:GetPlayersData() end)
    if okList and type(list) == 'table' then
        for _, pd in pairs(list) do
            if type(pd) == 'table' and tonumber(pd.source) == src and pd.citizenid then return pd end
        end
    end

    if not warned[src] then
        warned[src] = true
        print(('[FlecityGames] Qbox player not ready for source=%s'):format(src))
    end
    return nil
end

function FlecityGamesFramework.IsReady()
    return GetResourceState('qbx_core') == 'started'
end

function FlecityGamesFramework.GetVersion()
    if GetResourceState('qbx_core')~='started' then return nil end
    local ok,version=pcall(function()
        return exports.qbx_core:GetCoreVersion(GetCurrentResourceName())
    end)
    if ok and version then return tostring(version) end
    return GetResourceMetadata('qbx_core','version',0)
end

function FlecityGamesFramework.GetIdentifier(source)
    if FlecityGamesConfig.Framework == 'auto' or FlecityGamesConfig.Framework == 'qbox' then
        local pd = getQboxPlayerData(source)
        return pd and pd.citizenid and tostring(pd.citizenid) or nil
    end
    return nil
end

function FlecityGamesFramework.GetCharacterName(source)
    local pd = getQboxPlayerData(source)
    local c = pd and pd.charinfo
    if not c then return ('Player %s'):format(source) end
    local name = ((c.firstname or '') .. ' ' .. (c.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
    return name ~= '' and name or ('Player %s'):format(source)
end
