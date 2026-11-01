# LOOP・LINK・WAVE 安定化結果（2026-11-02）

## 判定

- テストサーバー `MAIALE100_Test_01` への対象限定反映: **PASS**。`flecity_games` の5ファイルを更新し、txAdminで同リソースを1回再起動した。WAVEは今回の追加コピー・再起動なし。現行WAVEは修正済みローカルソースとSHA256一致。
- LOOP・LINKのNUI回帰とWAVEのNUI回帰: **PASS**。ブラウザー／Lua模擬検証であり、実クライアントの操作と同一視しない。
- 運営提出: **NOT_READY**。最新差分のFiveM実クライアントでの長時間テトリス、複数クライアント、NGワード実機誤判定、WAVEのLibrary復帰と収益処理が未確認。

## 差分の統合と修正

作業開始時にGit、保護中CSS・文書、現行リソース、直近バックアップを照合。設置先のほうが新しかったゲーム本体・LINK AI参加・UI・テストの修正をローカルへ取り込んだ。保護中 `web/shared/screen.css` は既存変更を残して統合し、提出ボタンが大画面の下へ押し出される伝言キャンバスの高さを追加調整した。元フォルダ、他リソース、定期タスクは変更していない。

テトリスでは、LOOPの起動時 `clearStatus` 未定義を修正し、描画・入力・重力タイマーの計測を追加。遅延時の落下追いつき量を制限し、LINKの落下位置計算をキャッシュ、重力時刻を実経過時間に合わせた。LINKの10秒ルーム更新で対戦タイマーを停止・再作成しないようにした。両アプリのA/D・左右、W・上、S・Space、下、C・Shiftの操作と入力欄フォーカス除外を回帰確認した。自動保存の非同期合流は設置先の実装を保持した。

WAVEは前段の大画面Studio／Library引継ぎ修正を保持。`APP_SUSPENDED` の原因は、スマホ復帰時にLibrary再取得が停止状態のまま開始した順序であり、復帰フェーズをactiveにしてから画面と再取得を復元するようにした。最新修正後のブラウザー検証はPASS。最新修正後のFiveM実機でのLibrary往復は **NOT_RUN**。

LINKのNGワードAIヒント候補・連発抑制、描画AI、人数・ON/OFFの設置先修正を保全。禁止語誤判定とキャラクター復帰の旧実機報告は、実機での再現・解消確認がないため **未解決扱い**。販売・銀行・価格・権限・DBスキーマは変更なし。

## 検証

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 共通基盤 | PASS 145/145 | Nodeテスト。初回失敗2件は、計測APIのVM互換と4人ルームfixtureのゲーム選択順を修正して再実行 |
| flecity_games固有 | PASS 20/20 | 描画中断、伝言送信、状態引継ぎ、Luaクライアントを含む |
| LOOP NUI | PASS | 全登録ゲームの画面・操作fixture、50回の開始／終了、入力、サイズ切替 |
| LINK NUI | PASS | 全登録ゲームの画面fixture、50回のルーム再描画、タイマー重複なし、仮想ハンドラー |
| WAVE NUI | PASS | Studio・Library、スマホ／大画面往復、フォーカス復帰fixture |
| テトリス実時間10分 | PASS | ブラウザー模擬NUI、2,240落下、160再開始、終了後タイマー0・入力バインド1。平均入力0.39ms、最大0.80ms、描画計測平均0.21ms、最大1.60ms。JSヒープ3.42→4.91 MB。FiveM実機の負荷値ではない |
| 多人数 | PASS（模擬） | 実Luaルームハンドラーで48仮想プレイヤー／12ルーム＋4 AIルーム／AI8人。終了後ルーム・メンバー0、ピークLua約935 KB、保持増約13 KB。実48クライアントはNOT_RUN |
| JS/Lua構文 | PASS | 変更対象JSとLua |
| FiveM実機での最新UI操作 | NOT_RUN | テスターの実操作が必要。ブラウザーPASSで代用しない |

測定記録: `.flecity-dev/projects/loop/runs/2026-11-01T18-00-54-853Z-ffeab2/tetris-longrun.json`。各NUI実行記録は `.flecity-dev/projects/{loop,link,wave}/runs/` に保存。

## 更新と復旧

- 更新直前バックアップ: `D:\FiveM_Dev_Backups\flecity-live-test\pre-update-2026-11-01T18-15-15-795Z`。`flecity_games` 70、`wave` 14、DB物理627ファイル。両リソースの前後SHA256一致、DBバックアップの完了記録あり。隔離復元済みのPhase 1手順・証跡を復旧方法の基準とし、今回の新規DBバックアップの隔離復元は **NOT_RUN**。
- 更新ファイルと更新前後SHA256: `.flecity-dev/releases/stabilize-20261102/MANIFEST.json`。`web/play/app.js`、`web/party/app.js`、`web/party/fall_battle.js`、`web/shared/controls.js`、`web/shared/screen.css` の5件。適用後すべて一致。製品ファイルは `flecity_games` 59件、WAVE 13件がローカル・設置先で一致。設置先のテスト・運用専用ファイルは保持。
- txAdmin: 対象名 `MAIALE100_Test_01`、接続者1人を確認してから、Resources画面で `flecity_games` のRestartを1回実行。`fxserver.log` に停止→開始、DB schema ready、LB Phone callbacks 55/55、`READY_FOR_LIVE_TEST` を確認。新規のflecity_games起動重大エラーは検出なし。WAVEは起動状態でcallbacks 33/33、`READY_FOR_TEST` の既存ログを確認。FXServer全体の再起動なし。
- ロールバック可能: 上記バックアップから5ファイルだけ戻してSHA256を照合し、`flecity_games` だけを再起動する。DBの取引が発生した後のDB全体復元は、プレイヤーデータへの影響を確認する別手順で実施。今回DBマイグレーションなし。

## 残る確認

1. FiveM実クライアントでLOOP・LINKテトリスを10分以上操作し、入力・落下遅延とスマホ／大画面往復を観測する。
2. 2〜4人の実クライアントでLINKのルーム、切断・再入室、AI混在、NGワード誤判定と身体状態復帰、伝言の描画・結果順序を確認する。
3. WAVE StudioとLibraryの往復、再入場とEscを最新コードで実操作し、`APP_SUSPENDED` が再発しないことを確認する。購入・受取は実口座を使わず隔離データで確認する。
4. qbx_coreで以前から観測されるWeazel grade 0への支払いエラーは今回の変更とは別件。WAVE収益動作の提出判定前に管理者が確認する。

提出ZIPは初回導入用の**REVIEW_ONLY**。必要な実機確認と重大不具合の解決前に運営提出しない。
