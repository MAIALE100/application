# LOOP＋LINK＋WAVE 最終統合準備（2026-11-01 JST）

## 判定

**ローカル導入候補と運営提出確認用ZIPを作成。テストサーバー反映はBLOCKED、運営提出はNOT_READY。** 現行サーバー・DBへのコピー、SQL変更、`refresh` / `ensure` / `restart`、実課金、提出は0件。本番環境は未操作。

設置先のfxmanifest版表示は `flecity_games` が `0.79.6-test-live-rc1`、WAVEが `0.3.5-test`。今回のZIPは未反映なので設置先バージョンは変わっていない。稼働中メタデータと起動ログ・リソースエラーは今回NOT_RUN。

## 差分と安全ゲート

- `flecity_games` 70ファイルはPhase 1の設置先基準SHAと全件一致。固定統合候補との差異は `web/shared/screen.css` のみ。保護中の未コミットCSSのSHAは固定候補と一致し、元ファイルは未変更。
- 固定統合候補とworkspaceソースには16パスの差異がある（候補側だけの9件、内容差7件）。設置先固有修正を含む固定候補を基準にし、workspaceソースで単純上書きしていない。コード由来の最終監査は未完了。
- WAVEは現行12ファイルのうち実行11ファイルを照合し、候補との差異は `client/main.lua` のみ。他の設置先固有ファイルと `.wave-build.txt` は保持。
- LB Phone識別子 `flecity_play` / `flecity_party` / `flecity_wave` とcallback名前空間はソース上で衝突なし。実登録済み状態は未確認。
- 現行WAVEは起動時に19件の `CREATE TABLE IF NOT EXISTS` と2件のシード書込みを行う。Phase 1の全DB物理バックアップと隔離復元はPASS。ただし今回の更新直前バックアップと現行DBの読み取り専用差分照合は未実施。
- 公開 `players.json` と `dynamic.json` は観測時0人。設置済みブリッジは更新時点に紐付くネイティブ人数証明を出せず、`UPDATE_POLICY.json` は disabled。公開人数だけで既存の実機更新安全条件を通さない。新しい更新直前バックアップ、コピー、再起動は未実施。

## 確認用パッケージ

- テストサーバー差分更新案: CSSとWAVE client Luaの2ファイル。設置先固有の残り80ファイルは更新対象外。現行DBや設定を同梱しない。
- この時点のテスト更新確認用ZIP v2は後続の基準SHA再検査でWAVEの旧ファイルSHAに誤りを発見したため**使用禁止**。修正版v3と理由は [後続レポート](../test-deploy-improvement-20261101/RESULT_JA.md)を参照する。
- 運営向け初回導入案: 固定候補の `flecity_games` から実行45ファイル、WAVEから実行11ファイルを抽出。開発用リロードスクリプト・トークン・ビルド/実行マーカー、テスト・ツール・現行DB/バックアップ・認証情報は除外。共有リソースの `fxmanifest.lua` から除外済みdev reload参照のみ削除。価格・権限・収益設定は未変更。テスト用版表示を維持し、最終提出品とは呼ばない。
- 初回導入確認用ZIP: `.flecity-dev/releases/final-prep-20261101/FLECITY-LOOP-LINK-WAVE-INITIAL-INSTALL-REVIEW_ONLY-v3.zip`、SHA256 `f643330b6080263eb5b6ff2b8a43a323bdd6de3c2f672d51b9278e1a3857b99a`。展開後60ファイルのSHA照合PASS。最新レポートはZIP外の本書。旧ZIPは検査履歴として保持するが使用しない。
- 日本語[初回導入](INSTALL_JA.md)、[操作・設定・コマンド](OPERATIONS_JA.md)、[未解決項目](ISSUES_JA.md)、ファイル別SHA一覧を添付。

## テスト

パッケージの新しいバイトに対し、LOOP static/NUI、LINK static/game/virtual-multiplayer/NUI、WAVE static/NUIの8スイートが**全件PASS**。共有リソースのパッケージinventory SHAは `8c948b39a45b324a7180cd8807c011c93b8344d6e6ecbc23f36fa5d18b6f5bb7`、WAVEは `e05192bf15a9e5ce0be73e560dc5d8e413dfac62af94e739c8d1ba6136cbe1b6`。ゲーム・仮想複数人・ブラウザー検証を実機テストと混同しない。Phase 1の隔離DB結果は再利用したが、今回のパッケージを実DBで起動していない。

## 残作業

ネイティブな0人証明と更新アダプター、更新直前の新規全DB/両リソースバックアップと復元確認、現行DB差分、対象2ファイルの安全適用、対象だけの再起動、起動ログ、LOOP全ゲーム・LINK実複数人・WAVE実LB Phone/課金権限の実機検証が残る。NGワードとお絵描き伝言の実機報告は未解決のまま保持する。実機検証後に版番号と提出ZIPを再確定する。

保護中の未コミットCSSと運用文書3件には触れず、02:00・13:00の既存タスクも変更していない。
