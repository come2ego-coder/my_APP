import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ArticleHistoryItem } from "@/lib/types";

export async function GET() {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        genre: true,
        cutLabel: true,
        title: true,
        createdAt: true,
      },
      take: 100,
    });

    const items: ArticleHistoryItem[] = articles.map((a) => ({
      id: a.id,
      genre: a.genre,
      cutLabel: a.cutLabel,
      title: a.title,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[/api/history]", error);
    return NextResponse.json(
      { error: "履歴の取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
