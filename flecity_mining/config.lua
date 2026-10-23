Config = {}

Config.Debug = false

-- Beginner/public-job policy:
-- No job grade, no mining level, no permanent efficiency upgrades.
Config.MoneyType = 'cash'
Config.MoneyReason = 'flecity_mining:quarry_sale'

Config.DrawDistance = 18.0
Config.InteractDistance = 2.2
Config.ServerDistanceTolerance = 4.5

Config.MaxRawOre = 12
Config.NodeCooldownMs = 30000

Config.MiningDurationMs = 8500
Config.ProcessingDurationMs = 10000
Config.SellingDurationMs = 3000

Config.RawYield = {
    min = 1,
    max = 2,
}

-- Initial balance values. These are intentionally centralized so live-test
-- income can be tuned without rewriting client/server logic.
Config.RefinedProducts = {
    { id = 'iron',   label = '鉄',   weight = 50, value = 180 },
    { id = 'copper', label = '銅',   weight = 30, value = 240 },
    { id = 'silver', label = '銀',   weight = 15, value = 420 },
    { id = 'gold',   label = '金',   weight = 5,  value = 850 },
}

-- Davis Quartz quarry. Coordinates are isolated here so Flecity can adjust
-- them for map/MLO differences without touching job logic.
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
