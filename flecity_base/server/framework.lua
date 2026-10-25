FlecityBaseFramework = FlecityBaseFramework or {}

local warned = {}

local function getPlayerData(source)
    if GetResourceState('qbx_core') ~= 'started' then return nil end
    local src = tonumber(source)
    if not src then return nil end

    local ok, player = pcall(function()
        return exports.qbx_core:GetPlayer(src)
    end)
    if ok and player and player.PlayerData and player.PlayerData.citizenid then
        return player.PlayerData
    end

    local okList, list = pcall(function()
        return exports.qbx_core:GetPlayersData()
    end)
    if okList and type(list) == 'table' then
        for _, pd in pairs(list) do
            if type(pd) == 'table' and tonumber(pd.source) == src and pd.citizenid then
                return pd
            end
        end
    end

    if not warned[src] then
        warned[src] = true
        print(('[BASE] QBox player data is not ready for source=%s'):format(src))
    end
    return nil
end

function FlecityBaseFramework.IsReady()
    return GetResourceState('qbx_core') == 'started'
end

function FlecityBaseFramework.GetIdentifier(source)
    local pd = getPlayerData(source)
    return pd and pd.citizenid and tostring(pd.citizenid) or nil
end

function FlecityBaseFramework.GetCharacterName(source)
    local pd = getPlayerData(source)
    if not pd then return ('Player %s'):format(tostring(source)) end
    local c = pd.charinfo or {}
    local name = ((c.firstname or '') .. ' ' .. (c.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
    return name ~= '' and name or ('Player %s'):format(tostring(source))
end
