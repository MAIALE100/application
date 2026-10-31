# Lua導入・BASE/LINK UI検証・実機準備

2026-10-30 日本時間。前回報告のLua/NUI未実施事項についての続報です。

## Luaの検証と導入

- 入力：C:\Users\suivx\Downloads\lua-5.4.8_Win64_bin.zip、377,674 bytes。
- 正常なZIP。登録4ファイル以外がないこと、パス逸脱がないこと、展開サイズを確認。
- Zone.Identifierにsourceforge.netの参照元とtwds.dl.sourceforge.netの配布元を確認。追跡クエリー文字列は記録しない。
- SHA-256は[公開配布ページ](https://sourceforge.net/projects/luabinaries/files/5.4.8/Tools%20Executables/lua-5.4.8_Win64_bin.zip/download)の値に一致：
  20321e893509e575d2454dd7bbf05342c1f3cb1b3788c0ec5a55ae4279dde169
- lua54.exe、luac54.exe、lua54.dllのPEヘッダーはAMD64。Windows 64bit形式を確認してから実行。
- .flecity-dev/tools/lua-5.4.8-verifiedに展開。実行ファイル・コンパイラーとも Lua 5.4.8。local.jsonへ登録し、システムPATHは変更していない。
- 原本ZIPはDownloadsに保持。検証記録は展開先provenance.json。wlua54.exeは起動していない。

## 実行した検査

| 対象 | 結果 |
| --- | --- |
| 全7登録プロジェクト | 静的スイートPASS。合計59 Luaファイルの構文検査を実行 |
| BASE | 既存Lua自由項目回帰PASS、既存JS回帰PASS、スキーマ/39 callbacks/CSS整合PASS |
| LINK | 実際のparty_fall.luaとrate_limit.luaを独立Luaプロセスでロードし、14項目PASS。時計だけをmock。DB・QBox・課金処理はロードしない |
| BASEブラウザ | 読込、在庫不足フィルター、日本語メモ検索、HTMLエスケープ、ワークスペース切替時の検索リセット、MEMBERのUI制限、360幅の横はみ出しを検査しPASS |
| LINKブラウザ | 読込、ルームコード数字制限、不存在ルームのエラー表示、作成、準備前の開始禁止、準備切替、360幅を検査しPASS |
| ブラウザ安全性 | 別originへのHTTP/WebSocketが実際に届かないこと、意図的失敗がFAILとなりPNGを残すことを実ブラウザで確認 |
| 共通基盤 | 40テストPASS、fail 0、skip 0。上記の意図的失敗は検査対象であり、基盤テストの失敗ではない |
| BASE候補の使い捨てDB | 再投入・外部キー失敗rollback・12同時更新と履歴PASS。起動した専用DBの正常終了も確認 |
| 実FiveM統合 | NOT_RUN。現在の稼働状態は読み取りGETで確認しただけ |

ブラウザはデスクトップ同梱Playwright 1.62.1と既存Chromeの新規一時プロファイルを利用。NUI応答はすべて合成データです。実際のLB Phone、FiveMのCEF、Luaハンドラー、権限認証、複数人通信が成功したとは扱いません。実際に使ったChromeのバージョン、画像、コンソールは実行結果に保存します。

アプリ本体の不具合は今回の実行範囲では見つかりませんでした。最初のUI試験では、テスト側の統計カード数とmaxlength適用後の入力値の想定が実装に合っていなかったため、画面とコードを確認して試験を修正しました。元アプリを試験に合わせて変更していません。

共通基盤では、同梱Playwrightの指定、準備hook、WebSocket遮断、成功画面・ブラウザ版・コンソール保存を追加しました。起動に失敗したときも設定済み試験を未実施で隠さずFAILと記録します。

## BASEのローカル候補

前の検査用抜粋からの直接配置ではREADME等4ファイルが削除される問題を避けるため、配置済みBASEを読み取りコピーし、監査済みソースをローカルで重ねました。配置済みファイルと改行だけが異なる部分は元のバイト列を保持しています。

- 保存先：.flecity-dev/candidates/base/63fbb4c8-91af-4db2-b4df-f1a11b6ced47/flecity_base
- 変更：server/custom_fields.lua、server/database.lua、TESTING.md。
- 追加：tests/custom-fields.luaと作業指示・引継ぎ・CI記録の3文書。
- ACCESS.md、INSTALL.md、OPERATOR_GUIDE.md、README.mdは保持。削除0件。
- 実コードの2差分は既存PR #7の修正で、今回新しく再実装していない。
- 正式な最新Git checkoutと同一だとは主張しない。来歴・全ファイルハッシュはcandidate.jsonと計画へ保存。
- 候補自体で静的検査、Lua回帰、ブラウザ、使い捨てDB検査を再実行済み。
- 更新計画：7748ed07-beb3-41c9-9bee-74b100f0d746。候補レビュー待ちであり、適用していない。

LINKは配置済みflecity_gamesのコピーを検査しており、現在ファイル変更は提案していません。LINKとLOOPはリソース共有のため、再起動すれば両方に影響します。

## 実機準備と停止点

preflight base / preflight linkを追加しました。対象パス、アクティブtxAdminプロファイル、検査済みソースハッシュ、localhostのinfo.jsonを照合します。現在、対象リソース・qbx_core・oxmysql・lb-phoneがinfo.jsonに報告されていることを確認しました。サーバーコマンド・txAdmin操作は実行していません。

実機試験を開始するには、次のどちらかを決める必要があります。

1. 別のFiveM実行環境と専用DBで行う。必要なライセンス・接続方法・テストキャラクターを用意する。
2. 現在のテストサーバーで行う。DBバックアップと復元方法を確認し、BASE限定更新・再起動と、BASE/LINKによるテストデータ作成を明示的に許可する。

いずれも現時点では未承認です。現在のDBが完全に使い捨てだとは確認できておらず、BASEの起動や初回表示でもDB更新があり得るため、実機コマンドの実行前で止めています。

deploymentEnabledはfalseのままです。既存サーバーの停止・再起動・更新、既存DBへの接続・書込、他リソースの変更、GitHubへの反映はしていません。専用DBの故障注入は共通ツールが新規作成したdatadir/named pipeだけを使用しています。

実機操作案は各preflight実行フォルダーのmanual-steps.mdに保存。全体再起動・他リソース再起動・本番接続を含みません。データ変更を伴わない準備はここまで完了しています。

最新画面：[BASE](D:/FiveM_Dev/application/.flecity-dev/projects/base/runs/2026-10-30T14-25-27-192Z-d226e4/screenshots/nui-success.png) / [LINK](D:/FiveM_Dev/application/.flecity-dev/projects/link/runs/2026-10-30T14-25-29-103Z-ddce63/screenshots/nui-success.png)
