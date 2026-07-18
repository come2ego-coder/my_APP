"use client";

import { useState } from "react";
import Link from "next/link";
import { PATTERNS } from "@/lib/patterns";

export default function Home() {
  const [selectedId, setSelectedId] = useState(PATTERNS[0].id);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const selectedPattern = PATTERNS.find((p) => p.id === selectedId)!;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setDrafts([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId: selectedId, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `エラーが発生しました(status: ${res.status})`);
        return;
      }
      setDrafts(data.drafts ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`通信エラーが発生しました: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 2000);
    } catch {
      setError("コピーに失敗しました。手動で選択してコピーしてください。");
    }
  }

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <header className="text-center mb-8">
        <h1 className="font-mincho text-3xl sm:text-4xl font-bold text-plum-deep tracking-wide">
          Threads投稿ネタ帳
        </h1>
        <div className="mt-2 mx-auto h-[3px] w-16 bg-gold rounded-full" />
        <p className="mt-3 text-sm text-plum-deep/70">
          今日のネタ・出来事から、投稿の下書きを3案つくります
        </p>
        <Link
          href="/youtube"
          className="mt-4 inline-block text-xs text-plum-deep/60 underline underline-offset-2 hover:text-plum-deep"
        >
          YouTube動画からコンテンツ作成 →
        </Link>
      </header>

      <section className="mb-6">
        <h2 className="font-mincho text-lg text-plum-deep mb-3">
          投稿パターンを選ぶ
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PATTERNS.map((pattern) => {
            const isSelected = pattern.id === selectedId;
            return (
              <button
                key={pattern.id}
                type="button"
                onClick={() => setSelectedId(pattern.id)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border ${
                  isSelected
                    ? "bg-plum text-gold-light border-plum shadow-sm"
                    : "bg-white text-plum-deep border-plum/20 hover:border-gold/60"
                }`}
              >
                {pattern.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-lg border border-gold/30 bg-white/60 p-4">
          <p className="text-sm text-plum-deep/90">{selectedPattern.description}</p>
          <p className="mt-2 text-xs text-plum-deep/60">
            例:「{selectedPattern.example}」
          </p>
        </div>
      </section>

      <section className="mb-6">
        <label
          htmlFor="content"
          className="font-mincho text-lg text-plum-deep mb-3 block"
        >
          今日のネタ・出来事
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="今日あったこと、AIでやったこと、感じたことなど自由に書いてください"
          rows={5}
          className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
        />
      </section>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !content.trim()}
        className="w-full rounded-lg bg-plum text-gold-light font-medium py-3 shadow-md transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "つくっています..." : "3案つくる"}
      </button>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {drafts.length > 0 && (
        <section className="mt-8 space-y-4">
          <h2 className="font-mincho text-lg text-plum-deep">生成された下書き</h2>
          {drafts.map((draft, i) => (
            <div
              key={i}
              className="rounded-lg border border-gold/30 bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-plum-deep whitespace-pre-wrap leading-relaxed">
                {draft}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(draft, i)}
                className="mt-3 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-medium text-plum hover:bg-gold/10 transition-colors"
              >
                {copiedIndex === i ? "コピーしました" : "コピー"}
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
