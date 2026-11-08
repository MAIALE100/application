# 録音弦・管楽器とエレキギターの音源

この音源は段階2の開発候補にだけ含む。段階1の更新ZIPには含まれない。

| 楽器 | 原音源・公式ページ | ライセンス | 加工 |
|---|---|---|---|
| 録音バイオリン | Versilian Studios, VSCO 2 Community Edition, https://versilian-studios.com/vsco-community/ | CC0 1.0 | 256-sample packから持続音9個を選び、5秒以内・24kHzモノラルOggへ変換 |
| 録音チェロ | 同上 | CC0 1.0 | 持続音8個を同様に変換 |
| 録音フルート | 同上 | CC0 1.0 | 持続音11個を同様に変換 |
| 録音トランペット | 同上 | CC0 1.0 | 持続音6個を同様に変換 |
| 録音エレキギター | FreePats, FSBS Electric Guitar Clean #1 small, https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html | CC0 1.0 | 13個を同様に変換 |

元アーカイブのSHA256は開発領域の `SAMPLE_BUILD.json` に記録。選択原音は `selected-original` に保存。ギター原音のライセンス本文は `electric_guitar/LICENSE_CC0.txt` に同梱した。5楽器はいずれも必要時だけ読み込み、既存サンプルキャッシュ上限96MiB・同時発音40音を共有する。
