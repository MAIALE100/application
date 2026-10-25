# Flecity Mining Handoff

## Repository

- Repository: MAIALE100/application
- Development branch: jobs/mining-dev
- Resource: flecity_mining
- Current version: 0.3.6-dev

## Product goal

白市民、とくに初心者を「とりあえず金策へ行ってきて」と案内できる公共鉱山。

必須条件:

- 完全ソロ完結
- 企業負担なし
- 他プレイヤー不要
- 初心者と古参の恒久性能差なし
- レベル制なし
- 無料開始
- 通常坑道は苦行寄りだが安定して儲かる
- 将来、重労働/危険坑道で本人の選択によるリスク・リターン差を追加する

## Operator-facing configuration

運営が触る設定をゲームロジックから分離済み:

- `flecity_mining/config/economy.lua` - 鉱石確率・NPC買取価格・支払方法
- `flecity_mining/config/gameplay.lua` - 作業時間・採掘量・選鉱バッチ・クールダウン
- `flecity_mining/config/locations.lua` - 全座標・ブリップ・マーカー
- `flecity_mining/OPERATIONS.md` - 運営向け設定ガイド
- `mining_economy` - 現在の確率/単価/期待値を表示
- `mining-update.cmd` - テストサーバーへの1コマンド配備

## Implemented

- Qbox qbx_core dependency
- Great Chaparral廃坑受付/入退場
- 6 mining nodes
- server-authoritative mining action
- 8.5 sec mining duration validation
- per-player node cooldown
- raw ore storage unlimited; processing batched at 100 per action
- 10 sec processing
- weighted iron/copper/silver/gold output
- 3 sec selling
- qbx_core:AddMoney
- payout failure retains ore
- action tokens
- distance checks
- action rate limiting
- Fleeca drill prop + verified/retried drill animation + sound/dust
- resource-stop unfreeze safeguard
- /mine_status
- /mine_end
- console mining_server_status
- README
- TESTING checklist

## Not implemented yet

- physical cart / carried ore prop
- NPC foreman ped
- heavy-labor zone
- dangerous mine
- gas / collapse / injury risk
- rare jackpot vein
- live economy tuning
- Flecity-specific map/MLO coordinate tuning
- deployment helper for the user's test server

## Next recommended work

1. Static/code review of v0.2
2. Deploy resource to test server
3. Confirm Davis Quartz marker coordinates
4. Complete one full mine -> process -> sell loop
5. Record one-load time and payout
6. Tune normal-mine hourly income
7. Only after normal mine is stable, add heavy-labor and high-risk variants

## Framework assumptions

Current Flecity information:

- QBox 2.5.4
- citizen identifier: citizenid
- resource is independent from LB Phone
- no SQL required for v0.1

Do not add a mining level or permanent performance progression without explicit product-direction change.


## v0.3 Cave presentation

- 通常採掘場所をGreat Chaparral Abandoned Mineへ移行
- `cs6_08`系IPL一式をrequestし、閉鎖木戸は安全な入退場transitionで回避
- 採掘nodeは `coords`（立ち位置）だけ保持し、壁面は360°raycastで自動検出
- Fleeca drill prop `hei_prop_heist_drill`
- drilling animation `anim@heists@fleeca_bank@drilling`
- drill sound + rock dust effect
- 採掘マーカーを近距離の小型表示へ縮小
- `/mine_devpos` と `/mine_devwall` で実機座標採取可能
- 坑道node座標は実機未確定。スクリーンショット/座標で調整すること
- 通常坑道の実機合格までは重労働・危険坑道を本実装しない

GitHub ActionsのFlecity Mining Static Checkはこのリポジトリ上で過去runを含め成功履歴がなく、
job stepが開始される前にfailureになっているため、現時点ではCI成功を実機合格条件にしない。
FiveM起動時selftest/configcheckと実機smoke testを必須ゲートとする。
