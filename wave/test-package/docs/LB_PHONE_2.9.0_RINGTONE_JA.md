# LB Phone 2.9.0 着信音連携の調査

## 確認した環境

- テストサーバー設置版のLB Phone：`2.9.0`
- `Config.Sound.System`：`native`
- `Config.Sound.Sync`：`true`
- WAVEの着信音差し替え設定：無効

## 確認結果

公式設定資料ではnative方式はゲーム内の音声を使い、NUI方式はNUI再生となり同期されません。NUI方式で着信音を追加するにはLB Phone内の着信音ファイル、`Config.Sound.Ringtones`、電話リソース再起動が必要です。今回の更新権限はWAVE単体再起動までなので、LB Phoneの設定・音声素材・再起動は行いません。

LB Phoneの公開クライアントexportsには`AddCheck("playNativePhoneSound", handler)`と`RemoveCheck`があり、チェック処理は`false`を返すとnative音を止める仕組みです。設置版2.9.0の`shared/checks.lua`でもこの契約を確認しました。一方、公開資料とローカルの読めるLuaからは、着信時に渡される`soundType`の値を確定できていません。音を止めるチェックはデフォルトで無効です。

WAVEは専用NUI画面に常駐のAudioContextを持ちますが、電話NUIが閉じた後も実際の着信音として動作するか、通話開始直後に停止するかは実着信で未確認です。実着信の二者検証後にのみ、正確な音種と停止条件を設定します。

## 安全境界

- 曲は公開中・作者の着信音許可あり・利用者がフル再生権を持つ場合だけ選択できます。
- 保存キーは`citizenid`です。サーバーはクライアント指定の所有者IDを受け付けません。
- 着信音設定は曲データ・購入・売上と分離された追加テーブルです。
- `nativeIntegration=false`のため、既存の電話着信音を抑止しません。
- 電話設定・LB Phone本体・サーバー全体は変更・再起動しません。

## 参照

- [LB Phone公式：着信音と通知音](https://docs.lbscripts.com/phone/configuration/ringtones-and-notifications/)
- [LB Phone公式：クライアントexports](https://docs.lbscripts.com/phone/exports/client-exports/)
- テストサーバー設置版の`lb-phone/shared/checks.lua`
