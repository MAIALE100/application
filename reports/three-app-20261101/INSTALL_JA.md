# LOOP＋LINK＋WAVE 統合導入候補（レビュー専用）

**現行サーバーへのコピー・DB書込み・再起動は今回行わない。** この文書とZIPは導入時の照合資料であり、実行許可ではない。LOOPとLINKは同じ `flecity_games` を共有し、WAVEは `[lb-phone]/wave` の独立リソース。

## 対象・順序

| アプリ | リソース | 現行バックアップ | 更新対象 | 維持するもの |
|---|---|---|---|---|
| LOOP | `flecity_games` | `.flecity-dev/projects/link/backups/2026-10-31T22-22-18-816Z-3f765c05` | `web/shared/screen.css` | 設置先RC1の他69ファイル、既存DB・セッション |
| LINK | 同じ `flecity_games` | 同上 | 同じCSSを1回だけ更新 | NGワード・描画・LINK＋を含むRC1修正 |
| WAVE | `wave` | `.flecity-dev/projects/wave/backups/2026-10-31T22-40-04-195Z-b8f42411` | `client/main.lua` | 他10実行ファイルと `.wave-build.txt`、既存DB・課金履歴 |

[SHA256マニフェスト](MANIFEST.json)に設置先バックアップ70ファイル、WAVE実行11ファイル、候補ハッシュ、ZIPハッシュを記録。更新差分は上記2ファイルに限定する。`flecity_games` のCSSは保護中の未コミット変更であり、元のworkspaceファイルは未コミットのまま維持する。BASE、プリフォト、フレプリ、Photo Diary、本番、他リソースは対象外。

## server.cfgと依存

マニフェストの `files` は現行設置先の基準SHA、`candidateUpdates` は更新後の2ファイルのSHAを表す。適用時は両方を照合する。

既存テストサーバーには両リソースが**既に配置**されているため、新しい `ensure` 行を無条件に追加しない。未設置環境でのみ、`oxmysql` → `qbx_core` → `lb-phone` → `flecity_games` と `wave` の順に各1回起動する。既存グループ（例 `ensure [lb-phone]`）がWAVEを起動するなら `ensure wave` を重複追加しない。現在のserver.cfg編集は0件。

識別子はLOOP `flecity_play`、LINK `flecity_party`、WAVE `flecity_wave`。NUI callbackは `flecityGames:callback` と `wave:callback`、LB Phone callbackも `flecity_games:*` と `wave:*` で重複なし。実LB Phoneの登録済み状態は未確認。

## DBと承認境界

WAVEは起動時に19件の `CREATE TABLE IF NOT EXISTS` と2件の財布/スキーマ版書込みを実行する。2026-11-01 05:01 JSTの完全DBダンプをネットワーク無効の隔離MariaDBに復元し、187テーブル中WAVE19テーブルの118カラム・70インデックス列が実DDLと一致した。実際の初期化SQLを隔離コピーで実行してもWAVE全テーブルの行数・チェックサムは不変。模擬購入5,000の4,250/750分配と条件付き出金更新をROLLBACKし、全チェックサムが復帰した。

**この結果はダンプ時点のDBに限定される。** 現在稼働中のDBへは接続せず、現行スキーマ・行内容は未確認。実銀行返金、実購入、管理権限、サブスク（現行設定では無効）、実クライアント同期も未検証。現在のDB変更禁止の下では、WAVEの起動・再起動を行わない。

## 将来の更新・復旧手順（今回は未実施）

1. 現行の設置先70/12ファイルとDBを読み取り専用で再監査し、マニフェストのSHAと相違があればこの候補を破棄する。更新直前に各リソース全体とDBの新しいバックアップを作り、隔離復元を演習する。
2. LOOP＋LINKとWAVEの必須回帰、実LB Phone・複数クライアント・課金/権限検証計画、初回更新の明示承認、権威ある接続0人、依存・排他を確認する。更新直前と各対象リソース再起動直前に0人と同一サーバーインスタンスを再確認する。確認不能・接続増加なら中止。
3. `flecity_games` はCSS1ファイルのみ、`wave` はclient Lua1ファイルのみ、対象別に既存の `backup/plan/apply` 安全経路で反映する。共有リソース `flecity_games` の再起動はLOOP＋LINK両方に影響する。サーバー全体と他リソースは再起動しない。WAVEは起動時DB書込みを行うためDBゲートを別途満たす。
4. 失敗時は新しいバックアップと対象ハッシュを再確認し、対象リソース停止・権威ある0人の下で対象ごとに元ファイルへ戻す。WAVEのDB書込みや実取引が生じた場合、ファイルだけでなくDB専用の復旧計画を適用する。既存プレイヤーデータやWAVEの購入・収益テーブルを無断削除しない。

今回のパッケージは**REVIEW_ONLY**。ライブDB・実機・初回反映の条件が未完了であり、提出候補や自動適用可能とは判定しない。
