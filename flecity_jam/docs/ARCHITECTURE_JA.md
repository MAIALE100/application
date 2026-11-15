# 調査・設計判断

## 作業範囲と環境

2026-11-16の総合指示によりJAMのみ開発を再開。他アプリ、既存の未コミット変更、設置版、DB、停止中の開発スケジュールを保持します。共通基盤のnew/register、検査、checkpointを利用し、既存OS mutexを保有してJAMを分離開発。旧全アプリ自動実行は起動しません。

ローカルはNode 24.22.0、既存Playwright/Chrome、Fengari、luaparse、FFmpegを使用。既存Lua 5.4.8実行ファイルはこの実行環境でDLL再配置エラーのため利用できず、ネイティブ5.4実行を成功扱いしません。ブラウザーのHTTP接続も制限されたため、試験対象のローカルファイルをPlaywrightへ直接供給して検証しています。

既存テストサーバーの読み取り調査でpma-voice manifestは7.0.1、通常距離の既定値はnative audio有効時3m／それ以外7mでした。実際に有効なconvarと正式Flecity環境は未確認。資格情報を含むserver.cfgは読んでいません。JAMはRange=7mの独立設定で実装し、pma-voice内部を変更しません。

## 実装順序と選択

1. ネットワーク非依存のLua状態機械とテスト。
2. PC鍵盤・NUI・録音音源のリアルタイム再生。
3. サーバーの距離／Bucket／権限検査と復旧プロトコル。
4. ブラウザーの操作・発音・解像度・音声クリーンアップ試験。
5. MIDI、アイテム窓口、資料、ハッシュ付きテストZIP。
6. 未実施の実FiveM試験を分離して記録。

ローカルのUI/UX Pro Maxを使い、視認性、フォーカス、キー競合、縮小、操作状態を点検。一般的な音楽サイト向け推薦は演奏画面に適さなかったため採用せず、濃色パネル・明るい鍵盤・薄緑の押下表示・常時見える終了／消音を優先しました。Ponytailの方針を実装へ反映し、ビルドフレームワーク、DB、Voice改造、独自サービス、将来WAVE用の過剰なAPIは追加していません。

## 音と同期

マイクへ音を混ぜず、音符情報だけをFiveM NetEventで配信します。本人はPC入力から直接Web Audioへ発音し、ネットワーク往復を待ちません。音源の初回準備は演奏開始前に完了させ、受信者は背景で先読みします。

- NUIの操作を8ms窓でまとめ、Luaへシーケンス付きパケット送信。NUI→Luaは直列化・期限・キュー上限を持つ。
- サーバーはイベント送信者のsourceを利用し、クライアントのプレイヤーID／位置／Bucketを信用しない。
- セッションID＋入力sequence、状態revision、配送wire番号を分離。古い入力／古い配送を拒否。
- Note On/Off、pedal、volume、kill、panic。1秒ごとの入力完全状態が消失したNote Offを修復する。
- 受信側はrevision飛びを検出すると一旦消音し、完全スナップショットで復帰。異なる演奏者の音とペダルは独立。
- 250msごとに聴取範囲を更新。各音符の配信直前にも既存受信者の距離・Bucketを再確認。遠方への全体ブロードキャストを使わない。
- 途中参加は元のノートの経過時間を引き継ぎ、打鍵の頭から再生し直さない。持続音はループ位置へ追従する。
- クライアントは100msごとに実エンティティ位置を取得し、GTAのZ-upをWeb AudioのY-upへ変換。カメラ向きを使用。
- 受信情報が3.5秒途切れると受信音停止。入力が4.5秒途切れるとサーバーの演奏セッションを停止。NUIが消えるとLuaもフォーカスを解放する。

音符共有は低遅延を優先し、全員を共通バッファで遅延させる厳密なクロック同期は実装していません。WANの遅延・揺れによる合奏のずれは実機で評価します。現段階のメトロノームはローカル専用です。

## 境界

現在位置を判定できない相手、別Bucket、範囲外には送信しません。壁・遮蔽の音響計算は行わず、3D直線距離を使います。同じBucket内で上下に近い相手も距離に応じて聞こえます。

音符APIのversionはカタログ1、IDは各セッション内の単調増加整数。音程はMIDI番号、ベロシティ1–127、時間はms。この単純な形を将来の連携の出発点とし、WAVE連携コードは含めていません。

## 一次資料

- [FiveM Fullscreen NUI](https://docs.fivem.net/docs/scripting-manual/nui-development/full-screen-nui/)
- [FiveM NUI callbacks / strict mode](https://docs.fivem.net/docs/scripting-manual/nui-development/nui-callbacks/)
- [FiveM Secure your events](https://docs.fivem.net/docs/developers/server-security/)
- [FiveM Routing Buckets](https://docs.fivem.net/docs/cookbook/2020/11/27/routing-buckets-split-game-state/)
- [Web MIDI API / permissions](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- 音源の一次出典はSOUNDS_JA.md。
