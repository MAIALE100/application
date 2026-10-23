# Flecity Games PARTY 開発引継ぎ

## 目的
LB Phone 向けの複数人用ミニゲームアプリ「PARTY」を、既存の `flecity_games` リソースを土台に完成させる。

## 開発元
- Repository: `MAIALE100/application`
- Branch: `games/party-dev`
- Resource: `flecity_games`
- Framework: QBox 2.5.4（運営確認済み）
- DB adapter: oxmysql（運営確認済み）
- Player identifier: citizenid = CSN（運営確認済み）
- Phone: LB Phone 2.9.0
- 独立resourceとして今後も追加LB Phoneアプリを提出可能（運営確認済み）
- テストサーバー側の既存作業パス: `D:\FiveM_Dev\application`

## 絶対に守ること
- 完成済みの一人用アプリ LOOP v1.0.0 を壊さない。
- LOOP の内部 identifier `flecity_play`、DB互換、score/save/achievement を不要に変更しない。
- PARTY の開発はこのブランチで進める。
- 手動作業とサーバー全体再起動を極力減らす。
- 通常は `restart flecity_games` で確認する。
- 安全に自動化できる修正は逐一確認せず進めてよい。
- GitHub を正本とし、ローカルだけに重要変更を残さない。
- 完了条件は「動く」だけでなく、スマホUI・テンポ・再戦性・切断耐性・連打耐性・長時間利用まで確認すること。

## LOOP の現在地
LOOP は完成扱い。
- 表示名: LOOP
- identifier: `flecity_play`
- LB Phone App Store 配布
- `defaultApp=false`
- `game=true`
- `price=0`
- 提出版 v1.0.0 作成済み
- PARTY は LOOP の提出ZIPでは無効化・UI除外

PARTY開発中に LOOP の提出仕様を巻き戻さないこと。

## PARTY の現在地
設定:
- identifier: `flecity_party`
- 表示名: PARTY
- `enabled=true`
- LB Phone App Store無料配布
- `defaultApp=false`
- `game=true`
- `price=0`
- PARTY v1.0.0 提出ZIP自動生成済み
- production resource version: 1.1.0（提出ZIP内でpatch）

無料ゲーム（既存10種）:
1. REACTION — 2〜10人
2. STOP! BATTLE — 2〜10人
3. VOTE — 3〜10人
4. MAJORITY — 3〜10人
5. MINORITY — 3〜10人
6. TIC-TAC — 2人
7. WORD WOLF — 3〜10人
8. LIAR — 3〜10人
9. DRAW — 2〜10人
10. TELEPHONE — 3〜10人

PARTY+（7日 / 50,000、加入HostのRoom全員が利用可）:
11. NG WORD — 3〜10人
12. FAKE ANSWER — 3〜10人
13. BOMB — 3〜10人
14. MEMORY CHAIN — 2〜10人

PARTY+は限定品・シーズン・月替わり更新を前提にしない恒常プラン。
出題バンクはNG WORD 80題 / FAKE ANSWER 84問 / BOMB 120題を同梱し、MEMORY CHAINはserver生成のため固定問題追加を不要とする。
課金はcitizenid（CSN）単位で保持し、銀行から50,000を減算。7日経過後は次回利用時に自動更新を試行する。
自動更新停止後も期限までは利用できる。加入購入は誤タップ防止の2段確認。
現時点の50,000は経済sink。会社口座等への売上振替が必要な場合は、成功時event `flecity_games:server:partyPlusCharged` へ運営環境の口座処理を接続する。

既存サーバー機能:
- CreateRoom / JoinRoom / GetRoom
- SetReady / SelectGame / StartRound
- 各ゲームのSubmit処理
- DRAWのstroke同期・clear
- TELEPHONEのdrawing/text送信
- ReturnLobby / LeaveRoom
- disconnect cleanup / room cleanup
- DebugSelftest / DebugCounts / DebugRoomSummaries
- server console: `game_party_status`

既存UI:
- 4桁ルームコード
- 作成 / 参加
- プレイヤー一覧
- Ready
- ゲーム選択
- ゲーム開始
- 各ゲーム用panel
- server pushによるroom更新、drawing同期

## 主なファイル
- `flecity_games/config/shared.lua`
- `flecity_games/shared/game_registry.lua`
- `flecity_games/client/main.lua`
- `flecity_games/server/core/party.lua`
- `flecity_games/server/core/party_plus.lua`
- `flecity_games/server/data/party_plus_prompts.lua`
- `flecity_games/web/party/index.html`
- `flecity_games/web/party/app.js`
- `flecity_games/web/party/icon.svg`
- `flecity_games/web/shared/app.css`
- `flecity_games/tools/static_check.py`

