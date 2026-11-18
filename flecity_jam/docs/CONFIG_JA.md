# 設定項目

## 0.4.4-test：このPCだけのキー配置

鍵盤横の「キー配置を変更」から、変更する音を選び、使いたい文字・数字・記号の物理キーを1つ押してください。使われているキーなら2音の割り当てを交換します。音程配列18/25/36/従来18とドラム8パッドは独立して保存します。画面鍵盤も変更直後に更新されます。他プレイヤーへキー設定は送信しません。

設定はこのPC内のv5へ自動保存。既存v1〜v4の文字列を変更・削除せず、検証した値をコピーします。保存不能ならその旨を表示し、今回だけ使用できます。端末が変わると設定は自動共有されません。初期化は現在の配列だけです。変更待ちの取消は「変更を中止」、JAMを閉じる場合はEsc。

N/CapsLock（PTT）、Space（ペダル）、方向キー（音域）、Esc等の操作キーは保護します。Ctrl/Alt等との組合せやIME変換中、長押しの自動repeatで配置を確定しません。MIDI、Voice、音源、距離15m、DBやサーバーの割り当て設定は変更しません。

実機の打鍵・弾き心地・音声・PTTは後日のノートPC確認待ち（NOT_RUN）。今回のQA・更新・復旧の正本は別添personal-keys-20261118です。以下は過去版の記録です。

| 項目 | 初期値 | 用途 |
|---|---:|---|
| Command | jam | 演奏画面を開くコマンド |
| Range | 15.0 | JAMの最大共有距離m。15m以上は停止。Voice距離とは独立 |
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
| PttControl | 249 | N／会話ボタンから渡す通常PTT入力。249以外では会話入力を停止 |
| ReservedKeys | N等 | 演奏キーに割り当てないキー |
| DisableControls | コード参照 | 演奏画面中に抑制するGTA操作 |
| CanStartClient | state参照 | 死亡・インベントリ等、現地のUI競合判定を追加する窓口 |

安全上限は十分に試験してから変更してください。音声ノード上限128、復号PCMキャッシュ上限64MiBを維持します。0.4.0候補の8楽器・91録音は測定で約46.65MiBです。旧5楽器の約35.3MiBという値は追加前の記録です。診断の`voices`は発音中、`nodes`は余韻を含む確保済みノード数で、上限はnodesへ適用します。解放直後にnodes>voicesでも余韻終了後に減れば正常です。

## 0.4.0-testの入力と端末設定

## 0.4.3-test：両手ホーム段18音

白鍵を `A S D F G ｜ H J K L ; :`、黒鍵を上段 `W E T Y U O P` に並べます。左手と右手を同じホーム段の左右へ置く配置です。18音（ピアノ初期C3〜F4）で、2オクターブではありません。日本語配列の `:` はUS配列の `'` と同じ物理位置のため、画面では `:/'` と併記します。境界のYは押しやすい手で使います。

旧25音・36音・従来18音と個人割り当てを独立して保持します。旧標準25音は新標準18音で始まり、変更済みの旧個人配列は選択を維持します。旧25音を選び直すこともできます。設定は新しい `flecity-jam-v4` にコピー保存し、v1/v2/v3の原文を削除・上書きしません。音域移動・拡大縮小・サステイン・MIDI・NのPTT予約は維持します。

今回の新しい自動試験・更新・復旧結果は別添 `hands-layout-20261118/` のQAを正本とします。物理キーボードの弾き心地、実FiveMの音声・VC/PTTはノートPC確認待ち（NOT_RUN）です。デスクトップFiveMは起動しません。WAVE・Voice・DB・設定・音源は変更しません。

設定のvelocityは1〜127、performVolumeは0〜100、showGuideは真偽値。値を検証してv4へコピーします。MIDI velocity、セッション限定の周囲の個別音量、楽器ごとの音域制限は変更しません。config.lua、サーバー、DBへの移行書き込みはありません。

追加Items名は`electric_guitar=jam_electric_guitar`、`flute=jam_flute`、`violin=jam_violin`。`UseElectricGuitar`／`UseFlute`／`UseViolin`のexportを用意しますが、外部Inventoryのアイテム定義や所持データは追加・変更しません。Access=ox_inventoryでは運営が用意した正しいアイテムと使用成功応答・サーバー側所持確認が必要です。open／aceは既存方針を維持します。

