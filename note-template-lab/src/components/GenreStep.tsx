"use client";

import type { GenreCut } from "@/lib/types";
import PillButton from "./PillButton";

interface Props {
  genre: string;
  onGenreChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  cuts: GenreCut[] | null;
  onSelectCut: (cut: GenreCut) => void;
}

export default function GenreStep({
  genre,
  onGenreChange,
  onSubmit,
  loading,
  error,
  cuts,
  onSelectCut,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-sumi/10 bg-white/70 p-5 shadow-washi sm:p-6">
        <h2 className="font-mincho text-lg font-bold text-sumi sm:text-xl">
          どんなジャンルの記事を書きたいですか？
        </h2>
        <p className="mt-1 text-sm text-sumi/60">
          例:「AIを使った副業」「ハンドメイド販売のコツ」「50代からのSNS発信」など
        </p>
        <textarea
          value={genre}
          onChange={(e) => onGenreChange(e.target.value)}
          rows={3}
          placeholder="ジャンルを入力してください"
          className="mt-4 w-full resize-none rounded-xl border border-sumi/15 bg-washi px-4 py-3 text-[16px] text-sumi placeholder:text-sumi/35 focus:border-indigo/60"
        />
        {error && <p className="mt-3 text-sm text-shu">{error}</p>}
        <div className="mt-5">
          <PillButton onClick={onSubmit} loading={loading} disabled={!genre.trim()}>
            切り口を出してもらう
          </PillButton>
        </div>
      </div>

      {cuts && cuts.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-sm font-bold text-sumi/70">
            気になる切り口をタップしてください
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cuts.map((cut, i) => (
              <button
                key={i}
                onClick={() => onSelectCut(cut)}
                className="tap-target flex flex-col items-start gap-1 rounded-2xl border border-sumi/10 bg-white/80 p-4 text-left shadow-washi transition active:scale-[0.98] hover:border-indigo/40"
              >
                <span className="font-mincho text-[15px] font-bold text-indigo">
                  {cut.label}
                </span>
                <span className="text-[13px] leading-relaxed text-sumi/65">
                  {cut.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
