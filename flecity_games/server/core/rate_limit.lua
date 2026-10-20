FlecityGamesRateLimit = FlecityGamesRateLimit or {}
local buckets = {}

function FlecityGamesRateLimit.Allow(source, key, intervalMs)
    local src = tonumber(source)
    if not src then return false end
    local now = GetGameTimer()
    buckets[src] = buckets[src] or {}
    local untilAt = buckets[src][key] or 0
    if now < untilAt then return false end
    buckets[src][key] = now + math.max(0, tonumber(intervalMs) or 0)
    return true
end

function FlecityGamesRateLimit.Clear(source)
    buckets[tonumber(source)] = nil
end
