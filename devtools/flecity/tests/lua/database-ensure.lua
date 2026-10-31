local source=assert(arg[1], 'database.lua path required')
local function run(legacy)
    local queries={}
    MySQL={
        query={await=function(sql)
            queries[#queries+1]=sql
            assert(sql:match('^%s*CREATE TABLE IF NOT EXISTS') or sql:match('^ALTER TABLE'), 'unexpected write')
            return true
        end},
        scalar={await=function(sql,args)
            if sql:find('information_schema.COLUMNS',1,true) then return legacy and 0 or 1 end
            if sql:find('information_schema.STATISTICS',1,true) then return legacy and 0 or 1 end
            if sql:find('information_schema.TABLES',1,true) then return legacy and 'latin1_swedish_ci' or 'utf8mb4_unicode_ci' end
            error('unexpected metadata read: '..sql)
        end}
    }
    FlecityGamesDatabase={}
    assert(loadfile(source))()
    local ok,err=FlecityGamesDatabase.Ensure()
    assert(ok,err)
    local creates,alters=0,0
    for _,sql in ipairs(queries) do
        if sql:match('^%s*CREATE TABLE IF NOT EXISTS') then creates=creates+1 else alters=alters+1 end
    end
    assert(creates==6, 'six managed CREATE IF NOT EXISTS required')
    assert(alters==(legacy and 9 or 0), 'unexpected conditional ALTER count: '..alters)
    return creates,alters
end
local normalCreates,normalAlters=run(false)
local legacyCreates,legacyAlters=run(true)
print(('PASS startup Ensure metadata paths; current=%d CREATE/%d ALTER; legacy=%d CREATE/%d ALTER; no live DB'):format(normalCreates,normalAlters,legacyCreates,legacyAlters))
