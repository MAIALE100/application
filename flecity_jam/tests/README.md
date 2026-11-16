# Flecity JAMの試験

このファイルのコマンドは0.2.1-testのローカル試験です。件数やPASS/FAILは実行ごとの別添QAレポートで記録し、過去版の件数と合算しません。

リソースディレクトリで実行します。

| 対象 | コマンド | 注意 |
|---|---|---|
| モデル・音声ノード・MIDI単体 | `npm test` | FiveMや物理MIDI機器を使用しない |
| ブラウザー演奏・表示 | `npm run test:browser` | ローカルのChromium。FiveM CEFではない |
| 起動失敗・再試行・NUI状態 | `npm run test:lifecycle` | 隔離ChromiumでNUI通信を模擬 |
| 音源ハッシュ・音量境界 | `npm run test:levels` | `ffmpeg`が必要。ピアノv2/v4、ベース初期音域を数値で検査 |
| 配布・更新・復旧 | `npm run test:install` | 作業フォルダー内fixtureのみを使用し、実サーバーに書き込まない |

共通開発基盤の静的検査はリポジトリルートで `node devtools/flecity/cli.mjs test flecity_jam --suite static`。他アプリの試験や旧式の全アプリ自動更新を開始しないでください。

Luaのネイティブ検査は利用可能なLua 5.4環境で `lua5.4 tests/engine.lua`、`lua5.4 tests/client.lua` を実行します。このPCの通常のPATHにはLua実行ファイルが見つかっていません。Fengariによる代替はLua 5.3相当の模擬検査であり、ネイティブLua 5.4やFiveMのPASSとは分けて記録します。

ブラウザー試験は既存の `.flecity-dev/local.json` 設定、`JAM_PLAYWRIGHT_MODULE`、または導入済みPlaywrightを使います。`JAM_SOAK_SECONDS=120` で2分間の音声ソークを有効にできます。結果は `.flecity-dev/jam/browser/` に保存します。外部サーバーや実FiveMには接続しません。

実機の判定条件は[実機チェックリスト](../docs/LIVE_CHECKLIST_JA.md)を参照してください。過去の0.1.0-testでユーザーが聞いたメトロノームとピアノC4は、0.2.0-testの実機PASSではありません。5楽器の聴感、複数人合奏、距離・Bucket・途中参加、PTT、物理MIDI、Prop、FiveM負荷は証拠がそろうまでNOT_RUNです。
