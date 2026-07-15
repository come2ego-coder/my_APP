import Anthropic from "@anthropic-ai/sdk";
import { PATTERNS, STYLE_RULES } from "./patterns.js";

const DRAFTS_TOOL = {
  name: "submit_drafts",
  description: "Threads投稿の下書き案を3つ提出する",
  input_schema: {
    type: "object",
    properties: {
      drafts: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
        description: "文体ルールとパターンに沿った投稿文案。3案。",
      },
    },
    required: ["drafts"],
  },
};

export async function generateDrafts({ pattern, topic, avoid = [] }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const patternInfo = PATTERNS[pattern];

  const avoidSection =
    avoid.length > 0
      ? `\n\n以下の案はすでに却下されているので、似た内容・言い回しは避けて新しい切り口で書くこと:\n${avoid
          .map((d, i) => `[却下案${i + 1}]\n${d}`)
          .join("\n\n")}`
      : "";

  const prompt = `${STYLE_RULES}

## 今回の投稿パターン
${patternInfo.label}: ${patternInfo.description}

## 今回のトピック(今日AIでやったこと)
${topic}${avoidSection}

上記の文体ルールと投稿パターンに沿って、Threads投稿文の案を3つ作成してください。
3案はそれぞれ切り口や言い回しを変えて、似た文章にならないようにしてください。
submit_drafts ツールを使って結果を提出してください。`;

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    tools: [DRAFTS_TOOL],
    tool_choice: { type: "tool", name: "submit_drafts" },
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === "submit_drafts"
  );

  if (!toolUse || !Array.isArray(toolUse.input?.drafts)) {
    throw new Error("Claudeからの応答を解析できませんでした。もう一度お試しください。");
  }

  return toolUse.input.drafts.map((d) => d.trim());
}
