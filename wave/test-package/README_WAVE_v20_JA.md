# WAVE v20 テスト更新パッケージ

## 概要

WAVE v19設置版を基準にした、テストサーバー専用の更新パッケージです。更新対象はWAVEリソース内の10ファイルだけです。本番Flecityサーバーには適用しないでください。

主な追加は、作者が利用を許可した公開曲から着信音区間を選び、フェードと音量を設定して試聴・保存する機能です。保存行はcitizenidで本人に結び付け、曲、購入履歴、売上記録とは別テーブルに置きます。曲を公開停止した場合や利用権がなくなった場合、設定は再生対象から外れますが原曲や購入記録は削除しません。

`resource/.wave-build.txt`に相当するリソース内ビルド記録はv19設置版由来です。承認済みv20更新対象外のため維持しており、現在のGitブランチやリリース識別子として使用しないでください。

この作業環境のテストサーバーにはv20を適用済みです。2026-11-08には、旧v20の274ファイル照合と全件バックアップ後、着信音カードの案内を直す3つのWebファイルだけを追加更新し、適用後の274ファイル照合とユーザー確認済みのWAVE単体再起動を完了しました。現在の設置版を確かめるときは`03_VERIFY_AFTER_UPDATE.cmd`を使います。`01_PLAN_ONLY.cmd`と`02_UPDATE_TEST.cmd`は、v19基準に一致する設置版への初回更新用です。v20設置済みの場所に再度Applyしないでください。違う版は競合として停止します。

## LB Phone 2.9.0との境界

テスト環境のLB Phoneはnative音声方式で、着信音カタログは電話リソース側の設定です。公式資料ではNUI着信音の追加に電話側の音声ファイル配置・設定変更・LB Phone再起動が必要とされています。これはWAVE単体更新の範囲外なので、電話リソースや設定には触れていません。

LB Phoneにはnative音を抑止する`playNativePhoneSound`チェックがあります。WAVE側に接続用コードはありますが、実際の着信で渡される音種とNUI音声が着信中も継続することを確認するまで`nativeIntegration=false`のままです。そのため、この版では着信音の選択・保存・試聴はできますが、実際の電話着信音の置換は未完了です。着信音置換を完了扱いしないでください。

「初期着信音を使用中」の状態では、WAVEは電話側の初期音を再生・試聴しません。LB Phoneの初期音設定にはWAVEから呼べる試聴APIを確認できなかったため、WAVEカードの試聴ボタンは無効です。着信音利用を作者が許可した公開曲を開いて区間を設定すると、WAVE内でその区間を試聴できます。初期音使用時にボタンが有効に見えて押しても反応しない表示を修正し、無効状態と案内文を明確にしました。FiveM実機では「Flecity Afterglow」の設定区間の試聴開始が画面に表示され、ユーザーが音声を確認しました。着信音選択はテストアカウントに残っています。実着信での置換は未検証です。

## 更新手順

1. 公開リポジトリから使う場合は、`scripts\WAVE_Test_Server.local.example.cmd`を`WAVE_Test_Server.local.cmd`にコピーし、テストサーバーのWAVEフォルダーとバックアップ先を設定します。このローカル設定ファイルには認証情報を書かないでください。公開ソースには含めません。
2. `scripts\01_PLAN_ONLY.cmd`を実行します。設置版273ファイルがv19基準と完全一致しなければ`CONFLICT_STOP`で停止します。
3. WAVE関連DBの保全バックアップを作成・確認します。今回の更新前バックアップは20テーブル・90行を含み、隔離した一時DBへの復元確認後に一時DBを削除済みです。個人・収益データを含むため、DBバックアップ本体はこのZIPに含めていません。
4. 計画がPASSした場合だけ`scripts\02_UPDATE_TEST.cmd`を実行します。更新前にWAVEリソース全体をバックアップし、コピー後の全274ファイルをSHA256照合します。
5. txAdminのサーバーコンソールで`restart wave`だけを実行します。`lb-phone`またはサーバー全体を再起動しません。
6. `wave_selftest`と`wave_diag`を実行し、さらに`scripts\03_VERIFY_AFTER_UPDATE.cmd`で全ハッシュを照合します。
7. 問題があれば`scripts\04_ROLLBACK_TEST.cmd`を実行し、その後`restart wave`を行います。

CMDは成功・失敗の両方を`logs`に保存し、キー入力までウィンドウを開いたままにします。

## DBの変更

WAVE起動時に`wave_ringtones`を`CREATE TABLE IF NOT EXISTS`で追加し、WAVEスキーマ版を4にします。既存の曲・プリセット・購入・収益テーブルは削除も再作成もしません。着信音設定テーブルには外部キーやカスケード削除を設定しません。アプリのロールバックでもこの追加テーブルや利用者の着信音設定は削除しないでください。

## 内容

- `payload`：許可リスト10ファイル
- `manifests\v19-baseline.json`：設置前の完全なSHA256一覧
- `manifests\v20-target.json`：更新後の完全なSHA256一覧
- `manifests\changed-files.json`：書き換え可能ファイルとSHA256
- `scripts`：計画・更新・検証・復元のCMDとPowerShell
- `tests`：着信音の回帰テストと更新・復元の隔離検証
- `docs`：LB Phone連携の確認結果と復元上の注意

展開したZIPでの回帰確認は`node --test tests/WAVE_v20_Regression.test.mjs tests/WAVE_v20_Ringtone.test.mjs`です。このZIPからの実行は34/34 PASSしました。`WAVE_v20_Updater.SmokeTest.ps1`は開発側にあるv19基準フィクスチャを使った更新・復元の隔離検証用です。

## 検証上の注意

自動テストやSHA256照合だけで、FiveM実機の音声出力をPASSにしません。実着信、電話を閉じた後のLibrary再生、ロック画面からの復帰、短時間の連続操作は、テストクライアントで個別に確認してください。未確認項目は同梱QAレポートのとおり保留です。

WAVEの`wave_selftest`はPASSし、コールバックは41/41登録されています。`wave_diag`はFXServerのメタデータキャッシュにより`0.3.5-test`と表示されますが、設置版の`fxmanifest.lua`は0.3.6-testの承認済みSHA256に一致しています。この表示差はQAレポートに記録しています。

公式資料：[LB Phone 着信音と通知音](https://docs.lbscripts.com/phone/configuration/ringtones-and-notifications/)、[LB Phone クライアントexports](https://docs.lbscripts.com/phone/exports/client-exports/)。
