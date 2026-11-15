# 楽器・録音音源・ライセンス

音源の使用条件は2026-11-16に下記の配布元で確認しました。WAVEのソースコード／音源エンジンは転用していません。既存テストサーバーに保存されていた加工済み録音ファイルを、同梱mapのSHA-256と全件照合したうえでJAMへ独立コピーしました。元ファイルは変更していません。

| 楽器 | 音域 | サンプル | 出典・作者 | 条件 |
|---|---|---:|---|---|
| グランドピアノ | C2–A6 (36–93) | 26、2強弱 | [VCSL Keys / Grand Piano K](https://versilian-studios.com/vcsl-keys/) — Versilian Studios LLC、SFZ Peter Eastman | CC0 1.0 |
| アコースティックギター | A2–D♯6 (45–87) | 10 | [FreePats Spanish Classical Guitar](https://freepats.zenvoid.org/Guitar/acoustic-guitar.html) — roberto@zenvoid.org | CC0 1.0 |
| エレキベース | E1–G2 (28–43) | 5 | [FreePats Bass Guitar YR Picked](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html) — Andrea Biasior | CC0 1.0 |
| クラリネット | D3–C6 (50–84) | 9 | [FreePats Clarinet](https://freepats.zenvoid.org/Reed/clarinet.html) — Tyler Dence（録音）／Kaili Dence（演奏） | CC0 1.0 |
| ドラム | GM 36/38/42/46/45/50/49/51 | 8 | [MuldjordKit](https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html) — Lars Muldjord録音、FreePats版 roberto@zenvoid.org編成 | CC BY 4.0 |

MuldjordKitの録音・編成者表記とCC BY 4.0条件を再配布時も維持してください。[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)の本文は`licenses/CC-BY-4.0.txt`、[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)は`licenses/CC0-1.0.txt`に同梱しています。録音素材は各許諾の免責条項に従い、現状有姿で提供されています。

## 加工

- 元のWAVE向け加工では必要な音高を選び、長い録音を短縮してOggへ圧縮済み。ピアノは13音高×2強弱、ギターとベースは選択サンプル、ドラムはキットから8音です。
- JAMではクラリネットの持続部分を選び、波形差が小さい位置にループを設け、末尾60msをループ前の波形へクロスフェードして32kHz・16bit・モノラルWAV化しました。録音されたレガート遷移を再現したものではありません。
- 音源ごとの先頭1秒RMSを基準にゲインを調整。ピアノの強弱層、発音、余韻の違いを残しています。
- 再生時のキャッシュは32kHzモノラル。周囲の音はHRTFと距離ゲインで定位し、出力にコンプレッサーを通します。
- 元音高からの変化は最大3半音に制限。ベースの音域が狭いのは、不自然な大幅移調を避けるためです。
- サンプル加工前後の対応・SHA-256は`licenses/sample-provenance.json`、配布サンプルのハッシュは`web/catalog.json`。

音源ファイル合計は4,084,484 bytes。主観的な楽器らしさ、レガートの自然さ、ゲーム内の音量バランスは実機・人による聴感評価が未実施です。
