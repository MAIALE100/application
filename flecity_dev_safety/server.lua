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
local reloadRequestFile='games-reload.request'
local reloadAckFile='games-reload.ack'
local reloadActiveFile='games-reloader-v1.active'

local function cleanToken(value)
    return tostring(value or ''):gsub('%s+','')
end

local function readResourceFile(name)
    return LoadResourceFile(safetyResource,name) or ''
end

local function writeResourceFile(name,value)
    return SaveResourceFile(safetyResource,name,tostring(value or ''),-1)==true
end

writeResourceFile(reloadActiveFile,('version=2\nstarted=%s\n'):format(os.date('!%Y-%m-%dT%H:%M:%SZ')))

CreateThread(function()
    local handled=''
    while true do
        Wait(500)
        local token=cleanToken(readResourceFile(reloadRequestFile))
        if token~='' and token~=handled then
            handled=token
            writeResourceFile(reloadRequestFile,'')
            writeResourceFile(reloadAckFile,('token=%s\nstatus=refreshing\n'):format(token))
            local expectedBuild=cleanToken(LoadResourceFile('flecity_games','dev-build.txt') or '')
            print(('[Flecity DEV Safety] PLAY reload request %s: refresh'):format(token))
            ExecuteCommand('refresh')
            Wait(800)
            print('[Flecity DEV Safety] restarting flecity_games after metadata refresh')
            ExecuteCommand('restart flecity_games')

            local deadline=GetGameTimer()+20000
            local activated=false
            while GetGameTimer()<deadline do
                Wait(500)
                if GetResourceState('flecity_games')=='started' then
                    local runtime=LoadResourceFile('flecity_games','runtime-active.txt') or ''
                    local activeBuild=cleanToken(runtime:match('build=([^\r\n]+)') or '')
                    if expectedBuild~='' and activeBuild==expectedBuild then
                        local version=GetResourceMetadata('flecity_games','version',0) or 'unknown'
                        writeResourceFile(reloadAckFile,('token=%s\nstatus=started\nversion=%s\nbuild=%s\n'):format(token,version,activeBuild))
                        print(('[Flecity DEV Safety] flecity_games active: version=%s build=%s'):format(version,activeBuild))
                        activated=true
                        break
                    end
                end
            end
            if not activated then
                writeResourceFile(reloadAckFile,('token=%s\nstatus=timeout\nexpected_build=%s\n'):format(token,expectedBuild))
                print(('[Flecity DEV Safety] flecity_games reload was not verified for build=%s'):format(expectedBuild))
            end
        end
    end
end)
