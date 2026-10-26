# PuriPhoto compatibility for FLEPURI v1.0.3

## Required

FLEPURIはPuriPhotoを単に「started」で判定しません。

次を全て確認します。

- PuriPhoto version >= 1.1.0
- ui/dist/index.html が存在
- indexが参照するproduction JavaScriptが存在
- JavaScriptに `boothImportAvailable` が存在
- JavaScriptに `puriphotoGetBoothImport` が存在
- JavaScriptに `puriphotoConfirmBoothImport` が存在
- indexが参照するproduction CSSが存在
- client/v11.lua に `OpenBoothImport` exportが存在
- client/v11.lua に `CancelBoothImport` exportが存在
- client/v11.lua に `boothImportConsumed` receipt bridgeが存在

どれか1つでも不足すると、撮影料金を引く前にFLEPURIを停止します。

## Compatible runtime

このrelease branchでの互換ランタイム:

- PuriPhoto v1.1.1
- production bundle: `ui/dist/assets/puriphoto-v1.1.1-flepri.js`

## Existing PuriPhoto

既存PuriPhotoのproduction UIが最新なら、そのまま利用できます。

`puribooth_selftest` で:

```
puriphoto=PASS(...)
puriphoto_ui=PASS(...)
```

になれば交換不要です。

## Source rebuild

PuriPhotoソースを更新した場合:

```powershell
cd puriphoto\ui
npm ci --no-audit --no-fund
npm run build -- --emptyOutDir
```

FLEPURI開発環境の `puribooth-update.ps1` はbuild後にbooth-import bridgeを自動検査し、欠落していればデプロイを停止します。

## Handoff safety

FLEPURI v1.0.3は完成画像をPuriPhoto exportへ渡しただけでは編集画面を閉じません。

PuriPhoto NUIが `puriphotoGetBoothImport` で画像とtokenを取得し、`puriphotoConfirmBoothImport` でtokenを確認した後、`puriphoto:client:boothImportConsumed` receiptが返った場合だけFLEPURI編集画面を閉じます。

receiptが返らない場合はhandoffを取り消し、FLEPURI側の完成画像・編集状態を保持します。
