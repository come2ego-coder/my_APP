"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, DEFAULT_CATEGORY_ID, getCategory } from "@/lib/categories";
import { dataUrlToBase64, resizeImage } from "@/lib/image";
import {
  type Record as KakeiboRecord,
  loadRecords,
  monthKey,
  saveRecords,
  todayStr,
} from "@/lib/records";

type Draft = {
  id: string | null;
  date: string;
  store: string;
  amount: string;
  category: string;
  memo: string;
  thumbnail: string | null;
};

function emptyDraft(): Draft {
  return {
    id: null,
    date: todayStr(),
    store: "",
    amount: "",
    category: DEFAULT_CATEGORY_ID,
    memo: "",
    thumbnail: null,
  };
}

function formatYen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Home() {
  const [records, setRecords] = useState<KakeiboRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => todayStr().slice(0, 7));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeNotice, setAnalyzeNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setRecords(loadRecords());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveRecords(records);
  }, [records, hydrated]);

  const currentMonth = todayStr().slice(0, 7);

  const monthRecords = useMemo(
    () =>
      records
        .filter((r) => monthKey(r.date) === viewMonth)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [records, viewMonth],
  );

  const monthTotal = useMemo(
    () => monthRecords.reduce((sum, r) => sum + r.amount, 0),
    [monthRecords],
  );

  const prevMonthTotal = useMemo(() => {
    const prev = shiftMonth(viewMonth, -1);
    return records.filter((r) => monthKey(r.date) === prev).reduce((sum, r) => sum + r.amount, 0);
  }, [records, viewMonth]);

  const categoryBreakdown = useMemo(() => {
    const sums = new Map<string, number>();
    for (const r of monthRecords) {
      sums.set(r.category, (sums.get(r.category) ?? 0) + r.amount);
    }
    const max = Math.max(1, ...sums.values());
    return CATEGORIES.map((c) => ({ category: c, amount: sums.get(c.id) ?? 0 }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((x) => ({ ...x, pct: Math.round((x.amount / Math.max(1, monthTotal)) * 100), barPct: (x.amount / max) * 100 }));
  }, [monthRecords, monthTotal]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: KakeiboRecord[] }[] = [];
    for (const r of monthRecords) {
      const g = groups[groups.length - 1];
      if (g && g.date === r.date) g.items.push(r);
      else groups.push({ date: r.date, items: [r] });
    }
    return groups;
  }, [monthRecords]);

  function openManualEntry() {
    setAnalyzeNotice(null);
    setDraft(emptyDraft());
  }

  function openEdit(record: KakeiboRecord) {
    setAnalyzeNotice(null);
    setDraft({
      id: record.id,
      date: record.date,
      store: record.store,
      amount: String(record.amount),
      category: record.category,
      memo: record.memo,
      thumbnail: record.thumbnail,
    });
  }

  function handlePhotoClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAnalyzeNotice(null);
    try {
      const [analysisImage, thumbnail] = await Promise.all([
        resizeImage(file, 1024, 0.7),
        resizeImage(file, 160, 0.5),
      ]);

      setDraft({ ...emptyDraft(), thumbnail });
      setAnalyzing(true);

      const { mimeType, data } = dataUrlToBase64(analysisImage);
      const res = await fetch("/api/analyze-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mimeType }),
      });
      const result = await res.json();

      if (!res.ok) {
        setAnalyzeNotice(result.error || "読み取りに失敗しました。手入力で保存できます。");
        return;
      }

      setDraft((cur) =>
        cur
          ? {
              ...cur,
              store: result.store || "",
              date: result.date || cur.date,
              amount: result.amount != null ? String(result.amount) : "",
              category: result.category || DEFAULT_CATEGORY_ID,
              memo: result.memo || "",
            }
          : cur,
      );

      if (result.amount == null) {
        setAnalyzeNotice("金額を読み取れませんでした。手入力してください。");
      }
    } catch {
      setAnalyzeNotice("画像の処理に失敗しました。手入力で保存できます。");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSave() {
    if (!draft) return;
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) return;

    if (draft.id) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === draft.id
            ? {
                ...r,
                date: draft.date,
                store: draft.store.trim(),
                amount,
                category: draft.category,
                memo: draft.memo.trim(),
              }
            : r,
        ),
      );
    } else {
      const newRecord: KakeiboRecord = {
        id: crypto.randomUUID(),
        date: draft.date,
        store: draft.store.trim(),
        amount,
        category: draft.category,
        memo: draft.memo.trim(),
        thumbnail: draft.thumbnail,
        createdAt: Date.now(),
      };
      setRecords((prev) => [...prev, newRecord]);
      setViewMonth(monthKey(draft.date));
    }
    setDraft(null);
  }

  function handleDelete() {
    if (!draft?.id) return;
    setRecords((prev) => prev.filter((r) => r.id !== draft.id));
    setDraft(null);
  }

  const diff = monthTotal - prevMonthTotal;

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pb-28 pt-6 sm:pt-10">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold text-accent-deep tracking-wide">📷 パシャ家計簿</h1>
        <p className="mt-1 text-sm text-muted">レシートを撮るだけ。入力はほぼなし。</p>
      </header>

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
          className="w-9 h-9 rounded-full bg-white shadow-sm text-lg text-muted hover:text-accent-deep"
          aria-label="前の月"
        >
          ‹
        </button>
        <span className="text-lg font-semibold min-w-[8rem] text-center">
          {formatMonthLabel(viewMonth)}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
          disabled={viewMonth >= currentMonth}
          className="w-9 h-9 rounded-full bg-white shadow-sm text-lg text-muted hover:text-accent-deep disabled:opacity-30 disabled:hover:text-muted"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      <section className="bg-card rounded-2xl shadow-sm p-5 mb-4 text-center">
        <p className="text-sm text-muted">今月の合計</p>
        <p className="text-4xl font-bold text-accent-deep mt-1">{formatYen(monthTotal)}</p>
        {prevMonthTotal > 0 && (
          <p className="text-xs text-muted mt-1">
            先月比 {diff >= 0 ? "+" : ""}
            {formatYen(diff)}
          </p>
        )}
      </section>

      {categoryBreakdown.length > 0 && (
        <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-muted mb-3">カテゴリ別</p>
          <div className="flex flex-col gap-2.5">
            {categoryBreakdown.map(({ category, amount, pct, barPct }) => (
              <div key={category.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-center">{category.emoji}</span>
                <span className="w-20 shrink-0 truncate">{category.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-black/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct}%`, backgroundColor: category.color }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right tabular-nums text-muted">
                  {formatYen(amount)}
                </span>
                <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        {groupedByDate.length === 0 && hydrated && (
          <div className="text-center py-16 text-muted">
            <p className="text-4xl mb-3">🧾</p>
            <p className="text-sm">まだ記録がありません。</p>
            <p className="text-sm">右下のボタンでレシートを撮ってみましょう!</p>
          </div>
        )}
        {groupedByDate.map((group) => (
          <div key={group.date}>
            <p className="text-xs text-muted mb-1.5 px-1">
              {group.date.slice(5).replace("-", "/")}
            </p>
            <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden">
              {group.items.map((r) => {
                const cat = getCategory(r.category);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openEdit(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
                  >
                    {r.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.thumbnail}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center text-lg shrink-0">
                        {cat.emoji}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {r.store || cat.label}
                      </span>
                      <span className="block text-xs text-muted truncate">
                        {cat.emoji} {cat.label}
                        {r.memo ? ` ・ ${r.memo}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatYen(r.amount)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="fixed bottom-6 right-1/2 translate-x-1/2 max-w-lg w-full px-4 flex justify-end pointer-events-none">
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={openManualEntry}
            className="bg-white text-xs text-muted px-3 py-1.5 rounded-full shadow-sm"
          >
            ✏️ 手入力で追加
          </button>
          <button
            type="button"
            onClick={handlePhotoClick}
            className="w-16 h-16 rounded-full bg-accent text-white text-2xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            aria-label="レシートを撮る"
          >
            📷
          </button>
        </div>
      </div>

      {draft && (
        <EntryModal
          draft={draft}
          analyzing={analyzing}
          analyzeNotice={analyzeNotice}
          onChange={setDraft}
          onSave={handleSave}
          onDelete={draft.id ? handleDelete : undefined}
          onClose={() => setDraft(null)}
        />
      )}
    </main>
  );
}

function EntryModal({
  draft,
  analyzing,
  analyzeNotice,
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  draft: Draft;
  analyzing: boolean;
  analyzeNotice: string | null;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const amountValid = draft.amount !== "" && Number.isFinite(Number(draft.amount)) && Number(draft.amount) >= 0;

  return (
    <div className="fixed inset-0 z-10 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{draft.id ? "記録を編集" : "新しい記録"}</h2>
          <button type="button" onClick={onClose} className="text-muted text-2xl leading-none px-2">
            ×
          </button>
        </div>

        {draft.thumbnail && (
          <div className="flex justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.thumbnail} alt="" className="h-24 rounded-xl object-cover shadow-sm" />
          </div>
        )}

        {analyzing && (
          <p className="text-center text-sm text-muted mb-3">🔍 レシートを読み取り中...</p>
        )}
        {analyzeNotice && !analyzing && (
          <p className="text-center text-xs text-accent-deep bg-accent/10 rounded-lg py-2 px-3 mb-3">
            {analyzeNotice}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">金額</label>
            <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-2.5 shadow-sm">
              <span className="text-lg text-muted">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={draft.amount}
                onChange={(e) => onChange({ ...draft, amount: e.target.value })}
                placeholder="0"
                className="flex-1 text-2xl font-bold outline-none min-w-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">カテゴリ</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ ...draft, category: c.id })}
                  className={`rounded-xl px-2 py-2 text-xs flex flex-col items-center gap-0.5 border transition-colors ${
                    draft.category === c.id
                      ? "border-accent bg-accent/10 text-accent-deep"
                      : "border-transparent bg-white text-foreground/80"
                  }`}
                >
                  <span className="text-lg">{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">日付</label>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => onChange({ ...draft, date: e.target.value })}
                className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">店名</label>
              <input
                type="text"
                value={draft.store}
                onChange={(e) => onChange({ ...draft, store: e.target.value })}
                placeholder="任意"
                className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">メモ</label>
            <input
              type="text"
              value={draft.memo}
              onChange={(e) => onChange({ ...draft, memo: e.target.value })}
              placeholder="任意"
              className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-3 rounded-xl bg-white text-red-500 text-sm font-medium shadow-sm"
            >
              削除
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!amountValid}
            className="flex-1 py-3 rounded-xl bg-accent text-white font-bold shadow-sm disabled:opacity-40"
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}
