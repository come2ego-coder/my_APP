"use client";

import { useEffect, useState } from "react";
import type { ArticleHistoryDetail, ArticleHistoryItem } from "@/lib/types";
import ArticleBody from "./ArticleBody";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HistoryPanel({ open, onClose }: Props) {
  const [items, setItems] = useState<ArticleHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArticleHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDetail(null);
    setError(null);
    setLoading(true);
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setItems(data.items);
      })
      .catch((e) => setError(e.message ?? "履歴の取得に失敗しました。"))
      .finally(() => setLoading(false));
  }, [open]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/history/${id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDetail(data.article);
    } catch (e) {
      setError(e instanceof Error ? e.message : "記事の取得に失敗しました。");
    } finally {
      setDetailLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="閉じる"
        className="absolute inset-0 bg-sumi/40"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-washi shadow-2xl sm:rounded-l-3xl">
        <div className="flex items-center justify-between border-b border-sumi/10 px-5 py-4">
          {detail ? (
            <button
              onClick={() => setDetail(null)}
              className="tap-target text-sm font-bold text-indigo"
            >
              ← 一覧に戻る
            </button>
          ) : (
            <h2 className="font-mincho text-lg font-bold text-sumi">過去の記事</h2>
          )}
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-xl text-sumi/50 hover:bg-sumi/5"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && (
            <p className="mb-4 rounded-xl bg-shu/10 px-4 py-3 text-sm text-shu">
              {error}
            </p>
          )}

          {!detail && loading && (
            <p className="text-sm text-sumi/50">読み込み中…</p>
          )}

          {!detail && !loading && items && items.length === 0 && (
            <p className="text-sm text-sumi/50">
              まだ記事が保存されていません。記事を生成すると、ここに履歴が表示されます。
            </p>
          )}

          {!detail && !loading && items && items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openDetail(item.id)}
                  className="tap-target flex flex-col items-start gap-1 rounded-2xl border border-sumi/10 bg-white/80 p-4 text-left shadow-washi active:scale-[0.98]"
                >
                  <span className="text-[11px] font-bold text-wakatake">
                    {item.genre} ・ {item.cutLabel}
                  </span>
                  <span className="font-mincho text-[15px] font-bold text-sumi">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-sumi/40">
                    {formatDate(item.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {detailLoading && <p className="text-sm text-sumi/50">読み込み中…</p>}

          {detail && !detailLoading && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[11px] font-bold text-wakatake">
                  {detail.genre} ・ {detail.cutLabel}
                </p>
                <h3 className="mt-1 font-mincho text-lg font-bold text-sumi">
                  {detail.title}
                </h3>
                <p className="mt-1 text-[11px] text-sumi/40">
                  {formatDate(detail.createdAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-sumi/10 bg-white/80 p-4 shadow-washi">
                <ArticleBody body={detail.body} />
              </div>
              <div className="rounded-2xl border border-kocha/30 bg-kocha/10 p-4">
                <p className="text-[12px] font-bold text-kocha">
                  ワンポイントアドバイス
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-sumi/80">
                  {detail.advice}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
