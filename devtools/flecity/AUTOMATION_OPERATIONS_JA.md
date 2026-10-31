# アプリ別の定期検証運用

対象: D:/FiveM_AutoDev/workspace-clean / project ID e0209a29-99b4-430b-9842-ec6c2eab5e21。
既存自動化ID flecity-02-00-13-00-jst を毎日02:00・13:00（Asia/Tokyo）で復旧する。実登録はCodex自動化画面とautomation.tomlで確認する。
プリフォトのみPAUSED。共通基盤・BASE・LINK・LOOP・WAVE・フレプリのT0/T1/T2を継続。初期復旧は検証継続モードであり、ソース自動修正・自動配置は含まない。

## 入口と強制ガード

powershell -NoProfile -ExecutionPolicy Bypass -File devtools/flecity/automation-run.ps1

ワークスペース固有のWindowsグローバルmutexを取得し全実行中保持。同時起動は終了コード75で拒否。
OS管理のため所有者クラッシュ後も取得可能。残存lease.jsonは削除せずabandonedファイルへ退避。
Node入口は所有プロセスの子・nonce・対象パスを検査する。Node入口だけを直接呼ばない。
アプリ単位で実行し、1アプリの失敗でも他アプリを続行。コマンド最大120秒、全体20分、出力最大2MiB。
タイムアウト時は自分が起動した子のプロセスツリー終了を試み、拒否された場合は直接の子を終了する。他の既存プロセス・FiveM・MariaDBを操作しない。
アプリごとに失敗回数を保存。失敗後1時間、3回以上連続失敗は24時間バックオフ。再試行ループなし。利用枠・認証制限も再試行せず終了。
状態・レポートは.flecity-dev/automation、個別証跡は.flecity-dev/projects/<id>。Git対象外。
ローカル状態が1GiB超、または定期証跡が30日超なら停止しアーカイブ確認を求める。自動削除なし。

## 許可範囲

共通テスト、対象5アプリの静的検査、BASEの模擬NUI、LINKのLua/JSゲーム検証と模擬NUI。
追加したSQLスイートはTCP無効の使い捨てMariaDBのみ。mariaBinは既存のD:/MariaDB/binを設定し、実DB接続設定は移さない。成功・正常終了を確認した専用datadirだけ片づけ、ログは保持する。
LINK共有リソースの仮想複数人検証、承認済み基準画像比較を追加。未登録・未承認の基準画像はNOT_RUN。
ローカル検証後、固定localhostの公開状態を読み取り観測する。公開0人は自動反映許可と扱わない。
自動反映の8条件・中断・復旧と未有効の実アダプターはSERVER_AUTOMATION_SAFETY_JA.mdを参照。UPDATE_POLICY.jsonは無効・承認0件を維持。
サーバー自己診断発行、ブリッジへの要求ファイル書込、デプロイ、再起動、実クライアント操作は呼ばない。server設定は未設定。
プリフォトを編集・検証対象に追加しない。保護基準との読み取り比較のみ行う。

## 停止・復旧

Codex自動化画面で上記IDを一時停止する。個別停止はMIGRATION_STATE.jsonの対象だけをPAUSEDにする。
旧プロジェクト用の別タスク・Windowsタスクスケジューラへの二重登録はしない。
PC電源ON・ログオン・Codex起動と権限が必要。スリープ中/電源OFF時の実行は保証しない。
モデルは既存gpt-6-luna/lowを維持。自動モデル切替・Claude連携なし。
バックアップはDドライブ内。別物理ドライブ退避・完全復元試験は未実施。