`SetNuiFocusKeepInput(false)`を維持し、N／会話ボタンの保持中だけ249の通常PTT入力をLuaから渡します。pma-voiceのsecondary PTTと同じ`SetControlNormal`の0/1/2入力群を毎フレーム使用し、Voice本体やマイクの有効化・ミュート・受信設定は変更しません。無線には介入しません。NUIは約200msごとに保持を更新し、Luaの有効期限は900msです。画面世代トークンと単調増加seqで古い要求を拒否し、解放・blur・終了・死亡・リソース停止等で解除します。

0.3.1で演奏中の本人VCが使えなかった原因は未確定です。CfxにPTT用の分岐があるため、keepInput=falseだけで必ずPTTが抑制されるとは断定しません。入力状態の検出と相手の聴取は別で、0.4.0候補のVC送受信・競合・終了後の復帰は未確認です。声が届かないときや無線・チャットを使う場合はEscで閉じてください。

一次資料：[Cfxの音声入力処理](https://github.com/citizenfx/fivem/blob/master/code/components/gta-net-five/src/MumbleVoice.cpp#L530-L540)、[Cfxのゲーム入力処理](https://github.com/citizenfx/fivem/blob/master/code/components/gta-core-five/src/GameInput.cpp#L1370-L1388)、[SET_CONTROL_NORMAL](https://github.com/citizenfx/natives/blob/master/PAD/SetControlNormal.md)、[pma-voiceのsecondary PTT](https://github.com/AvarianKnight/pma-voice/blob/main/client/commands.lua#L85-L106)。資料は設計の根拠であり、実機聴取PASSの証拠ではありません。

## 15mの減衰と設定の安全更新

既存の二乗減衰を維持し、PannerNodeのrolloffFactor=0との二重減衰を避けます。JAM単独の線形振幅倍率は次のとおりです。聴感の割合ではありません。

| 距離 | 振幅倍率 | 基準からの変化 |
|---|---:|---:|
| 1m | 1.000000 | 0dB |
| 3m | 0.734694 | 約-2.68dB |
| 7m | 0.326531 | 約-9.72dB |
| 10m | 0.127551 | 約-17.89dB |
| 15m／20m | 0 | 無音 |

15mはユーザーが指定したJAM独立の共有範囲です。現在のnative Voice通常3mから自動取得した値ではなく、pma-voice設定を変更しません。58音源も同一で、15mの実機聴感はNOT_RUNです。

更新ツールは設定差分を既定で拒否します。今回は新3楽器のItems名だけと監査した後、新config.luaの完全SHA256を`--reviewed-config-sha256`へ明示します。未指定・誤SHA・設置版競合はCONFLICT_STOP。receiptに前後SHAと明示pinを記録し、旧設定も全体復旧できます。値は最終の外部QAを参照し、一括許可は使いません。Range7→15は0.3.2時点の変更で、今回さらに広げません。

`web/catalog.json`は楽器名・音域・初期オクターブ・発音／リリース・音源マッピング・ゲイン・ループを定義します。音源を差し替える場合は出典とハッシュも更新してください。クライアントに渡すカタログに秘密情報を含めてはいけません。

0.2.0-testでは、エレキベースの初期オクターブを1に設定し、最初の有効音E1が標準Dキーに来るようにしました。ピアノの弱いvelocity層（v2）のゲインは、同じ音高の強い層（v4）との録音RMS比を測ってメタデータだけ補正しています。58個の録音ファイルそのものは変更していません。補正値の妥当性は音量の自動測定と実機聴感を分けて確認します。

音声の初期化・再開と音源取得には時間上限と再試行案内があります。NUIの準備失敗時には「JAMを再読み込み」を表示し、演奏開始時の音声・音源・通信失敗は段階別に案内します。聴く音量と消音状態は各端末のローカル設定であり、`config.lua` のサーバー共通設定ではありません。設定が消音のまま残る場合があるため、音声試験前にUI状態を確認してください。

距離はVoiceから自動で取得しません。pma-voiceの内部を直接読み書きせず、実環境の通常VCに近い値をRangeへ指定します。Voiceの叫び・ささやき切替とJAMの範囲は独立しています。
