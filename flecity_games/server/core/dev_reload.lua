local resourceName=GetCurrentResourceName()
local enabledByConvar=GetConvarInt('flecity_games:devAutoReload',0)==1
local enabledByMarker=(LoadResourceFile(resourceName,'dev-auto-reload.enabled') or ''):match('^%s*1%s*$')~=nil
if not enabledByConvar and not enabledByMarker then return end

local marker='dev-reload.token'
local lastToken=LoadResourceFile(resourceName,marker) or ''

local function writeRuntimeStamp()
    local version=GetResourceMetadata(resourceName,'version',0) or 'unknown'
    local build=(LoadResourceFile(resourceName,'dev-build.txt') or 'unknown'):gsub('%s+','')
    local stamp=('version=%s\nbuild=%s\nstarted=%s\n'):format(version,build,os.date('!%Y-%m-%dT%H:%M:%SZ'))
    SaveResourceFile(resourceName,'dev-runtime.txt',stamp,-1)
end

writeRuntimeStamp()

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
