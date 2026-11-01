# Flecity 3アプリ大画面対応・中断後の確定結果

## 反映状態

- 対象はテストサーバー `MAIALE100_Test_01` の `flecity_games` と `wave`。本番環境、現行DBの手動SQL、全サーバー再起動は未操作。
- 中断時の8ファイルはすべて更新候補SHA256と一致しており、再コピーは行わなかった。バックアップとの差分は下記8ファイルと、`flecity_games` 再起動に伴う `runtime-active.txt` の起動時刻だけ。設置先固有のその他ファイルを保持した。
- txAdmin管理ログ: 11:31:32 `flecity_games`、13:59:45 `wave` を各1回 Ensured。後者のみ中断後に実行。両者とも停止→開始が記録され、`flecity_games` はDB schema ready / LB Phone callbacks 54/54 / READY_FOR_LIVE_TEST、`wave` はDB schema ready / callbacks 33/33 / READY_FOR_TEST。今回の起動行に対象リソースの重大エラーはない。別リソース `qbx_core` の既存 `weazel grade 0` 給与エラーは継続しており、今回の変更に帰属させない。
- 再起動前にtxAdminで接続1人、再開後の画面では0人を観測。テスト環境で0人は必須条件ではない。接続中の利用者へ直接通知する経路は利用していない。

## ファイルと復旧

更新: `flecity_games/web/shared/screen.css`、`wave/fxmanifest.lua`、`wave/client/main.lua`、`wave/web/app.css`、`wave/web/app.js`、`wave/web/index.html`、`wave/web/screen.js`、`wave/web/screen/index.html`。全8件について展開ZIP、設置後、更新候補のSHA256が一致。詳細は `.flecity-dev/releases/bigscreen-final-20261101/MANIFEST.json`。適用ZIPは同フォルダの `FLECITY-BIGSCREEN-READY_FOR_TEST.zip`、SHA256 `1d7269b1e46f7a682904b090fe4489cfcdc236b7d29502468c2e3dbbfd5e83bd`。

更新直前バックアップ: `D:\FiveM_Dev_Backups\flecity-live-test\pre-update-2026-11-01T02-28-24-959Z`。リソース70・12ファイルのコピー前後SHA256一致、全DB物理バックアップ627ファイル、prepare成功。隔離MariaDB復元でQBox 187テーブル、WAVE 19テーブルを確認。復旧時はバックアップの対象6既存ファイルを復元し、今回追加した2ファイルだけ現行ハッシュ照合後に取り除き、対象リソースのみtxAdminで再起動する。復旧演習の証跡は同バックアップの `ISOLATED_RESTORE_RESULT.txt`。今回のロールバック実行はNOT_RUN。

## 検証

- LOOP: 登録15ゲーム `quick_tap, stop, stack, block, merge, fall, mines, nonogram, memory, sort, slide, color_match, number_rush, high_low, simon` を4画面寸法でブラウザーNUI起動・画面形状・切替を検査。60画面PASS。ヘッダーとゲーム状態表示が重ならないよう、展開画面の固定状態表示を通常フローへ変更。中央寄せのテトリス盤、タワー、パズル盤のサイズ制御を追加。スクリーンショットは `.flecity-dev/projects/loop/runs/2026-11-01T05-00-02-031Z-34d091/screenshots/`。
- LINK: 登録15ゲーム `code_break, reversi, vote, gomoku, connect4, mini_shogi, word_wolf, liar, draw, telephone, ng_word, fake_answer, bomb, memory_chain, fall_battle` の大画面・スマホ表示と既存の模擬通信操作を検査。264画面の形状記録を含むNUIシナリオPASS。盤面の縦横比と描画領域、対戦画面の幅を調整。スクリーンショットは `.flecity-dev/projects/link/runs/2026-11-01T02-26-31-928Z-3dc9c9/screenshots/`。
- WAVE: 「大画面で開く／スマホへ戻る」、Studio/Library/Home/Search/Profileのレイアウトを実装。390×844、1366×768、1920×1080、2560×1440で各5画面のスマホ・展開、計40画面PASS。模擬NUIでStudio制作タイトルが往復後も維持されることを確認。スクリーンショットは `.flecity-dev/projects/wave/runs/2026-11-01T02-29-06-322Z-5f0af1/screenshots/`。
- WAVE static/JS/Lua構文PASS。LOOPの実Luaロジック、LINK仮想4人テスト、隔離DBテストは今回の全スイートでPASS。全スイートの総合表示には画像比較の承認済み基準なし、FiveMクライアント未自動化等のNOT_RUNが残るため、実機完了とは判定しない。
- FiveMクライアントは起動しているが、今回読み取った画面は接続前のFiveMホームで、アプリ操作はNOT_RUN。ゲーム中の電話操作、WAVEのLB Phone切替・フォーカス、LINK実複数人同期、描画座標、課金・売上処理は実機未確認。NGワード誤判定・復帰不能、お絵描き伝言の実機白紙報告も未解決を維持する。

## Gitと保護対象

WAVE大画面機能とUI検査コードはローカルGit `c81651e` に対象指定で保存。既存の未コミットCSS、運用文書3件、既存の未追跡txAdminレポートはコミットも破棄もしていない。02:00・13:00の定期タスクは変更していない。運営提出可否はNOT_READY。
