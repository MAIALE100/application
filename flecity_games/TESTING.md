# Flecity Games Test Plan

この手順は、1人で確認できる範囲を先に完了し、その後に2〜3人でPARTY同期を確認するためのテスト手順です。

## 0. 起動前・更新

現在のテストPCでは、確実性を優先して以下の同期手順を使う。SERVER全体の再起動は不要。

```cmd
cd /d D:\FiveM_Dev\application
git pull --ff-only origin games/party-dev
robocopy "D:\FiveM_Dev\application\flecity_games" "D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\flecity_games" /MIR /R:2 /W:1 /XF dev-auto-reload.enabled dev-reload.token dev-build.txt
powershell.exe -NoProfile -Command "Set-Content -Path 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\flecity_games\dev-auto-reload.enabled' -Value '1' -NoNewline -Encoding ascii; Set-Content -Path 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\flecity_games\dev-reload.token' -Value ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()) -NoNewline -Encoding ascii"
```

dev auto-reload watcherが有効なら、差分反映後に `flecity_games` だけが再読込される。反応しない場合のみSERVERコンソールで `restart flecity_games` を1回実行する。

`games-update.cmd` は開発補助として残しているが、このテストPCでは環境依存チェックに失敗した実績があるため、完成候補の検証では上記の明示的同期を基準にする。

resource起動時にDB作成とnon-player preflightが自動実行され、正常ならSERVERログへ `[FlecityGames] startup preflight READY_FOR_LIVE_TEST` と表示される。

`game_preflight` / `game_selftest` / `game_healthcheck` / `game_status` は問題発生時の追加診断用。通常更新ごとに手動実行する必要はない。

前提:

- `oxmysql` / `lb-phone` が起動済み
- 実SERVERのFramework Adapterが一致している
- `ensure flecity_games` がserver.cfgに存在する
- Flecity GamesのDBテーブルはresource起動時に自動作成される
- 手動SQLは通常不要

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

- SOUND / REDUCED MOTIONが保存される
- TODAY / WEEK / ALL TIMEランキングが開く
- 選択期間に対応した「あなたのBEST」と順位が表示される
- 同点は同順位として表示される
- 上位表示外でも自分の順位行が表示される
- 同一キャラクターがランキングを複数枠占有しない
- ゲームカードへ自分のBESTが表示される
- ゲーム別記録へPlay Count / Play Time / BESTが表示される
- Daily Challenge、自分のDaily BEST、上位ランキングが表示される
- Dailyを再度開始しても同日のSeed/問題が変わらない
- NEW BEST / 実績解除が共通フィードバックで分かる
- 実績14個がLOCK / ✓で一覧表示され、解除数 / 総数が表示される
- 連打しても同じゲームが二重Session起動しない
- 一時的な開始通信失敗は自動再試行される
- 開始応答だけ失われても同じ開始要求として再送され、Sessionが二重生成されない
- PLAYを開き直した時に前画面の孤立Session / 開始キャッシュが残らない
- 最終スコア送信は同じSession Tokenで安全に再送でき、二重Scoreにならない
- 最終送信中にBACK / Phone CloseしてもSessionを先に破棄しない
- Phoneを閉じると非再開ゲームはSession / Timerが安全停止する
- Phoneを完全に閉じて3.5秒以上待った後、`game_healthcheck` の `play_sessions=0` / `pending_starts=0` を確認
- Session開始通信の途中でPhoneを閉じても、遅れて返ったSessionが残らない
- 判定通信 / 最終Score保存中にPhoneを閉じても古い画面状態へ書き戻さない
- Phoneを閉じるとBLOCK / MERGE / MINES / NONOGRAMは通常プレイを保存してSessionを閉じる
- Phone再表示までのバックグラウンド時間がスコアへ加算されない
- 「新しく始める」は本当に進行中保存を消す場合だけ確認を出す
- 非再開ゲームの進行中にBACK / NEWを押すと破棄確認が出る
- 各ゲーム画面にルールの短い説明と自己BESTが表示される
- キーボード / コントローラー操作時にフォーカス位置が見える
- Reset直前の古いautosaveが後から保存を復活させない
- Completed / Play Time / AchievementがDBへ反映される

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
- 盤面を開いただけではタイマーが進まず、最初の操作から計測開始
- 通常プレイの最初のRevealは必ず安全マス
- Dailyは全員同一盤面を優先し、個別の初手安全化をしない
- 0周辺の連鎖Reveal
- Mineを踏むと終了し、古い途中保存が復活しない
- BACK / Phone Close → 再開
- 再開後も最初の操作までタイマーが止まる
- avoidIndexを含む途中保存から同じ盤面を再生成
- 正常Clearのみ記録
- 盤面と一致しないClearはSERVERで拒否
- 60秒以内Clearで MINES SPRINTER 実績

