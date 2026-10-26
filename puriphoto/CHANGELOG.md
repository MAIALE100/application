# PuriPhoto Changelog

## 1.1.1 - 2026-10-27

### FLEPURI compatibility
- FLEPURIからの完成画像受け取りexportを追加
- NUIが実際に画像を取得した時だけreceipt eventを返す方式へ変更
- FLEPURI側のタイムアウト時にpending importを取り消せるexportを追加
- フレプリ台の撮影座標・場所ラベルを受け取れるよう改善
- production UIへFLEPURI booth-import bridgeを反映
- production bundleを固定名 `puriphoto-v1.1.1-flepri.js` へ分離
- UI package / lockfile metadataをPuriPhoto v1.1.1へ統一
- 将来のproduction buildでbooth-import bridge欠落を検知する検証を追加

## 1.1.0

- PuriPhotoアルバム / 編集 / マイスポット / FLEPURI source integration.