## 開発優先順位
完了済み:
1. コード総合監査。
2. Room作成→参加→Ready→開始→結果→再戦→Lobby復帰の共通基盤安定化。
3. Host離脱 / App close / participant離脱 / reconnect / 二重送信 / 同時操作 / 人数不足対策。
4. server-authoritativeなround token / timeout / submit検証 / secret snapshot。
5. 無料10ゲーム＋PARTY+ 5ゲームの主要なテンポ・結果演出・繰り返し対策。
6. LB Phone小画面向けUI・7〜10人表示・誤タップ防止。
7. 正式名称 PARTY / icon / App Store無料配布仕様の確定。
8. static check / JS syntax / Lua syntax / CI。
9. PARTY v1.0.0提出ZIPと運営向け導入資料。

残タスク:
1. 実際のFiveM複数クライアントで2人 / 3人以上 / 9〜10人のライブ確認。
2. `game_party_status` と各端末表示を照合し、実機固有の同期・LB Phone挙動を確認。
3. 実機で見つかった問題のみ修正し、最終CIを通して提出版を確定。

## 最初に重点確認する不具合
- ルームコード重複
- ホスト権限の不整合
- Ready状態の取り残し
- 前ゲームのtimer/eventが次ゲームへ残る
- 二重StartRound
- submit二重送信
- プレイヤー退出後のghost player
- reconnect時のroom復元
- DRAW strokeの肥大化
- TELEPHONE途中離脱時のchain破損
- voice系ゲームで秘密情報が他プレイヤーへ漏れる
- 終了済みroundへの遅延submit
- phone close / app close後の不要イベント残留

## 現在のテストサーバー反映方法
- 正本branch: `games/party-dev`
- 通常の反映: `games-update.cmd`
- updater / manual updater / auto updater はすべて `games/party-dev` を参照するよう更新済み。
- verified buildのみ展開し、原則としてサーバー全体再起動は不要。
- reload helperが有効なら `flecity_games` のみ自動反映。
- ライブ診断: txAdmin consoleで `game_party_status`

更新方法: `games-update.cmd`

## 別PCからの開発
重要データはGitHubに置く。ChatGPTが別PCのローカルディスクを直接読む前提にしない。

同じChatGPTアカウントでGitHub接続が有効なら、別PCの新しい会話からも `MAIALE100/application` の `games/party-dev` を読んで直接開発できる。

ローカルで実機確認する場合のみ、そのPCへbranchをclone/pullする。

### 初回clone例
```powershell
git clone --branch games/party-dev https://github.com/MAIALE100/application.git D:\FiveM_Dev\application
```

### 既にclone済み
```powershell
cd D:\FiveM_Dev\application
git fetch origin
git checkout games/party-dev
git pull --ff-only origin games/party-dev
```

## 新しいChatGPT会話での開始指示
このファイルを読んだ上で、`games/party-dev` を正本として作業する。
まず現状のPARTY実装を監査し、壊れている箇所・未完成箇所・ゲームとして弱い箇所を洗い出す。
安全に直せるものはそのまま実装・commitし、CIを確認する。
LOOP完成版には不要な変更を入れない。
ユーザー側の手動作業とサーバー再起動は極力減らす。


## 2026-10-23 基盤安定化
- ルームコード生成はランダム試行後に空きコードを走査し、空きがあるのに作成失敗するケースを防止。
- ロビー中の切断・再接続では Ready を解除し、古い Ready 状態の持ち越しを防止。
- 満室時に切断済みメンバーだけが枠を占有している場合、最古の切断枠を回収して新規参加を可能にする。
- DRAW は累積 3200 point、TELEPHONE の1描画は 2400 point に制限し、stroke肥大化を抑制。
- PARTY の LB Phone onOpen/onClose と phone toggle を使い、閉じている間のpush・poll・RAFを停止。
- 新ラウンド/ロビー遷移時に DRAW / TELEPHONE の一時描画状態も破棄。
- Create/Join/Ready/Game select/Start/Return lobby/Leave と主要入力にクライアント側多重送信ガードを追加。
- ラウンド進行中はホストの「ロビーへ戻る」をUIから隠し、結果表示後のみ通常導線として表示。
- LOOP の identifier / 配布仕様 / score・save・achievement 系には変更なし。