## NONOGRAM

- 5×5の一意解確認済み問題セットからSeedで問題選択
- 行/列Clue表示
- Cellを Filled → × → Empty と切替
- 盤面を開いただけではタイマーが進まず、最初の操作から計測開始
- 間違った状態でCHECKしても記録されない
- 正解のみClear記録
- BACK / Phone Close → 再開
- 再開後も最初の操作までタイマーが止まる
- Dailyは同じSeedから同じ問題
- 60秒以内Clearで LOGIC SOLVER 実績

## MEMORY

- 4×4 / 8ペア
- 同じSeedでは同じカード配置
- 1.2秒Preview中はランキングタイマーへ加算しない
- Preview終了後から実プレイ時間を計測
- 不一致は短時間表示後に自動で伏せる
- 8ペア完成時のみ記録
- 改変履歴は `INVALID_MEMORY_REPLAY`
- ランキングはクリア時間が短い順
- Dailyでは全員同じ配置
- 8手クリアで PERFECT MEMORY

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

- START後にA〜Kの現在値だけClientへ表示
- 未来の数列Seed / 配列をClientへ送らない
- HIGH / LOWを1手ずつSERVER判定
- SERVERが正誤、次の数字、連勝数を保持
- 1回でも不正解ならRun終了
- 30連勝でRun完走
- step番号付きで、応答だけ失われても同じstepを安全再送
- 提出スコア改変は `INVALID_HIGH_LOW_REPLAY`
- 10連勝で HIGH ROLLER

## SIMON

- START時にClientへ渡すのは1Round目の配列だけ
- 1Round目は1手、以降1手ずつ長くなる
- 再生中は入力不可
- Round入力をSERVERへ送り正誤判定
- 正解Roundの後だけ次Round配列をSERVERが返す
- 未来Roundの配列 / SeedをClientへ渡さない
- Dailyでは同じ日付の参加者に同じSERVER生成Sequenceが使われる
- Daily画面では `TODAY BEST` が表示され、結果もDailyランキングへ保存される
- DailyのNEW GAMEでも通常プレイへ切り替わらずDaily条件を維持する
- 1回でも間違えるとRun終了
- round番号付きで、応答だけ失われても同じRoundを安全再送
- SERVER保持の到達Round数だけランキング保存
- 提出スコア改変は `INVALID_SIMON_REPLAY`
- 15Round到達で SIMON MASTER
- 30Round完走でALL CLEAR

# 2. 複数人確認へ進む条件

以下が全て満たされたらPARTY実機確認へ進む。

- resource起動ログ = `startup preflight READY_FOR_LIVE_TEST`
- PLAY 15ゲームが1クライアントで起動
- PLAY save/resumeが動作
- Dailyが動作
- DBへscore/save/achievementが書き込まれる
- PARTYでCREATE ROOMまで開ける
- JavaScriptエラーなし
- SERVERコンソールにcallback errorなし

---

## PARTYライブ診断

複数人テスト中は、txAdminのサーバーコンソールで以下を実行すると、秘密情報を出さずにRoom状態を確認できる。

`game_party_status`

表示内容:
- Room Code
- lobby / round
- 選択中または進行中Game
- Round番号 / complete
- Host名
- connected / total
- Ready人数
- PARTYアプリを開いている接続者数
- disconnected人数
- 現在Roundの残り秒数

