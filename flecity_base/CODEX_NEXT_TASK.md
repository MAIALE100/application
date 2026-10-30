# BASE → Codex 次回作業引き継ぎ

更新日: 2026-10-30
対象: MAIALE100/application / `base/workspace-dev`
開発版: `0.11.0-dev` ／ 運営提出・本番公開: **保留**

## 前回タスクは完了済み（再実施不要）

- PR [#7](https://github.com/MAIALE100/application/pull/7) は **2026-10-30にレビュー後、`base/workspace-dev`へsquash merge済み**（merge commit `37a4b5660bad828fe9c796d718d67bd171b57ced`）。
- 不正な文字入力（不正型・不正UTF-8・長すぎる文字列）が追加項目を削除するバグ、数値的に同じ項目IDの重複、DB自己診断の必須テーブル漏れを修正。
- Lua実行型回帰テスト `flecity_base/tests/custom-fields.lua` を追加。CodexがLua/JS構文、回帰、SQL/リソース整合を検査しPASSと報告。実DB/FiveM/複数人テストは未実施。
- `BASE CI` 起動前失敗の理由は**GitHub請求・利用上限**と判明。ユーザーがGitHub Actionsの注釈を確認し「The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings」と表示された（2026-10-30）。支払い失敗と上限不足のどちらかは未確定。**CIは未通過**。GitHubの請求設定を勝手に変更しない。`CI_REVIEW_2026-10-30.md`参照。
- ユーザーからは先行するテストサーバーの更新について「問題なし」と報告あり。ただし今回マージしたPR #7の修正については、更新後の実機確認が必要。
- 自動の運営提出ZIP生成は停止中。既存の運営提出ZIPとreleaseブランチは変更禁止。

## 次のCodexタスク（新しい作業用ブランチで）

1. `AGENTS.md`, `TESTING.md`, `HYBRID_ROADMAP_JA.md`, `CI_REVIEW_2026-10-30.md` を読んで、**既存のPR #7修正を再実装せず**、残ったリスクを解消する。
2. 優先度高: 在庫の自由項目と在庫数量の実DBテストを自動化できる範囲で整備（可能なら使い捨てMariaDBを用いたトランザクション/ロールバック/同時更新の検証）。本番DB・本番サーバーへの接続禁止。
3. 次点: 初期在庫登録、在庫変更、招待承認の同時実行時に想定外のレースやデッドロックが起きないか確認し、再現可能な回帰テストと必要最小限の修正を追加。
4. 追加機能は保留し、**安全性・検証容易性を先に改善**。必須のユーザー操作が発生する直前まで自律的に進める。
5. 静的テストは `node --check flecity_base/web/app.js`、`node flecity_base/tests/source-regression.mjs`、`lua5.4 flecity_base/tests/custom-fields.lua`、`luac5.4 -p`（全Luaファイル）を試す。使えないコマンドはNOT RUNと理由を明記。
6. CI失敗の原因区分はGitHub請求・利用上限と判明済み。再調査や再実行を繰り返さず、**ローカルCodex + Node.js/Lua + 使い捨てMariaDBによる自動検証環境**を整備する。最初は環境読み取りと影響範囲を限定した作業だけにし、実FiveMリソース再起動、既存DB編集、テストサーバー更新は許可範囲と安全な復旧手順を確認してから実施する。
7. 変更は `base/workspace-dev` 宛てのPRで提示する。マージ・運営提出・本番展開は実行しない。最後は差分、実施テスト、未検証内容、ユーザーの最小限の実機手順を日本語で簡潔に報告する。

## 継続方針

安定性 → 在庫自由項目のUX改善 → タスクの自由項目 → 会計の自由項目（記録のみ） → 用途別テンプレート → OWNER譲渡／通知。

標準機能だけでも簡単に使えることを維持する。銀行/社会口座/ox_inventoryは変更しない。データは自動削除しない。権限はすべてサーバーで再検証する。

## 役割

ChatGPT: 仕様優先順位・レビュー・マージ可否判断。
Codex: 実装・検証・PR。
ユーザー: GitHub/Codex接続の承認、FiveM/txAdmin実機確認、公開承認。
