# Flecity Mining Handoff

## Repository

- Repository: MAIALE100/application
- Development branch: jobs/mining-dev
- Resource: flecity_mining
- Current version: 0.1.0-dev

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

## Implemented

- Qbox qbx_core dependency
- Davis Quartz受付
- 6 mining nodes
- server-authoritative mining action
- 8.5 sec mining duration validation
- per-player node cooldown
- raw ore capacity 12
- 10 sec processing
- weighted iron/copper/silver/gold output
- 3 sec selling
- qbx_core:AddMoney
- payout failure retains ore
- action tokens
- distance checks
- action rate limiting
- client freeze/scenario animation
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

1. Static/code review of v0.1
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
