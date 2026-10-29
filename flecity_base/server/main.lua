local RESOURCE = GetCurrentResourceName()
local C = FlecityBaseConfig
local L = C.Limits

local function utf8Truncate(value, maxChars)
    if not maxChars then return value end
    local okLen, length = pcall(utf8.len, value)
    if not okLen or not length then return '' end
    if length <= maxChars then return value end
    local okOffset, byteIndex = pcall(utf8.offset, value, maxChars + 1)
    if not okOffset or not byteIndex then return value end
    return value:sub(1, byteIndex - 1)
end

local function clean(value, maxLen)
    local s = tostring(value or '')
        :gsub('[%z\1-\8\11\12\14-\31]', '')
        :gsub('^%s+', '')
        :gsub('%s+$', '')
    return utf8Truncate(s, maxLen)
end

local function integer(value, minValue, maxValue)
    local n = math.floor(tonumber(value) or 0)
    if minValue and n < minValue then n = minValue end
    if maxValue and n > maxValue then n = maxValue end
    return n
end

local function strictInteger(value, minValue, maxValue)
    local n = tonumber(value)
    if not n or n ~= n or n == math.huge or n == -math.huge then return nil end
    if n % 1 ~= 0 then return nil end
    if minValue and n < minValue then return nil end
    if maxValue and n > maxValue then return nil end
    return n
end

local function daysInMonth(year, month)
    local days = {31,28,31,30,31,30,31,31,30,31,30,31}
    if month == 2 and ((year % 400 == 0) or (year % 4 == 0 and year % 100 ~= 0)) then
        return 29
    end
    return days[month]
end

local function normalizeDateTime(value)
    local raw = clean(value, 32)
    if raw == '' then return nil end

    raw = raw:gsub('T', ' ')
    local y, mo, d, h, mi, sec = raw:match('^(%d%d%d%d)%-(%d%d)%-(%d%d) (%d%d):(%d%d):?(%d*)$')
    if not y then return false end

    y, mo, d, h, mi = tonumber(y), tonumber(mo), tonumber(d), tonumber(h), tonumber(mi)
    sec = sec ~= '' and tonumber(sec) or 0
    if not y or not mo or not d or not h or not mi or not sec then return false end
    if y < 2000 or y > 2100 or mo < 1 or mo > 12 then return false end
    if d < 1 or d > daysInMonth(y, mo) then return false end
    if h < 0 or h > 23 or mi < 0 or mi > 59 or sec < 0 or sec > 59 then return false end

    return ('%04d-%02d-%02d %02d:%02d:%02d'):format(y, mo, d, h, mi, sec)
end

local supportSessions = {}
local supportSourceCitizen = {}

local function clearSupportForSource(playerSource)
    local src = tonumber(playerSource)
    if not src then return end
    local citizenid = supportSourceCitizen[src]
    if citizenid then
        supportSessions[tostring(citizenid)] = nil
        supportSourceCitizen[src] = nil
    end
end

local function aceAllowed(source, ace)
    ace = tostring(ace or '')
    return ace ~= '' and IsPlayerAceAllowed(tonumber(source), ace) == true
end

local function isAdminSource(source)
    local access = C.Access or {}
    return aceAllowed(source, access.adminAce)
end

local function isWeazelSupportEligible(source)
    local access = C.Access or {}
    if aceAllowed(source, access.weazelSupportAce) then return true end

    local job = FlecityBaseFramework.GetJob(source)
    if not job or tostring(job.name or '') ~= tostring(access.weazelJob or 'weazel') then
        return false
    end

    if access.weazelRequireBoss == false then return true end
    if job.isboss == true then return true end
    return tonumber(job.grade or 0) >= tonumber(access.weazelMinimumGrade or 99)
end

local function sourceContext(source)
    local citizenid = FlecityBaseFramework.GetIdentifier(source)
    if not citizenid then return nil, {ok=false, error='PLAYER_NOT_READY'} end

    -- A player source can survive character switching without disconnecting.
    local src = tonumber(source)
    if src and supportSourceCitizen[src] and supportSourceCitizen[src] ~= citizenid then
        clearSupportForSource(src)
    end

    local admin = isAdminSource(source)
    local supportEligible = isWeazelSupportEligible(source)
    local supportActive = supportEligible and supportSessions[citizenid] == true or false
    local globalMode = admin and 'admin' or (supportActive and 'weazel_support' or nil)

    return {
        source = source,
        citizenid = citizenid,
        name = FlecityBaseFramework.GetCharacterName(source),
        isAdmin = admin,
        supportEligible = supportEligible,
        supportActive = supportActive,
        globalMode = globalMode
    }
end

local function auditAccess(ctx, action, workspace)
    if not ctx or not ctx.globalMode then return end
    pcall(function()
        MySQL.insert.await([[
            INSERT INTO flecity_base_access_audit
            (actor_citizenid, actor_name, access_type, action, workspace_id, workspace_name)
            VALUES (?, ?, ?, ?, ?, ?)
        ]], {
            ctx.citizenid,
            ctx.name,
            ctx.globalMode,
            tostring(action or 'access'),
            workspace and tonumber(workspace.id) or nil,
            workspace and tostring(workspace.name or '') or nil
        })
    end)
