# Flecity JAMの試験

0.4.2-testでは単体60件（model26/audio10/deferred10/MIDI14）、Lua engine28/client27、Chromium17（soak有効時）、NUI12、keyboard24、voice16、usability14、mix12、音源9、installer14を固定候補で再実行します。全233件を想定し、最終件数はstability-20261118/QA/に記録します。NUI／Luaはモック、音声計測は生成音でFiveM実音声ではありません。

0.4.1-testは0.4.0の204件を引き継がず、全スイートを新候補へ再実行します。追加はサステインkeyup／楽器切替capture／select連続操作、MIDI port交換、受信期限・時計巻戻り、全8楽器128同音の出力範囲と同一信号分岐による通常レベルのPCM比較です。Lua静的ランナーの期待値はengine28/client27。Native Lua試験もFiveM APIはモック、ChromiumとPCMも実FiveMの音質・VC・CEF性能の証拠ではありません。最終件数・ソース・ログは別添hardening-20261118/QA/で固定します。

このファイルは0.4.0-test候補のローカル試験です。件数・ソース不変・PASS/FAILは別添`rc-polish-20261118/QA/`へ実行ごとに記録し、旧165 PASSやユーザーの実機報告を候補へ繰り越しません。

リソースディレクトリで実行します。

| 対象 | コマンド | 注意 |
|---|---|---|
| モデル・音声ノード・MIDI単体 | `npm test` | FiveMや物理MIDI機器を使用しない |
| ブラウザー演奏・表示 | `npm run test:browser` | ローカルのChromium。FiveM CEFではない |
| 白黒25音・旧18/36音・移行・表示 | `npm run test:keyboard` | 実キーボード・ポインターを使用するローカルChromium。FiveM側のキー競合を証明しない |
| 起動失敗・再試行・NUI状態 | `npm run test:lifecycle` | 隔離ChromiumでNUI通信を模擬 |
| 通常PTTの保持・解放 | `node tests/voice-browser.mjs` | マイク・実通話相手を使わない |
| 演奏者別の聴取音量 | `node tests/mix-browser.mjs` | 自分だけの受信楽器音。実複数人の証明ではない |
| 音源ハッシュ・音量境界 | `npm run test:levels` | `ffmpeg`が必要。ピアノv2/v4、ベース初期音域を数値で検査 |
| 配布・更新・復旧 | `npm run test:install` | 作業フォルダー内fixtureのみを使用し、実サーバーに書き込まない |

共通開発基盤がある環境ではリポジトリルートで `node devtools/flecity/cli.mjs test flecity_jam --suite static`。共通基盤を含まないJAM専用checkoutでは上記の単独コマンドを使います。他アプリの試験や旧式の全アプリ自動更新を開始しないでください。

Luaのネイティブ検査は利用可能なLua 5.4環境で `lua5.4 tests/engine.lua`、`lua5.4 tests/client.lua` を実行します。既存の `.flecity-dev/tools/lua-5.4.8-verified/lua54.exe` を使用できます。件数は候補ごとのQAで確認します。ネイティブLuaで実行してもFiveMのAPIはモックです。FengariはLua 5.3相当の別実行環境であり、件数を重複加算しません。

ブラウザー試験は既存の `.flecity-dev/local.json` 設定、`JAM_PLAYWRIGHT_MODULE`、または導入済みPlaywrightを使います。`JAM_SOAK_SECONDS=120` で2分間の音声ソークを有効にできます。結果は `.flecity-dev/jam/browser/` に保存します。外部サーバーや実FiveMには接続しません。

実機条件は[実機チェックリスト](../docs/LIVE_CHECKLIST_JA.md)を参照。0.4.0の8楽器・個別音量・VC双方向・操作復帰・15m共有はノートPCで確認し、デスクトップFiveMは起動しません。送信表示と相手の聴取を分け、実機項目は証拠がそろうまでNOT_RUNです。

追加対象は25音の白鍵／黒鍵対応、Z/Xの発音と↑↓音域変更の分離、N等の予約、旧v1/v2文字列を変更しないv3コピー、旧カスタム配列の選択維持、旧標準36音から新標準25音への初期表示です。新旧プリセットで和音・長押し・サステイン・MIDI・表示操作を確認します。

0.3.2ではN／会話ボタンの保持・解放、200ms更新・900ms期限、世代・seq、古い応答、blur／終了／死亡／再起動の解放をクライアント模擬と隔離ブラウザーで確認します。マイク有効化・無効コントロールの有効化・Voiceミュート操作を追加しないことを監査します。Range15の二乗減衰と境界外0、二重減衰防止を数値確認し、実際の聴感PASSと区別します。

更新fixtureは設定差分の無指定・誤SHA拒否、レビュー済みincoming SHAでの適用、設置版競合、設定を含む全体復旧と合法なライセンスMDの同梱・QA除外を確認します。CLI試験はコピーと独立STATEを使い、実サーバーへ書き込みません。旧58音源・設定・出典を保持し、新33録音を加えた91件のハッシュ・実音程・ループ・音量・PCM容量を確認します。

0.4.0ではPC／マウスvelocityとMIDI値の分離、ガイドと追加v3項目、設定開閉時の保持音、ポインター後のSpaceを検証します。MIDI同時要求の一本化・旧ハンドラ清掃・拒否後再試行も追加対象です。一部音源の準備失敗後も後続を読み込むことと、選択時に再試行できることを確認します。

個別聴取音量は0～100%、旧セッションへだけ作用し、同じセッションの欠落再同期や音声slot再作成では維持、新しいセッションは100%へ戻ることを確認します。停止・明示expire・clearで行が残らず、ほかの行の退場で操作中のスライダーフォーカスを失わないことも対象です。Voiceや送信volumeの変更は許可しません。
