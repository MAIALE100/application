# Flecity Games PARTY 開発引継ぎ

## 目的
LB Phone 向けの複数人用ミニゲームアプリ「PARTY」を、既存の `flecity_games` リソースを土台に完成させる。

## 開発元
- Repository: `MAIALE100/application`
- Branch: `games/party-dev`
- Resource: `flecity_games`
- Framework: Qbox / oxmysql / MariaDB
- Phone: LB Phone 2.9.0
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
- 開発ブランチでは `enabled=true`
- 現時点の `defaultApp=true` は開発用のまま。公開時の配布方式は PARTY 完成時に決める。

既存ゲーム:
1. REACTION — 2〜8人
2. STOP! BATTLE — 2〜8人
3. VOTE — 3〜10人
4. MAJORITY — 3〜10人
5. MINORITY — 3〜10人
6. TIC-TAC — 2人
7. WORD WOLF — 3〜10人
8. LIAR — 3〜10人
9. DRAW — 2〜10人
10. TELEPHONE — 3〜10人

既存サーバー機能:
- CreateRoom / JoinRoom / GetRoom
- SetReady / SelectGame / StartRound
- 各ゲームのSubmit処理
- DRAWのstroke同期・clear
- TELEPHONEのdrawing/text送信
- ReturnLobby / LeaveRoom
- disconnect cleanup / room cleanup
- DebugSelftest / DebugCounts

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
- `flecity_games/web/party/index.html`
- `flecity_games/web/party/app.js`
- `flecity_games/web/party/icon.svg`
- `flecity_games/web/shared/app.css`
- `flecity_games/tools/static_check.py`

## 開発優先順位
1. 現状コードを通読し、各ゲームが本当に成立しているかを実機目線で監査。
2. ルーム作成→参加→Ready→開始→結果→再戦→ロビー復帰を全ゲーム共通で安定化。
3. Host離脱、参加者離脱、途中再接続、二重送信、連打、同時操作、人数不足を処理。
4. サーバーauthoritativeにできる判定はサーバー側で検証し、不正なsubmitを拒否。
5. 10ゲームを一つずつ「面白さ・テンポ・結果演出・再戦性」まで磨く。
6. LB Phoneの小さい画面で、縦スクロール・横はみ出し・誤タップ・ステータスバー干渉を確認。
7. PARTY専用のブランド名・アイコン・App Store配布仕様は内容完成後に決定。
8. static check / JS syntax / Lua syntax / CI を常時通す。
9. 最後にPARTY専用提出ZIPと運営向け導入資料を作る。

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
- `appOpen` はserver内部状態のみで、他参加者のsnapshotには公開しない。


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
