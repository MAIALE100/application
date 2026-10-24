# Flecity Mining 運営向け設定ガイド

このresourceでは、運営が日常的に調整する箇所とロジック本体を分離しています。

## 運営が主に触る場所

### 1. 報酬・確率
`config/economy.lua`

通常運用で最も触る可能性が高いファイルです。

```lua
{ id = 'iron', label = '鉄', weight = 50, value = 180 }
```

- `weight`: 出現比率
- `value`: 1個あたりのNPC買取価格

weightの合計は100でなくても問題ありません。

初期値では、おおよその期待売価は以下です。

- 原石1個: 約 $267.5
- 原石12個: 約 $3,210

実際の時給は、移動時間・採掘回数・ランダム採掘量によって変動します。
本番投入前にテストサーバーで30分計測し、Flecityの既存金策と比較して調整してください。

### 2. 作業時間・容量
`config/gameplay.lua`

- 原石最大所持数
- 採掘時間
- 選鉱時間
- 売却時間
- 採掘ポイントのクールダウン
- 1回の採掘量

を変更できます。

### 3. 座標・マーカー
`config/locations.lua`

- 受付
- 選鉱設備
- 採掘ポイント
- マップブリップ
- マーカー

を変更できます。

Flecity側のMLOやマップ差分がある場合は、基本的にこのファイルのみ修正してください。

### 4. 坑道採掘地点
`config/locations.lua`

各nodeは以下の2座標で構成します。

```lua
{ id = 1, coords = vector3(...), target = vector3(...), label = '坑道壁 A' }
```

- `coords`: プレイヤーが立つ位置
- `target`: ドリルを当てる岩壁位置

テスト中は `/mine_devpos` と `/mine_devwall` で座標を採取できます。
v0.3初期値は実機調整前なので、本番投入前に全nodeを現地確認してください。

ドリルprop・animation・音・粉塵は `config/gameplay.lua` の `Config.DrillVisuals` で設定します。

## 基本的に触らなくてよい場所

- `client/main.lua`
- `server/main.lua`
- `server/selftest.lua`

上記はゲームロジック・不正対策・QBox連携部分です。
報酬調整のために編集する必要はありません。

## 確認コマンド

サーバー起動後:

```
mining_selftest
mining_healthcheck
mining_economy
```

`mining_economy` は現在の鉱石単価・抽選比率・期待売価をコンソールに表示します。

## 設計上の固定方針

- 採掘レベルなし
- ジョブランクなし
- 初心者/古参の恒久性能差なし
- 企業不要
- 完全ソロ完結
- NPC売却
- 報酬計算はサーバー側

これらを変更しない限り、初心者向け公共金策としての性格を維持できます。
