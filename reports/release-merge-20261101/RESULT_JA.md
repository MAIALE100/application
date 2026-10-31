# LOOP＋LINK RC1差分統合・更新候補（2026-11-01 JST）

対象はテストサーバーの `flecity_games`。本番、現行テストサーバー、既存DB、元の開発フォルダとバックアップ原本には書き込んでいない。既存02:00・13:00 JST自動開発設定はACTIVEの1件を維持し、Windows側に同名タスクは検出されなかった。

## 基準と変更履歴

基準は `.flecity-dev/projects/link/backups/2026-10-31T22-22-18-816Z-3f765c05/resource` の現行70ファイル。`backup.json` のinventory SHA256は `bef925ff00b380b0a7f4c46e79fb34c308157803f5af00ee0a10ad4ed97fc14b`。隔離復元コピー70件が一致し、作業終了時にも設置先70件が同じことを確認した。

以前の43ファイル照合から変化した**14ファイル全部**について、`D:/FiveM_Dev_Backups/flecity-live-test/20261101-061425-FLECITY-LOOP-LINK-20261101-LIVE-RC1/PREINSTALL_DIFF.csv` の更新前・投入後SHAと一致した。したがって変化の出所はRC1投入である。投入理由を説明する正式な変更記録は同CSVにはなく、下記機能分類は現行コード差分と同梱テストからの推定である。ハッシュと採否の全件は[DECISIONS.json](DECISIONS.json)。

| RC1で変化したファイル | 現行workspaceとの関係 | 差分から読める主な内容 |
|---|---|---|
| `client/main.lua` | 一致 | 大画面ハンドオフ・フォーカス処理 |
| `fxmanifest.lua` | 相違 | 設置先専用 `0.79.6-test-live-rc1` 版名 |
| `server/core/party.lua` | 相違 | 英数字NG語の語境界、伝言座標NaN拒否、説明者向け一致語返却 |
| `server/core/party_plus.lua` | 一致 | LINK＋と共有アプリ境界 |
| `server/main.lua` | 一致 | 共有callback・起動処理 |
| `web/party/app.js` | 相違 | 長い描画の間引き・ポインター識別、白紙再確認、送信応答不明時の更新、LINK＋設定表示 |
| `web/party/fall_battle.js` | 一致 | 対戦操作 |
| `web/party/index.html` | 相違 | 伝言再確認ボタンとLINK＋設定内移動 |
| `web/play/app.js` | 一致 | LOOP画面処理 |
| `web/play/index.html` | 一致 | LOOP画面 |
| `web/shared/app.css` | 相違 | LINK＋を設定内に控えめに表示 |
| `web/shared/bridge.js` | 一致 | NUI通信 |
| `web/shared/controls.js` | 一致 | 共通入力 |
| `web/shared/errors.js` | 相違 | 加入関連の文言をPARTY＋からLINK＋へ変更 |

## 7差異の個別採否

下表は SHA256 の先頭12桁。全文は[DECISIONS.json](DECISIONS.json)。開発側の未コミット変更は `screen.css` のみで、それ以外6件は作業ツリーに未コミット変更がない。

| ファイル | 開発側 | 設置先/70件基準 | 採否・理由 |
|---|---|---|---|
| `fxmanifest.lua` | `1ab2f8b57755` | `c7539afd0ee0` | 設置先RC1を維持。版名と実行資産宣言を旧版へ戻さない |
| `server/core/party.lua` | `f7b62477a568` | `0c62489aa346` | 設置先RC1を維持。NG語・座標の追加修正を失わない |
| `web/party/app.js` | `44e7324524fd` | `d6a698014581` | 設置先RC1を維持。伝言・描画・設定UI修正を失わない |
| `web/party/index.html` | `b047949478ee` | `734afde114bd` | 設置先RC1を維持。JSが使う再確認ボタンを保持 |
| `web/shared/app.css` | `9e7d21ca8ea8` | `ba11f9a77f4e` | 設置先RC1を維持。LINK＋設定内表示を保持 |
| `web/shared/errors.js` | `fd08a8547cf5` | `bb8c19c0ec8` | 設置先RC1を維持。LINK＋文言を保持 |
| `web/shared/screen.css` | **未コミット** `863327c1b0f5` | `e5e93481c1cc` | 大画面バーと本文の分離・スクロール修正だけを隔離候補へ追加。原本は未コミットのまま保護 |

設置先RC1の6ファイルをworkspaceの旧版で上書きしない。候補は**現行70ファイルのコピーを基底に、CSS1ファイルだけを追加**した差分統合である。隔離候補 `.flecity-dev/release-prep/merged-20261101/resource` は70件で、基準との差はこのCSSだけ。候補inventory SHA256 `b1d5339c1c7ac28c13b972a84005f78674bb3ed5dc59b5abfca64c604b77114c`。

## 検証

| 検証 | 結果 |
|---|---|
| 候補同梱Nodeテスト | **20 PASS / 0 FAIL**。初回はテスト側のworkspace相対パス不足で1ファイルを実行できず、既存workspaceと候補overlayを明示して全件再実行PASS |
| 共通基盤 | **128 PASS / 0 FAIL / 0 SKIP** |
| 候補のJS・Lua構文 | JS 12、Lua 16、**失敗0** |
| 候補のmanifestと資産参照 | **PASS**。実依存リソースの動作はNOT_RUN |
| 候補をソースにしたLOOP | static / ブラウザーNUI **PASS** |
| 候補をソースにしたLINK | static / game / 仮想複数人 / ブラウザーNUI **PASS** |
| 候補の使い捨てMariaDB | LOOP・LINKともスキーマ/冪等性/重複拒否 **PASS**。実callbackはNOT_RUNなのでDBスイート全体はNOT_RUN |
| WAVE開発ソース | static / ブラウザーNUI **PASS**。使い捨てDBのDDL **PASS**、実API・課金・既存DBはNOT_RUN |
| 実FiveM、実LB Phone、実複数人 | **NOT_RUN**。更新や再起動は未実施 |

## 更新パッケージと復旧

レビュー用ZIPは `.flecity-dev/release-prep/merged-20261101/flecity_games-CSS-only-REVIEW_REQUIRED.zip`。ZIPには `web/shared/screen.css` と `candidate.json` の2件だけがあり、展開後CSSのSHA256一致を確認。ZIP SHA256は `b7cc328952a638630ebf19001f1f01333cfd6c049e0ac73f1da594cac1b4c045`。**自動適用不可・実機検証前・提出不可**の候補である。

導入時は現行70ファイルSHAが基準と完全一致することを再確認し、更新直前の完全バックアップを取り直す。初回更新承認、権威ある接続0人、依存状態、LOOP＋LINK両アプリのテストと排他を満たす場合に限る。対象は共有リソース `flecity_games` の `web/shared/screen.css` 1ファイル。反映には対象リソースの再起動が必要であり、サーバー全体は再起動しない。再起動直前にも0人を再確認する。

復旧は新しいバックアップのinventory・targetを検証してから、対象リソースが停止中かつ新しい権威ある0人証明がある場合に限り、バックアップ70件を同じ対象へ戻す。戻した全ファイルSHAを照合し、許可された対象だけを再起動する。接続者の増加・証明不明なら更新と復旧を保留して報告する。**今回、コピー・再起動・DB変更は0件。**

WAVEはこのテストサーバーの対象resources下に存在せず、別リソースの初回導入となる。このZIPに混ぜない。WAVEの実課金・権限・実機確認が未完了のため、LOOP＋LINK＋WAVE全体を反映可能とは判定しない。既存の未コミットCSSと運用文書は保持し、コミットしない。
