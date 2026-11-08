local RESOURCE = GetCurrentResourceName()
local APP_ID = WaveConfig.App.identifier
local cacheBust = tostring(GetGameTimer())
local ownsApp = false
local phoneAppOpen = false
local screen = nil
local pendingReturn = nil
local lastReturned = nil
local screenSerial = 0
-- A resource-owned playback NUI stays loaded after the LB Phone iframe closes.
-- Its status belongs to this FiveM client only, never to shared server state.
local wavePlayerSession = 0
local wavePlayerLastSeq = 0
local wavePlayerState = {playing=false,paused=false,index=-1,track=false,session=0,repeatMode='off',shuffle=false,volume=1}
local waveRingtoneSelection=nil
local waveRingtoneUiReady=false
local waveRingtoneAudioReady=false
local waveRingtoneCheckId=nil
local localPlayerBag=nil

local function setWaveRingtoneSelection(selection)
    waveRingtoneSelection=type(selection)=='table' and selection.track and selection.track.project and selection or nil
    waveRingtoneAudioReady=false
    SendNUIMessage({type='waveRingtoneSet',ringtone=waveRingtoneSelection or false})
end

local function refreshWaveRingtoneSelection()
    if GetResourceState('lb-phone')~='started' then return false end
    local ok,result=pcall(function() return exports['lb-phone']:AwaitCallback('wave:getRingtone',{}) end)
    if not ok or type(result)~='table' or result.ok~=true then return false end
    setWaveRingtoneSelection(result.ringtone)
    return true
end

local function registerWaveRingtoneCheck()
    if not WaveConfig.Ringtone.nativeIntegration or GetResourceState('lb-phone')~='started' or waveRingtoneCheckId then return end
    local ok,id=pcall(function()
        return exports['lb-phone']:AddCheck('playNativePhoneSound',function(soundType)
            if tostring(soundType or '')~=WaveConfig.Ringtone.nativeSoundType then return true end
            if not waveRingtoneSelection or not waveRingtoneUiReady or not waveRingtoneAudioReady then return true end
            SendNUIMessage({type='waveRingtoneStart'})
            return false
        end)
    end)
    if ok then waveRingtoneCheckId=id
    elseif WaveConfig.Debug then print('[WAVE] LB Phone ringtone check unavailable: '..tostring(id)) end
end

RegisterNUICallback('wave:ringtoneReady',function(_,cb)
    waveRingtoneUiReady=true
    cb({ok=true})
end)

RegisterNUICallback('wave:ringtoneAudioState',function(data,cb)
    waveRingtoneAudioReady=type(data)=='table' and data.ready==true
    cb({ok=true})
end)

CreateThread(function()
    while not LocalPlayer.state.isLoggedIn do Wait(1000) end
    for _=1,10 do
        if refreshWaveRingtoneSelection() then break end
        Wait(3000)
    end
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded',function()
    local serverId=GetPlayerServerId(PlayerId())
    if serverId>0 then localPlayerBag=('player:%s'):format(serverId) end
    CreateThread(function()
        Wait(1500)
        for _=1,10 do
            if refreshWaveRingtoneSelection() then break end
            Wait(3000)
        end
    end)
end)

CreateThread(function()
    while GetResourceState('lb-phone')~='started' do Wait(500) end
    registerWaveRingtoneCheck()
end)

AddEventHandler('onResourceStart',function(resource)
    if resource=='lb-phone' then
        waveRingtoneUiReady=false
        waveRingtoneAudioReady=false
        CreateThread(function() Wait(500);registerWaveRingtoneCheck();refreshWaveRingtoneSelection() end)
    end
end)

local initialServerId=GetPlayerServerId(PlayerId())
if initialServerId>0 then localPlayerBag=('player:%s'):format(initialServerId) end
AddStateBagChangeHandler('callAnswered',nil,function(bagName,_,value)
    if bagName==localPlayerBag and value==true then SendNUIMessage({type='waveRingtoneStop'}) end
end)
AddStateBagChangeHandler('onCallWith',nil,function(bagName,_,value)
    if bagName==localPlayerBag and (value==nil or value==false or value==0) then SendNUIMessage({type='waveRingtoneStop'}) end
end)

