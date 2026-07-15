# 福祉車両応募アラート

福祉車両の贈呈・助成情報を新しい順に表示し、メール登録者へ通知するCloudflare Pagesサイトです。

## 構成

- `src/index.html`: 公開画面
- `src/data/sources.json`: お知らせ記事データ
- `src/admin/`: Decap CMS管理画面
- `src/admin-subscribers/`: PV・登録者・配信履歴の運用管理画面
- `functions/api/`: Decap CMSのGitHubログイン用Cloudflare Pages Functions
- `functions/api/subscribe.js`: メール登録と確認メール送信
- `functions/api/confirm.js`: 二重確認による登録確定
- `functions/api/unsubscribe.js`: 配信停止
- `functions/api/admin/`: 登録一覧、CSV、配信操作
- `functions/api/pageview.js`: 日別PV集計
- `migrations/`: Cloudflare D1のテーブル定義
- `scripts/build.js`: `src`を`dist`にコピーして検査するビルド

## 本番公開

- 公開URL: `https://fukushisharyo.pages.dev/`
- 管理画面: `https://fukushisharyo.pages.dev/admin/`
- 通知運用: `https://fukushisharyo.pages.dev/admin-subscribers/`
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

## 通知運用

Cloudflare Pagesには`SUBSCRIBERS_DB`という名前でD1を接続します。Functionsが初回アクセス時に必要なテーブルを自動作成します。

本番環境変数:

- `RESEND_API_KEY`: Resendの送信APIキー
- `MAIL_FROM`: `福祉車両応募アラート <alert@notify.example.jp>`形式の送信元
- `REPLY_TO`: 返信を受けるメールアドレス
- `SITE_URL`: `https://fukushisharyo.pages.dev`
- `ADMIN_PASSWORD`: 通知運用画面のパスワード
- `ADMIN_SESSION_SECRET`: 管理ログインCookieの署名用乱数
- `TOKEN_SECRET`: 配信停止リンクの署名用乱数
- `NOTIFY_WEBHOOK_SECRET`: GitHub Actionsと配信APIで共有する乱数
- `NOTIFY_START_DATE`: 自動配信を開始する日（`2026-07-15`形式）
- `MAX_EMAILS_PER_DISPATCH`: 1回の配信上限。Resend無料枠では`90`を推奨

GitHub ActionsのRepository secretにも同じ`NOTIFY_WEBHOOK_SECRET`を登録します。記事データ更新後と30分ごとの確認時に、未送信の受付中・受付予定記事だけを配信します。

