# PuriPhoto

Flecity向けLB Phone写真編集・アルバムアプリです。

## Runtime

- qbx_core
- oxmysql
- lb-phone
- Node.js / npm はソースからUIを再ビルドする時だけ必要

現在のFLEPURI互換ランタイムは **PuriPhoto v1.1.1** です。

## FLEPURI連携

PuriPhoto v1.1.1 はFLEPURIから完成画像を受け取るため、以下を提供します。

- client export: `OpenBoothImport(image, metadata)`
- client export: `CancelBoothImport(token)`
- NUI callback: `puriphotoGetBoothImport`
- NUI callback: `puriphotoConfirmBoothImport`
- UI message: `boothImportAvailable`
- local receipt event: `puriphoto:client:boothImportConsumed`

FLEPURIはPuriPhotoのNUIが実際に画像を取得したことを確認してから編集画面を閉じます。

## Production build

```powershell
cd puriphoto\ui
npm ci --no-audit --no-fund
npm run build -- --emptyOutDir
```

FLEPURI開発環境ではルートの `puribooth-update.ps1` がこの処理を自動実行し、生成されたproduction bundleに

- `boothImportAvailable`
- `puriphotoGetBoothImport`
- `puriphotoConfirmBoothImport`

が含まれることまで検証します。

## Runtime files

FiveMは `ui/dist/index.html` を読み込みます。ソースの `ui/src` だけを更新しても本番UIには反映されません。

FLEPURI提出版で使用するproduction indexは、FLEPURI互換bundleを参照しています。

```
ui/dist/assets/puriphoto-v1.1.1-flepri.js
```

## Development

```powershell
cd puriphoto\ui
npm install
npm run dev
```

ソース変更後は必ずproduction buildを更新してからFiveMで確認してください。