end

local function membership(workspaceId, citizenid)
    return MySQL.single.await([[
        SELECT w.id, w.owner_citizenid, w.name, w.icon, w.workspace_type, w.template_key,
               w.is_personal, w.created_at, w.updated_at, m.role
        FROM flecity_base_workspaces w
        JOIN flecity_base_members m ON m.workspace_id=w.id
        WHERE w.id=? AND m.citizenid=?
        LIMIT 1
    ]], {workspaceId, citizenid})
end

local function workspaceAccess(ctx, workspaceId)
    local id = integer(workspaceId, 1)
    local row = membership(id, ctx.citizenid)
    if row then
        -- Maintenance privileges do not disappear just because the maintainer
        -- also happens to be an ordinary member of this particular BASE.
        row.access_mode = ctx.globalMode or 'member'
        row.global_access = ctx.globalMode and 1 or 0
        return row
    end

    if not ctx.globalMode then return nil end

    row = MySQL.single.await([[
        SELECT id, owner_citizenid, name, icon, workspace_type, template_key, is_personal, created_at, updated_at
        FROM flecity_base_workspaces WHERE id=? LIMIT 1
    ]], {id})
    if not row then return nil end

    row.role = ctx.globalMode
    row.access_mode = ctx.globalMode
    row.global_access = 1
    return row
end

local function requireMember(ctx, workspaceId)
    local row = workspaceAccess(ctx, workspaceId)
    if not row then return nil, {ok=false, error='NOT_A_MEMBER'} end
    return row
end

local function hasManagerPower(row)
    return row and (
        tonumber(row.global_access) == 1 or
        row.role == 'owner' or
        row.role == 'manager'
    )
end

local function requireManager(ctx, workspaceId)
    local row, err = requireMember(ctx, workspaceId)
    if not row then return nil, err end
    if not hasManagerPower(row) then return nil, {ok=false, error='MANAGER_REQUIRED'} end
    return row
end

local function requireOwner(ctx, workspaceId)
    local row, err = requireMember(ctx, workspaceId)
    if not row then return nil, err end
    if tonumber(row.global_access) == 1 then return row end
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
    if ctx.globalMode then
        return MySQL.query.await([[
            SELECT w.id, w.name, w.icon, w.workspace_type, w.template_key, w.is_personal,
                   w.owner_citizenid, COALESCE(m.role, ?) AS role,
                   CASE WHEN m.role IS NULL THEN ? ELSE 'member' END AS access_mode,
                   (SELECT COUNT(*) FROM flecity_base_members mm WHERE mm.workspace_id=w.id) AS member_count
            FROM flecity_base_workspaces w
            LEFT JOIN flecity_base_members m
              ON m.workspace_id=w.id AND m.citizenid=?
            ORDER BY w.is_personal DESC, w.updated_at DESC, w.id DESC
        ]], {ctx.globalMode, ctx.globalMode, ctx.citizenid}) or {}
    end

    return MySQL.query.await([[
        SELECT w.id, w.name, w.icon, w.workspace_type, w.template_key, w.is_personal,
               w.owner_citizenid, m.role, 'member' AS access_mode,
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
        access = {
            admin = ctx.isAdmin == true,
            supportEligible = ctx.supportEligible == true,
            supportActive = ctx.supportActive == true,
            globalMode = ctx.globalMode
        },
        workspaces = listWorkspaces(ctx),
        invites = listInvites(ctx),
        templates = C.WorkspaceTemplates,
        appVersion = GetResourceMetadata(RESOURCE, 'version', 0) or 'unknown'
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
        ORDER BY FIELD(role,'owner','manager','member'), joined_at ASC
    ]], {workspace.id}) or {}
    if tonumber(workspace.global_access) == 1 then
        auditAccess(ctx, 'workspace_open', workspace)
    end
    return {ok=true, workspace=workspace, members=members}
end

