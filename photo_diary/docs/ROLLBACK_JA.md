# 更新・ロールバック

## 更新
resourceを停止またはサーバー停止後にフォルダをバックアップし、新版へ置換して再起動します。今回のPAYMENT-PENDINGではDBスキーマ変更はありません。

## ロールバック
問題が発生した場合はresourceを停止し、バックアップした直前版へフォルダを戻して起動します。DBテーブルは削除しないでください。

## データ保護
`weazel_photo_diary_entries` / `weazel_photo_diary_shares` / `weazel_photo_diary_entitlements` をDROPしない限り、resourceファイルを戻してもDiaryデータは保持されます。
