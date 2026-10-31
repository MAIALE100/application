# 共同リリースの実装棚卸し

優先順はLOOP＋LINK → BASE → WAVE。プリフォト/フレプリは保守、プリフォト移行255差分はPAUSED、Photo Diaryは別保留。
両アプリの使用ソースはflecity_sources/flecity_games、manifest版0.79.6-test。旧ルートflecity_gamesや原本を混ぜず、共有構成を維持する。以下は登録定義を根拠とする。

| LOOP（15） | LINK（15） |
|---|---|
| quick_tap / stop / stack / block / merge | code_break / reversi / vote / gomoku / connect4 |
| fall / mines / nonogram / memory / sort | mini_shogi / word_wolf / liar / draw / telephone |
| slide / color_match / number_rush / high_low / simon | ng_word / fake_answer / bomb / memory_chain / fall_battle |

内部に存在しても未登録のreaction/stop_battle/majority/minority/tic_tacは、公開されているゲームとして試験済み数へ加えない。

## 新たな仮想試験

実party.luaを隔離Luaプロセスへ読み込み、フレームワークID・時計・輸送・課金権だけをfixtureへ差し替える。実ネットワーク/DB/料金操作はゼロ。
2人（上限2ゲーム）または4人（その他）で全部屋開始、ホスト権限、各視点の公開状態、秘密情報、進行中切断、新しいsourceで同一member復帰、退出・部屋解放を検査する。
結果までの自動進行は14ゲーム。将棋は通常開始局面から公開合法手を1手実行し、完局はNOT_RUN。既存AI試験の詰み専用局面は通常対局と区別する。
ヒット＆ブローの終局試験はfixture内部の正解を既知として入力するので、公開UIから推測して解いた試験ではない。その他も固定した限定シナリオであり、全戦術・全勝敗方向・全AI難易度の網羅ではない。
FALL BATTLEは短い正当な履歴を提出する得点判定。長時間同期・全操作・妨害を証明しない。

## 残りの提出条件

両アプリ全必須ゲート、実FiveM/LB Phone登録・インストール・権限・課金枠、実複数クライアント、通常将棋/成り/難易度、盤面全勝敗方向、LOOP全操作/完局/実時間長期、永続化/既存データ影響、全状態UIの目視・入力/スクロール、承認済み画像比較、日本語資料最終確認、共同ZIP全件検査。
片方だけ完了しても共同セットはNOT_READY。仮想/NUI/実機の証跡を分ける。実提出・公開は承認後。
