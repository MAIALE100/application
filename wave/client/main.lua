local RESOURCE = GetCurrentResourceName()
local APP_ID = WaveConfig.App.identifier
local cacheBust = tostring(GetGameTimer())
local ownsApp = false
local screen = nil
local pendingReturn = nil
local lastReturned = nil
local screenSerial = 0
local function releaseScreenFocus()
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
end
local function phoneHidden()
    local openOk, open = pcall(function() return exports['lb-phone']:IsOpen() end)
    local visibleOk, visible = pcall(function() return exports['lb-phone']:IsPhoneOnScreen() end)
    return openOk and visibleOk and open == false and visible == false
end
local function closePhoneAndWait()
    local ok = pcall(function() exports['lb-phone']:ToggleOpen(false) end)
    if not ok then return false end
    for _ = 1, 30 do
        if phoneHidden() then return true end
        Wait(100)
    end
    -- A partially visible handset may remain after closing; use the documented
    -- LB Phone export before giving the independent NUI mouse focus.
    pcall(function() exports['lb-phone']:SetPhonePartiallyVisible(0) end)
    for _ = 1, 10 do
        if phoneHidden() then return true end
        Wait(100)
    end
    return false
end
local function restorePhone(lease)
    pcall(function() exports['lb-phone']:ToggleOpen(true) end)
    CreateThread(function()
        for _ = 1, 20 do
            local ok, open = pcall(function() return exports['lb-phone']:IsOpen() end)
            if ok and open then break end
            Wait(100)
        end
        if pendingReturn and pendingReturn.lease == lease then
            pcall(function() exports['lb-phone']:SendCustomAppMessage(APP_ID, {type='waveScreenReturn'}) end)
        end
    end)
end

RegisterNetEvent('lb-phone:phoneToggled', function(open)
    if open == true and screen and screen.ready then
        CreateThread(function()
            if closePhoneAndWait() and screen and screen.ready then
                SetNuiFocus(true, true)
                SetNuiFocusKeepInput(false)
            end
        end)
    end
end)

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
    if resource == RESOURCE and (screen or pendingReturn) then
        local ownedFocus = screen and screen.ready
        screen = nil
        pendingReturn = nil
        if ownedFocus then releaseScreenFocus() end
        SendNUIMessage({type = 'waveScreenHide'})
    end
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
    local payload = type(data.payload) == 'table' and data.payload or {}
    local expanded = data.surface == 'expanded'
    if action:sub(1, 10) == 'waveScreen' then
        if action == 'waveScreenStatus' then return cb({ok=true, owner=screen and 'expanded' or 'phone'}) end
        if action == 'waveScreenClaim' and not expanded then
            if pendingReturn then return cb({ok=true, state=pendingReturn.state, lease=pendingReturn.lease}) end
            return cb({ok=true, parked=screen ~= nil})
        end
        if action == 'waveScreenReturned' and not expanded then
            if lastReturned and lastReturned.lease == payload.lease then return cb({ok=true}) end
            if pendingReturn and pendingReturn.lease == payload.lease then
                lastReturned = {lease=pendingReturn.lease}
                pendingReturn = nil
                return cb({ok=true})
            end
        end
        if action == 'waveScreenOpen' and not expanded and not screen and not pendingReturn and GetResourceState('lb-phone') == 'started' then
            if type(payload.state) ~= 'table' or #json.encode(payload.state) > 1048576 then return cb({ok=false, error='INVALID_STATE'}) end
            screenSerial = screenSerial + 1
            screen = {lease=tostring(GetGameTimer()) .. '-' .. screenSerial, state=payload.state, ready=false}
            SendNUIMessage({type='waveScreenOpen', lease=screen.lease, state=screen.state})
            local currentLease = screen.lease
            CreateThread(function()
                Wait(15000)
                if screen and screen.lease == currentLease and not screen.ready then
                    pendingReturn = screen
                    screen = nil
                    SendNUIMessage({type='waveScreenHide'})
                    pcall(function() exports['lb-phone']:SendCustomAppMessage(APP_ID, {type='waveScreenRestore'}) end)
                end
            end)
            return cb({ok=true, lease=screen.lease})
        end
        if screen and expanded and payload.lease == screen.lease then
            if action == 'waveScreenReady' and screen.ready then return cb({ok=true}) end
            if action == 'waveScreenReady' and not screen.ready then
                local currentLease = screen.lease
                CreateThread(function()
                    if not closePhoneAndWait() then
                        if screen and screen.lease == currentLease then
                            pendingReturn = screen
                            screen = nil
                            SendNUIMessage({type='waveScreenHide'})
                            restorePhone(currentLease)
                        end
                        print('[WAVE] expanded handoff aborted: LB Phone did not close')
                        return cb({ok=false, error='PHONE_STILL_VISIBLE'})
                    end
                    if not screen or screen.lease ~= currentLease then return cb({ok=false, error='SCREEN_LEASE_MISMATCH'}) end
                    screen.ready = true
                    screen.state = nil
                    SetNuiFocus(true, true)
                    SetNuiFocusKeepInput(false)
                    print('[WAVE] expanded handoff ready')
                    cb({ok=true})
                end)
                return
            end
            if action == 'waveScreenFailed' and not screen.ready then
                pendingReturn = screen
                screen = nil
                SendNUIMessage({type='waveScreenHide'})
                restorePhone(pendingReturn.lease)
                print('[WAVE] expanded bootstrap failed; phone state retained')
                return cb({ok=true})
            end
            if action == 'waveScreenClose' and screen.ready and type(payload.state) == 'table' and #json.encode(payload.state) <= 1048576 then
                pendingReturn = {lease=screen.lease, state=payload.state}
                screen = nil
                releaseScreenFocus()
                SendNUIMessage({type='waveScreenHide'})
                restorePhone(pendingReturn.lease)
                return cb({ok=true})
            end
        end
        return cb({ok=false, error='SCREEN_LEASE_MISMATCH'})
    end
    if screen then
        if not expanded or data.lease ~= screen.lease or (not screen.ready and action ~= 'bootstrap') then return cb({ok=false, error='APP_SUSPENDED'}) end
    elseif expanded or pendingReturn then return cb({ok=false, error='APP_SUSPENDED'}) end
    if action == 'bridgePing' then
        return cb({ok=true, resource=RESOURCE, lbPhoneState=GetResourceState('lb-phone')})
    end
    local callbackName = callbackMap[action]
    if not callbackName then return cb({ok=false, error='UNKNOWN_ACTION'}) end
    local ok, result = pcall(function()
        return exports['lb-phone']:AwaitCallback(callbackName, payload)
    end)
    if not ok then
        print(('[WAVE] callback %s failed: %s'):format(callbackName, tostring(result)))
        return cb({ok=false, error='PHONE_CALLBACK_FAILED'})
    end
    cb(result or {ok=false, error='EMPTY_RESPONSE'})
end)