## 2026-10-23 ラウンド停止対策
- roundState に server-authoritative な `deadlineTick` を追加。
- REACTION 12秒 / STOP! BATTLE 25秒 / VOTE 60秒 / MAJORITY・MINORITY 45秒 / TIC-TAC 45秒/手 / WORD WOLF・LIAR 150秒 / DRAW 90秒 / TELEPHONE 75秒/手。
- 個別の `SetTimeout` / client timer event で終了させず、既存のサーバー cleanup が現在の roundState だけを確認するため、前ゲームのtimerが次ゲームへ残らない。
- TIC-TAC は合法手ごと、TELEPHONE は受け渡しごとに期限を更新。
- タイムアウト時は結果画面へ安全に遷移し、ホストがロビーへ戻せる。
- PARTY UI にサーバー時刻基準の残り時間表示を追加し、10秒以下で警告表示。


## 2026-10-23 推理ゲーム・TIC-TAC調整
- WORD WOLF / LIAR は開始直後に投票できないよう、サーバーauthoritativeな会話フェーズを追加。
- 会話時間は `30秒 + 参加者×5秒`、上限75秒。3人45秒〜10人75秒。
- UIは会話タイム中の投票ボタンを無効化し、サーバー時刻基準の投票開始カウントダウンを表示。
- 直接callbackを叩いても会話中は `VOTING_LOCKED` で拒否するため、UI回避で早投票できない。
- WORD WOLFの各自のお題、LIARの役職は従来どおりviewer別snapshotのみで配布。
- TIC-TACはラウンドごとに先手(X)を交互化し、同じ2人で連戦した際の先手固定を解消。


## 2026-10-23 Ready・MINORITY補正
- PARTYアプリを閉じる / phoneを閉じると、ロビー中の自分のReadyだけを解除する。
- ルームからは退出させないため、アプリ再オープン時は同じルームへ戻れる。
- ラウンド中のcloseはゲーム状態を直接破壊せず、server-authoritativeなround timeoutへ任せる。
- MINORITYは片側0票（全員同じ選択）の場合、0票側を「少数派勝者」にせず「少数派なし」とする。
- MINORITYの全員同一選択をdebug selftestへ追加。


## 2026-10-23 タイムアウト結果同期
- server cleanup内の `reconcileRound` がラウンド状態を変更した場合も即 `partyUpdate` をpushするよう修正。
- これによりtimeout結果が10秒poll待ちにならず、cleanup周期内で全端末へ反映される。
- TELEPHONEは手番timeoutでラウンド全体を中断せず、そのプレイヤーの手番だけskipして次へ進む。次手番の期限も再設定。
- TIC-TACは手番timeout時、相手プレイヤーの不戦勝として結果を確定。


## 2026-10-23 未入力者による全体停止の抑制
- REACTION / STOP! BATTLE / VOTE / MAJORITY / MINORITY / WORD WOLF / LIAR / DRAW は時間切れ時、ラウンドを単純中断せず、その時点の有効入力で結果を確定。
- REACTION / STOP! BATTLE は未入力者を結果上「未入力」と表示し、勝者候補から除外。
- VOTEは有効票0の場合に全員同票扱いせず「有効票なし」。
- MAJORITY / MINORITYは未回答者をB扱いせず「未回答」と表示。
- WORD WOLF / LIAR は有効票0を明示し、秘密役・お題の結果開示は従来どおりラウンド完了後のみ。
- DRAWは時間切れでも正解のお題と、正解済みプレイヤーの順位を表示。


## 2026-10-23 出題バリエーション・DRAW別解
- 繰り返し遊んだ時の単調さを抑えるため、VOTE / MAJORITY・MINORITY / WORD WOLF / LIAR / DRAW / TELEPHONE の出題プールを拡張。
- DRAWは50題以上へ拡張。
- DRAWの回答は完全一致だけでなく、例: `車=くるま/自動車`, `スマホ=スマートフォン/携帯電話`, `雪だるま=ゆきだるま` など自然な別表記も正解扱い。
- 別解判定はserver側で行い、クライアントから正解候補一覧は配布しない。


## 2026-10-23 結果画面・10人UI調整
- ラウンド完了後、ホストの「ロビーに戻る」は2.5秒の結果確認時間が終わるまで無効化。
- 結果確認時間は単一RAFで管理し、ロビー遷移/アプリsuspend時にcleanupする。
- 7〜10人ルームでは参加者行を自動で高密度表示。
- 長いプレイヤー名は折り返し可能、Ready/オフライン状態は潰れないよう右側を固定。


