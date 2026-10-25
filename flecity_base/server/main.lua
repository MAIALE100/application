local RESOURCE = GetCurrentResourceName()
local C = FlecityBaseConfig
local L = C.Limits

local function clean(value, maxLen)
    local s = tostring(value or ''):gsub('[%z\1-\8\11\12\14-\31]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if maxLen and #s > maxLen then s = s:sub(1, maxLen) end
    return s
end

local function integer(value, minValue, maxValue)
    local n = math.floor(tonumber(value) or 0)
    if minValue and n < minValue then n = minValue end
    if maxValue and n > maxValue then n = maxValue end
    return n
end

local function sourceContext(source)
    local citizenid = FlecityBaseFramework.GetIdentifier(source)
    if not citizenid then return nil, {ok=false, error='PLAYER_NOT_READY'} end
    return {
        source = source,
        citizenid = citizenid,
        name = FlecityBaseFramework.GetCharacterName(source)
    }
end

local function membership(workspaceId, citizenid)
    return MySQL.single.await([[
        SELECT w.id, w.owner_citizenid, w.name, w.icon, w.workspace_type, w.template_key,
               w.is_personal, m.role
        FROM flecity_base_workspaces w
        JOIN flecity_base_members m ON m.workspace_id=w.id
        WHERE w.id=? AND m.citizenid=?
        LIMIT 1
    ]], {workspaceId, citizenid})
end

local function requireMember(ctx, workspaceId)
    local row = membership(integer(workspaceId, 1), ctx.citizenid)
    if not row then return nil, {ok=false, error='NOT_A_MEMBER'} end
    return row
end

local function requireOwner(ctx, workspaceId)
    local row, err = requireMember(ctx, workspaceId)
    if not row then return nil, err end
    if row.role ~= 'owner' or row.owner_citizenid ~= ctx.citizenid then
        return nil, {ok=false, error='OWNER_REQUIRED'}
    end
    return row
end

local function ensurePersonalWorkspace(ctx)
    local existing = MySQL.single.await([[
        SELECT id FROM flecity_base_workspaces
        WHERE owner_citizenid=? AND is_personal=1
        ORDER BY id ASC LIMIT 1
    ]], {ctx.citizenid})
    if existing then
        MySQL.insert.await([[
            INSERT IGNORE INTO flecity_base_members
            (workspace_id, citizenid, display_name, role, invited_by)
            VALUES (?, ?, ?, 'owner', NULL)
        ]], {existing.id, ctx.citizenid, ctx.name})
        return tonumber(existing.id)
    end

    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_workspaces
        (owner_citizenid, name, icon, workspace_type, template_key, is_personal)
        VALUES (?, 'MY SPACE', '👤', 'personal', 'personal', 1)
    ]], {ctx.citizenid})
    if not id then return nil end

    MySQL.insert.await([[
        INSERT INTO flecity_base_members
        (workspace_id, citizenid, display_name, role, invited_by)
        VALUES (?, ?, ?, 'owner', NULL)
    ]], {id, ctx.citizenid, ctx.name})
    return tonumber(id)
end

local function listWorkspaces(ctx)
    return MySQL.query.await([[
        SELECT w.id, w.name, w.icon, w.workspace_type, w.template_key, w.is_personal,
               w.owner_citizenid, m.role,
               (SELECT COUNT(*) FROM flecity_base_members mm WHERE mm.workspace_id=w.id) AS member_count
        FROM flecity_base_members m
        JOIN flecity_base_workspaces w ON w.id=m.workspace_id
        WHERE m.citizenid=?
        ORDER BY w.is_personal DESC, w.updated_at DESC, w.id DESC
    ]], {ctx.citizenid}) or {}
end

local function listInvites(ctx)
    return MySQL.query.await([[
        SELECT i.id, i.workspace_id, i.inviter_citizenid, i.expires_at, i.created_at,
               w.name AS workspace_name, w.icon AS workspace_icon, w.workspace_type
        FROM flecity_base_invites i
        JOIN flecity_base_workspaces w ON w.id=i.workspace_id
        WHERE i.invitee_citizenid=? AND i.status='pending' AND i.expires_at>NOW()
        ORDER BY i.created_at DESC
    ]], {ctx.citizenid}) or {}
end

local handlers = {}