WORD WOLF / LIARのお題・役職、DRAWのお題、TELEPHONEのchain途中内容は出力しない。

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
- PARTYを閉じた参加者は一覧で「アプリ閉じています」と表示
- Hostの開始ボタンは閉じた参加者がいる場合「アプリ待ち N人」と理由表示
- REACTION / STOP / VOTE / MAJORITY / MINORITY / WORD WOLF / LIAR は回答後に「入力済み人数 / 対象人数」が更新される
- 回答内容そのものは他プレイヤーへ漏れず、共有されるのは件数だけ
- 古い状態が新しいRoom状態を巻き戻さない
- 人数不足・未Ready時はHostの開始ボタンが理由付きで無効
- Host以外はGame Select/Start不可
- REACTIONのRevealが概ね同時
- REACTION結果の先頭にWINNER名と反応時間が表示される
- STOP! BATTLEで同じTargetが表示
- STOP! BATTLE結果の先頭にWINNER名とscoreが表示される
- REACTION / STOP! BATTLE は9〜10人でも開始できる
- DRAWで短いstrokeを連続して描いても約1秒ごとのcallback制限に阻害されずBへ反映
- DRAW/TELEPHONEで移動せず1回タップした点もdotとして残る
- 日本語IMEの変換確定EnterではDRAW回答/TELEPHONE文章が勝手に送信されず、確定後のEnterで送信される
- DRAWでAの線がBへ反映
- Bが正解すると双方へ反映
- 正解済みプレイヤーが途中切断しても「正解 n/接続中対象人数」が分母超過しない
- DRAW結果では最初の正解者がFASTESTとして明示され、正解者0人なら「正解者なし」と表示
- Hostが切断するとBへHostが即移行
- HostがPARTYアプリ/Phoneを閉じた場合も、PARTYを開いている他参加者を優先してHost権限が移りRoomが操作不能にならない
- HostがPARTYを閉じた時点で他参加者が切断中でも、その参加者が再接続してPARTYを開けばGetRoom復帰直後に閉じたHostから権限が移る
- FiveMには接続中でもPARTYを閉じている参加者がいる場合、その人を飛ばしてアプリを開いている参加者へHostが移る
- 元Hostがアプリを開き直した場合は同Roomへ参加者として復帰できる
- 最低人数を下回る切断が発生した場合、Roundが理由表示付きで安全終了
- WORD WOLF / LIARの役職本人が切断した場合、不公平な継続をせずRound終了
- 投票済みプレイヤーが切断した場合、その切断プレイヤーの票を集計へ残さない
- 切断者が60秒以内に戻ると同Roomへ復帰
- 満員Roomで1人が切断しても、60秒の再接続猶予中は新規参加者がその枠を奪えない
- 60秒猶予経過後は切断枠がcleanupされ、新規参加できる
- 切断中の同一キャラクターが別Roomへ重複所属しない
- Phoneを閉じて開いてもRoomを自動復帰
- 「退出」は1回押しただけでは退出せず、2.5秒以内の2回目で確定
- 退出確認中にPhone/Appを閉じると確認状態が解除される
- Phone/App close直前に開始したpartyGetRoom/config/settings応答がclose後に返っても閉じたUIへ状態を書き戻さない

---

# 4. 3人以上で確認

対象:

- VOTE
- MAJORITY
- MINORITY
- TIC-TAC
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

### MINORITY

- 全員がA/Bどちらかを選べる
- 人数が少ない選択肢が勝ちになる
- 全員が同じ選択肢なら「少数派なし」になる
- 同数なら勝者なしになる
- 切断者を集計へ含めない

### TIC-TAC

- 2人の時だけ開始できる
- X/Oが別々に割り当てられる
- 自分の番だけ空きマスを押せる
- 使用済みマスへ置けない
- 縦・横・斜め3つ揃いで勝者表示
- 9マス埋まって揃わなければ引き分け
- 途中切断時はRoundを安全終了

### WORD WOLF
- 各自には自分のお題だけ見える
- 他人のお題がNUIへ漏れていない
- 少数派は1人
- 会話タイム中は投票ボタンが無効
- callbackを直接送っても会話タイム中はVOTING_LOCKED
- 投票完了後に初めて両方のお題を公開

