FlecityGamesText = FlecityGamesText or {}

function FlecityGamesText.Normalize(value)
    local text=tostring(value or ''):gsub('%c',' '):gsub('%s+',' ')
    return text:gsub('^%s+',''):gsub('%s+$','')
end

function FlecityGamesText.Length(value)
    local text=tostring(value or '')
    local ok,length=pcall(utf8.len,text)
    if ok and length then return length end
    return #text
end

function FlecityGamesText.Truncate(value,maxCharacters)
    local text=tostring(value or '')
    local limit=math.max(0,math.floor(tonumber(maxCharacters) or 0))
    if limit==0 or text=='' then return '' end
    local ok,position=pcall(utf8.offset,text,limit+1)
    if ok then
        if position then return text:sub(1,position-1) end
        return text
    end
    return text:sub(1,limit)
end

function FlecityGamesText.DebugSelftest()
    local sample='日本語ABC'
    local truncated=FlecityGamesText.Truncate(sample,4)
    return {
        utf8Length=FlecityGamesText.Length(sample)==6,
        utf8Truncate=truncated=='日本語A',
        normalize=FlecityGamesText.Normalize('  A   B  ')=='A B'
    }
end
