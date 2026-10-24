-- Flecity Mining - LOCATION SETTINGS
-- マップ/MLO差分がある場合、基本的にこのファイルだけを編集してください。

Config = Config or {}

-- v0.3: 屋外採石場から「坑道内の壁面をドリルで掘る」見た目へ移行。
-- Great Chaparral の標準Abandoned Mineを使用します。
-- 内部座標は実機スクリーンショットで微調整する前提のテスト値です。
Config.SiteName = 'Great Chaparral Abandoned Mine'

Config.MineInterior = {
    enabled = true,
    ipl = 'cs6_08_interior_cs6_08_mine_int',
    anchor = vector3(-592.81, 2077.31, 132.01),
}

-- 受付/買取は坑道入口側。選鉱設備は入口外側に置き、坑道内の採掘と役割を分離します。
Config.Foreman = {
    coords = vector3(-595.34, 2086.01, 131.41),
    label = '鉱山受付 / 買取',
}

Config.Processor = {
    coords = vector3(-602.40, 2094.20, 131.20),
    label = '選鉱設備',
}

-- coords  = プレイヤーが立つ位置
-- target  = ドリルを当てる岩壁位置
-- 実機で /mine_devpos と /mine_devwall を使うと調整用値を取得できます。
Config.MiningNodes = {
    { id = 1, coords = vector3(-592.60, 2076.80, 132.00), target = vector3(-591.20, 2075.90, 132.20), label = '坑道壁 A' },
    { id = 2, coords = vector3(-586.70, 2065.20, 131.85), target = vector3(-585.10, 2064.80, 132.10), label = '坑道壁 B' },
    { id = 3, coords = vector3(-578.80, 2053.40, 131.60), target = vector3(-577.20, 2052.80, 131.90), label = '坑道壁 C' },
    { id = 4, coords = vector3(-569.80, 2039.20, 130.90), target = vector3(-568.20, 2038.60, 131.20), label = '坑道壁 D' },
    { id = 5, coords = vector3(-559.60, 2022.20, 129.40), target = vector3(-558.00, 2021.60, 129.70), label = '坑道壁 E' },
    { id = 6, coords = vector3(-549.80, 2003.20, 127.30), target = vector3(-548.20, 2002.70, 127.60), label = '坑道壁 F' },
}

Config.Blip = {
    enabled = true,
    coords = vector3(-595.34, 2086.01, 131.41),
    sprite = 318,
    colour = 5,
    scale = 0.85,
    label = '公共鉱山',
}

-- 採掘ポイントの巨大矢印は廃止。
-- GPS + 近距離3Dテキストを主導線にし、壁面の目印は4m以内だけ小さく出します。
Config.Markers = {
    foreman = { enabled = true, type = 1, scale = vector3(1.10, 1.10, 0.28), visibleDistance = 18.0 },
    processor = { enabled = true, type = 1, scale = vector3(1.10, 1.10, 0.28), visibleDistance = 18.0 },
    mine = { enabled = true, type = 2, scale = vector3(0.20, 0.20, 0.20), visibleDistance = 4.0 },
}
