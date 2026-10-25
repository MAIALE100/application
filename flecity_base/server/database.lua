FlecityBaseDatabase = FlecityBaseDatabase or {}

local schema = {
[[CREATE TABLE IF NOT EXISTS flecity_base_workspaces (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_citizenid VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    icon VARCHAR(32) NOT NULL DEFAULT '📁',
    workspace_type VARCHAR(32) NOT NULL DEFAULT 'custom',
    template_key VARCHAR(64) NULL,
    is_personal TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_base_workspace_owner (owner_citizenid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_members (
    workspace_id BIGINT UNSIGNED NOT NULL,
    citizenid VARCHAR(64) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invited_by VARCHAR(64) NULL,
    PRIMARY KEY (workspace_id, citizenid),
    KEY idx_base_member_citizen (citizenid),
    CONSTRAINT fk_base_member_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_invites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id BIGINT UNSIGNED NOT NULL,
    invitee_citizenid VARCHAR(64) NOT NULL,
    inviter_citizenid VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_base_invite_lookup (invitee_citizenid, status, expires_at),
    KEY idx_base_invite_workspace (workspace_id, status),
    CONSTRAINT fk_base_invite_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_notes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id BIGINT UNSIGNED NOT NULL,
    author_citizenid VARCHAR(64) NOT NULL,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    tags VARCHAR(255) NOT NULL DEFAULT '',
    pinned TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_base_note_workspace (workspace_id, deleted_at, pinned, updated_at),
    CONSTRAINT fk_base_note_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_stock_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    quantity INT NOT NULL DEFAULT 0,
    minimum_quantity INT NOT NULL DEFAULT 0,
    unit VARCHAR(32) NOT NULL DEFAULT '個',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_base_stock_workspace (workspace_id, name),
    CONSTRAINT fk_base_stock_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_stock_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    actor_citizenid VARCHAR(64) NOT NULL,
    delta INT NOT NULL,
    before_quantity INT NOT NULL,
    after_quantity INT NOT NULL,
    note VARCHAR(180) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_base_stock_move_item (item_id, created_at),
    KEY idx_base_stock_move_workspace (workspace_id, created_at),
    CONSTRAINT fk_base_stock_move_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_base_stock_move_item FOREIGN KEY (item_id)
        REFERENCES flecity_base_stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(120) NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'todo',
    priority VARCHAR(16) NOT NULL DEFAULT 'normal',
    assignee_citizenid VARCHAR(64) NULL,
    due_at DATETIME NULL,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_base_task_workspace (workspace_id, status, due_at),
    KEY idx_base_task_assignee (assignee_citizenid, status),
    CONSTRAINT fk_base_task_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_ledger (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id BIGINT UNSIGNED NOT NULL,
    entry_type VARCHAR(16) NOT NULL,
    amount BIGINT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'other',
    note VARCHAR(180) NULL,
    actor_citizenid VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    voided_at DATETIME NULL,
    voided_by VARCHAR(64) NULL,
    PRIMARY KEY (id),
    KEY idx_base_ledger_workspace (workspace_id, voided_at, created_at),
    CONSTRAINT fk_base_ledger_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_calculators (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workspace_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    fields_json TEXT NOT NULL,
    formula VARCHAR(512) NOT NULL,
    result_label VARCHAR(64) NOT NULL DEFAULT '結果',
    result_format VARCHAR(16) NOT NULL DEFAULT 'money',
    result_unit VARCHAR(32) NULL,
    rounding VARCHAR(16) NOT NULL DEFAULT 'floor',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_base_calculator_workspace (workspace_id, updated_at),
    CONSTRAINT fk_base_calculator_workspace FOREIGN KEY (workspace_id)
        REFERENCES flecity_base_workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],

[[CREATE TABLE IF NOT EXISTS flecity_base_access_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_citizenid VARCHAR(64) NOT NULL,
    actor_name VARCHAR(120) NOT NULL,
    access_type VARCHAR(24) NOT NULL,
    action VARCHAR(40) NOT NULL,
    workspace_id BIGINT UNSIGNED NULL,
    workspace_name VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_base_access_actor (actor_citizenid, created_at),
    KEY idx_base_access_workspace (workspace_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]]
}

local columnMigrations = {
    {
        tableName = 'flecity_base_notes',
        columnName = 'category',
        sql = "ALTER TABLE flecity_base_notes ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT 'general' AFTER body"
    },
    {
        tableName = 'flecity_base_notes',
        columnName = 'tags',
        sql = "ALTER TABLE flecity_base_notes ADD COLUMN tags VARCHAR(255) NOT NULL DEFAULT '' AFTER category"
    },
    {
        tableName = 'flecity_base_stock_items',
        columnName = 'category',
        sql = "ALTER TABLE flecity_base_stock_items ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT 'general' AFTER name"
    }
}

local function columnExists(tableName, columnName)
    return tonumber(MySQL.scalar.await([[
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?
    ]], {tableName, columnName}) or 0) > 0
end

function FlecityBaseDatabase.Ensure()
    local ok, err = pcall(function()
        for _, sql in ipairs(schema) do
            MySQL.query.await(sql)
        end
        for _, migration in ipairs(columnMigrations) do
            if not columnExists(migration.tableName, migration.columnName) then
                MySQL.query.await(migration.sql)
                print(('[BASE] database migration added %s.%s'):format(migration.tableName, migration.columnName))
            end
        end
    end)
    if not ok then
        print(('[BASE] database bootstrap failed: %s'):format(tostring(err)))
        return false, err
    end
    return true
end

function FlecityBaseDatabase.Selftest()
    local required = {
        'flecity_base_workspaces',
        'flecity_base_members',
        'flecity_base_invites',
        'flecity_base_notes',
        'flecity_base_stock_items',
        'flecity_base_stock_movements',
        'flecity_base_tasks',
        'flecity_base_ledger',
        'flecity_base_calculators',
        'flecity_base_access_audit'
    }
    local failures = {}
    for _, name in ipairs(required) do
        local exists = tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?]], {name}) or 0) > 0
        if not exists then failures[#failures + 1] = name end
    end
    for _, migration in ipairs(columnMigrations) do
        if not columnExists(migration.tableName, migration.columnName) then
            failures[#failures + 1] = migration.tableName .. '.' .. migration.columnName
        end
    end
    return #failures == 0, failures
end
