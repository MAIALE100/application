# PuriPhoto変更履歴

## 1.1.1

- FLEPURIから写真を一時受取token付きで取得し、NUIの明示的な確認後にだけ消費するよう変更。
- UIが起動途中で通知を受けた場合や確認応答に失敗した場合も、同じ受取を重複適用せず確認を再試行できるようにした。
- 起動失敗・期限切れ時は受取tokenを取り消せるclient exportを追加。
- UI sourceとproduction distの照合コマンドを追加し、未参照の古い生成物を含むdistを再生成。
