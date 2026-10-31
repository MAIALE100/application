# 移行時のリソース照合

既存台帳 `projects/*.json` を維持し、本表は移行確認を補う。詳細ハッシュはreports/migration-20261031/inventory.json。

| アプリ | 実リソース | 新環境の状態 | 元環境で検査に使っていたソース |
| --- | --- | --- | --- |
| BASE | flecity_base | ルートにも候補にも存在しない | `.flecity-dev/candidates/base/63fbb4c8-91af-4db2-b4df-f1a11b6ced47/flecity_base`、23ファイル |
| LINK（旧PARTY） | flecity_games | ルート版は元ルートと同一。検査用版は未移行 | `.flecity-dev/sources/link/308741e503a130a570ffaf74ed176edcc2480fe1/flecity_games`、61ファイル |
| LOOP（旧PLAY） | flecity_games | ルート版は元ルートと同一。LINKと共有する版の統一は未完了 | ルートflecity_games。LINK用コピーとの同一性・互換性は未検証 |
| WAVE | wave | ルートにも検査用コピーにも存在しない | `.flecity-dev/sources/wave/a9fc23b2425f6404fb559c9969e94f80995bd238/wave`、12ファイル |
| フレプリ | puribooth | リソース全体が未移行 | ルートpuribooth、24ファイル |
| プリフォト | puriphoto | 既存8ファイルが異なる。5ファイル不足。旧ビルド242ファイルが残る | ルートpuriphotoの未コミット更新版 |

上記は指定された元フォルダとバックアップとの比較。サーバー配置版や全worktreeを横断した絶対的な最新版とは認定しない。
BASE候補・LINK/WAVEコピーはバックアップ内の対応ファイルとSHA-256一致。復元や配置は未実施。
依存関係・テストコマンド等は既存projects/*.json、FLECITY_DEVELOPMENT.mdを参照。
サーバーの既存配置、起動順序、DB資格情報、稼働状態は今回再調査していない。再起動・更新は行っていない。
