# 3アプリ統合前の最終整合性検査（2026-11-01 JST）

## 判定

**レビュー用導入候補を作成。実反映はBLOCKED。** 現行FiveMサーバーへのコピー、DB書込み、リソース再起動、実課金、運営提出は0件。LOOP＋LINKは共有 `flecity_games` のe401ff7由来の統合候補を維持し、WAVEの収益分配・管理権限仕様を変更していない。保護中の未コミットCSSと運用文書3件は未変更・未ステージ。

## ファイルと差分

| リソース | 現行全件 | 開発候補との差異 | 更新対象 | 保護するもの |
|---|---:|---|---|---|
| `flecity_games`（LOOP＋LINK） | 70 | `web/shared/screen.css` のみ | CSS 1件 | 他69件、設置先RC1修正、既存DB |
| `wave` | 12 | `client/main.lua` のみ | Lua 1件 | 他10実行ファイル、`.wave-build.txt`、既存DB |

現行ファイルを今回再ハッシュし、`flecity_games` 70件がマニフェストの基準SHAと一致、WAVE 11実行ファイルは上記1件のみ候補との差異。WAVEの旧 `APP_ALREADY_EXISTS` 処理は所有元不明のアプリを削除し得た。候補は削除を行わず、自身が登録した場合に限り終了時解除する。Lua模擬で登録成功と識別子衝突を回帰済み。現行サーバーへの反映はない。

## DB

2026-11-01 05:01 JSTの完全DBダンプ（SHA256 `5ebda6b0dc2c9aacf0fbc8dbc7efe8b288fcb0475f40f48bb8f7e9342b1aff34`）を、TCPを無効にした隔離MariaDBへ復元。187テーブル中WAVE 19テーブルについて、実ソースのDDLと118カラム・70インデックス列の定義SHAが一致。実 `ensureSchema` の19 CREATEと2シードSQLを実行し、WAVE全19テーブルの行数・チェックサムが不変。隔離コピーで模擬購入5,000の4,250/750分配、条件付き出金更新、ROLLBACKを確認し、全チェックサムが元に戻った。監査記録は `.flecity-dev/projects/wave/runs/2026-10-31T22-57-11-737Z-618602/wave-db-copy-audit.json`。

この結果は**ダンプ時点だけ**に適用する。現行稼働DBの読み取り専用接続は今回行っておらず、現在のスキーマ・データはNOT_RUN。既存データ全体の無損失は推定しない。実購入・返金・売上受取・サブスクはローカルLua模擬の範囲のみ。サブスクは現行設定で無効。実銀行・権限・LB Phoneの稼働APIは実機未確認。

## ローカル回帰

- 共通基盤: **131 PASS / 0 FAIL / 0 SKIP**。新規の3アプリ識別子・callback衝突テストを含む。
- LOOP＋LINK固定候補: 静的検査、15＋15登録ゲームのNUI、LINKゲームロジックと仮想複数人テストがPASS。ブラウザー画面は390×844、1366×768、1920×1080、2560×1440。実LB Phoneと実クライアント2〜4人はNOT_RUN。
- WAVE: 静的検査、Studio/Libraryを含むブラウザーNUI4画面幅、Lua模擬の公開・再公開・購入/返金・売上受取・権限がPASS。隔離DBの実DDL・初期化・ROLLBACKがPASS。実機支払いはNOT_RUN。
- 配置済みソースの識別子は `flecity_play`、`flecity_party`、`flecity_wave`。NUI callbackおよびサーバーcallback名前空間はソース上で重複なし。稼働中LB Phoneの登録状態はNOT_RUN。

## パッケージと残条件

[導入手順](INSTALL_JA.md)、[SHA256一覧](MANIFEST.json)、子ZIP2件を含むレビュー用統合ZIPを `.flecity-dev/releases/three-app-20261101/` に保存。ZIPの中身と子ZIP SHAを展開検査した。更新対象は上記2ファイルだけであり、BASE・プリフォト・フレプリ・Photo Diary、本番、既存DB、他のリソースは変更対象外。

導入前に必要: 現行DBの読み取り専用スキーマ照合、新しいサーバー全体・DBバックアップと隔離復元、実LB Phone/複数クライアント/課金・権限の検証計画、初回更新の明示承認、権威ある接続0人の更新直前と再起動直前の確認。1項目でも不明なら反映しない。02:00・13:00 JSTの既存定期タスクを維持し、追加登録は0件。