handlers.workspaceOverview = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local metrics = MySQL.single.await([[
        SELECT
          (SELECT COUNT(*) FROM flecity_base_notes
             WHERE workspace_id=? AND deleted_at IS NULL) AS notes_count,
          (SELECT COUNT(*) FROM flecity_base_stock_items
             WHERE workspace_id=?) AS stock_count,
          (SELECT COUNT(*) FROM flecity_base_stock_items
             WHERE workspace_id=? AND quantity<=minimum_quantity) AS low_stock_count,
          (SELECT COUNT(*) FROM flecity_base_tasks
             WHERE workspace_id=? AND status<>'done') AS open_tasks_count,
          (SELECT COUNT(*) FROM flecity_base_tasks
             WHERE workspace_id=? AND status<>'done' AND due_at IS NOT NULL AND due_at<NOW()) AS overdue_tasks_count,
          (SELECT COALESCE(SUM(CASE
              WHEN entry_type='income' AND voided_at IS NULL THEN amount
              WHEN entry_type='expense' AND voided_at IS NULL THEN -amount
              ELSE 0 END),0)
             FROM flecity_base_ledger WHERE workspace_id=?) AS balance
    ]], {workspace.id, workspace.id, workspace.id, workspace.id, workspace.id, workspace.id}) or {}

    local recentNotes = MySQL.query.await([[
        SELECT id, title, category, author_citizenid, author_name, pinned, updated_at
        FROM flecity_base_notes
        WHERE workspace_id=? AND deleted_at IS NULL
        ORDER BY updated_at DESC, id DESC LIMIT 3
    ]], {workspace.id}) or {}

    local recentTasks = MySQL.query.await([[
        SELECT id, title, status, priority, assignee_citizenid, due_at, updated_at
        FROM flecity_base_tasks
        WHERE workspace_id=?
        ORDER BY updated_at DESC, id DESC LIMIT 3
    ]], {workspace.id}) or {}

    local recentStock = MySQL.query.await([[
        SELECT m.id, m.item_id, i.name AS item_name, i.unit, m.actor_citizenid, m.actor_name,
               m.delta, m.after_quantity, m.note, m.created_at
        FROM flecity_base_stock_movements m
        JOIN flecity_base_stock_items i ON i.id=m.item_id
        WHERE m.workspace_id=?
        ORDER BY m.created_at DESC, m.id DESC LIMIT 3
    ]], {workspace.id}) or {}

    local recentMoney = MySQL.query.await([[
        SELECT id, entry_type, amount, category, note, actor_citizenid, actor_name, created_at, voided_at
        FROM flecity_base_ledger
        WHERE workspace_id=?
        ORDER BY created_at DESC, id DESC LIMIT 3
    ]], {workspace.id}) or {}

    return {
        ok = true,
        metrics = {
            notes = tonumber(metrics.notes_count) or 0,
            stock = tonumber(metrics.stock_count) or 0,
            lowStock = tonumber(metrics.low_stock_count) or 0,
            openTasks = tonumber(metrics.open_tasks_count) or 0,
            overdueTasks = tonumber(metrics.overdue_tasks_count) or 0,
            balance = tonumber(metrics.balance) or 0
        },
        recentNotes = recentNotes,
        recentTasks = recentTasks,
        recentStock = recentStock,
        recentMoney = recentMoney
    }
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

