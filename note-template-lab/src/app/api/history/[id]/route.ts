import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ArticleHistoryDetail, ArticleMode } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const a = await prisma.article.findUnique({ where: { id } });

    if (!a) {
      return NextResponse.json(
        { error: "記事が見つかりませんでした。" },
        { status: 404 }
      );
    }

    const detail: ArticleHistoryDetail = {
      id: a.id,
      genre: a.genre,
      cutLabel: a.cutLabel,
      cutDescription: a.cutDescription,
      analysis: JSON.parse(a.analysisJson),
      mode: a.mode as ArticleMode,
      userInput: a.userInput,
      title: a.title,
      body: a.body,
      advice: a.advice,
      createdAt: a.createdAt.toISOString(),
    };

    return NextResponse.json({ article: detail });
  } catch (error) {
    console.error("[/api/history/:id]", error);
    return NextResponse.json(
      { error: "記事の取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
