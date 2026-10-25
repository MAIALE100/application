-- Flecity Mining - LOCATION SETTINGS
-- マップ/MLO差分がある場合、基本的にこのファイルだけを編集してください.

Config = Config or {}

-- v0.3 cave test:
-- Great Chaparral Abandoned Mine.
-- The first hand-placed interior test coordinates caused a client to end up
-- below the world. These nodes now use coordinates already used by an
-- established FiveM mining resource at this same mine.
Config.SiteName = 'Great Chaparral Abandoned Mine'

-- Do not force-load/unload the mine IPL from this job resource.
-- Flecity/FiveM map resources may already manage this interior. The job only
-- uses world coordinates and leaves map streaming ownership to the server.
Config.MineInterior = {
    enabled = false,
    ipl = 'cs6_08_interior_cs6_08_mine_int',
    anchor = vector3(-596.33, 2089.04, 131.41),
}

Config.Foreman = {
    coords = vector3(-596.33, 2089.04, 131.41),
    label = '鉱山受付 / 買取',
}

Config.Processor = {
    coords = vector3(-602.40, 2094.20, 131.20),
    label = '選鉱設備',
}

-- coords = safe interaction position inside the mine.
-- A wall target is intentionally NOT hard-coded. At action start the client
-- raycasts horizontally around the player and selects the nearest rock/wall.
-- This avoids bad target coordinates and makes minor map/MLO differences much
-- easier to tolerate.
Config.MiningNodes = {
    { id = 1, coords = vector3(-590.29, 2059.35, 129.82), label = '坑道壁 A' },
    { id = 2, coords = vector3(-579.39, 2031.15, 127.49), label = '坑道壁 B' },
    { id = 3, coords = vector3(-562.47, 2011.81, 126.38), label = '坑道壁 C' },
    { id = 4, coords = vector3(-554.71, 1998.90, 125.85), label = '坑道壁 D' },
    { id = 5, coords = vector3(-547.26, 1986.08, 126.15), label = '坑道壁 E' },
    { id = 6, coords = vector3(-540.63, 1965.22, 125.81), label = '坑道壁 F' },
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
}
