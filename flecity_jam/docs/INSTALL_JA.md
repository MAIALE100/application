# 導入・更新・復旧

このZIPはテスト用です。最初にQAと実機チェックリストを確認してください。リソース名は `flecity_jam` のまま使用します。NUIの接続先をCSPで制限しているため、フォルダー名を自由に変更する運用には対応しません。

## 初回

1. FiveMの既存テストサーバーでOneSyncが有効であることを確認。
2. ZIP内の `flecity_jam` フォルダーをresources配下へコピー。ほかのリソース・DB・Voice設定は変更しない。
3. `config.lua` のRangeとAccessを確認。最初は`Access='open'`でコマンド試験が可能。
4. 対象と復旧手順の確認後、稼働中のテストサーバーコンソールで `refresh`、`ensure flecity_jam`。
5. `/jam`で開き、演奏する。2人で実機チェックリストを実施。

サーバー全体の再起動は不要です。接続人数0を更新必須条件にはしませんが、演奏中の対象リソースを更新すると全演奏が止まります。停止中サーバーの起動や、本番導入はこのテストZIPの適用とは別の運営判断です。

## 更新

1. 配布ZIPのSHA-256とMANIFESTの一致を確認。
2. 現在の `flecity_jam` 全体と個別設定を別名でバックアップし、そのハッシュを記録。
3. 他の作業との競合がないことを確認し、`stop flecity_jam`。
4. 更新版を配置。既存configの設定値を新しいconfigへ照合して引き継ぐ。WAVE等のファイルはコピーしない。
5. `ensure flecity_jam`。演奏・終了・2人の距離試験を確認。

失敗時は `stop flecity_jam` → 自分が更新したフォルダーだけを退避 → バックアップを戻す → `ensure flecity_jam`。初回の撤去は `stop flecity_jam` の後にJAMフォルダーを退避。DB処理や返金・振込はありません。JAMは演奏状態を永続保存せず、再開後は再度演奏を開始します。

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
