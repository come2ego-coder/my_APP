# Threads投稿ネタ帳

自分のプロフィール(経歴・立場)と、5つの投稿パターンから1つ選んで今日のネタ・出来事を入力すると、
Google Gemini API を使ってその人らしい語り口のThreads投稿の下書きを3案生成するツールです。
プロフィールは誰でも自由に入力できるので、特定の人物専用ではなく汎用的に使えます。

最後に添える一言は、いくつかの定型パターン(フォローを促す、コメントを促す、プロフィールのリンクに
誘導する、など)から選ぶか、「自由入力」を選んで自分で書けます。入力したプロフィールと選んだ一言は
ブラウザの `localStorage` に保存され、次回以降は入力不要です。

- APIキーはサーバーサイド (`app/api/generate/route.ts`) の環境変数として保持し、フロントエンドからは
  `/api/generate` を叩くだけで、ブラウザにAPIキーが露出することはありません。
- Next.js (App Router) + Tailwind CSS で構築。

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に GEMINI_API_KEY を設定 (https://aistudio.google.com/apikey で無料取得)
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くと使えます。

## アクセス制限と利用回数の上限

このアプリは全ページ(`/login` と `/api/login` を除く)がミドルウェア (`middleware.ts`) で
保護されていて、`APP_ACCESS_PASSWORD` と一致するパスワードを `/login` で入力しないと
使えません。ログインすると90日間有効なクッキーが発行されます。`APP_ACCESS_PASSWORD` が
未設定の場合は誰もログインできません(fail closed)。

販売する場合は、購入者に配布した共通パスワードを note や BASE の「購入後に見える」部分に
書いておけば、決済とパスワード配布を自動化できます。パスワードが流出した場合は、
`APP_ACCESS_PASSWORD` を変更して再デプロイすれば、それ以降そのパスワードは使えなくなります。

さらに、Upstash Redis (Vercelの Storage タブから追加できる) を連携すると、
`/api/generate` の1日あたりの呼び出し回数に上限を設定できます (`DAILY_GENERATION_LIMIT`、
未設定時は100回)。Upstash未連携の場合は上限チェックはスキップされます。

## 環境変数

| 変数名 | 必須 | 説明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | Google Gemini APIキー。サーバーサイドのみで使用され、`.gitignore` で除外される `.env*` ファイルに保存する。 |
| `GEMINI_MODEL` | - | 生成に使うモデルID。未設定時は `gemini-flash-latest`(Googleが管理する最新のFlashモデルへのエイリアス)。 |
| `APP_ACCESS_PASSWORD` | ✅ | アプリ全体のログインに使う共通パスワード。未設定だと誰もログインできない。 |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | - | Upstash Redis連携時にVercelが自動設定。1日の利用回数カウントに使う。 |
| `DAILY_GENERATION_LIMIT` | - | `/api/generate` の1日あたりの上限回数。未設定時は100。Upstash未連携時は無効。 |

## Vercelへのデプロイ

1. このリポジトリ (このディレクトリ) をVercelにインポートする。
   - Root Directory に `threads-note-app` を指定する。
2. Vercelのプロジェクト設定 → Environment Variables に `GEMINI_API_KEY` と `APP_ACCESS_PASSWORD` を追加する。
3. (任意) Storage タブから Upstash Redis を追加し、`DAILY_GENERATION_LIMIT` を設定する。
4. デプロイ後に発行されるURLをスマホのSafari/Chromeでブックマークして使う。

Root DirectoryやEnvironment Variablesの設定をVercel側で変更した場合は、
このリポジトリに何かpushすると自動で再デプロイされます。
