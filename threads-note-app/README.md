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

## 環境変数

| 変数名 | 必須 | 説明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | Google Gemini APIキー。サーバーサイドのみで使用され、`.gitignore` で除外される `.env*` ファイルに保存する。 |
| `GEMINI_MODEL` | - | 生成に使うモデルID。未設定時は `gemini-flash-latest`(Googleが管理する最新のFlashモデルへのエイリアス)。 |

## Vercelへのデプロイ

1. このリポジトリ (このディレクトリ) をVercelにインポートする。
   - Root Directory に `threads-note-app` を指定する。
2. Vercelのプロジェクト設定 → Environment Variables に `GEMINI_API_KEY` を追加する。
3. デプロイ後に発行されるURLをスマホのSafari/Chromeでブックマークして使う。

Root DirectoryやEnvironment Variablesの設定をVercel側で変更した場合は、
このリポジトリに何かpushすると自動で再デプロイされます。