### LIAR
- 各自には自分のRoleだけ見える
- LIARは1人
- 会話タイム中は投票できない
- 投票完了後にRoleを公開

### TELEPHONE
- 1人ずつ順番に入力
- Draw担当には直前Textのみ表示
- Text担当には直前Drawingのみ表示
- 他プレイヤーには秘密内容を表示しない
- 途中の担当者が切断した場合は次の接続中プレイヤーへ進み、次担当には新しい30秒/45秒が丸ごと付与される
- 入力済みプレイヤーが退出しても、最終Chain上の投稿者名は退出前の名前で残る
- DRAW手番は45秒、TEXT手番は30秒の残り時間が表示される
- 各手番が制限時間を超えた場合もその担当だけskipして次へ進む
- 最後にChain全体が順番通り公開される

---

# 5. 最終負荷・例外確認

- Room満員
- 満員Roomの60秒再接続猶予
- 存在しないRoom Code
- Round中のJoin（既存メンバーや切断枠を変更しない）
- 同時Ready
- 同時投票
- 同時DRAW更新
- 連続でゲーム変更
- 連続でRound開始
- 結果確定前にHostがReturnLobby callbackを直接送ってもRoundを中断できない
- 結果確定後のReturnLobby二重送信で新しいReady状態を消さない
- PARTYの時間切れは表示0秒から概ね1〜2秒以内に結果確定/次手番へ遷移する
- 60秒以上切断
- resource restart
- SERVER restart
- Daily日付切替

Roomは一時データのため、resource/SERVER restartで消えてよい。PLAYのscore/save/achievement/statisticsはDBへ残ること。

## 合格ライン

2人・3人テストで重大な同期崩れ、秘密情報漏洩、DB破損、重複Score、Room復帰不能が無ければ提出候補とする。

## Daily COLOR MATCH 0.34

- TODAY'S CHALLENGEがCOLOR MATCHの日は全員同じ10問になる
- Daily開始前からゲーム画面のBEST表示がTODAY BESTになる
- 不正解RunはDailyランキングへ保存されない
- 10問連続正解時のみDailyスコアとして保存される
- 同じ日付で再挑戦しても問題順・文字色が変わらない
- 「もう一度」から再挑戦しても通常COLOR MATCHへ切り替わらない
- 結果表示にデイリー表記が付き、TODAY BEST / Dailyランキングへ反映される
- 通常COLOR MATCHの全期間BESTとDaily BESTが混在しない

## FALL Long Run 0.33

- 通常DROPはサーバー保存完了待ちで操作不能にならない
- 3ピースごと、またはライン消去時にバックグラウンド保存される
- バックグラウンド保存応答が遅れても、新しい盤面を古い状態で巻き戻さない
- BACK / Phone Close時は待機中の保存を消化してから最終状態を保存する
- 数千手相当の履歴でも配列形式のコンパクト保存を使う
- NEXT生成は毎回Seed先頭から再計算せず、RNG状態を引き継ぐ
- 再開後もCURRENT / NEXTのブロック順が保存前と一致する

## FALL MASTER 0.32

- NEXTに現在ブロックの次に出るブロックが表示される
- NEXT表示は同じSeed / 同じ操作履歴なら必ず同じになる
- 20ライン以上消して記録を確定すると `FALL MASTER` が解除される
- 19ライン以下では解除されない
- GAME OVER自動記録でも「終了して記録」でも20ライン条件を満たせば解除される
- 同じ実績を再度条件達成しても重複登録されない
- 実績一覧が16個表示になる

## FALL 0.31

- 新規開始で10×18の盤面と7種ブロックのいずれかが表示される
- ← / → でハードドロップ位置を変更できる
- 回転でブロック形状が変わり、壁際では安全な横補正が入る
- ゴースト表示が実際のDROP位置と一致する
- DROPするとサーバーと同じ得点式でスコアが増える
- 1〜4ライン消しが正しく反映される
- 連続ライン消しでCOMBOが増え、ラインを消さないDROPでCOMBOが0へ戻る
- BACK / Phone Closeで途中保存される
- 再開後に盤面・スコア・ライン数・手数・次ブロックが一致する
- NEW GAMEで古い途中保存が削除される
- 「終了して記録」で途中でも現在スコアをランキングへ確定できる
- 次ブロックを置ける場所が無い場合はGAME OVERとなり自動で記録する
- 操作履歴改変は `INVALID_FALL_REPLAY` で拒否される
- 不正途中保存は `INVALID_FALL_SAVE` で拒否される
- お気に入り / RECENT / エンドレス絞り込み / おまかせにFALLが含まれる
- 結果保存後に途中保存が削除され、BESTと統計が更新される

