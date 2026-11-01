# LOOP・LINK・WAVE 初回導入手順

この手順は新規のテスト環境へ初めて配置する場合を想定する。運営提出と本番導入は、別紙の必須検証がすべてPASSした後に判断する。

## 同梱リソースと依存

- `flecity_games`: LOOPとLINKを含む共有リソース。個別再起動はできない。
- `wave`: WAVE独立リソース。
- 依存: LB Phone 2.9.0、QBox、oxmysql、MariaDB。初回起動前にLB Phoneカスタムアプリ識別子 `flecity_play`、`flecity_party`、`flecity_wave` の重複を確認する。
- 推奨起動順: `oxmysql` → `qbx_core` → `lb-phone` → `flecity_games` → `wave`。既存の `ensure [lb-phone]` がWAVEを起動する構成では `ensure wave` を重複記載しない。

```cfg
ensure oxmysql
ensure qbx_core
ensure lb-phone
ensure flecity_games
ensure wave
```

## 配置とDB

1. 導入先リソースとDBをバックアップし、復元先で照合する。既存の同名リソースがある場合は初回導入と扱わず、ファイル単位の差分計画を作る。
2. ZIP内のSHA256マニフェストを照合し、リソースを配置する。ZIPには運用中の認証情報、既存プレイヤーデータ、DBバックアップを含めない。
3. `flecity_games` と `wave` は起動時にDB Ensureを実行する。WAVEは19テーブルの `CREATE TABLE IF NOT EXISTS` とメタ情報の初期化を行う。既存データのあるDBではスキーマとバックアップを確認してから起動する。`wave/sql/wave.sql` は説明用で、直接適用するマイグレーションではない。
4. 起動ログでDB準備、LB Phone登録、callback登録、Lua/NUIエラーを確認する。購入・受取・権限は隔離環境または専用試験データで検証する。

## 設定

- `flecity_games/config/shared.lua`: アプリ識別子、LOOPセッション・保存上限、LINKルーム・切断猶予、LINK+価格・期限・収益口座、レート制限。
- `wave/config/shared.lua`: アプリ識別子、制作データ上限、販売価格、制作者85%／プラットフォーム15%、最低受取額、サブスク有効化、管理ACEとWeazel権限。現行値を変更する場合は運営の明示レビューを要する。
- WAVEの売上は内部DBへ計上し、受取操作時のみ銀行へ移す。一般ユーザー画面に制作者の内部識別子を表示しない。

## 管理コマンドと更新

- `game_status`、`game_party_status`、`game_healthcheck`: flecity_gamesの状態確認。
- `wave_diag`: WAVE診断。診断内容を確認した管理者のみ実行する。
- `game_selftest`、`wave_selftest`: 自己診断。稼働DBへの処理を含む可能性があるため、バックアップと実行範囲の確認後に使う。
- `game_preflight`: DB Ensureを呼ぶため読み取り専用の状態確認には使用しない。
- 更新時は差分とSHA256を照合し、最新のDB・両リソースのバックアップ後に対象ファイルだけを反映する。必要な場合のみ `restart flecity_games`、続いて `restart wave` を実行し、FXServer全体は再起動しない。

## 復旧と撤去

更新直前バックアップから対象ファイルを戻してSHA256を照合し、対象リソースのみ再起動する。WAVEの購入・受取やDB書込みが発生した後は、ファイルだけを戻して整合性が回復したと判断しない。DB復元は取引時刻とプレイヤーデータへの影響を確認した別手順で実施する。初回導入の撤去でも既存データやテーブルを無断削除しない。
