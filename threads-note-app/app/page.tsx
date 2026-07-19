"use client";

import { useEffect, useState } from "react";
import { PATTERNS } from "@/lib/patterns";
import { CTA_OPTIONS } from "@/lib/cta";
import { TONE_OPTIONS } from "@/lib/tone";

const PROFILE_STORAGE_KEY = "threads-note-app:profile";
const CTA_OPTION_STORAGE_KEY = "threads-note-app:ctaOption";
const CUSTOM_CTA_STORAGE_KEY = "threads-note-app:customCta";
const TONE_STORAGE_KEY = "threads-note-app:tone";
const TARGET_STORAGE_KEY = "threads-note-app:target";

export default function Home() {
  const [selectedId, setSelectedId] = useState(PATTERNS[0].id);
  const [profile, setProfile] = useState("");
  const [target, setTarget] = useState("");
  const [ctaOptionId, setCtaOptionId] = useState(CTA_OPTIONS[0].id);
  const [customCta, setCustomCta] = useState("");
  const [toneId, setToneId] = useState(TONE_OPTIONS[0].id);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const selectedPattern = PATTERNS.find((p) => p.id === selectedId)!;
  const isCustomCta = ctaOptionId === "custom";
  const effectiveCta = isCustomCta
    ? customCta.trim()
    : CTA_OPTIONS.find((o) => o.id === ctaOptionId)?.text ?? "";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setProfile(localStorage.getItem(PROFILE_STORAGE_KEY) ?? "");
    setTarget(localStorage.getItem(TARGET_STORAGE_KEY) ?? "");
    setCtaOptionId(localStorage.getItem(CTA_OPTION_STORAGE_KEY) ?? CTA_OPTIONS[0].id);
    setCustomCta(localStorage.getItem(CUSTOM_CTA_STORAGE_KEY) ?? "");
    setToneId(localStorage.getItem(TONE_STORAGE_KEY) ?? TONE_OPTIONS[0].id);
  }, []);

  function handleProfileChange(value: string) {
    setProfile(value);
    localStorage.setItem(PROFILE_STORAGE_KEY, value);
  }

  function handleTargetChange(value: string) {
    setTarget(value);
    localStorage.setItem(TARGET_STORAGE_KEY, value);
  }

  function handleCtaOptionChange(id: string) {
    setCtaOptionId(id);
    localStorage.setItem(CTA_OPTION_STORAGE_KEY, id);
  }

  function handleCustomCtaChange(value: string) {
    setCustomCta(value);
    localStorage.setItem(CUSTOM_CTA_STORAGE_KEY, value);
  }

  function handleToneChange(id: string) {
    setToneId(id);
    localStorage.setItem(TONE_STORAGE_KEY, id);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setDrafts([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patternId: selectedId,
          content,
          profile,
          target,
          cta: effectiveCta,
          toneId,
        }),
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
      </header>

      <section className="mb-6">
        <h2 className="font-mincho text-lg text-plum-deep mb-3">
          文章の口調を選ぶ
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TONE_OPTIONS.map((tone) => {
            const isSelected = tone.id === toneId;
            return (
              <button
                key={tone.id}
                type="button"
                onClick={() => handleToneChange(tone.id)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border ${
                  isSelected
                    ? "bg-plum text-gold-light border-plum shadow-sm"
                    : "bg-white text-plum-deep border-plum/20 hover:border-gold/60"
                }`}
              >
                {tone.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <label
          htmlFor="profile"
          className="font-mincho text-lg text-plum-deep mb-3 block"
        >
          あなたのプロフィール
        </label>
        <textarea
          id="profile"
          value={profile}
          onChange={(e) => handleProfileChange(e.target.value)}
          placeholder="どんな人か、どんな経歴・立場で発信しているかを書いてください(例: 50代女性、パン屋のパート、着物リメイクをやってきて、今はAI×副業をテーマに発信中)"
          rows={3}
          className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
        />
        <p className="mt-2 text-xs text-plum-deep/60">
          この内容に基づいて、あなたらしい語り口の下書きを作ります。ブラウザに保存されるので、次回からは入力不要です。
        </p>

        <label
          htmlFor="target"
          className="font-mincho text-base text-plum-deep mt-4 mb-2 block"
        >
          ターゲット(任意)
        </label>
        <textarea
          id="target"
          value={target}
          onChange={(e) => handleTargetChange(e.target.value)}
          placeholder="誰に向けて書くかを書いてください(例: AIに興味はあるけど難しそうで手が出せていない40代女性)"
          rows={2}
          className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
        />

        <p className="font-mincho text-base text-plum-deep mt-4 mb-2">
          最後に添える一言(任意)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CTA_OPTIONS.map((option) => {
            const isSelected = option.id === ctaOptionId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleCtaOptionChange(option.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors border ${
                  isSelected
                    ? "bg-plum text-gold-light border-plum shadow-sm"
                    : "bg-white text-plum-deep border-plum/20 hover:border-gold/60"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {isCustomCta && (
          <input
            type="text"
            value={customCta}
            onChange={(e) => handleCustomCtaChange(e.target.value)}
            placeholder="入れたい一言を書いてください"
            className="mt-3 w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
          />
        )}
      </section>

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
        </div>
      </section>

      <section className="mb-6">
        <label
          htmlFor="content"
          className="font-mincho text-lg text-plum-deep mb-3 block"
        >
          書きたいこと
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="書きたい内容を自由に書いてください(単語だけでもOK)"
          rows={5}
          className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
        />
      </section>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !content.trim() || !profile.trim()}
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
