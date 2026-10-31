# flecity_games 実機反映準備の停止記録（2026-11-01 JST）

対象は既存テストサーバー `D:/FiveM_Test_Server/txData/Qbox_D233FD.base/resources/flecity_games` のみ。設置先のファイル変更、DB操作、リソース再起動、本番反映は0件。

## 確認済み

- 親Git `b1f468e` は開発用NUIテスト5ファイルのみ。実リソースへ配置するコードは含まない。
- 保護中の未コミット `flecity_sources/flecity_games/web/shared/screen.css` は、大画面のバーを本文と分け、本文だけをスクロールさせる10行の追加。LOOP/LINKのブラウザー回帰では、この作業ツリーのCSSを使用してPASS。未コミットのまま保護し、設置先にはコピーしていない。
- 現行リソース全体70ファイルを `.flecity-dev/projects/link/backups/2026-10-31T22-22-18-816Z-3f765c05/resource` へコピー。前後の全ファイルSHA一覧が一致し、inventory SHA256は `bef925ff00b380b0a7f4c46e79fb34c308157803f5af00ee0a10ad4ed97fc14b`。別の隔離フォルダへの復元演習でも70件一致。
- [43ファイル照合](runtime-comparison-prep.json)を保存。前回照合から設置先14ファイルのハッシュが変わった。現時点では43件中37一致・6差異。さらに未コミット `web/shared/screen.css` も設置先と異なる。

## 競合・保留

差異7ファイル: `fxmanifest.lua`、`server/core/party.lua`、`web/party/app.js`、`web/party/index.html`、`web/shared/app.css`、`web/shared/errors.js`、`web/shared/screen.css`。設置先 `fxmanifest.lua` の版名は `0.79.6-test-live-rc1` で、workspaceの `0.79.6-test` と違う。設置先の `web/shared/app.css` には加入表示の独自変更もある。現行設置先の変更を単純に旧版やローカル版で上書きしない。

前回の11差異を前提にしたパッケージ生成は、最初のハッシュ衝突で停止した。空の準備フォルダ以外に更新パッケージは作成していない。**安全な更新パッケージは未完成、更新手順はBLOCKED**。競合7ファイルを個別に三者比較し、設置先固有変更の採否と未コミットCSSの所有・保存状態を確定した後、現行70ファイルのバックアップIDと一致する新しい候補を作る。

## 将来の更新手順（未実施）

1. 競合を解決した候補全ファイルのハッシュ、LOOP＋LINK両アプリ回帰、DB起動時Ensureの影響をレビューする。SQL直接変更がなくても起動時Ensureが条件付きDDLを行い得るので、DB変更不要と断定しない。
2. 更新直前に設置先全70ファイルを再照合し、ハッシュが動いたら候補を無効にする。バックアップを更新直前に取り直し、隔離復元を再確認する。
3. 初回実更新の明示承認、ネイティブで確認した接続0人、対象・依存状態、排他、対象リソースだけの停止/復旧手順を満たす場合に限り、既存 `backup/plan/apply` 経路を検討する。対象は共有 `flecity_games` なのでLOOPとLINKの両方に影響する。全サーバー再起動は禁止。

今回の目的は導入準備までであり、更新の実行承認は求めていない。次に必要なのは、設置先で進んだ14ファイルの変更元と7差異の採否の確認である。
