# Flecity 共通ローカル開発基盤

## 自動反映の標準安全制御（2026-10-31追加）

`devtools/flecity/SERVER_AUTOMATION_SAFETY_JA.md` を参照。新規登録もUPDATE_POLICYの未承認・無効を継承する。
ローカル検証はFiveM停止・接続者ありでも継続し、実反映だけを8条件で拒否/許可判定する。公開HTTPの0人は承認根拠にしない。
実反映アダプターと初回更新は未承認・無効のまま。使い捨てSQL、visual、virtual-multiplayerスイートを追加し、未検証をPASSとしない。

## 現行方針：既存テストサーバーを使用

現在は D:\FiveM_Test_Server の既存FiveM/QBox/oxmysql/LB Phoneを利用します。専用FXServer方式は中止し、labコマンドと直接起動入口を無効化しました。ライセンスキーの発行・表示・コピー・変更は不要です。専用MariaDBを使う破壊的試験とオフラインNUI検証は引き続き利用できます。

    .\flecity.cmd server check base
    .\flecity.cmd server check link
    .\flecity.cmd server logs base
    .\flecity.cmd server verify base
    .\flecity.cmd server verify link
    .\flecity.cmd server plan-bridge

check/logsは固定localhostのinfo.json・dynamic.json・players.json、対象ファイル、対象タグのログだけを読みます。playersの名前・識別子は保存しません。verifyはローカル静的・NUI試験と読み取りチェックを連続実行します。既存DBへ直接接続せず、server.cfgとライセンスファイルも読みません。

更新・再起動は両方の人数APIが0人で一致した場合だけ候補になり、観測は2秒で失効します。変更直前に再取得して確認し、不明・不一致・接続中は保留します。LINK/LOOPは同じflecity_gamesです。

flecity_validation_bridgeは2026-10-31に承認済みの初回導入を完了しました。操作はbase_selftestとgame_selftestに固定し、bridge内部でも接続人数0・期限・nonce・capabilityを検査します。game_preflightはDB Ensureを呼ぶので除外します。bridgeにリソース停止・再起動や任意コンソール実行を許可しません。

server run base/linkは承認記録と導入ファイル照合がなければ拒否します。コマンド発行をPASSとせず、実行開始マーカー以降の一意な自己診断結果を待ちます。古いPASS、ログ回転、複数の結果、結果欠落は成功と扱いません。BASE/LINKの自己診断は成功済みで、ゲームクライアント試験は未実施です。

UIの作成・在庫更新と4ゲームのローカル試験、専用データの識別・影響検査・後片付け・復旧は [fixtures/README.md](devtools/flecity/fixtures/README.md) を参照してください。ガードはオフライン用で、実サーバーのSQL制限とは区別します。現在の依頼では実際のDB書込み前に明示承認を受け、fixture plan/verify-dbで使い捨てDBだけの計画を固定します。

リソースから独立したツールは devtools/flecity にあります。Node.js 22以上とローカルGitを使用します。GitHubへの接続・fetch・push・Actionsは必要ありません。

この入口を新規アプリ・ジョブ・ゲーム・スクリプトでも優先してください。既存の個別アップデーターを共通テストから実行しません。

## 通常のコマンド

リポジトリルートからcmdまたはPowerShellで実行できます。

    .\flecity.cmd list
    .\flecity.cmd doctor
    .\flecity.cmd new my_app --kind lb-phone
    .\flecity.cmd new my_job --kind job
    .\flecity.cmd new my_js_job --kind job --language js
    .\flecity.cmd new my_game --kind game
    .\flecity.cmd register existing_app --source existing_app --kind resource
    .\flecity.cmd test base --suite static
    .\flecity.cmd test link --suite db
    .\flecity.cmd test link --suite game
    .\flecity.cmd test base --suite nui
    .\flecity.cmd test base --suite live
    .\flecity.cmd test all --suite all
    .\flecity.cmd status all
    .\flecity.cmd checkpoint toolkit --message "shared-tool changes"
    .\flecity.cmd checkpoint base --message "before next change"

PowerShell以外では node devtools/flecity/cli.mjs に置き換えても同じです。

new は既存ディレクトリ・登録を上書きしません。4種類の雛形に、ソース、テストアダプター、テスト設定、ログタグ設定を作成します。lb-phone以外の雛形は最小のLuaエントリーで、完成したジョブやゲームではありません。アプリ固有テストの空欄はNOT_RUNになります。

