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


-- External development reloader for flecity_games.
-- This lives in a separate resource so it can refresh metadata before
-- restarting flecity_games after files are replaced on disk.
local safetyResource=GetCurrentResourceName()
local safetyRoot=GetResourcePath(safetyResource)
local reloadRequestPath=safetyRoot and (safetyRoot..'/games-reload.request') or nil
local reloadAckPath=safetyRoot and (safetyRoot..'/games-reload.ack') or nil
local reloadActivePath=safetyRoot and (safetyRoot..'/games-reloader-v1.active') or nil

local function readDiskFile(path)
    if not path then return '' end
    local file=io.open(path,'rb')
    if not file then return '' end
    local value=file:read('*a') or ''
    file:close()
    return value
end

local function writeDiskFile(path,value)
    if not path then return false end
    local file=io.open(path,'wb')
    if not file then return false end
    file:write(tostring(value or ''))
    file:close()
    return true
end

local function cleanToken(value)
    return tostring(value or ''):gsub('%s+','')
end

if reloadActivePath then
    writeDiskFile(reloadActivePath,('version=1\nstarted=%s\n'):format(os.date('!%Y-%m-%dT%H:%M:%SZ')))
end

CreateThread(function()
    local handled=''
    while true do
        Wait(500)
        local token=cleanToken(readDiskFile(reloadRequestPath))
        if token~='' and token~=handled then
            handled=token
            writeDiskFile(reloadRequestPath,'')
            writeDiskFile(reloadAckPath,('token=%s\nstatus=refreshing\n'):format(token))
            print(('[Flecity DEV Safety] PLAY reload request %s: refresh'):format(token))
            ExecuteCommand('refresh')
            Wait(800)
            print('[Flecity DEV Safety] restarting flecity_games after metadata refresh')
            ExecuteCommand('restart flecity_games')

            local deadline=GetGameTimer()+15000
            local activated=false
            while GetGameTimer()<deadline do
                Wait(500)
                if GetResourceState('flecity_games')=='started' then
                    local version=GetResourceMetadata('flecity_games','version',0) or 'unknown'
                    local build=cleanToken(LoadResourceFile('flecity_games','dev-build.txt') or 'unknown')
                    writeDiskFile(reloadAckPath,('token=%s\nstatus=started\nversion=%s\nbuild=%s\n'):format(token,version,build))
                    print(('[Flecity DEV Safety] flecity_games active: version=%s build=%s'):format(version,build))
                    activated=true
                    break
                end
            end
            if not activated then
                writeDiskFile(reloadAckPath,('token=%s\nstatus=timeout\n'):format(token))
                print('[Flecity DEV Safety] flecity_games did not reach started state after reload request')
            end
        end
    end
end)
