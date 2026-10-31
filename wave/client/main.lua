local RESOURCE = GetCurrentResourceName()
local APP_ID = WaveConfig.App.identifier
local cacheBust = tostring(GetGameTimer())
local ownsApp = false

local function appData()
    local app = WaveConfig.App
    return {
        identifier = app.identifier,
        name = app.name,
        description = app.description,
        developer = app.developer,
        defaultApp = app.defaultApp,
        size = app.size,
        price = app.price,
        ui = RESOURCE .. '/' .. app.ui .. '?cb=' .. cacheBust,
        icon = ('https://cfx-nui-%s/%s'):format(RESOURCE, app.icon),
        fixBlur = app.fixBlur == true
    }
end

local function addApp()
    if GetResourceState('lb-phone') ~= 'started' then return false end
    local ok, success, err = pcall(function()
        return exports['lb-phone']:AddCustomApp(appData())
    end)
    if not ok then
        print(('[WAVE] AddCustomApp API error: %s'):format(tostring(success)))
        return false
    end
    if success then ownsApp = true return true end
    if err == 'APP_ALREADY_EXISTS' then
        -- Ownership is unknown. Never remove another resource's app by identifier.
        ownsApp = false
        print(('[WAVE] app identifier already registered: %s'):format(APP_ID))
        return false
    end
    print(('[WAVE] AddCustomApp failed: %s'):format(tostring(err)))
    return false
end

local function registerApp()
    for attempt = 1, 6 do
        if GetResourceState('lb-phone') == 'started' then
            Wait(attempt == 1 and 400 or 300)
            if addApp() then
                print(('[WAVE] LB Phone app ready (attempt %d)'):format(attempt))
                return
            end
        else
            Wait(500)
        end
    end
    print('[WAVE] LB Phone app registration failed after retries')
end

CreateThread(function()
    while GetResourceState('lb-phone') ~= 'started' do Wait(500) end
    registerApp()
end)

AddEventHandler('onResourceStart', function(resource)
    if resource == 'lb-phone' then CreateThread(registerApp) end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == 'lb-phone' then ownsApp = false return end
    if resource ~= RESOURCE or GetResourceState('lb-phone') ~= 'started' then return end
    if ownsApp then
        ownsApp = false
        pcall(function() exports['lb-phone']:RemoveCustomApp(APP_ID) end)
    end
end)

local callbackMap = {
    bootstrap = 'wave:bootstrap',
    createArtist = 'wave:createArtist',
    saveProject = 'wave:saveProject',
    listProjects = 'wave:listProjects',
    getProject = 'wave:getProject',
    deleteProject = 'wave:deleteProject',
    publishTrack = 'wave:publishTrack',
    listOwnTracks = 'wave:listOwnTracks',
    updateOwnTrack = 'wave:updateOwnTrack',
    listHome = 'wave:listHome',
    search = 'wave:search',
    listLibrary = 'wave:listLibrary',
    toggleFavorite = 'wave:toggleFavorite',
    artistDetail = 'wave:artistDetail',
    toggleFollow = 'wave:toggleFollow',
    listPlaylists = 'wave:listPlaylists',
    savePlaylist = 'wave:savePlaylist',
    getPlaylist = 'wave:getPlaylist',
    deletePlaylist = 'wave:deletePlaylist',
    addPlaylistTrack = 'wave:addPlaylistTrack',
    removePlaylistTrack = 'wave:removePlaylistTrack',
    listOwnAlbums = 'wave:listOwnAlbums',
    saveAlbum = 'wave:saveAlbum',
    deleteAlbum = 'wave:deleteAlbum',
    albumDetail = 'wave:albumDetail',
    purchaseTrack = 'wave:purchaseTrack',
    withdraw = 'wave:withdraw',
    reportTrack = 'wave:reportTrack',
    recordStream = 'wave:recordStream',
    adminOverview = 'wave:adminOverview',
    adminTrackAction = 'wave:adminTrackAction',
    adminArtistAction = 'wave:adminArtistAction',
    adminReportAction = 'wave:adminReportAction'
}

RegisterNUICallback('wave:callback', function(data, cb)
    if type(data) ~= 'table' then return cb({ok=false, error='INVALID_REQUEST'}) end
    local action = tostring(data.action or '')
    if action == 'bridgePing' then
        return cb({ok=true, resource=RESOURCE, lbPhoneState=GetResourceState('lb-phone')})
    end
    local callbackName = callbackMap[action]
    if not callbackName then return cb({ok=false, error='UNKNOWN_ACTION'}) end
    local ok, result = pcall(function()
        return exports['lb-phone']:AwaitCallback(callbackName, type(data.payload) == 'table' and data.payload or {})
    end)
    if not ok then
        print(('[WAVE] callback %s failed: %s'):format(callbackName, tostring(result)))
        return cb({ok=false, error='PHONE_CALLBACK_FAILED'})
    end
    cb(result or {ok=false, error='EMPTY_RESPONSE'})
end)
