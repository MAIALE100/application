-- BASE optional stock fields (development-only, no changes to real inventories).
FlecityBaseCustom = FlecityBaseCustom or {}
local F = FlecityBaseCustom
local MAX_FIELDS = 6

local function plainText(input, maxChars)
    if type(input) ~= 'string' then return nil end
    local value = input:gsub('[%z\1-\8\11\12\14-\31]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    local length = utf8.len(value)
    if not length or length > maxChars then return nil end
    return value
end

local function normalizeValue(kind, raw)
    if raw == nil or raw == '' then return nil end
    if kind == 'text' then
        local value = plainText(raw, 120)
        -- nil is reserved for an explicit clear, never a validation failure.
        if value == nil then return false end
        return value
    elseif kind == 'number' then
        local rawString = type(raw) == 'number' and tostring(raw) or raw
        if type(rawString) ~= 'string' or not rawString:match('^%-?%d+%.?%d?%d?$') then return false end
        local n = tonumber(rawString)
        if not n or n ~= n or n < -1000000000 or n > 1000000000 then return false end
        return rawString
    elseif kind == 'date' then
        if type(raw) ~= 'string' then return false end
        local y, m, d = raw:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$')
        y, m, d = tonumber(y), tonumber(m), tonumber(d)
        if not y or y < 2000 or y > 2100 or not m or m < 1 or m > 12 then return false end
        local days = {31,28,31,30,31,30,31,31,30,31,30,31}
        if m == 2 and (y % 400 == 0 or (y % 4 == 0 and y % 100 ~= 0)) then days[2] = 29 end
        if not d or d < 1 or d > days[m] then return false end
        return raw
    elseif kind == 'check' then
        if raw == true or raw == 1 or raw == '1' then return '1' end
        if raw == false or raw == 0 or raw == '0' then return '0' end
        return false
    end
    return false
end

function F.ListFields(workspaceId, includeHidden)
    return MySQL.query.await([[
        SELECT id, label, field_type, visible, created_at
        FROM flecity_base_stock_fields
        WHERE workspace_id=? AND (?=1 OR visible=1)
        ORDER BY id ASC
    ]], {workspaceId, includeHidden and 1 or 0}) or {}
end

-- The client supplies only field IDs; types and permission to edit come from DB.
-- nil is "not supplied"; an empty string explicitly clears an existing value.
function F.ValidateValues(workspaceId, payload)
    if payload == nil then return {} end
    if type(payload) ~= 'table' then return nil, 'INVALID_CUSTOM_VALUES' end

    local fields = F.ListFields(workspaceId, false)
    local allowed = {}
    for _, f in ipairs(fields) do allowed[tonumber(f.id)] = f.field_type end

    local updates, count, seen = {}, 0, {}
    for key, raw in pairs(payload) do
        count = count + 1
        if count > MAX_FIELDS then return nil, 'INVALID_CUSTOM_VALUES' end
        local fid = tonumber(key)
        if not fid or fid % 1 ~= 0 or not allowed[fid] or seen[fid] then
            return nil, 'INVALID_CUSTOM_FIELD'
        end
        seen[fid] = true
        local value = normalizeValue(allowed[fid], raw)
        if value == false then return nil, 'INVALID_CUSTOM_VALUES' end
        updates[#updates + 1] = {id=fid, value=value}
    end
    return updates
end

-- Must be invoked inside the same oxmysql transaction as item creation/editing.
function F.WriteValues(query, workspaceId, itemId, updates)
    for _, entry in ipairs(updates or {}) do
        local result
        if entry.value == nil or entry.value == '' then
            result = query([[
                DELETE FROM flecity_base_stock_values
                WHERE workspace_id=? AND item_id=? AND field_id=?
            ]], {workspaceId, itemId, entry.id})
        else
            result = query([[
                INSERT INTO flecity_base_stock_values
                (workspace_id, item_id, field_id, field_value)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE field_value=VALUES(field_value)
            ]], {workspaceId, itemId, entry.id, entry.value})
        end
        if result == nil or result == false then return false end
    end
    return true
end

function F.LoadValues(workspaceId, includeHidden)
    return MySQL.query.await([[
        SELECT v.item_id, v.field_id, v.field_value
        FROM flecity_base_stock_values v
        JOIN flecity_base_stock_items i ON i.id=v.item_id AND i.workspace_id=?
        JOIN flecity_base_stock_fields f ON f.id=v.field_id AND f.workspace_id=?
        WHERE v.workspace_id=? AND (?=1 OR f.visible=1)
    ]], {workspaceId, workspaceId, workspaceId, includeHidden and 1 or 0}) or {}
end

function F.CreateField(workspaceId, label, kind)
    label = plainText(label, 40)
    if not label or label == '' then return nil, 'INVALID_CUSTOM_FIELD' end
    if kind ~= 'text' and kind ~= 'number' and kind ~= 'date' and kind ~= 'check' then
        return nil, 'INVALID_CUSTOM_FIELD'
    end

    local newId, failure
    local committed = MySQL.startTransaction(function(query)
        local lock = query('SELECT id FROM flecity_base_workspaces WHERE id=? FOR UPDATE', {workspaceId})
        if not lock or not lock[1] then return false end
        local count = query('SELECT COUNT(*) AS total FROM flecity_base_stock_fields WHERE workspace_id=?', {workspaceId})
        if (tonumber(count and count[1] and count[1].total) or 0) >= MAX_FIELDS then
            failure = 'CUSTOM_FIELD_LIMIT'
            return false
        end
        local duplicate = query('SELECT id FROM flecity_base_stock_fields WHERE workspace_id=? AND label=? LIMIT 1', {workspaceId, label})
        if duplicate and duplicate[1] then
            failure = 'CUSTOM_FIELD_DUPLICATE'
            return false
        end
        local inserted = query([[
            INSERT INTO flecity_base_stock_fields (workspace_id, label, field_type, visible)
            VALUES (?, ?, ?, 1)
        ]], {workspaceId, label, kind})
        newId = inserted and tonumber(inserted.insertId) or nil
        return newId ~= nil and newId > 0
    end)
    if committed ~= true then return nil, failure or 'SERVER_ERROR' end
    return newId
end

function F.SetVisibility(workspaceId, fieldId, visible)
    local changed = MySQL.update.await([[
        UPDATE flecity_base_stock_fields SET visible=?
        WHERE id=? AND workspace_id=?
    ]], {visible and 1 or 0, fieldId, workspaceId})
    return (tonumber(changed) or 0) > 0
end

-- Pure validation checks; database and multiplayer behavior are tested separately.
function F.Selftest()
    return normalizeValue('text', '日本語メモ') == '日本語メモ'
        and normalizeValue('text', string.rep('x', 121)) == false
        and normalizeValue('number', '120.50') == '120.50'
        and normalizeValue('number', '12.345') == false
        and normalizeValue('number', '1000000001') == false
        and normalizeValue('date', '2028-02-29') == '2028-02-29'
        and normalizeValue('date', '2027-02-29') == false
        and normalizeValue('check', true) == '1'
        and normalizeValue('check', '0') == '0'
        and normalizeValue('check', 'invalid') == false
end

