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
