# WAVE v20 テスト版

このブランチは、WAVE v19のテスト設置版と照合して作ったv20のテスト用ソースです。`resource`がv20リソース全体、`base-v19`が更新前の照合・ロールバック用基準、`test-package`が更新・検証一式です。

## 状態

- テストサーバーにはv20を適用し、WAVE単体再起動後の自己診断と274ファイルのSHA256照合がPASSしています。
- 自動テストはv20 33/33、既存v19 18/18、更新・検証・ロールバックの隔離試験がPASSしています。
- LB Phoneの着信音そのものへの差し替え、NUI上での音声、電話を閉じた後の再生、ロック画面復帰などは、実機UI試験が済むまで未検証です。`nativeIntegration`はfalseです。
- 既存の`main`と`wave/dev`はこのブランチから変更していません。
- `resource/.wave-build.txt`はv19設置版由来のビルド記録で、承認済みv20差分の対象外のためそのまま保持しています。Gitブランチの現在版を示すファイルではありません。

## テスト

`test-package`で次を実行します。

```powershell
node --test tests/WAVE_v20_Ringtone.test.mjs tests/WAVE_v20_Regression.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/WAVE_v20_Updater.SmokeTest.ps1
```

更新CMDを使う場合は、`scripts/WAVE_Test_Server.local.example.cmd`を`WAVE_Test_Server.local.cmd`へコピーし、テスト環境のパスだけを設定してください。ローカル設定とログはGitで管理しません。本番サーバーには適用しないでください。

## 音源ライセンス

WAVEに同梱するサンプルの由来と許諾は`resource/web/samples`内の日本語資料に記載しています。CC0素材のほか、アコースティックドラムにはCC BY 4.0の帰属表示を同梱しています。素材を再配布する際は該当する帰属表示も維持してください。DBダンプ、認証情報、個人用作業フォルダー、ローカルサーバーログは含めていません。

詳細は[`test-package/README_WAVE_v20_JA.md`](test-package/README_WAVE_v20_JA.md)、[`test-package/docs/WAVE_v20_QA_REPORT_JA.json`](test-package/docs/WAVE_v20_QA_REPORT_JA.json)、[`resource/web/samples`](resource/web/samples)を参照してください。