## 2026-10-23 PARTY v1配布仕様
- 正式名称: PARTY
- identifier: `flecity_party`
- LB Phone App Store無料配布: `defaultApp=false / game=true / price=0`
- icon: `web/party/icon.svg` をv1正式アイコンとして採用。
- LOOP側は `flecity_play / LOOP / defaultApp=false / game=true / price=0` およびscore/save/achievement仕様を維持。
- PARTY提出版は `flecity-games-party-1.0.0.zip`。既存LOOPを含む `flecity_games` 更新パッケージとして生成。
- production resource versionは提出ZIP内で `1.1.0` にpatch。
- 開発用reload/tools/TESTING.mdは提出ZIPから除外。
- GitHub ActionsでLOOP提出ZIPとPARTY提出ZIPをそれぞれbuild・artifact uploadする。


## 2026-10-23 満室再接続・Host close・ReturnLobby補強
- 満員Roomの切断枠は、DisconnectGraceSeconds（現在60秒）経過前には新規参加者へ回収しない。再接続猶予を実際に保証。
- JoinRoomはRound中判定をcapacity回収より先に実行。Round中の参加試行だけで切断メンバーが削除される経路を封鎖。
- HostがPARTYアプリまたはPhoneを閉じた場合、Room所属は維持しつつHost権限だけ次の接続中参加者へhandoff。RoomがHost不在で操作不能になることを防止。
- 元Hostがアプリを開き直してもRoomへ参加者として復帰できる。
- ReturnLobbyは結果確定前にはserver側で拒否。UIを回避した直接callbackでも進行中RoundをHostが中断できない。
- ReturnLobbyをLobby状態で再送した場合はno-opとして扱い、二重送信で他参加者の新しいReady状態を消さない。
- DebugSelftestへHost close handoff / reconnect grace / grace経過後capacity回収を追加。


## 2026-10-23 Host app-active追跡
- member内部状態に `appOpen` を追加。Create/Join/Reconnect/有効なPARTY callbackでtrue、AppClosedでfalse。
- Host移行時はFiveM接続中だけでなく、PARTYアプリを実際に開いている参加者を優先。
- 例: Host Aがclose、BはFiveM接続中だがPARTYを閉じている、CはPARTYを開いている場合、HostはCへ移行。
- Host close時に代替Hostがいなかった場合も、別参加者が後からPARTYを開いてcallbackを行うとHost権限を引き継げる。
- `appOpen` はロビーの開始阻害理由を分かりやすくするためplayer snapshotへbooleanのみ公開。閉じた参加者は「アプリ閉じています」、Host開始ボタンは「アプリ待ち N人」と表示。


## 2026-10-23 DRAW callback・10人Quick対応
- LB Phoneの `party:addDrawStroke` callback rateLimitを900ms→75msへ修正。server/core側の80ms rate limitは維持し、通常描画を阻害せずspam防止もserver-authoritativeに継続。
- DRAWのstroke数160 / 累積3200 point上限は変更なし。
- REACTION / STOP! BATTLE のmaxPlayersを8→10へ拡張。処理量が小さく全員同時入力型のため、10人Roomでもゲーム変更を強制されず遊べる。
- TIC-TACは2人専用、VOTE/MAJORITY/MINORITY/WORD WOLF/LIAR/TELEPHONEは3人以上というゲーム性上の人数制約を維持。


## 2026-10-23 更新経路をPARTY正本へ切替
- `games-update.ps1` / `games-manual-update.ps1` / 自動更新3スクリプトの取得branchを `games/platform-core` から `games/party-dev` へ変更。
- これにより `games-update.cmd` を実行した際、完成済みLOOPだけの旧branchへ戻らず、現在のPARTY開発HEADをテストサーバーへ展開する。
- 既存のworktree/Task名/配置先は維持し、取得先branchだけを切替えるためユーザー側の再構築は不要。
- GitHub Actionsに updater branch検査を追加し、今後 `games/platform-core` へ誤って戻る変更をCIで拒否。
- テストサーバー全体再起動は不要。既存の外部reload helperが有効ならverified build反映後に `flecity_games` のみ再起動される。


## 2026-10-23 結果の勝敗明示
- REACTION結果の最上部に `WINNER · 名前 · 反応時間` を表示。有効記録が無い場合は「有効記録なし」。
- STOP! BATTLE結果の最上部に `WINNER · 名前 · score` を表示。
- timeoutで一部未入力がある場合は「入力済みの記録で確定」を結果内に明示。
- DRAWは最初の正解者を `FASTEST` として表示。正解者0人の場合は「正解者なし」。
- 順位一覧自体は従来どおり残し、勝敗の要約＋詳細の2段構成にした。


