# WAVE配置調査・更新候補（2026-11-01 JST）

## 実在する配置と差分

最新の開発ソースは専用workspace `wave/`（元フォルダの同パスは存在しない）。現行テストサーバーでは `D:/FiveM_Test_Server/txData/Qbox_D233FD.base/resources/[lb-phone]/wave` に**既に配置**されていた。開始時は双方の12ファイルが全件SHA256一致。今回のローカル修正後、差異は `client/main.lua` 1ファイルのみ。[全件ハッシュと検証記録](VERIFICATION.json)。他の `flecity_wave` 識別子と `wave:purchaseTrack` callbackは現行resourcesのソース検索では検出しなかった。起動済みLB Phoneの登録状態とQBox/oxmysql API互換性は未確認。

WAVEは単独リソース。`fxmanifest.lua` はLua 5.4、`config/shared.lua`、`client/main.lua`、`server/main.lua`、`web/**/*`、`sql/*.sql` を宣言し、`lb-phone`、`oxmysql`、`qbx_core` に依存する。テストサーバー上に3依存リソースのフォルダはある。実稼働状態はNOT_RUN。アプリ識別子 `flecity_wave`、NUI callback `wave:callback`、サーバーcallback `wave:*`。

## 修正と機能調査

- LB Phoneが `APP_ALREADY_EXISTS` を返した場合、旧コードは所有元不明のアプリを `RemoveCustomApp` していた。新版は削除せず登録を保留し、自分が登録できたときだけ停止時に解除する。模擬Lua回帰で衝突・成功両方を検証した。修正はローカルGit `ee88f46`。現行サーバーには未反映。
- Studioの保存・公開、公開停止・再公開、Libraryのプレビュー/購入、15%プラットフォーム分配、財布残高・出金下限、一般ユーザーの管理拒否、ACE管理者操作は実サーバーLuaを模擬依存へ読み込んで検証。実銀行や既存DBには触れない。サブスクは `config/shared.lua` で無効。加入・更新・実視聴はNOT_RUNで、有効なサービスとして報告しない。
- 管理権限は `wave.admin` 等のACE、または設定で許可されたWeazel boss。一般ユーザーの管理callbackは `FORBIDDEN`。実QBoxの権限紐付け・職業状態は実機未確認。
- 起動時 `ensureSchema()` は19件の `CREATE TABLE IF NOT EXISTS` と財布/スキーマ版2件のINSERT/UPDATEを実行する。現行コードにALTER文はないが、既存DBへの効果は未検証。`wave/sql/wave.sql` は説明用SELECTのみで、手動import用DDLではない。SQL・導入境界は[SQL説明](SQL_JA.md)と[導入手順](INSTALL_JA.md)。

## 検証結果

| 検証 | 結果と範囲 |
|---|---|
| 共通基盤 | **130 PASS / 0 FAIL / 0 SKIP** |
| WAVE静的・Lua構文・依存宣言 | **PASS**。実依存API稼働はNOT_RUN |
| WAVEブラウザーNUI | **PASS**。390×844、1366×768、1920×1080、2560×1440のHome/Search/Library/Studio/Profileと入力・配置。実LB Phoneではない |
| Lua模擬callback | **PASS**。保存/公開/公開停止/再公開、購入分配・失敗時返金、出金下限、プレビュー非精算、一般/管理者権限、衝突時のアプリ保護 |
| 使い捨てMariaDB | 実 `server/main.lua` 由来の19 CREATE TABLEを2回適用し、19件・InnoDBを確認 **PASS**。実API/実課金/既存DBはNOT_RUNのためDBスイート全体はNOT_RUN |
| 現行サーバー・複数実クライアント | **NOT_RUN**。更新・起動・再起動は0件 |

既存配置12ファイルを `.flecity-dev/projects/wave/backups/2026-10-31T22-40-04-195Z-b8f42411/resource` に完全コピー。inventory SHA256 `1bf41ce433755084022068e4715e8c76792192302a5ade6cb050d757a7166050`。隔離復元12件と設置先の再照合はPASS。

従来のDBスイートは説明用 `wave/sql/wave.sql` のSELECTを2回実行するだけだったため、DDL検証として不十分だった。アダプターを実Luaの19 CREATE文へ変更し、上記使い捨てDBで再検証した。旧結果を実スキーマのPASS根拠にしない。

## ZIP・導入判断

レビュー用ZIP: `.flecity-dev/releases/wave-20261101/WAVE-0.3.5-test-CLIENT-GUARD-REVIEW_ONLY.zip`。SHA256 `62197625dc82fe91eb2ced4bd73acdcd23990f5604f22848da0ce44740ac39ea`。中身は実行11ファイル、日本語導入書、SQL説明、全件SHA台帳の14エントリ。`.wave-build.txt` は除外。展開して実行11ファイルすべてのSHAを確認した。現行配置からの更新対象は `client/main.lua` のみ。

**現在は導入不可（BLOCKED）**。現行環境には既にWAVEがあり、再起動時にDB初期化処理が走る。今回のDB変更・サーバー反映・再起動禁止を守り、ZIPは適用していない。後日、既存DBの19テーブル/版確認とバックアップ、実銀行・権限・複数クライアント・LB Phone実機の検証計画、権威ある接続0人、初回更新承認をそろえる。LOOP＋LINKの `e401ff7` 統合候補・未コミットCSS・運用文書には触れていない。三アプリ同時導入はNOT_READY。02:00・13:00 JSTの既存自動開発タスクは維持し、新規登録0件。
