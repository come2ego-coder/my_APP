# threads-post-generator

Threads投稿の下書きをAnthropic(Claude)で生成し、Typefullyに「下書き」として登録するCLIツール。
**自動公開は一切行いません。** 生成→3案から選択→Typefullyに下書き登録、まで。実際の投稿はTypefullyアプリを開いて手動で行ってください。

## セットアップ

1. 依存パッケージをインストール

   ```bash
   cd threads-post-generator
   npm install
   ```

2. `.env` ファイルを作成

   ```bash
   cp .env.example .env
   ```

   `.env` に以下を設定してください。

   - `ANTHROPIC_API_KEY` : https://console.anthropic.com で発行
   - `TYPEFULLY_API_KEY` : Typefully の Settings → API で発行
   - `TYPEFULLY_SOCIAL_SET_ID` : Threadsアカウントを接続した Social Set のID

   `.env` は `.gitignore` に含まれているため、Gitには含まれません。

## 使い方

```bash
node post.js --pattern log --topic "今日AIでアプリの広告オフ機能を作った"
```

- `--pattern` : 投稿パターン。以下のいずれか
  - `log` : 開発ログ
  - `before_after` : ビフォーアフター
  - `demo` : 実演
  - `struggle` : 失敗・つまずき
  - `question` : 問いかけ
- `--topic` : 今日AIでやったこと・話したい内容(自由記述)

実行すると:

1. Claudeが文体ルールに沿った投稿案を3つ生成してターミナルに表示
2. 番号(1〜3)で選択、`r` で再生成、`q` で中止
3. 選んだ案をTypefullyの下書きとして登録(`publish_at: "next-free-slot"` = 次の空き枠に自動セット、ただし下書きのまま。自動公開はしない)
4. 「Typefullyに下書き登録しました。アプリを開いて内容を確認・投稿してください。」と表示して終了

## Typefully API についての注意

このツールは Typefully API v2 (`POST /v2/social-sets/{social_set_id}/drafts`, `Authorization: Bearer`) を
公開されている情報をもとに実装しています。もし下書き登録時にAPIエラーが出る場合は、
[Typefully API ドキュメント](https://typefully.com/docs/api) の最新仕様を確認し、
`lib/typefully.js` のリクエストボディ(`platforms` のキー名など)を実際の仕様に合わせて調整してください。
エラーメッセージにはTypefullyからのレスポンス内容をそのまま表示するようにしているので、調整の参考にできます。

必要であれば以下の環境変数で調整できます(`.env` に追記):

- `ANTHROPIC_MODEL` : 使用するClaudeモデル(デフォルト: `claude-sonnet-5`)
- `TYPEFULLY_API_BASE` : APIのベースURL(デフォルト: `https://api.typefully.com`)
- `TYPEFULLY_PLATFORM_KEY` : リクエストボディの `platforms` 直下のキー名(デフォルト: `threads`)
