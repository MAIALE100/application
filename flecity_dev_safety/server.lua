local function restoreNeeds(source)
    local player = exports.qbx_core and exports.qbx_core:GetPlayer(source)
    if not player then return end
    player.Functions.SetMetaData('hunger', 100)
    player.Functions.SetMetaData('thirst', 100)
    TriggerClientEvent('flecity_dev_safety:clientRestore', source)
end

RegisterNetEvent('flecity_dev_safety:restoreNeeds', function()
    restoreNeeds(source)
end)

CreateThread(function()
    while true do
        Wait(30000)
        for _, playerId in ipairs(GetPlayers()) do
            restoreNeeds(tonumber(playerId))
        end
    end
end)

AddEventHandler('QBCore:Server:PlayerLoaded', function(player)
    local source = player and player.PlayerData and player.PlayerData.source
    if source then restoreNeeds(source) end
end)

AddEventHandler('QBCore:Server:OnPlayerLoaded', function(source)
    restoreNeeds(tonumber(source))
end)
