local RESOURCE = GetCurrentResourceName()

local registeredCallbacks = 0
local expectedCallbacks = 0
local callbackBusy = false
local rate = {}
-- Guard economic operations by citizenid, not temporary FiveM source ID.
-- LB Phone callbacks can overlap while oxmysql/banking calls yield.
local economyBusy = {}
local function withEconomyLock(citizenid, fn)
    if economyBusy[citizenid] then return {ok=false,error='PAYMENT_BUSY'} end
    economyBusy[citizenid] = true
    local ok, result = pcall(fn)
    economyBusy[citizenid] = nil
    if not ok then
        print(('[WAVE] economic callback failed citizenid=%s: %s'):format(tostring(citizenid),tostring(result)))
        return {ok=false,error='SERVER_ERROR'}
    end
    return result
end

local function trim(value)
    return tostring(value or ''):gsub('^%s+', ''):gsub('%s+$', '')
end

local function clampText(value, maxLen)
    local text = trim(value)
    local limit = math.max(0, math.floor(tonumber(maxLen) or 0))
    if limit == 0 then return '' end
    local ok, length = pcall(utf8.len, text)
    if not ok or not length then
        -- Invalid UTF-8 should never be persisted. Fall back to a safe ASCII-ish slice.
        return text:gsub('[\128-\255]', ''):sub(1, limit)
    end
    if length <= limit then return text end
    local cut = utf8.offset(text, limit + 1)
    if cut then return text:sub(1, cut - 1) end
    return text
end

local function textLength(value)
    local ok, length = pcall(utf8.len, tostring(value or ''))
    return ok and length or 0
end

local function clampNumber(value, minValue, maxValue, fallback)
    local n = tonumber(value)
    if not n then return fallback end
    if n < minValue then n = minValue end
    if n > maxValue then n = maxValue end
    return n
end

local function getPlayer(source)
    if GetResourceState('qbx_core') ~= 'started' then return nil end
    local ok, player = pcall(function() return exports.qbx_core:GetPlayer(tonumber(source)) end)
    if ok then return player end
    return nil
end

local function getPlayerData(source)
    local player = getPlayer(source)
    return player and player.PlayerData or nil
end

local function getCitizenId(source)
    local pd = getPlayerData(source)
    return pd and pd.citizenid and tostring(pd.citizenid) or nil
end

local function getCharacterName(source)
    local pd = getPlayerData(source)
    local c = pd and pd.charinfo
    if not c then return ('Player %s'):format(tostring(source)) end
    local name = trim(('%s %s'):format(c.firstname or '', c.lastname or ''))
    return name ~= '' and name or ('Player %s'):format(tostring(source))
end

-- WAVE admin access is a server-side decision, not a UI toggle.
-- Do not trust generic ACEs ('admin', 'god', 'group.admin') since dev/test
-- principals may be inherited by every character on an admin's account.
local function isAdmin(source)
    if source == 0 then return true end
    if not getCitizenId(source) then return false end
    for _, ace in ipairs(WaveConfig.Admin.aces or {}) do
        if ace ~= '' and IsPlayerAceAllowed(source, ace) then return true end
    end
    if WaveConfig.Admin.allowWeazelBoss ~= true then return false end
    local pd = getPlayerData(source)
    local job = pd and pd.job
    if not job or tostring(job.name) ~= tostring(WaveConfig.Admin.weazelJob) or job.isboss ~= true then
        return false
    end
    -- Require the true maximum job grade, rather than an arbitrary boss grade.
    local ok, definition = pcall(function()
        return exports.qbx_core:GetJob(tostring(WaveConfig.Admin.weazelJob))
    end)
    if not ok or type(definition) ~= 'table' or type(definition.grades) ~= 'table' then return false end
    local highest = -1
    for grade in pairs(definition.grades) do
        local number = tonumber(grade)
        if number and number > highest then highest = number end
    end
    local actual = tonumber(job.grade and job.grade.level)
    return highest >= 0 and actual ~= nil and actual == highest
end

local function limited(source, key, ms)
    local now = GetGameTimer()
    local id = ('%s:%s'):format(source, key)
    local last = rate[id]
    -- A new caller must not be throttled at uptime zero; timer wrap resets the window.
    if last ~= nil and now >= last and now - last < ms then return true end
    rate[id] = now
    return false
end

