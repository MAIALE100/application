# 共通ローカル開発基盤 実装報告

2026-10-30 日本時間。作業リポジトリは D:\FiveM_Dev\application。

## 実装した範囲

ルートの flecity.cmd と独立した devtools/flecity を追加しました。既存アプリ本体、既存の個別アップデーター、server.cfg、稼働DBは変更していません。親リポジトリは jobs/mining-dev のままで、既存の未コミット変更は維持しています。

1. LB Phone、ジョブ、ゲーム、その他リソース向けのLua/JavaScript雛形生成。
2. 既存リソースの登録、個別テストアダプターとログタグの生成。
3. static / db / nui / game / live / all の共通実行とスイート別の結果表示。
4. BASE、LINK、LOOP、WAVE、フレプリ(puribooth)、プリフォト(puriphoto)のプロジェクト設定・個別アダプター。ジョブ実例としてminingも登録。
5. 固有named pipe、TCP無効、独立datadirを使う使い捨てMariaDB。起動プロセスと接続先を限定し、終了も確認。
6. ゲーム／AIモジュール登録。実際のLINK FALL BATTLEコードを使う再現可能な自動対戦。
7. プロジェクト別のJSON/Markdown結果、ログ、画面保存先、修正履歴と独立ローカルGit。
8. 対象リソースだけの読取バックアップ、固定バイト列の更新・復旧計画、更新失敗時のファイル復旧。
9. 本番パス・ジャンクション・パス逸脱・既存ファイル上書き・古い結果の流用を拒否するガード。
10. ルートAGENTS.mdとFLECITY_DEVELOPMENT.mdに、新規開発時に共通基盤を優先する運用ルールを追加。

通常運用にGitHub・Actions・fetch・pushは不要です。既存ローカルGitの参照を切替なしで読むsnapshotも実装し、miningのHEADから実際に書き出して確認しました。

## LINKの発見結果

- 現在の作業ツリー：flecity_games/config/shared.lua では旧名PARTY。
- ローカル games/platform-core も旧名PARTY。origin/games/platform-coreも旧名PARTYで、作業ブランチの切り替えはしていません。
- 実際のLINK：D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\flecity_games。
- 配置先config/shared.luaで、Partyの表示名がLINK、識別子はflecity_party。
- LINK/LOOPは同じflecity_gamesリソース。独立したリソースとしての再起動・配布はできません。共有先を計画に表示し、適用時の明示条件に含めました。

配置済みLINKとWAVEは読み取り専用コピーを .flecity-dev/sources に保存し、所在・ハッシュ・来歴をlocal.jsonへ記録しました。BASEは前回監査時の37a4b5660bad828fe9c796d718d67bd171b57cedの修正版コピーを再利用しています。

これらのimportは検査用です。特にBASEは文書をすべて含む完全なcheckoutではないため配置不可の状態です。配置計画は欠落・削除を表示し、そのまま実行できません。

## 検証結果

