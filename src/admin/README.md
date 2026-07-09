# Decap CMS 管理画面

このフォルダは福祉車両応募アラートの管理画面です。

- 本番URL: `/admin/`
- 編集対象: `src/data/sources.json`
- GitHubリポジトリ: `xiersun1/fukushisharyo`

本番ログインは、Cloudflare Pages Functionsの `/api/auth` と `/api/callback` を使います。
Cloudflare Pages側に `GITHUB_CLIENT_ID` と `GITHUB_CLIENT_SECRET` を設定してください。
