# 楽器・録音音源・ライセンス

## 0.4.2の停止・再開

音声contextが停止しているときはlocalの新しいsourceを予約しません。再開前に解放済み・参照されないvoiceを清掃し、現在のノートモデルに残る保持音を一度だけ再同期します。再開処理を待っている間のキー解放でも、その停止中voiceを即座に切断します。メトロノームは自身の予約oscillator／gainだけを追跡し、OFF／closeで停止・切断します。MIDIの同音再打鍵は別の新しい発音IDへ渡し、2打目のvelocityを保ちます。録音・gain・音程・距離・ピーク保護を変更せず、実機聴感は未確認です。

旧5楽器の使用条件は2026-11-16、新3楽器は2026-11-18に一次配布元で確認しました。0.4.0候補は8楽器・91録音です。旧5楽器の設定・58録音・出典記録を保持し、WAVEや元音源を変更していません。新3楽器は許諾済みローカルアーカイブを読み取り、新しいJAM用ファイルへ加工しました。

| 楽器 | 音域 | サンプル | 出典・作者 | 条件 |
|---|---|---:|---|---|
| グランドピアノ | C2–A6 (36–93) | 26、2強弱 | [VCSL Keys / Grand Piano K](https://versilian-studios.com/vcsl-keys/) — Versilian Studios LLC、SFZ Peter Eastman | CC0 1.0 |
| アコースティックギター | A2–D♯6 (45–87) | 10 | [FreePats Spanish Classical Guitar](https://freepats.zenvoid.org/Guitar/acoustic-guitar.html) — roberto@zenvoid.org | CC0 1.0 |
| エレキベース | E1–G2 (28–43) | 5 | [FreePats Bass Guitar YR Picked](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html) — Andrea Biasior | CC0 1.0 |
| クラリネット | D3–C6 (50–84) | 9 | [FreePats Clarinet](https://freepats.zenvoid.org/Reed/clarinet.html) — Tyler Dence（録音）／Kaili Dence（演奏） | CC0 1.0 |
| ドラム | GM 36/38/42/46/45/50/49/51 | 8 | [MuldjordKit](https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html) — Lars Muldjord録音、FreePats版 roberto@zenvoid.org編成 | CC BY 4.0 |
| クリーンエレキギター | E2–C♯6 (40–85) | 13 | [FreePats FSBS Electric Guitar Clean #1 small](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html) | CC0 1.0 |
| フルート | C4–A6 (60–93) | 11 | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) — Versilian Studios、Sam Gossner / Simon Dalzell | CC0 1.0 |
| ヴァイオリン | G3–D6 (55–86) | 9 | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) — Versilian Studios、Sam Gossner / Simon Dalzell | CC0 1.0 |

MuldjordKitの録音・編成者表記とCC BY 4.0条件を再配布時も維持してください。[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)の本文は`licenses/CC-BY-4.0.txt`、[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)は`licenses/CC0-1.0.txt`に同梱しています。録音素材は各許諾の免責条項に従い、現状有姿で提供されています。

新3楽器の出典・許諾・加工は同梱の[追加音源記録](../licenses/ADDED_INSTRUMENTS.md)を参照してください。[VSCOのライセンス](https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE)も確認し、第三者のコードや画像は取り込んでいません。加工前後のハッシュは`licenses/sample-provenance.json`へ記録し、元58件を保持します。

## 加工

- 元のWAVE向け加工では必要な音高を選び、長い録音を短縮してOggへ圧縮済み。ピアノは13音高×2強弱、ギターとベースは選択サンプル、ドラムはキットから8音です。
- JAMではクラリネットの持続部分を選び、波形差が小さい位置にループを設け、末尾60msをループ前の波形へクロスフェードして32kHz・16bit・モノラルWAV化しました。録音されたレガート遷移を再現したものではありません。
- 音源ごとの先頭1秒RMSを基準にゲインを調整。ピアノの強弱層、発音、余韻の違いを残しています。
- 再生時のキャッシュは32kHzモノラル。周囲の音はHRTFと距離ゲインで定位し、出力にコンプレッサーを通します。
- 元音高からの変化は最大3半音に制限。ベースの音域が狭いのは、不自然な大幅移調を避けるためです。
- サンプル加工前後の対応・SHA-256は`licenses/sample-provenance.json`、配布サンプルのハッシュは`web/catalog.json`。
- 新エレキギターのOggはアーカイブのバイト列を保持。新サンプルのゲインは前段ピーク0.7を基準に調整し、その後は既存の楽器ゲイン・音量・リミッターを使用します。
- 新フルートとヴァイオリンは32kHz・モノラル・16bit PCMへ変換し、位相差を抑えた60msクロスフェードで持続ループを作りました。アーカイブのmap表記が録音実音より1オクターブ低かったため、新カタログの基準音だけ+12半音補正し、周期測定に基づく微小チューニングを適用します。旧楽器や録音原本は移調していません。

候補の8楽器を復号したPCMは約46.65MiBで、64MiB上限内です。正確な配布バイト数と最新の測定はMANIFEST・QAを参照してください。圧縮ファイル量と復号後メモリは別です。

録音されたレガート遷移を再現した音源ではありません。0.3.1の発音・共有にはユーザー報告がありますが、新3楽器の楽器らしさ・ループ・音量バランス、0.4.0の実聴感はNOT_RUNです。権利・音程・ループ・音量・容量の品質ゲートを優先し、今回チェロ・トランペット・サックスは追加しません。楽器数だけで完成と判定しません。

## 0.4.1の出力ピーク保護

既存のコンプレッサーの後に標準WaveShaperNodeを配置します。入力の絶対値0.9までは同じ値を返し、その上は`sign(x) * (0.9 + 0.08 * tanh((abs(x)-0.9)/0.08))`の曲線を4097点で補間します。±1以上も端点値になるため、出力サンプルの絶対値は0.98未満です。oversamplingは既定noneで、余分な先読み処理を追加しません。[Web Audio仕様](https://webaudio.github.io/web-audio-api/#WaveShaperNode)の端点処理と補間に従います。

これは極端な同音合奏でデジタル上限を超えないための処理です。通常音量のPCMとの差分、8楽器の最大音量128声を別途測定します。既存音源・チューニング・gain・距離曲線は変更せず、実際の音質・負荷はFiveM未確認です。
