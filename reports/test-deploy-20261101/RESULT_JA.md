# LOOP・LINK・WAVE テストサーバー反映結果

日時: 2026-11-01 10:49 JST。対象: txAdmin `MAIALE100_Test_01`、`D:\FiveM_Test_Server\txData\Qbox_D233FD.base`。**テストサーバー反映・対象2リソース起動 PASS。FiveMクライアント機能検証は NOT_RUN。** 本番環境、他リソース、server.cfg、定期タスクは変更していない。

## 更新前ゲート

- Git HEAD `09eca50`。既存の未コミットCSS・文書3件と未追跡のtxAdmin確認レポートを保持。これらを戻したりコミットしたりしていない。
- 修正版v3確認用ZIPのSHA256 `a1c6a8f2834f4e44312f9ae93fb4542268aa349d3f24e3f4d1c6c8631666d4dd` が記録値と一致。ZIP自体を無検証で展開・上書きせず、検証済み展開先の許可2ファイルだけを使用した。
- 設置先 `flecity_games` 70件・`wave` 12件がPhase 1全件基準と一致。差分は下記2ファイルのみ。既存の設置先固有ファイルは保持。
- 新規バックアップ: `D:\FiveM_Dev_Backups\flecity-live-test\pre-update-2026-11-01T01-42-27-234Z`。両リソース全82件の相対パス・SHA256一致。全DB物理バックアップ627件を完了し、コピーでprepare PASS。隔離MariaDBを127.0.0.1:3308、独立datadirで起動し、PID・datadir・portを照合後、QBox 187テーブル、WAVE 19テーブルを確認。隔離プロセスのみ停止。元バックアップのSHA256はprepare後も全件一致。
- txAdmin表示の接続人数0人。更新後の `players.json` と `dynamic.json` も0人。今回のテスト環境では0人を必須条件にしていない。
- txAdmin Resourcesで `flecity_games`、`wave`、`lb-phone`、`oxmysql` の稼働を確認。更新前のローカル試験は既存の同一候補に対するPhase 1の8スイートPASSと共通144件PASSを参照し、今回再実行していない。

## 適用したファイル

| リソース | 相対パス | 更新前SHA256 | 更新後SHA256 |
|---|---|---|---|
| `flecity_games` | `web/shared/screen.css` | `e5e93481c1cce46fceea8ee3fd0aed624817e85fded5c85b083d0866a7d172ef` | `863327c1b0f56c5a052393319f66ed0007a1dc4aea362284253e2e8909c78cca` |
| `wave` | `client/main.lua` | `64c9256394442459dc3403471d2e9683380be2f554af8095e087236748d2a0c1` | `32e0b5c3e6c9ce6049debd8af0c6d28ce2c64d5164b8c7e44dd724b9354f3051` |

コピー直後は両リソースの全件inventory SHA256が候補値と一致。再起動後も上記2ファイルのSHA256は一致。`flecity_games/runtime-active.txt` の `started` だけが再起動により更新され、その他のファイル差分は0件。手動SQL移行は実施していない。WAVE起動時の既存DB Ensure処理は通過し、更新後の読み取り専用検査はQBox 187テーブル、WAVE 19テーブル、players 9行、wave_tracks 4行、wave_purchases 0行、wave_wallets 8行だった。

## txAdmin操作と起動ログ

Live Consoleに `restart flecity_games` を2回入力して送信操作を試みたが、コマンド実行履歴・サーバーログが増えなかった。この経路の実行成立は **NOT_RUN** と扱う。以後は試行を止め、同じ認証済みtxAdminの Resources 画面から `flecity_games` と `wave` の対象別Restartをこの順で操作した。admin.logにはそれぞれ10:49:00と10:49:22に対象リソースのEnsure記録があり、fxserver.logには両対象のStopping/Startedが記録された。FXServer全体の再起動はしていない。

- `flecity_games` **PASS**: `0.79.6-test-live-rc1`、build `fb17b7f`。database schema ready、LB Phone callbacks 54/54、startup preflight READY_FOR_LIVE_TEST。
- `wave` **PASS**: `0.3.5-test`。database schema ready、LB Phone callbacks 33/33、READY_FOR_TEST。
- 更新に起因する対象リソースの新規重大エラーは、起動ログ範囲では検出せず。更新前からqbx_coreのWeazel職階エラー、qbx_ambulancejobのstatusコマンドエラーが存在。今回の2ファイル変更によるものとは判定していない。

## 未検証と復旧

LOOP・LINKの電話画面と全ゲーム操作、複数クライアント、NGワード・お絵描き伝言、WAVE Studio/Library、購入・サブスク・売上受取、クライアント側LB Phoneアプリ表示は **NOT_RUN**。サーバー側callback登録をクライアント動作PASSとは扱わない。実決済は行っていない。運営提出判定は保留。

ロールバックは新規バックアップ内の同じ相対パスの2ファイルを、現行SHA256の照合後に対象2ファイルだけ戻し、txAdmin Resourcesで `flecity_games`、次に `wave` を再起動する。リソース全体のコピーとDB物理バックアップも保持。復元手順は準備済みだが、正常起動のため実際のロールバック操作は **NOT_RUN**。DB復元を現行DBに行っていない。

次はユーザーのFiveMクライアントでLOOP・LINK・WAVEの表示と主要操作を確認し、複数人・銀行振込などの未検証項目を別途安全なテスト手順で扱う。Live Consoleのコマンド送信が成立しなかった原因は別途調査する。対象リソースの更新には今回成功した認証済みResources経路を使用できる。