## 2026-10-23 ライブ診断コマンド
- サーバーコンソール専用 `game_party_status` を追加。
- 各Roomの code / lobby・round / game / round番号 / complete / host / connected・total / Ready / appOpen / disconnected / deadline残秒を1行表示。
- WORD WOLF / LIARの秘密役・お題、DRAWお題、TELEPHONE途中chain等の秘密情報は診断出力に含めない。
- 複数クライアント実機テスト時、画面を見比べるだけでなくserver-authoritative状態を1コマンドで照合できる。


## 2026-10-23 TELEPHONEテンポ調整
- TELEPHONEの手番制限を一律75秒から、DRAW 45秒 / TEXT 30秒へ短縮。
- 10人でも最大待ち時間を大きく圧縮し、1人の放置で長時間止まる問題をさらに軽減。
- 初手はDRAW 45秒。drawing送信後はTEXT 30秒、text送信後はDRAW 45秒へserver側deadlineを切替。
- disconnect/timeoutで手番skipした場合はmodeを維持し、そのmodeに対応するdeadlineを再設定。
- UIの共通残り時間表示はserverの新deadlineをそのまま表示するため、クライアント側専用timer追加は不要。


## 2026-10-23 回答待ち進捗
- REACTION / STOP! BATTLE / VOTE / MAJORITY / MINORITY / WORD WOLF / LIAR のpublic snapshotに `submittedCount` / `expectedSubmissions` を追加。
- 共有するのは回答済み人数のみ。誰が何を選んだか、WORD WOLF/LIARの秘密情報は引き続き非公開。
- 自分が回答済みになった後の待機表示を `入力済み 3/5` / `投票済み 4/6` のように更新。
- 他参加者がsubmitするたび既存partyUpdateで件数が更新されるため、新しいpoll/timerは追加しない。


## 2026-10-23 DRAW進捗・TELEPHONE名前保持
- DRAWの `guessedCount` は現在接続中かつ描き手以外の正解者だけを集計。正解後に切断した参加者がいても `正解 2/1` のような分子超過を起こさない。
- TELEPHONE chain entryへ投稿時の `byName` を保存。
- 参加者が入力後にRoomから退出・grace cleanupされても、最終Chainでは `Player` へ退化せず投稿時の名前を表示。
- `byName` は結果表示用のみ。途中chainの秘密公開範囲は変更なし。


## 2026-10-23 旧自動更新branchの自動移行
- 過去に `games/platform-core` で自動更新を導入済みのPC向け移行処理を追加。
- auto-updateの `installed.flag` に `branch=games/party-dev` を記録。
- 通常 updater 実行時、installed.flagが旧形式/別branchなら自動的にinstallerを再実行し、既存worktreeとScheduled Taskを `games/party-dev` へ修復。
- ユーザーが明示的にauto-updateをdisableしている場合は再有効化しない。
- statusスクリプトで現在のauto branchと期待branchを表示。


## 2026-10-23 Suspend後の遅延push遮断
- NUIの `handlePartyMessage` で `partySuspend` / `partyResume` 以外は、`appSuspended=true` 中に即return。
- client側push停止とNUI側event gateの二重防御にし、phone/app close直前に送信済みだったDRAW stroke/clearが遅延到着しても閉じた画面のstate/canvasを更新しない。
- Resume時は既存 `partyGetRoom` でserver-authoritative snapshotを再取得するため、suspend中に捨てたeventは復帰後に正しい状態へ収束。


## 2026-10-23 AppClosed Host race対策
- `AppClosed` は `roomForPlayer` を通さず `roomForSource` で副作用なしにRoomを取得するよう変更。
- close処理の直前に `appOpen=true` へ戻したり、閉じようとしている非Hostへ一瞬Host権限がhandoffされるraceを防止。
- sourceとmember.sourceの一致も確認し、古いsourceからの遅延close eventが現在のmember状態を変更しない。


## 2026-10-23 visibility listener多重登録対策
- entry画面でapp close/openを繰り返した際、`scheduleBootstrap` ごとに `visibilitychange` listenerが増えていた問題を修正。
- `visibilityBound` / `bindVisibilityLifecycle` で1回だけ登録。
- 長時間利用や何度もPhoneを開閉した後にsuspend/resumeが多重発火し、poll/refreshが余計に走る経路を防止。


