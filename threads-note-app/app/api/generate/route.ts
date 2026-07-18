import { GoogleGenAI, ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { PATTERNS } from "@/lib/patterns";

const SPLIT_MARKER = "|||SPLIT|||";

const STYLE_RULES = `あなたは50代女性の個人事業主。パン屋のパート、ライブバー運営(週末のみ)、洋服・着物のリメイク業を経てきて、
今は「AI×副業」をテーマにInstagram/Threadsで発信している。自分でAI(Claude Code)を使ってアプリを作り、
そのアプリを起点にThreadsで発信し、Instagram本垢への興味喚起、そこからLINE誘導、副業ノウハウ提供につなげたい。

文体ルール:
- 話し言葉、自然な日本語。「〜だよね」「〜なんだよね」など、独り言や気づきのトーン
- 難しい専門用語は使わない。カタカナ英語もできるだけ避ける
- 上から目線・説教くさい言い方はNG。あくまで自分の体験として話す
- 具体的なエピソード・数字・状況を入れる
- AIっぽい整いすぎた文章、絵文字の多用は避ける
- 一人称は「私」
- 最後にInstagram本垢への軽い興味づけの一言を入れる(直接リンクは貼らない。「詳しくは本垢で」くらいの軽さ)
- 長さはThreads投稿として自然な範囲(3〜8行程度)`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません(JSONとして読み込めませんでした)。" },
      { status: 400 },
    );
  }

  const { patternId, content } = (body ?? {}) as {
    patternId?: string;
    content?: string;
  };

  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern) {
    return NextResponse.json(
      { error: "投稿パターンが選択されていません。もう一度選び直してください。" },
      { status: 400 },
    );
  }

  if (!content || !content.trim()) {
    return NextResponse.json(
      { error: "今日のネタ・出来事を入力してください。" },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "サーバーにGEMINI_API_KEYが設定されていません。.envファイルを確認してください。",
      },
      { status: 500 },
    );
  }

  const userPrompt = `選んだ投稿パターン: 「${pattern.label}」
パターンの説明: ${pattern.description}
参考例: ${pattern.example}

今日のネタ・出来事:
${content.trim()}

上記の内容をもとに、Threads投稿の下書きを3案作ってください。
それぞれ独立した投稿として成立する内容にし、言い回しや切り口を変えてバリエーションを持たせてください。
出力は3案の本文だけを、区切り文字列 "${SPLIT_MARKER}" で区切って返してください。
見出しや番号、前置き・後書きの説明文は一切つけないでください。`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: STYLE_RULES,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "AIからテキストの応答が得られませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const drafts = text
      .split(SPLIT_MARKER)
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "AIの応答から下書きを取り出せませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ drafts });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          { error: "APIキーが無効です。GEMINI_API_KEYの設定を確認してください。" },
          { status: 401 },
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "アクセスが集中しているか、無料枠の上限に達しました。しばらく待ってからもう一度お試しください。" },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `AIとの通信でエラーが発生しました: ${error.message}` },
        { status: error.status || 500 },
      );
    }
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json(
      { error: `予期しないエラーが発生しました: ${message}` },
      { status: 500 },
    );
  }
}
