local resourceName=GetCurrentResourceName()
local enabled=GetConvarInt('flecity_games:devAutoReload',0)==1
if not enabled then return end

local marker='dev-reload.token'
local lastToken=LoadResourceFile(resourceName,marker) or ''

CreateThread(function()
    print('[FlecityGames DEV] auto-reload watcher enabled')
    while true do
        Wait(1000)
        local token=LoadResourceFile(resourceName,marker) or ''
        if token~='' and token~=lastToken then
            lastToken=token
            print('[FlecityGames DEV] update marker changed; restarting flecity_games')
            SetTimeout(150,function()
                ExecuteCommand(('restart %s'):format(resourceName))
            end)
            return
        end
    end
end)
