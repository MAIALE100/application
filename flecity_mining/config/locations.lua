-- Flecity Mining - LOCATION SETTINGS
-- マップ/MLO差分がある場合、基本的にこのファイルだけを編集してください。

Config = Config or {}

-- Davis Quartz quarry
Config.Foreman = {
    coords = vector3(2953.50, 2789.00, 41.50),
    label = '鉱山受付 / 買取',
}

Config.Processor = {
    coords = vector3(2976.20, 2796.80, 41.50),
    label = '選鉱設備',
}

Config.MiningNodes = {
    { id = 1, coords = vector3(2968.20, 2779.80, 39.20), label = '採掘地点 A' },
    { id = 2, coords = vector3(2975.50, 2768.40, 39.50), label = '採掘地点 B' },
    { id = 3, coords = vector3(2954.10, 2761.30, 39.80), label = '採掘地点 C' },
    { id = 4, coords = vector3(2937.80, 2772.60, 39.40), label = '採掘地点 D' },
    { id = 5, coords = vector3(2925.30, 2788.10, 39.90), label = '採掘地点 E' },
    { id = 6, coords = vector3(2942.00, 2805.50, 41.20), label = '採掘地点 F' },
}

Config.Blip = {
    enabled = true,
    coords = vector3(2953.50, 2789.00, 41.50),
    sprite = 318,
    colour = 5,
    scale = 0.85,
    label = '公共鉱山',
}

Config.Markers = {
    foreman = { type = 1, scale = vector3(1.25, 1.25, 0.35) },
    processor = { type = 1, scale = vector3(1.25, 1.25, 0.35) },
    mine = { type = 2, scale = vector3(0.55, 0.55, 0.55) },
}
