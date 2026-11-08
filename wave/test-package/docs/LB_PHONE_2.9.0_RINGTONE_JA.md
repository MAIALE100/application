# LB Phone 2.9.0 着信音連携の調査

## 確認した環境

- テストサーバー設置版のLB Phone：`2.9.0`
- `Config.Sound.System`：`native`
- `Config.Sound.Sync`：`true`
- WAVEの着信音差し替え設定：有効（テスト用差分更新）

## 確認結果

公式設定資料ではnative方式はゲーム内の音声を使い、NUI方式はNUI再生となり同期されません。NUI方式で着信音を追加するにはLB Phone内の着信音ファイル、`Config.Sound.Ringtones`、電話リソース再起動が必要です。今回の更新権限はWAVE単体再起動までなので、LB Phoneの設定・音声素材・再起動は行いません。

LB Phoneの公式クライアントexportsには`AddCheck("playNativePhoneSound", handler)`と`RemoveCheck`があり、公式契約では`false`を返すとnative音を止めます。設置版2.9.0の`shared/checks.lua`でも同じ契約を確認しました。LB Phoneの設定は`Config.Sound.Ringtones[*].soundSet = "ringtone"`です。WAVEはこの音種のときだけ着信音を置き換える設定を有効にしています。ただし、公開資料と読めるLuaから着信時の`soundType`引数そのものは特定できず、以下のテストサーバー実着信で確認中です。

WAVEは専用NUI画面に常駐のAudioContextを持ちます。通常のLibrary音声は電話UIを閉じた後も再生し、ロック画面から戻った後も再生状態が維持されることを利用者が確認しました。着信音についても同じ継続性があるか、着信応答時に停止するかは実着信で確認が必要です。設定は対象音種が一致し、保存済み音源・NUI・音声準備がすべて整っている場合だけnative音を抑止します。それ以外はLB Phoneの初期音を通します。

## 初期着信音の試聴

現在の設定がLB Phoneの初期着信音の場合、WAVEには試聴対象のWAVE曲がありません。設置版の`Config.Sound.Ringtones`はGTA native音の名前とsound setを定義し、`playNativePhoneSound`は着信音を鳴らす際のチェックとして公開されていますが、初期音だけを試聴する公開APIは設置版の公開exportsと設定で確認できませんでした。WAVEからGTA native音を直接呼ぶ実装は追加していません。

FiveM画面では「初期着信音」の試聴音は聞こえず、試聴状態にもなりませんでした。これはWAVE曲の試聴失敗ではなく、初期音にWAVE側の試聴対象がない状態です。初期音だけを鳴らす公開APIは確認できないため、WAVEカードの説明と無効表示を修正しています。一方、着信音許可のある公開曲から保存した区間はWAVE内で試聴でき、「Flecity Afterglow」0.0〜15.0秒の音声を利用者が確認しました。更新前の実着信ではLB Phoneの初期音が鳴り、その時はWAVEの差し替え設定が無効でした。連携を有効にする差分を適用した後、ユーザーから「LB Phoneの初期音が鳴った」と報告がありました。ただし、差分後のWAVE単体再起動が未確認のため、この結果は置換成功・失敗の判定に使えません。WAVE再起動後に再試験します。

## 安全境界

- 曲は公開中・作者の着信音許可あり・利用者がフル再生権を持つ場合だけ選択できます。
- 保存キーは`citizenid`です。サーバーはクライアント指定の所有者IDを受け付けません。
- 着信音設定は曲データ・購入・売上と分離された追加テーブルです。
- `nativeIntegration=true`ですが、音種が一致し、選択・NUI・音声が準備済みの場合に限ります。それ以外のnative音は抑止しません。
- WAVE側の設定音種`ringtone`はLB Phone設定の`soundSet`から選んだ値です。実着信での置換が確認されるまで、この値がチェック引数と一致するかは未確定です。
- 電話設定・LB Phone本体・サーバー全体は変更・再起動しません。

## 参照

- [LB Phone公式：着信音と通知音](https://docs.lbscripts.com/phone/configuration/ringtones-and-notifications/)
- [LB Phone公式：クライアントexports](https://docs.lbscripts.com/phone/exports/client-exports/)
- テストサーバー設置版の`lb-phone/shared/checks.lua`
