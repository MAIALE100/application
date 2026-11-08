# WAVE v20 テスト更新パッケージ

## 概要

WAVE v19設置版を基準にした、テストサーバー専用の更新パッケージです。更新対象はWAVEリソース内の10ファイルだけです。本番Flecityサーバーには適用しないでください。

主な追加は、作者が利用を許可した公開曲から着信音区間を選び、フェードと音量を設定して試聴・保存する機能です。保存行はcitizenidで本人に結び付け、曲、購入履歴、売上記録とは別テーブルに置きます。曲を公開停止した場合や利用権がなくなった場合、設定は再生対象から外れますが原曲や購入記録は削除しません。

`resource/.wave-build.txt`に相当するリソース内ビルド記録はv19設置版由来です。承認済みv20更新対象外のため維持しており、現在のGitブランチやリリース識別子として使用しないでください。

この作業環境のテストサーバーにはv20を適用済みです。2026-11-08に、前回v20の274ファイル照合・全件バックアップ後、UI案内の3ファイルを差分更新し、さらに`config/shared.lua`だけを着信音連携用に更新しました。今回の差分も適用後274ファイルすべてを照合済みで、DBとLB Phoneは変更していません。2026-11-09にtxAdminでrestart waveを実行し、03:33:47にStarted resource waveと0.3.6-test READY_FOR_TESTを確認しました。wave_selftestはPASSし、wave_diagは0.3.6-test、callbacks 41/41、schema 4を報告しました。現在の設置版を確かめるときは`06_VERIFY_RINGTONE_INTEGRATION.cmd`を使います。`01_PLAN_ONLY.cmd`と`02_UPDATE_TEST.cmd`はv19からの初回更新用です。前回v20設置済みの場所に初回Applyをしないでください。違う版は競合として停止します。

## LB Phone 2.9.0との境界

テスト環境のLB Phoneはnative音声方式で、着信音カタログは電話リソース側の設定です。公式資料ではNUI着信音の追加に電話側の音声ファイル配置・設定変更・LB Phone再起動が必要とされています。これはWAVE単体更新の範囲外なので、電話リソースや設定には触れていません。

LB Phone 2.9.0の公式クライアントexportsには`AddCheck("playNativePhoneSound", handler)`があり、戻り値`false`でnative音を止められます。v20ではWAVE側の連携を有効にし、音種が`ringtone`で、利用者の選択・NUI・音声データがすべて準備できた場合だけWAVE音を鳴らします。音種が異なる場合や準備未完了時は`true`を返し、LB Phoneの音をそのまま通します。LB Phoneの設定にある`Config.Sound.Ringtones[*].soundSet = "ringtone"`を元にこの音種を設定していますが、実着信でチェックに渡る値とWAVE音への置換は更新後に再確認が必要です。再起動前の着信ではLB Phone初期音が鳴ったとユーザーから報告がありました。この観測は差分後の再起動より前の結果です。再起動後の音置換は次の実着信で確認します。

「初期着信音を使用中」の状態では、WAVEは電話側の初期音を再生・試聴しません。LB Phoneの初期音設定にはWAVEから呼べる試聴APIを確認できなかったため、WAVEカードの試聴ボタンは無効です。着信音利用を作者が許可した公開曲を開いて区間を設定すると、WAVE内でその区間を試聴できます。初期音使用時にボタンが有効に見えて押しても反応しない表示を修正し、無効状態と案内文を明確にしました。FiveM実機では「Flecity Afterglow」の設定区間の試聴開始が画面に表示され、ユーザーが音声を確認しました。着信音選択はテストアカウントに残っています。実着信での置換は未検証です。

## 更新手順

