# LOOP先行提出・LINK併存の確認（提出不可・構成調査）

LOOPは15ゲーム、LINKも同じflecity_gamesに15ゲームを持つ。別々のリソースとして同時に起動できるとは扱わない。
現在の専用環境は旧検査用コピーを基にした選択版。LOOPのapp.js/play.luaは旧manual worktreeの同ファイルと一致することを調査済み。旧ルート版・旧release版の内容は異なるため混ぜない。

## LOOP先行提出の構成案

- リソース名flecity_games・識別子flecity_play・DB/イベント名を維持し、破壊的に分離しない。
- 専用のパッケージ候補でApps.Play.enabled=true、Apps.Party.enabled=false、PartyPlus.Enabled=falseを明示。
- 共有コードは残し、無効なアプリのサーバーcallbackを拒否。LINK+は内部呼出しでも課金/自動更新しない境界を確認する。
- 既存builderはLINK画面を除外するが、旧コードではサーバーcallback/課金境界を止め切れなかった。この修正と両アプリの回帰が必要。
- 開発reload・トークン・設定/個人データを含めない。元ソースや既存ZIPは削除しない。既存builderの固定STAGE置換は今回実行していない。
- 既にLINKが使われている同名リソースへLOOP専用版を上書きするとLINKが無効になる。同時利用環境では先行版の無条件適用不可。LINK/LOOP両方を影響対象として承認する。

これは構成案であり、現在提出できることを意味しない。最終ZIP・実機・既存データ互換が未検証なので候補ZIPはまだ作成しない。

## LOOP実装と試験範囲

反射神経、タイミングストップ、タワー、ブロック、数字マージ、テトリス、マイン、ノノグラム、神経衰弱、カラーソート、15パズル、色あて、数字タッチ、ハイ＆ロー、ひかりの記憶。
ランキング・Daily・実績・対応ゲームの途中保存を実装。保存非対応のゲームへ保存保証を拡張しない。
ブラウザーmockの起動/中断/再開、実Luaのルール/スコア/リプレイ/時間の不変条件を検査する。
5分の時計ジャンプと8時間位置計算は実時間の長時間プレイではない。各ゲームの全操作・終局・サーバー検証・長時間・低FPS・実機は別の残作業。

## 導入・設定・コマンド

lb-phone、oxmysql、QBox/framework互換を確認。config/shared.luaのApps、Play、Party、PartyPlus、RateLimitsを確認する。
consoleのgame_status/game_healthcheck/game_selftest/game_preflightがある。game_preflightと起動時処理はDB初期化に関わるため、無断で実行しない。
承認後のみ依存順序・対象バックアップ・接続0人・復旧手順を確認して対象リソースを更新する。全サーバー再起動は行わない。
LINKの実複数人接続テストは仮想2〜4人テストと区別する。将棋等の実装仕様と未対応ルールも提出資料へ明記する。
提出可否は共通SUBMISSION_STATUS.jsonで管理。提出/公開はユーザー承認後。
