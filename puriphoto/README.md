# PuriPhoto v1.1.1

LB Phone向けの写真撮影・編集・ギャラリー保存アプリです。写真編集、独自アルバム、メモ、撮影スポット、マイスポットを利用できます。

## 必要リソース

- `lb-phone`
- `oxmysql`
- `qbx_core`

## 導入

`puriphoto` をresources配下へ配置し、依存リソースの後に起動してください。

```cfg
ensure oxmysql
ensure qbx_core
ensure lb-phone
ensure puriphoto
```

既存server.cfgの依存順がある場合は維持してください。FLEPURI連携を使う場合はPuriPhotoを先に起動します。

## UIの再ビルド

Node.jsを用意し、`ui` で次を実行してください。

```powershell
npm ci --no-audit --no-fund
npm run build
npm run verify:build
```

ビルドは `ui/dist` に出力されます。検証ではindexから参照されるJS/CSS、公開画像、FLEPURIの受取・確認コールバックを確認します。開発サーバー用URLは配布ビルドに含めません。

## FLEPURIからの写真受取

`puribooth` v1.0.7との連携では、NUIが画像と一時tokenを取得し、編集状態を設定してから確認コールバックを送ります。確認が完了した場合だけFLEPURIへreceiptを返し、FLEPURI側の編集画面を閉じます。受取確認ができない場合、FLEPURI側は編集内容を保持して再送可能にします。

受取tokenは一時的なクライアント状態で、写真・作品・DB保存形式には使いません。
