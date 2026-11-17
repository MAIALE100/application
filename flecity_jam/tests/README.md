# Flecity JAMの試験

このファイルのコマンドは0.3.1-test候補のローカル試験です。件数やPASS/FAILは実行ごとの別添QAレポートで記録し、過去版の件数と合算しません。

リソースディレクトリで実行します。

| 対象 | コマンド | 注意 |
|---|---|---|
| モデル・音声ノード・MIDI単体 | `npm test` | FiveMや物理MIDI機器を使用しない |
| ブラウザー演奏・表示 | `npm run test:browser` | ローカルのChromium。FiveM CEFではない |
| 白黒25音・旧18/36音・移行・表示 | `npm run test:keyboard` | 実キーボード・ポインターを使用するローカルChromium。FiveM側のキー競合を証明しない |
| 起動失敗・再試行・NUI状態 | `npm run test:lifecycle` | 隔離ChromiumでNUI通信を模擬 |
| 音源ハッシュ・音量境界 | `npm run test:levels` | `ffmpeg`が必要。ピアノv2/v4、ベース初期音域を数値で検査 |
| 配布・更新・復旧 | `npm run test:install` | 作業フォルダー内fixtureのみを使用し、実サーバーに書き込まない |

共通開発基盤がある環境ではリポジトリルートで `node devtools/flecity/cli.mjs test flecity_jam --suite static`。共通基盤を含まないJAM専用checkoutでは上記の単独コマンドを使います。他アプリの試験や旧式の全アプリ自動更新を開始しないでください。

Luaのネイティブ検査は利用可能なLua 5.4環境で `lua5.4 tests/engine.lua`、`lua5.4 tests/client.lua` を実行します。既存の `.flecity-dev/tools/lua-5.4.8-verified/lua54.exe` を使用できます。件数は候補ごとのQAで確認します。ネイティブLuaで実行してもFiveMのAPIはモックです。FengariはLua 5.3相当の別実行環境であり、件数を重複加算しません。

ブラウザー試験は既存の `.flecity-dev/local.json` 設定、`JAM_PLAYWRIGHT_MODULE`、または導入済みPlaywrightを使います。`JAM_SOAK_SECONDS=120` で2分間の音声ソークを有効にできます。結果は `.flecity-dev/jam/browser/` に保存します。外部サーバーや実FiveMには接続しません。

実機の判定条件は[実機チェックリスト](../docs/LIVE_CHECKLIST_JA.md)を参照してください。過去版の聴取PASSを新しい版へ繰り越しません。0.3.1の打鍵・U/J競合、通常操作への復帰、PTT・無線、音声出力はユーザーのノートPCで確認します。デスクトップFiveMは起動しません。複数人合奏、距離・Bucket・途中参加、物理MIDI、Prop、FiveM負荷も証拠がそろうまでNOT_RUNです。

追加対象は25音の白鍵／黒鍵対応、Z/Xの発音と↑↓音域変更の分離、N等の予約、旧v1/v2文字列を変更しないv3コピー、旧カスタム配列の選択維持、旧標準36音から新標準25音への初期表示です。新旧プリセットで和音・長押し・サステイン・MIDI・表示操作を確認します。
