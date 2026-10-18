# Photo Diary 導入手順 — PAYMENT-PENDING

## 更新導入
1. 現在の `weazel-photo-diary` をバックアップします。
2. resourceフォルダを本パッケージの内容へ置き換えます。
3. 既存RC/PREPAYMENT環境ではSQLの再実行は不要です。
4. `restart weazel-photo-diary` を実行します。
5. Diary読込、共有画面の `x / 5`、Birdy、Sharedを確認します。

## 新規導入
1. resourceを `resources` 配下へ配置します。
2. `sql/install.sql` を1回実行します。
3. `server.cfg` で `lb-phone` と `oxmysql` の後に `ensure weazel-photo-diary` を指定します。
4. FlecityがQbox以外の場合、`server/framework.lua` の `GetIdentifier` にキャラクター固有ID取得処理を接続します。

## 課金
現時点では追加購入を有効にしないでください。運営回答後、`ProcessShareSlotPurchase` をFlecityの銀行・Weazel会社口座へ接続し、価格設定・決済テスト完了後にのみ `Config.EnablePaidFeatures = true` とします。
