# FLEPURI v1.0.2 導入手順

## 1. FLEPURI本体

提出ZIP内の `puribooth` をFiveMサーバーのresources配下へ配置してください。

例:

```
resources/[flecity]/puribooth/
```

## 2. PuriPhoto互換性

FLEPURI v1.0.2 は **PuriPhoto 1.1.0+** に加えて、FLEPURI booth-import bridgeがproduction UIへ入っていることを要求します。

提出互換版は **PuriPhoto v1.1.1** です。

既存PuriPhotoを使う場合は `PURIPHOTO_COMPAT.md` を参照してください。古いproduction bundleを検出した場合、FLEPURIは料金を引かず撮影開始を止めます。

## 3. 必要リソース

- qbx_core 2.5.4+
- oxmysql
- lb-phone
- screenshot-basic
- puriphoto 1.1.0+ + FLEPURI bridge
- Renewed-Banking（既定の会社口座回収を使う場合）

起動順:

```
ensure qbx_core
ensure oxmysql
ensure lb-phone
ensure screenshot-basic
ensure puriphoto
ensure puribooth
```

既存server.cfgの管理方針がある場合は、その依存順を保ったまま `puribooth` をPuriPhotoより後に起動してください。

## 4. DB

手動SQLは不要です。

初回起動時に `puribooth_booths` / `puribooth_events` / `puribooth_refunds` を自動作成し、既存DBへ不足列があれば自動追加します。selftestは必要列と保守テーブルの存在まで確認します。

## 5. Weazel権限

既定:

```lua
Config.Management.job = "weazel"
```

設定可能:

- placeMinGrade
- removeMinGrade
- priceMinGrade
- salesMinGrade
- requireOnDuty
- salesRequireLocation
- salesCoords
- salesDistance

## 6. 売上回収

既定ではRenewed-Bankingの `weazel` 会社口座へ入金します。

```lua
Config.Payout = {
    enabled = true,
    mode = "renewed-banking",
    resource = "Renewed-Banking",
    account = "weazel",
    transactionTitle = "FLEPURI売上"
}
```

selftestはRenewed-Bankingの起動だけでなく、`weazel` 口座が実際に取得できることも確認します。

回収時は会社口座残高へ加算し、銀行取引履歴にもFLEPURI売上として記録します。残高加算に失敗した場合は、確保した未回収売上を各台へ戻します。

## 7. フォント

フォント本体は提出ZIPへ同梱しません。

配置先:

```
puribooth/ui/fonts/
```

期待ファイル名:

- PopRumKiwi-Telop.ttf
- galmojigothicfree.ttf
- HitoriGothic.ttf
- HachiMaruPop-Regular.ttf

未導入でもフォールバック書体で動作します。selftestでは `fonts=OPTIONAL(n/4)` と表示しますが、全体FAILにはしません。

## 8. 起動確認

サーバーコンソール:

```
restart puriphoto
restart puribooth
puribooth_selftest
```

最上段が:

```
[puribooth] selftest PASS
```

になれば依存・PuriPhoto bridge・会社口座・DB・設定の事前検査は合格です。

FAIL時は直下に `FIX:` が表示されます。

## 9. 初回設置

weazel job:

```
/puribooth place
/puribooth price 1000
/puribooth sales
```

最後に `ACCEPTANCE_TEST.md` の実機テストを実施してください。不具合修正・更新の担当は開発側です。運営からの報告項目は `SUPPORT.md` にまとめています。


## 10. 保守コマンド

不具合・返金問い合わせ時はサーバーコンソールで:

```
puribooth_support
puribooth_support <session_id または citizenid>
puribooth_refunds
puribooth_retry_refunds
```

`pending` 返金は通常60秒ごとに自動再試行されます。
`processing` は「QBoxへの返金呼び出し後、DB確定前に異常終了した可能性」があるため、自動再試行せず手動照合してください。
