# Flecity Games Test Plan

この手順は、1人で確認できる範囲を先に完了し、その後に2〜3人でPARTY同期を確認するためのテスト手順です。

## 0. 起動前

- `oxmysql` が起動済み
- 実サーバーのFramework Adapterが一致している
- `lb-phone` が起動済み
- `ensure flecity_games` を追加
- Flecity GamesのDBテーブルはresource起動時に自動作成される
- 手動SQLは通常不要。権限不足時の予備として `sql/001_initial.sql` を残す

SERVERコンソール:

```text
ensure flecity_games
game_preflight
game_selftest
game_healthcheck
```

`game_preflight` の最終行が `READY_FOR_LIVE_TEST` になること。

プレイヤーとしてSERVERへ入った状態でも `game_preflight` を実行し、character identifier と profile settings read がPASSすること。

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

## BLOCK

- 3ピースが表示される
- 使用済みピースが消える
- 3個使用後に次の3個が生成される
- 行/列消去、Combo加点
- BACK → 再度開くと途中再開
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

---

# 2. 複数人確認へ進む条件

以下が全て満たされたらPARTY実機確認へ進む。

- `game_preflight` = `READY_FOR_LIVE_TEST`
- PLAY 7ゲームが1クライアントで起動
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
- Host以外はGame Select/Start不可
- REACTIONのRevealが概ね同時
- STOP! BATTLEで同じTargetが表示
- DRAWでAの線がBへ反映
- Bが正解すると双方へ反映
- Hostが切断するとBへHostが即移行
- 元Hostが60秒以内に戻ると同Roomへ復帰
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
