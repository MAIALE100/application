# 既存テストサーバー方式への切替

## 現在の構成

ユーザーの変更方針を適用し、D:\FiveM_Test_Serverの既存環境を使います。ライセンスキーの新規発行依頼は撤回しています。既存キーの表示・コピー・変更はしていません。

専用FXServer方式は起動禁止にしました。CLIと直接起動入口の両方が、ライセンスファイルへアクセスする前に拒否します。専用の試行プロセスは停止済み。生成したランタイムは .flecity-dev/archive/isolated-lab-retired/runtime へ同一ワークスペース内で退避しました。停止済みの試行DB・ログは監査用に保持し、private/license.cfgには整理時に触れていません。元サーバー・元DBはそのままです。

## 整備・検証したもの

| 項目 | 結果 |
| --- | --- |
| 既存FiveMへの接続 | localhost:30120の読み取りGETが成功。FXServer v1.0.0.37437 |
| BASE | flecity_base・lb-phone・oxmysql・qbx_coreの報告を確認 |
| LINK | flecity_games・lb-phone・oxmysqlの報告を確認。LOOPと同一リソース |
| 接続者 | 検査時、dynamic.jsonとplayers.jsonの双方が0人。識別子・名前は保存しない |
| 接続者ゲート | 非0、不一致、不明、2秒を超える観測を拒否。更新適用前とバックアップ後に再取得 |
| ログ収集 | 対象タグだけを保存。今回の現行ログは対象行0。過去ログや0行を今回のPASSにしない |
| BASE/LINKローカル試験 | Lua構文・Lua回帰・JS・模擬NUIがPASS。実ゲーム内操作とは区別 |
| 基盤・安全ガード | 55件PASS、fail 0、skip 0。旧サーバー起動封鎖、bridge政策、ログ相関の回帰を含む |
| ネイティブ自己診断 | NOT_RUN。初回導入承認がないため実行していない |
| クライアント実機・データ変更 | NOT_RUN。既存ユーザーを偽装せず、既存DBへ試験データを書き込んでいない |

コマンド：

    .\flecity.cmd server check base
    .\flecity.cmd server check link
    .\flecity.cmd server logs base
    .\flecity.cmd server verify base
    .\flecity.cmd server verify link

verifyは静的・オフラインNUIと読み取りチェックを一括実行します。未実施を含む場合の終了コードは2です。各プロジェクトの .flecity-dev/projects/<id>/runs に結果、接続スナップショット、対象ログを保存します。

## 初回承認用の具体案

計画：.flecity-dev/bridge-plans/d047c52f-4d86-4b3b-9499-471556c38eca/plan.json

- 新規配置先：D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\flecity_validation_bridge
- 内容：fxmanifest.lua、policy.lua、server.lua、専用capabilityのprivate.json。capabilityはログ・説明へ出さない。
- 起動するのはこの新規bridgeリソースだけ。BASE/LINKのファイル更新・再起動は含まない。
- 権限：resource.flecity_validation_bridgeにcommand.base_selftestだけを付与。
- 実行候補：base_selftest、game_selftest。ファイル要求の固定操作のみで、ネットワークイベント・HTTP管理口を追加しない。
- 接続者0、期限、nonce、許可操作、対象started状態をbridge内部でも確認。
- 結果はCOMMAND_ISSUEDだけではPASSにせず、開始マーカー以降の一意な終了結果をログから確認する。
- 初回承認記録がない現在、server runは書き込み前に拒否される。

復旧：このbridgeだけを停止し、付与したACEを解除し、追加したbridgeフォルダーだけをPC側へ回収します。元からbridgeがないため、既存アプリのファイルやDBを戻す処理はありません。初回配置前の再確認で既存bridgeが見つかった場合は上書きせず中止します。

**注意した点：game_preflightは読み取り専用ではありません。** 実装を調べ、FlecityGamesDatabase.Ensure()によるDB作成・移行があり得るため、自動実行の許可リストから除外しました。game_selftestの対象はスキーマのSELECTと純粋な自己診断であることをソースで確認しました。

このbridgeの実起動・権限設定・コマンド実行はまだ未検証です。Lua構文とポリシーの試験だけをPASSとして記録しています。

## BASE更新と今後の範囲

以前準備したBASE候補はローカルに保持しています。実コード差分は既存PR #7由来の2ファイルで、文書・テストを含む変更7件、削除0件です。まだ配置していません。BASE自体を更新する際には、別途対象差分・ファイルバックアップ・DB移行の安全条件・復旧手順を提示します。ファイル復旧でDBを自動逆移行しません。

LINK/LOOPはflecity_gamesを共有するので、そのリソースの再起動をアプリ1個だけの影響として扱いません。WAVE・フレプリ・プリフォト・新規アプリも個別アダプターと明示的な対象登録で拡張します。

FiveMクライアントの無人操作は未実装です。メモリ注入、認証回避、無許可botは作りません。現状のブラウザテストは通常のオフラインNUIのみです。実クライアントの適法な操作方法・アカウント・接続方式が確認できてから、別の検証段階として扱います。

## 無変更の範囲

既存FiveMプロセス、既存DB、ライセンスキー、server.cfg、他のリソース、既存の自動更新ジョブは変更していません。読み取りと開発リポジトリ内の準備だけを実行しています。専用FXServer方式の試行はユーザーの方針変更前に終了しており、切替後は起動していません。
