# Weazel Photo Diary v1.0 — PAYMENT-PENDING

課金Adapter以外を固定した本番候補版です。

## 確定仕様
- 無料共有枠: 5人 / 1日記
- 課金ごとに +5人
- 5 → 10 → 15 → 20 → 25 → 30 → 35 → 40 → 45 → 50人
- 最大50人
- 現在は `Config.EnablePaidFeatures = false` のため追加購入は安全に無効
- 価格は未設定
- 既存共有データは維持し、現在枠を超えている場合は新規共有のみ制限

## 完成済み
Diary作成・編集・削除 / Gallery / Calendar / Memories / Birdy / Contacts / キャラクター分離 / 共有・解除 / Shared受信・削除 / 5〜50人共有枠ロジック / DB保存。

## 運営回答待ち
1. FlecityのFrameworkとキャラクター固有ID取得方法
2. `phone_phones.owner_id` が使用するキャラクター識別子
3. プレイヤー銀行口座の引落API
4. Weazel会社口座への入金API・会社識別子
5. 各+5人アップグレードの価格

決済接続までは `Config.EnablePaidFeatures = false` のまま使用してください。
