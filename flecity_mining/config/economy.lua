-- Flecity Mining - ECONOMY SETTINGS
-- 運営が主に触る報酬設定です。
-- ロジック本体を変更せず、このファイルだけで金策バランスを調整できます。

Config = Config or {}

Config.Economy = {
    -- 支払い先: 'cash' / 'bank' / 'crypto'
    moneyType = 'cash',

    -- QBoxの取引履歴などで使う理由文字列
    moneyReason = 'flecity_mining:quarry_sale',

    -- 選鉱後に得られる鉱石
    --
    -- weight:
    --   抽選比率。合計100でなくても動きます。
    --   例: 50/30/15/5 = 50%/30%/15%/5%
    --
    -- value:
    --   1個あたりのNPC買取価格
    --
    -- 初期値の期待売価:
    --   1原石あたり 約 $267.5
    --   原石12個なら平均 約 $3,210
    products = {
        { id = 'iron',   label = '鉄', weight = 50, value = 180 },
        { id = 'copper', label = '銅', weight = 30, value = 240 },
        { id = 'silver', label = '銀', weight = 15, value = 420 },
        { id = 'gold',   label = '金', weight = 5,  value = 850 },
    },

    -- 将来の高リスク坑道用。
    -- v0.1では未使用。ここに置いておくことで運営調整箇所を集約します。
    dangerous = {
        enabled = false,
        payoutMultiplier = 1.50,
        rareJackpotValue = 5000,
    },
}

-- 互換用。既存ロジックはこの名前を参照します。
Config.MoneyType = Config.Economy.moneyType
Config.MoneyReason = Config.Economy.moneyReason
Config.RefinedProducts = Config.Economy.products
