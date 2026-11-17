# 導入・更新・復旧

このZIPはテスト用です。最初に別添のQAと実機チェックリストを確認してください。既存のexport名・更新手順と一致させるため、リソース名は `flecity_jam` のまま使用します。ZIPには実行ファイル、音源、ライセンス、README、および導入・操作・設定・音源説明の公開資料だけを入れます。テスト、開発ツール、QA、内部資料、認証情報は含めません。

## 0.4.0-test候補の更新前基準

2026-11-18の作業開始時点でJAMは **0.3.2-testの81ファイル**でした。前回更新の受領記録は `D:\FiveM_Test_Server\txData\Qbox_D233FD.base\flecity-jam-backups\jam-update-8apehtiw\receipt.json`、SHA256は`e7985c527ce0359be2b1b6369821e070b1ffb7d70518553a595ff0f2ca0782cc`です。配布ZIPと81/81の一致を確認して全体保全しました。これは0.4.0更新前の記録で、今回の最終試験・適用・復旧情報は別添`rc-polish-20261118/QA/`を正本とします。

候補の回帰・音源の品質ゲート・隔離した更新／復旧試験・差分監査の合格後にだけ更新します。config差分は新3楽器のItems名だけで、Range15・アクセス方針・PTT・Presentation=falseを維持します。incoming configの完全SHAを明示し、それ以外の設定を一括許可しません。非JAM5,304ファイル・設定5件・txAdmin設定を今回の直前値と照合し、既存PuriPhoto Junctionは追跡しません。WAVE・Voice・DB・外部Inventory定義・サーバー設定を変更しません。

通常PTTは相手への送信と本人の受信を実際に確認して初めてPASSです。表示上の送信検出では証明できません。声が届かない場合や無線時はEscで閉じます。マイクOFF・Voiceミュート等を解除しません。0.4.0の新3楽器・個別聴取音量・VC双方向・15m聴感・合奏はNOT_RUN。ユーザーがノートPCで確認し、デスクトップFiveMは起動しません。正式公開NO-GOです。

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

4. `PLAN_UPDATE`と差分を確認後、同じコマンドへ`--confirmed-stopped --apply`を追加する。設定変更は既定で`CONFLICT_STOP`。今回は新3楽器のItems名だけと監査できた場合に限り、計画・適用へ`--reviewed-config-sha256 <新config.luaの固定SHA256>`を明示する。値は別添QAに固定し、未指定・誤SHAは停止する。設置版がbaselineと1件でも違えば正しいpinでも停止する。旧JAM全体をresources外で保全・照合後に同一ドライブ上で入れ替える。
5. `UPDATED`の結果、`receipt`・`receiptSha256`・バックアップ場所を記録する。receiptは入れ替え前の固定記録なので内部状態は`PREPARED`で、`configReview`へ設定の前後SHA・変更有無・明示pinを記録する。更新後全件を照合し、定義再走査が必要な場合だけ`refresh`、JAMだけ`ensure flecity_jam`して`jam_status`を確認する。診断`jam_voice_diag`は単発の入力状態であり、実通話や聴感をPASSにしない。最終の設置・起動・ハッシュ結果は別添QAへ記録する。

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

新3楽器は`jam_electric_guitar`／`jam_flute`／`jam_violin`と、`UseElectricGuitar`／`UseFlute`／`UseViolin`のexportを用意します。アイテム経由ではInventoryの使用成功応答とサーバー側の所持・権限確認が必要です。外部アイテム定義は運営が別途準備するもので、このZIPが既存Inventoryや所持データを変更することはありません。

現地で演奏Propを確認する場合のみ `Presentation=true`。同梱はギター用のGTA標準候補で、外部アセットの購入は不要です。全楽器の専用Prop・設置型ピアノは実装範囲に含めていません。