## SLIDE MASTER 0.30

- SLIDEを90秒以内・120手以内でクリアすると `SLIDE MASTER` が解除される
- 条件を片方でも超えた場合は解除されない
- 通常SLIDE / Daily SLIDEのどちらでも条件を満たせば解除できる
- 同じ実績を再度条件達成しても重複登録されない
- 実績一覧が15個表示になる

## Daily SLIDE 0.29

- TODAY'S CHALLENGEがSLIDEの日は同じ日付で全員同じ盤面になる
- Daily SLIDEでは途中保存を作らない
- Daily SLIDEのBACK / Phone CloseでSessionだけ安全に終了する
- Daily SLIDEの「新しく始める」は通常SLIDEへ切り替わらず、同じDaily盤面を再開始する
- クリア後はTODAY BESTとDailyランキングへ反映される
- 通常SLIDEの途中保存が存在していてもDaily SLIDE開始・終了で壊れない

## SLIDE 0.28

- 新規開始で4×4 / 1〜15＋空きマスの盤面が表示される
- 空きマスに隣接する数字だけ押せる
- 数字を押すと空きマスへ1マス移動する
- BACK / Phone Closeで途中保存される
- 再開後に盤面・手数・経過時間が継続する
- NEW GAMEで古い途中保存が削除される
- 1〜15が正しい順番へ揃った時だけクリアになる
- 操作履歴を改変した送信は `INVALID_SLIDE_REPLAY` で拒否される
- 不正な途中保存は `INVALID_SLIDE_SAVE` で拒否される
- ランキング値は実時間＋1手あたり0.2秒ペナルティ
- クリア後は途中保存が消え、BEST / RECENT / 統計が更新される
- SLIDEをお気に入り登録・カテゴリ絞り込み・おまかせ対象にできる

## PLAY Favorites 0.27

- 各ゲームカードの ☆ を押すと ★ へ変わる
- ★ を押し直すとお気に入りから外れる
- お気に入りは最大8本まで
- 「★ お気に入り」フィルタには登録したゲームだけ表示される
- PLAYを閉じて開き直してもお気に入りが残る
- resource restart後もお気に入りが残る
- PARTYでサウンド / 動きを抑える設定を変更してもPLAYのお気に入りが消えない
- PLAYでサウンド / 動きを抑える設定を変更してもお気に入りが消えない
- お気に入り保存通信に失敗した場合、UIは保存前の状態へ戻る
- お気に入りフィルタ中に★を外したゲームは一覧から安全に消える

## PLAY Home Navigation 0.26

- 1本以上記録がある場合、RECENTに最近遊んだゲームが最大3本表示される
- RECENTは古い順ではなく直近プレイ順になる
- RECENTからゲームを直接起動できる
- すべて / クイック / アーケード / エンドレス / パズル のフィルタが切り替わる
- フィルタ中の件数表示が `表示件数/全件数` になる
- おまかせは現在のフィルタ内からのみゲームを選ぶ
- フィルタ変更でCONTINUEやRECENTの内容が消えない
- スコア保存後にホームへ戻るとRECENT順が更新される
- 画面幅が狭い場合もフィルタが横スクロールし、カード操作を妨げない

## PLAY Sharp UI / Icon pass 0.25

