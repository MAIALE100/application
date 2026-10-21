FlecityGamesProfile = FlecityGamesProfile or {}

local defaults={
    sound=true,
    reducedMotion=false,
    favorites={}
}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end

local function normalizeFavorites(value)
    local out,seen={},{}
    if type(value)~='table' then return out end
    for _,raw in ipairs(value) do
        local gameId=tostring(raw or '')
        local game=FlecityGamesRegistry.Get(gameId)
        if game and game.app=='play' and game.enabled==true and not seen[gameId] then
            seen[gameId]=true
            out[#out+1]=gameId
            if #out>=8 then break end
        end
    end
    return out
end

local function normalize(settings)
    settings=type(settings)=='table' and settings or {}
    return {
        sound=settings.sound~=false,
        reducedMotion=settings.reducedMotion==true,
        favorites=normalizeFavorites(settings.favorites)
    }
end

local function readSettings(playerIdentifier)
    local raw=MySQL.scalar.await('SELECT settings_json FROM flecity_game_profiles WHERE player_identifier=? LIMIT 1',{playerIdentifier})
    local decoded=nil
    if type(raw)=='string' and raw~='' then
        local ok,value=pcall(json.decode,raw)
        if ok then decoded=value end
    end
    return normalize(decoded)
end

function FlecityGamesProfile.Touch(source)
    local id=identifier(source)
    if not id then return nil end
    local displayName=FlecityGamesText.Normalize(FlecityGamesFramework.GetCharacterName(source))
    if displayName=='' then displayName=('Player %s'):format(tostring(source)) end
    displayName=FlecityGamesText.Truncate(displayName,100)
    MySQL.query.await([[INSERT INTO flecity_game_profiles (player_identifier,display_name,last_seen_at)
        VALUES (?,?,CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),last_seen_at=CURRENT_TIMESTAMP]],{id,displayName})
    return id
end

function FlecityGamesProfile.GetSettings(source)
    local id=FlecityGamesProfile.Touch(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    return {ok=true,settings=readSettings(id)}
end

function FlecityGamesProfile.UpdateSettings(source,data)
    local id=FlecityGamesProfile.Touch(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local settings=readSettings(id)
    if data.sound~=nil then settings.sound=data.sound~=false end
    if data.reducedMotion~=nil then settings.reducedMotion=data.reducedMotion==true end
    if data.favorites~=nil then settings.favorites=normalizeFavorites(data.favorites) end
    settings=normalize(settings)
    MySQL.query.await('UPDATE flecity_game_profiles SET settings_json=?,last_seen_at=CURRENT_TIMESTAMP WHERE player_identifier=?',
        {json.encode(settings),id})
    return {ok=true,settings=settings}
end

function FlecityGamesProfile.Defaults()
    return normalize(defaults)
end
