# 新環境移行の安全確認結果

2026-10-31 日本時間。**全体: BLOCKED（上書き差分の採用判断待ち）**。

## 今日やったこと

- マスター指示書、旧環境のAGENTS、既存実装報告、リソース台帳、実設定が参照する検査用ソースを調査。
- 新旧とも開始時HEADは `10dfa3a43c63dd9b939a8bd66efb4d2387044a9a`。旧は `jobs/mining-dev`、新はdetached HEADだった。
- 新環境用ブランチ `codex/flecity-autodev-migration-20261031` を作成。共有Gitにブランチを追加したが旧ブランチのHEADは変更していない。
- 元フォルダの460件を一覧化。元だけにあるファイル210件、内容差9件を検出（依存・ローカル状態を除く初期比較）。内容差があるためアプリコードの移行は停止。
- 上書き不要の `AGENTS.md`、`devtools/AGENTS.md`、`FLECITY_DEVELOPMENT.md`、`flecity.cmd` の4ファイルのみ旧環境から追加。既にコピーされていた共通ツールを再利用。
- 新規 `.flecity-dev/.gitignore` で設定・ログ等の除外を確認。既存ルート `.gitignore` は編集していない。
- 既存の定期実行を新プロジェクトに移しPAUSEDへ更新。重複登録なし。

## アプリ別の最新コード確認

| 対象 | 結果 |
| --- | --- |
| BASE | 未移行。実設定は23ファイルの候補版を指定。古いsources/baseとは異なる。正式最新checkoutとの同一性も未確定 |
| LINK | ルートflecity_gamesは新旧一致。ただし旧環境でテスト済みの61ファイルのLINKコピーは未移行 |
| LOOP | ルート版は新旧一致。LINKと同じリソースを使う統一版の検証は未完了 |
| WAVE | 検査用12ファイルが旧環境内に存在、新環境にはない |
| フレプリ | puriboothの24ファイルが新環境にない |
| プリフォト | 既存8ファイルの内容差、旧側だけ5ファイル、新側だけ旧ビルド242ファイル。更新を一体としてレビューする必要あり |

全体として「最新コードが揃った」とは認定できない。詳しいソース位置はRESOURCE_REGISTRY_MIGRATION_JA.md。

## 元環境だけの変更と停止対象

完全なGit状態は `inventory.json` の originalStatus（460件）。初期のファイル比較は `original-only-changes.tsv`。
依存ディレクトリnode_modules、Git管理領域、.vite、.flecity-devは通常比較から除外。除外パスもinventory.jsonに記録。
.flecity-devの全体はコピーせず、実設定で選ばれていたBASE/LINK/WAVE/miningソースだけ別途ハッシュ照合した。

無断上書き禁止に該当する9ファイル:

- `.gitignore`
- `puriphoto/README.md`
- `puriphoto/config.lua`
- `puriphoto/fxmanifest.lua`
- `puriphoto/ui/dist/index.html`
- `puriphoto/ui/package-lock.json`
- `puriphoto/ui/package.json`
- `puriphoto/ui/src/App.css`
- `puriphoto/ui/src/App.tsx`

これらは同じHEADからの旧作業ツリー更新であり、新側で別々に変更されたGitマージ競合とは断定しない。しかし利用者の「既存ファイルを無断で上書きしない」という条件に従って停止した。
初期比較で旧側だけの210件と内容差9件は、指定バックアップとすべてSHA-256一致。
そのうち開発ルールと入口の4件だけを新規追加済み。残りのアプリ・アーカイブ・アップデーター・テンプレート・設定等は引き継いでいない。
`.three-apps.local.json`、既存local.json、資格情報、承認記録は未コピー。秘密情報を含む可能性のある実設定をGitへ保存していない。

## 検証結果

- 共通基盤T0/T1・オフラインfixture: `node --test devtools/flecity/tests/*.test.mjs`。
- **64件中58 PASS / 0 FAIL / 6 SKIP / 0 cancelled**。終了コード0。
- SKIP: ブラウザー2件、Lua構文・ポリシー・ゲームAPI関連4件。新環境に依存設定がないため。
- 正確な集計: `verification.json`。生ログ: `.flecity-dev/migration-20261031/tests.tap`（Git対象外）。
- オフラインfixtureによる更新失敗・復旧試験はPASS。指定バックアップの完全復元はNOT RUN。
- BASE/LINKアプリ本体の回帰はNOT RUN。過去の成功を今回の成功として流用していない。
- ブラウザー、実FiveM、複数クライアントはNOT RUN。画面比較なし。
- Git差分の空白検査と、ツール内の秘密情報候補の検索を実施。検索該当はマスキング実装と合成テスト文字列。元環境の実設定はコミット対象外。
- 元フォルダのGit状態を終了前に照合、460件の内容（状態とパス）が初期状態と一致。

## 現在のサーバー状態

今回は稼働状態を再観測していない。サーバー・リソース更新、再起動、既存DB接続・変更は実施していない。
GitHub、ネットワークfetch/pull/push、既存変更の破棄は禁止どおり未実施。

## 次回実行予定・継続タスク

既存ID `flecity-02-00-13-00-jst` の対象を新プロジェクトへ変更済み。02:00・13:00 JSTの設定は維持し、現在PAUSED。有効な次回予定はない。
モデルは既存設定gpt-6-luna/lowを維持。自動モデル切替、Claude API、実モデル実行の可否検証は未実施。
強制ロック・20分制限・連続失敗制御・ログ容量制御は未実装。安全なドライランと合わせて再開前に整える。
PC電源・ログオン・アプリ起動が必要な運用条件の確認も再開時に行う。

## 利用者に必要な判断

**旧環境のプリフォト更新を採用するか**を判断する。採用範囲は上記プリフォト8ファイル、旧側だけの5ファイル、旧ビルド242ファイルの削除候補を一体としたレビューが必要。
ルート.gitignoreの追加3行と、BASE候補・LINK/WAVE検査コピー・フレプリの新規移行も、内容・機密情報を確認して続行する。
この判断前に定期実行を有効化しない。ユーザーによるファイルの手作業上書きは不要。

コミットSHAは `git log -1 --oneline` で確認。本報告を含む共通基盤・安全文書のみを明示ファイル一覧で保存し、アプリ本体を含めない。
