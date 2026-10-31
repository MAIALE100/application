# 継続状態（2026-10-31・アプリ別運用）

作業先: D:/FiveM_AutoDev/workspace-clean。マスター指示書と最新のユーザー指示を読む。
最新追加: SERVER_AUTOMATION_SAFETY_JA.mdとUPDATE_POLICY.json。ローカル検証はサーバー状態と分離し、公開状態は最後に観測する。全リソースの実自動反映は未承認・無効。
接続増加時の中断・復旧ゲートは一時fixtureで検証。ネイティブ人数観測を含むブリッジ案はworkspace内だけで、実配置・リソース再起動アダプターは未有効・未実装。初回更新の具体的な承認前に実行しない。
SQLは既存D:/MariaDB/binから固有named pipe/TCP無効の使い捨てDBのみ。承認済み画像なしの比較や未登録シナリオはNOT_RUN。
旧reports/migration-20261031/RESULT_JA.mdの「全体BLOCKED」は初回調査の履歴。現在はプリフォトのみPAUSED。

- 方針: MIGRATION_STATE.json。最新アプリ別結果: .flecity-dev/automation/latest.json。個別証跡: .flecity-dev/projects/<id>/。
- BASE: 23ファイルの候補をflecity_baseへ新規取り込み。正式最新ブランチとの同一性は未保証。
- LINK/LOOP: 検査用55ファイルをflecity_sources/flecity_gamesへ新規取り込み、両台帳をこの共有先へ統一。旧ルートflecity_gamesは保持。トークン・リロード状態6ファイルは未コピー。
- WAVE: 12ファイルをwaveへ。フレプリ: 24ファイルをpuriboothへ。新規パスのみ、バックアップとSHA-256一致、機密候補検査済み。
- プリフォト: 既存8変更・新規5・削除候補242を不承認として保護。移行・編集・追加・削除・自動検証を実施しない。分類はreports/independent-20261031/PURIPHOTO_DIFF_JA.md。
- 242候補は配布用生成資産だが現行HTML/CSS参照が全件ある。不要と扱わない。
- 元のlocal.json、DB/サーバー設定、承認記録はコピーしていない。Luaは新環境の無視対象へ検証コピー、既存Playwright/Chromeを設定。元の共通64テストは64 PASS / 0 FAIL / 0 SKIP。
- 定期実行は安全な検証継続モード。powershell -NoProfile -ExecutionPolicy Bypass -File devtools/flecity/automation-run.ps1 を実行する。ソース自動修正・自動配置は含まない。
- OS mutexが全実行を保護。アプリ単位の失敗・バックオフを保存し、他アプリを継続。20分上限と証跡容量・期間制御あり。
- GitHub・fetch/pull/push/PR・git reset --hard・git clean・git add -Aは禁止。元フォルダの作業ファイル・バックアップ・サーバー・既存DBを変更しない。
- 次: BASEの権限/トランザクション、LINK/LOOPの同期・低FPSの安全なモック検証を優先。ソース修正は別の明示対象タスクで狭い差分・回帰・ローカル保存を行う。
