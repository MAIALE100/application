# テスト専用データとUI検証

現行ガードは**オフラインfixture専用**。既存サーバーのSQLを遮断するものではない。実DBや実クライアントへそのまま接続しない。

## 作成・識別・書込み制限

実行ごとのUUID、FCT_<UUID>の合成人物ID、表示用FCTラベルを発行する。接頭辞で既存行を試験データと認定しない。作成成功した正確なtable/keyだけを台帳に登録し、更新時は台帳と直前行ハッシュを照合する。既存行の採用、主キー・所有者・親の付替え、別runの所有者、未知テーブルを拒否する。

BASEの対象はworkspaces、members、stock_items、stock_movements。子行は登録済みの親、在庫履歴は登録済み在庫と同じworkspaceを要求する。数量と履歴はfixture内で原子的に更新する。UI用モデルであり、Lua/oxmysqlトランザクションの検証とは区別する。

## 影響検査・後片付け・復旧

開始前の保護対象行と終了時を比較し、台帳外の追加・更新・削除を失敗とする。fixture-recovery.jsonへ開始時データ、台帳、変更前後を保存する。すべて合成データ。

cleanupPlanは削除する正確なキーと全行ハッシュを固定し、実行直前に照合する。改変・新たな変更があれば保留。登録した新規行だけを子から親の順に削除し、fixture-cleaned.jsonで確認する。既存行は復旧対象にも含めない。

ブラウザー失敗時もfinallyで監査・後片付けを試み、失敗を別チェックで保存する。強制終了ならメモリーfixtureは消滅する。合成データ証跡を調査し新規runで再作成する。復旧JSONを実DBへ投入しない。外部変更時に全体バックアップを自動で戻さない。

## 共通の実行入口

    flecity test base --suite nui
    flecity test link --suite nui
    flecity test link --suite game

BASE: 実際のweb UIでBASE作成、在庫10個登録、+1、再読込後の11個表示を確認する。保存先はNodeメモリーのみ。日本語、権限表示、XSS表示、検索、画面幅の既存検査も維持する。

LINK: 配置済みと同じparty.luaを別Luaプロセス内でロードし、実際のCreateRoom/SelectGame/SetReady/StartRound/Submit/LeaveRoomを呼ぶ。DBと別actorは即拒否。Framework、時刻、Plus権限はmockで、認証・課金・接続同期の成功は主張しない。実応答列を実NUIで消費し、callback名・payload・順序を厳密照合する。未検証操作が出れば失敗する。

固定seedではヒット＆ブロー5手、リバーシ30手、コネクトフォー5手のプレイヤー操作で自然終了。将棋は初期局面4手の操作・AI応答後、ローカル専用の詰み局面で合法手・勝敗判定を確認する。将棋の一局完走は未実施。

画面、コンソール、fixture操作ログ、Lua応答列、ソースハッシュはプロジェクト別runsに保存。お絵描き・ワードウルフの複数人試験は追加しない。

## 次の承認対象：使い捨てDBだけ

    flecity fixture plan
    flecity fixture verify-db --plan <UUID>

planはBASE/LINKのソースとツールハッシュを固定する。verify-dbはその計画の明示承認記録がなければDB起動前に拒否する。記録は利用者の実際の承認後だけ作成し、ファイルの作成自体を許可と見なさない。

対象は.flecity-dev/db配下の新規datadirとflecity_base_<random>/flecity_link_<random>。専用named pipe・TCP無効・@@datadir照合を使用し、既存DBへ接続しない。コピーしたスキーマ・合成データでSQL整合性/ロールバック/競合試験を行い、自分が起動した子プロセスだけ終了する。診断用データ領域は保持する。

## 実機への接続条件

BASE bootstrapはworkspaces/membersを書き、LINK GetSettingsはgame_profilesをINSERT/UPDATEする。LINK GetConfig/ゲーム選択/開始はPlus.GetConfigFor/HasAccessも通るので、自動更新・課金経路の隔離も必要。専用キャラクターの指定だけでは不十分。

実リソースには試験actorの全SQLを専用領域へ強制するdeny/routing層がないため、実機はBLOCKED。QBox/LB Phoneの接続・初期化による書込みも監査し、最小変更候補・分離DB接続・対象ファイル・復旧手順を準備して別途承認を得る。今回は検証ブリッジも変更・再起動していない。

公式NUIデバッグ資料: https://docs.fivem.net/docs/scripting-manual/nui-development/full-screen-nui/
開発用CEFポートの存在は無人操作全般の許諾を意味しない。今回はFiveMを起動・操作せず、CEF接続、メモリー注入、アンチチート回避、資格情報取得も行わない。