AddEventHandler('playerDropped', function()
    local src = source
    local prefix = tostring(src) .. ':'
    for key in pairs(rate) do
        if key:sub(1, #prefix) == prefix then rate[key] = nil end
    end
end)

local schema = {
[[CREATE TABLE IF NOT EXISTS wave_artists (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    citizenid VARCHAR(64) NOT NULL,
    creator_name VARCHAR(100) NOT NULL,
    artist_name VARCHAR(48) NOT NULL,
    bio VARCHAR(400) NOT NULL DEFAULT '',
    avatar_url VARCHAR(512) NULL,
    status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wave_artist_citizenid (citizenid),
    KEY idx_wave_artist_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_projects (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    citizenid VARCHAR(64) NOT NULL,
    title VARCHAR(80) NOT NULL,
    project_json LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_wave_projects_owner (citizenid, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_tracks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    artist_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    title VARCHAR(80) NOT NULL,
    description VARCHAR(800) NOT NULL DEFAULT '',
    genre VARCHAR(32) NOT NULL DEFAULT 'OTHER',
    access_mode ENUM('free','subscription','purchase','both') NOT NULL DEFAULT 'free',
    price INT UNSIGNED NOT NULL DEFAULT 0,
    rights_json TEXT NOT NULL,
    project_json LONGTEXT NOT NULL,
    duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('private','public','suspended','deleted') NOT NULL DEFAULT 'private',
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wave_tracks_artist (artist_id, status),
    KEY idx_wave_tracks_public (status, published_at),
    CONSTRAINT fk_wave_tracks_artist FOREIGN KEY (artist_id) REFERENCES wave_artists(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_favorites (
    citizenid VARCHAR(64) NOT NULL,
    track_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (citizenid, track_id),
    KEY idx_wave_favorites_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_purchases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    buyer_citizenid VARCHAR(64) NOT NULL,
    track_id BIGINT UNSIGNED NOT NULL,
    purchase_type ENUM('personal','commercial') NOT NULL DEFAULT 'personal',
    price INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wave_purchase (buyer_citizenid, track_id, purchase_type),
    KEY idx_wave_purchases_buyer (buyer_citizenid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_wallets (
    citizenid VARCHAR(64) NOT NULL,
    balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
    lifetime_earned BIGINT UNSIGNED NOT NULL DEFAULT 0,
    frozen TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (citizenid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_platform_wallet (
    id TINYINT UNSIGNED NOT NULL,
    balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
    lifetime_earned BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tx_type VARCHAR(32) NOT NULL,
    citizenid VARCHAR(64) NULL,
    track_id BIGINT UNSIGNED NULL,
    gross_amount BIGINT NOT NULL DEFAULT 0,
    creator_amount BIGINT NOT NULL DEFAULT 0,
    platform_amount BIGINT NOT NULL DEFAULT 0,
    meta_json TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wave_transactions_citizen (citizenid, created_at),
    KEY idx_wave_transactions_track (track_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_subscriptions (
    citizenid VARCHAR(64) NOT NULL,
    status ENUM('inactive','active','cancelled') NOT NULL DEFAULT 'inactive',
    expires_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (citizenid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_stream_daily (
    track_id BIGINT UNSIGNED NOT NULL,
    listener_citizenid VARCHAR(64) NOT NULL,
    stream_date DATE NOT NULL,
    play_count INT UNSIGNED NOT NULL DEFAULT 0,
    valid_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id, listener_citizenid, stream_date),
    KEY idx_wave_stream_day (stream_date, track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_citizenid VARCHAR(64) NOT NULL,
    track_id BIGINT UNSIGNED NOT NULL,
    category VARCHAR(32) NOT NULL,
    details VARCHAR(500) NOT NULL DEFAULT '',
    status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_wave_reports_status (status, created_at),
    KEY idx_wave_reports_reporter (reporter_citizenid, track_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_follows (
    citizenid VARCHAR(64) NOT NULL,
    artist_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (citizenid, artist_id),
    KEY idx_wave_follows_artist (artist_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_playlists (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    citizenid VARCHAR(64) NOT NULL,
    name VARCHAR(60) NOT NULL,
    description VARCHAR(240) NOT NULL DEFAULT '',
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_wave_playlists_owner (citizenid, deleted_at, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_playlist_tracks (
    playlist_id BIGINT UNSIGNED NOT NULL,
    track_id BIGINT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id),
    KEY idx_wave_playlist_tracks_order (playlist_id, position, added_at),
    KEY idx_wave_playlist_tracks_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_albums (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    artist_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(80) NOT NULL,
    description VARCHAR(400) NOT NULL DEFAULT '',
    release_type ENUM('ep','album') NOT NULL DEFAULT 'album',
    status ENUM('draft','public','deleted') NOT NULL DEFAULT 'public',
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wave_albums_artist (artist_id, status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_album_tracks (
    album_id BIGINT UNSIGNED NOT NULL,
    track_id BIGINT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (album_id, track_id),
    KEY idx_wave_album_tracks_order (album_id, position),
    KEY idx_wave_album_tracks_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_recent_plays (
    citizenid VARCHAR(64) NOT NULL,
    track_id BIGINT UNSIGNED NOT NULL,
    play_count INT UNSIGNED NOT NULL DEFAULT 1,
    last_played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (citizenid, track_id),
    KEY idx_wave_recent_owner (citizenid, last_played_at),
    KEY idx_wave_recent_track (track_id, last_played_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_ringtones (
    citizenid VARCHAR(64) NOT NULL,
    track_id BIGINT UNSIGNED NOT NULL,
    start_seconds DECIMAL(7,2) NOT NULL DEFAULT 0,
    end_seconds DECIMAL(7,2) NOT NULL,
    fade_in_ms SMALLINT UNSIGNED NOT NULL DEFAULT 100,
    fade_out_ms SMALLINT UNSIGNED NOT NULL DEFAULT 350,
    gain DECIMAL(4,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (citizenid),
    KEY idx_wave_ringtones_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_synth_presets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    citizenid VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    synth_json VARCHAR(1800) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wave_synth_owner_name (citizenid, name),
    KEY idx_wave_synth_owner (citizenid, updated_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_schema_meta (
    id TINYINT UNSIGNED NOT NULL,
    schema_version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
[[CREATE TABLE IF NOT EXISTS wave_admin_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    admin_citizenid VARCHAR(64) NULL,
    admin_name VARCHAR(100) NOT NULL,
    action VARCHAR(48) NOT NULL,
    target_type VARCHAR(24) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wave_admin_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]]
}

local function ensureSchema()
    for _, query in ipairs(schema) do MySQL.query.await(query) end
    MySQL.query.await([[INSERT INTO wave_platform_wallet (id, balance, lifetime_earned)
        VALUES (1,0,0) ON DUPLICATE KEY UPDATE id=id]])
    MySQL.query.await([[INSERT INTO wave_schema_meta (id, schema_version)
        VALUES (1,?) ON DUPLICATE KEY UPDATE schema_version=VALUES(schema_version)]],
        {tonumber(WaveConfig.SchemaVersion) or 1})
end

local function ensureWallet(citizenid)
    MySQL.query.await([[INSERT INTO wave_wallets (citizenid,balance,lifetime_earned,frozen)
        VALUES (?,0,0,0) ON DUPLICATE KEY UPDATE citizenid=VALUES(citizenid)]], {citizenid})
end

local function getArtistAny(citizenid)
    return MySQL.single.await('SELECT * FROM wave_artists WHERE citizenid=? LIMIT 1', {citizenid})
end

local function getArtist(citizenid)
    return MySQL.single.await("SELECT * FROM wave_artists WHERE citizenid=? AND status='active' LIMIT 1", {citizenid})
end

local function refreshCreatorName(source, citizenid)
    local name = getCharacterName(source)
    MySQL.update.await('UPDATE wave_artists SET creator_name=? WHERE citizenid=?', {name, citizenid})
    return name
end

local function getWallet(citizenid)
    ensureWallet(citizenid)
    return MySQL.single.await('SELECT balance,lifetime_earned,frozen FROM wave_wallets WHERE citizenid=?', {citizenid})
end

local function getSubscription(citizenid)
    local row = MySQL.single.await([[SELECT status,expires_at,
        (status='active' AND (expires_at IS NULL OR expires_at>NOW())) AS active
        FROM wave_subscriptions WHERE citizenid=? LIMIT 1]], {citizenid})
    return row or {status='inactive', active=0}
end

local function decodeJson(value, fallback)
    if type(value) == 'table' then return value end
    if type(value) ~= 'string' or value == '' then return fallback end
    local ok, result = pcall(json.decode, value)
    return ok and result or fallback
end

local allowedInstruments = {
    sine=true, triangle=true, saw=true, square=true, bass=true,
    drums=true, pluck=true, bell=true, piano=true, grand_piano=true, strings=true,
    acoustic_guitar=true, electric_bass=true, acoustic_drums=true,
    violin=true, cello=true, flute=true, trumpet=true, electric_guitar=true,
    clarinet=true, trombone=true, french_horn=true, tuba=true,
    oboe=true, bassoon=true, tenor_sax=true, marimba=true,
    piccolo=true, xylophone=true, glockenspiel=true, contrabass=true,
    harp=true, vibraphone=true, timpani=true, cymbals=true, synth=true
}


-- Synth v11: explicit bounded knobs. Keep project JSON compatible with older songs.
local synthPresets = {
    warm_pad=true, synth_bass=true, lead=true, super_saw=true,
    fm_bell=true, retro=true, pluck=true, soft_keys=true
}
local synthWaveforms = {sine=true, triangle=true, sawtooth=true, square=true}
local synthDefaults = {
    warm_pad={wave='sawtooth',attack=.35,decay=.3,sustain=.72,release=1.2,cutoff=1800,resonance=.6,detune=5,fmRatio=0,fmDepth=0},
    synth_bass={wave='sawtooth',attack=.01,decay=.18,sustain=.55,release=.16,cutoff=850,resonance=2.5,detune=0,fmRatio=0,fmDepth=0},
    lead={wave='sawtooth',attack=.012,decay=.08,sustain=.8,release=.13,cutoff=5800,resonance=.8,detune=4,fmRatio=0,fmDepth=0},
    super_saw={wave='sawtooth',attack=.04,decay=.15,sustain=.7,release=.28,cutoff=3300,resonance=.85,detune=12,fmRatio=0,fmDepth=0},
    fm_bell={wave='sine',attack=.005,decay=.65,sustain=.06,release=.9,cutoff=12000,resonance=.1,detune=0,fmRatio=2.9,fmDepth=210},
    retro={wave='square',attack=.006,decay=.04,sustain=.72,release=.08,cutoff=8500,resonance=.1,detune=0,fmRatio=0,fmDepth=0},
    pluck={wave='triangle',attack=.005,decay=.18,sustain=.04,release=.13,cutoff=4400,resonance=.5,detune=0,fmRatio=0,fmDepth=0},
    soft_keys={wave='triangle',attack=.018,decay=.23,sustain=.38,release=.5,cutoff=2900,resonance=.2,detune=0,fmRatio=0,fmDepth=0}
}
local function normalizedSynth(input)
    if type(input) ~= 'table' then input = {} end
    local preset = tostring(input.preset or 'warm_pad')
    if not synthPresets[preset] then preset = 'warm_pad' end
    local defaults = synthDefaults[preset]
    local wave = tostring(input.wave or defaults.wave)
    if not synthWaveforms[wave] then wave = defaults.wave end
    return {
        preset=preset, wave=wave,
        attack=clampNumber(input.attack,.005,2,defaults.attack),
        decay=clampNumber(input.decay,.01,2,defaults.decay),
        sustain=clampNumber(input.sustain,0,1,defaults.sustain),
        release=clampNumber(input.release,.02,3,defaults.release),
        cutoff=clampNumber(input.cutoff,150,16000,defaults.cutoff),
        resonance=clampNumber(input.resonance,.1,16,defaults.resonance),
        detune=clampNumber(input.detune,0,18,defaults.detune),
        fmRatio=clampNumber(input.fmRatio,0,8,defaults.fmRatio),
        fmDepth=clampNumber(input.fmDepth,0,800,defaults.fmDepth)
    }
end

-- v12: Private reusable synthesizer patches, owned by the player's citizenid.
-- Stored patches are snapshots. Applying one does NOT link a saved song to its row.
local SYNTH_PRESET_LIMIT = 32
local synthPresetBusy = {}
local function guardedSynthPreset(citizenid, fn)
    if synthPresetBusy[citizenid] then return {ok=false,error='PRESET_BUSY'} end
    synthPresetBusy[citizenid] = true
    local ok, result = pcall(fn)
    synthPresetBusy[citizenid] = nil
    if not ok then
        print(('[WAVE] synth preset DB operation failed: %s'):format(tostring(result)))
        return {ok=false,error='SERVER_ERROR'}
    end
    return result
end

local function listSynthPresets(citizenid)
    local rows = MySQL.query.await([[SELECT id,name,synth_json,updated_at
        FROM wave_synth_presets WHERE citizenid=? ORDER BY updated_at DESC,id DESC LIMIT 32]], {citizenid}) or {}
    local result = {}
    for _, row in ipairs(rows) do
        local ok, decoded = pcall(json.decode, tostring(row.synth_json or ''))
        result[#result + 1] = {
            id=tonumber(row.id), name=tostring(row.name or ''),
            synth=normalizedSynth(ok and decoded or {}), updated_at=row.updated_at
        }
    end
    return result
end

local function cbListSynthPresets(source)
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    return {ok=true,presets=listSynthPresets(citizenid)}
end

local function cbSaveSynthPreset(source, data)
    if limited(source,'saveSynthPreset',350) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local name = clampText(data.name,40)
    if textLength(name)<1 then return {ok=false,error='PRESET_NAME_REQUIRED'} end
    if type(data.synth)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local synth = normalizedSynth(data.synth)
    local encoded = json.encode(synth)
    if #encoded>1800 then return {ok=false,error='INVALID_REQUEST'} end
    local id=tonumber(data.id)
    if id and (id<1 or id%1~=0) then return {ok=false,error='INVALID_REQUEST'} end
    return guardedSynthPreset(citizenid,function()
        -- Unique index also rejects concurrent same-name writes from another session.
        local duplicate=MySQL.scalar.await([[SELECT id FROM wave_synth_presets
            WHERE citizenid=? AND name=? LIMIT 1]],{citizenid,name})
        if duplicate and tonumber(duplicate)~=id then return {ok=false,error='PRESET_NAME_EXISTS'} end
        if id then
            local owned=MySQL.scalar.await('SELECT id FROM wave_synth_presets WHERE id=? AND citizenid=? LIMIT 1',{id,citizenid})
            if not owned then return {ok=false,error='PRESET_NOT_FOUND'} end
            local updated=MySQL.update.await('UPDATE wave_synth_presets SET name=?,synth_json=? WHERE id=? AND citizenid=?',{name,encoded,id,citizenid})
            if updated==nil then return {ok=false,error='SERVER_ERROR'} end
            return {ok=true,id=id,presets=listSynthPresets(citizenid)}
        end
        local count=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM wave_synth_presets WHERE citizenid=?',{citizenid}) or 0)
        if count>=SYNTH_PRESET_LIMIT then return {ok=false,error='PRESET_LIMIT'} end
        local inserted=MySQL.insert.await('INSERT INTO wave_synth_presets (citizenid,name,synth_json) VALUES (?,?,?)',{citizenid,name,encoded})
        if not inserted then return {ok=false,error='SERVER_ERROR'} end
        return {ok=true,id=tonumber(inserted),presets=listSynthPresets(citizenid)}
    end)
end

local function cbDeleteSynthPreset(source,data)
    if limited(source,'deleteSynthPreset',350) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local id=tonumber(data.id)
    if not id or id<1 or id%1~=0 then return {ok=false,error='INVALID_REQUEST'} end
    return guardedSynthPreset(citizenid,function()
        local changed=MySQL.update.await('DELETE FROM wave_synth_presets WHERE id=? AND citizenid=?',{id,citizenid})
        if not changed or changed<1 then return {ok=false,error='PRESET_NOT_FOUND'} end
        return {ok=true,presets=listSynthPresets(citizenid)}
    end)
end

local function normalizeProject(project)
    if type(project) ~= 'table' then return nil, 'INVALID_PROJECT' end

    local projectKey = tostring(project.key or 'C:major')
    if not projectKey:match('^[A-G]#?:major$') and not projectKey:match('^[A-G]#?:minor$') then projectKey = 'C:major' end

    local result = {
        version = 1,
        bpm = math.floor(clampNumber(project.bpm, 60, 200, 120)),
        bars = math.floor(clampNumber(project.bars, 1, WaveConfig.Limits.maxBars, 4)),
        title = clampText(project.title or '', WaveConfig.Limits.projectTitle),
        key = projectKey,
        masterVolume = clampNumber(project.masterVolume, 0, 1, 1),
        tracks = {}
    }

    local sourceTracks = type(project.tracks) == 'table' and project.tracks or {}
    if #sourceTracks < 1 then return nil, 'TRACK_REQUIRED' end
    if #sourceTracks > WaveConfig.Limits.maxTracks then return nil, 'TOO_MANY_TRACKS' end

    local totalNotes = 0
    local maxStep = result.bars * 16
    for index=1,#sourceTracks do
        local sourceTrack = sourceTracks[index]
        if type(sourceTrack) ~= 'table' then return nil, 'INVALID_TRACK' end
        local instrument = tostring(sourceTrack.instrument or 'sine')
        if not allowedInstruments[instrument] then instrument = 'sine' end
        local track = {
            id = index,
            name = clampText(sourceTrack.name or ('TRACK '..index), 24),
            instrument = instrument,
            volume = clampNumber(sourceTrack.volume, 0, 1, 0.75),
            pan = clampNumber(sourceTrack.pan, -1, 1, 0),
            muted = sourceTrack.muted == true,
            synth = instrument == 'synth' and normalizedSynth(sourceTrack.synth) or nil,
            notes = {}
        }
        local sourceNotes = type(sourceTrack.notes) == 'table' and sourceTrack.notes or {}
        if #sourceNotes > WaveConfig.Limits.maxNotesPerTrack then return nil, 'TOO_MANY_NOTES' end
        for _, sourceNote in ipairs(sourceNotes) do
            if type(sourceNote) == 'table' then
                local step = math.floor(tonumber(sourceNote.step) or -1)
                local pitch = math.floor(tonumber(sourceNote.pitch) or 60)
                if step >= 0 and step < maxStep and pitch >= 24 and pitch <= 96 then
                    track.notes[#track.notes+1] = {
                        step = step,
                        pitch = pitch,
                        length = clampNumber(sourceNote.length, 1, 16, 1),
                        velocity = clampNumber(sourceNote.velocity, 0.05, 1, 0.85),
                        -- Nil on older projects: keep their original playback behaviour.
                        articulation = (sourceNote.articulation == 'legato' or sourceNote.articulation == 'tongue') and sourceNote.articulation or nil
                    }
                    totalNotes = totalNotes + 1
                    if totalNotes > WaveConfig.Limits.maxNotesTotal then return nil, 'PROJECT_NOTE_LIMIT' end
                end
            end
        end
        result.tracks[#result.tracks+1] = track
    end

    return result
end

local function encodeProject(project)
    local normalized, err = normalizeProject(project)
    if not normalized then return nil, nil, err end
    local encoded = json.encode(normalized)
    if #encoded > WaveConfig.Limits.projectJsonBytes then return nil, nil, 'PROJECT_TOO_LARGE' end
    return encoded, normalized
end

local function trimProjectForPreview(project, seconds)
    if type(project) ~= 'table' then return {} end
    local bpm = clampNumber(project.bpm, 60, 200, 120)
    local stepDuration = 60 / bpm / 4
    local maxSteps = math.max(1, math.floor((tonumber(seconds) or 30) / stepDuration))
    local copy = {
        version = tonumber(project.version) or 1,
        bpm = bpm,
        bars = math.max(1, math.min(tonumber(project.bars) or 1, math.ceil(maxSteps / 16))),
        title = project.title,
        key = project.key,
        masterVolume = clampNumber(project.masterVolume, 0, 1, 1),
        tracks = {}
    }
    for i, sourceTrack in ipairs(project.tracks or {}) do
        local track = {
            id = sourceTrack.id or i,
            name = sourceTrack.name,
            instrument = sourceTrack.instrument,
            volume = sourceTrack.volume,
            pan = sourceTrack.pan,
            muted = sourceTrack.muted == true,
            synth = sourceTrack.instrument == 'synth' and normalizedSynth(sourceTrack.synth) or nil,
            notes = {}
        }
        for _, note in ipairs(sourceTrack.notes or {}) do
            if tonumber(note.step) and tonumber(note.step) < maxSteps then
                track.notes[#track.notes+1] = note
            end
        end
        copy.tracks[#copy.tracks+1] = track
    end
    return copy
end

local function normalizeTrack(row, citizenid, subscriptionActive)
    if not row then return nil end
    row.id = tonumber(row.id)
    row.artist_id = tonumber(row.artist_id)
    row.price = tonumber(row.price or 0)
    row.duration_seconds = tonumber(row.duration_seconds or 0)
    row.favorite = tonumber(row.favorite or 0) == 1
    row.owned = tonumber(row.owned or 0) == 1
    local creatorCitizenId = tostring(row.creator_citizenid or '')
    row.is_owner = citizenid and creatorCitizenId == citizenid or false
    row.rights = decodeJson(row.rights_json, {})
    local fullProject = decodeJson(row.project_json, {})
    local subscriptionAllowed = (row.access_mode == 'subscription' or row.access_mode == 'both') and subscriptionActive == true
    row.full_access = row.access_mode == 'free' or row.is_owner or row.owned or subscriptionAllowed
    row.preview = not row.full_access
    row.project = row.full_access and fullProject or trimProjectForPreview(fullProject, WaveConfig.Subscription.previewSeconds)
    row.rights_json = nil
    row.project_json = nil
    -- Never expose the real creator identifier outside the admin endpoints.
    row.creator_citizenid = nil
    return row
end

local function publicTracks(citizenid, search)
    local limit = search and WaveConfig.Limits.searchLimit or WaveConfig.Limits.homeLimit
    local term = search and ('%%' .. search .. '%%') or nil
    local subscription = getSubscription(citizenid)
    local subscriptionActive = WaveConfig.Subscription.enabled and tonumber(subscription.active or 0) == 1
    local sql = [[SELECT t.*,a.artist_name,a.citizenid AS creator_citizenid,
        EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned
        FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.status='public' AND a.status='active']]
    local params = {citizenid, citizenid}
    if term then
        sql = sql .. ' AND (t.title LIKE ? OR a.artist_name LIKE ? OR t.genre LIKE ?)'
        params[#params+1], params[#params+2], params[#params+3] = term, term, term
    end
    sql = sql .. ' ORDER BY t.published_at DESC,t.id DESC LIMIT ' .. tostring(limit)
    local rows = MySQL.query.await(sql, params) or {}
    for i=1,#rows do rows[i] = normalizeTrack(rows[i], citizenid, subscriptionActive) end
    return rows
end

local function normalizeRows(rows, citizenid, subscriptionActive)
    for i=1,#rows do rows[i] = normalizeTrack(rows[i], citizenid, subscriptionActive) end
    return rows
end

local function getEligibleRingtoneTrack(citizenid, trackId)
    local row=MySQL.single.await([[SELECT t.*,a.artist_name,a.citizenid AS creator_citizenid,
        EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned
        FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.id=? AND t.status='public' AND a.status='active' LIMIT 1]],
        {citizenid,citizenid,trackId})
    if not row then return nil,'TRACK_NOT_FOUND' end
    local subscription=getSubscription(citizenid)
    local subscriptionActive=WaveConfig.Subscription.enabled and tonumber(subscription.active or 0)==1
    local track=normalizeTrack(row,citizenid,subscriptionActive)
    if track.rights.ringtone~=true then return nil,'RINGTONE_NOT_ALLOWED' end
    if track.preview or not track.project then return nil,'FULL_ACCESS_REQUIRED' end
    return track
end

local function loadSavedRingtone(citizenid)
    local row=MySQL.single.await([[SELECT r.track_id AS ringtone_track_id,r.start_seconds,r.end_seconds,
        r.fade_in_ms,r.fade_out_ms,r.gain,t.*,a.artist_name,a.citizenid AS creator_citizenid,
        EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned
        FROM wave_ringtones r JOIN wave_tracks t ON t.id=r.track_id
        JOIN wave_artists a ON a.id=t.artist_id
        WHERE r.citizenid=? AND t.status='public' AND a.status='active' LIMIT 1]],
        {citizenid,citizenid,citizenid})
    if not row then return nil end
    local subscription=getSubscription(citizenid)
    local subscriptionActive=WaveConfig.Subscription.enabled and tonumber(subscription.active or 0)==1
    local track=normalizeTrack(row,citizenid,subscriptionActive)
    if track.rights.ringtone~=true or track.preview or not track.project then return nil end
    return {
        trackId=tonumber(row.ringtone_track_id),track=track,
        startSeconds=tonumber(row.start_seconds) or 0,
        endSeconds=tonumber(row.end_seconds) or 0,
        fadeInMs=tonumber(row.fade_in_ms) or 0,
        fadeOutMs=tonumber(row.fade_out_ms) or 0,
        gain=tonumber(row.gain) or 1
    }
end

local function normalizedRingtoneSelection(data, duration)
    local function finiteNumber(value)
        local number=tonumber(value)
        if not number or number~=number or number==math.huge or number==-math.huge then return nil end
        return number
    end
    local start=finiteNumber(data.startSeconds)
    local finish=finiteNumber(data.endSeconds)
    local fadeIn=finiteNumber(data.fadeInMs)
    local fadeOut=finiteNumber(data.fadeOutMs)
    local gain=finiteNumber(data.gain)
    if not start or not finish or not fadeIn or not fadeOut or not gain then return nil,'INVALID_RINGTONE_RANGE' end
    start=math.floor(start*100+.5)/100
    finish=math.floor(finish*100+.5)/100
    fadeIn=math.floor(fadeIn+.5)
    fadeOut=math.floor(fadeOut+.5)
    gain=math.floor(gain*1000+.5)/1000
    local length=finish-start
    if start<0 or finish>duration or length<WaveConfig.Ringtone.minSeconds or length>WaveConfig.Ringtone.maxSeconds then
        return nil,'INVALID_RINGTONE_RANGE'
    end
    if fadeIn<0 or fadeOut<0 or fadeIn>WaveConfig.Ringtone.maxFadeMilliseconds or fadeOut>WaveConfig.Ringtone.maxFadeMilliseconds or fadeIn+fadeOut>length*1000 then
        return nil,'INVALID_RINGTONE_FADE'
    end
    if gain<WaveConfig.Ringtone.minGain or gain>WaveConfig.Ringtone.maxGain then return nil,'INVALID_RINGTONE_GAIN' end
    return {startSeconds=start,endSeconds=finish,fadeInMs=fadeIn,fadeOutMs=fadeOut,gain=gain}
end

local function sectionTracks(citizenid, mode, limit)
    local subscription = getSubscription(citizenid)
    local subscriptionActive = WaveConfig.Subscription.enabled and tonumber(subscription.active or 0) == 1
    local maxRows = math.max(1, math.min(tonumber(limit) or 12, WaveConfig.Limits.homeLimit))
    local selectBase = [[SELECT t.*,a.artist_name,a.citizenid AS creator_citizenid,
        EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned]]
    local rows
    if mode == 'trending' then
        rows = MySQL.query.await(selectBase .. [[,
            COALESCE(s.valid_seconds,0) AS trend_seconds
            FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
            LEFT JOIN (
                SELECT track_id,SUM(valid_seconds) AS valid_seconds
                FROM wave_stream_daily WHERE stream_date>=DATE_SUB(CURDATE(),INTERVAL 7 DAY)
                GROUP BY track_id
            ) s ON s.track_id=t.id
            WHERE t.status='public' AND a.status='active'
            ORDER BY trend_seconds DESC,t.published_at DESC,t.id DESC LIMIT ]] .. tostring(maxRows), {citizenid,citizenid}) or {}
    elseif mode == 'following' then
        rows = MySQL.query.await(selectBase .. [[
            FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
            WHERE t.status='public' AND a.status='active'
            AND EXISTS(SELECT 1 FROM wave_follows wf WHERE wf.citizenid=? AND wf.artist_id=t.artist_id)
            ORDER BY t.published_at DESC,t.id DESC LIMIT ]] .. tostring(maxRows), {citizenid,citizenid,citizenid}) or {}
    elseif mode == 'recent' then
        rows = MySQL.query.await(selectBase .. [[,
            rp.last_played_at,rp.play_count AS recent_play_count
            FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
            JOIN wave_recent_plays rp ON rp.track_id=t.id AND rp.citizenid=?
            WHERE t.status='public' AND a.status='active'
            ORDER BY rp.last_played_at DESC LIMIT ]] .. tostring(maxRows), {citizenid,citizenid,citizenid}) or {}
    else
        rows = publicTracks(citizenid)
        while #rows > maxRows do table.remove(rows) end
        return rows
    end
    return normalizeRows(rows, citizenid, subscriptionActive)
end

local function publicArtistSummary(citizenid, artistId)
    local row = MySQL.single.await([[SELECT a.id,a.artist_name,a.bio,a.avatar_url,
        (a.citizenid=?) AS is_owner,
        EXISTS(SELECT 1 FROM wave_follows f WHERE f.citizenid=? AND f.artist_id=a.id) AS following,
        (SELECT COUNT(*) FROM wave_follows f2 WHERE f2.artist_id=a.id) AS follower_count,
        (SELECT COUNT(*) FROM wave_tracks t WHERE t.artist_id=a.id AND t.status='public') AS track_count
        FROM wave_artists a WHERE a.id=? AND a.status='active' LIMIT 1]], {citizenid,citizenid,artistId})
    if not row then return nil end
    row.id=tonumber(row.id)
    row.is_owner=tonumber(row.is_owner or 0)==1
    row.following=tonumber(row.following or 0)==1
    row.follower_count=tonumber(row.follower_count or 0)
    row.track_count=tonumber(row.track_count or 0)
    return row
end

local function publicArtistTracks(citizenid, artistId)
    local subscription = getSubscription(citizenid)
    local subscriptionActive = WaveConfig.Subscription.enabled and tonumber(subscription.active or 0) == 1
    local rows = MySQL.query.await([[SELECT t.*,a.artist_name,a.citizenid AS creator_citizenid,
        EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned
        FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.artist_id=? AND t.status='public' AND a.status='active'
        ORDER BY t.published_at DESC,t.id DESC LIMIT 100]], {citizenid,citizenid,artistId}) or {}
    return normalizeRows(rows,citizenid,subscriptionActive)
end

local function listOwnPlaylists(citizenid)
    local rows = MySQL.query.await([[SELECT p.id,p.name,p.description,p.is_public,p.created_at,p.updated_at,
        (SELECT COUNT(*) FROM wave_playlist_tracks pt WHERE pt.playlist_id=p.id) AS track_count
        FROM wave_playlists p WHERE p.citizenid=? AND p.deleted_at IS NULL
        ORDER BY p.updated_at DESC,p.id DESC LIMIT ?]], {citizenid,WaveConfig.Limits.maxPlaylists}) or {}
    for _,row in ipairs(rows) do
        row.id=tonumber(row.id)
        row.track_count=tonumber(row.track_count or 0)
        row.is_public=tonumber(row.is_public or 0)==1
    end
    return rows
end

local function listAlbumsForArtist(artistId, includeNonPublic)
    local statusClause = includeNonPublic and "status<>'deleted'" or "status='public'"
    local rows=MySQL.query.await([[SELECT id,title,description,release_type,status,published_at,created_at,updated_at,
        (SELECT COUNT(*) FROM wave_album_tracks at WHERE at.album_id=wave_albums.id) AS track_count
        FROM wave_albums WHERE artist_id=? AND ]]..statusClause..[[
        ORDER BY COALESCE(published_at,created_at) DESC,id DESC LIMIT 50]],{artistId}) or {}
    for _,row in ipairs(rows) do
        row.id=tonumber(row.id)
        row.track_count=tonumber(row.track_count or 0)
    end
    return rows
end

local function ownPublicTrackChoices(artistId)
    local rows=MySQL.query.await([[SELECT id,title,genre,published_at FROM wave_tracks
        WHERE artist_id=? AND status='public' ORDER BY published_at DESC,id DESC LIMIT 100]],{artistId}) or {}
    for _,row in ipairs(rows) do row.id=tonumber(row.id) end
    return rows
end

local function cbGetRingtone(source)
    if limited(source,'getRingtone',250) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    return {ok=true,ringtone=loadSavedRingtone(citizenid) or false}
end

local function cbSaveRingtone(source,data)
    if limited(source,'saveRingtone',700) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local trackId=tonumber(data.trackId)
    if not citizenid or not trackId or trackId<1 or trackId%1~=0 then return {ok=false,error='INVALID_REQUEST'} end
    local track,trackError=getEligibleRingtoneTrack(citizenid,trackId)
    if not track then return {ok=false,error=trackError} end
    local projectBpm=math.max(60,math.min(200,tonumber(track.project.bpm) or 120))
    local projectBars=math.max(1,math.min(WaveConfig.Limits.maxBars,math.floor(tonumber(track.project.bars) or 4)))
    local selection,selectionError=normalizedRingtoneSelection(data,projectBars*240/projectBpm)
    if not selection then return {ok=false,error=selectionError} end
    local changed=MySQL.update.await([[INSERT INTO wave_ringtones
        (citizenid,track_id,start_seconds,end_seconds,fade_in_ms,fade_out_ms,gain)
        VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE track_id=VALUES(track_id),
        start_seconds=VALUES(start_seconds),end_seconds=VALUES(end_seconds),
        fade_in_ms=VALUES(fade_in_ms),fade_out_ms=VALUES(fade_out_ms),gain=VALUES(gain)]],
        {citizenid,trackId,selection.startSeconds,selection.endSeconds,selection.fadeInMs,selection.fadeOutMs,selection.gain})
    if changed==nil then return {ok=false,error='DB_TRANSACTION_FAILED'} end
    return {ok=true,ringtone=loadSavedRingtone(citizenid) or false}
end

local function cbClearRingtone(source)
    if limited(source,'clearRingtone',500) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local changed=MySQL.update.await('DELETE FROM wave_ringtones WHERE citizenid=?',{citizenid}) or 0
    return {ok=true,removed=changed>0,ringtone=false}
end

local function cbBootstrap(source)
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    ensureWallet(citizenid)
    local artist = getArtistAny(citizenid)
    if artist then
        artist.creator_name = refreshCreatorName(source, citizenid)
        artist.id = tonumber(artist.id)
        -- The client only needs its own status, not the hidden creator identity.
        artist.creator_name = nil
        artist.citizenid = nil
    end
    local wallet = getWallet(citizenid)
    local sub = getSubscription(citizenid)
    return {
        ok=true,
        user={characterName=getCharacterName(source)},
        artist=artist,
        wallet=wallet,
        ringtone=loadSavedRingtone(citizenid) or false,
        subscription={enabled=WaveConfig.Subscription.enabled,active=tonumber(sub.active or 0)==1,status=sub.status,expiresAt=sub.expires_at},
        canAdmin=isAdmin(source),
        config={
            limits={maxTracks=WaveConfig.Limits.maxTracks,maxBars=WaveConfig.Limits.maxBars,maxNotesPerTrack=WaveConfig.Limits.maxNotesPerTrack,maxNotesTotal=WaveConfig.Limits.maxNotesTotal,maxPlaylists=WaveConfig.Limits.maxPlaylists,maxPlaylistTracks=WaveConfig.Limits.maxPlaylistTracks,maxAlbumTracks=WaveConfig.Limits.maxAlbumTracks},
            economy={platformShare=WaveConfig.Economy.platformShare,minimumWithdraw=WaveConfig.Economy.minimumWithdraw,defaultTrackPrice=WaveConfig.Economy.defaultTrackPrice,maxTrackPrice=WaveConfig.Economy.maxTrackPrice,currency=WaveConfig.Economy.currency},
            subscription={enabled=WaveConfig.Subscription.enabled,name=WaveConfig.Subscription.name,previewSeconds=WaveConfig.Subscription.previewSeconds}
        },
        home=sectionTracks(citizenid,'new',12),
        homeSections={
            recent=sectionTracks(citizenid,'recent',8),
            following=sectionTracks(citizenid,'following',12),
            trending=sectionTracks(citizenid,'trending',12),
            newest=sectionTracks(citizenid,'new',12)
        },
        playlists=listOwnPlaylists(citizenid)
    }
end

local function cbCreateArtist(source, data)
    if limited(source,'createArtist',1200) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local name = clampText(data.artistName, WaveConfig.Limits.artistName)
    local bio = clampText(data.bio, WaveConfig.Limits.bio)
    if textLength(name) < 2 then return {ok=false,error='ARTIST_NAME_TOO_SHORT'} end
    local existing = getArtistAny(citizenid)
    if existing and existing.status == 'suspended' then return {ok=false,error='ARTIST_SUSPENDED'} end
    if existing and existing.status == 'deleted' then return {ok=false,error='ARTIST_DELETED'} end
    if existing then
        MySQL.update.await('UPDATE wave_artists SET artist_name=?,bio=?,creator_name=? WHERE citizenid=?', {name,bio,getCharacterName(source),citizenid})
    else
        MySQL.insert.await('INSERT INTO wave_artists (citizenid,creator_name,artist_name,bio) VALUES (?,?,?,?)', {citizenid,getCharacterName(source),name,bio})
    end
    ensureWallet(citizenid)
    local artist = getArtistAny(citizenid)
    if artist then artist.creator_name=nil artist.citizenid=nil artist.id=tonumber(artist.id) end
    return {ok=true,artist=artist}
end

local function cbSaveProject(source, data)
    if limited(source,'saveProject',350) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local encoded, normalized, err = encodeProject(data.project)
    if not encoded then return {ok=false,error=err} end
    local title = clampText(data.title or normalized.title or 'Untitled', WaveConfig.Limits.projectTitle)
    if title == '' then title = 'Untitled' end
    normalized.title = title
    encoded = json.encode(normalized)
    if #encoded > WaveConfig.Limits.projectJsonBytes then return {ok=false,error='PROJECT_TOO_LARGE'} end
    local id = tonumber(data.id)
    if id then
        local changed = MySQL.update.await([[UPDATE wave_projects SET title=?,project_json=?
            WHERE id=? AND citizenid=? AND deleted_at IS NULL]], {title,encoded,id,citizenid})
        -- A no-op UPDATE can report zero affected rows even when the project exists.
        if changed == 0 then
            local exists = tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_projects
                WHERE id=? AND citizenid=? AND deleted_at IS NULL]], {id,citizenid}) or 0) > 0
            if not exists then return {ok=false,error='PROJECT_NOT_FOUND'} end
        elseif not changed then
            return {ok=false,error='DB_TRANSACTION_FAILED'}
        end
        return {ok=true,id=id}
    end
    local newId = MySQL.insert.await('INSERT INTO wave_projects (citizenid,title,project_json) VALUES (?,?,?)', {citizenid,title,encoded})
    return {ok=true,id=tonumber(newId)}
end

local function cbListProjects(source)
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local rows = MySQL.query.await([[SELECT id,title,created_at,updated_at FROM wave_projects
        WHERE citizenid=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50]], {citizenid}) or {}
    for _, row in ipairs(rows) do row.id=tonumber(row.id) end
    return {ok=true,projects=rows}
end

local function cbGetProject(source, data)
    local citizenid = getCitizenId(source)
    local id = tonumber(data.id)
    if not citizenid or not id then return {ok=false,error='INVALID_REQUEST'} end
    local row = MySQL.single.await('SELECT id,title,project_json FROM wave_projects WHERE id=? AND citizenid=? AND deleted_at IS NULL', {id,citizenid})
    if not row then return {ok=false,error='PROJECT_NOT_FOUND'} end
    return {ok=true,project={id=tonumber(row.id),title=row.title,data=decodeJson(row.project_json,{})}}
end

local function cbDeleteProject(source, data)
    if limited(source,'deleteProject',500) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    local id = tonumber(data.id)
    if not citizenid or not id then return {ok=false,error='INVALID_REQUEST'} end
    local changed = MySQL.update.await('UPDATE wave_projects SET deleted_at=NOW() WHERE id=? AND citizenid=? AND deleted_at IS NULL', {id,citizenid})
    if changed < 1 then return {ok=false,error='PROJECT_NOT_FOUND'} end
    return {ok=true}
end

local publishingProjects = {}

local function cbPublishTrack(source, data)
    if limited(source,'publishTrack',1200) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end

    local requestId = clampText(data.requestId or '', 64)
    local titleForLog = clampText(data.title or '', WaveConfig.Limits.trackTitle)
    local function publishLog(message)
        print(('[WAVE] publish %s source=%s citizen=%s request=%s title=%s'):format(
            tostring(message), tostring(source), tostring(citizenid),
            requestId ~= '' and requestId or '-', titleForLog ~= '' and titleForLog or '-'))
    end

    if data.rightsConfirmed ~= true then return {ok=false,error='RIGHTS_CONFIRMATION_REQUIRED'} end
    local artist = getArtist(citizenid)
    if not artist then return {ok=false,error='ARTIST_REQUIRED'} end
    local wallet = getWallet(citizenid)
    if tonumber(wallet.frozen or 0) == 1 then return {ok=false,error='WALLET_FROZEN'} end

    local encoded, normalized, err = encodeProject(data.project)
    if not encoded then return {ok=false,error=err} end

    local noteCount = 0
    for _, track in ipairs(normalized.tracks or {}) do noteCount = noteCount + #(track.notes or {}) end
    if noteCount < 1 then return {ok=false,error='PROJECT_EMPTY'} end

    local title = clampText(data.title, WaveConfig.Limits.trackTitle)
    if textLength(title) < 1 then return {ok=false,error='TITLE_REQUIRED'} end
    local description = clampText(data.description, WaveConfig.Limits.description)
    local genre = clampText(data.genre or 'OTHER', 32):upper()
    local access = tostring(data.accessMode or 'free')
    local allowed = {free=true,subscription=true,purchase=true,both=true}
    if not allowed[access] then access='free' end
    if (access=='subscription' or access=='both') and not WaveConfig.Subscription.enabled then
        access = access == 'both' and 'purchase' or 'free'
    end

    local price = math.floor(tonumber(data.price) or 0)
    price = math.max(0, math.min(price, WaveConfig.Economy.maxTrackPrice))
    if access=='purchase' or access=='both' then
        if price < 1 then price = WaveConfig.Economy.defaultTrackPrice end
    else
        price = 0
    end

    local rightsInput = type(data.rights)=='table' and data.rights or {}
    local rights = {
        personal = rightsInput.personal ~= false,
        ringtone = rightsInput.ringtone == true,
        notification = rightsInput.notification == true,
        storeBgm = rightsInput.storeBgm == true,
        event = rightsInput.event == true,
        remix = rightsInput.remix == true
    }

    local projectId = tonumber(data.projectId)
    if projectId then
        local owner = tonumber(MySQL.scalar.await(
            'SELECT COUNT(*) FROM wave_projects WHERE id=? AND citizenid=? AND deleted_at IS NULL',
            {projectId,citizenid}) or 0) > 0
        if not owner then return {ok=false,error='PROJECT_NOT_FOUND'} end
    end

    local stepDuration = 60 / normalized.bpm / 4
    local calculatedDuration = math.ceil(normalized.bars * 16 * stepDuration)
    local duration = math.min(calculatedDuration, WaveConfig.Limits.maxDurationSeconds)

    -- A saved project is the stable identity of one release. Reject duplicate
    -- publication even if a client sends a fresh requestId or repeats a tap.
    if not projectId or projectId < 1 or projectId % 1 ~= 0 then
        return {ok=false,error='PROJECT_NOT_SAVED'}
    end
    local key = tostring(artist.id) .. ':' .. tostring(projectId)
    if publishingProjects[key] then return {ok=false,error='PUBLISH_IN_PROGRESS'} end
    publishingProjects[key] = true

    -- FiveM Lua callbacks can overlap while awaiting SQL. Keep the guard across
    -- both lookup and INSERT; always release it after success or an exception.
    local worked, result = pcall(function()
        local existing = MySQL.single.await([[SELECT id,status FROM wave_tracks
            WHERE artist_id=? AND project_id=? AND status IN ('public','private','suspended')
            ORDER BY id DESC LIMIT 1]], {artist.id,projectId})
        if existing then
            publishLog(('duplicate track=%s'):format(tostring(existing.id)))
            return {ok=false,error='PROJECT_ALREADY_RELEASED',existingId=tonumber(existing.id)}
        end

        publishLog('begin')
        local inserted = MySQL.insert.await([[INSERT INTO wave_tracks
            (artist_id,project_id,title,description,genre,access_mode,price,rights_json,project_json,duration_seconds,status,published_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,'public',NOW())]],
            {artist.id,projectId,title,description,genre,access,price,json.encode(rights),encoded,duration})

        local id = tonumber(inserted)
        if not id or id < 1 then error('WAVE_INSERT_RETURNED_NO_ID') end
        publishLog(('ok track=%d'):format(id))
        return {ok=true,id=id,requestId=requestId}
    end)

    publishingProjects[key] = nil
    if not worked then
        print(('[WAVE] publish database error request=%s: %s'):format(
            requestId ~= '' and requestId or '-', tostring(result)))
        return {ok=false,error='PUBLISH_DB_FAILED'}
    end
    return result
end

local function cbListOwnTracks(source)
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local artist = getArtistAny(citizenid)
    if not artist then return {ok=true,tracks={}} end
    local rows = MySQL.query.await([[SELECT id,title,genre,status,access_mode,price,published_at,updated_at
        FROM wave_tracks WHERE artist_id=? ORDER BY updated_at DESC,id DESC LIMIT 100]], {artist.id}) or {}
    for _, row in ipairs(rows) do
        row.id = tonumber(row.id)
        row.price = tonumber(row.price or 0)
    end
    return {ok=true,tracks=rows}
end

local function cbUpdateOwnTrack(source,data)
    if limited(source,'updateOwnTrack',500) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    local trackId = tonumber(data.trackId)
    local action = tostring(data.action or '')
    if not citizenid or not trackId then return {ok=false,error='INVALID_REQUEST'} end
    local artist = getArtistAny(citizenid)
    if not artist then return {ok=false,error='ARTIST_REQUIRED'} end

    local row = MySQL.single.await('SELECT id,status FROM wave_tracks WHERE id=? AND artist_id=? LIMIT 1',{trackId,artist.id})
    if not row then return {ok=false,error='TRACK_NOT_FOUND'} end
    if row.status == 'suspended' then return {ok=false,error='TRACK_SUSPENDED'} end
    if row.status == 'deleted' then return {ok=false,error='TRACK_NOT_FOUND'} end

    -- Atomic status predicates prevent a stale owner action from undoing moderation.
    if action == 'unpublish' then
        if row.status ~= 'public' then return {ok=false,error='INVALID_ACTION'} end
        local changed = MySQL.update.await("UPDATE wave_tracks SET status='private' WHERE id=? AND artist_id=? AND status='public'",{trackId,artist.id})
        if not changed or changed < 1 then return {ok=false,error='TRACK_STATE_CHANGED'} end
        return {ok=true,status='private'}
    elseif action == 'publish' then
        if artist.status ~= 'active' then return {ok=false,error='ARTIST_SUSPENDED'} end
        if row.status ~= 'private' then return {ok=false,error='INVALID_ACTION'} end
        local changed = MySQL.update.await([[UPDATE wave_tracks SET status='public',published_at=COALESCE(published_at,NOW())
            WHERE id=? AND artist_id=? AND status='private'
              AND EXISTS (SELECT 1 FROM wave_artists WHERE id=? AND status='active')]],{trackId,artist.id,artist.id})
        if not changed or changed < 1 then return {ok=false,error='TRACK_STATE_CHANGED'} end
        return {ok=true,status='public'}
    elseif action == 'delete' then
        local changed = MySQL.update.await("UPDATE wave_tracks SET status='deleted' WHERE id=? AND artist_id=? AND status IN ('public','private')",{trackId,artist.id})
        if not changed or changed < 1 then return {ok=false,error='TRACK_STATE_CHANGED'} end
        return {ok=true,status='deleted'}
    end
    return {ok=false,error='INVALID_ACTION'}
end


local function cbListHome(source)
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local sections={
        recent=sectionTracks(citizenid,'recent',8),
        following=sectionTracks(citizenid,'following',12),
        trending=sectionTracks(citizenid,'trending',12),
        newest=sectionTracks(citizenid,'new',12)
    }
    return {ok=true,tracks=sections.newest,sections=sections}
end

local function cbSearch(source,data)
    if limited(source,'search',250) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local q = clampText(data.q, 80)
    local term='%'..q..'%'
    local artists={}
    if q~='' then
        artists=MySQL.query.await([[SELECT a.id,a.artist_name,a.bio,a.avatar_url,
            EXISTS(SELECT 1 FROM wave_follows f WHERE f.citizenid=? AND f.artist_id=a.id) AS following,
            (SELECT COUNT(*) FROM wave_follows f2 WHERE f2.artist_id=a.id) AS follower_count,
            (SELECT COUNT(*) FROM wave_tracks t WHERE t.artist_id=a.id AND t.status='public') AS track_count
            FROM wave_artists a WHERE a.status='active' AND (a.artist_name LIKE ? OR a.bio LIKE ?)
            ORDER BY track_count DESC,a.updated_at DESC LIMIT 20]],{citizenid,term,term}) or {}
        for _,a in ipairs(artists) do
            a.id=tonumber(a.id)
            a.following=tonumber(a.following or 0)==1
            a.follower_count=tonumber(a.follower_count or 0)
            a.track_count=tonumber(a.track_count or 0)
        end
    end
    return {ok=true,tracks=publicTracks(citizenid,q),artists=artists}
end

local function cbListLibrary(source)
    local citizenid = getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local subscription = getSubscription(citizenid)
    local subscriptionActive = WaveConfig.Subscription.enabled and tonumber(subscription.active or 0) == 1
    local rows = MySQL.query.await([[SELECT t.*,a.artist_name,a.citizenid AS creator_citizenid,
        EXISTS(SELECT 1 FROM wave_favorites f2 WHERE f2.citizenid=? AND f2.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned
        FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.status='public' AND a.status='active' AND (
            a.citizenid=? OR EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id)
            OR EXISTS(SELECT 1 FROM wave_purchases pp WHERE pp.buyer_citizenid=? AND pp.track_id=t.id)
        ) ORDER BY t.updated_at DESC LIMIT 100]], {citizenid,citizenid,citizenid,citizenid,citizenid}) or {}
    normalizeRows(rows,citizenid,subscriptionActive)
    return {ok=true,tracks=rows,projects=(cbListProjects(source).projects or {}),playlists=listOwnPlaylists(citizenid)}
end

local function cbToggleFavorite(source,data)
    if limited(source,'favorite',250) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    local trackId = tonumber(data.trackId)
    if not citizenid or not trackId then return {ok=false,error='INVALID_REQUEST'} end
    local visible = tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.id=? AND t.status='public' AND a.status='active']],{trackId}) or 0)>0
    if not visible then return {ok=false,error='TRACK_NOT_FOUND'} end
    local exists = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM wave_favorites WHERE citizenid=? AND track_id=?',{citizenid,trackId}) or 0)>0
    if exists then
        MySQL.update.await('DELETE FROM wave_favorites WHERE citizenid=? AND track_id=?',{citizenid,trackId})
        return {ok=true,favorite=false}
    end
    MySQL.insert.await('INSERT IGNORE INTO wave_favorites (citizenid,track_id) VALUES (?,?)',{citizenid,trackId})
    return {ok=true,favorite=true}
end

local function cbRemoveLibraryTrack(source,data)
    if limited(source,'removeLibraryTrack',250) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local trackId=tonumber(data.trackId)
    if not citizenid or not trackId then return {ok=false,error='INVALID_REQUEST'} end
    -- Remove only this player's saved-library association. Track, purchase and revenue rows stay intact.
    local changed=MySQL.update.await('DELETE FROM wave_favorites WHERE citizenid=? AND track_id=?',{citizenid,trackId}) or 0
    return {ok=true,favorite=false,removed=changed>0}
end

local function cbArtistDetail(source,data)
    if limited(source,'artistDetail',180) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local artistId=tonumber(data.artistId)
    if not citizenid or not artistId then return {ok=false,error='INVALID_REQUEST'} end
    local artist=publicArtistSummary(citizenid,artistId)
    if not artist then return {ok=false,error='ARTIST_NOT_FOUND'} end
    return {ok=true,artist=artist,tracks=publicArtistTracks(citizenid,artistId),albums=listAlbumsForArtist(artistId,false)}
end

local function cbToggleFollow(source,data)
    if limited(source,'follow',250) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local artistId=tonumber(data.artistId)
    if not citizenid or not artistId then return {ok=false,error='INVALID_REQUEST'} end
    local artist=MySQL.single.await("SELECT id,citizenid FROM wave_artists WHERE id=? AND status='active' LIMIT 1",{artistId})
    if not artist then return {ok=false,error='ARTIST_NOT_FOUND'} end
    if tostring(artist.citizenid)==citizenid then return {ok=false,error='OWN_ARTIST'} end
    local exists=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM wave_follows WHERE citizenid=? AND artist_id=?',{citizenid,artistId}) or 0)>0
    if exists then
        MySQL.update.await('DELETE FROM wave_follows WHERE citizenid=? AND artist_id=?',{citizenid,artistId})
        return {ok=true,following=false}
    end
    MySQL.insert.await('INSERT IGNORE INTO wave_follows (citizenid,artist_id) VALUES (?,?)',{citizenid,artistId})
    return {ok=true,following=true}
end

local function getOwnPlaylist(citizenid,playlistId)
    return MySQL.single.await([[SELECT id,citizenid,name,description,is_public FROM wave_playlists
        WHERE id=? AND citizenid=? AND deleted_at IS NULL LIMIT 1]],{playlistId,citizenid})
end

local function cbListPlaylists(source)
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    return {ok=true,playlists=listOwnPlaylists(citizenid)}
end

local function cbSavePlaylist(source,data)
    if limited(source,'savePlaylist',350) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local name=clampText(data.name,WaveConfig.Limits.playlistName)
    local description=clampText(data.description,WaveConfig.Limits.playlistDescription)
    if textLength(name)<1 then return {ok=false,error='PLAYLIST_NAME_REQUIRED'} end
    local playlistId=tonumber(data.id)
    local isPublic=data.isPublic==true and 1 or 0
    if playlistId then
        local changed=MySQL.update.await([[UPDATE wave_playlists SET name=?,description=?,is_public=?
            WHERE id=? AND citizenid=? AND deleted_at IS NULL]],{name,description,isPublic,playlistId,citizenid})
        -- Re-saving unchanged metadata must not be treated as a missing playlist.
        if changed == 0 then
            local exists = tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_playlists
                WHERE id=? AND citizenid=? AND deleted_at IS NULL]], {playlistId,citizenid}) or 0) > 0
            if not exists then return {ok=false,error='PLAYLIST_NOT_FOUND'} end
        elseif not changed then
            return {ok=false,error='DB_TRANSACTION_FAILED'}
        end
        return {ok=true,id=playlistId,playlists=listOwnPlaylists(citizenid)}
    end
    local count=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM wave_playlists WHERE citizenid=? AND deleted_at IS NULL',{citizenid}) or 0)
    if count>=WaveConfig.Limits.maxPlaylists then return {ok=false,error='PLAYLIST_LIMIT'} end
    local id=MySQL.insert.await('INSERT INTO wave_playlists (citizenid,name,description,is_public) VALUES (?,?,?,?)',{citizenid,name,description,isPublic})
    return {ok=true,id=tonumber(id),playlists=listOwnPlaylists(citizenid)}
end

local function cbGetPlaylist(source,data)
    local citizenid=getCitizenId(source)
    local playlistId=tonumber(data.playlistId)
    if not citizenid or not playlistId then return {ok=false,error='INVALID_REQUEST'} end
    local playlist=getOwnPlaylist(citizenid,playlistId)
    if not playlist then return {ok=false,error='PLAYLIST_NOT_FOUND'} end
    playlist.id=tonumber(playlist.id)
    playlist.is_public=tonumber(playlist.is_public or 0)==1
    local subscription=getSubscription(citizenid)
    local subscriptionActive=WaveConfig.Subscription.enabled and tonumber(subscription.active or 0)==1
    local rows=MySQL.query.await([[SELECT t.*,a.artist_name,a.citizenid AS creator_citizenid,pt.position,
        EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned
        FROM wave_playlist_tracks pt JOIN wave_tracks t ON t.id=pt.track_id
        JOIN wave_artists a ON a.id=t.artist_id
        WHERE pt.playlist_id=? AND t.status='public' AND a.status='active'
        ORDER BY pt.position ASC,pt.added_at ASC,pt.track_id ASC]],{citizenid,citizenid,playlistId}) or {}
    return {ok=true,playlist=playlist,tracks=normalizeRows(rows,citizenid,subscriptionActive)}
end

local function cbDeletePlaylist(source,data)
    if limited(source,'deletePlaylist',400) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local playlistId=tonumber(data.playlistId)
    if not citizenid or not playlistId then return {ok=false,error='INVALID_REQUEST'} end
    if not getOwnPlaylist(citizenid,playlistId) then return {ok=false,error='PLAYLIST_NOT_FOUND'} end
    local success=MySQL.transaction.await({
        {query='UPDATE wave_playlists SET deleted_at=NOW() WHERE id=? AND citizenid=? AND deleted_at IS NULL',values={playlistId,citizenid}},
        {query=[[DELETE FROM wave_playlist_tracks WHERE playlist_id=? AND EXISTS(
            SELECT 1 FROM wave_playlists WHERE id=? AND citizenid=? AND deleted_at IS NOT NULL
        )]],values={playlistId,playlistId,citizenid}}
    })
    if not success then return {ok=false,error='DB_TRANSACTION_FAILED'} end
    return {ok=true,playlists=listOwnPlaylists(citizenid)}
end

local function cbAddPlaylistTrack(source,data)
    if limited(source,'playlistTrack',180) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local playlistId=tonumber(data.playlistId)
    local trackId=tonumber(data.trackId)
    if not citizenid or not playlistId or not trackId then return {ok=false,error='INVALID_REQUEST'} end
    if not getOwnPlaylist(citizenid,playlistId) then return {ok=false,error='PLAYLIST_NOT_FOUND'} end
    local visible=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.id=? AND t.status='public' AND a.status='active']],{trackId}) or 0)>0
    if not visible then return {ok=false,error='TRACK_NOT_FOUND'} end
    local alreadyAdded=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM wave_playlist_tracks WHERE playlist_id=? AND track_id=?',{playlistId,trackId}) or 0)>0
    if alreadyAdded then return {ok=true,added=false} end
    local count=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM wave_playlist_tracks WHERE playlist_id=?',{playlistId}) or 0)
    if count>=WaveConfig.Limits.maxPlaylistTracks then return {ok=false,error='PLAYLIST_TRACK_LIMIT'} end
    local position=tonumber(MySQL.scalar.await('SELECT COALESCE(MAX(position),0)+1 FROM wave_playlist_tracks WHERE playlist_id=?',{playlistId}) or 1)
    local inserted=MySQL.update.await('INSERT IGNORE INTO wave_playlist_tracks (playlist_id,track_id,position) VALUES (?,?,?)',{playlistId,trackId,position}) or 0
    if inserted>0 then MySQL.update.await('UPDATE wave_playlists SET updated_at=NOW() WHERE id=?',{playlistId}) end
    return {ok=true,added=inserted>0}
end

local function cbRemovePlaylistTrack(source,data)
    if limited(source,'playlistTrack',180) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local playlistId=tonumber(data.playlistId)
    local trackId=tonumber(data.trackId)
    if not citizenid or not playlistId or not trackId then return {ok=false,error='INVALID_REQUEST'} end
    if not getOwnPlaylist(citizenid,playlistId) then return {ok=false,error='PLAYLIST_NOT_FOUND'} end
    local changed=MySQL.update.await('DELETE FROM wave_playlist_tracks WHERE playlist_id=? AND track_id=?',{playlistId,trackId}) or 0
    if changed>0 then MySQL.update.await('UPDATE wave_playlists SET updated_at=NOW() WHERE id=?',{playlistId}) end
    return {ok=true,removed=changed>0,playlists=listOwnPlaylists(citizenid)}
end

local function cbMovePlaylistTrack(source,data)
    if limited(source,'playlistTrack',180) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local playlistId=tonumber(data.playlistId)
    local trackId=tonumber(data.trackId)
    local direction=tostring(data.direction or '')
    if not citizenid or not playlistId or not trackId or (direction~='up' and direction~='down') then
        return {ok=false,error='INVALID_REQUEST'}
    end
    if not getOwnPlaylist(citizenid,playlistId) then return {ok=false,error='PLAYLIST_NOT_FOUND'} end
    local rows=MySQL.query.await([[SELECT track_id FROM wave_playlist_tracks
        WHERE playlist_id=? ORDER BY position ASC,added_at ASC,track_id ASC]],{playlistId}) or {}
    local index=nil
    for i,row in ipairs(rows) do
        if tonumber(row.track_id)==trackId then index=i break end
    end
    if not index then return {ok=false,error='TRACK_NOT_IN_PLAYLIST'} end
    local destination=index+(direction=='up' and -1 or 1)
    if destination<1 or destination>#rows then return {ok=true,moved=false,playlists=listOwnPlaylists(citizenid)} end
    rows[index],rows[destination]=rows[destination],rows[index]
    local statements={}
    for position,row in ipairs(rows) do
        statements[#statements+1]={query='UPDATE wave_playlist_tracks SET position=? WHERE playlist_id=? AND track_id=?',values={position,playlistId,tonumber(row.track_id)}}
    end
    statements[#statements+1]={query='UPDATE wave_playlists SET updated_at=NOW() WHERE id=? AND citizenid=? AND deleted_at IS NULL',values={playlistId,citizenid}}
    local success=MySQL.transaction.await(statements)
    if not success then return {ok=false,error='DB_TRANSACTION_FAILED'} end
    return {ok=true,moved=true,playlists=listOwnPlaylists(citizenid)}
end

local function cbListOwnAlbums(source)
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local artist=getArtistAny(citizenid)
    if not artist then return {ok=true,albums={},tracks={}} end
    return {ok=true,albums=listAlbumsForArtist(tonumber(artist.id),true),tracks=ownPublicTrackChoices(tonumber(artist.id))}
end

local function cbSaveAlbum(source,data)
    if limited(source,'saveAlbum',700) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    local artist=getArtist(citizenid)
    if not artist then return {ok=false,error='ARTIST_REQUIRED'} end
    local title=clampText(data.title,WaveConfig.Limits.albumTitle)
    local description=clampText(data.description,WaveConfig.Limits.albumDescription)
    if textLength(title)<1 then return {ok=false,error='ALBUM_TITLE_REQUIRED'} end
    local releaseType=tostring(data.releaseType or 'album')
    if releaseType~='ep' and releaseType~='album' then releaseType='album' end
    local rawIds=type(data.trackIds)=='table' and data.trackIds or {}
    local trackIds={}
    local seen={}
    for _,value in ipairs(rawIds) do
        local id=tonumber(value)
        if id and not seen[id] then seen[id]=true trackIds[#trackIds+1]=id end
    end
    if #trackIds<2 then return {ok=false,error='ALBUM_TRACKS_REQUIRED'} end
    if #trackIds>WaveConfig.Limits.maxAlbumTracks then return {ok=false,error='ALBUM_TRACK_LIMIT'} end
    local valid={}
    for _,trackId in ipairs(trackIds) do
        local ok=tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM wave_tracks WHERE id=? AND artist_id=? AND status='public'",{trackId,artist.id}) or 0)>0
        if not ok then return {ok=false,error='ALBUM_TRACK_INVALID'} end
        valid[#valid+1]=trackId
    end
    local albumId=tonumber(data.id)
    if albumId then
        local owned=tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM wave_albums WHERE id=? AND artist_id=? AND status<>'deleted'",{albumId,artist.id}) or 0)>0
        if not owned then return {ok=false,error='ALBUM_NOT_FOUND'} end
        MySQL.update.await([[UPDATE wave_albums SET title=?,description=?,release_type=?,status='public',published_at=COALESCE(published_at,NOW()) WHERE id=?]],{title,description,releaseType,albumId})
    else
        albumId=tonumber(MySQL.insert.await([[INSERT INTO wave_albums (artist_id,title,description,release_type,status,published_at)
            VALUES (?,?,?,?,'public',NOW())]],{artist.id,title,description,releaseType}))
    end
    local statements={{query='DELETE FROM wave_album_tracks WHERE album_id=?',values={albumId}}}
    for index,trackId in ipairs(valid) do
        statements[#statements+1]={query='INSERT INTO wave_album_tracks (album_id,track_id,position) VALUES (?,?,?)',values={albumId,trackId,index}}
    end
    local success=MySQL.transaction.await(statements)
    if not success then
        if not tonumber(data.id) then MySQL.update.await("UPDATE wave_albums SET status='deleted' WHERE id=?",{albumId}) end
        return {ok=false,error='DB_TRANSACTION_FAILED'}
    end
    return {ok=true,id=albumId,albums=listAlbumsForArtist(tonumber(artist.id),true)}
end

local function cbDeleteAlbum(source,data)
    if limited(source,'deleteAlbum',400) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local albumId=tonumber(data.albumId)
    if not citizenid or not albumId then return {ok=false,error='INVALID_REQUEST'} end
    local artist=getArtistAny(citizenid)
    if not artist then return {ok=false,error='ARTIST_REQUIRED'} end
    local changed=MySQL.update.await("UPDATE wave_albums SET status='deleted' WHERE id=? AND artist_id=? AND status<>'deleted'",{albumId,artist.id})
    if changed<1 then return {ok=false,error='ALBUM_NOT_FOUND'} end
    return {ok=true,albums=listAlbumsForArtist(tonumber(artist.id),true)}
end

local function cbAlbumDetail(source,data)
    if limited(source,'albumDetail',180) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local albumId=tonumber(data.albumId)
    if not citizenid or not albumId then return {ok=false,error='INVALID_REQUEST'} end
    local album=MySQL.single.await([[SELECT al.id,al.artist_id,al.title,al.description,al.release_type,al.published_at,a.artist_name
        FROM wave_albums al JOIN wave_artists a ON a.id=al.artist_id
        WHERE al.id=? AND al.status='public' AND a.status='active' LIMIT 1]],{albumId})
    if not album then return {ok=false,error='ALBUM_NOT_FOUND'} end
    album.id=tonumber(album.id)
    album.artist_id=tonumber(album.artist_id)
    local subscription=getSubscription(citizenid)
    local subscriptionActive=WaveConfig.Subscription.enabled and tonumber(subscription.active or 0)==1
    local rows=MySQL.query.await([[SELECT t.*,a.artist_name,a.citizenid AS creator_citizenid,at.position,
        EXISTS(SELECT 1 FROM wave_favorites f WHERE f.citizenid=? AND f.track_id=t.id) AS favorite,
        EXISTS(SELECT 1 FROM wave_purchases p WHERE p.buyer_citizenid=? AND p.track_id=t.id AND p.purchase_type='personal') AS owned
        FROM wave_album_tracks at JOIN wave_tracks t ON t.id=at.track_id JOIN wave_artists a ON a.id=t.artist_id
        WHERE at.album_id=? AND t.status='public' AND a.status='active'
        ORDER BY at.position ASC]],{citizenid,citizenid,albumId}) or {}
    return {ok=true,album=album,tracks=normalizeRows(rows,citizenid,subscriptionActive)}
end

local function cbPurchaseTrack(source,data)
    if limited(source,'purchase',900) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid = getCitizenId(source)
    local trackId = tonumber(data.trackId)
    if not citizenid or not trackId then return {ok=false,error='INVALID_REQUEST'} end
    return withEconomyLock(citizenid, function()
    local row = MySQL.single.await([[SELECT t.id,t.price,t.access_mode,a.citizenid AS creator_citizenid
        FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.id=? AND t.status='public' AND a.status='active' LIMIT 1]],{trackId})
    if not row then return {ok=false,error='TRACK_NOT_FOUND'} end
    if tostring(row.creator_citizenid)==citizenid then return {ok=false,error='OWN_TRACK'} end
    if row.access_mode~='purchase' and row.access_mode~='both' then return {ok=false,error='NOT_FOR_SALE'} end
    local price=tonumber(row.price or 0)
    if price<1 then return {ok=false,error='INVALID_PRICE'} end
    local already=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_purchases
        WHERE buyer_citizenid=? AND track_id=? AND purchase_type='personal']],{citizenid,trackId}) or 0)>0
    if already then return {ok=true,alreadyOwned=true} end

    local player=getPlayer(source)
    if not player or not player.Functions then return {ok=false,error='PLAYER_NOT_READY'} end
    local debitOk, removed = pcall(function()
        return player.Functions.RemoveMoney('bank',price,'WAVE track purchase')
    end)
    if not debitOk then
        -- An exception may happen after a bank mutation. Never retry automatically.
        print(('[WAVE] BANK_DEBIT_UNCERTAIN citizenid=%s track=%s: %s'):format(citizenid,tostring(trackId),tostring(removed)))
        return {ok=false,error='BANK_STATE_UNCERTAIN'}
    end
    if not removed then return {ok=false,error='INSUFFICIENT_FUNDS'} end

    local share = clampNumber(WaveConfig.Economy.platformShare, 0, 1, 0.15)
    local platform=math.floor(price*share)
    local creator=price-platform
    local txOk = false
    local txError = nil
    local ok, result = pcall(function()
        return MySQL.transaction.await({
            {query=[[INSERT INTO wave_purchases (buyer_citizenid,track_id,purchase_type,price) VALUES (?,?,'personal',?)]], values={citizenid,trackId,price}},
            {query=[[INSERT INTO wave_wallets (citizenid,balance,lifetime_earned,frozen) VALUES (?,?,?,0)
                ON DUPLICATE KEY UPDATE balance=balance+VALUES(balance),lifetime_earned=lifetime_earned+VALUES(lifetime_earned)]], values={tostring(row.creator_citizenid),creator,creator}},
            {query='UPDATE wave_platform_wallet SET balance=balance+?,lifetime_earned=lifetime_earned+? WHERE id=1', values={platform,platform}},
            {query=[[INSERT INTO wave_transactions (tx_type,citizenid,track_id,gross_amount,creator_amount,platform_amount,meta_json)
                VALUES ('track_sale',?,?,?,?,?,?)]], values={tostring(row.creator_citizenid),trackId,price,creator,platform,json.encode({buyer=citizenid})}}
        })
    end)
    if ok then txOk = result == true else txError = result end
    if not txOk then
        local refundOk, refunded = pcall(function()
            return player.Functions.AddMoney('bank',price,'WAVE purchase rollback')
        end)
        if not refundOk or not refunded then
            -- Manual reconciliation required: the bank API may have partially succeeded.
            print(('[WAVE] BANK_REFUND_RECONCILE citizenid=%s track=%s price=%d success=%s details=%s'):format(
                citizenid,tostring(trackId),price,tostring(refundOk),tostring(refunded)))
            return {ok=false,error='REFUND_RECONCILE_REQUIRED'}
        end
        print(('[WAVE] purchase transaction failed, bank charge refunded: %s'):format(tostring(txError or result)))
        local nowOwned=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_purchases WHERE buyer_citizenid=? AND track_id=? AND purchase_type='personal']],{citizenid,trackId}) or 0)>0
        if nowOwned then return {ok=true,alreadyOwned=true} end
        return {ok=false,error='LEDGER_FAILED'}
    end
    return {ok=true,price=price,creatorAmount=creator,platformAmount=platform}    end)
end

local function cbWithdraw(source)
    if limited(source,'withdraw',1500) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    if not citizenid then return {ok=false,error='PLAYER_NOT_READY'} end
    return withEconomyLock(citizenid, function()
    local wallet=getWallet(citizenid)
    if tonumber(wallet.frozen or 0)==1 then return {ok=false,error='WALLET_FROZEN'} end
    local amount=tonumber(wallet.balance or 0)
    if amount < WaveConfig.Economy.minimumWithdraw then return {ok=false,error='NOTHING_TO_WITHDRAW'} end
    local changed=MySQL.update.await([[UPDATE wave_wallets SET balance=0 WHERE citizenid=? AND balance=? AND frozen=0]],{citizenid,amount})
    if changed<1 then return {ok=false,error='BALANCE_CHANGED'} end
    local player=getPlayer(source)
    local bankOk, added = pcall(function()
        return player and player.Functions and player.Functions.AddMoney('bank',amount,'WAVE creator payout')
    end)
    if not bankOk then
        -- Bank API exception is ambiguous: funds may have been credited already.
        -- Do not automatically restore the wallet (risking duplicate payout).
        print(('[WAVE] PAYOUT_RECONCILE citizenid=%s amount=%d bankException=%s'):format(citizenid,amount,tostring(added)))
        return {ok=false,error='PAYOUT_RECONCILE_REQUIRED'}
    end
    if not added then
        local restoreOk, restored = pcall(function()
            return MySQL.update.await('UPDATE wave_wallets SET balance=balance+? WHERE citizenid=?',{amount,citizenid})
        end)
        if not restoreOk or tonumber(restored or 0) < 1 then
            print(('[WAVE] WALLET_RESTORE_RECONCILE citizenid=%s amount=%d restored=%s'):format(citizenid,amount,tostring(restored)))
            return {ok=false,error='PAYOUT_RECONCILE_REQUIRED'}
        end
        return {ok=false,error='BANK_PAYOUT_FAILED'}
    end
    local ok, err = pcall(function()
        MySQL.insert.await([[INSERT INTO wave_transactions
            (tx_type,citizenid,gross_amount,creator_amount,platform_amount,meta_json)
            VALUES ('withdraw',?,?,?,0,?)]],{citizenid,amount,amount,json.encode({destination='bank'})})
    end)
    if not ok then print(('[WAVE] payout audit insert failed citizenid=%s amount=%s: %s'):format(citizenid,amount,tostring(err))) end
    return {ok=true,amount=amount,wallet=getWallet(citizenid)}    end)
end

local function cbReportTrack(source,data)
    if limited(source,'report',2000) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local trackId=tonumber(data.trackId)
    if not citizenid or not trackId then return {ok=false,error='INVALID_REQUEST'} end
    local visible=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        WHERE t.id=? AND t.status='public' AND a.status='active']],{trackId}) or 0)>0
    if not visible then return {ok=false,error='TRACK_NOT_FOUND'} end
    local duplicate=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_reports WHERE reporter_citizenid=? AND track_id=? AND status='open']],{citizenid,trackId}) or 0)>0
    if duplicate then return {ok=true,alreadyReported=true} end
    local allowed={rights=true,inappropriate=true,plagiarism=true,metadata=true,other=true}
    local category=clampText(data.category or 'other',32)
    if not allowed[category] then category='other' end
    local details=clampText(data.details,500)
    MySQL.insert.await('INSERT INTO wave_reports (reporter_citizenid,track_id,category,details) VALUES (?,?,?,?)',{citizenid,trackId,category,details})
    return {ok=true}
end

local function listenerHasFullAccess(citizenid, row)
    if not row then return false end
    if tostring(row.creator_citizenid or '') == citizenid then return true end
    if row.access_mode == 'free' then return true end
    local owned=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM wave_purchases WHERE buyer_citizenid=? AND track_id=? AND purchase_type='personal']],{citizenid,row.id}) or 0)>0
    if owned then return true end
    if WaveConfig.Subscription.enabled and (row.access_mode=='subscription' or row.access_mode=='both') then
        local sub=getSubscription(citizenid)
        return tonumber(sub.active or 0)==1
    end
    return false
end

local function cbRecordStream(source,data)
    if limited(source,'stream',1000) then return {ok=false,error='RATE_LIMIT'} end
    local citizenid=getCitizenId(source)
    local trackId=tonumber(data.trackId)
    local seconds=math.max(0,math.min(math.floor(tonumber(data.validSeconds) or 0),600))
    if not citizenid or not trackId or seconds<1 then return {ok=false,error='INVALID_REQUEST'} end
    local row=MySQL.single.await([[SELECT t.id,t.duration_seconds,t.access_mode,a.citizenid AS creator_citizenid
        FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id WHERE t.id=? AND t.status='public' AND a.status='active' LIMIT 1]],{trackId})
    if not row then return {ok=false,error='TRACK_NOT_FOUND'} end
    MySQL.query.await([[INSERT INTO wave_recent_plays (citizenid,track_id,play_count,last_played_at)
        VALUES (?,?,1,NOW()) ON DUPLICATE KEY UPDATE play_count=LEAST(play_count+1,65535),last_played_at=NOW()]],{citizenid,trackId})
    if tostring(row.creator_citizenid)==citizenid then return {ok=true,ignored='SELF_STREAM'} end
    if not listenerHasFullAccess(citizenid,row) then return {ok=true,ignored='PREVIEW'} end
    local duration=math.max(1,math.min(tonumber(row.duration_seconds) or seconds,WaveConfig.Limits.maxDurationSeconds))
    seconds=math.min(seconds,duration)
    local dailyCap=math.max(duration*3,60)
    MySQL.query.await([[INSERT INTO wave_stream_daily (track_id,listener_citizenid,stream_date,play_count,valid_seconds)
        VALUES (?,?,CURDATE(),1,?) ON DUPLICATE KEY UPDATE play_count=LEAST(play_count+1,10),valid_seconds=LEAST(valid_seconds+VALUES(valid_seconds),?)]],
        {trackId,citizenid,seconds,dailyCap})
    return {ok=true}
end

local function adminLog(source,action,targetType,targetId,reason)
    MySQL.insert.await([[INSERT INTO wave_admin_logs
        (admin_citizenid,admin_name,action,target_type,target_id,reason) VALUES (?,?,?,?,?,?)]],
        {getCitizenId(source),getCharacterName(source),action,targetType,tostring(targetId),clampText(reason,500)})
end

local function cbAdminOverview(source)
    if not isAdmin(source) then return {ok=false,error='FORBIDDEN'} end
    local tracks=MySQL.query.await([[SELECT t.id,t.title,t.status,t.access_mode,t.price,t.published_at,
        a.artist_name,a.creator_name,a.citizenid AS creator_citizenid
        FROM wave_tracks t JOIN wave_artists a ON a.id=t.artist_id
        ORDER BY t.updated_at DESC LIMIT 100]]) or {}
    local artists=MySQL.query.await([[SELECT a.id,a.artist_name,a.creator_name,a.citizenid,a.status,a.updated_at,
        COALESCE(w.balance,0) AS balance,COALESCE(w.lifetime_earned,0) AS lifetime_earned,COALESCE(w.frozen,0) AS frozen,
        (SELECT COUNT(*) FROM wave_tracks t WHERE t.artist_id=a.id AND t.status<>'deleted') AS track_count
        FROM wave_artists a LEFT JOIN wave_wallets w ON w.citizenid=a.citizenid
        ORDER BY a.updated_at DESC LIMIT 100]]) or {}
    local reports=MySQL.query.await([[SELECT r.id,r.track_id,r.category,r.details,r.status,r.created_at,t.title,a.artist_name,a.creator_name,a.citizenid AS creator_citizenid
        FROM wave_reports r JOIN wave_tracks t ON t.id=r.track_id JOIN wave_artists a ON a.id=t.artist_id
        WHERE r.status='open' ORDER BY r.created_at ASC LIMIT 100]]) or {}
    local logs=MySQL.query.await([[SELECT id,admin_name,action,target_type,target_id,reason,created_at
        FROM wave_admin_logs ORDER BY created_at DESC,id DESC LIMIT 50]]) or {}
    local platform=MySQL.single.await('SELECT balance,lifetime_earned FROM wave_platform_wallet WHERE id=1') or {balance=0,lifetime_earned=0}
    return {ok=true,tracks=tracks,artists=artists,reports=reports,logs=logs,platformWallet=platform}
end

local function cbAdminTrackAction(source,data)
    if not isAdmin(source) then return {ok=false,error='FORBIDDEN'} end
    if limited(source,'adminTrackAction',400) then return {ok=false,error='RATE_LIMIT'} end
    local trackId=tonumber(data.trackId)
    local action=tostring(data.action or '')
    local reason=clampText(data.reason,500)
    if not trackId then return {ok=false,error='INVALID_REQUEST'} end
    local status
    if action=='suspend' then status='suspended'
    elseif action=='restore' then status='public'
    elseif action=='delete' then status='deleted'
    else return {ok=false,error='INVALID_ACTION'} end
    local changed=MySQL.update.await('UPDATE wave_tracks SET status=? WHERE id=?',{status,trackId})
    if changed<1 then return {ok=false,error='TRACK_NOT_FOUND'} end
    adminLog(source,'TRACK_'..action:upper(),'track',trackId,reason)
    return {ok=true,status=status}
end

local function cbAdminArtistAction(source,data)
    if not isAdmin(source) then return {ok=false,error='FORBIDDEN'} end
    if limited(source,'adminArtistAction',400) then return {ok=false,error='RATE_LIMIT'} end
    local artistId=tonumber(data.artistId)
    local action=tostring(data.action or '')
    local reason=clampText(data.reason,500)
    if not artistId then return {ok=false,error='INVALID_REQUEST'} end
    local artist=MySQL.single.await('SELECT id,citizenid,status FROM wave_artists WHERE id=? LIMIT 1',{artistId})
    if not artist then return {ok=false,error='ARTIST_NOT_FOUND'} end
    if action=='suspend' then
        MySQL.update.await("UPDATE wave_artists SET status='suspended' WHERE id=?",{artistId})
    elseif action=='restore' then
        MySQL.update.await("UPDATE wave_artists SET status='active' WHERE id=?",{artistId})
    elseif action=='delete' then
        local success = MySQL.transaction.await({
            {query="UPDATE wave_artists SET status='deleted' WHERE id=?",values={artistId}},
            {query="UPDATE wave_tracks SET status='deleted' WHERE artist_id=? AND status<>'deleted'",values={artistId}}
        })
        if not success then return {ok=false,error='DB_TRANSACTION_FAILED'} end
    elseif action=='freeze' then
        ensureWallet(tostring(artist.citizenid))
        MySQL.update.await('UPDATE wave_wallets SET frozen=1 WHERE citizenid=?',{tostring(artist.citizenid)})
    elseif action=='unfreeze' then
        ensureWallet(tostring(artist.citizenid))
        MySQL.update.await('UPDATE wave_wallets SET frozen=0 WHERE citizenid=?',{tostring(artist.citizenid)})
    else
        return {ok=false,error='INVALID_ACTION'}
    end
    adminLog(source,'ARTIST_'..action:upper(),'artist',artistId,reason)
    return {ok=true}
end

local function cbAdminReportAction(source,data)
    if not isAdmin(source) then return {ok=false,error='FORBIDDEN'} end
    if limited(source,'adminReportAction',300) then return {ok=false,error='RATE_LIMIT'} end
    local reportId=tonumber(data.reportId)
    local action=tostring(data.action or '')
    local reason=clampText(data.reason,500)
    if not reportId then return {ok=false,error='INVALID_REQUEST'} end
    local status = action=='resolve' and 'resolved' or action=='dismiss' and 'dismissed' or nil
    if not status then return {ok=false,error='INVALID_ACTION'} end
    local changed=MySQL.update.await("UPDATE wave_reports SET status=?,resolved_at=NOW() WHERE id=? AND status='open'",{status,reportId})
    if changed<1 then return {ok=false,error='REPORT_NOT_FOUND'} end
    adminLog(source,'REPORT_'..action:upper(),'report',reportId,reason)
    return {ok=true,status=status}
end

local callbacks={
    ['wave:bootstrap']=cbBootstrap,
    ['wave:getRingtone']=cbGetRingtone,
    ['wave:saveRingtone']=cbSaveRingtone,
    ['wave:clearRingtone']=cbClearRingtone,
    ['wave:createArtist']=cbCreateArtist,
    ['wave:listSynthPresets']=cbListSynthPresets,
    ['wave:saveSynthPreset']=cbSaveSynthPreset,
    ['wave:deleteSynthPreset']=cbDeleteSynthPreset,
    ['wave:saveProject']=cbSaveProject,
    ['wave:listProjects']=cbListProjects,
    ['wave:getProject']=cbGetProject,
    ['wave:deleteProject']=cbDeleteProject,
    ['wave:publishTrack']=cbPublishTrack,
    ['wave:listOwnTracks']=cbListOwnTracks,
    ['wave:updateOwnTrack']=cbUpdateOwnTrack,
    ['wave:listHome']=cbListHome,
    ['wave:search']=cbSearch,
    ['wave:listLibrary']=cbListLibrary,
    ['wave:toggleFavorite']=cbToggleFavorite,
    ['wave:removeLibraryTrack']=cbRemoveLibraryTrack,
    ['wave:artistDetail']=cbArtistDetail,
    ['wave:toggleFollow']=cbToggleFollow,
    ['wave:listPlaylists']=cbListPlaylists,
    ['wave:savePlaylist']=cbSavePlaylist,
    ['wave:getPlaylist']=cbGetPlaylist,
    ['wave:deletePlaylist']=cbDeletePlaylist,
    ['wave:addPlaylistTrack']=cbAddPlaylistTrack,
    ['wave:removePlaylistTrack']=cbRemovePlaylistTrack,
    ['wave:movePlaylistTrack']=cbMovePlaylistTrack,
    ['wave:listOwnAlbums']=cbListOwnAlbums,
    ['wave:saveAlbum']=cbSaveAlbum,
    ['wave:deleteAlbum']=cbDeleteAlbum,
    ['wave:albumDetail']=cbAlbumDetail,
    ['wave:purchaseTrack']=cbPurchaseTrack,
    ['wave:withdraw']=cbWithdraw,
    ['wave:reportTrack']=cbReportTrack,
    ['wave:recordStream']=cbRecordStream,
    ['wave:adminOverview']=cbAdminOverview,
    ['wave:adminTrackAction']=cbAdminTrackAction,
    ['wave:adminArtistAction']=cbAdminArtistAction,
    ['wave:adminReportAction']=cbAdminReportAction
}

for _ in pairs(callbacks) do expectedCallbacks=expectedCallbacks+1 end

local function safeCall(name,fn,source,data)
    local ok,result=pcall(fn,source,type(data)=='table' and data or {})
    if ok then return result or {ok=false,error='EMPTY_RESPONSE'} end
    print(('[WAVE] callback %s failed source=%s: %s'):format(name,tostring(source),tostring(result)))
    return {ok=false,error='SERVER_ERROR'}
end

local function registerCallbacks()
    if callbackBusy or GetResourceState('lb-phone')~='started' then return false end
    callbackBusy=true
    registeredCallbacks=0
    for name,fn in pairs(callbacks) do
        local ok,err=pcall(function()
            exports['lb-phone']:RegisterCallback(name,function(source,data) return safeCall(name,fn,source,data) end,
                {preventSpam=true,rateLimit=180,defaultReturn={ok=false,error='CALLBACK_FAILED'}})
        end)
        if ok then registeredCallbacks=registeredCallbacks+1 else print(('[WAVE] RegisterCallback %s failed: %s'):format(name,tostring(err))) end
    end
    callbackBusy=false
    print(('[WAVE] LB Phone callbacks registered %d/%d'):format(registeredCallbacks,expectedCallbacks))
    return registeredCallbacks==expectedCallbacks
end

CreateThread(function()
    while GetResourceState('oxmysql')~='started' or GetResourceState('qbx_core')~='started' do Wait(500) end
    MySQL.ready(function()
        local ok,err=pcall(ensureSchema)
        if not ok then
            print(('[WAVE] schema bootstrap FAILED: %s'):format(tostring(err)))
            return
        end
        print('[WAVE] database schema ready')
        while GetResourceState('lb-phone')~='started' do Wait(500) end
        registerCallbacks()
        print(('[WAVE] v%s READY_FOR_TEST'):format(GetResourceMetadata(RESOURCE,'version',0) or 'unknown'))
    end)
end)

AddEventHandler('onResourceStart',function(resource)
    if resource~='lb-phone' then return end
    CreateThread(function() Wait(500) registerCallbacks() end)
end)

AddEventHandler('onResourceStop',function(resource)
    if resource=='lb-phone' then registeredCallbacks=0 end
end)

RegisterCommand('wave_selftest',function(source)
    if source~=0 then return end
    local failures={}
    if GetResourceState('lb-phone')~='started' then failures[#failures+1]='lb-phone' end
    if GetResourceState('oxmysql')~='started' then failures[#failures+1]='oxmysql' end
    if GetResourceState('qbx_core')~='started' then failures[#failures+1]='qbx_core' end
    if registeredCallbacks~=expectedCallbacks then failures[#failures+1]=('callbacks:%d/%d'):format(registeredCallbacks,expectedCallbacks) end
    local tables={'wave_artists','wave_projects','wave_tracks','wave_favorites','wave_purchases','wave_wallets','wave_platform_wallet','wave_transactions','wave_subscriptions','wave_stream_daily','wave_reports','wave_follows','wave_playlists','wave_playlist_tracks','wave_albums','wave_album_tracks','wave_recent_plays','wave_ringtones','wave_schema_meta','wave_admin_logs','wave_synth_presets'}
    for _,name in ipairs(tables) do
        local exists=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?]],{name}) or 0)>0
        if not exists then failures[#failures+1]='table:'..name end
    end
    local schemaVersion=tonumber(MySQL.scalar.await('SELECT schema_version FROM wave_schema_meta WHERE id=1') or 0)
    if schemaVersion~=(tonumber(WaveConfig.SchemaVersion) or 1) then failures[#failures+1]='schema:'..tostring(schemaVersion) end
    if #failures==0 then print('[WAVE] SELFTEST PASS') else print('[WAVE] SELFTEST FAIL '..table.concat(failures,', ')) end
end,true)

RegisterCommand('wave_diag',function(source)
    if source~=0 then return end
    local version=GetResourceMetadata(RESOURCE,'version',0) or 'unknown'
    local schemaVersion=tonumber(MySQL.scalar.await('SELECT schema_version FROM wave_schema_meta WHERE id=1') or 0)
    local artists=tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM wave_artists WHERE status<>'deleted'") or 0)
    local tracks=tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM wave_tracks WHERE status<>'deleted'") or 0)
    local publicTracks=tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM wave_tracks WHERE status='public'") or 0)
    print(('[WAVE] DIAG version=%s callbacks=%d/%d schema=%d artists=%d tracks=%d public=%d'):format(
        tostring(version),registeredCallbacks,expectedCallbacks,schemaVersion,artists,tracks,publicTracks))
end,true)
