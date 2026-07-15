import { NextRequest, NextResponse } from "next/server";
import { analyzeGenre } from "@/lib/anthropic";
import type { GenreCut } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const genre = typeof body?.genre === "string" ? body.genre.trim() : "";
    const cut: GenreCut | undefined = body?.cut;

    if (!genre || !cut?.label) {
      return NextResponse.json(
        { error: "ジャンルと切り口が正しく指定されていません。" },
        { status: 400 }
      );
    }

    const analysis = await analyzeGenre(genre, cut);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[/api/analyze]", error);
    const message =
      error instanceof Error
        ? error.message
        : "型の分析中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
