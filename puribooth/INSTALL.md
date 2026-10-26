# FLEPURI v1.0.1 導入手順

## 1. 配置
提出ZIPを展開し、`puribooth` フォルダをFiveMサーバーのresources配下へ配置してください。

例:
```
resources/[flecity]/puribooth/
```

## 2. 必要リソース
次のリソースが起動済みであることを確認してください。

- qbx_core
- oxmysql
- lb-phone
- screenshot-basic
- puriphoto
- Renewed-Banking（既定の会社口座回収を使う場合）

`server.cfg` では依存リソースより後にFLEPURIを起動してください。

```
ensure puriphoto
ensure puribooth
```

## 3. DB
手動SQLは不要です。
初回起動時に `puribooth_booths` を自動作成し、既存テストDBに不足列がある場合も自動追加します。

## 4. Weazel権限
既定では管理操作を `weazel` job に限定しています。

`config.lua`:
```lua
Config.Management.job = "weazel"
```

必要に応じて以下を変更できます。

- placeMinGrade
- removeMinGrade
- priceMinGrade
- salesMinGrade
- requireOnDuty
- salesRequireLocation
- salesCoords
- salesDistance

## 5. 売上回収
既定設定ではRenewed-Bankingの `weazel` 会社口座へ入金します。

```lua
Config.Payout = {
    enabled = true,
    mode = "renewed-banking",
    resource = "Renewed-Banking",
    account = "weazel"
}
```

会社口座を使わないテスト環境では `mode = "player-bank"` へ変更できます。

## 6. フォント
フォントファイルは提出ZIPへ同梱していません。
必要な書体を各公式配布元から取得し、以下へ配置してください。

```
puribooth/ui/fonts/
```

期待するファイル名:

- PopRumKiwi-Telop.ttf
- galmojigothicfree.ttf
- HitoriGothic.ttf
- HachiMaruPop-Regular.ttf

公式配布先はREADME.mdを参照してください。
未導入でもフォールバック書体で動作します。

## 7. 起動確認
サーバーコンソールで:

```
restart puribooth
puribooth_selftest
```

`selftest PASS` を確認してください。

## 8. 初回設置
weazel jobのプレイヤーで:

```
/puribooth place
```

設置後、料金・売上管理が必要なら:

```
/puribooth price 1000
/puribooth sales
```

詳細な確認項目は `ACCEPTANCE_TEST.md` を参照してください。
