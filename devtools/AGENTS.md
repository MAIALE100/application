# 共通開発基盤

- 新規リソースの開発は最初に FLECITY_DEVELOPMENT.md を読み、flecity.cmd を優先利用する。
- 共通コード、プロジェクト別アダプター、更新・復旧処理を分離する。
- PASS / FAIL / NOT_RUN / BLOCKED を区別する。静的検査で実機成功を宣言しない。
- 本番接続、全体再起動、稼働DBでの破壊的試験は禁止。
- 個人設定・ログ・バックアップ・スクリーンショットは .flecity-dev/ に保存し、コミットしない。
- 安全ガード変更時は node --test devtools/flecity/tests/*.test.mjs を実行する。
