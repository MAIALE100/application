# FLEPURI v1.0.3 受入テスト

運営導入後、最低限以下を確認してください。

## 起動
- `puribooth_selftest` がPASS
- qbx_coreが2.5.4+としてPASS表示される
- PuriPhoto versionとproduction UIがPASS表示される
- PuriPhoto UIのJS / CSS / client bridgeが実体検査を通る
- Renewed-Bankingのweazel会社口座がPASS表示される
- DB schema / configがPASS表示される
- 起動時にLuaエラー / NUIエラーが出ない
- DBに `puribooth_booths` / `puribooth_events` / `puribooth_refunds` / `puribooth_collections` が自動作成される
- `puribooth_support` がエラーなく状態を表示する
- `puribooth_refunds` が0件または既知の未解決返金だけを表示する
- `puribooth_collections` が0件または既知の未解決売上回収だけを表示する
- 再起動しても勝手にテスト台が生成されない

## 権限
- weazel以外は `place / remove / price / sales / collect` を実行できない
- weazelは設定grade以上で管理操作できる
- `requireOnDuty=true` にした場合、非勤務中は管理操作できない

## 台の管理
- `/puribooth place` で設置できる
- 再起動後も位置・向き・料金が維持される
- 台ごとに別料金を設定できる
- 未回収売上がある台は撤去できない

## 撮影
- cash / bank の順で料金を支払える
- 撮影前キャンセルは返金される
- 撮影準備期限ちょうど付近で撮影開始しても、期限切れなら料金が消えず返金される
- 支払い後・撮影開始前に切断しても citizenid 経由で返金される
- 4枚撮影できる
- 2〜4枚目はPOSE READYで任意開始できる
- 背景 / 床が同じ撮影エリアの同行者へ同期される
- 2台同時利用時に背景 / カウントダウンが混線しない
- 技術失敗・撮影タイムアウト時に返金される
- 売上DB記録失敗時は料金返金へフォールバックする
- 返金export一時失敗時はpuribooth_refundsへpendingとして残り、自動再試行される
- 正常撮影後に編集画面が開く

## 編集
- レイアウト / 写真位置 / 盛り / フレーム / スタンプ / 落書きが動作する
- 文字4書体を選択できる
- 文字の色 / 2色グラデーション / 縁取り / ネオン / 影が反映される
- 装飾リセットを複数回行ってもボタン操作が二重実行されない
- Undo / Redo / Delete / Esc が動作する
- 完成画像をPuriPhotoへ渡せる
- PuriPhoto NUIが画像を取得し、confirm receiptを返すまでFLEPURI編集画面が閉じない
- PuriPhoto handoffを失敗させた場合、FLEPURI編集内容が保持される
- PuriPhoto handoff成功後、FLEPURI編集画面が閉じてPuriPhotoへ切り替わる
- PuriPhoto側の撮影場所がフレプリ台の場所になる

## 同時実行 / 不正イベント耐性
- 同じ台へ2人が同時開始しても二重課金されない
- 1人が別々の2台を同時開始しても二重課金されない
- カウントダウンを2→4など順不同で送っても進行しない
- 4枚目まで進行していないcaptureCompleteでは売上確定しない
- 背景テーマ連打がcooldownで抑制される
- JPEG以外の背景共有payloadが拒否される
- 想定外のfinishSessionイベントだけで有料セッションが破棄されない

## 売上
- 正常撮影1回で対象台だけの未回収売上・累計売上・撮影回数が増える
- 撮影前返金 / 技術返金では売上が増えない
- `/puribooth sales` の全台合計が各台合計と一致する
- `/puribooth collect <ID>` で指定台だけ回収できる
- `/puribooth collect all` で全台を一括回収できる
- 回収後の未回収残高が0になる
- Renewed-Bankingの取引履歴にFLEPURI売上が残る
- Renewed-Banking入金失敗時は未回収残高が復元される
- 売上回収時、台残高確保と回収台帳更新が同一DBトランザクションで処理される
- `finalizing` 状態は `puribooth_collection_retry <collection_id>` で銀行へ再入金せずDB確定だけ再試行できる
- `restoring` 状態は `puribooth_collection_retry <collection_id>` で台残高復元だけ再試行できる
- `paying` 状態では新しい回収が停止し、Renewed-Banking照合後に `puribooth_collection_review <collection_id> <paid|notpaid>` で安全に解決できる
- 未解決の会社売上回収がある間は新規回収と台撤去が停止する

## 保守確認
- 正常撮影後、`puribooth_support <citizenid>` に session_charged → sale_recorded が残る
- 撮影前返金後、refund_completed が残る
- 未解決返金がない状態では `puribooth_selftest` の refunds がPASS(0)
- `processing` 返金が発生した場合は自動再試行されず、手動照合対象になる
- `puribooth_refund_review <session_id> <resolved|retry>` で照合済みprocessing返金をDB直接編集せず解決できる
- 撮影完了 / キャンセル / 切断 / タイムアウトが競合しても、同一セッションで売上確定と返金が両方成立しない
- `puribooth_selftest` が accounting / refunds / collections をすべてPASS表示する

## 合格基準
上記に重大不具合がなく、サーバーコンソールに継続的なエラーが出ず、`puribooth_selftest` がPASSであること。
