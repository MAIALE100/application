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

function FlecityGamesFramework.GetMoney(source,moneyType)
    if GetResourceState('qbx_core')~='started' then return nil end
    local ok,value=pcall(function()
        return exports.qbx_core:GetMoney(tonumber(source),tostring(moneyType or 'bank'))
    end)
    if not ok or value==false then return nil end
    return tonumber(value)
end

function FlecityGamesFramework.RemoveMoney(source,moneyType,amount,reason)
    if GetResourceState('qbx_core')~='started' then return false end
    local ok,result=pcall(function()
        return exports.qbx_core:RemoveMoney(
            tonumber(source),
            tostring(moneyType or 'bank'),
            math.floor(tonumber(amount) or 0),
            reason or 'flecity_games'
        )
    end)
    return ok and result==true
end

function FlecityGamesFramework.AddMoney(source,moneyType,amount,reason)
    if GetResourceState('qbx_core')~='started' then return false end
    local ok,result=pcall(function()
        return exports.qbx_core:AddMoney(
            tonumber(source),
            tostring(moneyType or 'bank'),
            math.floor(tonumber(amount) or 0),
            reason or 'flecity_games'
        )
    end)
    return ok and result==true
end

local function societyProvider(preferred)
    preferred=tostring(preferred or 'auto'):lower()
    if preferred=='auto' then
        if GetResourceState('Renewed-Banking')=='started' then return 'renewed-banking' end
        if GetResourceState('qb-banking')=='started' then return 'qb-banking' end
        return nil
    end
    if preferred=='renewed-banking' and GetResourceState('Renewed-Banking')=='started' then return preferred end
    if preferred=='qb-banking' and GetResourceState('qb-banking')=='started' then return preferred end
    return nil
end

function FlecityGamesFramework.AddSocietyMoney(accountName,amount,provider)
    local account=tostring(accountName or ''):gsub('^%s+',''):gsub('%s+$','')
    local value=math.floor(tonumber(amount) or 0)
    if account=='' or value<=0 then return false,nil end
    local selected=societyProvider(provider)
    if not selected then return false,nil end

    if selected=='renewed-banking' then
        local ok,result=pcall(function()
            return exports['Renewed-Banking']:addAccountMoney(account,value)
        end)
        return ok and result~=false,selected
    end

    if selected=='qb-banking' then
        local ok,result=pcall(function()
            return exports['qb-banking']:AddMoney(account,value,'PARTY+ subscription')
        end)
        return ok and result~=false,selected
    end

    return false,selected
end

function FlecityGamesFramework.RemoveSocietyMoney(accountName,amount,provider)
    local account=tostring(accountName or ''):gsub('^%s+',''):gsub('%s+$','')
    local value=math.floor(tonumber(amount) or 0)
    if account=='' or value<=0 then return false,nil end
    local selected=societyProvider(provider)
    if not selected then return false,nil end

    if selected=='renewed-banking' then
        local ok,result=pcall(function()
            return exports['Renewed-Banking']:removeAccountMoney(account,value)
        end)
        return ok and result~=false,selected
    end

    if selected=='qb-banking' then
        local ok,result=pcall(function()
            return exports['qb-banking']:RemoveMoney(account,value,'PARTY+ subscription rollback')
        end)
        return ok and result~=false,selected
    end

    return false,selected
end

-- Qbox emits this before the loaded character is removed from core memory.
-- Keep the framework-specific event name inside this adapter and expose a
-- framework-neutral lifecycle event to the rest of Flecity Games.
AddEventHandler('QBCore:Server:OnPlayerUnload', function(source)
    if GetResourceState('qbx_core')~='started' then return end
    local src=tonumber(source)
    if src then TriggerEvent('flecity_games:framework:playerUnloaded',src) end
end)
