import { NextRequest, NextResponse } from "next/server";
import { generateCuts } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const genre = typeof body?.genre === "string" ? body.genre.trim() : "";

    if (!genre) {
      return NextResponse.json(
        { error: "ジャンルを入力してください。" },
        { status: 400 }
      );
    }

    const cuts = await generateCuts(genre);
    return NextResponse.json({ genre, cuts });
  } catch (error) {
    console.error("[/api/genres]", error);
    const message =
      error instanceof Error
        ? error.message
        : "切り口の生成中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