1. 公開リポジトリから使う場合は、`scripts\WAVE_Test_Server.local.example.cmd`を`WAVE_Test_Server.local.cmd`にコピーし、テストサーバーのWAVEフォルダーとバックアップ先を設定します。このローカル設定ファイルには認証情報を書かないでください。公開ソースには含めません。
2. まだv19の設置版なら`scripts\01_PLAN_ONLY.cmd`を実行します。設置版273ファイルがv19基準と完全一致しなければ`CONFLICT_STOP`で停止します。すでに前回v20が設置されている場合は初回更新CMDを実行せず、後述の差分更新を使います。
3. WAVE関連DBの保全バックアップを作成・確認します。今回の更新前バックアップは20テーブル・90行を含み、隔離した一時DBへの復元確認後に一時DBを削除済みです。個人・収益データを含むため、DBバックアップ本体はこのZIPに含めていません。
4. 計画がPASSした場合だけ`scripts\02_UPDATE_TEST.cmd`を実行します。更新前にWAVEリソース全体をバックアップし、コピー後の全274ファイルをSHA256照合します。
5. txAdminのサーバーコンソールで`restart wave`だけを実行します。`lb-phone`またはサーバー全体を再起動しません。
6. `wave_selftest`と`wave_diag`を実行し、さらに`scripts\03_VERIFY_AFTER_UPDATE.cmd`で全ハッシュを照合します。
7. 問題があれば`scripts\04_ROLLBACK_TEST.cmd`を実行し、その後`restart wave`を行います。

### すでに前回v20を設置しているテストサーバー

`scripts\05_PATCH_RINGTONE_INTEGRATION.cmd`は、更新前のv20全274ファイルが`manifests\v20-pre-ringtone-integration.json`と完全一致する場合だけ、WAVEの`config/shared.lua`だけを更新します。全リソースのバックアップを作成・照合してから適用します。更新後は`scripts\06_VERIFY_RINGTONE_INTEGRATION.cmd`で全274ファイルを照合し、txAdminで`restart wave`だけを行ってください。競合時は`CONFLICT_STOP`で停止し、ファイルを書き換えません。ロールバックは`scripts\07_ROLLBACK_RINGTONE_INTEGRATION.cmd`を使います。既存データやDBは変更しません。

CMDは成功・失敗の両方を`logs`に保存し、キー入力までウィンドウを開いたままにします。

## DBの変更

WAVE起動時に`wave_ringtones`を`CREATE TABLE IF NOT EXISTS`で追加し、WAVEスキーマ版を4にします。既存の曲・プリセット・購入・収益テーブルは削除も再作成もしません。着信音設定テーブルには外部キーやカスケード削除を設定しません。アプリのロールバックでもこの追加テーブルや利用者の着信音設定は削除しないでください。

## 内容

- `payload`：許可リスト10ファイル
- `manifests\v19-baseline.json`：設置前の完全なSHA256一覧
- `manifests\v20-target.json`：更新後の完全なSHA256一覧
- `manifests\changed-files.json`：書き換え可能ファイルとSHA256
- `scripts`：v19からの初回更新、および前回v20からの安全な差分更新・検証・復元
- `tests`：着信音の回帰テストと更新・復元の隔離検証
- `docs`：LB Phone連携の確認結果と復元上の注意

展開したZIPでの回帰確認は`node --test tests/WAVE_v20_Regression.test.mjs tests/WAVE_v20_Ringtone.test.mjs`です。Node回帰は34件、差分更新の適用・全件照合・復元・競合停止は`powershell -NoProfile -ExecutionPolicy Bypass -File tests/WAVE_v20_RingtonePatch.SmokeTest.ps1`で隔離検証します。`WAVE_v20_Updater.SmokeTest.ps1`は開発側にあるv19基準フィクスチャを使った初回更新・復元の隔離検証用です。

## 検証上の注意

自動テストやSHA256照合だけで、FiveM実機の音声出力をPASSにしません。Library再生、電話を閉じた後の再生継続、ロック画面復帰はユーザー確認済みです。WAVE着信音連携差分後にWAVEだけを再起動し、起動・wave_selftest・wave_diagはPASSしました。ユーザーが報告したLB Phone初期音の着信はこの再起動前の観測です。再起動後にWAVE選択音が着信音として鳴るかは未確認で、次の実着信で確認します。

2026-11-09の着信音差分後の再起動で`wave_selftest`はPASSしました。`wave_diag`は`0.3.6-test`、callbacks 41/41、schema 4、artists 3、tracks 4、public tracks 4を報告しました。実着信でのWAVE音置換は、この再起動後の着信テスト待ちです。

公式資料：[LB Phone 着信音と通知音](https://docs.lbscripts.com/phone/configuration/ringtones-and-notifications/)、[LB Phone クライアントexports](https://docs.lbscripts.com/phone/exports/client-exports/)。