handlers.workspaceSettings = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if tonumber(workspace.is_personal) == 1 then return {ok=false, error='PERSONAL_WORKSPACE'} end

    local name = clean(data.name, L.title)
    if name == '' then return {ok=false, error='NAME_REQUIRED'} end

    local icon = clean(data.icon or '📁', 32)
    if icon == '' then icon = '📁' end

    local workspaceType = clean(data.workspaceType or workspace.workspace_type or 'custom', 32):lower()
    if workspaceType == 'personal' or not C.WorkspaceTemplates[workspaceType] then
        workspaceType = 'custom'
    end

    local changed = MySQL.update.await([[
        UPDATE flecity_base_workspaces
        SET name=?, icon=?, workspace_type=?, template_key=?, updated_at=NOW()
        WHERE id=?
    ]], {name, icon, workspaceType, workspaceType, workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if tonumber(workspace.is_personal) == 1 then return {ok=false, error='PERSONAL_WORKSPACE'} end

    local invitee = clean(data.citizenid, 64)
    if invitee == '' or invitee == ctx.citizenid then return {ok=false, error='INVALID_INVITEE'} end
    local expiryHours = integer(C.InviteExpiryHours, 1, 720)
    local inviteSql = ([[
        INSERT INTO flecity_base_invites
        (workspace_id, invitee_citizenid, inviter_citizenid, status, expires_at)
        VALUES (?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL %d HOUR))
    ]]):format(expiryHours)

    local id, failure
    local committed = MySQL.startTransaction(function(query)
        -- All invitations/acceptances for the workspace serialize on this row.
        local locked = query('SELECT id FROM flecity_base_workspaces WHERE id=? FOR UPDATE', {workspace.id})
        if not locked or not locked[1] then return false end

        local counts = query('SELECT COUNT(*) AS total FROM flecity_base_members WHERE workspace_id=?', {workspace.id})
        if (tonumber(counts and counts[1] and counts[1].total) or 0) >= L.membersPerWorkspace then
            failure = 'MEMBER_LIMIT'
            return false
        end
        local already = query('SELECT citizenid FROM flecity_base_members WHERE workspace_id=? AND citizenid=? LIMIT 1', {workspace.id, invitee})
        if already and already[1] then
            failure = 'ALREADY_MEMBER'
            return false
        end

        local cancelled = query([[
            UPDATE flecity_base_invites SET status='cancelled'
            WHERE workspace_id=? AND invitee_citizenid=? AND status='pending'
        ]], {workspace.id, invitee})
        if not cancelled then return false end

        local pending = query([[
            SELECT COUNT(*) AS total FROM flecity_base_invites
            WHERE workspace_id=? AND status='pending' AND expires_at>NOW()
        ]], {workspace.id})
        if (tonumber(pending and pending[1] and pending[1].total) or 0) >= L.pendingInvitesPerWorkspace then
            failure = 'INVITE_LIMIT'
            return false
        end
        local created = query(inviteSql, {workspace.id, invitee, ctx.citizenid})
        id = created and tonumber(created.insertId) or nil
        return id ~= nil and id > 0
    end)
    if committed ~= true then return {ok=false, error=failure or 'SERVER_ERROR'} end
    return {ok=true, inviteId=id}
end

handlers.inviteAccept = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local inviteId = integer(data.inviteId, 1)
    local failure
    local committed = MySQL.startTransaction(function(query)
        local rows = query([[
            SELECT workspace_id FROM flecity_base_invites
            WHERE id=? AND invitee_citizenid=? AND status='pending' AND expires_at>NOW()
            LIMIT 1
        ]], {inviteId, ctx.citizenid})
        local initial = rows and rows[1]
        if not initial then
            failure = 'INVITE_NOT_FOUND'
            return false
        end

        -- Same lock order as workspaceInvite: lock workspace before modifying
        -- invitation/member rows. This also serializes concurrent acceptances.
        local locked = query('SELECT id FROM flecity_base_workspaces WHERE id=? FOR UPDATE', {initial.workspace_id})
        if not locked or not locked[1] then
            failure = 'INVITE_NOT_FOUND'
            return false
        end
        local invites = query([[
            SELECT id, workspace_id, inviter_citizenid FROM flecity_base_invites
            WHERE id=? AND invitee_citizenid=? AND status='pending' AND expires_at>NOW()
            LIMIT 1 FOR UPDATE
        ]], {inviteId, ctx.citizenid})
        local invite = invites and invites[1]
        if not invite then
            failure = 'INVITE_NOT_FOUND'
            return false
        end
        local counts = query('SELECT COUNT(*) AS total FROM flecity_base_members WHERE workspace_id=?', {invite.workspace_id})
        if (tonumber(counts and counts[1] and counts[1].total) or 0) >= L.membersPerWorkspace then
            failure = 'MEMBER_LIMIT'
            return false
        end
        local members = query('SELECT citizenid FROM flecity_base_members WHERE workspace_id=? AND citizenid=? LIMIT 1', {invite.workspace_id, ctx.citizenid})
        if members and members[1] then
            failure = 'ALREADY_MEMBER'
            return false
        end

        local inserted = query([[
            INSERT INTO flecity_base_members
            (workspace_id, citizenid, display_name, role, invited_by)
            VALUES (?, ?, ?, 'member', ?)
        ]], {invite.workspace_id, ctx.citizenid, ctx.name, invite.inviter_citizenid})
        if not inserted or tonumber(inserted.affectedRows) ~= 1 then return false end

        local accepted = query([[
            UPDATE flecity_base_invites SET status='accepted'
            WHERE id=? AND invitee_citizenid=? AND status='pending' AND expires_at>NOW()
        ]], {inviteId, ctx.citizenid})
        if not accepted or tonumber(accepted.affectedRows) ~= 1 then
            failure = 'INVITE_NOT_FOUND'
            return false
        end
        return true
    end)
    if committed ~= true then return {ok=false, error=failure or 'SERVER_ERROR'} end
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local target = clean(data.citizenid, 64)
    if target == '' or target == ctx.citizenid then return {ok=false, error='INVALID_MEMBER'} end

    local targetRow = MySQL.single.await([[
        SELECT citizenid, role FROM flecity_base_members
        WHERE workspace_id=? AND citizenid=? LIMIT 1
    ]], {workspace.id, target})
    if not targetRow then return {ok=false, error='MEMBER_NOT_FOUND'} end
    if targetRow.role == 'owner' then return {ok=false, error='CANNOT_REMOVE_OWNER'} end

    if tonumber(workspace.global_access) ~= 1 and workspace.role == 'manager' and targetRow.role ~= 'member' then
        return {ok=false, error='OWNER_REQUIRED'}
    end

    local changed = MySQL.update.await(
        'DELETE FROM flecity_base_members WHERE workspace_id=? AND citizenid=? AND role<>\'owner\'',
        {workspace.id, target}
    )
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.workspaceSetRole = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireOwner(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if tonumber(workspace.is_personal) == 1 then return {ok=false, error='PERSONAL_WORKSPACE'} end

    local target = clean(data.citizenid, 64)
    local role = clean(data.role, 16):lower()
    if role ~= 'manager' and role ~= 'member' then return {ok=false, error='INVALID_ROLE'} end

    local targetRow = MySQL.single.await([[
        SELECT citizenid, role FROM flecity_base_members
        WHERE workspace_id=? AND citizenid=? LIMIT 1
    ]], {workspace.id, target})
    if not targetRow then return {ok=false, error='MEMBER_NOT_FOUND'} end
    if targetRow.role == 'owner' then return {ok=false, error='CANNOT_CHANGE_OWNER'} end

    local changed = MySQL.update.await(
        'UPDATE flecity_base_members SET role=? WHERE workspace_id=? AND citizenid=?',
        {role, workspace.id, target}
    )
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.supportToggle = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    if not ctx.supportEligible then return {ok=false, error='SUPPORT_NOT_ALLOWED'} end

    data = type(data) == 'table' and data or {}
    local enabled = data.enabled == true
    supportSessions[ctx.citizenid] = enabled
    if enabled then
        supportSourceCitizen[tonumber(source)] = ctx.citizenid
    else
        supportSourceCitizen[tonumber(source)] = nil
    end

    local auditCtx = sourceContext(source)
    if not enabled then
        auditCtx = auditCtx or ctx
        auditCtx.globalMode = 'weazel_support'
    end
    auditAccess(auditCtx, enabled and 'support_on' or 'support_off', nil)

    local updated = sourceContext(source)
    return {
        ok = true,
        access = {
            admin = updated and updated.isAdmin == true or false,
            supportEligible = updated and updated.supportEligible == true or false,
            supportActive = updated and updated.supportActive == true or false,
            globalMode = updated and updated.globalMode or nil
        },
        workspaces = updated and listWorkspaces(updated) or {}
    }
end

handlers.notesList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local rows = MySQL.query.await([[
        SELECT id, author_citizenid, author_name, title, body, category, tags, pinned, created_at, updated_at
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
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
        INSERT INTO flecity_base_notes
        (workspace_id, author_citizenid, author_name, title, body, category, tags, pinned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], {workspace.id, ctx.citizenid, ctx.name, title, body, category, tags, data.pinned == true and 1 or 0})
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.noteUpdate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local changed = MySQL.update.await([[
        UPDATE flecity_base_notes SET deleted_at=NOW()
        WHERE id=? AND workspace_id=? AND deleted_at IS NULL
    ]], {integer(data.id, 1), workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.notePin = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local changed = MySQL.update.await([[
        UPDATE flecity_base_notes
        SET pinned=?, updated_at=NOW()
        WHERE id=? AND workspace_id=? AND deleted_at IS NULL
    ]], {data.pinned == true and 1 or 0, integer(data.id, 1), workspace.id})
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.stockList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local items = MySQL.query.await([[
        SELECT id, name, category, quantity, minimum_quantity, unit, created_by, created_by_name, created_at, updated_at
        FROM flecity_base_stock_items
        WHERE workspace_id=? ORDER BY category ASC, name ASC
    ]], {workspace.id}) or {}
    local recent = MySQL.query.await([[
        SELECT m.id, m.item_id, i.name AS item_name, i.unit, m.actor_citizenid, m.actor_name,
               m.delta, m.before_quantity, m.after_quantity, m.note, m.created_at
        FROM flecity_base_stock_movements m
        JOIN flecity_base_stock_items i ON i.id=m.item_id
        WHERE m.workspace_id=?
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 12
    ]], {workspace.id}) or {}
    local fieldList = FlecityBaseCustom.ListFields(workspace.id, true)
    local byId = {}
    for _, item in ipairs(items) do
        item.custom_values = {}
        byId[tonumber(item.id)] = item
    end
    for _, value in ipairs(FlecityBaseCustom.LoadValues(workspace.id)) do
        local item = byId[tonumber(value.item_id)]
        if item then
            item.custom_values[tostring(value.field_id)] = tostring(value.field_value or '')
        end
    end
    return {ok=true, items=items, recent=recent, customFields=fieldList}
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
        SELECT id, actor_citizenid, actor_name, delta, before_quantity, after_quantity, note, created_at
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local count = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_base_stock_items WHERE workspace_id=?', {workspace.id}) or 0)
    if count >= L.stockItemsPerWorkspace then return {ok=false, error='STOCK_LIMIT'} end
    local name = clean(data.name, L.title)
    if name == '' then return {ok=false, error='NAME_REQUIRED'} end
    local category = clean(data.category or 'general', 64)
    if category == '' then category = 'general' end
    local quantity = strictInteger(data.quantity, 0, L.stockQuantity)
    local minimum = strictInteger(data.minimumQuantity, 0, L.stockQuantity)
    if quantity == nil or minimum == nil then return {ok=false, error='INVALID_STOCK_QUANTITY'} end
    local unit = clean(data.unit or '個', 32)
    if unit == '' then unit = '個' end
    local extras, extraErr = FlecityBaseCustom.ValidateValues(workspace.id, data.customValues)
    if not extras then return {ok=false, error=extraErr} end
    -- The item and its initial movement must commit together. A failed history
    -- INSERT must not leave behind a stock record with undocumented quantity.
    local id
    local committed = MySQL.startTransaction(function(query)
        local created = query([[
            INSERT INTO flecity_base_stock_items
            (workspace_id, name, category, quantity, minimum_quantity, unit, created_by, created_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ]], {workspace.id, name, category, quantity, minimum, unit, ctx.citizenid, ctx.name})
        id = created and tonumber(created.insertId) or nil
        if not id or id < 1 then return false end

        if quantity ~= 0 then
            local recorded = query([[
                INSERT INTO flecity_base_stock_movements
                (workspace_id, item_id, actor_citizenid, actor_name, delta, before_quantity, after_quantity, note)
                VALUES (?, ?, ?, ?, ?, 0, ?, '初期在庫')
            ]], {workspace.id, id, ctx.citizenid, ctx.name, quantity, quantity})
            if not recorded or tonumber(recorded.affectedRows) ~= 1 then return false end
        end
        return FlecityBaseCustom.WriteValues(query, workspace.id, id, extras)
    end)
    return {ok=committed == true, id=committed and id or nil}
end

handlers.stockAdjust = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local itemId = integer(data.id, 1)
    local delta = strictInteger(data.delta, -L.stockQuantity, L.stockQuantity)
    if delta == nil then return {ok=false, error='INVALID_STOCK_DELTA'} end
    if delta == 0 then return {ok=false, error='ZERO_DELTA'} end
    local note = clean(data.note, L.shortText)

    local after, failure
    local committed = MySQL.startTransaction(function(query)
        -- Lock the actual item row; parallel adjustments must not both read the
        -- same starting quantity. The lock lives until the movement is written.
        local items = query([[
            SELECT quantity FROM flecity_base_stock_items
            WHERE id=? AND workspace_id=? FOR UPDATE
        ]], {itemId, workspace.id})
        local item = items and items[1] or nil
        if not item then
            failure = 'ITEM_NOT_FOUND'
            return false
        end

        local before = strictInteger(item.quantity, 0, L.stockQuantity)
        if before == nil then
            failure = 'INVALID_STOCK_QUANTITY'
            return false
        end
        after = before + delta
        if after < 0 or after > L.stockQuantity then
            failure = 'STOCK_OUT_OF_RANGE'
            return false
        end

        local changed = query([[
            UPDATE flecity_base_stock_items SET quantity=?, updated_at=NOW()
            WHERE id=? AND workspace_id=? AND quantity=?
        ]], {after, itemId, workspace.id, before})
        if not changed or tonumber(changed.affectedRows) ~= 1 then
            failure = 'STOCK_CHANGED_RETRY'
            return false
        end

        local recorded = query([[
            INSERT INTO flecity_base_stock_movements
            (workspace_id, item_id, actor_citizenid, actor_name, delta, before_quantity, after_quantity, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ]], {workspace.id, itemId, ctx.citizenid, ctx.name, delta, before, after, note})
        if not recorded or tonumber(recorded.affectedRows) ~= 1 then
            return false
        end
        return true
    end)

    if committed ~= true then
        return {ok=false, error=failure or 'SERVER_ERROR'}
    end
    return {ok=true, quantity=after, delta=delta}
end

handlers.stockConfigure = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local name = clean(data.name, L.title)
    if name == '' then return {ok=false, error='NAME_REQUIRED'} end
    local category = clean(data.category or 'general', 64)
    if category == '' then category = 'general' end
    local minimum = strictInteger(data.minimumQuantity, 0, L.stockQuantity)
    if minimum == nil then return {ok=false, error='INVALID_STOCK_QUANTITY'} end
    local unit = clean(data.unit or '個', 32)
    if unit == '' then unit = '個' end
    local extras, extraErr = FlecityBaseCustom.ValidateValues(workspace.id, data.customValues)
    if not extras then return {ok=false, error=extraErr} end
    local itemId = integer(data.id, 1)
    local failure
    local committed = MySQL.startTransaction(function(query)
        local item = query('SELECT id FROM flecity_base_stock_items WHERE id=? AND workspace_id=? FOR UPDATE', {itemId, workspace.id})
        if not item or not item[1] then
            failure = 'ITEM_NOT_FOUND'
            return false
        end
        local changed = query([[
            UPDATE flecity_base_stock_items
            SET name=?, category=?, minimum_quantity=?, unit=?, updated_at=NOW()
            WHERE id=? AND workspace_id=?
        ]], {name, category, minimum, unit, itemId, workspace.id})
        if not changed then return false end
        return FlecityBaseCustom.WriteValues(query, workspace.id, itemId, extras)
    end)
    return {ok=committed == true, error=committed and nil or (failure or 'SERVER_ERROR')}
end

handlers.stockFieldsList = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end
    return {ok=true, fields=FlecityBaseCustom.ListFields(workspace.id, hasManagerPower(workspace))}
end

handlers.stockFieldCreate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local id, reason = FlecityBaseCustom.CreateField(workspace.id, data.label, data.fieldType)
    if not id then return {ok=false, error=reason} end
    return {ok=true, fieldId=id}
end

handlers.stockFieldToggle = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    if type(data.visible) ~= 'boolean' then return {ok=false, error='INVALID_CUSTOM_VALUES'} end
    local fieldId = strictInteger(data.fieldId, 1)
    if not fieldId then return {ok=false, error='INVALID_CUSTOM_FIELD'} end
    local fields = FlecityBaseCustom.ListFields(workspace.id, true)
    local found
    for _, field in ipairs(fields) do
        if tonumber(field.id) == fieldId then found = field break end
    end
    if not found then return {ok=false, error='INVALID_CUSTOM_FIELD'} end
    if (tonumber(found.visible) == 1) == data.visible then return {ok=true} end
    return {ok=FlecityBaseCustom.SetVisibility(workspace.id, fieldId, data.visible)}
end

handlers.stockDelete = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local itemId = integer(data.id, 1)
    local item = MySQL.single.await([[
        SELECT id, name FROM flecity_base_stock_items
        WHERE id=? AND workspace_id=? LIMIT 1
    ]], {itemId, workspace.id})
    if not item then return {ok=false, error='ITEM_NOT_FOUND'} end
    if clean(data.confirmName, L.title) ~= tostring(item.name) then
        return {ok=false, error='DELETE_CONFIRM_MISMATCH'}
    end

    local changed = MySQL.update.await(
        'DELETE FROM flecity_base_stock_items WHERE id=? AND workspace_id=?',
        {itemId, workspace.id}
    )
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
               t.due_at, t.created_by, t.created_by_name, t.created_at, t.updated_at, t.completed_at,
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
    if not workspace then return accessErr end
    local count = tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM flecity_base_tasks WHERE workspace_id=? AND status<>'done'", {workspace.id}) or 0)
    if count >= L.tasksPerWorkspace then return {ok=false, error='TASK_LIMIT'} end
    local title = clean(data.title, L.title)
    if title == '' then return {ok=false, error='TITLE_REQUIRED'} end
    local details = clean(data.details, L.taskDetails)
    local priority = clean(data.priority or 'normal', 16):lower()
    if not validPriority[priority] then return {ok=false, error='INVALID_PRIORITY'} end
    local assignee = clean(data.assigneeCitizenId, 64)
    local checked = validAssignee(workspace.id, assignee)
    if checked == false then return {ok=false, error='INVALID_ASSIGNEE'} end
    local dueAt = normalizeDateTime(data.dueAt)
    if dueAt == false then return {ok=false, error='INVALID_DUE_AT'} end
    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_tasks
        (workspace_id, title, details, status, priority, assignee_citizenid, due_at, created_by, created_by_name)
        VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?)
    ]], {workspace.id, title, details, priority, checked, dueAt, ctx.citizenid, ctx.name})
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.taskUpdate = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireMember(ctx, data.workspaceId)
    if not workspace then return accessErr end

    local taskId = integer(data.id, 1)
    local existing = MySQL.single.await([[
        SELECT id, title, details, status, priority, assignee_citizenid, due_at
        FROM flecity_base_tasks WHERE id=? AND workspace_id=? LIMIT 1
    ]], {taskId, workspace.id})
    if not existing then return {ok=false, error='TASK_NOT_FOUND'} end

    if not hasManagerPower(workspace) then
        if tostring(existing.assignee_citizenid or '') ~= ctx.citizenid then
            return {ok=false, error='MANAGER_REQUIRED'}
        end
        local status = clean(data.status or existing.status, 16):lower()
        if not validTaskStatus[status] then return {ok=false, error='INVALID_TASK_STATUS'} end
        local completedAt = status == 'done' and os.date('%Y-%m-%d %H:%M:%S') or nil
        local changed = MySQL.update.await([[
            UPDATE flecity_base_tasks
            SET status=?, completed_at=?, updated_at=NOW()
            WHERE id=? AND workspace_id=?
        ]], {status, completedAt, taskId, workspace.id})
        return {ok=(tonumber(changed) or 0) > 0}
    end

    local title = clean(data.title, L.title)
    if title == '' then return {ok=false, error='TITLE_REQUIRED'} end
    local status = clean(data.status or 'todo', 16):lower()
    local priority = clean(data.priority or 'normal', 16):lower()
    if not validTaskStatus[status] then return {ok=false, error='INVALID_TASK_STATUS'} end
    if not validPriority[priority] then return {ok=false, error='INVALID_PRIORITY'} end
    local assignee = clean(data.assigneeCitizenId, 64)
    local checked = validAssignee(workspace.id, assignee)
    if checked == false then return {ok=false, error='INVALID_ASSIGNEE'} end
    local dueAt = normalizeDateTime(data.dueAt)
    if dueAt == false then return {ok=false, error='INVALID_DUE_AT'} end
    local completedAt = status == 'done' and os.date('%Y-%m-%d %H:%M:%S') or nil
    local changed = MySQL.update.await([[
        UPDATE flecity_base_tasks
        SET title=?, details=?, status=?, priority=?, assignee_citizenid=?, due_at=?,
            completed_at=?, updated_at=NOW()
        WHERE id=? AND workspace_id=?
    ]], {
        title, clean(data.details, L.taskDetails), status, priority, checked, dueAt,
        completedAt, taskId, workspace.id
    })
    return {ok=(tonumber(changed) or 0) > 0}
end

handlers.taskDelete = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
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
                local defaultValue = tonumber(item.defaultValue)
                if defaultValue == nil then defaultValue = 0 end
                if defaultValue ~= defaultValue or defaultValue == math.huge or defaultValue == -math.huge
                    or defaultValue > L.moneyAmount or defaultValue < -L.moneyAmount then
                    return nil, 'INVALID_CALCULATOR_NUMBER'
                end
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
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
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
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
        SELECT id, entry_type, amount, category, note, actor_citizenid, actor_name, created_at, voided_at, voided_by
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
    local amount = strictInteger(data.amount, 1, L.moneyAmount)
    if amount == nil then return {ok=false, error='INVALID_AMOUNT'} end
    local category = clean(data.category or 'other', 64)
    if category == '' then category = 'other' end
    local id = MySQL.insert.await([[
        INSERT INTO flecity_base_ledger
        (workspace_id, entry_type, amount, category, note, actor_citizenid, actor_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {workspace.id, entryType, amount, category, clean(data.note, L.shortText), ctx.citizenid, ctx.name})
    return {ok=id ~= nil, id=tonumber(id)}
end

handlers.moneyVoid = function(source, data)
    local ctx, err = sourceContext(source)
    if not ctx then return err end
    data = type(data) == 'table' and data or {}
    local workspace, accessErr = requireManager(ctx, data.workspaceId)
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
    ['flecity_base:workspaceOverview'] = handlers.workspaceOverview,
    ['flecity_base:workspaceRename'] = handlers.workspaceRename,
    ['flecity_base:workspaceSettings'] = handlers.workspaceSettings,
    ['flecity_base:workspaceDelete'] = handlers.workspaceDelete,
    ['flecity_base:workspaceInvite'] = handlers.workspaceInvite,
    ['flecity_base:inviteAccept'] = handlers.inviteAccept,
    ['flecity_base:inviteDecline'] = handlers.inviteDecline,
    ['flecity_base:workspaceLeave'] = handlers.workspaceLeave,
    ['flecity_base:workspaceRemoveMember'] = handlers.workspaceRemoveMember,
    ['flecity_base:workspaceSetRole'] = handlers.workspaceSetRole,
    ['flecity_base:supportToggle'] = handlers.supportToggle,
    ['flecity_base:notesList'] = handlers.notesList,
    ['flecity_base:noteCreate'] = handlers.noteCreate,
    ['flecity_base:noteUpdate'] = handlers.noteUpdate,
    ['flecity_base:noteDelete'] = handlers.noteDelete,
    ['flecity_base:notePin'] = handlers.notePin,
    ['flecity_base:stockList'] = handlers.stockList,
    ['flecity_base:stockFieldsList'] = handlers.stockFieldsList,
    ['flecity_base:stockFieldCreate'] = handlers.stockFieldCreate,
    ['flecity_base:stockFieldToggle'] = handlers.stockFieldToggle,
    ['flecity_base:stockHistory'] = handlers.stockHistory,
    ['flecity_base:stockCreate'] = handlers.stockCreate,
    ['flecity_base:stockAdjust'] = handlers.stockAdjust,
    ['flecity_base:stockConfigure'] = handlers.stockConfigure,
    ['flecity_base:stockDelete'] = handlers.stockDelete,
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
    local validatorsOk =
        strictInteger(1, 1, 10) == 1
        and strictInteger(0, 1, 10) == nil
        and strictInteger(-1, 0, 10) == nil
        and strictInteger(11, 0, 10) == nil
        and normalizeDateTime('2026-10-25T18:33') == '2026-10-25 18:33:00'
        and normalizeDateTime('2026-02-30T12:00') == false
        and normalizeDateTime('not-a-date') == false
        and utf8Truncate('日本語ABC', 3) == '日本語'

    local checks = {
        {'qbx_core', FlecityBaseFramework.IsReady()},
        {'lb-phone', GetResourceState('lb-phone') == 'started'},
        {'oxmysql', GetResourceState('oxmysql') == 'started'},
        {'stock_txn', type(MySQL.startTransaction) == 'function'},
        {'database', dbOk},
        {'callbacks', registeredCallbacks == callbackCount()},
        {'validators', validatorsOk}
    }
    local failed = 0
    for _, check in ipairs(checks) do
        local state = check[2] and 'PASS' or 'FAIL'
        print(('[BASE] selftest %-12s %s'):format(check[1], state))
        if not check[2] then failed = failed + 1 end
    end
    if not dbOk then
        for _, schemaItem in ipairs(failures or {}) do print('[BASE] missing schema item '..schemaItem) end
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




-- Character switching does not necessarily disconnect the player.
AddEventHandler('QBCore:Server:OnPlayerUnload', function(playerSource)
    clearSupportForSource(playerSource)
end)

-- A changed job invalidates an already granted WEAZEL maintenance session.
AddEventHandler('QBCore:Server:OnJobUpdate', function(playerSource)
    clearSupportForSource(playerSource)
end)

AddEventHandler('playerDropped', function()
    clearSupportForSource(source)
end)
