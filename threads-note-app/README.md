# Threads投稿ネタ帳

5つの投稿パターンから1つ選び、今日のネタ・出来事を入力すると、Google Gemini API を使って
自分の話し方に合わせたThreads投稿の下書きを3案生成するツールです。

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
| `GEMINI_MODEL` | - | 生成に使うモデルID。未設定時は `gemini-2.5-flash`。 |

## Vercelへのデプロイ

1. このリポジトリ (このディレクトリ) をVercelにインポートする。
   - Root Directory に `threads-note-app` を指定する。
2. Vercelのプロジェクト設定 → Environment Variables に `GEMINI_API_KEY` を追加する。
3. デプロイ後に発行されるURLをスマホのSafari/Chromeでブックマークして使う。

Root DirectoryやEnvironment Variablesの設定をVercel側で変更した場合は、
このリポジトリに何かpushすると自動で再デプロイされます。
