# PuriBooth

Flecity向けの街中設置型プリクラ撮影リソースです。
物理プリクラ台で料金を支払い、背景・床を選択し、固定カメラで4枚撮影した後、専用編集画面を経由してPuriPhotoへ渡します。

## 必要リソース

- qbx_core
- oxmysql
- lb-phone
- screenshot-basic
- puriphoto

`fxmanifest.lua` でも依存関係を宣言しています。

## 基本フロー

1. プリクラ台で料金を支払う
2. 背景・床を選択
3. 撮影範囲へ集合
4. 白枠・緑枠・立ち位置マーカーを見ながら全員で並ぶ
5. 支払者がカメラ画角を確認
6. 支払者が撮影開始
7. 4枚撮影
   - 2枚目以降はPOSE READYで待機
   - エモートやしゃがみを整えてからEで次へ進む
8. PuriBooth編集
   - レイアウト
   - 盛り
   - フレーム
   - スタンプ
   - 文字
   - 落書き
   - Undo / Redo
   - スタンプ・文字の移動 / 削除
9. PuriPhotoへ受け渡し
10. PuriPhoto側で通常の編集・ギャラリー保存・アルバム保存

## 背景・床

プリセット:
- PINK
- WHITE
- Y2K
- BLACK
- HEARTS
- MINT
- LAVENDER
- SKY
- なし

画像URLも指定できます。

- URLは撮影セッション中だけ使用します
- URLやテーマ設定はDBへ保存しません
- 撮影終了 / キャンセル時にクライアント状態から破棄します
- カスタムURLはブラウザから画像変換できる直リンクが必要です
- 画像ホストがCORSを禁止している場合は使用できません

## 課金 / 返金

既定料金: $1000

支払い方法:
1. cash
2. bank

返金:
- 撮影開始前のユーザーキャンセル: 返金
- 撮影開始後の自己都合キャンセル: 返金なし
- screenshot-basic等の技術失敗: 返金
- 撮影準備タイムアウト: 返金
- 撮影処理タイムアウト: 返金
- リソース再起動で未完了セッションが残った場合: 返金を試行

## ブース管理

初回管理者:
```
/puribooth claimadmin
```

設置:
```
/puribooth place
```

配置操作:
- 矢印: 移動
- Q / E: 回転
- PageUp / PageDown: 高さ
- Shift: 高速調整
- C: 撮影カメラ確認
- Enter: 設置
- Backspace: キャンセル

撤去:
```
/puribooth remove
```

台数確認:
```
/puribooth list
```

ブース位置はDBへ保存され、リソース再起動後も復元されます。

## DB

初回起動時に自動作成します。

- `puribooth_admins`
- `puribooth_booths`

手動SQL導入は不要です。

## 設定

主な設定は `config.lua`:

- Price
- PaymentMethods
- SessionTimeoutSeconds
- CaptureTimeoutSeconds
- ShotCount
- CountdownSeconds
- Geometry
- ThemeSurfaces
- PhotoLighting
- PlacementPreview

## 自己診断

サーバーコンソール:

```
puribooth_selftest
```

qbx_core / oxmysql / lb-phone / screenshot-basic / DB / booth数を確認します。

## 開発サーバーへの反映

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File D:\FiveM_Dev\_puriphoto_booth\puribooth-update.ps1
```

PuriBoothだけ変更した場合は `-BoothOnly` が使えます。
PuriPhoto連携コードやPuriPhoto UIを変更した場合は `-BoothOnly` を付けずに実行してください。

通常はサーバー全体の再起動は不要です。

```
restart puriphoto
restart puribooth
```

## 現在のモデル

現在はGTA標準のクレーンゲーム筐体をプロトタイプとして使用しています。

最終版ではFlecity専用プリクラ筐体のstreamed modelへ交換可能です。ブースDBや撮影ロジックはそのまま維持できます。


## 撮影範囲ガイド

撮影開始前は、同じプリクラ台の近くにいる全員へガイドを表示します。

- 白枠: 実カメラFOVから計算した「写る横幅」の目安
- 緑枠: 人物が切れにくい安全範囲
- 白い丸: 最大4人で並ぶための立ち位置目安
- G: ガイド表示 / 非表示

ガイドは実際の撮影開始時に自動で消えるため、完成写真には写りません。
