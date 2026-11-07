# Flecity Games コア自己テスト

`node flecity_games/tools/run_core_selftests.mjs` は、実際のゲーム登録とサーバー側の `DebugSelftest` をローカルLua実行環境で確認します。現在の登録数（LOOP 15、LINK 15）と各ゲーム名を表示し、スコア検証、ターン進行、結果処理、切断・再接続に関する自己テストを実行します。

Lua実行環境はテスト専用です。`fengari` がPATHにない場合は、PowerShellで `FENGARI_NODE_SCRIPT` に `fengari-node-cli/src/lua-cli.js` のパスを指定してから実行してください。テスト用ランタイムはFiveMリソース依存ではありません。

このテストはサーバーイベント、NUI通信、実際の2〜4クライアント接続を模擬しません。FiveMのJSON codecに依存するLOOPの保存サイズ・JSON往復自己テストは `NOT_RUN` として明示します。実機複数人テストの代用や合格根拠にはなりません。