handlers.bootstrap = function(source)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    local personalId = ensurePersonalWorkspace(ctx)
    if not personalId then return {ok=false, error='PERSONAL_WORKSPACE_FAILED'} end
    return {
        ok = true,
        user = { citizenid=ctx.citizenid, name=ctx.name },
        workspaces = listWorkspaces(ctx),
        invites = listInvites(ctx),
        templates = C.WorkspaceTemplates
    }
end

handlers.workspaceCreate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local count = tonumber(MySQL.scalar.await([[
        SELECT COUNT(*) FROM flecity_base_workspaces
        WHERE owner_citizenid=? AND is_personal=0
    ]], {ctx.citizenid}) or 0)
    if count >= L.workspacesPerOwner then return {ok=false, error='WORKSPACE_LIMIT'} end

    local name = clean(data.name, L.title)
    if name == '' then return {ok=false, error='NAME_REQUIRED'} end
    local workspaceType = clean(data.workspaceType or 'custom', 32):lower()
    if not C.WorkspaceTemplates[workspaceType] or workspaceType == 'personal' then workspaceType = 'custom' end
    local templateKey = clean(data.templateKey or workspaceType, 64)
    local icon = clean(data.icon or '📁', 32)
    if icon == '' then icon = '📁' end

    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_workspaces
        (owner_citizenid, name, icon, workspace_type, template_key, is_personal)
        VALUES (?, ?, ?, ?, ?, 0)
    ]], {ctx.citizenid, name, icon, workspaceType, templateKey})
    if not id then return {ok=false, error='CREATE_FAILED'} end

    local memberId = MySQL.insert.await([[
        INSERT INTO flecity_base_members
        (workspace_id, citizenid, display_name, role, invited_by)
        VALUES (?, ?, ?, 'owner', NULL)
    ]], {id, ctx.citizenid, ctx.name})
    if not memberId then
        MySQL.update.await('DELETE FROM flecity_base_workspaces WHERE id=?', {id})
        return {ok=false, error='CREATE_FAILED'}
    end

    return {ok=true, workspaceId=tonumber(id), workspaces=listWorkspaces(ctx)}
end

handlers.workspaceGet = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local members = MySQL.query.await([[
        SELECT citizenid, display_name, role, joined_at
        FROM flecity_base_members WHERE workspace_id=?
        ORDER BY role='owner' DESC, joined_at ASC
    ]], {workspace.id}) or {}
    return {ok=true, workspace=workspace, members=members}
end

handlers.workspaceRename = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if tonumber(workspace.is_personal) == 1 then return {ok=false, error='PERSONAL_WORKSPACE'} end
    local name = clean(data.name, L.title)
    if name == '' then return {ok=false, error='NAME_REQUIRED'} end
    local changed = MySQL.update.await(
        'UPDATE flecity_base_workspaces SET name=?, updated_at=NOW() WHERE id=?',
        {name, workspace.id}
    )
    return {ok=(tonumber(changed) or 0) > 0, name=name}
end

