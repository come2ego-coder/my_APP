import { GoogleGenAI, ApiError, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 },
    );
  }

  const { image, mimeType } = (body ?? {}) as { image?: string; mimeType?: string };
  if (!image || !mimeType) {
    return NextResponse.json({ error: "画像がありません。" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていないため、自動読み取りは使えません。手入力で保存してください。" },
      { status: 500 },
    );
  }

  const categoryIds = CATEGORIES.map((c) => c.id);

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: image } },
            {
              text: `これは買い物のレシートの写真です。内容を読み取って、以下を推測してください。
- store: 店名(読み取れなければ空文字)
- date: 購入日。レシートに記載があればそれを "YYYY-MM-DD" 形式で。無ければ null
- amount: 合計金額(税込の支払い総額)。数字のみ、円記号やカンマは含めない
- category: 次の中から最も当てはまるもの1つを選ぶ: ${categoryIds.join(", ")}
- memo: 主な購入品を10文字程度で要約(例: "野菜・卵・牛乳" や "ガソリン")

レシートとして読み取れない画像の場合は amount を null にしてください。`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            store: { type: Type.STRING },
            date: { type: Type.STRING, nullable: true },
            amount: { type: Type.NUMBER, nullable: true },
            category: { type: Type.STRING, enum: categoryIds },
            memo: { type: Type.STRING },
          },
          required: ["store", "category", "memo"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "読み取りに失敗しました。手入力で保存してください。" },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(text) as {
      store?: string;
      date?: string | null;
      amount?: number | null;
      category?: string;
      memo?: string;
    };

    return NextResponse.json({
      store: parsed.store ?? "",
      date: parsed.date ?? null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      category: categoryIds.includes(parsed.category ?? "") ? parsed.category : "other",
      memo: parsed.memo ?? "",
    });
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
          { error: "アクセスが集中しているか、無料枠の上限に達しました。手入力で保存するか、しばらく待ってからお試しください。" },
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
