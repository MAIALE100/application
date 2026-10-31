# flecity_games 設置先との差分分類（更新前レビュー）

基準: 2026-11-01の既存[43ファイル照合](../link-reliability-20261101/runtime-comparison.json)。37一致・6相違・欠落0。版表示は双方 `0.79.6-test`。以下6ファイルは行単位で比較し、設置先だけに追加された行は見つからなかった。どれもローカル修正が未反映の状態。設置先外のLB Phone、キャッシュ、メモリー上のコードはこの分類に含めない。

| ファイル | workspaceにある変更 | 分類・影響 |
|---|---|---|
| `server/core/party.lua` | 記憶チェインの15秒記憶・30秒入力とフェーズ遷移 | ローカル修正未反映。進行不能の実機報告に関係。DBスキーマ変更なし |
| `server/core/party_plus.lua` | LINK無効時の内部課金経路停止 | ローカル保護未反映。現行設定値と両アプリ影響を更新前に確認 |
| `server/main.lua` | 無効アプリのcallback拒否 | ローカル保護未反映。共有リソース全体への影響あり |
| `web/party/app.js` | 状態消去、記憶タイマー表示、伝言のポインター中断時の線保全 | ローカル修正未反映。端末キャッシュでも挙動が変わるため実機差分確認が必要 |
| `web/shared/bridge.js` | 無応答12秒上限、曖昧な失敗時の自動再送停止 | ローカル修正未反映。LOOP/LINK共通通信に影響 |
| `web/shared/errors.js` | NUIの無応答メッセージ | ローカル修正未反映。ユーザー表示のみ |

**競合分類:** 上記6ファイルの今回の行差分では設置先固有の追加変更を検出しなかった。ただし設置先ファイルの起源はGit履歴から同一コミットと証明できず、設置先の独自設定や他ファイルの変更まで「競合なし」と拡張しない。更新前に最新の43ファイル全件を再計算し、SHAと差分を固定する。さらに今回のSpace操作修正により、対象候補は `web/shared/controls.js`、`web/play/app.js`、`web/play/index.html`、`web/party/fall_battle.js`、`web/party/index.html` へ広がった。最新の差分件数は[現時点の再照合](runtime-comparison-current.json)を参照。

更新単位は共有リソース `flecity_games` の1件。LOOPとLINKを別々に再起動しない。今回のコード差分にSQLファイル・DBスキーマ変更はないが、`server/main.lua` の起動時に `FlecityGamesDatabase.Ensure()` が呼ばれるため、DBが不変と推測して再起動しない。使い捨てDBでEnsureの影響と既存データ互換を再確認するまで実反映は保留。
