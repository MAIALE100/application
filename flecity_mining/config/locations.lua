-- Flecity Mining - LOCATION SETTINGS
-- マップ/MLO差分がある場合、基本的にこのファイルだけを編集してください.

Config = Config or {}

Config.SiteName = 'Great Chaparral Abandoned Mine'

-- Great Chaparral mine tracking only.
-- IMPORTANT: flecity_mining intentionally does NOT call RequestIpl/RemoveIpl.
-- The surrounding cs6_08 world is handled by GTA/FiveM streaming. Forcing its
-- base/critical/long/interior YMAP variants caused exterior terrain corruption
-- on the test client.
Config.MineInterior = {
    enabled = true,
    anchor = vector3(-596.33, 2089.04, 131.41),
    interiorId = 202241,
    manageIpls = false,
}

-- The stock mine door can remain visibly shut depending on map state.
-- Access therefore uses a short fade + safe teleport between two known points.
Config.MineAccess = {
    outside = vector4(-596.33, 2089.04, 131.41, 180.0),
    inside = vector4(-590.29, 2059.35, 129.82, 180.0),
    interactDistance = 2.2,
    markerDistance = 8.0,
    transitionCooldownMs = 1800,
}

Config.Foreman = {
    coords = vector3(-596.33, 2089.04, 131.41),
    label = '鉱山受付 / 買取',
}

Config.Processor = {
    coords = vector3(-602.40, 2094.20, 131.20),
    label = '選鉱設備',
}

-- The first proven interior point is reserved for the mine entrance/exit.
-- Mining nodes use additional coordinates already used by a live FiveM mine.
Config.MiningNodes = {
    { id = 1, coords = vector3(-579.39, 2031.15, 127.49), label = '坑道壁 A' },
    { id = 2, coords = vector3(-562.47, 2011.81, 126.38), label = '坑道壁 B' },
    { id = 3, coords = vector3(-554.71, 1998.90, 125.85), label = '坑道壁 C' },
    { id = 4, coords = vector3(-547.26, 1986.08, 126.15), label = '坑道壁 D' },
    { id = 5, coords = vector3(-540.63, 1965.22, 125.81), label = '坑道壁 E' },
    { id = 6, coords = vector3(-532.15, 1979.34, 126.12), label = '坑道壁 F' },
}

Config.Blip = {
    enabled = true,
    coords = vector3(-596.33, 2089.04, 131.41),
    sprite = 318,
    colour = 5,
    scale = 0.85,
    label = '公共鉱山',
}

Config.Markers = {
    foreman = { enabled = true, type = 1, scale = vector3(1.10, 1.10, 0.28), visibleDistance = 18.0 },
    processor = { enabled = true, type = 1, scale = vector3(1.10, 1.10, 0.28), visibleDistance = 18.0 },
    mine = { enabled = true, type = 2, scale = vector3(0.20, 0.20, 0.20), visibleDistance = 4.0 },
    access = { enabled = true, type = 1, scale = vector3(0.75, 0.75, 0.18) },
}
