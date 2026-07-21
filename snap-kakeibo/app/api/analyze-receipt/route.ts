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
              text: `これは買い物の支払いを確認できる画像です。紙のレシートの写真の場合もあれば、
PayPayなど決済アプリの「支払い完了」画面のスクリーンショットの場合もあります。
内容を読み取って、以下を推測してください。
- store: 店名・支払い先(読み取れなければ空文字)
- date: 支払い日。記載があればそれを "YYYY-MM-DD" 形式で。無ければ null
- breakdown: 購入品の内訳。次のカテゴリの中から当てはまるもの毎に、小計(税込)を出す:
  ${categoryIds.join(", ")}
  - レシートの中の品目が複数のカテゴリにまたがる場合(例: 食料品と日用品が同じレシートに
    混在している場合)は、カテゴリごとに金額を分けて複数の要素を返す。
  - 品目が1つのカテゴリにまとまる場合は、要素1つ(合計金額)だけを返す。
  - breakdown内の各amountの合計が、支払いの合計金額(税込)と一致するようにする。
- memo: 主な購入品や支払い内容を10文字程度で要約(例: "野菜・卵・牛乳" や "ガソリン")

支払いの内容として読み取れない画像の場合は breakdown を空配列にしてください。`,
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
            breakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, enum: categoryIds },
                  amount: { type: Type.NUMBER },
                },
                required: ["category", "amount"],
              },
            },
            memo: { type: Type.STRING },
          },
          required: ["store", "breakdown", "memo"],
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
      breakdown?: { category?: string; amount?: number }[];
      memo?: string;
    };

    const breakdown = (parsed.breakdown ?? [])
      .filter(
        (b): b is { category: string; amount: number } =>
          typeof b.amount === "number" && b.amount > 0 && categoryIds.includes(b.category ?? ""),
      )
      .map((b) => ({ category: b.category, amount: b.amount }));

    return NextResponse.json({
      store: parsed.store ?? "",
      date: parsed.date ?? null,
      breakdown,
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