| 対象 | 実行結果 | 未実施・制限 |
| --- | --- | --- |
| 共通基盤 | node --test devtools/flecity/tests/*.test.mjs：37/37 PASS、skip 0 | 実サーバー上のファイル切替は未実施 |
| BASE静的 | JS構文、既存静的回帰、12スキーマ一致、39 callback対応、CSS、PR #7保護のソース検査PASS | Lua構文・Lua実行型回帰NOT_RUN |
| BASE専用DB | 再投入、外部キー違反時rollback、12同時在庫更新と履歴PASS | 実際のLua/oxmysqlハンドラー、招待競合、権限、実機NOT_RUN |
| LINK静的 | 配置済みソースのJS・manifest・NUI参照・旧識別子維持PASS | Lua構文NOT_RUN |
| LINK専用DB | 再投入、重複session時rollback、8同時重複登録で1件成功PASS | 実際のroom/API/AIサーバー同期NOT_RUN |
| LINKゲーム拡張 | 実fall_battle.jsで24組の同seed対戦と再現性・合法手・盤面不変条件PASS | Luaサーバー検証・通信・UI操作ではない |
| LOOP | 作業ツリー版のJS・manifest・25ゲームID一意性PASS | 配置版LINKとは異なるソース。Lua/ゲーム個別挙動NOT_RUN |
| WAVE | JS・CSS・アプリ識別、曲長／小節移動の純粋関数PASS。専用DBへDDLを2回投入PASS | Lua・移行・実API・演奏実機NOT_RUN |
| フレプリ | UI・import/session hookのソース検査PASS。専用DBへ実DDLを2回投入PASS | カメラ・課金・返金・実API・Lua NOT_RUN |
| プリフォト | 配布済みUI参照・import/album hookのソース検査PASS。専用DBへ実DDLを2回投入PASS | 写真・編集データ・権限・Lua・実API NOT_RUN |
| mining | manifest等の共通静的検査PASS、ローカルGit snapshot成功 | Lua・ジョブ実機NOT_RUN |
| ログ | LINKの実行開始位置から対象タグの収集を実行、対象行0を記録 | 0行を正常動作の証拠にしない |
| NUIブラウザ | 実行入口、通信制限、失敗画面保存のコードを実装 | Playwright/Chromium・アプリ別シナリオがなくNOT_RUN。ブラウザ機構自体の実動作も未検証 |
| FiveMクライアント | 自動操作を実装・実行していない | 公式条件を確認した方式を整備するまで手動 |

総合結果は未実施項目があるためNOT_RUNです。個別のPASSを実機を含む全体成功に読み替えません。

検証中に見つかったツール側の不具合（強制終了時のsignalCode判定、NUIルート相対URL、Lua長文字列DDLの抽出）を修正し、該当検査を再実行しています。失敗した履歴は削除していません。

## バックアップと無変更確認

配置済みBASEとLINKを .flecity-dev/projects/<id>/backups に保存し、全ファイルのハッシュを照合しました。調査・実装後にもう一度配置先と比較して一致しました。

- BASEバックアップ：2026-10-30T13-21-44-731Z-685e38f8
- LINKバックアップ：2026-10-30T13-21-44-932Z-5ebab9bf

更新計画とBASE復旧計画をローカルに保存しました。復旧処理は専用fixtureで、正常切替、切替前の失敗、切替途中の失敗、元のファイル・Gitメタデータまでの復元を検証しています。

テストサーバーへの配置・リソース停止／再起動・DB移行・既存MariaDBサービスの操作はしていません。全体再起動用の経路も追加していません。local.jsonのdeploymentEnabledはfalseです。

BASEとLINKの検査対象ソースを、それぞれ .flecity-dev/projects/<id>/git の独立ローカルGitへ保存しました。

- BASEローカルコミット：c8abd4f871a13ac58723897d8fa43c909376d736
- LINKローカルコミット：4e080865bff2fce7258752d18b55b927ef6bf70b

共通基盤自体もcheckpoint toolkitで同様に保存します。親リポジトリの既存変更をまとめてコミットすることはありません。

## 次に必要なもの

最初の障害はLua 5.4一式（runtimeとcompiler）の取得です。通常PATHと既存の候補では見つかりませんでした。

[Lua公式の配布案内](https://www.lua.org/download.html)が案内する[LuaBinaries](https://luabinaries.sourceforge.net/download.html)の5.4.8 Windows x64パッケージを取得しようとしましたが、通常URLと直接ミラーの両方がHTMLを返し、公開SHA-256に一致しませんでした。取得物は.rejected.htmlへ隔離し、展開・実行していません。

検証に使用した公開SHA-256：
20321e893509e575d2454dd7bbf05342c1f3cb1b3788c0ec5a55ae4279dde169

新たなPowerShell操作やtxAdmin操作はまだ不要です。信頼できるLua 5.4のruntime/compilerが入手できたら、その保存場所を知らせるだけでCodex側でlocal.jsonへの登録・バージョン確認・Luaテストを続行できます。

その後の残作業は、完全なBASE作業ソースの用意、アプリ別のオフラインNUIシナリオ、実Lua/oxmysqlを通す分離FiveMハーネス、実機での最小確認です。新規リソースの初回サーバー導入とserver.cfg登録も別レビューが必要です。現在のツールは既存配置の更新・復旧を扱います。

これらが整うまでは稼働サーバーを更新しません。実機段階になった時にだけ、対象リソース単位のtxAdmin操作とLB Phone確認を具体的に提示します。
