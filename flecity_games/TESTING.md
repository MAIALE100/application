# Flecity Games Test Plan

この手順は、1人で確認できる範囲を先に完了し、その後に2〜3人でPARTY同期を確認するためのテスト手順です。

## 0. 起動前・更新

通常の更新は、開発PCのリポジトリ直下にある `games-update.cmd` をダブルクリックするだけでよい。

自動で以下を行う。

- `games/platform-core` の最新版取得
- `flecity_games/` だけをテストSERVERへ同期
- 配置後のLB Phone Bridge / HTML / version整合性確認
- 差分がある場合だけ `flecity_games` を自動restart
- 差分が無ければrestartしない
- SERVER全体は再起動しない

初回だけ `restart flecity_games` をSERVERコンソールで1回実行し、dev auto-reload watcherを有効にする。

resource起動時にDB作成とnon-player preflightが自動実行され、正常ならSERVERログへ

```text
[FlecityGames] startup preflight READY_FOR_LIVE_TEST
```

と表示される。

`game_preflight` / `game_selftest` / `game_healthcheck` は、問題が出た時の追加診断用として残す。通常更新ごとに手動実行する必要はない。

前提:

- `oxmysql` が起動済み
- 実SERVERのFramework Adapterが一致している
- `lb-phone` が起動済み
- `ensure flecity_games` がserver.cfgに存在する
- Flecity GamesのDBテーブルはresource起動時に自動作成される
- 手動SQLは通常不要。権限不足時の予備として `sql/001_initial.sql` を残す

---

# 1. 1人で行う確認

## LB Phone

- PLAYアイコンが表示される
- PARTYアイコンが表示される
- PLAYを開閉できる
- PARTYを開閉できる
- Phoneを閉じて再度開いても白画面にならない
- resource restart後に両アプリが再登録される

## PLAY 共通

- SOUND ON/OFFが保存される
- REDUCED MOTIONが保存される
- TODAY / WEEK / ALL TIMEランキングが開く
- 同一キャラクターがランキングを複数枠占有しない
- Daily Challengeが表示される
- Dailyを再度開始しても同日のSeed/問題が変わらない
- FIRST PLAY実績が初回完了後に表示される
- Completed / Play Timeが更新される

## QUICK TAP

- START → WAIT → TAP
- 早押しでFLYINGになる
- 正常スコアが保存される
- Daily時も同一Delayになる
- 70ms未満など不正値がサーバーで拒否される

## STOP!

- TargetとMarkerが表示される
- STOP時の得点が保存される
- サーバー側再計算値と一致する
- Daily時は同一Target / Period / Phaseになる

## STACK

- DROPで積める
- はみ出した分だけ幅が狭くなる
- 完全に外すと終了する
- Score/Heightが保存される
- DROP履歴とSERVER再計算が一致した時だけ記録される

## BLOCK

- 3ピースが表示される
- 使用済みピースが消える
- 3個使用後に次の3個が生成される
- 行/列消去、Combo加点
- BACK → 再度開くと途中再開
- 操作直後にBACKしても最後のautosaveがrate limitで欠落しない
- 保存失敗時は画面を閉じず、理由を表示して再試行できる
- NEW GAMEで古い途中保存が消える
- END RUNでランキングへ保存
- 操作履歴を改変したスコアは `INVALID_BLOCK_REPLAY` で拒否される
- Dailyでは同じSeedから同じピース列になる

## MERGE

- 上下左右操作
- 同値タイルのみ1回ずつMerge
- 移動しなかった場合は新タイルが出ない
- BACK → 再開
- NEW GAMEで保存リセット
- END RUNで保存
- 操作履歴と得点が一致しない場合は `INVALID_MERGE_REPLAY`

## MINES

- Reveal / Flag切替
- 0周辺の連鎖Reveal
- Mineを踏むと終了
- BACK → 再開
- 正常Clearのみ記録
- Seedから再生成した盤面と一致しないClearは拒否
- Dailyは同じ盤面

## NONOGRAM

- 行/列Clue表示
- Cellを Filled → × → Empty と切替
- 間違った状態でCHECKしても記録されない
- 正解のみClear記録
- BACK → 再開
- Dailyは同じ問題

## MEMORY

- 4×4で16枚 / 8ペアが表示される
- 同じSeedでは同じカード配置になる
- 1枚目 → 2枚目の順でめくれる
- 不一致は短時間表示後に自動で伏せる
- 一致したペアは開いたまま残る
- 8ペア完成時のみ記録される
- 選択履歴を改変したクリアは `INVALID_MEMORY_REPLAY` で拒否される
- ランキングはクリア時間が短い順
- Dailyでは全員が同じカード配置になる
- 8手で全ペアを揃えると `PERFECT MEMORY` が解除される

## COLOR MATCH

- STARTで10問のランが始まる
- 表示される文字の意味ではなく、文字そのものの色を選ぶ
- 正解すると次の問題へ進む
- 不正解でそのランは終了し、スコアは保存されない
- 10問連続正解時だけクリアタイムが保存される
- 同じSeedでは同じ10問が生成される
- 回答履歴を改変した送信は `INVALID_COLOR_MATCH_REPLAY` で拒否される
- ランキングはクリア時間が短い順

