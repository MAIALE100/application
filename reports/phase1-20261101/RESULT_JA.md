# LOOP＋LINK＋WAVE Phase 1 完了報告（2026-11-01 JST）

## 判定

**Phase 1 PASS。Phase 2の実機反映は未実施。** 現行DBへの書込み、現行リソースへのコピー、SQLマイグレーション、`refresh` / `ensure` / `restart`、FXServerとMariaDBサービスの停止・再起動は0件。本番環境は未操作。保護中の未コミットCSS・文書3件は未変更・未コミット。既存02:00・13:00タスクはACTIVEのまま変更なし。

## 作業開始時点

- Git: `codex/flecity-autodev-migration-20261031`、HEAD `8463ef8`。既存未コミットは `devtools/flecity/DAILY_REPORT_JA.md`、`NEXT_SESSION_JA.md`、`RESOURCE_REGISTRY_MIGRATION_JA.md`、`flecity_sources/flecity_games/web/shared/screen.css` の4件。未追跡なし。
- `Flecity_PRELIVE_BACKUP_20261101.ps1` は調査範囲で確認できず。既存の共通 `backupTree` とMariaDB付属 `mariadb-backup`、`mariadb-dump` を使用。
- 既存05:01時点のDBダンプと隔離復元記録、統合候補ZIP、直近のLOOP・LINK・WAVEテスト記録を再確認。過去のDBスナップショットを今回の最新バックアップに代用していない。
- MariaDBサービスは稼働、12.3.3。公開 `players.json` と `dynamic.json` は調査時0人。公開情報はPhase 2の更新許可に使わない。txAdmin画面操作は実施せず。

## バックアップ保存先

`D:\FiveM_Dev_Backups\flecity-live-test\phase1-2026-10-31T23-40-29-609Z-7405d02f`

| 内容 | 結果 |
|---|---|
| 全DB物理バックアップ | **PASS**。`db-physical/` に627ファイル・84,491,030バイト。`mariadb-backup --backup --lock-ddl-per-table` の完了ログあり。BACKUP STAGE BLOCK_DDL中に非InnoDBファイルを保全し、エラー行0件 |
| 全DB保存アーカイブ | **PASS**。`DB_FULL_PHYSICAL.tar`、84,925,440バイト、SHA256 `384fc336c7a0205d6145803aae0863dc9d4dfc678504279f3828894aeef0380b`。627ファイルを収録 |
| QBox追加SQLバックアップ | **PASS**。QBox 187テーブル全件InnoDBを確認後、`--single-transaction --routines --triggers --events` で `QBOX_SINGLE_TRANSACTION.sql` を取得。465,822バイト、SHA256 `ba592369e9d7288e4d4b066534c1a48e3babe3a8fd961d952d0e4fdb80b21213`。前後のカラム定義SHAは一致 |
| LOOP＋LINK全体 | **PASS**。`flecity_games` 70件。コピー前後と再照合時の相対パス・SHA256が全件一致。inventory SHA256 `bef925ff00b380b0a7f4c46e79fb34c308157803f5af00ee0a10ad4ed97fc14b`。`runtime-active.txt` を含み、除外なし |
| WAVE全体 | **PASS**。`wave` 12件。コピー前後と再照合時の相対パス・SHA256が全件一致。inventory SHA256 `1bf41ce433755084022068e4715e8c76792192302a5ade6cb050d757a7166050`。`.wave-build.txt` を含み、除外なし |

全リソースのファイル別SHA256は[RESOURCE_MANIFEST.json](RESOURCE_MANIFEST.json)。不足・余分・ハッシュ不一致は0件。DBバックアップの詳細は[DB_BACKUP_META.json](DB_BACKUP_META.json)と[QBOX_LOGICAL_META.json](QBOX_LOGICAL_META.json)。実データ、銀行残高、接続情報、パスワードはレポートに記載していない。

## 隔離復元

**PASS。** 全DB物理バックアップのコピーを別datadirでprepareし、`D:\MariaDB\bin\mariadbd.exe` を127.0.0.1:3307で起動。接続先の `@@datadir`・`@@port`、PID、実行ファイル、起動引数、ポート所有PIDの一致をSQL操作前に確認。4件のrootホストアカウントを隔離環境だけで新しい独立パスワードへ切り替え、そのパスワードで再接続を確認した。現行MariaDBは3306で稼働を継続。

復元結果は6データベース、QBox **187テーブル**、WAVE **19テーブル**、routines **51件**、triggers **31件**、events **0件**。WAVE 19テーブルの `CHECK TABLE` は全件OK。主要テーブルの行数は[DB_RESTORE_RESULT_4.json](DB_RESTORE_RESULT_4.json)に保存。復元エラー0件。[prepareログ](DB_PREPARE_LOG.txt)と[停止記録](DB_RESTORE_SHUTDOWN_4.json)を保存。隔離プロセスだけを正常停止し、3307の待受と対象PIDの終了を確認した。初期試行では独立rootパスワードの確認が失敗したが、全rootホストを対象にして再試行し、最終検証はPASS。失敗した隔離コピーは調査証跡として保存し、その復元操作は現行DBへ向けていない。

## 統合候補の再照合

統合ZIP `LOOP-LINK-WAVE-REVIEW_ONLY.zip` はSHA256 `35b1b6da659271fda17cf20d440271f8fd59be03e0bdb630f8b3bbf909e9d9f9` と一致。新規展開で外側5件、CSS子ZIP2件、WAVE子ZIP14件のパス・SHAを検証し、更新対象CSSとWAVE client Luaのハッシュがマニフェストと一致した。[ZIP_VERIFICATION.json](ZIP_VERIFICATION.json)。

候補ソースのinventory SHAは `flecity_games` が `b1d5339c1c7ac28c13b972a84005f78674bb3ed5dc59b5abfca64c604b77114c`、WAVEが `e93f2ab1ea6f1bad756cb8f5634b159cb008796133be456a9245ff1df26dea01`。直近のLOOP静的/NUI、LINK静的・ゲーム・仮想複数人・NUI、WAVE静的/NUIの計8スイートはすべてこのSHAでPASSし、JS/Lua構文検査を含む既存の証跡を再利用した。同一バイトのテストを理由なく再実行していない。SQLは今回の全DB物理復元とQBox SQLバックアップの検査で確認。実機操作・実課金・実複数クライアント試験はPhase 2に残す。

## Phase 2への状態

Phase 1の必須7項目（全DBバックアップ、隔離復元、両リソース全件バックアップ、SHA照合、統合候補照合、既存変更保護）はPASS。**Phase 2の準備資料として使用可能**。ただし、このバックアップを更新直前の新規バックアップの代わりにしない。Phase 2開始時に新しい全DB・両リソースバックアップ、現行差分の再照合、txAdminと権威ある接続0人確認を行い、対象リソースだけの反映・再起動を別の安全ゲートで判断する。今回のPhase 1完了はPhase 2実施の承認を意味しない。
