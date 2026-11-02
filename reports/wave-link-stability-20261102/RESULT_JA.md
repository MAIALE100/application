# WAVEスマホ復帰・LINK対戦テトリス検証（2026-11-02）

## 判定

- WAVE大画面→元のスマホタブ復帰: 初回・2回目・3回目は**実機FAIL**。さらに実機ログから、`OpenApp` の `onOpen` が端末の `IsOpen=false` の時点で発火し、復帰処理が表示済みと誤認することを特定。端末が開いてからWAVEを再選択する4回目の修正を反映。4回目の往復実機結果は**NOT_RUN**。ブラウザー模擬PASSを実機PASSに読み替えない。
- LINK対戦テトリス: 48人相当のLua模擬・12ルーム、24履歴提出、50回再戦とブラウザー10分試験は **PASS**。実FiveMの2人対戦と30～48人接続、1人＋AIは **NOT_RUN**（現行コードは `fall_battle` のAI参加を提供しない）。
- LOOPテトリス: 今回変更なし。ユーザーの最新実機報告は正常。

## WAVEの修正と反映

原因追跡: 従来のスマホ復帰処理は `ToggleOpen(true)` で端末を開くだけで、WAVEを選択しなかった。初回の `OpenApp` 追加でもホームに残った。2回目は `onOpen` を待ったが、実機ログでは `return app route opened` の後に `app return needs handset open fallback` が記録された。つまりアプリ起動イベントは端末が閉じた状態でも発火しており、その値を保持したまま端末を開くため再選択が省略され、ロック/ホームが残った。4回目は端末が開いていない時の `onOpen` を無効とし、端末を開いた後にWAVEを再選択する。制作状態の受領前にブート処理を完了させ、重複受領を防ぐ。

- 更新対象は `wave/client/main.lua` と `wave/web/screen.js` のみ。WAVEのDB、販売、分配、銀行、権限処理は変更なし。`flecity_games` は今回更新・再起動なし。
- 最新の更新直前バックアップ: `D:\FiveM_Dev_Backups\flecity-live-test\pre-update-2026-11-02T10-15-42-835Z`。現行DB物理627ファイル、flecity_games 70ファイル、wave 14ファイルのコピーとSHA256照合がすべてPASS。先行3回の更新直前バックアップとPhase 1の隔離復元済みバックアップも保持。
- `client/main.lua`: 最新の適用後 `46eef78cab099c733fdd325eb9c684598505077c3dff86fb06dcc7977da4a79f`。今回4回の段階的修正を適用し、各回の更新前後ハッシュを `.flecity-dev/releases/wave-return-20261102/` のマニフェストに保存。
- `web/screen.js`: 適用前 `a5685dac332291cbae3bae08d2816a2538a8e81398d56284c4d7753dacab889e` → 適用後 `9cab28e3f937dab5104f799bb57db0bd7a34d3eca49a5bf30abd058776793d56`。
- 適用後の両ファイルはworkspaceと設置先でSHA256一致。最新の適用記録は `.flecity-dev/releases/wave-return-20261102/MANIFEST.json`。
- 各回で認証済みtxAdminの対象名 `MAIALE100_Test_01` を確認し、`wave` だけを再起動。最新の起動ログに停止・開始、DB schema ready、LB Phone callbacks 33/33、READY_FOR_TEST。FXServer全体の再起動なし。接続者1人の表示を確認。
- 復旧: 上記バックアップの `wave` の対象2ファイルを元の相対パスへ戻し、SHA256を照合してから認証済みtxAdminで `wave` のみ再起動する。元のバックアップは保持。

## 検証と残件

- WAVE Node検査2件、Lua focus mockの直接/代替アプリ起動、Lua/JS構文、NUIブラウザーでStudio/Libraryの往復・状態保持・APP_SUSPENDED回避: **PASS**。最新NUI証跡 `.flecity-dev/projects/wave/runs/2026-11-02T10-15-42-890Z-8d9187`。
- WAVE FiveMでの元タブ復帰: 3回目までは **FAIL**、4回目は **NOT_RUN**。3回目の実機ではStudioの大画面起動、制作画面・タイトル・BPM・音符の引継ぎ、スマホへの復帰操作まで画面で確認した。復帰先はロック画面で元タブへ届かなかった。4回目の実機往復、Esc/再入場は未確認。以前の実機FAILは履歴として維持。
- LINK Lua模擬: 仮想48人・12ルーム、FALL BATTLE履歴24件、50再戦、対戦中のゲスト切断→同じ識別子で再接続→結果確定、退出後のルーム/参加者残存0。`peak_lua_kb=717`、終了後増分 `18KB`、CPU時間 `17.0ms`。実サーバーの接続・通信・DB負荷を示す値ではない。
- LINKブラウザー実時間10分試験: **PASS**。証跡 `.flecity-dev/projects/link/runs/2026-11-02T09-55-59-295Z-bf4e0f/link-tetris-longrun.json`。600,000ms、165ラウンド（うち50回開始・終了）、キー2,285回・ドロップ2,285回。開始/中間/後半の平均描画処理0.075/0.102/0.091ms、後半の平均入力処理0.136ms・最大0.5ms、後半の平均フレーム間隔16.667ms・最大16.9ms。終了時重力/締切タイマー0、キー結合1のまま。模擬通信114件・100,845B・最大ペイロード887B。CDPヒープ14.00MB→3.95MB。これはブラウザーfixtureの値であり、FiveM実通信量や実機入力遅延ではない。
- LINK実FiveMの2人同期、AI対戦、複数ルーム実接続、途中切断・再入場は **NOT_RUN**。AIは現行の `ng_word`、`draw`、`telephone` のみで、FALL BATTLEは対象外。
- 既存の未コミットCSS・運用文書・未追跡資料は変更せず保護。02:00・13:00定期設定は変更なし。本番環境・現行DBへの書き込みなし。
