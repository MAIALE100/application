# LOOP＋LINK＋WAVE 初回導入手順（確認用）

この文書は運営側の**初回導入**を想定する。現在のZIPは実機最終検証前の確認用であり、運営提出・本番導入には使用しない。

## 内容と依存

- `flecity_games`: LOOPとLINKの共通リソース。個別に再起動できない。
- `wave`: WAVE独立リソース。LB Phone、QBox、oxmysqlが必要。
- 起動順: `oxmysql` → `qbx_core` → `lb-phone` → `flecity_games`、`wave`。既存の `ensure [lb-phone]` 等が対象を起動している場合、個別 `ensure` を重複記載しない。
- LB Phone識別子: LOOP `flecity_play`、LINK `flecity_party`、WAVE `flecity_wave`。既存登録との衝突を導入前に確認する。

## 導入前

1. バックアップと復元を演習し、配置先・DB・依存リソース・接続人数を確認する。
2. 配置先に同名リソースが存在する場合は初回導入と扱わず、全件SHA比較と差分単位の移行計画を作る。
3. `config/shared.lua` の課金・権限・収益設定を確認する。既存値を推測で変更しない。
4. WAVEは起動時に19テーブルの `CREATE TABLE IF NOT EXISTS` とメタ/プラットフォーム財布の書込みを行う。既存DBのスキーマ・バックアップを検査してから起動する。`wave/sql/wave.sql` は説明用SELECTであり、手動スキーマ導入SQLではない。

## 配置・起動

既存のリソースとDBを保護し、接続0人の信頼できる確認と対象の承認後、2つのリソースを配置する。`server.cfg` には、依存が既存グループで起動していなければ以下を依存順に**各1回**設定する。

```cfg
ensure oxmysql
ensure qbx_core
ensure lb-phone
ensure flecity_games
ensure wave
```

既存グループで起動済みの行は追加しない。サーバー全体や対象外リソースは再起動しない。起動ログでDB初期化、LB Phone登録、callback衝突、Lua/NUIエラーを確認する。

## 復旧・撤去

更新時は元の全リソースとDBを別々に保全し、問題発生時は対象だけを停止して元ファイルへ戻し、SHAを照合する。DB書込み後はファイル復元だけで整合性を保証しない。DB専用の復旧手順に従い、購入・収益・プレイヤーデータを無断削除しない。初回導入の撤去では起動設定と導入したリソースだけを対象とし、DBテーブルや既存データは別途レビューする。

実機でのゲーム、購入、銀行振込、複数クライアントの動作は未確認。確認結果は `RESULT_JA.md` と `ISSUES_JA.md` に記す。