## 2026-10-23 退出誤タップ対策
- PARTYの「退出」は即実行から2段確認へ変更。
- 1回目は `もう一度押して退出` に変わり、2.5秒以内の2回目だけ `partyLeaveRoom` を送信。
- 2.5秒経過 / entry復帰 / app suspendで確認状態を自動解除。
- server側LeaveRoom仕様は変えず、NUI小画面の誤タップだけを防止。


## 2026-10-23 TELEPHONE結果キャンバス比率
- TELEPHONEの入力キャンバスは360×260だが、結果chainだけ320×220になっていたため360×260へ統一。
- normalized stroke座標を入力時と同じ縦横比で再描画し、最終公開時の絵がわずかに変形する問題を解消。


## 2026-10-23 ロビーApp presence表示
- player snapshotに `appOpen` booleanを追加。
- FiveM接続は残っているがPARTYを閉じている参加者を「待機中」と誤表示せず「アプリ閉じています」と表示。
- Hostの開始可否もReady待ちとApp待ちを分離し、閉じた参加者がいる場合は `アプリ待ち N人`。
- appOpen=falseの参加者を勝手にRoundから除外する変更はしていない。再開時に同Roomへ復帰する現仕様を維持。


## 2026-10-23 PARTY timeout判定周期
- 従来はPLAY/PARTY共通で5秒cleanupだったため、deadline到達後に最大約5秒「時間切れ判定中…」が残る可能性があった。
- cleanup threadを分離し、PLAYは従来どおり5秒、PARTYだけ1秒周期へ変更。
- PARTY Roomはメモリ上の小規模テーブル（最大10人/Room）走査のみで、1秒周期でもDB pollingは発生しない。
- timeout / TELEPHONE skip / TIC-TAC不戦勝 / partial result確定がdeadline後おおむね1秒以内にserver判定される。
- LOOPのcleanup頻度・DB仕様は変更なし。


## 2026-10-23 StartRound App presence強制
- serverの `allReady` も `appOpen=false` を未準備扱いに変更。
- close/Readyのraceや直接callbackでReady表示を迂回しても、PARTYを閉じた接続中メンバーを含むRoundは開始しない。
- UIの `アプリ待ち N人` とserver-authoritative開始条件を一致させた。


## 2026-10-23 DRAW・TELEPHONE単タップdot
- pointer down→ほぼ移動なしで離した1点strokeを破棄せず、極小の2点strokeへ正規化してdotとして保存。
- DRAWとTELEPHONEの両方へ適用し、目・ボタン・句点のような点描画が消えない。
- serverのstroke検証（最低2point / 座標0〜1 / point上限）は変更せず、その形式にclient側で安全に合わせる。


## 2026-10-23 日本語IME Enter対策
- DRAW回答とTELEPHONE文章入力のEnter送信に `!event.isComposing` を追加。
- 日本語IMEで候補をEnter確定しただけで回答が途中送信される問題を防止。
- 送信ボタン操作は従来どおり。


## 2026-10-23 TELEPHONE離脱時deadline再設定
- current playerがFiveM切断/Room退出した場合、`ensureTelephoneTurn` で次の接続中playerへskipした後にdeadlineを再設定。
- TEXTなら新しく30秒、DRAWなら新しく45秒を付与。
- 以前は前担当者の残り時間を次担当が引き継ぐため、離脱タイミング次第で次の人が数秒しか操作できない可能性があった。
- timeoutによるskipは既にdeadline再設定済みで、今回disconnect/leave経路も同じ挙動へ統一。


## 2026-10-23 非同期callback lifecycle世代ガード
- NUIに `lifecycleEpoch` を追加し、suspend/resumeごとに世代を更新。
- `refresh` / `bootstrap` / `loadPartyConfig` / `loadSettings` はawait前のepochを保持し、返答時に世代不一致なら破棄。
- `renderRoom` / `status` 自体もsuspend中は更新しない。
- phone/app close直前に開始済みのLB Phone callbackが遅延返答しても、閉じたUIへ古いroom stateを復活させない。
- Resume後は新しいepochでserver snapshotを再取得する。


## 2026-10-23 Suspend timer cleanup補完
- app/phone suspend時にstatus表示用 `statusTimer` もclear。
- round RAF / poll / bootstrap / leave確認timerに加えて、閉じた後に残るNUI timerをさらに削減。


