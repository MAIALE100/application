# WAVE v20 復元手順

## 適用前

初回のv19からの更新では`01_PLAN_ONLY.cmd`がPASSするまで適用しません。前回v20がすでに設置されている場合は、着信音連携の差分更新に`05_PATCH_RINGTONE_INTEGRATION.cmd`を使います。`CONFLICT_STOP`が出た場合は、他の作業による変更または異なる基準版の可能性があります。競合を上書きせず、ファイルの追加・削除・編集も行わず停止します。

## 復元

1. txAdminコンソールで`restart wave`を実行してWAVE利用を止めます。
2. `scripts\04_ROLLBACK_TEST.cmd`を実行します。
3. ログに`ROLLBACK PASS`があり、273ファイル全体のSHA256がv19基準に戻ったことを確認します。
4. txAdminコンソールで`restart wave`を実行します。
5. `wave_selftest`を実行します。

復元スクリプトは設置版が完全なv20マニフェストと一致する場合だけ動作します。更新後にWAVE外の変更や想定外ファイルが見つかった場合は、`CONFLICT_STOP`で停止します。

## 着信音連携の差分だけを戻す場合

1. txAdminコンソールで`restart wave`を実行してWAVE利用を止めます。
2. `scripts\07_ROLLBACK_RINGTONE_INTEGRATION.cmd`を実行します。
3. ログの`ROLLBACK PASS`と、前回v20マニフェスト274ファイルへの完全一致を確認します。
4. txAdminコンソールで`restart wave`を実行します。

この復元は`config/shared.lua`だけを前回v20の値へ戻し、274ファイルのフルバックアップと事前ハッシュが一致する場合だけ行います。WAVEリソース全体のv19復元には`04_ROLLBACK_TEST.cmd`を使います。どちらの復元でもDBとLB Phoneは変更しません。

## DB

更新によるDB変更は、追加の`wave_ringtones`テーブル作成とスキーマ版4への更新だけです。復元時はこのテーブルを残します。削除するとv20で保存された利用者設定を失うため、手動でDROPしないでください。既存の曲・プリセット・購入・収益データを戻す目的でDB全体を巻き戻す操作もしないでください。

この開発作業で採取した更新前WAVE DBバックアップは、作業フォルダー内の`work\wave-v20\db-backups`にあります。これはサーバー用ファイルバックアップとは別に保管し、ソース管理・公開ZIPへ含めません。完全性を確認できるまでは削除しません。
