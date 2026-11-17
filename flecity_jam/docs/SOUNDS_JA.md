# 楽器・録音音源・ライセンス

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
