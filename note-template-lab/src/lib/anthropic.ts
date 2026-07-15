import Anthropic from "@anthropic-ai/sdk";
import type { Analysis, ArticleMode, GeneratedArticle, GenreCut } from "./types";

const MODEL = "claude-opus-4-8";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY が設定されていません。サーバーの環境変数を確認してください。"
    );
  }
  return new Anthropic({ apiKey });
}

const TARGET_READER =
  "50代女性。パート・飲食店経営・ハンドメイド販売など複数の仕事を掛け持ちしていて、" +
  "SNSでAI活用や副業をテーマに発信しはじめたばかりの初心者。パソコンやSNS操作は得意でなく、" +
  "複雑な事務作業や計算は苦手。難しい専門用語は避けた、行動につながるわかりやすい説明を好む。";

const STYLE_GUIDE = `
文章スタイルのルール(必ず守ること):
- 親しみやすく、話し言葉に近い自然な日本語で書く
- 難しい言葉・専門用語は避け、使う場合は簡単に言い換える
- 共感から入り、最後は具体的な行動につなげる
- 抽象論だけで終わらせず、必ず具体例を入れる
- 避けるもの: いかにもAIが書いたような硬い文章、上から目線、説教口調、過度な絵文字の羅列
`;

/** JSON以外のテキストが混ざっていても、JSON部分だけを取り出して安全にパースする */
function extractJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AIの応答からJSONを取り出せませんでした。");
    }
    const candidate = text.slice(start, end + 1);
    return JSON.parse(candidate) as T;
  }
}

/**
 * 構造化出力の本体は最後のtextブロックに入る。
 * (Web検索を使った場合、検索前後に説明用のtextブロックが挟まることがあるため、
 *  先頭ではなく末尾のtextブロックを取得する)
 */
function lastText(message: Anthropic.Message): string {
  for (let i = message.content.length - 1; i >= 0; i--) {
    const block = message.content[i];
    if (block.type === "text") {
      return block.text;
    }
  }
  throw new Error("AIから本文が返ってきませんでした。");
}

/** STEP1: ジャンルを8個の切り口(サブジャンル)に分解する */
export async function generateCuts(genre: string): Promise<GenreCut[]> {
  const client = getClient();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `あなたはnote(ブログ記事投稿サービス)の企画編集者です。
想定読者は次の通りです: ${TARGET_READER}

入力されたジャンルを、この読者が「自分に関係がある」と感じられる、具体的なサブジャンル(切り口)に
ちょうど8個、細分化してください。各切り口には次を含めます。
- label: 15字以内の短いラベル
- description: 30字程度の説明(どんな内容の記事か)

抽象的すぎる切り口(例:「AI活用法」だけ)は避け、読者の生活や悩みに直結する具体的な切り口にしてください。`,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            cuts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                },
                required: ["label", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["cuts"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `ジャンル: 「${genre}」\n\nこのジャンルを8個の切り口に分解してください。`,
      },
    ],
  });

  const parsed = extractJson<{ cuts: GenreCut[] }>(lastText(message));
  const cuts = parsed.cuts ?? [];
  if (cuts.length === 0) {
    throw new Error("切り口の生成に失敗しました。もう一度お試しください。");
  }
  return cuts.slice(0, 8);
}

/** STEP2: 選んだ切り口についてWeb検索でリサーチし、売れる記事の「型」を分析する */
export async function analyzeGenre(
  genre: string,
  cut: GenreCut
): Promise<Analysis> {
  const client = getClient();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 1,
      },
    ],
    system: `あなたはnoteの人気記事を専門にリサーチするアナリストです。
想定読者は次の通りです: ${TARGET_READER}

指示:
- Web検索は1回だけ使い、実際に読まれている・売れているnote記事の「傾向」を調べてください。
- 個別記事の本文を引用してはいけません。著作権に配慮し、パターン・傾向だけを一般化して要約してください。
- 検索結果が少ない場合でも、一般的に効果が高いとされるnote記事の型に基づいて分析を組み立ててください。
- 検索が終わったら、必ず最後に指定されたJSON形式で分析結果だけを出力してください。長い説明は不要です。`,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            titlePatterns: {
              type: "array",
              items: { type: "string" },
              description: "タイトルの型を3つ",
            },
            openingPatterns: {
              type: "array",
              items: { type: "string" },
              description: "冒頭のつかみ方のパターンを3つ",
            },
            structureSteps: {
              type: "array",
              items: { type: "string" },
              description: "記事の構成の流れを3〜5ステップ",
            },
            reasons: {
              type: "array",
              items: { type: "string" },
              description: "売れている・読まれる理由を3つ",
            },
            originalTitles: {
              type: "array",
              items: { type: "string" },
              description: "この型を使ったオリジナルタイトル案を3つ",
            },
          },
          required: [
            "titlePatterns",
            "openingPatterns",
            "structureSteps",
            "reasons",
            "originalTitles",
          ],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `ジャンル: 「${genre}」
選んだ切り口: 「${cut.label}」(${cut.description})

この切り口で実際に読まれている・売れているnote記事の傾向をリサーチし、
「型」として分析してください。`,
      },
    ],
  });

  return extractJson<Analysis>(lastText(message));
}

/** STEP3: 分析した型を使って新しいnote記事を生成する */
export async function generateArticle(params: {
  genre: string;
  cut: GenreCut;
  analysis: Analysis;
  mode: ArticleMode;
  userInput?: string;
}): Promise<GeneratedArticle> {
  const client = getClient();
  const { genre, cut, analysis, mode, userInput } = params;

  const modeInstruction =
    mode === "custom" && userInput
      ? `筆者自身の主張・エピソードとして、次の内容を必ず記事に自然に盛り込んでください:\n「${userInput}」`
      : `筆者の主張・エピソードは指定されていません。AIが読者像に合わせて、リアリティのある具体例やエピソードを考えて盛り込んでください。`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `あなたはnoteの人気ライターです。想定読者は次の通りです: ${TARGET_READER}
${STYLE_GUIDE}
以下の「型」の分析結果を使って、新しいnote記事の下書きを1本作成してください。
- 本文は600〜900字程度
- 見出し(小見出し)を2〜3個入れる。見出し行は必ず先頭に「## 」を付けること(例: 「## 見出しテキスト」)
- 見出しと見出しの間の本文は、段落ごとに改行(\\n\\n)で区切ること
- タイトルは分析結果のタイトルの型を参考に、新しく考える
- 記事をさらに良くするためのワンポイントアドバイスも1つ添える`,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "記事タイトル" },
            body: {
              type: "string",
              description:
                "見出しを含む本文(600〜900字程度)。見出し行は先頭に「## 」を付け、段落は改行で区切る",
            },
            advice: {
              type: "string",
              description: "記事をさらに良くするためのワンポイントアドバイス",
            },
          },
          required: ["title", "body", "advice"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `ジャンル: 「${genre}」
切り口: 「${cut.label}」(${cut.description})

【型の分析結果】
タイトルの型: ${analysis.titlePatterns.join(" / ")}
冒頭のつかみ方: ${analysis.openingPatterns.join(" / ")}
構成の流れ: ${analysis.structureSteps.join(" → ")}
読まれる理由: ${analysis.reasons.join(" / ")}
オリジナルタイトル案: ${analysis.originalTitles.join(" / ")}

【今回の記事の方向性】
${modeInstruction}

この型を使って、新しいnote記事の下書きを作成してください。`,
      },
    ],
  });

  return extractJson<GeneratedArticle>(lastText(message));
}
