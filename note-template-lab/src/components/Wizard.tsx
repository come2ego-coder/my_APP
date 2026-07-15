"use client";

import { useState } from "react";
import type {
  Analysis,
  ArticleMode,
  GeneratedArticle,
  GenreCut,
} from "@/lib/types";
import StepIndicator from "./StepIndicator";
import GenreStep from "./GenreStep";
import AnalysisStep from "./AnalysisStep";
import ArticleStep from "./ArticleStep";
import HistoryPanel from "./HistoryPanel";

type Step = 1 | 2 | 3;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "エラーが発生しました。");
  }
  return data as T;
}

export default function Wizard() {
  const [step, setStep] = useState<Step>(1);

  const [genre, setGenre] = useState("");
  const [cuts, setCuts] = useState<GenreCut[] | null>(null);
  const [selectedCut, setSelectedCut] = useState<GenreCut | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mode, setMode] = useState<ArticleMode>("ai");
  const [userInput, setUserInput] = useState("");

  const [article, setArticle] = useState<GeneratedArticle | null>(null);

  const [loadingCuts, setLoadingCuts] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const [cutsError, setCutsError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [articleError, setArticleError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);

  const handleSubmitGenre = async () => {
    if (!genre.trim()) return;
    setLoadingCuts(true);
    setCutsError(null);
    setCuts(null);
    try {
      const data = await postJson<{ cuts: GenreCut[] }>("/api/genres", {
        genre,
      });
      setCuts(data.cuts);
    } catch (e) {
      setCutsError(e instanceof Error ? e.message : "エラーが発生しました。");
    } finally {
      setLoadingCuts(false);
    }
  };

  const runAnalysis = async (cut: GenreCut) => {
    setLoadingAnalysis(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const data = await postJson<{ analysis: Analysis }>("/api/analyze", {
        genre,
        cut,
      });
      setAnalysis(data.analysis);
    } catch (e) {
      setAnalysisError(
        e instanceof Error ? e.message : "分析中にエラーが発生しました。"
      );
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSelectCut = (cut: GenreCut) => {
    setSelectedCut(cut);
    setStep(2);
    void runAnalysis(cut);
  };

  const handleGenerateArticle = async () => {
    if (!selectedCut || !analysis) return;
    setLoadingArticle(true);
    setArticleError(null);
    try {
      const data = await postJson<{ article: GeneratedArticle }>(
        "/api/generate",
        {
          genre,
          cut: selectedCut,
          analysis,
          mode,
          userInput: mode === "custom" ? userInput : undefined,
        }
      );
      setArticle(data.article);
      setStep(3);
    } catch (e) {
      setArticleError(
        e instanceof Error ? e.message : "記事の生成中にエラーが発生しました。"
      );
    } finally {
      setLoadingArticle(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setGenre("");
    setCuts(null);
    setSelectedCut(null);
    setAnalysis(null);
    setMode("ai");
    setUserInput("");
    setArticle(null);
    setCutsError(null);
    setAnalysisError(null);
    setArticleError(null);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-wakatake">
            NOTE TEMPLATE LAB
          </p>
          <h1 className="font-mincho text-xl font-bold text-sumi sm:text-2xl">
            売れるnoteの型 分析ラボ
          </h1>
        </div>
        <button
          onClick={() => setHistoryOpen(true)}
          className="tap-target rounded-pill border border-sumi/15 bg-white/70 px-4 py-2 text-[12px] font-bold text-sumi/70 shadow-washi"
        >
          過去の記事
        </button>
      </header>

      <div className="mb-8">
        <StepIndicator step={step} />
      </div>

      {step === 1 && (
        <GenreStep
          genre={genre}
          onGenreChange={setGenre}
          onSubmit={handleSubmitGenre}
          loading={loadingCuts}
          error={cutsError}
          cuts={cuts}
          onSelectCut={handleSelectCut}
        />
      )}

      {step === 2 && selectedCut && (
        <AnalysisStep
          cut={selectedCut}
          loading={loadingAnalysis}
          error={analysisError}
          analysis={analysis}
          mode={mode}
          onModeChange={setMode}
          userInput={userInput}
          onUserInputChange={setUserInput}
          onGenerateArticle={handleGenerateArticle}
          generating={loadingArticle}
        />
      )}

      {step === 2 && articleError && (
        <p className="mt-4 rounded-xl bg-shu/10 px-4 py-3 text-sm text-shu">
          {articleError}
        </p>
      )}

      {step === 3 && article && (
        <ArticleStep
          article={article}
          onBackToAnalysis={() => setStep(2)}
          onNewGenre={handleReset}
        />
      )}

      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
