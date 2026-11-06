# FLEPURI v1.0.7 導入手順

## 1. FLEPURI本体

提出ZIP内の `puribooth` をFiveMサーバーのresources配下へ配置してください。

例:

```
resources/[flecity]/puribooth/
```

## 2. PuriPhoto互換性

FLEPURI v1.0.7 は **PuriPhoto 1.1.0+** に加えて、FLEPURI booth-import bridgeがproduction UIへ入っていることを要求します。

提出互換版は **PuriPhoto v1.1.1** です。

既存PuriPhotoを使う場合は `PURIPHOTO_COMPAT.md` を参照してください。古いproduction bundleを検出した場合、FLEPURIは料金を引かず撮影開始を止めます。

## 3. 必要リソース

- qbx_core（FLEPURIはリソース版番号ではなく必要exportsを実体確認）
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

初回起動時に `puribooth_booths` / `puribooth_events` / `puribooth_refunds` / `puribooth_collections` を自動作成し、既存DBへ不足列があれば自動追加します。selftestは必要列と保守テーブルの存在まで確認します。

## 5. Weazel権限

Weazel所属者に加えて、既定ではACE `group.admin` / `group.god` を持つ運営権限者も管理コマンドを実行できます。ただし、**売上回収だけはWeazel jobの最上位grade（オーナー）のみ**実行でき、ACEでは回避できません。

既定:

```lua
Config.Management.job = "weazel"
```

### Routing bucket

設置済み台は既存DB形式のまま維持され、追加の列やマイグレーションはありません。既定の `Config.BoothRoutingBucket = 0` では、台の利用・撮影セッション・テーマ・カウントダウン・管理操作をrouting bucket 0に限定します。別instanceで同じ座標にいる利用者は台の操作や進行中セッションに干渉できません。値を変更する場合は全台がそのbucketに属する運用として扱われます。台ごとのbucket分離はこの版では対応していません。

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

既定ではRenewed-Bankingの `weazel` 会社口座へ入金します。環境ごとの銀行resource名・job名・口座名は独立して指定します。

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

運営側がokokBankingV2を使う環境では、`GetAccount` / `AddMoney` は `okokBanking`、取引履歴 `AddTransaction` は公式ドキュメント上 `okokBankingV2` の別exportです。導入版で異なる場合は実在するexport名に合わせて `transactionResource` を明示してください。job名は `reporter` など設置環境に合わせます。口座IDはjob名と同一とは限らないため、既存口座名を確認して `Config.Payout.account` に明示します。

API参照: https://docs.okokscripts.io/scripts/okokbankingv2/exports

```lua
Config.Management.job = "reporter"
Config.Management.ace = "admin"
Config.Payout = {
    enabled = true,
    mode = "okok-banking",
    resource = "okokBanking",
    transactionResource = "okokBankingV2",
    account = "<既存の会社口座ID>",
    transactionTitle = "FLEPURI売上"
}
```

この例の口座IDとexport名は環境依存です。実際の値と `AddMoney` の成功戻り値が確認できるまでは設定・テスト回収をしないでください。成功を `true` で確認できない場合、実装は `paying` のまま保守照合へ回し、二重送金を避けます。

`/puribooth collect all` / `/puribooth collect <台ID>` は、QBoxのWeazel job定義から最上位gradeを動的に判定し、そのオーナーgradeだけに許可します。

回収時は会社口座残高へ加算し、可能な場合は銀行取引履歴にもFLEPURI売上として記録します。銀行側が明確な失敗を返した場合は、確保した未回収売上を各台へ戻します。銀行呼び出しが例外終了して結果不明の場合は `paying` のまま保持し、残高を戻したり再送金したりしません。銀行履歴を照合して保守コマンドで確定してください。

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

になれば依存・PuriPhoto receipt bridge・会社口座・DB・会計整合性・未解決返金/売上回収・設定の事前検査は合格です。

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
puribooth_refund_review <session_id> <resolved|retry>
puribooth_collections
puribooth_collection_retry <collection_id>
puribooth_collection_review <collection_id> <paid|notpaid>
```

`pending` 返金は通常60秒ごとに自動再試行されます。
`processing` は「QBoxへの返金呼び出し後、DB確定前に異常終了した可能性」があるため、自動再試行せず手動照合してください。

会社売上回収の `paying` も銀行呼び出し結果が不明な状態です。利用中の銀行履歴を確認して `puribooth_collection_review <collection_id> <paid|notpaid>` で確定します。`finalizing` / `restoring` / `finalizing_retry` / `restoring_retry` は `puribooth_collection_retry <collection_id>` で銀行へ再送金せずDB処理だけを再試行できます。回復中の同じコマンドや、新しい回収との同時実行は拒否されます。
