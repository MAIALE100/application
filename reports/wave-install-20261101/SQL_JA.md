# WAVE SQLの扱い

別途実行が必要な初期SQLファイルは**ない**。同梱 `wave/sql/wave.sql` は説明用SELECTのみ。スキーマは `wave/server/main.lua` の `ensureSchema()` が起動時に自動作成する（19件の `CREATE TABLE IF NOT EXISTS` と、財布・スキーマ版のINSERT/UPDATE）。現行設定の `SchemaVersion` は3。既存DBへの実適用とマイグレーションは今回NOT_RUN。

実サーバーのDBを変更しない。将来起動する前に、対象DBだけのバックアップ、19テーブルの既存有無と定義、スキーマ版、既存データへの影響を運営と確認する。既存データがある場合は自動作成を「変更なし」とみなさない。SQLファイルを手動実行して先回りしない。
