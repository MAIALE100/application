# FLEPURI / PuriBooth

**Release: v1.0.0 (Flecity operator submission)**

Flecity向けの街中設置型プリクラ「FLEPURI（フレプリ）」撮影リソースです。
物理プリクラ台で料金を支払い、背景・床を選択し、固定カメラで4枚撮影した後、専用編集画面を経由してPuriPhotoへ渡します。

## 必要リソース

- qbx_core
- oxmysql
- lb-phone
- screenshot-basic
- puriphoto
- Renewed-Banking（会社口座へ売上回収する既定設定で必要）


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
- 選択画像はNUI上でJPEGへラスタライズしてから共有します
- サーバー / クライアントは共有payloadをJPEG Data URLだけに制限します
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
- 撮影開始前の切断: citizenidを使ってオフライン返金
- 売上DB記録失敗: 返金へフォールバック
- リソース再起動で未完了セッションが残った場合: 返金を試行

## Weazel管理

管理系操作はサーバー側でQBoxの現在jobを確認します。
既定では `Config.Management.job = "weazel"` のため、weazel以外は実行できません。

### コマンド

```
/puribooth place
```
新しいフレプリ台を設置します。

配置操作:
- 矢印: 移動
- Q / E: 回転
- PageUp / PageDown: 高さ
- Shift: 高速調整
- C: 撮影カメラ確認
- Enter: 設置
- Backspace: キャンセル

```
/puribooth remove
```
近くの台を撤去します。
未回収売上が残っている台は撤去できません。

```
/puribooth price <料金> [台ID]
```
台ごとの料金を変更します。
台IDを省略した場合は近くの台が対象です。

例:
```
/puribooth price 1500
/puribooth price 1500 3
```

```
/puribooth sales
```
全台について以下を一括表示します。
- 現在料金
- 未回収売上
- 累計売上
- 撮影回数
- 全台合計

```
/puribooth collect all
/puribooth collect 3
```
未回収売上を会社口座へ回収します。

```
/puribooth list
```
設置台数を確認します。

### 本社限定

本社の座標が確定したら:

```lua
Config.Management.salesRequireLocation = true
Config.Management.salesCoords = { x = ..., y = ..., z = ... }
```

とすることで、`sales` と `collect` をWeazel本社付近だけに限定できます。

### job / grade

`Config.Management` でコマンドごとの最低gradeを変更できます。

- `placeMinGrade`
- `removeMinGrade`
- `priceMinGrade`
- `salesMinGrade`

`requireOnDuty = true` にすると勤務中のweazelだけに限定できます。

## 売上

料金・売上は台ごとにDBへ永続化します。

- `price`: 現在の撮影料金
- `balance`: 未回収売上
- `lifetime_sales`: 累計売上
- `completed_sales`: 売上確定した撮影回数
- `collected_total`: 累計回収額

売上確定:
- 4枚の撮影が正常完了した時点
- 撮影開始後にユーザーが自己都合キャンセルした場合（返金なし）

売上にしない:
- 撮影開始前キャンセル
- 技術エラー
- 撮影タイムアウトで返金
- resource restartによる返金

既定の回収先はRenewed-Bankingの `weazel` job口座です。

```lua
Config.Payout = {
    enabled = true,
    mode = "renewed-banking",
    resource = "Renewed-Banking",
    account = "weazel"
}
```

会社口座への送金が失敗した場合、先に確保した未回収残高をDBへ戻すため、
入金失敗で売上だけ消えることはありません。

テスト環境などで会社口座がない場合は `mode = "player-bank"` も使用できます。

## DB

初回起動時に `puribooth_booths` を自動作成し、既存テストDBも自動移行します。
手動SQL導入は不要です。

主な保存内容:
- 設置座標 / 向き / モデル
- 台ごとの料金
- 未回収売上
- 累計売上
- 撮影回数
- 累計回収額
- 最終売上 / 最終回収日時

## 設定

主な設定は `config.lua`:

- Price / MinPrice / MaxPrice
- PaymentMethods
- Management
- Payout
- SessionTimeoutSeconds
- CaptureTimeoutSeconds
- ShotCount
- CountdownSeconds
- Geometry
- ThemeSurfaces
- PhotoLighting
- PlacementPreview
- InteractionMarker
- ThemeSyncDistance
- CountdownSyncDistance

## 自己診断

サーバーコンソール:

```
puribooth_selftest
```

qbx_core / oxmysql / lb-phone / screenshot-basic / puriphoto / DB / booth数を確認します.

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

現在はGTA標準のクレーンゲーム筐体を使用します。
専用3Dモデルは必須にせず、足元の水色インタラクト円と近接表示で利用可能な台だと分かる仕様です。

- 空き台: 水色
- 近距離: 明るい水色
- 使用中: ピンク
- 管理者配置時はピンク枠で撮影範囲、水色矢印で撮影方向を確認できます。


## 撮影範囲ガイド

撮影開始前は、同じフレプリ台の撮影エリアにいる参加者へガイドを表示します。
複数台が近くにある場合も、支払者は自分の台、同行者は最寄りの使用中台1台だけに紐付きます。

- 白枠: 実カメラFOVから計算した「写る横幅」の目安
- 緑枠: 人物が切れにくい安全範囲
- 白い丸: 最大4人で並ぶための立ち位置目安
- G: ガイド表示 / 非表示

ガイドは実際の撮影開始時に自動で消えるため、完成写真には写りません。


## 複数台同時利用

- セッションは台IDごとに独立
- 背景・床・撮影ライト・カウントダウンも台ごとに分離
- 同行者には参加中の1台の背景・床だけを一時同期
- 撮影終了・範囲外移動で同期テーマを破棄
- 撮影後のPuriBooth編集は台を占有しません

## フォント

提出版FLEPURIにはフォント本体を同梱せず、
運営側で各公式配布元からダウンロードしてもらう方式を採用できます。

公式配布先:
- ポプらむ☆キウイ Telop: https://kiwi-kawagoto.com/poprumkiwi/index.html
- ぎゃる文字ゴシックfree: https://booth.pm/ja/items/8088925
- ひとりゴシック: https://booth.pm/ja/items/7451003
- Hachi Maru Pop: https://github.com/noriokanisawa/HachiMaruPop

期待するファイル名:
- `PopRumKiwi-Telop.ttf`
- `galmojigothicfree.ttf`
- `HitoriGothic.ttf`
- `HachiMaruPop-Regular.ttf`

配置先:
```
puribooth/ui/fonts/
```

`puribooth-fonts.ps1` は、上記ZIPをDownloads等へ置いた開発環境では自動取り込みにも使えます。

この配布方法ではFLEPURI側がフォントファイル自体を再配布しません。
フォント未導入でもフォールバック書体で動作しますが、意図したプリクラ表示にする場合は4書体の導入を推奨します。
利用時は各フォントの配布元に記載されたライセンス条件に従ってください。

運営導入時は `INSTALL.md`、最終確認は `ACCEPTANCE_TEST.md` を参照してください。
