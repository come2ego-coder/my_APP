import { NextRequest, NextResponse } from "next/server";
import { generateArticle } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import type { Analysis, ArticleMode, GenreCut } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const genre = typeof body?.genre === "string" ? body.genre.trim() : "";
    const cut: GenreCut | undefined = body?.cut;
    const analysis: Analysis | undefined = body?.analysis;
    const mode: ArticleMode = body?.mode === "custom" ? "custom" : "ai";
    const userInput: string | undefined =
      typeof body?.userInput === "string" ? body.userInput.trim() : undefined;

    if (!genre || !cut?.label || !analysis) {
      return NextResponse.json(
        { error: "記事生成に必要な情報が不足しています。" },
        { status: 400 }
      );
    }

    const article = await generateArticle({
      genre,
      cut,
      analysis,
      mode,
      userInput,
    });

    const saved = await prisma.article.create({
      data: {
        genre,
        cutLabel: cut.label,
        cutDescription: cut.description,
        analysisJson: JSON.stringify(analysis),
        mode,
        userInput: mode === "custom" ? userInput ?? null : null,
        title: article.title,
        body: article.body,
        advice: article.advice,
      },
    });

    return NextResponse.json({ id: saved.id, article });
  } catch (error) {
    console.error("[/api/generate]", error);
    const message =
      error instanceof Error
        ? error.message
        : "記事の生成中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