既存リソースの register はソースを変更せず、共通ツール側に設定とアダプターを生成します。

## 分離した構成

| 場所 | 役割 |
| --- | --- |
| devtools/flecity/core.mjs, checks.mjs | 共通実行・結果・パス制限 |
| devtools/flecity/projects/*.json | リソース名、種類、ソース、ログタグ、拡張モジュール |
| devtools/flecity/adapters/*.mjs | BASE、LINK、LOOP、WAVE、FLEPURI、PuriPhotoの個別検証 |
| devtools/flecity/project-tests/ | registerで生成する既存リソース用テスト |
| 各リソース/tests/flecity.mjs | newで生成する固有テスト |
| devtools/flecity/modules/ | 実ルールを使うゲーム／AI対戦モジュール |
| database.mjs | TCP無効の使い捨てMariaDB。既存のDB資格情報は読まない |
| deployment.mjs | バックアップ、固定更新計画、ファイル更新、復旧 |
| nui.mjs | 任意のオフラインブラウザ試験。FiveMクライアントは操作しない |
| evidence.mjs | 実行開始後の対象ログ・手動画面・メモの保存 |
| .flecity-dev/ | PC固有設定、ソースの検査用コピー、実行結果、バックアップ、専用DB、独立ローカルGit |

アダプターは static(ctx) / db(ctx)、リソース側テストは staticChecks(ctx) を実装できます。ctx.check(name, fn)、ctx.exec(name, executable, args)、ctx.skip(name, reason)、ctx.read(relativePath) を利用します。共通ランナーはリソースの本体へ依存せず、アダプターを読み込みます。

ctx.exec はシェルを介さず、標準では60秒で打ち切ります。アダプターは開発者がレビューしたローカルコードとして扱います。

ゲームモジュールは async run(ctx) をexportします。独立Nodeプロセスで60秒上限で実行し、例外はFAIL、戻り値は検証の説明として保存します。登録例：

    .\flecity.cmd module my_game --file my_game/tests/rules.mjs
    .\flecity.cmd test my_game --suite game

実例 link-fall-battle.mjs は、配置済みLINKからコピーした実際のJavaScriptルールをメモリー内で計装し、同じseedで24組のAI対戦と再現性を検査します。元ファイル、ゲームクライアント、通信先は変更しません。サーバー側の不正入力検証やゲーム内同期を検証したことにはなりません。

## 実行結果と証跡

- PASS：その検査を実行して成功。
- FAIL：検査を実行して失敗。
- NOT_RUN：未登録・依存不足・実機未実施など。
- BLOCKED：安全条件や操作条件を満たさず拒否。

CLIの終了コードは 0=全検査PASS、1=失敗／操作拒否、2=未実行ありです。PowerShellの外側のランチャーでは非ゼロが1に見える場合があります。

結果は .flecity-dev/projects/<id>/runs/<実行ID>/result.json と summary.md に保存します。logs/、screenshots/、history.jsonl、スイート別の *-latest.json も作成します。結果にはソース全体のSHA-256とファイル別ハッシュを記録します。status はスイート別の状態と対象ハッシュを表示します。異なるハッシュの結果を混同しないでください。

ソースの修正前後に checkpoint を使うと、既存作業ブランチとは独立した .flecity-dev/projects/<id>/git にローカルコミットを作成できます。親リポジトリのブランチや未コミット変更、リモートは操作しません。checkpoint toolkit はツール・ルート入口・運用文書を保存します。ログ・画面・個人情報はこのGitへ含めません。ソースに秘密を入れない運用は引き続き必要です。

    .\flecity.cmd logs base --run <実行ID>
    .\flecity.cmd attach base --file <画面.png> --kind screenshot
    .\flecity.cmd attach base --file <確認メモ.txt> --kind note

logs は実行開始時のファイル位置から対象リソースのタグだけを収集します。ローテーション・切詰めを検出すると拒否し、過去のPASSを今回の成功として扱いません。attach は手動証跡で、検査ステータスをPASSへ変更しません。画像の内容は自動マスクしません。

## ソースを安全に選ぶ

現在の作業ブランチにソースがない場合、ブランチを切り替えず読み取り専用でコピーできます。

    .\flecity.cmd snapshot base --ref origin/base/workspace-dev
    .\flecity.cmd import link --from <既存flecity_gamesディレクトリ>

snapshot はローカルGitの固定コミットから普通のファイルだけを取得します。fetchを実行せず、ジャンクション・symlink・submoduleを拒否します。ローカルのorigin参照が古い場合は、その古い版を検査することになります。

import はハッシュ付きの検査用コピーとして保存し、初期状態では配置不可です。完全性・来歴を確認するまでは配置許可を変えません。今回のBASEコピーは前回取得した修正版の検査用抜粋なので、これ自体をデプロイしてはいけません。

LINKとLOOPは同じflecity_gamesリソースです。現在のLINKはテストサーバー上にあり、旧識別子flecity_partyを使用します。LINKだけのつもりでflecity_gamesを再起動するとLOOPにも影響します。

## 専用DB

.flecity-dev/local.json に既存MariaDBのbinを指定すると、共通ツールはプロジェクトごと・実行ごとの新規datadir、ランダムパスワード、固有named pipeでMariaDBを起動します。TCPを無効にし、接続後に@@datadirを照合してからSQLを実行します。終了時はその接続先と起動した子プロセスだけを停止します。既存MariaDBサービスや3306へ接続しません。

故障注入、ロールバック、競合検査はこのDBだけで実施します。BASE・LINKは実際のスキーマと制約・トランザクションを直接SQLで試験します。oxmysqlのLuaハンドラーを通る統合試験はまだ未実装です。WAVE・FLEPURI・PuriPhotoはDDLの再投入までで、実際の移行・支払い・権限・カメラ処理は未検証です。

診断用データ領域は .flecity-dev/db に残します。自動で稼働DBの接続文字列を取得したり、元DBからデータをコピーしたりしません。

## Lua・NUI・実機

Lua 5.4の実行ファイル・コンパイラーは、PATH、FLECITY_LUA/FLECITY_LUAC、またはlocal.jsonのlua/luacで指定します。5.4以外を成功扱いしません。2026-10-30にDownloadsのLuaBinaries 5.4.8 Windows x64版を公開SHA-256・Zone.Identifier・PE形式で検証し、.flecity-dev/tools/lua-5.4.8-verifiedへ展開しました。lua54.exe / luac54.exeとも5.4.8で、全登録プロジェクトのLua構文検査とBASE/LINKの回帰を実行済みです。先のHTML取得失敗物は隔離したままです。

オフラインNUIブラウザ試験には、ローカルplaywright＋Chromium、プロジェクトのnui.entry、レビュー済みnui(ctx,page)とnuiPrepare(ctx,page)が必要です。未設定はNOT_RUNです。BASE/LINKはデスクトップ同梱Playwrightと既存Chromeをlocal.jsonのbrowser.module/channelで指定しています。prepareで合成NUI応答を設定し、DB・サーバーを使わず画面操作を検証します。外部HTTP/WebSocket通信とservice workerを止め、成否の画面、ページエラー、コンソールを保存します。ブラウザのバージョンも結果へ記録します。実際のLB Phoneブリッジ、CEF、サーバー認証はこの試験に含みません。

FiveMクライアント自動操作は実装していません。将来追加する際は、その時点の公式利用条件とサーバー運用条件を確認した方法に限定します。現状のliveスイートは未実施を記録する入口です。LB Phone画面、複数人同期、実際のQBox/oxmysql呼出しは人間の実機確認が必要です。

## 更新と復旧

現在は配置無効です。既存サーバーへファイルを書き込む前に、完全なソース、Luaを含む全静的検査、DBバックアップまたは専用DB、対象だけ停止したことを確認します。共通基盤はサーバーの停止・再起動・任意コンソールコマンド・SQL移行を実行しません。

    .\flecity.cmd backup base
    .\flecity.cmd plan base
    .\flecity.cmd plan base --restore <バックアップID>

検査用ソースに文書等の欠落がある場合は、candidateで配置済みファイルを読み取りコピーし、検査用ソースをローカルへ重ねられます。配置先には書き込まず、配置先だけにあるファイルと改行だけの差を保持します。candidate.jsonへ変更・追加・保留条件を記録します。候補の静的・NUI・DB検証をやり直し、planの内容をレビューしてから扱います。

    .\flecity.cmd candidate base
    .\flecity.cmd preflight base
    .\flecity.cmd preflight link

preflightは固定のlocalhost info.jsonへのGETとファイル照合だけを行い、実機試験はNOT_RUNと記録します。候補の適用には --review-confirmed <計画ID> も必要です。許可前はdeploymentEnabled=falseを維持します。

backup は対象リソースだけをPC内にコピーし、全ファイルのハッシュを照合します。plan は配置内容を固定し、差分・削除・共有先・阻害条件を保存します。検査用抜粋、静的NOT_RUN、更新元の改変、計画後の配置先変更、未承認の削除があれば適用しません。配置先は調査したD:\FiveM_Test_Server配下の明示したリソースだけです。本番・任意ディレクトリを渡すことはできません。

実機更新へ進む段階でCodexが計画を提示し、local.jsonのdeploymentEnabledを明示的に有効化したうえで、対象リソース停止とDB安全条件を確認します。その後 apply <id> --plan <ID> --offline-confirm <リソース名> --db-backup-confirmed を使用します。共有リソースには --allow-shared-resource、計画した削除には --allow-removals も必要です。

ファイル配置は検査した固定バイト列をステージングし、既存フォルダーを別名で保持して切り替えます。途中で失敗した場合は元へ戻します。復旧もplanで固定し、バックアップの改変を検出します。稼働リソースでの切替・復旧は今回未実行で、専用fixtureで正常系と失敗系を検証しています。

新規リソースの最初のサーバー導入は別途レビューが必要です。現在のapplyは既存配置先の更新・復旧に限定され、server.cfgを自動変更しません。

BASEなどは再起動だけでもDB移行が走ります。ファイル復旧はDBを逆移行しません。実DB復元を自動実行しないでください。DBの復旧計画はファイル復旧から分離します。

## 基盤の検証

既存テストサーバーのブリッジ初回導入は2026-10-31に承認され、接続者0人・配置済みコード監査・バックアップ後に実施しました。BASEのbase_selftestはPASS (0/8 failed)、LINKのgame_selftestはend failures=0。サーバー全体と既存アプリは再起動せず、BASEとLINK/LOOPのファイルハッシュも一致しました。自己診断はSELECTと純粋な検査だけで、game_preflightは実行しません。

    .\flecity.cmd server run base
    .\flecity.cmd server run link
    .\flecity.cmd server prepare-client base
    .\flecity.cmd server prepare-client link

server runは監査した配置ハッシュ、初回承認記録、ブリッジの固定ハッシュ、接続者0人を確認してから固定自己診断だけを要求します。新しいアプリはコード監査と許可操作のレビュー後に追加します。任意コマンドやアプリ再起動は許可しません。今回のACEはcommand.base_selftestだけで、command.restartは付与されていません。設定ファイルは編集せず、ブリッジの自動起動も設定していません。将来サーバーが停止した場合、同じ権限・起動状態が自動で復元されるとは扱いません。

異常時は認証済みtxAdmin Live Consoleから stop flecity_validation_bridge、続けて今回追加した remove_ace resource.flecity_validation_bridge command.base_selftest allow を実行し、停止確認後にブリッジのフォルダーだけを .flecity-dev/bridge-install/<計画ID>/rolled-back/ へ移して保管します。既存アプリ・server.cfg・ライセンスは変更しません。今回の計画IDはd047c52f-4d86-4b3b-9499-471556c38ecaで、同じディレクトリに監査、バックアップ識別子、導入ログ、確認結果、画面証跡があります。

prepare-clientはクライアントを起動・操作せず、全ケースをNOT_RUNとして計画を保存します。新しい登録プロジェクトでも同じコマンドを利用でき、clientPlanにリポジトリ内のJSON配列を指定すると個別ケースを追加できます。各ケースはid、description、dataEffect（read-only/session/persistent/unknown）を宣言します。宣言だけで実行を許可せず、callback監査・現行規約の確認・テスト用データの許可を別に必要とします。

実配置コードの確認で、BASE bootstrapはensurePersonalWorkspaceからワークスペース・メンバーをINSERTし、LINK GetSettingsもProfile.TouchからプロフィールをINSERT/UPDATEすると判明しました。画面閲覧だけのつもりでも実DB更新が起こるため、現在の無書込み条件でゲーム内画面を自動操作しません。専用テストキャラクター・専用fixtureと書込み範囲の承認が必要です。実プレイヤーのデータやランキングを試験に使ったり自動削除したりしません。

    node --test devtools/flecity/tests/*.test.mjs

fixture以外のリソース・稼働DBに書き込まず、安全ガード、雛形、バックアップ、更新失敗と復旧、NUIパス解決を検証します。
