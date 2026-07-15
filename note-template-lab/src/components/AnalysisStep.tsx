"use client";

import type { Analysis, ArticleMode, GenreCut } from "@/lib/types";
import PillButton from "./PillButton";

interface Props {
  cut: GenreCut;
  loading: boolean;
  error: string | null;
  analysis: Analysis | null;
  mode: ArticleMode;
  onModeChange: (m: ArticleMode) => void;
  userInput: string;
  onUserInputChange: (v: string) => void;
  onGenerateArticle: () => void;
  generating: boolean;
}

function Section({
  title,
  items,
  ordered,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] font-bold text-wakatake">{title}</p>
      {ordered ? (
        <ol className="mt-2 flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-sumi/80">
              <span className="shrink-0 font-mincho font-bold text-indigo">
                {i + 1}.
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-sumi/80">
              <span className="shrink-0 text-shu">・</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AnalysisStep({
  cut,
  loading,
  error,
  analysis,
  mode,
  onModeChange,
  userInput,
  onUserInputChange,
  onGenerateArticle,
  generating,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-sumi/10 bg-white/70 p-5 shadow-washi">
        <p className="text-[12px] font-bold text-sumi/45">選んだ切り口</p>
        <p className="font-mincho text-lg font-bold text-indigo">{cut.label}</p>
        <p className="mt-1 text-[13px] text-sumi/60">{cut.description}</p>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-white/60 p-10 shadow-washi">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo/25 border-t-indigo" />
          <p className="text-sm text-sumi/60">
            実際に読まれているnote記事をリサーチ中です…
          </p>
        </div>
      )}

      {error && !loading && (
        <p className="rounded-xl bg-shu/10 px-4 py-3 text-sm text-shu">{error}</p>
      )}

      {analysis && !loading && (
        <>
          <div className="relative overflow-visible rounded-2xl border border-sumi/10 bg-white/85 p-5 pt-6 shadow-washiLg sm:p-6">
            <div
              className="stamp-rotate pointer-events-none absolute -right-2 -top-4 flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full border-[3px] border-double border-shu text-shu sm:-right-3 sm:-top-5 sm:h-[84px] sm:w-[84px]"
              aria-hidden
            >
              <span className="font-mincho text-[10px] font-bold leading-tight sm:text-[11px]">
                分析済み
              </span>
              <span className="mt-0.5 h-[1px] w-6 bg-shu/60" />
              <span className="mt-0.5 text-[8px] font-bold tracking-widest sm:text-[9px]">
                CHECKED
              </span>
            </div>

            <div className="flex flex-col gap-5">
              <Section title="タイトルの型" items={analysis.titlePatterns} />
              <Section title="冒頭のつかみ方のパターン" items={analysis.openingPatterns} />
              <Section
                title="記事の構成の流れ"
                items={analysis.structureSteps}
                ordered
              />
              <Section title="売れている・読まれる理由" items={analysis.reasons} />
              <Section
                title="この型を使ったオリジナルタイトル案"
                items={analysis.originalTitles}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-sumi/10 bg-white/70 p-5 shadow-washi">
            <p className="text-sm font-bold text-sumi/70">
              新しい記事を書くときのモードを選んでください
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => onModeChange("ai")}
                className={`tap-target min-h-[48px] flex-1 rounded-pill border-2 px-5 text-sm font-bold transition ${
                  mode === "ai"
                    ? "border-indigo bg-indigo text-washi"
                    : "border-sumi/15 bg-white text-sumi/60"
                }`}
              >
                AIに任せる
              </button>
              <button
                onClick={() => onModeChange("custom")}
                className={`tap-target min-h-[48px] flex-1 rounded-pill border-2 px-5 text-sm font-bold transition ${
                  mode === "custom"
                    ? "border-indigo bg-indigo text-washi"
                    : "border-sumi/15 bg-white text-sumi/60"
                }`}
              >
                自分の主張・エピソードを入れる
              </button>
            </div>

            {mode === "custom" && (
              <textarea
                value={userInput}
                onChange={(e) => onUserInputChange(e.target.value)}
                rows={4}
                placeholder="記事に入れたい自分の考えや実体験を書いてください"
                className="mt-3 w-full resize-none rounded-xl border border-sumi/15 bg-washi px-4 py-3 text-[16px] text-sumi placeholder:text-sumi/35 focus:border-indigo/60"
              />
            )}

            <div className="mt-5">
              <PillButton onClick={onGenerateArticle} loading={generating}>
                この型で記事を書いてもらう
              </PillButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
