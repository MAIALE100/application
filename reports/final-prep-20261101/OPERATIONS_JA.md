# 操作・管理の確認メモ

## LOOP・LINK

LB PhoneのストアでLOOPとLINKを入れ、各アプリからゲームを選ぶ。LINKはルームを作成し、表示されたコードを相手が入力して参加する。退出・再入室・ホスト切断・同時操作の実機確認は未完了。LOOPとLINKは同じ `flecity_games` リソースに含まれるため、更新や再起動は両方に影響する。

## WAVE

Studioで曲を編集・保存し、公開するとLibraryに表示される。購入売上はWAVE内部DBに計上され、制作者の受取操作時に銀行へ移す仕様。プレビューは収益計上しない。サブスクは現行設定で無効。実銀行振込や管理者権限の実機確認は未完了。通常ユーザーへ制作者の内部識別子を表示しないことを実機でも確認する。

## 設定

| 設定 | 現行値・場所 |
|---|---|
| LOOP/LINK登録 | `flecity_games/config/shared.lua`: `flecity_play`、`flecity_party`、どちらも無料 |
| LINK+ | 同上: 7日、50,000、Weazel収益先、銀行決済。現行設定を維持 |
| WAVE登録 | `wave/config/shared.lua`: `flecity_wave`、無料 |
| WAVE売上 | 同上: 制作者85%、プラットフォーム15%、受取下限1,000 |
| WAVEサブスク | 同上: `enabled=false` |
| WAVE管理 | 同上: ACEとWeazel bossの既存条件を維持 |

## 管理者向けコマンド

`game_status`、`game_party_status`、`game_healthcheck` は共有リソースの診断。`game_selftest` は自己テスト。`game_preflight` はDB Ensureを実行するため、読み取り専用確認として実行しない。WAVEは `wave_diag` と `wave_selftest` を実装する。実サーバーでのコマンド実行は今回NOT_RUN。コマンドの権限と出力先は対象環境で確認する。
