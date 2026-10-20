FlecityGamesDatabase = FlecityGamesDatabase or {}

local statements={
[[
CREATE TABLE IF NOT EXISTS flecity_game_profiles (
    player_identifier VARCHAR(128) NOT NULL,
    display_name VARCHAR(100) NULL,
    settings_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_identifier)
)
]],
[[
CREATE TABLE IF NOT EXISTS flecity_game_scores (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    player_identifier VARCHAR(128) NOT NULL,
    game_id VARCHAR(64) NOT NULL,
    score DECIMAL(18,4) NOT NULL,
    duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
    session_token VARCHAR(192) NOT NULL,
    metadata_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_flecity_game_session_token (session_token),
    INDEX idx_flecity_game_rank (game_id, created_at, score),
    INDEX idx_flecity_game_player (player_identifier, game_id, created_at)
)
]],
[[
CREATE TABLE IF NOT EXISTS flecity_game_saves (
    player_identifier VARCHAR(128) NOT NULL,
    game_id VARCHAR(64) NOT NULL,
    state_json LONGTEXT NOT NULL,
    score DECIMAL(18,4) NOT NULL DEFAULT 0,
    elapsed_ms INT UNSIGNED NOT NULL DEFAULT 0,
    seed VARCHAR(64) NULL,
    game_version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (player_identifier, game_id),
    INDEX idx_flecity_game_save_updated (updated_at)
)
]],
[[
CREATE TABLE IF NOT EXISTS flecity_game_achievements (
    player_identifier VARCHAR(128) NOT NULL,
    achievement_id VARCHAR(96) NOT NULL,
    game_id VARCHAR(64) NULL,
    unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json LONGTEXT NULL,
    PRIMARY KEY (player_identifier, achievement_id),
    INDEX idx_flecity_game_achievement_game (game_id, unlocked_at)
)
]],
[[
CREATE TABLE IF NOT EXISTS flecity_game_daily (
    challenge_date DATE NOT NULL,
    game_id VARCHAR(64) NOT NULL,
    seed VARCHAR(64) NULL,
    config_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (challenge_date),
    INDEX idx_flecity_game_daily_game (game_id, challenge_date)
)
]]
}

local function columnExists(tableName,columnName)
    return tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?]],{tableName,columnName}) or 0)>0
end

local function indexExists(tableName,indexName)
    return tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?]],{tableName,indexName}) or 0)>0
end

function FlecityGamesDatabase.Ensure()
    local ok,err=pcall(function()
        for _,sql in ipairs(statements) do MySQL.query.await(sql) end

        if not columnExists('flecity_game_profiles','display_name') then
            MySQL.query.await('ALTER TABLE flecity_game_profiles ADD COLUMN display_name VARCHAR(100) NULL AFTER player_identifier')
        end
        if not columnExists('flecity_game_profiles','settings_json') then
            MySQL.query.await('ALTER TABLE flecity_game_profiles ADD COLUMN settings_json LONGTEXT NULL AFTER display_name')
        end
        if not indexExists('flecity_game_scores','uq_flecity_game_session_token') then
            MySQL.query.await('ALTER TABLE flecity_game_scores ADD UNIQUE KEY uq_flecity_game_session_token (session_token)')
        end
    end)
    if not ok then return false,tostring(err) end
    return true
end