local function wavePlayerAction(action, payload)
    if action == 'wavePlayerStatus' then
        return {ok=true,player=wavePlayerState}
    end
    if action ~= 'wavePlayerCommand' then return nil end
    local command = tostring(payload.command or '')
    if command ~= 'play' and command ~= 'pause' and command ~= 'toggle' and command ~= 'next' and command ~= 'previous' and command ~= 'stop' and command ~= 'setRepeat' and command ~= 'setShuffle' and command ~= 'setVolume' then
        return {ok=false,error='INVALID_AUDIO_COMMAND'}
    end
    local event = {type='wavePlayerCommand',command=command}
    if command == 'setRepeat' then
        if payload.value ~= 'off' and payload.value ~= 'one' and payload.value ~= 'all' then
            return {ok=false,error='INVALID_REPEAT_MODE'}
        end
        event.value = payload.value
        wavePlayerState.repeatMode = payload.value
    elseif command == 'setShuffle' then
        if type(payload.value) ~= 'boolean' then return {ok=false,error='INVALID_SHUFFLE_MODE'} end
        event.value = payload.value
        wavePlayerState.shuffle = payload.value
    elseif command == 'setVolume' then
        local volume=tonumber(payload.value)
        if not volume or volume~=volume or volume<0 or volume>1 then
            return {ok=false,error='INVALID_VOLUME'}
        end
        event.value=volume
        wavePlayerState.volume=volume
    elseif command == 'play' then
        local queue = payload.queue
        if type(queue) ~= 'table' or #queue < 1 or #queue > 200 then return {ok=false,error='INVALID_AUDIO_QUEUE'} end
        local index = tonumber(payload.index) or 0
        if index < 0 or index >= #queue or index % 1 ~= 0 then return {ok=false,error='INVALID_AUDIO_INDEX'} end
        local queueBytes = 2
        for _,track in ipairs(queue) do
            if type(track) ~= 'table' or type(track.project) ~= 'table' or not tonumber(track.id) then
                return {ok=false,error='INVALID_AUDIO_TRACK'}
            end
            queueBytes = queueBytes + #json.encode(track) + 1
            if queueBytes > 12 * 1024 * 1024 then return {ok=false,error='AUDIO_QUEUE_TOO_LARGE'} end
        end
        -- Prevent oversized JSON messages from stalling the local CEF frame.
        wavePlayerSession = wavePlayerSession + 1
        wavePlayerLastSeq = 0
        event.queue=queue
        event.index=index
        event.session=wavePlayerSession
        wavePlayerState = {playing=false,paused=false,loading=true,index=index,session=wavePlayerSession,
            repeatMode=wavePlayerState.repeatMode or 'off',shuffle=wavePlayerState.shuffle == true,volume=wavePlayerState.volume or 1,track={
            id=queue[index+1].id,title=queue[index+1].title,artist_name=queue[index+1].artist_name,
            favorite=queue[index+1].favorite,preview=queue[index+1].preview}}
    else
        if wavePlayerSession == 0 and command ~= 'setRepeat' and command ~= 'setShuffle' and command ~= 'setVolume' then return {ok=false,error='AUDIO_NOT_STARTED'} end
        event.session=wavePlayerSession
        event.wrap=payload.wrap ~= false
        if command == 'toggle' or command == 'next' or command == 'previous' then
            wavePlayerState.loading = true
        end
    end
    event.session=wavePlayerSession
    SendNUIMessage(event)
    return {ok=true,player=wavePlayerState}
end

