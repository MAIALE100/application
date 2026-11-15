# Flecity JAM — 0.1.0-test

街で鍵盤を叩いて、近くの人と演奏する独立FiveMリソースです。
**実装・ローカル検証版です。実FiveMでの複数人合奏は未確認で、住民向け公開版ではありません。**

## 含まれるもの

- グランドピアノ、アコースティックギター、エレキベース、クラリネット、8音のドラム。録音58サンプル。
- PCキー・マウス・対応環境のMIDI入力、和音、長押し、サステイン、オクターブ、キー割当、演奏／聴く音量、消音。
- 本人の即時発音、周囲へのNoteイベント同期、位置・距離減衰、Routing Bucket分離、途中参加の状態復元。
- 最大8人、各16音。切断・死亡・NUI応答停止・セッション期限切れ・権限喪失の停止処理。
- 日本語NUI、縮小表示、ローカルのメトロノーム、権限／ox_inventoryアダプター。

必要なのはFiveMとOneSyncです。QBox・oxmysql・LB Phone・WAVE・pma-voiceには依存しません。DBは使用しません。

`/jam` → 楽器を選択 → **演奏する**。終了はEsc。聴くだけの設定は`/jamlisten`、緊急終了は`/jamstop`、JAM全体の消音切替は`/jammute`。

| 資料 | 内容 |
|---|---|
| [INSTALL_JA.md](docs/INSTALL_JA.md) | 導入・更新・復旧、アイテム連携 |
| [MANUAL_JA.md](docs/MANUAL_JA.md) | 操作と演奏時の注意 |
| [CONFIG_JA.md](docs/CONFIG_JA.md) | 設定値と調整方法 |
| [SOUNDS_JA.md](docs/SOUNDS_JA.md) | 音源・ライセンス・加工内容 |
| [ARCHITECTURE_JA.md](docs/ARCHITECTURE_JA.md) | 調査、設計判断、同期仕様 |
| [QA_JA.md](docs/QA_JA.md) | 実行結果、未検証、既知の制限 |
| [LIVE_CHECKLIST_JA.md](docs/LIVE_CHECKLIST_JA.md) | 実機の受入試験 |

GitHub作業ブランチ: `feature/flecity-jam-20261116`。他アプリの開発停止は継続します。