## NUMBER RUSH

- START後に1〜25が5x5へランダム配置される
- 1→25の正しい順番だけ進行する
- 誤タップでMISSが増え、1回につき0.5秒ペナルティ
- クリア時に実時間＋ペナルティで記録される
- 同じSeedなら同じ配置になる
- Dailyでは全員が同じ配置になる
- タップ履歴を改変した送信は `INVALID_NUMBER_RUSH_REPLAY` で拒否される
- 3秒未満など成立しないクリア時間はSERVERで拒否される
- ノーミス12秒以内で `NUMBER ACE` 実績が解除される


## HIGH & LOW

- START後にA〜Kの現在値が表示される
- HIGH / LOWの2択で次の数字を予想できる
- 同じSeedなら同じ数列になる
- 同値が連続して判定不能にならない
- 正解で連勝数が増える
- 1回でも不正解ならそのRunが終了し、正解数だけ記録される
- 30連勝でRun完走になる
- 回答履歴を改変した送信は `INVALID_HIGH_LOW_REPLAY` で拒否される
- 10連勝で `HIGH ROLLER` 実績が解除される


## SIMON

- START後に4パネルの光る順番が再生される
- 1Round目は1手、以降1手ずつ長くなる
- 再生中は入力できず、自分の番だけ押せる
- 正しい順番を最後まで押すと次Roundへ進む
- 1回でも間違えるとRun終了
- 同じSeedなら同じ光る順番になる
- 到達Round数がランキングへ保存される
- 入力履歴を改変した送信は `INVALID_SIMON_REPLAY` で拒否される
- 30Round完走でALL CLEARになる


---

# 2. 複数人確認へ進む条件

以下が全て満たされたらPARTY実機確認へ進む。

- resource起動ログ = `startup preflight READY_FOR_LIVE_TEST`
- PLAY 12ゲームが1クライアントで起動
- PLAY save/resumeが動作
- Dailyが動作
- DBへscore/save/achievementが書き込まれる
- PARTYでCREATE ROOMまで開ける
- JavaScriptエラーなし
- SERVERコンソールにcallback errorなし

---

# 3. 2人で確認

対象:

- Room Create / Join
- Ready
- HostのGame Select / Start
- REACTION
- STOP! BATTLE
- DRAW
- Disconnect / Reconnect
- Host Migration

確認項目:

- AがRoomを作成し、Bが4桁Codeで参加
- A/B双方のplayer listが同じ
- Ready状態が双方へ同期
- 古い状態が新しいRoom状態を巻き戻さない
- 人数不足・未Ready時はHostの開始ボタンが理由付きで無効
- Host以外はGame Select/Start不可
- REACTIONのRevealが概ね同時
- STOP! BATTLEで同じTargetが表示
- DRAWでAの線がBへ反映
- Bが正解すると双方へ反映
- Hostが切断するとBへHostが即移行
- 最低人数を下回る切断が発生した場合、Roundが理由表示付きで安全終了
- WORD WOLF / LIARの役職本人が切断した場合、不公平な継続をせずRound終了
- 投票済みプレイヤーが切断した場合、その切断プレイヤーの票を集計へ残さない
- 元Hostが60秒以内に戻ると同Roomへ復帰
- 切断中の同一キャラクターが別Roomへ重複所属しない
- Phoneを閉じて開いてもRoomを自動復帰

---

# 4. 3人以上で確認

対象:

- VOTE
- MAJORITY
- WORD WOLF
- LIAR
- TELEPHONE

確認項目:

### VOTE
- 自分自身へ投票できない
- 全員投票後だけ結果表示
- 票数一致

### MAJORITY
- 全員同じ2択を表示
- 回答済み状態が同期
- 集計数一致

### WORD WOLF
- 各自には自分のお題だけ見える
- 他人のお題がNUIへ漏れていない
- 少数派は1人
- 投票完了後に初めて両方のお題を公開

### LIAR
- 各自には自分のRoleだけ見える
- LIARは1人
- 投票完了後にRoleを公開

### TELEPHONE
- 1人ずつ順番に入力
- Draw担当には直前Textのみ表示
- Text担当には直前Drawingのみ表示
- 他プレイヤーには秘密内容を表示しない
- 途中の担当者が切断した場合は次の接続中プレイヤーへ進む
- 最後にChain全体が順番通り公開される

---

# 5. 最終負荷・例外確認

- Room満員
- 存在しないRoom Code
- Round中のJoin
- 同時Ready
- 同時投票
- 同時DRAW更新
- 連続でゲーム変更
- 連続でRound開始
- 60秒以上切断
- resource restart
- SERVER restart
- Daily日付切替

Roomは一時データのため、resource/SERVER restartで消えてよい。PLAYのscore/save/achievement/statisticsはDBへ残ること。

## 合格ライン

2人・3人テストで重大な同期崩れ、秘密情報漏洩、DB破損、重複Score、Room復帰不能が無ければ提出候補とする。
