import { GoogleGenAI, ApiError } from "@google/genai";
import { NextResponse } from "next/server";

const CLEAN_SYSTEM_PROMPT = `あなたは文字起こしテキストの編集者です。
入力される文章は、YouTube動画を文字起こししたものです。以下のルールに従って整えてください。

- 誤字脱字をできる範囲で直す(完璧でなくてよい)
- 意味の区切りで句読点(「、」「。」)と改行を入れて読みやすくする
- 話の内容を要約したり、省略したりしない。言っている内容はそのまま残す
- 整えたら、動画の構成に沿って内容を3つに分け、それぞれ見出しをつけて出力する

出力形式(見出しは必ずこの3つを使う):
【冒頭】
(本編に入る前の挨拶や導入部分をここに)

【本編】
(冒頭と最後にを除いた本体部分をここに)

【最後に】
(本編が終わったあとのまとめ・締めの部分をここに)

見出し以外の説明文(「以下に整えました」等)は一切つけないでください。`;

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

  const { transcript } = (body ?? {}) as { transcript?: string };
  if (!transcript || !transcript.trim()) {
    return NextResponse.json({ error: "文字起こしのテキストを入力してください。" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "サーバーにGEMINI_API_KEYが設定されていません。.envファイルを確認してください。" },
      { status: 500 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
      contents: transcript.trim(),
      config: {
        systemInstruction: CLEAN_SYSTEM_PROMPT,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "AIからテキストの応答が得られませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ cleaned: text.trim() });
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