## 2026-10-23 PARTY+ 恒常サブスクリプション
- PARTY本体は引き続きLB Phone App Store無料（`flecity_party / price=0`）。LOOPの`flecity_play`、App Store仕様、score/save/achievement互換は変更しない。
- PARTY+は7日 / 50,000。citizenid=CSN単位で`flecity_game_subscriptions`へ有効期限・自動更新状態を保存。
- 課金はQBoxのbankからserver側で実行。subscribe同時実行ガード、残高確認、DB保存失敗時refundを持つ。
- 期限切れ時はオフライン中に連続課金せず、次回PARTY利用時に1期間だけ自動更新を試行する。残高不足時は再試行ループを避けるため自動更新をOFFへ移行。
- 自動更新はユーザーが停止可能。停止しても現在の期限までは利用可。
- 加入HostのRoomでは未加入参加者もPARTY+ゲームを利用できる。勝敗・スコアに課金優位は付けない。
- Hostが非加入者へ移行した場合、進行中Roundは壊さず、次のPARTY+開始時のみserver entitlementで拒否する。
- NG WORD 80題、FAKE ANSWER 84問、BOMB 120題。MEMORY CHAINは記号列をserver生成。
- NG WORD: 説明役だけがお題/NG語を受け取り、NG語を含むヒントはserver拒否。
- FAKE ANSWER: 偽回答作成→匿名選択肢→投票→正解+騙した票で結果。投票中は正解/作者を非公開。
- BOMB: 爆発時刻はserverのみ保持。VC回答後のPassで次へ渡し、手番10秒上限。
- MEMORY CHAIN: 記憶→入力のserverフェーズ制。入力時は正解列をsnapshotから除外し、間違い/未入力で脱落、最大8stage。
- 課金成功時event `flecity_games:server:partyPlusCharged` を発火。会社口座等への売上振替は未設定で、必要なら運営仕様確定後にevent listenerのみ追加する。
- 実機FiveM複数クライアントでの課金・Host共有・各4ゲーム・切断/再接続は未検証。TESTING.md / PARTY運営確認用メモに残す。
- GitHub Actionsはrunner_id=0 / steps空の状態でjob開始前failureが継続中。コード検査PASSとは扱わず、runner復旧後のgreen確認を必須とする。


## 2026-10-23 Flecity運営確認済み本番前提
- Framework: QBox 2.5.4
- Database access: oxmysql
- 永続プレイヤー識別: `citizenid = CSN`
- PuriPhoto / LOOP / PARTY等を独立resourceとして制作・テスト後、今後も追加LB Phoneアプリとして提出して問題なしとの運営回答。
- PARTYの永続課金権利はsourceではなくcitizenid(CSN)単位で扱う。

## 2026-10-23 PARTY+ 拡張
- PARTY本体と既存無料10ゲームは無料のまま維持。
- PARTY+: 7日 / 50,000 / 自動更新。加入HostのRoomでは未加入参加者もプレミアムゲームを利用可能。
- 限定品・シーズン・月替わり追加を前提にせず、運営/開発双方の更新作業を増やさない。
- プレミアムゲーム: NG WORD / FAKE ANSWER / BOMB / MEMORY CHAIN / FALL BATTLE の5本。
- お題量は NG WORD 120 / FAKE ANSWER 124 / BOMB 180。MEMORY CHAINはserver生成。
- FALL BATTLEはPLAYのFALL操作系をPARTY専用対戦として再実装。LOOP本体のFALLコードやscore/save/achievement互換は変更しない。
- FALL BATTLEは2〜10人・90秒・全員同一seed。配置履歴をserver再生してscore/linesを検証し、クライアント申告scoreを信用しない。
- 実機複数クライアントでのPARTY+課金、Host共有、FALL BATTLE 2人/10人、小画面操作、close/reopenは未検証。TESTING.mdの確認を必須とする。


## 2026-10-23 FALL BATTLE 再接続・診断補強
- PARTY+の5本目としてFALL BATTLEを2〜10人 / 90秒 / 同一seedで実装。
- 各端末の盤面そのものは同期せず、公開snapshotは完了人数だけを共有。10人でも毎フレームRoom通信しない。
- 配置履歴はserver側の独立verifierで再生し、score / lines / piecesをserver計算する。
- verifier selftestをstartup preflight / `game_selftest` / `game_preflight` の3経路へ組み込み。
- Phone/App closeだけでなくFiveM切断でも未提出者はそのRoundをDNF扱いにし、60秒以内再接続で盤面を最初からやり直す抜け道を封鎖。
- DNFはRoom退出ではなく当該Roundのみ。次Roundでは通常参加可能。
- FALL BATTLE画面には `FINISH n/N` を表示し、他人の盤面・scoreを途中公開せず待ち人数だけ確認できる。
- static checkのPARTY registry順序を無料10本＋PARTY+ 5本の合計15本へ更新。


