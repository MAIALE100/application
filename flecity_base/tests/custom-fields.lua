-- Run from repository root: lua5.4 flecity_base/tests/custom-fields.lua
-- Mock query results, not a replacement for oxmysql/MariaDB integration tests.
dofile('flecity_base/server/custom_fields.lua')
local F = FlecityBaseCustom
local fields = {
    {id=1, field_type='text'}, {id=2, field_type='number'},
    {id=3, field_type='date'}, {id=4, field_type='check'}
}
MySQL = {query={await=function(_, args)
    assert(args[1] == 7 and args[2] == 0)
    return fields
end}}
local function valid(payload, value)
    local updates, err = F.ValidateValues(7, payload)
    assert(updates and not err)
    if value ~= nil then assert(updates[1].value == value) end
    return updates
end
local function invalid(payload, reason)
    local updates, err = F.ValidateValues(7, payload)
    assert(updates == nil and err == (reason or 'INVALID_CUSTOM_VALUES'))
end
assert(F.Selftest())
assert(#valid(nil) == 0)
assert(#valid({}) == 0)
valid({['1']=string.rep('全',120)}, string.rep('全',120))
valid({['1']='  日本語😀  '}, '日本語😀')
invalid({['1']=string.rep('全',121)})
invalid({['1']=string.char(255)})
for _, raw in ipairs({true, false, 42, {}}) do invalid({['1']=raw}) end
valid({['1']=''}, nil)
valid({['1']='  '}, '')
valid({['2']='-1000000000'}, '-1000000000')
invalid({['2']='1000000001'})
invalid({['2']='１２'})
invalid({['2']='1.234'})
valid({['3']='2028-02-29'}, '2028-02-29')
invalid({['3']='2027-02-29'})
valid({['4']=false}, '0')
invalid({['5']='foreign/hidden'}, 'INVALID_CUSTOM_FIELD')
invalid({[1]='first', ['1']='second'}, 'INVALID_CUSTOM_FIELD')

-- Invalid text must stop before persistence; an explicit clear must DELETE.
local clears = valid({['1']=''})
local calls = 0
assert(F.WriteValues(function(sql, args)
    calls = calls + 1
    assert(sql:find('DELETE FROM',1,true))
    assert(args[1]==7 and args[2]==8 and args[3]==1)
    return {affectedRows=0} -- Clearing an unset value is still successful.
end, 7, 8, clears))
assert(calls == 1)
local updates = valid({['1']='replacement'})
assert(not F.WriteValues(function() return nil end,7,8,updates))
assert(not F.WriteValues(function() return false end,7,8,updates))
assert(F.WriteValues(function() return {affectedRows=1} end,7,8,updates))

-- startTransaction passes raw row arrays / ResultSetHeader tables.
-- Verify callback rollback and committed=false do not report a created field.
local committed, insertResult = true, {insertId=9, affectedRows=1}
MySQL.startTransaction = function(callback)
    local step = 0
    local result = callback(function()
        step = step + 1
        if step == 1 then return {{id=7}} end
        if step == 2 then return {{total=0}} end
        if step == 3 then return {} end
        return insertResult
    end)
    return committed and result == true
end
assert(F.CreateField(7,'保管場所','text') == 9)
committed = false
local id, err = F.CreateField(7,'保管場所','text')
assert(id == nil and err == 'SERVER_ERROR')
committed = true
insertResult = false
id, err = F.CreateField(7,'保管場所','text')
assert(id == nil and err == 'SERVER_ERROR')
insertResult = nil
id, err = F.CreateField(7,'保管場所','text')
assert(id == nil and err == 'SERVER_ERROR')
-- Missing either optional-field table must fail the database selftest.
dofile('flecity_base/server/database.lua')
for _, missing in ipairs({'flecity_base_stock_fields', 'flecity_base_stock_values'}) do
    MySQL.scalar = {await=function(sql, args)
        if sql:find('information_schema.TABLES',1,true) and args[1] == missing then return 0 end
        return 1
    end}
    local ok, failures = FlecityBaseDatabase.Selftest()
    assert(not ok and #failures == 1 and failures[1] == missing)
end
MySQL.scalar = {await=function() return 1 end}
assert(FlecityBaseDatabase.Selftest())
print('BASE custom field runtime regressions: PASS')
