# 設定項目

| 項目 | 初期値 | 用途 |
|---|---:|---|
| Command | jam | 演奏画面を開くコマンド |
| Range | 7.0 | 聞こえる最大距離m。境界以上は停止。3mへの変更も可能 |
| MaxPerformers | 8 | サーバー全体の同時演奏者上限 |
| MaxNotes | 16 | 1人の発音中ノート上限 |
| MaxOps | 32 | 1パケット内の操作数上限 |
| EventsPerSecond / EventBurst | 100 / 160 | 入力コストの補充と最大バースト。ノートを含む同期も課金する |
| TickMs | 250 | 参加・退出・距離・死亡等の照合間隔ms |
| SnapshotMs | 1000 | 完全状態の最大送信間隔ms |
| SessionTimeoutMs | 4500 | NUI由来の入力が途切れた演奏者の停止期限ms |
| MaxNoteMs | 120000 | 最大ノート長ms。長音の故障時フェイルセーフ |
| Access | open | open / ace / ox_inventory。その他は拒否 |
| Ace | flecity.jam | Access=ace時の権限 |
| Items | jam_* | 楽器ごとのアイテム名 |
| Presentation | false | ギター用Prop／アニメーション候補を有効化 |
| PttControl | 249 | 無効化しないGTA標準PTTコントロール |
| ReservedKeys | N等 | 演奏キーに割り当てないキー |
| DisableControls | コード参照 | 演奏画面中に抑制するGTA操作 |
| CanStartClient | state参照 | 死亡・インベントリ等、現地のUI競合判定を追加する窓口 |

安全上限は運営が十分に試験してから変更してください。ブラウザー側の総発音上限は128音、復号済み音源キャッシュ上限は64MiBです。標準の5楽器は約35.3MiBのキャッシュになります。

`web/catalog.json`は楽器名・音域・初期オクターブ・発音／リリース・音源マッピング・ゲイン・ループを定義します。音源を差し替える場合は出典とハッシュも更新してください。クライアントに渡すカタログに秘密情報を含めてはいけません。

距離はVoiceから自動で取得しません。pma-voiceの内部を直接読み書きせず、実環境の通常VCに近い値をRangeへ指定します。Voiceの叫び・ささやき切替とJAMの範囲は独立しています。
