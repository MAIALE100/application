Flecity運営ご担当者様

平素より大変お世話になっております。
このたび、街中設置型プリクラリソース「FLEPURI（フレプリ）」と、
以前ご提出した「PuriPhoto」の機能追加版をあわせてお送りいたします。

お忙しいところ恐れ入りますが、可能な限り運営様側の作業が少なくなるよう、
リソース本体・production UI・DB自動作成／自動移行・自己診断まで同梱しております。
原則として、Lua・JavaScript・SQL等を運営様側で編集していただく必要はございません。

────────────────────────
■ ご提出内容
────────────────────────

1. FLEPURI v1.0.5
   リソース名: puribooth

2. PuriPhoto v1.1.1 更新版
   リソース名: puriphoto

3. 運営様向け導入手順・コマンド一覧

PuriPhoto更新版には、以前ご提出した版以降に追加した
アルバム関連機能、メモ、マイスポット、おすすめ撮影スポット、
FLEPURIからの完成画像受け取り連携等を含んでおります。

────────────────────────
■ 運営様にお願いしたい作業
────────────────────────

基本的には以下のみとなります。

【1】既存PuriPhotoを更新版へ差し替え
【2】puriboothをresourcesへ追加
【3】Weazel job と Renewed-Banking会社口座「weazel」のご確認
【4】resource起動後に selftest を1回実行

DB用SQLの手動実行、PuriPhoto UIのnpm build、
FLEPURI用テーブルの手動作成等は不要です。

────────────────────────
■ 導入手順
────────────────────────

1) 念のため、現在稼働中の puriphoto フォルダをバックアップしていただけますと幸いです。
   ※PuriPhotoのアルバム等の保存データはDB側にあり、
     今回の更新版には既存データを削除する処理はございません。

2) 稼働中の場合は、txAdminコンソール等から下記を実行してください。

   stop puribooth
   stop puriphoto

   ※puriboothが未導入の場合、stop puribooth のエラーは問題ございません。

3) 既存の puriphoto フォルダを、同梱の更新版 puriphoto フォルダへ差し替えてください。

   古いproduction UIファイルが残らないよう、
   上書きコピーではなく「フォルダ単位で差し替え」を推奨いたします。

4) 同梱の puribooth フォルダをresources配下へ配置してください。

5) server.cfgでは、puriphotoの後にpuriboothが起動するようお願いいたします。

   ensure puriphoto
   ensure puribooth

   qbx_core / oxmysql / lb-phone / screenshot-basic は、
   既存のサーバー起動順のままで問題ございません。

6) ファイル配置後、サーバー全体の再起動は不要です。
   txAdminコンソール等から以下をご実行ください。

   refresh
   ensure puriphoto
   ensure puribooth
   puribooth_selftest

7) 最後に selftest PASS が表示されれば、導入完了となります。

────────────────────────
■ Weazel job / 会社口座について
────────────────────────

FLEPURIでは、既定で下記を使用いたします。

管理job:
  weazel

売上入金先:
  Renewed-Banking 会社口座「weazel」

恐れ入りますが、こちらのみ運営様権限でのご確認をお願いいたします。

・QBox側に job名「weazel」が登録されていること
・Renewed-Banking側に会社口座「weazel」が存在すること
・Weazel企業の口座として運用可能な状態であること

FLEPURI側では、会社口座の存在確認まで自動で行います。
設定が正常な場合、puribooth_selftest にて

  management_job=PASS
  payout=PASS(weazel=$...)

と表示されます。

もしFlecity様の環境で、Weazelのjob名や会社口座名が
「weazel」以外の名称になっている場合は、
運営様側でコードを編集していただく必要はございません。
名称をご教示いただけましたら、こちらで合わせた設定へ修正いたします。

────────────────────────
■ 運営権限での管理コマンド
────────────────────────

FLEPURI v1.0.5では、通常のWeazel所属者に加え、
ACE group.admin または group.god をお持ちの運営権限者様も
管理コマンドをご使用いただけるようにしております。

ゲーム内:

  /puribooth
  /puribooth place
  /puribooth remove
  /puribooth list
  /puribooth price <料金> [台ID]
  /puribooth sales
  /puribooth collect <all|台ID>

詳細は同梱の
  02_OPERATOR_COMMANDS_JA.txt
をご参照ください。

────────────────────────
■ フォントについて
────────────────────────

FLEPURIのプリクラ向け追加フォントは、再配布条件への配慮から
フォント本体を提出ZIPへ同梱しておりません。

未導入でもフォールバック書体で動作するため、
FLEPURI自体の起動・撮影・会計機能には影響ございません。

意図したプリクラ表示をご利用いただく場合のみ、
下記公式配布元から任意で導入いただけます。

・ポプらむ☆キウイ Telop
  https://kiwi-kawagoto.com/poprumkiwi/index.html

・ぎゃる文字ゴシックfree
  https://booth.pm/ja/items/8088925

・ひとりゴシック
  https://booth.pm/ja/items/7451003

・Hachi Maru Pop
  https://github.com/noriokanisawa/HachiMaruPop

配置先:
  puribooth/ui/fonts/

────────────────────────
■ 不具合時について
────────────────────────

万一、導入後に不具合・エラー等が発生した場合、
運営様側でDBやコードをご修正いただく必要はございません。

可能であれば以下をご共有いただけましたら、
こちらで原因確認・修正版作成まで対応いたします。

・発生日時
・対象プレイヤーのcitizenid / CSN
・台ID（分かる場合のみ）
・発生時の操作
・コンソールエラーまたはスクリーンショット

保守確認用として、下記コンソールコマンドも同梱しております。

  puribooth_selftest
  puribooth_support
  puribooth_refunds
  puribooth_collections

────────────────────────
■ 動作確認済み環境
────────────────────────

FLEPURI v1.0.5
PuriPhoto v1.1.1
qbx_core v1.24.0
oxmysql v2.14.3
lb-phone v2.9.0
screenshot-basic v0.17.2

実機にて、
料金支払い → 背景・床選択 → 4枚撮影 → 編集 →
PuriPhoto受け渡し → 写真保存 → 売上記録 →
Renewed-Banking Weazel会社口座への売上回収
まで一連の動作確認を実施済みです。

お手数をお掛けいたしますが、何卒よろしくお願い申し上げます。
