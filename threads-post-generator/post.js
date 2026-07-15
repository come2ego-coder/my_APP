#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PATTERNS, isValidPattern, patternListText } from "./lib/patterns.js";
import { generateDrafts } from "./lib/generateDrafts.js";
import { createDraft } from "./lib/typefully.js";

function parseArgs(argv) {
  const args = { pattern: null, topic: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pattern" || arg === "-p") {
      args.pattern = argv[++i];
    } else if (arg === "--topic" || arg === "-t") {
      args.topic = argv[++i];
    }
  }
  return args;
}

function printUsage() {
  console.log(`使い方: node post.js --pattern <パターン名> --topic "<今日AIでやったこと>"

利用可能なパターン:
${patternListText()}

例:
  node post.js --pattern log --topic "今日AIでアプリの広告オフ機能を作った"`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。.env ファイルを確認してください(.env.example を参考に作成できます)。`);
    process.exit(1);
  }
  return value;
}

function printDrafts(drafts) {
  console.log("\n=== 生成された投稿案 ===\n");
  drafts.forEach((draft, i) => {
    console.log(`--- 案 ${i + 1} (${draft.length}文字) ---`);
    console.log(draft);
    console.log("");
  });
}

async function main() {
  const { pattern, topic } = parseArgs(process.argv.slice(2));

  if (!pattern || !topic) {
    printUsage();
    process.exit(1);
  }

  if (!isValidPattern(pattern)) {
    console.error(`不明なパターンです: ${pattern}\n`);
    printUsage();
    process.exit(1);
  }

  const anthropicKey = requireEnv("ANTHROPIC_API_KEY");
  const typefullyKey = requireEnv("TYPEFULLY_API_KEY");
  const socialSetId = requireEnv("TYPEFULLY_SOCIAL_SET_ID");
  void anthropicKey; // read via process.env inside generateDrafts

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const rejected = [];

  try {
    let drafts = await generateDrafts({ pattern, topic });

    // eslint-disable-next-line no-constant-condition
    while (true) {
      printDrafts(drafts);
      const answer = (
        await rl.question(
          `${PATTERNS[pattern].label}パターンの案です。番号を選んでください [1-${drafts.length}] / 再生成する場合は r / やめる場合は q: `
        )
      ).trim().toLowerCase();

      if (answer === "q") {
        console.log("中止しました。Typefullyへの登録は行いません。");
        return;
      }

      if (answer === "r") {
        rejected.push(...drafts);
        console.log("\n再生成しています...\n");
        drafts = await generateDrafts({ pattern, topic, avoid: rejected });
        continue;
      }

      const index = Number.parseInt(answer, 10);
      if (!Number.isInteger(index) || index < 1 || index > drafts.length) {
        console.log("入力が正しくありません。もう一度選んでください。");
        continue;
      }

      const chosen = drafts[index - 1];
      console.log("\nTypefullyに下書き登録しています...");
      await createDraft({ content: chosen, socialSetId, apiKey: typefullyKey });
      console.log(
        "\nTypefullyに下書き登録しました。アプリを開いて内容を確認・投稿してください。"
      );
      return;
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\nエラーが発生しました: ${err.message}`);
  process.exit(1);
});
