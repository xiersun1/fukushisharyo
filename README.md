# 福祉車両応募アラート

福祉車両の贈呈・助成情報を、お知らせ記事として新しい順に表示する静的サイトです。

## 構成

- `src/index.html`: 公開画面
- `src/data/sources.json`: お知らせ記事データ
- `src/admin/`: Decap CMS管理画面
- `functions/api/`: Decap CMSのGitHubログイン用Cloudflare Pages Functions
- `scripts/build.js`: `src`を`dist`にコピーして検査するビルド

## 本番公開

- 公開URL: `https://fukushisharyo.pages.dev/`
- 管理画面: `https://fukushisharyo.pages.dev/admin/`
- Build command: `npm run build`
- Build output directory: `dist`

## データ方針

`src/data/sources.json` の `notices[]` に、掲載日、タイトル、団体、状態、応募期間、詳細リンク、確認日、根拠メモを保存します。
地域別の絞り込みは使わず、記事として上から新しい順に並べます。

## Decap CMS

CMS設定は `src/admin/config.yml` です。GitHubリポジトリは `xiersun1/fukushisharyo` に設定済みです。

CMSログインにはGitHub OAuth Appを作成し、Cloudflare Pagesの環境変数に次を設定します。

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

GitHub OAuth AppのURL:

- Homepage URL: `https://fukushisharyo.pages.dev`
- Authorization callback URL: `https://fukushisharyo.pages.dev/api/callback`