RegisterNUICallback('wave:playerEvent', function(data, cb)
    if type(data) ~= 'table' or tonumber(data.session) ~= wavePlayerSession then
        return cb({ok=false,error='STALE_AUDIO_SESSION'})
    end
    local event = tostring(data.event or '')
    if event == 'status' then
        local seq = tonumber(data.sequence) or 0
        if seq <= wavePlayerLastSeq then return cb({ok=true,ignored='STALE_STATUS'}) end
        wavePlayerLastSeq = seq
        local track = type(data.track) == 'table' and data.track or nil
        wavePlayerState = {session=wavePlayerSession,playing=data.playing == true,loading=data.loading == true,
            paused=data.paused == true,index=tonumber(data.index) or -1,
            repeatMode=(data.repeatMode == 'one' or data.repeatMode == 'all') and data.repeatMode or 'off',
            shuffle=data.shuffle == true,volume=math.max(0,math.min(1,tonumber(data.volume) or wavePlayerState.volume or 1)),
            track=track and {id=tonumber(track.id),title=tostring(track.title or ''):sub(1,80),
              artist_name=tostring(track.artist_name or ''):sub(1,80),favorite=track.favorite == true,
              preview=track.preview == true} or false,
            sequence=seq,error=type(data.error)=='string' and tostring(data.error):sub(1,80) or ''}
    elseif event == 'stream' then
        local trackId = tonumber(data.trackId)
        local seconds = math.floor(tonumber(data.validSeconds) or 0)
        if trackId and seconds >= 1 and seconds <= 600 then
            CreateThread(function()
                local ok, err = pcall(function()
                    exports['lb-phone']:AwaitCallback('wave:recordStream', {trackId=trackId,validSeconds=seconds})
                end)
                if not ok then print('[WAVE] background stream callback failed: '..tostring(err)) end
            end)
        end
    else
        return cb({ok=false,error='INVALID_AUDIO_EVENT'})
    end
    cb({ok=true})
end)
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
        if phoneHidden() then phoneAppOpen = false return true end
        Wait(100)
    end
    -- A partially visible handset may remain after closing; use the documented
    -- LB Phone export before giving the independent NUI mouse focus.
    pcall(function() exports['lb-phone']:SetPhonePartiallyVisible(0) end)
    for _ = 1, 10 do
        if phoneHidden() then phoneAppOpen = false return true end
        Wait(100)
    end
    return false