## 2026-10-23 CI / 運営資料整合性
- PARTY運営確認用メモの旧表記「PARTY+ 4ゲーム」を5ゲームへ更新し、FALL BATTLEを正式な確認対象へ追加。
- FALL BATTLE実機確認には2人/10人、90秒timeout、Phone/App close・FiveM切断DNF、再接続後のやり直し不可、途中盤面/score非公開を明記。
- GitHub Actions最新runも `runner_id=0 / steps=[]` のjob開始前failure。コード実行結果ではないためgreen扱いしない。
- runner復旧後はJS/Lua/static check/提出ZIP buildを含むworkflow green確認が必要。


## 2026-10-23 順番制ゲーム app/phone close耐性
- FiveM接続中でもPARTY/Phoneだけ閉じた参加者が順番制ゲームを止めないよう補強。
- TELEPHONEはcurrent playerがappOpen=falseになった時点で即skipし、次のapp-open参加者へmode別の新deadlineを付与。次順候補もappOpen=falseなら自動skip。
- BOMBはappOpen=falseの参加者へ手番を渡さず、current playerがcloseした場合も即次のapp-open参加者へ移行。
- TIC-TACは参加者がPARTY/Phoneを閉じた場合、相手の不戦勝（APP_CLOSED）として即結果確定。45秒timeout待ちを発生させない。
- Room所属は維持するため、closeした参加者もロビー復帰後の次Roundには通常参加可能。
- DebugSelftestへ telephoneAppCloseSkip / bombAppCloseSkip / ticTacAppCloseForfeit を追加。
- 実機FiveM複数クライアントでのclose直後push・遅延callback・再open挙動は未検証。TESTING.md / PARTY_OPERATOR_CHECKLIST_JA.txtへ残す。


## 2026-10-23 PARTY+ app/phone close放置耐性
- NG WORD: 説明役がapp/phone closeした場合は即ラウンド中断。回答役closeは回答待ち人数から除外し、残り回答者が完了済みなら即結果確定。
- FAKE ANSWER: submit/vote両phaseともappOpen=false参加者を待ち人数から除外。close直後に残り全員入力済みなら次phase/結果へ即進行。
- MEMORY CHAIN: app/phone closeした参加者をそのstageで脱落扱いにし、残り参加者の進行を15秒timeoutまで止めない。
- Room所属は維持し、次Roundには再参加可能。課金権利やHost共有仕様は変更なし。
- 上記のclose直後push、再open、複数人同時closeはFiveM複数クライアント実機で未検証。


## 2026-10-23 PARTY+ FiveM切断時の即時進行
- FAKE ANSWERは偽回答/投票の両phaseでFiveM切断者を待機人数から除外し、残り全員が入力済みならreconcile時に即進行する。
- MEMORY CHAINはFiveM切断者をalive人数から除外し、残り全員が入力済みならreconcile時に即stage判定する。
- app/phone closeだけでなくplayerDropped経路でも放置待ちを減らした。再接続grace自体は維持し、既に進んだphase/stageは巻き戻さない。
- 実機複数クライアントでの切断→即進行→60秒以内再接続は未検証。


## 2026-10-23 PARTY+ 最低人数割れ後の継続
- Round開始時のminPlayers判定は変更せず、開始後の切断だけゲーム別continuation minimumで扱う。
- NG WORD / FAKE ANSWER / BOMB は3人開始後に1人切断して2人になっても、ゲーム固有のreconcileで継続可能。
- MEMORY CHAINは2人開始後に1人切断した場合、残存1人を勝者として確定する。
- FALL BATTLEは2人開始後に1人切断してもRound全体をabortせず、切断者をDNFとして結果に残し、残存者の提出で順位確定する。
- FALL BATTLEは提出済み後の切断でもserver検証済みscore/linesを結果から消さない。
- DebugSelftest/static checkを追加。FiveM複数クライアント実機確認はTESTING.mdの未検証項目として残す。


## 2026-10-23 delayed callbackによるapp presence復活防止
- `roomForPlayer` をmembership lookupとして純化し、通常callbackが `appOpen=true` を暗黙復元しないよう変更。
- AppClosed後に既に飛んでいたsubmit等が遅延到着しても、閉じた端末を「アプリを開いている」状態へ復活させない。
- `appOpen=true` の復元は再接続処理または明示的な `GetRoom`（再open bootstrap）だけで行う。
- これによりclose直後の遅延callbackがHost presenceを奪い返すraceも抑止。
- 実機2台以上でclose/submit競合→再openを確認するまでは未検証。
