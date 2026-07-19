"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "transcript" | "clean" | "generate" | "improve" | null;

export default function YoutubePage() {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [cleaned, setCleaned] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  const [loadingStep, setLoadingStep] = useState<Step>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [showImprove, setShowImprove] = useState(false);
  const [targetExcerpt, setTargetExcerpt] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  async function handleFetchTranscript() {
    setLoadingStep("transcript");
    setError(null);
    try {
      const res = await fetch("/api/youtube-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `エラーが発生しました(status: ${res.status})`);
        return;
      }
      setTranscript(data.transcript);
      setCleaned(null);
      setContent(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`通信エラーが発生しました: ${message}`);
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleClean() {
    if (!transcript) return;
    setLoadingStep("clean");
    setError(null);
    try {
      const res = await fetch("/api/youtube-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `エラーが発生しました(status: ${res.status})`);
        return;
      }
      setCleaned(data.cleaned);
      setContent(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`通信エラーが発生しました: ${message}`);
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleGenerate() {
    if (!cleaned) return;
    setLoadingStep("generate");
    setError(null);
    try {
      const res = await fetch("/api/youtube-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `エラーが発生しました(status: ${res.status})`);
        return;
      }
      setContent(data.content);
      setShowImprove(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`通信エラーが発生しました: ${message}`);
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleImprove() {
    if (!content || !targetExcerpt.trim()) return;
    setLoadingStep("improve");
    setError(null);
    try {
      const res = await fetch("/api/youtube-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousContent: content,
          targetExcerpt,
          additionalInfo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `エラーが発生しました(status: ${res.status})`);
        return;
      }
      setContent(data.content);
      setTargetExcerpt("");
      setAdditionalInfo("");
      setShowImprove(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`通信エラーが発生しました: ${message}`);
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleCopy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("コピーに失敗しました。手動で選択してコピーしてください。");
    }
  }

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <header className="text-center mb-8">
        <h1 className="font-mincho text-3xl sm:text-4xl font-bold text-plum-deep tracking-wide">
          YouTube動画からコンテンツ作成
        </h1>
        <div className="mt-2 mx-auto h-[3px] w-16 bg-gold rounded-full" />
        <p className="mt-3 text-sm text-plum-deep/70">
          文字起こし → 文章を整える → AIでコンテンツ化、を1つの画面で行います
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-xs text-plum-deep/60 underline underline-offset-2 hover:text-plum-deep"
        >
          ← Threads投稿ネタ帳へ
        </Link>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="mb-6">
        <h2 className="font-mincho text-lg text-plum-deep mb-3">① YouTube動画のURL</h2>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
        />
        <button
          type="button"
          onClick={handleFetchTranscript}
          disabled={loadingStep !== null || !url.trim()}
          className="mt-3 w-full rounded-lg bg-plum text-gold-light font-medium py-3 shadow-md transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingStep === "transcript" ? "文字起こしを取得中..." : "文字起こしを取得する"}
        </button>
        <p className="mt-2 text-xs text-plum-deep/60">
          動画に字幕(自動生成でも可)が設定されている必要があります。
        </p>
      </section>

      {transcript !== null && (
        <section className="mb-6">
          <h2 className="font-mincho text-lg text-plum-deep mb-3">② 文字起こし(必要なら編集)</h2>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep focus:outline-none focus:ring-2 focus:ring-gold/60"
          />
          <button
            type="button"
            onClick={handleClean}
            disabled={loadingStep !== null || !transcript.trim()}
            className="mt-3 w-full rounded-lg bg-plum text-gold-light font-medium py-3 shadow-md transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loadingStep === "clean" ? "文章を整えています..." : "文章を整える"}
          </button>
        </section>
      )}

      {cleaned !== null && (
        <section className="mb-6">
          <h2 className="font-mincho text-lg text-plum-deep mb-3">
            ③ 整えた文章(冒頭/本編/最後に)
          </h2>
          <textarea
            value={cleaned}
            onChange={(e) => setCleaned(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep focus:outline-none focus:ring-2 focus:ring-gold/60"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loadingStep !== null || !cleaned.trim()}
            className="mt-3 w-full rounded-lg bg-plum text-gold-light font-medium py-3 shadow-md transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loadingStep === "generate" ? "コンテンツを作成中..." : "④ コンテンツを作成する"}
          </button>
        </section>
      )}

      {content !== null && (
        <section className="mt-8 space-y-4">
          <h2 className="font-mincho text-lg text-plum-deep">生成されたコンテンツ</h2>
          <div className="rounded-lg border border-gold/30 bg-white p-4 shadow-sm">
            <p className="text-sm text-plum-deep whitespace-pre-wrap leading-relaxed">
              {content}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-medium text-plum hover:bg-gold/10 transition-colors"
            >
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>

          {!showImprove && (
            <button
              type="button"
              onClick={() => setShowImprove(true)}
              className="text-sm text-plum-deep/80 underline underline-offset-2 hover:text-plum-deep"
            >
              コンテンツを改善する
            </button>
          )}

          {showImprove && (
            <div className="rounded-lg border border-plum/20 bg-white/60 p-4 space-y-3">
              <div>
                <label className="text-sm text-plum-deep/90 block mb-1">
                  改善したい箇所(コピペでOK)
                </label>
                <textarea
                  value={targetExcerpt}
                  onChange={(e) => setTargetExcerpt(e.target.value)}
                  rows={4}
                  placeholder="改善したい箇所、もっと詳しく書いてほしい箇所を貼ってください"
                  className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
                />
              </div>
              <div>
                <label className="text-sm text-plum-deep/90 block mb-1">
                  追加したい情報(任意)
                </label>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  rows={4}
                  placeholder="プラスで入れたい情報や、該当箇所の元の文字起こしを貼ってください"
                  className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
                />
              </div>
              <button
                type="button"
                onClick={handleImprove}
                disabled={loadingStep !== null || !targetExcerpt.trim()}
                className="w-full rounded-lg bg-plum text-gold-light font-medium py-3 shadow-md transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingStep === "improve" ? "反映中..." : "コンテンツに反映する"}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
