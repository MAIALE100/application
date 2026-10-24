-- Flecity Mining - GAMEPLAY SETTINGS
-- 作業時間・容量・クールダウン・演出など、ゲームテンポを調整する設定です。

Config = Config or {}

Config.Debug = false

-- 初心者向け公共金策の方針:
-- レベル、ジョブランク、永久的な性能強化は入れません。

Config.DrawDistance = 18.0
Config.InteractDistance = 2.2
Config.ServerDistanceTolerance = 4.5

-- 原石バッグ容量
Config.MaxRawOre = 12

-- 同一採掘ポイントを再度掘れるまでの時間
Config.NodeCooldownMs = 30000

-- 各作業時間
Config.MiningDurationMs = 8500
Config.ProcessingDurationMs = 10000
Config.SellingDurationMs = 3000

-- 1回の採掘で入手する原石数
Config.RawYield = {
    min = 1,
    max = 2,
}

-- 壁面ドリル演出。
-- FiveM標準のFleecaドリルprop/animationを使うため、追加assetは不要です。
Config.DrillVisuals = {
    enabled = true,
    model = 'hei_prop_heist_drill',
    animDict = 'anim@heists@fleeca_bank@drilling',
    animName = 'drill_straight_fail',
    sound = true,
    dust = true,
    dustIntervalMs = 550,
    loadTimeoutMs = 2500,
}

-- テスト中だけ使う座標採取コマンド。
-- 本番提出前は false にしてもゲーム本体には影響しません。
Config.DevTools = true

-- 運営設定に誤りがある場合、resource自体を落とすのではなく
-- 新規作業開始だけを停止し、コンソールに理由を表示します。
-- 確認: mining_configcheck
