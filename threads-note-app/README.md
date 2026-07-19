# Threads投稿ネタ帳

自分のプロフィール(経歴・立場)と、5つの投稿パターンから1つ選んで今日のネタ・出来事を入力すると、
Google Gemini API を使ってその人らしい語り口のThreads投稿の下書きを3案生成するツールです。
プロフィールは誰でも自由に入力できるので、特定の人物専用ではなく汎用的に使えます。
入力したプロフィールと最後に添える一言はブラウザの `localStorage` に保存され、次回以降は入力不要です。

- APIキーはサーバーサイド (`app/api/generate/route.ts`) の環境変数として保持し、フロントエンドからは
  `/api/generate` を叩くだけで、ブラウザにAPIキーが露出することはありません。
- Next.js (App Router) + Tailwind CSS で構築。

## YouTube動画からコンテンツ作成 (`/youtube`)

YouTube動画のURLを入れるだけで、以下の3ステップをまとめて行えます。

1. 動画の字幕(文字起こし)を取得する (`/api/youtube-transcript`)
2. 誤字脱字を直し、句読点・改行を入れて「冒頭/本編/最後に」に整える (`/api/youtube-clean`)
3. 整えた文章を元に、note記事などに使えるコンテンツ本文を作成する (`/api/youtube-content`)

生成後は、改善したい箇所と追加したい情報を入力して、コンテンツの一部を書き直すこともできます
(同じ `/api/youtube-content` に `previousContent` / `targetExcerpt` / `additionalInfo` を渡す)。

文字起こしは動画に設定されている字幕(自動生成でも可)を取得する仕組みのため、字幕のない動画では
利用できません。

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
