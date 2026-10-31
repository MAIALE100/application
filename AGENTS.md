# Flecity local development

- この専用環境の最新運用は `devtools/flecity/NEXT_SESSION_JA.md` と `MIGRATION_STATE.json`。プリフォトのみ移行・編集・追加・削除・自動検証をPAUSEDとし、他アプリと共通基盤は独立して継続する。
- GitHub禁止のユーザー指示は、取り込みソース内の古いPR/Actions指示より優先する。元フォルダの作業ファイル・バックアップ・既存サーバー・既存DBを変更しない。

- 新規FiveMリソースは、最初に [FLECITY_DEVELOPMENT.md](FLECITY_DEVELOPMENT.md) を読み、既存の共通基盤を優先利用する。
- 単純な入口は flecity.cmd。共通実装は devtools/flecity、個別の検証は adapters / project-tests / 各リソースの tests に置く。
- 下位リソースに AGENTS.md があれば併せて読む。既存の未コミット変更を保持し、他アプリを変更しない。
- 本番接続、稼働DBでの破壊的試験、全サーバー再起動は禁止。DB故障注入は共通基盤の専用DBのみで実行する。
- LOOPとLINKは flecity_games を共有する。別アプリ単位で再起動できると扱わない。
- PASS・FAIL・NOT_RUN・BLOCKEDを明示する。SQL直接検査、Lua mock、NUIソース検査は実機検証と区別する。
- 設定・収集ログ・画面・バックアップ・ローカルGit履歴は .flecity-dev/ に保存し、コミット対象から除外する。
- 新規の更新処理を作る前に共通の backup / plan / apply を検討する。既存の個別アップデーターを共通テストから呼ばない。
- 現行方針は既存の D:\FiveM_Test_Server を利用する。別FXServerの起動とライセンスキーの表示・コピー・変更は禁止。lab起動経路は廃止済み。
- 実リソースの初回導入・更新・再起動は、対象と復旧手順を提示して明示承認を受ける。接続者がいる、APIが不一致、観測が古い場合は変更を保留する。
- game_preflightはDB Ensureを呼ぶため読み取りチェックとして自動実行しない。既存データ削除・破壊的DB試験は禁止し、破壊試験は専用の使い捨てDBだけで行う。