- PLAYを開いた直後、文字が以前よりシャープに表示される
- PLAY / PARTYのカスタムアプリが `fixBlur=true` で正常表示される
- 画面サイズを変えてもレイアウトが極端に拡大・縮小しない
- QUICK TAP / STOP! / TOWER / BLOCK / MERGE / MINES / NONOGRAM / MEMORY / SORT / COLOR MATCH / NUMBER RUSH / RANGE RUSH / SIMON の専用SVGアイコンが表示される
- CONTINUEカードにも各ゲームの専用アイコンが表示される
- TODAY'S CHALLENGE に対象ゲームのアイコンが表示される
- 小さい説明文・BEST・NEXT RANKが背景へ埋もれず読める
- アイコン読み込み失敗時も文字シンボルへフォールバックし、カード操作が壊れない
- NUIコンソールにSVG/CSSの404やJavaScriptエラーがない

## PLAY Visual Quality
- Home library: all 13 game cards have distinct visual identities and remain legible at phone width.
- QUICK TAP: WAIT / GO / false-start / result states are visually distinct.
- STOP!: running target and result state are visually distinct.
- BLOCK: placement and line-clear feedback does not change score/replay validation.
- MERGE: merged tile levels are visually distinct through 2048 and swipe still works.
- MINES: revealed numbers/flags/mines remain readable and resume state is unchanged.
- NONOGRAM: fill / cross / blank remain distinct after resume.
- MEMORY: reveal/match animation never delays or changes pair validation.
- NUMBER RUSH: correct/miss feedback keeps all 25 targets tappable.
- HIGH & LOW: card transition does not re-enable locked controls after game over.
- SIMON: WATCH / INPUT / GAME OVER remain visually distinct.
- Reduced-motion setting suppresses decorative animations.

## RANGE RUSH / MERGE 0.20
- RANGE RUSH: number and pivot are visible; LOW/HIGH labels match the pivot.
- RANGE RUSH: timer counts down each round and timeout ends the run.
- RANGE RUSH: a fast correct answer increases both score and streak; mistake ends the run.
- RANGE RUSH: final saved score matches the server-returned score and ranking BEST.
- RANGE RUSH: closing the phone during a run leaves no play session after lifecycle cleanup.
- MERGE: a merge-producing move increments CHAIN; a moved-but-no-merge move resets CHAIN to zero.
- MERGE: points awarded for a merge are multiplied by the current CHAIN (capped at x5).
- MERGE: save/resume restores canonical board, score, moves and CHAIN from server replay.
- MERGE: old version-1 saves are not loaded into version-2 scoring rules.
- MERGE: new tile milestones and fever presentation do not alter canonical board replay.

## TOWER v2
- TOWER starts with a centered base and displays points, HEIGHT, PERFECT streak and remaining width.
- A near-perfect placement preserves width and increases PERFECT streak.
- A non-perfect placement resets PERFECT streak and trims width to the true overlap.
- Movement alternates direction and accelerates after each successful layer.
- Missing the base ends the run and the server-replayed point total matches the client result.
- Ranking uses points while the result metadata still reports HEIGHT and max PERFECT streak.
- TOWER MASTER remains based on reaching 25 layers, not on arbitrary client score.

## RANGE RUSH v3
- Start with 3 lives and confirm a wrong answer removes exactly one life without ending the run while lives remain.
- Confirm a correct answer after a miss continues to the next round and rebuilds STREAK from 1.
- Confirm rounds 1-5 use the longest timer and later five-round stages shorten the response window.
- Reach STREAK 5+ and confirm the multiplier increases; continue to verify x3/x4 tiers at higher streaks.
- Confirm timeout behaves like a miss, consumes one life, and continues while lives remain.
- Confirm the run ends only when lives reach 0 or round 30 completes.
- Complete/lose a run and verify the server-confirmed score, MAX STREAK, remaining LIFE and ranking are saved.

## SORT live verification
- Start SORT and confirm 16 tiles appear across four filled tubes with two empty tubes.
- Select a non-empty source tube, then an available destination; exactly one top tile must move.
- Fill a destination to capacity and confirm a fifth tile cannot be moved into it.
- Return to PLAY after several moves and confirm CONTINUE → SORT appears.
- Resume and verify tube contents, move count, elapsed time and move history are preserved.
- Close the phone mid-run, reopen PLAY, and verify the same saved SORT state is available.
- Complete all four monochrome tubes and confirm the server accepts the replay and records ranking score = elapsed time + 350ms × moves.
- Run game_selftest and confirm sortSeedCounts, sortReplayMove, and sortValidateTime all PASS.


