# 導入・更新・復旧

このZIPはテスト用です。最初に別添のQAと実機チェックリストを確認してください。既存のexport名・更新手順と一致させるため、リソース名は `flecity_jam` のまま使用します。ZIPには実行ファイル、音源、ライセンス、README、および導入・操作・設定・音源説明の公開資料だけを入れます。テスト、開発ツール、QA、内部資料、認証情報は含めません。

## 0.3.0-test候補の更新元

2026-11-17の読取専用照合時点で、テストサーバーのJAMは **0.2.2-testの81ファイル**です。更新元として使う受領記録は `D:\FiveM_Test_Server\txData\Qbox_D233FD.base\flecity-jam-backups\jam-update-f7w5zh4u\receipt.json`、SHA256は `089d79208285b8f20f05e9d6afb21f9195dfd1d6dc583e2752dd6c837a2afabe` です。この記録の更新後81ファイルと、更新前バックアップ81ファイルのハッシュは全件一致しました。旧0.2.0-testの受領記録は現在の版の基準に使えません。

0.3.0-test候補の配布ZIPが完成し、回帰・隔離した更新／復旧試験・差分監査に合格してから、下記の`--update`手順を用います。変更前にはJAMの設置版を全体バックアップし、JAM以外の5,304ファイルと設定5件を改めてハッシュ記録します。実行時に書き換わる他リソースの状態ファイルがあるため、過去日のハッシュだけで「更新直前」と判断しません。WAVE、Voice、DB、サーバー設定の変更はこの更新の範囲外です。

JAM画面が入力を専有する間のPTTは未保証です。安全な利用案内はEscで画面を閉じて会話し、`/jam`で戻る方法です。PTT、実際の音声、2人での距離・バケット・途中参加は、更新後の実機試験でそれぞれ判定します。ローカル試験だけで正式公開と判定しません。

## 初回

`python flecity_jam/devtools/package.py` で配布ZIPを作ります。ZIPのSHA-256、個別ファイルのMANIFEST、実行ファイルだけの集合ハッシュを照合します。`devtools/install.py` は初回配置と、旧設置版をハッシュ固定した更新・復旧を扱います。どの操作も通常実行は計画表示のみです。

リポジトリルートで、計画は `python flecity_jam/devtools/install.py`、初回配置は `python flecity_jam/devtools/install.py --apply`。書き込み可能な実行環境が必要です。サーバー起動・設定変更・リソース起動は行いません。自動実行前には共通mutexを取得してください。実行結果がINSTALLEDでも、実機検証はNOT_RUNです。

検証は `python flecity_jam/tests/install_test.py`。実サーバーを触らず、隔離したfixtureで初回配置、競合停止、設定保護、バックアップ、更新失敗時の自動復旧、明示的なロールバックを検査します。

1. FiveMの既存テストサーバーでOneSyncが有効であることを確認。
2. ZIP内の `flecity_jam` フォルダーをresources配下へコピー。ほかのリソース・DB・Voice設定は変更しない。
3. `config.lua` のRangeとAccessを確認。最初は`Access='open'`でコマンド試験が可能。
4. 対象と復旧手順の確認後、稼働中のテストサーバーコンソールで `refresh`、`ensure flecity_jam`。
5. `/jam`で開き、演奏する。2人で実機チェックリストを実施。

サーバー全体の再起動は不要です。接続人数0を更新必須条件にはしませんが、演奏中の対象リソースを更新すると全演奏が止まります。停止中サーバーの起動や、本番導入はこのテストZIPの適用とは別の運営判断です。

## 更新

更新元の版に対応する固定ファイル一覧と、その一覧のSHA-256を用意します。前回更新のreceiptには更新後全ファイルの `afterManifest` があるため、そのreceiptを次回の基準として利用できます。別の版・サーバー・ロールバック前のハッシュを使い回さないでください。現在のファイルが基準と違う場合は、差分を調査してから進めます。

1. 作業中の別の自動化・演奏セッションを確認する。配布ZIPを作成し、`SHA256SUMS.txt` と `MANIFEST.json` を照合する。
2. 管理コンソールで `stop flecity_jam` を実行する。サーバー全体を再起動しない。
3. 以下の計画コマンドで、現行JAMと指定した更新元基準の全件SHA256を照合する。

   ```text
   python flecity_jam/devtools/install.py --update --baseline "<基準一覧または前回receiptの絶対パス>" --baseline-sha256 <基準ファイルのSHA256>
   ```

4. `PLAN_UPDATE` と設定の一致を確認後、同じコマンドへ `--confirmed-stopped --apply` を追加する。旧JAM全体のコピーをresources外へ作成・照合してから、同一ドライブ上の準備済み版と入れ替える。旧設定 `config.lua` と新ZIPの設定が異なる場合、勝手に移行せず `CONFLICT_STOP` で停止する。更新前に現行設置ファイルが1件でも異なる場合も停止する。
5. `UPDATED` の結果、返された `receipt` と `receiptSha256`、バックアップ場所を記録する。receiptは入れ替え前に書き込む固定の復旧記録なので、内部状態は `PREPARED` と表示される。更新後のJAM全件SHA256を確認し、管理コンソールで `refresh`、`ensure flecity_jam`、`jam_status`。表示バージョンを確認し、実機の音声・終了・距離・複数人テストを確認する。

次回更新では、今回のreceiptとその `receiptSha256` を新しい `--baseline`、`--baseline-sha256` に指定できる。ロールバック済みの場合は現在設置中の版に対応する基準を使用する。

更新中の入れ替えに失敗した場合、ツールは旧JAMを自動的に元の場所へ戻す。更新後に問題が分かった場合は `stop flecity_jam` を実行し、次の計画コマンドで、現在のJAMとバックアップのハッシュを確認する。

```text
python flecity_jam/devtools/install.py --rollback "<receiptの絶対パス>" --receipt-sha256 <更新時に記録したreceiptSha256>
```

`PLAN_ROLLBACK` を確認後、同じコマンドへ `--confirmed-stopped --apply` を追加する。旧版を復元・照合後に `refresh`、`ensure flecity_jam` を実行する。ツールは更新版を別名で残し、バックアップも保持する。現在のJAMまたはバックアップに予期しない変更がある場合は `CONFLICT_STOP` で停止する。初回の撤去は `stop flecity_jam` の後にJAMフォルダーを退避。DB処理や返金・振込はありません。JAMは演奏状態を永続保存せず、再開後は再度演奏を開始します。

## 権限

`Access='ace'` の場合は、運営の権限グループに `flecity.jam` のACEを付与してください。管理者限定の固定権限名を推測して書き換えることはしません。

## ox_inventoryのアイテム例

`Access='ox_inventory'` に切り替え、`config.lua`のItemsと街のアイテム名を一致させます。所有数は開始時・入力時・定期照合時にサーバーで再確認します。アイテムを消費する処理はありません。

以下は運営が既存のアイテム定義へ追加する例です。このZIPはox_inventoryを自動変更しません。

```lua
['jam_guitar'] = {
    label = 'アコースティックギター', weight = 2500, stack = false, close = true, consume = 0,
    client = { export = 'flecity_jam.UseGuitar' }
}
```

コマンド開始は常に同じサーバー権限検査を通ります。クライアントexportだけで権限を付与しません。汎用呼出しは `exports.flecity_jam:OpenInstrument('guitar')`、終了は `exports.flecity_jam:StopPerformance()`。

現地で演奏Propを確認する場合のみ `Presentation=true`。同梱はギター用のGTA標準候補で、外部アセットの購入は不要です。全楽器の専用Prop・設置型ピアノは実装範囲に含めていません。