end
local function restorePhone(lease)
    CreateThread(function()
        -- OpenApp may open the handset and select its route atomically. Trying
        -- ToggleOpen first can leave the lock/home route above the custom app.
        local directOk, directError = pcall(function() exports['lb-phone']:OpenApp(APP_ID) end)
        if not directOk then print(('[WAVE] direct app return failed: %s'):format(tostring(directError))) end
        local phoneOpen = false
        for _ = 1, 8 do
            local ok, open = pcall(function() return exports['lb-phone']:IsOpen() end)
            if ok and open then phoneOpen = true break end
            Wait(100)
        end
        if not phoneOpen then
            print('[WAVE] app return needs handset open fallback')
            -- OpenApp can fire onOpen while the handset is still closed. That
            -- route is not visible; force a new selection after ToggleOpen.
            phoneAppOpen = false
            pcall(function() exports['lb-phone']:ToggleOpen(true) end)
            for _ = 1, 20 do
                local ok, open = pcall(function() return exports['lb-phone']:IsOpen() end)
                if ok and open then phoneOpen = true break end
                Wait(100)
            end
        end
        if not phoneOpen or not pendingReturn or pendingReturn.lease ~= lease then return end
        -- IsOpen becomes true before the handset finishes its opening route.
        -- Select WAVE after that route settles, then wait for its onOpen event.
        Wait(500)
        for attempt = 1, 15 do
            if not pendingReturn or pendingReturn.lease ~= lease then break end
            if not phoneAppOpen then
                local opened, err = pcall(function() exports['lb-phone']:OpenApp(APP_ID) end)
                if not opened then print(('[WAVE] OpenApp attempt %d failed: %s'):format(attempt, tostring(err))) end
                Wait(400)
            else
                pcall(function() exports['lb-phone']:SendCustomAppMessage(APP_ID, {type='waveScreenReturn'}) end)
                Wait(350)
            end
        end
        if pendingReturn and pendingReturn.lease == lease then print('[WAVE] phone app return still pending') end
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
        fixBlur = app.fixBlur == true,
        onOpen = function()
            local ok, open = pcall(function() return exports['lb-phone']:IsOpen() end)
            phoneAppOpen = ok and open == true
            if pendingReturn then print(phoneAppOpen and '[WAVE] return app route opened' or '[WAVE] return app route arrived before handset opened') end
        end,
        onClose = function()
            phoneAppOpen = false
            if pendingReturn then print('[WAVE] return app route closed') end
        end
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
    if resource == 'lb-phone' then
        ownsApp = false
        waveRingtoneCheckId=nil
        waveRingtoneUiReady=false
        waveRingtoneAudioReady=false
        SendNUIMessage({type='waveRingtoneStop'})
        return
    end
    if resource==RESOURCE and waveRingtoneCheckId and GetResourceState('lb-phone')=='started' then
        pcall(function() exports['lb-phone']:RemoveCheck(waveRingtoneCheckId) end)
        waveRingtoneCheckId=nil
    end
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
    getRingtone = 'wave:getRingtone',
    saveRingtone = 'wave:saveRingtone',
    clearRingtone = 'wave:clearRingtone',
    createArtist = 'wave:createArtist',
    listSynthPresets = 'wave:listSynthPresets',
    saveSynthPreset = 'wave:saveSynthPreset',
    deleteSynthPreset = 'wave:deleteSynthPreset',
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
    removeLibraryTrack = 'wave:removeLibraryTrack',
    artistDetail = 'wave:artistDetail',
    toggleFollow = 'wave:toggleFollow',
    listPlaylists = 'wave:listPlaylists',
    savePlaylist = 'wave:savePlaylist',
    getPlaylist = 'wave:getPlaylist',
    deletePlaylist = 'wave:deletePlaylist',
    addPlaylistTrack = 'wave:addPlaylistTrack',
    removePlaylistTrack = 'wave:removePlaylistTrack',
    movePlaylistTrack = 'wave:movePlaylistTrack',
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
    if action == 'wavePlayerCommand' or action == 'wavePlayerStatus' then
        if expanded and (not screen or not screen.ready or data.lease ~= screen.lease) then
            return cb({ok=false,error='APP_SUSPENDED'})
        end
        if not expanded and (screen or pendingReturn) then
            return cb({ok=false,error='APP_SUSPENDED'})
        end
        return cb(wavePlayerAction(action,payload))
    end
    if action == 'previewRingtone' then
        if expanded and (not screen or not screen.ready or data.lease ~= screen.lease) then return cb({ok=false,error='APP_SUSPENDED'}) end
        if not expanded and (screen or pendingReturn) then return cb({ok=false,error='APP_SUSPENDED'}) end
        if type(payload.track)~='table' or type(payload.track.project)~='table' or #json.encode(payload)>2*1024*1024 then
            return cb({ok=false,error='INVALID_RINGTONE_PREVIEW'})
        end
        payload.type='waveRingtonePreview'
        SendNUIMessage(payload)
        return cb({ok=true})
    elseif action == 'stopRingtonePreview' then
        SendNUIMessage({type='waveRingtoneStop'})
        return cb({ok=true})
    end
    if action:sub(1, 10) == 'waveScreen' then
        if action == 'waveScreenStatus' then return cb({ok=true, owner=screen and 'expanded' or 'phone'}) end
        if action == 'waveScreenClaim' and not expanded then
            if pendingReturn and phoneAppOpen then return cb({ok=true, state=pendingReturn.state, lease=pendingReturn.lease}) end
            return cb({ok=true, parked=screen ~= nil or pendingReturn ~= nil})
        end
        if action == 'waveScreenReturned' and not expanded then
            if lastReturned and lastReturned.lease == payload.lease then return cb({ok=true}) end
            if pendingReturn and phoneAppOpen and pendingReturn.lease == payload.lease then
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
    -- A freshly mounted phone iframe must bootstrap before it can claim the
    -- pending return. Keep every other phone mutation parked until claim.
    elseif expanded or (pendingReturn and action ~= 'bootstrap') then return cb({ok=false, error='APP_SUSPENDED'}) end
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
    if type(result)=='table' and result.ok==true and (action=='bootstrap' or action=='getRingtone' or action=='saveRingtone' or action=='clearRingtone') then
        setWaveRingtoneSelection(result.ringtone)
    end
    cb(result or {ok=false, error='EMPTY_RESPONSE'})
end)
