# WAVE 導入・既存配置の確認（準備専用）

対象はFiveMテストサーバーのみ。本番用の手順ではない。2026-11-01の読取調査では `D:/FiveM_Test_Server/txData/Qbox_D233FD.base/resources/[lb-phone]/wave` が**既に存在**し、開始時点のworkspace `wave/` の12ファイルと全件SHA256一致した。その後、LB Phone識別子衝突時に所有不明のアプリを削除しない修正をworkspaceの `client/main.lua` に追加したため、現行設置先とはこの1ファイルが異なる。`.wave-build.txt` は双方にあるビルド記録だが、実行時に不要なためZIPには含めない。現行テストサーバーへはこのZIPをコピーしない。未設置の別テスト環境で使用する場合も、対象・依存・DB・バックアップを改めて確認する。

## 構成・起動順

- `wave/fxmanifest.lua`: Lua 5.4、`config/shared.lua`、`client/main.lua`、`server/main.lua`、`web/**/*`、`sql/*.sql`。
- 必須リソース: `oxmysql`、`qbx_core`、`lb-phone`。現行テストサーバー上に各フォルダの存在を確認した。稼働状態・API互換性は未確認。
- 初回導入時の例: `ensure oxmysql` → `ensure qbx_core` → `ensure lb-phone` → `ensure wave`。既存 `server.cfg` のグループ起動（例 `ensure [lb-phone]`）にwaveが含まれる場合、`ensure wave` を重複追加しない。配置先のリソース名は `wave` とし、`flecity_games` と混ぜない。
- LB Phoneアプリ識別子は `flecity_wave`、NUI callbackは `wave:callback`、サーバーcallbackは `wave:*`。現行resources内の検索でこれらの識別子は既存wave以外に検出しなかった。ただし起動済みアプリの登録状態は実機で確認する。新版は `APP_ALREADY_EXISTS` 時に他リソースのアプリを削除せず登録を保留する。
- 設定は `wave/config/shared.lua` に集約。価格、収益率、引出下限、権限ACE、サブスク有効/無効を導入前にレビューする。既定のサブスクは**無効**。実銀行・既存データで自動テストをしない。

## DBと初回起動の承認境界

手動SQL importは不要。`wave/server/main.lua` の起動時 `ensureSchema()` が `CREATE TABLE IF NOT EXISTS` を19件実行し、プラットフォーム財布と `wave_schema_meta` へINSERT/UPDATEする。`wave/sql/wave.sql` は説明用のSELECTで、スキーマ作成用SQLではない。既存テストDBの実テーブル・版・マイグレーション履歴は未照合。

今回の指示では**DB変更・サーバー反映・再起動は禁止**。そのためWAVEの初回起動・再起動も行わない。後日、DBバックアップと対象スキーマの差分、起動時書込み、実課金/権限、接続0人、ロールバック、初回更新承認を確認するまで導入はBLOCKED。`wave_selftest` は情報スキーマとメタ表を読み、`wave_diag` は状態を出力するが、今回は実行していない。

## 導入時の検査とロールバック（未実施）

1. 既存配置の有無と全ファイルSHAを確認。存在すれば上書きせず、現行12ファイルの完全バックアップを取り直す。使い捨てDBで同じバージョンのDDL・callback・権限・課金境界を検証する。
2. 初回反映の明示承認と既存の更新安全条件を満たしてから、対象 `wave` のみを配置・起動する。`flecity_games` とサーバー全体は再起動しない。導入直前・対象起動直前に権威ある接続0人を再確認する。
3. 失敗時は対象 `wave` だけを停止し、バックアップしたファイルを元の位置に戻してSHAを照合。DBはDB専用バックアップの復旧計画に従う。WAVEが新規追加だった場合は、この導入で追加したwaveフォルダと起動設定だけを撤去する。既存DBテーブルや売上・購入データを無断削除しない。

LOOP＋LINK統合候補 `e401ff7` とそのCSS ZIPは別管理で、WAVEパッケージに含めない。三アプリ同時導入は実機/DB/課金・権限ゲートが揃うまでNOT_READY。