handlers.workspaceDelete = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if tonumber(workspace.is_personal) == 1 then return {ok=false, error='PERSONAL_WORKSPACE'} end
    if clean(data.confirmName, L.title) ~= tostring(workspace.name) then
        return {ok=false, error='DELETE_CONFIRM_MISMATCH'}
    end
    local changed = MySQL.update.await('DELETE FROM flecity_base_workspaces WHERE id=?', {workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.workspaceInvite = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if tonumber(workspace.is_personal) == 1 then return {ok=false, error='PERSONAL_WORKSPACE'} end

    local invitee = clean(data.citizenid, 64)
    if invitee == '' or invitee == ctx.citizenid then return {ok=false, error='INVALID_INVITEE'} end
    local memberCount = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_base_members WHERE workspace_id=?', {workspace.id}) or 0)
    if memberCount >= L.membersPerWorkspace then return {ok=false, error='MEMBER_LIMIT'} end
    local already = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_base_members WHERE workspace_id=? AND citizenid=?', {workspace.id, invitee}) or 0) > 0
    if already then return {ok=false, error='ALREADY_MEMBER'} end

    MySQL.update.await([[
        UPDATE flecity_base_invites
        SET status='cancelled'
        WHERE workspace_id=? AND invitee_citizenid=? AND status='pending'
    ]], {workspace.id, invitee})

    local expiryHours = integer(C.InviteExpiryHours, 1, 720)
    local inviteSql = ([[
        INSERT INTO flecity_base_invites
        (workspace_id, invitee_citizenid, inviter_citizenid, status, expires_at)
        VALUES (?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL %d HOUR))
    ]]):format(expiryHours)
    local id = MySQL.insert.await(inviteSql, {workspace.id, invitee, ctx.citizenid})
    return {ok=id ~= nil, inviteId=tonumber(id)}
end

handlers.inviteAccept = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local invite = MySQL.single.await([[
        SELECT i.id, i.workspace_id, i.inviter_citizenid
        FROM flecity_base_invites i
        WHERE i.id=? AND i.invitee_citizenid=? AND i.status='pending' AND i.expires_at>NOW()
        LIMIT 1
    ]], {integer(data.inviteId, 1), ctx.citizenid})
    if not invite then return {ok=false, error='INVITE_NOT_FOUND'} end

    local memberCount = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_base_members WHERE workspace_id=?', {invite.workspace_id}) or 0)
    if memberCount >= L.membersPerWorkspace then return {ok=false, error='MEMBER_LIMIT'} end

    MySQL.insert.await([[
        INSERT IGNORE INTO flecity_base_members
        (workspace_id, citizenid, display_name, role, invited_by)
        VALUES (?, ?, ?, 'member', ?)
    ]], {invite.workspace_id, ctx.citizenid, ctx.name, invite.inviter_citizenid})
    MySQL.update.await("UPDATE flecity_base_invites SET status='accepted' WHERE id=?", {invite.id})
    return {ok=true, workspaces=listWorkspaces(ctx), invites=listInvites(ctx)}
end

handlers.inviteDecline = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local changed = MySQL.update.await([[
        UPDATE flecity_base_invites SET status='declined'
        WHERE id=? AND invitee_citizenid=? AND status='pending'
    ]], {integer(data.inviteId, 1), ctx.citizenid})
    return {ok=(tonumber(changed) or 0) > 0, invites=listInvites(ctx)}
end

handlers.workspaceLeave = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if tonumber(workspace.is_personal) == 1 then return {ok=false, error='PERSONAL_WORKSPACE'} end
    if workspace.role == 'owner' then return {ok=false, error='OWNER_CANNOT_LEAVE'} end
    MySQL.update.await('DELETE FROM flecity_base_members WHERE workspace_id=? AND citizenid=?', {workspace.id, ctx.citizenid})
    return {ok=true, workspaces=listWorkspaces(ctx)}
end

handlers.workspaceRemoveMember = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local target = clean(data.citizenid, 64)
    if target == '' or target == ctx.citizenid then return {ok=false, error='INVALID_MEMBER'} end
    local changed = MySQL.update.await([[
        DELETE FROM flecity_base_members
        WHERE workspace_id=? AND citizenid=? AND role<>'owner'
    ]], {workspace.id, target})
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.notesList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local rows = MySQL.query.await([[
        SELECT id, author_citizenid, title, body, category, tags, pinned, created_at, updated_at
        FROM flecity_base_notes
        WHERE workspace_id=? AND deleted_at IS NULL
        ORDER BY pinned DESC, updated_at DESC LIMIT 300
    ]], {workspace.id}) or {}
    return {ok=true, notes=rows}
end

handlers.noteCreate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local count = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_base_notes WHERE workspace_id=? AND deleted_at IS NULL', {workspace.id}) or 0)
    if count >= L.notesPerWorkspace then return {ok=false, error='NOTE_LIMIT'} end
    local title = clean(data.title, L.title)
    local body = clean(data.body, L.noteBody)
    local category = clean(data.category or 'general', 64)
    local tags = clean(data.tags, 255)
    if category == '' then category = 'general' end
    if title == '' then return {ok=false, error='TITLE_REQUIRED'} end
    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_notes (workspace_id, author_citizenid, title, body, category, tags, pinned)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {workspace.id, ctx.citizenid, title, body, category, tags, data.pinned == true and 1 or 0})
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.noteUpdate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local title = clean(data.title, L.title)
    local body = clean(data.body, L.noteBody)
    local category = clean(data.category or 'general', 64)
    local tags = clean(data.tags, 255)
    if category == '' then category = 'general' end
    if title == '' then return {ok=false, error='TITLE_REQUIRED'} end
    local changed = MySQL.update.await([[
        UPDATE flecity_base_notes
        SET title=?, body=?, category=?, tags=?, pinned=?, updated_at=NOW()
        WHERE id=? AND workspace_id=? AND deleted_at IS NULL
    ]], {title, body, category, tags, data.pinned == true and 1 or 0, integer(data.id, 1), workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.noteDelete = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local changed = MySQL.update.await([[
        UPDATE flecity_base_notes SET deleted_at=NOW()
        WHERE id=? AND workspace_id=? AND deleted_at IS NULL
    ]], {integer(data.id, 1), workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.stockList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local items = MySQL.query.await([[
        SELECT id, name, category, quantity, minimum_quantity, unit, created_by, created_at, updated_at
        FROM flecity_base_stock_items
        WHERE workspace_id=? ORDER BY category ASC, name ASC
    ]], {workspace.id}) or {}
    local recent = MySQL.query.await([[
        SELECT m.id, m.item_id, i.name AS item_name, i.unit, m.actor_citizenid,
               m.delta, m.before_quantity, m.after_quantity, m.note, m.created_at
        FROM flecity_base_stock_movements m
        JOIN flecity_base_stock_items i ON i.id=m.item_id
        WHERE m.workspace_id=?
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 12
    ]], {workspace.id}) or {}
    return {ok=true, items=items, recent=recent}
end

handlers.stockHistory = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local itemId = integer(data.id, 1)
    local exists = tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM flecity_base_stock_items WHERE id=? AND workspace_id=?',
        {itemId, workspace.id}
    ) or 0) > 0
    if not exists then return {ok=false, error='ITEM_NOT_FOUND'} end
    local rows = MySQL.query.await([[
        SELECT id, actor_citizenid, delta, before_quantity, after_quantity, note, created_at
        FROM flecity_base_stock_movements
        WHERE workspace_id=? AND item_id=?
        ORDER BY created_at DESC, id DESC
        LIMIT 100
    ]], {workspace.id, itemId}) or {}
    return {ok=true, history=rows}
end

handlers.stockCreate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local count = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_base_stock_items WHERE workspace_id=?', {workspace.id}) or 0)
    if count >= L.stockItemsPerWorkspace then return {ok=false, error='STOCK_LIMIT'} end
    local name = clean(data.name, L.title)
    if name == '' then return {ok=false, error='NAME_REQUIRED'} end
    local category = clean(data.category or 'general', 64)
    if category == '' then category = 'general' end
    local quantity = integer(data.quantity, 0, L.stockQuantity)
    local minimum = integer(data.minimumQuantity, 0, L.stockQuantity)
    local unit = clean(data.unit or '個', 32)
    if unit == '' then unit = '個' end
    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_stock_items
        (workspace_id, name, category, quantity, minimum_quantity, unit, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {workspace.id, name, category, quantity, minimum, unit, ctx.citizenid})
    if id and quantity ~= 0 then
        MySQL.insert.await([[
            INSERT INTO flecity_base_stock_movements
            (workspace_id, item_id, actor_citizenid, delta, before_quantity, after_quantity, note)
            VALUES (?, ?, ?, ?, 0, ?, '初期在庫')
        ]], {workspace.id, id, ctx.citizenid, quantity, quantity})
    end
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.stockAdjust = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local item = MySQL.single.await([[
        SELECT id, quantity FROM flecity_base_stock_items
        WHERE id=? AND workspace_id=? LIMIT 1
    ]], {integer(data.id, 1), workspace.id})
    if not item then return {ok=false, error='ITEM_NOT_FOUND'} end
    local requested = integer(data.delta, -L.stockQuantity, L.stockQuantity)
    if requested == 0 then return {ok=false, error='ZERO_DELTA'} end
    local before = integer(item.quantity, 0, L.stockQuantity)
    local after = integer(before + requested, 0, L.stockQuantity)
    local actual = after - before
    if actual == 0 then return {ok=false, error='NO_CHANGE'} end
    local changed = MySQL.update.await([[
        UPDATE flecity_base_stock_items SET quantity=?, updated_at=NOW()
        WHERE id=? AND workspace_id=? AND quantity=?
    ]], {after, item.id, workspace.id, before})
    if (tonumber(changed) or 0) == 0 then return {ok=false, error='STOCK_CHANGED_RETRY'} end
    MySQL.insert.await([[
        INSERT INTO flecity_base_stock_movements
        (workspace_id, item_id, actor_citizenid, delta, before_quantity, after_quantity, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {workspace.id, item.id, ctx.citizenid, actual, before, after, clean(data.note, L.shortText)})
    return {ok=true, quantity=after, delta=actual}
end

handlers.stockConfigure = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local name = clean(data.name, L.title)
    if name == '' then return {ok=false, error='NAME_REQUIRED'} end
    local category = clean(data.category or 'general', 64)
    if category == '' then category = 'general' end
    local minimum = integer(data.minimumQuantity, 0, L.stockQuantity)
    local unit = clean(data.unit or '個', 32)
    local changed = MySQL.update.await([[
        UPDATE flecity_base_stock_items
        SET name=?, category=?, minimum_quantity=?, unit=?, updated_at=NOW()
        WHERE id=? AND workspace_id=?
    ]], {name, category, minimum, unit ~= '' and unit or '個', integer(data.id, 1), workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

local validTaskStatus = {todo=true, doing=true, done=true}
local validPriority = {low=true, normal=true, high=true}

local function validAssignee(workspaceId, citizenid)
    if not citizenid or citizenid == '' then return nil end
    local exists = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_base_members WHERE workspace_id=? AND citizenid=?', {workspaceId, citizenid}) or 0) > 0
    return exists and citizenid or false
end

handlers.tasksList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local tasks = MySQL.query.await([[
        SELECT t.id, t.title, t.details, t.status, t.priority, t.assignee_citizenid,
               t.due_at, t.created_by, t.created_at, t.updated_at, t.completed_at,
               m.display_name AS assignee_name
        FROM flecity_base_tasks t
        LEFT JOIN flecity_base_members m
          ON m.workspace_id=t.workspace_id AND m.citizenid=t.assignee_citizenid
        WHERE t.workspace_id=?
        ORDER BY t.status='done' ASC, FIELD(t.priority,'high','normal','low'), t.due_at IS NULL, t.due_at ASC, t.updated_at DESC
        LIMIT 500
    ]], {workspace.id}) or {}
    return {ok=true, tasks=tasks}
end

handlers.taskCreate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local count = tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM flecity_base_tasks WHERE workspace_id=? AND status<>'done'", {workspace.id}) or 0)
    if count >= L.tasksPerWorkspace then return {ok=false, error='TASK_LIMIT'} end
    local title = clean(data.title, L.title)
    if title == '' then return {ok=false, error='TITLE_REQUIRED'} end
    local details = clean(data.details, L.taskDetails)
    local priority = clean(data.priority or 'normal', 16):lower()
    if not validPriority[priority] then priority = 'normal' end
    local assignee = clean(data.assigneeCitizenId, 64)
    local checked = validAssignee(workspace.id, assignee)
    if checked == false then return {ok=false, error='INVALID_ASSIGNEE'} end
    local dueAt = clean(data.dueAt, 32)
    if dueAt == '' then dueAt = nil end
    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_tasks
        (workspace_id, title, details, status, priority, assignee_citizenid, due_at, created_by)
        VALUES (?, ?, ?, 'todo', ?, ?, ?, ?)
    ]], {workspace.id, title, details, priority, checked, dueAt, ctx.citizenid})
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.taskUpdate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local title = clean(data.title, L.title)
    if title == '' then return {ok=false, error='TITLE_REQUIRED'} end
    local status = clean(data.status or 'todo', 16):lower()
    local priority = clean(data.priority or 'normal', 16):lower()
    if not validTaskStatus[status] then status = 'todo' end
    if not validPriority[priority] then priority = 'normal' end
    local assignee = clean(data.assigneeCitizenId, 64)
    local checked = validAssignee(workspace.id, assignee)
    if checked == false then return {ok=false, error='INVALID_ASSIGNEE'} end
    local dueAt = clean(data.dueAt, 32)
    if dueAt == '' then dueAt = nil end
    local completedAt = status == 'done' and os.date('%Y-%m-%d %H:%M:%S') or nil
    local changed = MySQL.update.await([[
        UPDATE flecity_base_tasks
        SET title=?, details=?, status=?, priority=?, assignee_citizenid=?, due_at=?,
            completed_at=?, updated_at=NOW()
        WHERE id=? AND workspace_id=?
    ]], {
        title, clean(data.details, L.taskDetails), status, priority, checked, dueAt,
        completedAt, integer(data.id, 1), workspace.id
    })
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.taskDelete = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local changed = MySQL.update.await('DELETE FROM flecity_base_tasks WHERE id=? AND workspace_id=?', {integer(data.id, 1), workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

local validCalculatorRounding = {none=true, round=true, floor=true, ceil=true}
local validCalculatorFormat = {money=true, number=true}

local function normalizeCalculatorFields(raw)
    if type(raw) ~= 'table' then return nil, 'CALCULATOR_FIELDS_REQUIRED' end
    local fields = {}
    for _, item in ipairs(raw) do
        if #fields >= L.calculatorFields then break end
        if type(item) == 'table' then
            local label = clean(item.label, 64)
            if label ~= '' then
                local defaultValue = tonumber(item.defaultValue) or 0
                if defaultValue > L.moneyAmount then defaultValue = L.moneyAmount end
                if defaultValue < -L.moneyAmount then defaultValue = -L.moneyAmount end
                fields[#fields + 1] = {
                    key = 'v' .. tostring(#fields + 1),
                    label = label,
                    unit = clean(item.unit, 32),
                    defaultValue = defaultValue
                }
            end
        end
    end
    if #fields == 0 then return nil, 'CALCULATOR_FIELDS_REQUIRED' end
    return fields
end

local function normalizeCalculatorFormula(rawFormula, fieldCount)
    local formula = clean(rawFormula, L.calculatorFormula)
    if formula == '' then return nil, 'FORMULA_REQUIRED' end
    if formula:find('[^%w_%.%+%-%*/%%%(% )]') then
        return nil, 'INVALID_FORMULA'
    end

    local allowed = {}
    for i = 1, fieldCount do allowed['v' .. tostring(i)] = true end
    for token in formula:gmatch('[%a_][%w_]*') do
        if not allowed[token] then return nil, 'INVALID_FORMULA_VARIABLE' end
    end

    local depth = 0
    for i = 1, #formula do
        local ch = formula:sub(i, i)
        if ch == '(' then depth = depth + 1 end
        if ch == ')' then
            depth = depth - 1
            if depth < 0 then return nil, 'INVALID_FORMULA' end
        end
    end
    if depth ~= 0 then return nil, 'INVALID_FORMULA' end
    return formula
end

local function normalizeCalculatorPayload(data)
    local name = clean(data.name, L.title)
    if name == '' then return nil, 'NAME_REQUIRED' end

    local fields, fieldsErr = normalizeCalculatorFields(data.fields)
    if not fields then return nil, fieldsErr end

    local formula, formulaErr = normalizeCalculatorFormula(data.formula, #fields)
    if not formula then return nil, formulaErr end

    local rounding = clean(data.rounding or 'floor', 16):lower()
    if not validCalculatorRounding[rounding] then rounding = 'floor' end

    local resultFormat = clean(data.resultFormat or 'money', 16):lower()
    if not validCalculatorFormat[resultFormat] then resultFormat = 'money' end

    local resultLabel = clean(data.resultLabel or '結果', 64)
    if resultLabel == '' then resultLabel = '結果' end

    return {
        name = name,
        fields = fields,
        fieldsJson = json.encode(fields),
        formula = formula,
        resultLabel = resultLabel,
        resultFormat = resultFormat,
        resultUnit = clean(data.resultUnit, 32),
        rounding = rounding
    }
end

handlers.calculatorsList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local rows = MySQL.query.await([[
        SELECT id, name, fields_json, formula, result_label, result_format, result_unit,
               rounding, created_by, created_at, updated_at
        FROM flecity_base_calculators
        WHERE workspace_id=?
        ORDER BY updated_at DESC, id DESC
    ]], {workspace.id}) or {}

    for _, row in ipairs(rows) do
        local ok, decoded = pcall(json.decode, tostring(row.fields_json or '[]'))
        row.fields = ok and type(decoded) == 'table' and decoded or {}
        row.fields_json = nil
    end

    return {ok=true, calculators=rows}
end

handlers.calculatorCreate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local count = tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM flecity_base_calculators WHERE workspace_id=?',
        {workspace.id}
    ) or 0)
    if count >= L.calculatorsPerWorkspace then return {ok=false, error='CALCULATOR_LIMIT'} end

    local payload, payloadErr = normalizeCalculatorPayload(data)
    if not payload then return {ok=false, error=payloadErr} end

    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_calculators
        (workspace_id, name, fields_json, formula, result_label, result_format, result_unit, rounding, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        workspace.id, payload.name, payload.fieldsJson, payload.formula, payload.resultLabel,
        payload.resultFormat, payload.resultUnit, payload.rounding, ctx.citizenid
    })
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.calculatorUpdate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local payload, payloadErr = normalizeCalculatorPayload(data)
    if not payload then return {ok=false, error=payloadErr} end

    local changed = MySQL.update.await([[
        UPDATE flecity_base_calculators
        SET name=?, fields_json=?, formula=?, result_label=?, result_format=?, result_unit=?,
            rounding=?, updated_at=NOW()
        WHERE id=? AND workspace_id=?
    ]], {
        payload.name, payload.fieldsJson, payload.formula, payload.resultLabel,
        payload.resultFormat, payload.resultUnit, payload.rounding,
        integer(data.id, 1), workspace.id
    })
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.calculatorDelete = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local changed = MySQL.update.await(
        'DELETE FROM flecity_base_calculators WHERE id=? AND workspace_id=?',
        {integer(data.id, 1), workspace.id}
    )
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.moneyList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local entries = MySQL.query.await([[
        SELECT id, entry_type, amount, category, note, actor_citizenid, created_at, voided_at, voided_by
        FROM flecity_base_ledger
        WHERE workspace_id=?
        ORDER BY created_at DESC, id DESC LIMIT ?
    ]], {workspace.id, L.ledgerEntriesPerPage}) or {}
    local summary = MySQL.single.await([[
        SELECT
          COALESCE(SUM(CASE WHEN entry_type='income' AND voided_at IS NULL THEN amount ELSE 0 END),0) AS income,
          COALESCE(SUM(CASE WHEN entry_type='expense' AND voided_at IS NULL THEN amount ELSE 0 END),0) AS expense,
          COALESCE(SUM(CASE WHEN entry_type='income' AND voided_at IS NULL THEN amount
                            WHEN entry_type='expense' AND voided_at IS NULL THEN -amount ELSE 0 END),0) AS balance
        FROM flecity_base_ledger WHERE workspace_id=?
    ]], {workspace.id}) or {income=0, expense=0, balance=0}
    return {ok=true, entries=entries, summary=summary}
end

handlers.moneyAdd = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local entryType = clean(data.entryType, 16):lower()
    if entryType ~= 'income' and entryType ~= 'expense' then return {ok=false, error='INVALID_ENTRY_TYPE'} end
    local amount = integer(data.amount, 1, L.moneyAmount)
    local category = clean(data.category or 'other', 64)
    if category == '' then category = 'other' end
    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_ledger
        (workspace_id, entry_type, amount, category, note, actor_citizenid)
        VALUES (?, ?, ?, ?, ?, ?)
    ]], {workspace.id, entryType, amount, category, clean(data.note, L.shortText), ctx.citizenid})
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.moneyVoid = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local changed = MySQL.update.await([[
        UPDATE flecity_base_ledger SET voided_at=NOW(), voided_by=?
        WHERE id=? AND workspace_id=? AND voided_at IS NULL
    ]], {ctx.citizenid, integer(data.id, 1), workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

local callbacks = {
    ['flecity_base:bootstrap'] = handlers.bootstrap,
    ['flecity_base:workspaceCreate'] = handlers.workspaceCreate,
    ['flecity_base:workspaceGet'] = handlers.workspaceGet,
    ['flecity_base:workspaceRename'] = handlers.workspaceRename,
    ['flecity_base:workspaceDelete'] = handlers.workspaceDelete,
    ['flecity_base:workspaceInvite'] = handlers.workspaceInvite,
    ['flecity_base:inviteAccept'] = handlers.inviteAccept,
    ['flecity_base:inviteDecline'] = handlers.inviteDecline,
    ['flecity_base:workspaceLeave'] = handlers.workspaceLeave,
    ['flecity_base:workspaceRemoveMember'] = handlers.workspaceRemoveMember,
    ['flecity_base:notesList'] = handlers.notesList,
    ['flecity_base:noteCreate'] = handlers.noteCreate,
    ['flecity_base:noteUpdate'] = handlers.noteUpdate,
    ['flecity_base:noteDelete'] = handlers.noteDelete,
    ['flecity_base:stockList'] = handlers.stockList,
    ['flecity_base:stockHistory'] = handlers.stockHistory,
    ['flecity_base:stockCreate'] = handlers.stockCreate,
    ['flecity_base:stockAdjust'] = handlers.stockAdjust,
    ['flecity_base:stockConfigure'] = handlers.stockConfigure,
    ['flecity_base:tasksList'] = handlers.tasksList,
    ['flecity_base:taskCreate'] = handlers.taskCreate,
    ['flecity_base:taskUpdate'] = handlers.taskUpdate,
    ['flecity_base:taskDelete'] = handlers.taskDelete,
    ['flecity_base:calculatorsList'] = handlers.calculatorsList,
    ['flecity_base:calculatorCreate'] = handlers.calculatorCreate,
    ['flecity_base:calculatorUpdate'] = handlers.calculatorUpdate,
    ['flecity_base:calculatorDelete'] = handlers.calculatorDelete,
    ['flecity_base:moneyList'] = handlers.moneyList,
    ['flecity_base:moneyAdd'] = handlers.moneyAdd,
    ['flecity_base:moneyVoid'] = handlers.moneyVoid
}

local registeredCallbacks = 0

local function callbackCount()
    local n = 0
    for _ in pairs(callbacks) do n = n + 1 end
    return n
end

local function safeCall(name, fn, source, data)
    local ok, result = pcall(fn, source, data)
    if ok then return result or {ok=false, error='EMPTY_RESPONSE'} end
    print(('[BASE] callback %s failed for source=%s: %s'):format(name, tostring(source), tostring(result)))
    return {ok=false, error='SERVER_ERROR'}
end

local function registerCallbacks()
    if GetResourceState('lb-phone') ~= 'started' then return false end
    registeredCallbacks = 0
    for name, fn in pairs(callbacks) do
        local ok, callbackErr = pcall(function()
            exports['lb-phone']:RegisterCallback(name, function(source, data)
                return safeCall(name, fn, source, data)
            end, {
                preventSpam = true,
                rateLimit = 150,
                defaultReturn = {ok=false, error='CALLBACK_FAILED'}
            })
        end)
        if ok then
            registeredCallbacks = registeredCallbacks + 1
        else
            print(('[BASE] RegisterCallback(%s) failed: %s'):format(name, tostring(callbackErr)))
        end
    end
    print(('[BASE] LB Phone callbacks registered %d/%d'):format(registeredCallbacks, callbackCount()))
    return true
end

RegisterCommand('base_selftest', function(source)
    if source ~= 0 then
        print(('[BASE] ignored player invocation of base_selftest from source=%s'):format(tostring(source)))
        return
    end
    local dbOk, failures = FlecityBaseDatabase.Selftest()
    local checks = {
        {'qbx_core', FlecityBaseFramework.IsReady()},
        {'lb-phone', GetResourceState('lb-phone') == 'started'},
        {'oxmysql', GetResourceState('oxmysql') == 'started'},
        {'database', dbOk},
        {'callbacks', registeredCallbacks == callbackCount()}
    }
    local failed = 0
    for _, check in ipairs(checks) do
        local state = check[2] and 'PASS' or 'FAIL'
        print(('[BASE] selftest %-12s %s'):format(check[1], state))
        if not check[2] then failed = failed + 1 end
    end
    if not dbOk then
        for _, tableName in ipairs(failures or {}) do print('[BASE] missing table '..tableName) end
    end
    print(('[BASE] selftest %s (%d/%d failed)'):format(failed == 0 and 'PASS' or 'FAIL', failed, #checks))
end, true)

CreateThread(function()
    while GetResourceState('oxmysql') ~= 'started' do Wait(500) end
    MySQL.ready(function()
        local ok = FlecityBaseDatabase.Ensure()
        if not ok then return end
        while GetResourceState('lb-phone') ~= 'started' do Wait(500) end
        registerCallbacks()
        local dbOk = FlecityBaseDatabase.Selftest()
        print(('[BASE] v%s server ready (db=%s)'):format(
            GetResourceMetadata(RESOURCE, 'version', 0) or 'unknown',
            dbOk and 'ready' or 'not-ready'
        ))
    end)
end)

AddEventHandler('onResourceStart', function(resource)
    if resource == 'lb-phone' then
        CreateThread(function()
            Wait(500)
            registerCallbacks()
        end)
    end
end)
