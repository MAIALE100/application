function JamHasAccess(src, instrument)
    if JamConfig.Access == 'open' then return true end
    if JamConfig.Access == 'ace' then return IsPlayerAceAllowed(src, JamConfig.Ace) end
    if JamConfig.Access == 'ox_inventory' then
        local item = JamConfig.Items[instrument]
        if not item or GetResourceState('ox_inventory') ~= 'started' then return false end
        local ok, amount = pcall(function() return exports.ox_inventory:Search(src, 'count', item) end)
        return ok and type(amount) == 'number' and amount > 0
    end
    return false
end
