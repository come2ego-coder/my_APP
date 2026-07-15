"use client";

import type { GeneratedArticle } from "@/lib/types";
import ArticleBody from "./ArticleBody";
import PillButton from "./PillButton";

interface Props {
  article: GeneratedArticle;
  onBackToAnalysis: () => void;
  onNewGenre: () => void;
}

export default function ArticleStep({
  article,
  onBackToAnalysis,
  onNewGenre,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-sumi/10 bg-white/85 p-5 shadow-washiLg sm:p-6">
        <p className="text-[12px] font-bold text-wakatake">記事の下書きができました</p>
        <h2 className="mt-1 font-mincho text-xl font-bold leading-snug text-sumi sm:text-2xl">
          {article.title}
        </h2>
        <div className="mt-5 border-t border-sumi/10 pt-5">
          <ArticleBody body={article.body} />
        </div>
      </div>

      <div className="rounded-2xl border border-kocha/30 bg-kocha/10 p-5 shadow-washi">
        <p className="text-[13px] font-bold text-kocha">
          ワンポイントアドバイス
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-sumi/80">
          {article.advice}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <PillButton variant="secondary" onClick={onBackToAnalysis}>
          分析に戻る
        </PillButton>
        <PillButton variant="primary" onClick={onNewGenre}>
          新しいジャンルで作る
        </PillButton>
      </div>
    </div>
  );
}
