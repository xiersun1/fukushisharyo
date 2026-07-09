# 福祉車両応募アラート

日本の福祉車両贈呈・助成の応募開始、締切、要項更新を早く確認するための静的サイトです。

## 構成

- `src/index.html`: 公開画面
- `src/data/sources.json`: 応募先データ
- `src/admin/`: Decap CMS管理画面
- `functions/api/`: Decap CMSのGitHubログイン用Cloudflare Pages Functions
- `scripts/build.js`: `src` を `dist` にコピーして検証するビルド
- `dist/`: ビルド結果

## ローカル確認

```bash
npm run build
npm run serve
```

表示画面:

- `http://127.0.0.1:8787/`
- `http://127.0.0.1:8787/admin/`

## 本番運用

無料で始める場合は、GitHub + Cloudflare Pages + Decap CMS の構成にします。

- Build command: `npm run build`
- Build output directory: `dist`
- 管理画面: `/admin/`

同じドメインで既存HPと切り離す場合は、次のどちらかを使います。

- `https://fukushi-sharyo.yakami.or.jp/`

## Decap CMS

CMS設定は `src/admin/config.yml` です。GitHubリポジトリは `xiersun1/fukushisharyo` に設定済みです。

本番ログインには、GitHub OAuth Appを作成し、Cloudflare Pagesの環境変数に次を設定します。

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

GitHub OAuth AppのURL:

- Homepage URL: `https://fukushi-sharyo.yakami.or.jp`
- Authorization callback URL: `https://fukushi-sharyo.yakami.or.jp/api/callback`
