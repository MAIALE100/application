FlecityGamesProfile = FlecityGamesProfile or {}

local defaults={
    sound=true,
    reducedMotion=false
}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end

local function normalize(settings)
    settings=type(settings)=='table' and settings or {}
    return {
        sound=settings.sound~=false,
        reducedMotion=settings.reducedMotion==true
    }
end

function FlecityGamesProfile.Touch(source)
    local id=identifier(source)
    if not id then return nil end
    local displayName=tostring(FlecityGamesFramework.GetCharacterName(source) or ''):gsub('%c',' '):gsub('%s+',' ')
    displayName=displayName:gsub('^%s+',''):gsub('%s+    MySQL.query.await([[INSERT INTO flecity_game_profiles (player_identifier,display_name,last_seen_at)
        VALUES (?,?,CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),last_seen_at=CURRENT_TIMESTAMP]],{id,displayName})
    return id
end

function FlecityGamesProfile.GetSettings(source)
    local id=FlecityGamesProfile.Touch(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local raw=MySQL.scalar.await('SELECT settings_json FROM flecity_game_profiles WHERE player_identifier=? LIMIT 1',{id})
    local decoded=nil
    if type(raw)=='string' and raw~='' then
        local ok,value=pcall(json.decode,raw)
        if ok then decoded=value end
    end
    return {ok=true,settings=normalize(decoded)}
end

function FlecityGamesProfile.UpdateSettings(source,data)
    local id=FlecityGamesProfile.Touch(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local settings=normalize({
        sound=data.sound,
        reducedMotion=data.reducedMotion
    })
    MySQL.query.await('UPDATE flecity_game_profiles SET settings_json=?,last_seen_at=CURRENT_TIMESTAMP WHERE player_identifier=?',
        {json.encode(settings),id})
    return {ok=true,settings=settings}
end

function FlecityGamesProfile.Defaults()
    return normalize(defaults)
end
,'')
    if displayName=='' then displayName=('Player %s'):format(tostring(source)) end
    displayName=displayName:sub(1,100)
    MySQL.query.await([[INSERT INTO flecity_game_profiles (player_identifier,display_name,last_seen_at)
        VALUES (?,?,CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),last_seen_at=CURRENT_TIMESTAMP]],{id,displayName})
    return id
end

function FlecityGamesProfile.GetSettings(source)
    local id=FlecityGamesProfile.Touch(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local raw=MySQL.scalar.await('SELECT settings_json FROM flecity_game_profiles WHERE player_identifier=? LIMIT 1',{id})
    local decoded=nil
    if type(raw)=='string' and raw~='' then
        local ok,value=pcall(json.decode,raw)
        if ok then decoded=value end
    end
    return {ok=true,settings=normalize(decoded)}
end

function FlecityGamesProfile.UpdateSettings(source,data)
    local id=FlecityGamesProfile.Touch(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local settings=normalize({
        sound=data.sound,
        reducedMotion=data.reducedMotion
    })
    MySQL.query.await('UPDATE flecity_game_profiles SET settings_json=?,last_seen_at=CURRENT_TIMESTAMP WHERE player_identifier=?',
        {json.encode(settings),id})
    return {ok=true,settings=settings}
end

function FlecityGamesProfile.Defaults()
    return normalize(defaults)
end