## PARTY+ live verification (2026-10-23)

運営確認済み本番前提:
- QBox 2.5.4
- oxmysql
- citizenid = CSN
- 独立resource形式のLB Phone追加提出は継続可能

PARTY+課金:
- bank残高が50,000以上のCSNで加入ボタンを1回押しても課金されず、2.5秒以内の2回目でだけ確定する
- 初回加入でbankから50,000だけ減り、`flecity_game_subscriptions`へ約7日後のactive_untilが保存される
- 加入操作を連打/二重送信しても二重引落しされない
- 有効期限内に再度subscribeしても追加50,000を引かない
- 自動更新を停止してもactive_untilまではPARTY+が有効
- 自動更新ONの期限切れ状態で次回PARTY利用時、50,000を1回だけ引き新しい7日を開始する
- 期限切れ時に残高不足ならPARTY+は有効化せず、自動更新OFFになり再試行課金ループを起こさない
- resource restart / reconnect後も同一CSNの期限・自動更新状態が維持される
- 未加入者がHostの場合はPARTY+ game select/startをserver側で拒否する
- 加入者がHostなら未加入者9人を含む最大10人RoomでもPARTY+ゲームを開始できる
- PARTY+ Round進行中にHostが離脱して非加入Hostへ移行しても進行中Roundを破壊しない
- 課金成功event `flecity_games:server:partyPlusCharged` が1決済につき1回だけ発火する
- 現仕様は50,000を経済sinkとして減算。会社口座への売上振替が必要な場合は本番前に運営仕様を確定する

PARTY+ NG WORD (3〜10人):
- 説明役だけにお題と3つのNGワードが表示され、他端末snapshotへ漏れない
- お題そのもの/NGワードを含むヒントはserver側で拒否する
- 正常ヒント送信後のみ全員が回答フェーズへ進む
- 説明役は回答不可、回答者は自分の入力だけ送信できる
- 最速正解者・お題・NGワードはRound完了後に全員へ公開される
- 説明役切断で安全終了、最後の未回答者切断時は残存参加者だけで即確定する
- 80題から直前と同じ題を避けて出題する

PARTY+ FAKE ANSWER (3〜10人):
- 全員同じ問題を受け、1人1つの偽回答を送れる
- 正解と同一/他人と同一の偽回答をそのまま採用しない
- 投票フェーズでは正解・作者情報が表示されない
- 自分の偽回答には投票できない
- 正解投票=2pt、他人を自分の偽回答へ誘導=1pt/票で集計される
- timeout時は内蔵デコイを含めて安全に投票へ進む/結果確定する
- 切断が最後の未提出者/未投票者になった場合は残存参加者だけで即進行する
- 84問の問題バンクから出題される

PARTY+ BOMB (3〜10人):
- 全員に同じお題を表示し、現在の保持者だけ「答えた！次へ」を押せる
- 爆発予定時刻はNUI snapshotへ含めずserverだけが保持する
- Passごとに次の接続中playerへ移り、手番10秒を新しく付与する
- 隠しFuse到達時はその時点の保持者がBOOMになる
- 手番10秒超過も保持者の負けとしてRoundを終了する
- 保持者切断時は人数条件を満たす限り次の接続中playerへ移る
- 120カテゴリのお題が幅広く出る

PARTY+ MEMORY CHAIN (2〜10人):
- memorizeフェーズだけ正解記号列を表示する
- inputフェーズへ入ると正解列がsnapshotから消える
- 4記号のボタンだけで指定長まで入力でき、やり直しもできる
- 全員提出後に正誤をserver判定し、誤答者を脱落させる
- input timeout時は未入力者を脱落扱いにする
- 生存1人以下で勝者確定、全員正解が続く場合は最大8stageで終了する
- 他player submit pushで自分の入力途中状態が消えない
- disconnect後も残存生存者だけで停止せず進行する

PARTY+ prompt-bank static target:
- NG WORD >= 80
- FAKE ANSWER >= 80（現在84）
- BOMB >= 120
- MEMORY CHAINはserver生成
