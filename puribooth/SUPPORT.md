# FLEPURI v1.0.3 保守・不具合対応

FLEPURIのコード修正・不具合対応は開発側で行います。
運営側にLua / NUI / DB修正を依頼する前提ではありません。

## 運営から共有してもらう情報

不具合報告時は、可能な範囲で次だけ共有してください。

- 発生した日時
- 対象プレイヤーのcitizenid（CSN）
- 対象フレプリ台ID（分かる場合）
- 何をした時に何が起きたか
- 画面またはコンソールのエラー（出ている場合）

コードやDBを運営側で直接編集してもらう必要はありません。

## 開発側の一次診断

サーバーコンソール:

```
puribooth_selftest
puribooth_support
puribooth_support <session_id または citizenid>
puribooth_refunds
puribooth_collections
```

`puribooth_support <citizenid>` では、直近の課金・売上・返金イベントを追跡できます。会社売上回収は `puribooth_collections` で未解決状態を確認できます。

## 返金事故

通常の返金export失敗は `puribooth_refunds` に `pending` として保存され、
既定60秒ごとに自動再試行されます。

`processing` は、QBoxへ返金要求を送った後にDB確定できなかった可能性がある状態です。
二重返金を避けるため自動再試行しません。
実際の残高 / 取引履歴を照合してから開発側で処理します。

照合後:
```
puribooth_refund_review <session_id> resolved
puribooth_refund_review <session_id> retry
```

## 会社売上回収事故

会社売上回収は `puribooth_collections` に記録します。

- `finalizing`: 会社口座入金済み。DBの回収確定だけ再試行可能
- `restoring`: 会社口座入金失敗済み。台残高の復元だけ再試行可能
- `paying`: 銀行呼び出し中に停止した可能性があり、入金有無が不明

```
puribooth_collections
puribooth_collection_retry <collection_id>
puribooth_collection_review <collection_id> paid
puribooth_collection_review <collection_id> notpaid
```

`paying` の場合だけRenewed-Banking履歴を先に照合します。`paid` / `notpaid` を確定するまで銀行への再送金は行いません。未解決回収がある間は、新しい売上回収と台撤去を自動停止します。

## 更新方針

通常のFLEPURI修正はサーバー全体を再起動せず、

```
restart puribooth
```

で反映します。

PuriPhoto bridgeも変更した場合だけ、

```
restart puriphoto
restart puribooth
```

を使用します。

更新前に未完了セッションがある場合、FLEPURIは可能な限り返金処理を行います。

## ロールバック

不具合修正版で重大な問題が出た場合は、直前のrelease branchへ戻して
`puribooth` のみ再起動します。

v1.0.2の直前安定版:
- `release/flepri-v1.0.1`

DB追加テーブル（`puribooth_events` / `puribooth_refunds`）は残っていても
v1.0.1の動作を妨げません。

## 保守ログ

- `puribooth_events`: 課金 / 売上 / 返金の追跡
- `puribooth_refunds`: 未解決返金の復旧管理
- `puribooth_collections`: 会社売上回収のクラッシュ復旧管理
- 既定保持期間: 90日

保持期間は `Config.SupportHistoryDays` で変更できます。
