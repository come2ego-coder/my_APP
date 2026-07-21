"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CATEGORY_ID,
  ENTRY_KINDS,
  categoriesForKind,
  defaultCategoryForKind,
  getCategoryForKind,
  partnerLabel,
  type EntryKind,
} from "@/lib/categories";
import {
  annualSummaryToCsv,
  computeAnnualSummary,
  downloadCsv,
  recordsToCsv,
  type AnnualSummary,
} from "@/lib/csv";
import { evaluateExpression, pressKey } from "@/lib/calculator";
import { dataUrlToBase64, resizeImage } from "@/lib/image";
import {
  type Record as KeihiRecord,
  loadRecords,
  monthKey,
  saveRecords,
  todayStr,
} from "@/lib/records";
import { type RecurringTemplate, loadTemplates, saveTemplates } from "@/lib/templates";

type Draft = {
  id: string | null;
  date: string;
  partner: string;
  amount: string;
  category: string | null;
  memo: string;
  thumbnail: string | null;
  kind: EntryKind;
  templateId?: string;
  splits?: { category: string; amount: string }[];
};

function emptyDraft(kind: EntryKind = "expense"): Draft {
  return {
    id: null,
    date: todayStr(),
    partner: "",
    amount: "",
    category: defaultCategoryForKind(kind),
    memo: "",
    thumbnail: null,
    kind,
  };
}

type TemplateDraft = {
  id: string | null;
  name: string;
  amount: string;
  category: string | null;
  kind: EntryKind;
};

function emptyTemplateDraft(kind: EntryKind = "expense"): TemplateDraft {
  return { id: null, name: "", amount: "", category: defaultCategoryForKind(kind), kind };
}

function formatYen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function formatSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${formatYen(n)}`;
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
  const [records, setRecords] = useState<KeihiRecord[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => todayStr().slice(0, 7));
  const [viewYear, setViewYear] = useState(() => todayStr().slice(0, 4));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeNotice, setAnalyzeNotice] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showAnnualReport, setShowAnnualReport] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(emptyTemplateDraft());
  const [quickRevenueDate, setQuickRevenueDate] = useState(() => todayStr());
  const [quickRevenueAmount, setQuickRevenueAmount] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcExpr, setCalcExpr] = useState("");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setRecords(loadRecords());
    setTemplates(loadTemplates());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveRecords(records);
  }, [records, hydrated]);

  useEffect(() => {
    if (hydrated) saveTemplates(templates);
  }, [templates, hydrated]);

  const currentMonth = todayStr().slice(0, 7);
  const currentYear = todayStr().slice(0, 4);

  const monthRecords = useMemo(
    () =>
      records
        .filter((r) => monthKey(r.date) === viewMonth)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [records, viewMonth],
  );

  function totalsFor(list: KeihiRecord[]) {
    const revenue = list.filter((r) => r.kind === "revenue").reduce((sum, r) => sum + r.amount, 0);
    const purchase = list.filter((r) => r.kind === "purchase").reduce((sum, r) => sum + r.amount, 0);
    const expense = list.filter((r) => r.kind === "expense").reduce((sum, r) => sum + r.amount, 0);
    return { revenue, purchase, expense, profit: revenue - purchase - expense };
  }

  const monthTotals = useMemo(() => totalsFor(monthRecords), [monthRecords]);
  const allTimeTotals = useMemo(() => totalsFor(records), [records]);

  const prevMonthStats = useMemo(() => {
    const prev = shiftMonth(viewMonth, -1);
    const prevRecords = records.filter((r) => monthKey(r.date) === prev);
    return { hasData: prevRecords.length > 0, profit: totalsFor(prevRecords).profit };
  }, [records, viewMonth]);

  function breakdownFor(list: KeihiRecord[], kind: EntryKind, total: number) {
    const cats = categoriesForKind(kind);
    const sums = new Map<string, number>();
    for (const r of list) {
      if (r.kind !== kind) continue;
      const key = r.category ?? cats[cats.length - 1].id;
      sums.set(key, (sums.get(key) ?? 0) + r.amount);
    }
    const max = Math.max(1, ...sums.values());
    return cats
      .map((c) => ({ category: c, amount: sums.get(c.id) ?? 0 }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((x) => ({
        ...x,
        pct: Math.round((x.amount / Math.max(1, total)) * 100),
        barPct: (x.amount / max) * 100,
      }));
  }

  const categoryBreakdown = useMemo(
    () => breakdownFor(monthRecords, "expense", monthTotals.expense),
    [monthRecords, monthTotals],
  );
  const purchaseBreakdown = useMemo(
    () => breakdownFor(monthRecords, "purchase", monthTotals.purchase),
    [monthRecords, monthTotals],
  );

  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: KeihiRecord[] }[] = [];
    for (const r of monthRecords) {
      const g = groups[groups.length - 1];
      if (g && g.date === r.date) g.items.push(r);
      else groups.push({ date: r.date, items: [r] });
    }
    return groups;
  }, [monthRecords]);

  const annualSummary: AnnualSummary = useMemo(
    () => computeAnnualSummary(records, viewYear),
    [records, viewYear],
  );

  function openManualEntry() {
    setAnalyzeNotice(null);
    setDraft(emptyDraft("expense"));
  }

  function openEdit(record: KeihiRecord) {
    setAnalyzeNotice(null);
    setDraft({
      id: record.id,
      date: record.date,
      partner: record.partner,
      amount: String(record.amount),
      category: record.category ?? defaultCategoryForKind(record.kind),
      memo: record.memo,
      thumbnail: record.thumbnail,
      kind: record.kind,
      templateId: record.templateId,
    });
  }

  function openFromTemplate(template: RecurringTemplate) {
    setAnalyzeNotice(null);
    const isCurrentMonth = viewMonth === currentMonth;
    setDraft({
      id: null,
      date: isCurrentMonth ? todayStr() : `${viewMonth}-01`,
      partner: template.name,
      amount: String(template.amount),
      category: template.category ?? defaultCategoryForKind(template.kind),
      memo: "",
      thumbnail: null,
      kind: template.kind,
      templateId: template.id,
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

      setDraft({ ...emptyDraft("expense"), thumbnail });
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
              partner: result.partner || "",
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

    const splitRecords: KeihiRecord[] = (draft.splits ?? []).map((s) => ({
      id: crypto.randomUUID(),
      date: draft.date,
      partner: draft.partner.trim(),
      amount: Number(s.amount),
      category: s.category,
      memo: draft.memo.trim(),
      thumbnail: draft.thumbnail,
      createdAt: Date.now(),
      kind: draft.kind,
    }));

    if (draft.id) {
      setRecords((prev) => [
        ...prev.map((r) =>
          r.id === draft.id
            ? {
                ...r,
                date: draft.date,
                partner: draft.partner.trim(),
                amount,
                category: draft.kind !== "revenue" ? draft.category : null,
                memo: draft.memo.trim(),
                kind: draft.kind,
              }
            : r,
        ),
        ...splitRecords,
      ]);
    } else {
      const newRecord: KeihiRecord = {
        id: crypto.randomUUID(),
        date: draft.date,
        partner: draft.partner.trim(),
        amount,
        category: draft.kind !== "revenue" ? draft.category : null,
        memo: draft.memo.trim(),
        thumbnail: draft.thumbnail,
        createdAt: Date.now(),
        kind: draft.kind,
        templateId: draft.templateId,
      };
      setRecords((prev) => [...prev, newRecord, ...splitRecords]);
      setViewMonth(monthKey(draft.date));
    }
    setDraft(null);
  }

  function handleDelete() {
    if (!draft?.id) return;
    setRecords((prev) => prev.filter((r) => r.id !== draft.id));
    setDraft(null);
  }

  function handleExportMonthCsv() {
    const sorted = [...monthRecords].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt,
    );
    downloadCsv(`取引明細_${viewMonth}.csv`, recordsToCsv(sorted));
  }

  function handleExportAnnualSummaryCsv() {
    downloadCsv(`確定申告用_${viewYear}.csv`, annualSummaryToCsv(annualSummary));
  }

  function handleExportAnnualTransactionsCsv() {
    const yearRecords = records
      .filter((r) => r.date.slice(0, 4) === viewYear)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
    downloadCsv(`取引明細_${viewYear}年.csv`, recordsToCsv(yearRecords));
  }

  function openTemplateManager() {
    setTemplateDraft(emptyTemplateDraft());
    setShowTemplateManager(true);
  }

  function selectTemplateForEdit(t: RecurringTemplate) {
    setTemplateDraft({
      id: t.id,
      name: t.name,
      amount: String(t.amount),
      category: t.category ?? defaultCategoryForKind(t.kind),
      kind: t.kind,
    });
  }

  function saveTemplateDraft() {
    const amount = Number(templateDraft.amount);
    if (!templateDraft.name.trim() || !Number.isFinite(amount) || amount <= 0) return;
    if (templateDraft.id) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateDraft.id
            ? {
                ...t,
                name: templateDraft.name.trim(),
                amount,
                category: templateDraft.kind !== "revenue" ? templateDraft.category : null,
                kind: templateDraft.kind,
              }
            : t,
        ),
      );
    } else {
      setTemplates((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: templateDraft.name.trim(),
          amount,
          category: templateDraft.kind !== "revenue" ? templateDraft.category : null,
          kind: templateDraft.kind,
        },
      ]);
    }
    setTemplateDraft(emptyTemplateDraft());
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (templateDraft.id === id) setTemplateDraft(emptyTemplateDraft());
  }

  const quickRevenueValid =
    quickRevenueAmount !== "" &&
    Number.isFinite(Number(quickRevenueAmount)) &&
    Number(quickRevenueAmount) > 0;

  function handleQuickAddRevenue() {
    if (!quickRevenueValid) return;
    const newRecord: KeihiRecord = {
      id: crypto.randomUUID(),
      date: quickRevenueDate,
      partner: "",
      amount: Number(quickRevenueAmount),
      category: null,
      memo: "",
      thumbnail: null,
      createdAt: Date.now(),
      kind: "revenue",
    };
    setRecords((prev) => [...prev, newRecord]);
    setViewMonth(monthKey(quickRevenueDate));
    setQuickRevenueAmount("");
  }

  function applyCalculator() {
    const result = evaluateExpression(calcExpr);
    if (result != null && result >= 0) {
      setQuickRevenueAmount(String(Math.round(result * 100) / 100));
    }
    setShowCalculator(false);
  }

  const diff = monthTotals.profit - prevMonthStats.profit;

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pb-28 pt-6 sm:pt-10">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold text-accent-deep tracking-wide">💼 パシャ経費</h1>
        <p className="mt-1 text-sm text-muted">売上・仕入・経費を記録して、確定申告もこのまま。</p>
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

      <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
        <p className="text-sm font-semibold text-muted mb-3">💰 売上をすぐ記録</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-muted mb-1">日付</label>
            <input
              type="date"
              value={quickRevenueDate}
              onChange={(e) => setQuickRevenueDate(e.target.value)}
              className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">金額</label>
            <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-2.5 shadow-sm">
              <span className="text-muted">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={quickRevenueAmount}
                onChange={(e) => setQuickRevenueAmount(e.target.value)}
                placeholder="0"
                className="flex-1 font-bold outline-none min-w-0"
              />
              <button
                type="button"
                onClick={() => {
                  setCalcExpr(quickRevenueAmount);
                  setShowCalculator(true);
                }}
                aria-label="電卓を開く"
                className="text-lg leading-none px-1 shrink-0"
              >
                🧮
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleQuickAddRevenue}
          disabled={!quickRevenueValid}
          className="w-full py-2.5 rounded-xl bg-income text-white font-bold shadow-sm disabled:opacity-40"
        >
          この売上を記録する
        </button>
      </section>

      <section className="bg-card rounded-2xl shadow-sm p-5 mb-4 text-center">
        <p className="text-xs text-muted">📅 月次決算</p>
        <p className="text-sm text-muted">今月の利益(差引金額)</p>
        <p
          className={`text-4xl font-bold mt-1 ${monthTotals.profit >= 0 ? "text-income" : "text-loss"}`}
        >
          {formatSigned(monthTotals.profit)}
        </p>
        {prevMonthStats.hasData && (
          <p className="text-xs text-muted mt-1">
            先月比 {formatSigned(diff)}
          </p>
        )}
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-black/5">
          <div>
            <p className="text-xs text-muted">売上</p>
            <p className="text-lg font-semibold text-income tabular-nums">{formatYen(monthTotals.revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">仕入</p>
            <p className="text-lg font-semibold tabular-nums">{formatYen(monthTotals.purchase)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">経費</p>
            <p className="text-lg font-semibold tabular-nums">{formatYen(monthTotals.expense)}</p>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-4">
          <button
            type="button"
            onClick={handleExportMonthCsv}
            disabled={monthRecords.length === 0}
            className="text-xs text-accent-deep underline disabled:opacity-30 disabled:no-underline"
          >
            📤 この月をCSVで書き出す
          </button>
          <button
            type="button"
            onClick={() => setShowAnnualReport(true)}
            className="text-xs text-accent-deep underline"
          >
            🧾 確定申告用の年間集計
          </button>
        </div>
      </section>

      <section className="bg-card rounded-2xl shadow-sm p-5 mb-4 text-center">
        <p className="text-xs text-muted">📊 通算決算(全期間)</p>
        <p className="text-sm text-muted">全期間の利益(差引金額)</p>
        <p
          className={`text-4xl font-bold mt-1 ${allTimeTotals.profit >= 0 ? "text-income" : "text-loss"}`}
        >
          {formatSigned(allTimeTotals.profit)}
        </p>
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-black/5">
          <div>
            <p className="text-xs text-muted">売上</p>
            <p className="text-lg font-semibold text-income tabular-nums">{formatYen(allTimeTotals.revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">仕入</p>
            <p className="text-lg font-semibold tabular-nums">{formatYen(allTimeTotals.purchase)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">経費</p>
            <p className="text-lg font-semibold tabular-nums">{formatYen(allTimeTotals.expense)}</p>
          </div>
        </div>
      </section>

      {categoryBreakdown.length > 0 && (
        <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-muted mb-3">経費の科目別内訳</p>
          <div className="flex flex-col gap-2.5">
            {categoryBreakdown.map(({ category, amount, pct, barPct }) => (
              <div key={category.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-center">{category.emoji}</span>
                <span className="w-24 shrink-0 truncate">{category.label}</span>
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

      {purchaseBreakdown.length > 0 && (
        <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-muted mb-3">仕入の科目別内訳</p>
          <div className="flex flex-col gap-2.5">
            {purchaseBreakdown.map(({ category, amount, pct, barPct }) => (
              <div key={category.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-center">{category.emoji}</span>
                <span className="w-24 shrink-0 truncate">{category.label}</span>
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

      <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-muted">よく使う項目</p>
          <button type="button" onClick={openTemplateManager} className="text-xs text-accent-deep underline">
            管理
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-xs text-muted">
            定期券や毎月の通信費、定額の売上など、よく使う項目を登録しておくと毎月ワンタップで記録できます。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {templates.map((t) => {
              const kindMeta = ENTRY_KINDS.find((k) => k.id === t.kind)!;
              const cat = getCategoryForKind(t.kind, t.category);
              const addedRecord = monthRecords.find((r) => r.templateId === t.id);
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-center">{cat?.emoji ?? kindMeta.emoji}</span>
                  <span className="flex-1 min-w-0 truncate">{t.name}</span>
                  <span
                    className={`shrink-0 tabular-nums ${t.kind === "revenue" ? "text-income" : "text-muted"}`}
                  >
                    {formatYen(t.amount)}
                  </span>
                  {addedRecord ? (
                    <button
                      type="button"
                      onClick={() => openEdit(addedRecord)}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-income/10 text-income font-medium"
                    >
                      ✓ 記録済み
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openFromTemplate(t)}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-deep font-medium"
                    >
                      追加する
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {groupedByDate.length === 0 && hydrated && (
          <div className="text-center py-16 text-muted">
            <p className="text-4xl mb-3">🧾</p>
            <p className="text-sm">まだ記録がありません。</p>
            <p className="text-sm">
              右下のボタンで領収書を撮る(交通系ICカードの履歴画面でもOK)!
            </p>
          </div>
        )}
        {groupedByDate.length > 0 && (
          <p className="text-xs text-muted text-center -mb-1">
            📝 記録をタップすると、修正や削除ができます
          </p>
        )}
        {groupedByDate.map((group) => {
          const dayTotals = totalsFor(group.items);
          const isExpanded = expandedDay === group.date;
          return (
          <div key={group.date}>
            <button
              type="button"
              onClick={() => setExpandedDay(isExpanded ? null : group.date)}
              className="flex items-center gap-1 text-xs text-muted mb-1.5 px-1"
            >
              <span>{group.date.slice(5).replace("-", "/")}</span>
              <span className="text-[10px]">{isExpanded ? "▲" : "▼"}</span>
            </button>
            {isExpanded && (
              <div className="bg-card rounded-2xl shadow-sm p-4 mb-1.5 flex justify-center gap-6 text-center">
                <div>
                  <p className="text-xs text-muted">売上</p>
                  <p className="text-sm font-semibold text-income tabular-nums">{formatYen(dayTotals.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">仕入</p>
                  <p className="text-sm font-semibold tabular-nums">{formatYen(dayTotals.purchase)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">経費</p>
                  <p className="text-sm font-semibold tabular-nums">{formatYen(dayTotals.expense)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">利益</p>
                  <p
                    className={`text-sm font-semibold tabular-nums ${dayTotals.profit >= 0 ? "text-income" : "text-loss"}`}
                  >
                    {formatSigned(dayTotals.profit)}
                  </p>
                </div>
              </div>
            )}
            <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden">
              {group.items.map((r) => {
                const kindMeta = ENTRY_KINDS.find((k) => k.id === r.kind)!;
                const cat = getCategoryForKind(r.kind, r.category);
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
                        {cat?.emoji ?? kindMeta.emoji}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {r.partner || cat?.label || kindMeta.label}
                      </span>
                      <span className="block text-xs text-muted truncate">
                        {cat ? `${cat.emoji} ${cat.label}` : `${kindMeta.emoji} ${kindMeta.label}`}
                        {r.memo ? ` ・ ${r.memo}` : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${r.kind === "revenue" ? "text-income" : ""}`}
                    >
                      {r.kind === "revenue" ? "+" : ""}
                      {formatYen(r.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          );
        })}
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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
            aria-label="領収書を撮る・写真を選ぶ"
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

      {showTemplateManager && (
        <TemplateManagerModal
          templates={templates}
          draft={templateDraft}
          onChangeDraft={setTemplateDraft}
          onSave={saveTemplateDraft}
          onSelect={selectTemplateForEdit}
          onDelete={deleteTemplate}
          onNew={(kind) => setTemplateDraft(emptyTemplateDraft(kind))}
          onClose={() => setShowTemplateManager(false)}
        />
      )}

      {showAnnualReport && (
        <AnnualReportModal
          year={viewYear}
          summary={annualSummary}
          canGoNext={viewYear < currentYear}
          onShiftYear={(delta) => setViewYear((y) => String(Number(y) + delta))}
          onExportSummary={handleExportAnnualSummaryCsv}
          onExportTransactions={handleExportAnnualTransactionsCsv}
          onClose={() => setShowAnnualReport(false)}
        />
      )}

      {showCalculator && (
        <CalculatorModal
          expr={calcExpr}
          onChange={setCalcExpr}
          onApply={applyCalculator}
          onClose={() => setShowCalculator(false)}
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
  const splits = draft.splits ?? [];
  const categoryOptions = categoriesForKind(draft.kind);

  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitCategory, setSplitCategory] = useState("");
  const effectiveSplitCategory = categoryOptions.some((c) => c.id === splitCategory)
    ? splitCategory
    : (categoryOptions.find((c) => c.id !== draft.category)?.id ?? categoryOptions[0]?.id ?? "");

  function switchKind(kind: EntryKind) {
    if (kind === draft.kind) return;
    onChange({ ...draft, kind, category: defaultCategoryForKind(kind), splits: [] });
    setShowSplitForm(false);
  }

  function confirmSplit() {
    const splitAmt = Number(splitAmount);
    const current = Number(draft.amount) || 0;
    if (!Number.isFinite(splitAmt) || splitAmt <= 0 || splitAmt >= current) return;
    onChange({
      ...draft,
      amount: String(current - splitAmt),
      splits: [...splits, { category: effectiveSplitCategory, amount: splitAmount }],
    });
    setSplitAmount("");
    setShowSplitForm(false);
  }

  function removeSplit(index: number) {
    const removed = splits[index];
    if (!removed) return;
    const restored = (Number(draft.amount) || 0) + Number(removed.amount);
    onChange({ ...draft, amount: String(restored), splits: splits.filter((_, i) => i !== index) });
  }

  return (
    <div className="fixed inset-0 z-10 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{draft.id ? "記録を編集" : "新しい記録"}</h2>
          <button type="button" onClick={onClose} className="text-muted text-2xl leading-none px-2">
            ×
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {ENTRY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => switchKind(k.id)}
              className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                draft.kind === k.id
                  ? k.id === "revenue"
                    ? "border-income bg-income/10 text-income"
                    : "border-accent bg-accent/10 text-accent-deep"
                  : "border-transparent bg-white text-foreground/70"
              }`}
            >
              {k.emoji} {k.label}
            </button>
          ))}
        </div>

        {draft.thumbnail && (
          <div className="flex justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.thumbnail} alt="" className="h-24 rounded-xl object-cover shadow-sm" />
          </div>
        )}

        {analyzing && (
          <p className="text-center text-sm text-muted mb-3">🔍 領収書を読み取り中...</p>
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

          {draft.kind !== "revenue" && (
            <div>
              <label className="block text-xs text-muted mb-1">科目</label>
              <div className="grid grid-cols-3 gap-2">
                {categoryOptions.map((c) => (
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
          )}

          {draft.kind !== "revenue" && splits.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {splits.map((s, i) => {
                const cat = getCategoryForKind(draft.kind, s.category);
                if (!cat) return null;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2 shadow-sm"
                  >
                    <span>{cat.emoji}</span>
                    <span className="flex-1">{cat.label}</span>
                    <span className="tabular-nums">{formatYen(Number(s.amount))}</span>
                    <button
                      type="button"
                      onClick={() => removeSplit(i)}
                      className="text-red-500 px-1"
                      aria-label="この内訳を削除"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {draft.kind !== "revenue" &&
            (showSplitForm ? (
              <div className="bg-white rounded-xl p-3 shadow-sm flex flex-col gap-2">
                <p className="text-xs text-muted">別の科目に分ける金額</p>
                <div className="flex items-center gap-1">
                  <span className="text-muted">¥</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={splitAmount}
                    onChange={(e) => setSplitAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 text-sm font-semibold outline-none min-w-0"
                  />
                </div>
                <select
                  value={effectiveSplitCategory}
                  onChange={(e) => setSplitCategory(e.target.value)}
                  className="text-sm rounded-lg border border-black/10 px-2 py-1.5 bg-white"
                >
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSplitForm(false)}
                    className="flex-1 py-2 text-xs rounded-lg bg-black/5"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={confirmSplit}
                    className="flex-1 py-2 text-xs rounded-lg bg-accent-deep text-white font-semibold"
                  >
                    分ける
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSplitForm(true)}
                className="text-xs text-accent-deep underline self-start"
              >
                ✂️ 別の科目に分ける
              </button>
            ))}

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
              <label className="block text-xs text-muted mb-1">{partnerLabel(draft.kind)}</label>
              <input
                type="text"
                value={draft.partner}
                onChange={(e) => onChange({ ...draft, partner: e.target.value })}
                placeholder="任意"
                className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">メモ(摘要)</label>
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

function TemplateManagerModal({
  templates,
  draft,
  onChangeDraft,
  onSave,
  onSelect,
  onDelete,
  onNew,
  onClose,
}: {
  templates: RecurringTemplate[];
  draft: TemplateDraft;
  onChangeDraft: (d: TemplateDraft) => void;
  onSave: () => void;
  onSelect: (t: RecurringTemplate) => void;
  onDelete: (id: string) => void;
  onNew: (kind: EntryKind) => void;
  onClose: () => void;
}) {
  const valid = draft.name.trim() !== "" && Number.isFinite(Number(draft.amount)) && Number(draft.amount) > 0;

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">よく使う項目を管理</h2>
          <button type="button" onClick={onClose} className="text-muted text-2xl leading-none px-2">
            ×
          </button>
        </div>

        {templates.length > 0 && (
          <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden mb-4">
            {templates.map((t) => {
              const kindMeta = ENTRY_KINDS.find((k) => k.id === t.kind)!;
              const cat = getCategoryForKind(t.kind, t.category);
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <span className="w-6 text-center">{cat?.emoji ?? kindMeta.emoji}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">{t.name}</span>
                    <span className={`text-sm tabular-nums ${t.kind === "revenue" ? "text-income" : ""}`}>
                      {formatYen(t.amount)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(t.id)}
                    className="text-red-500 text-xs px-2 py-1 shrink-0"
                  >
                    削除
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3">
          {ENTRY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onNew(k.id)}
              className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                draft.kind === k.id
                  ? k.id === "revenue"
                    ? "border-income bg-income/10 text-income"
                    : "border-accent bg-accent/10 text-accent-deep"
                  : "border-transparent bg-white text-foreground/70"
              }`}
            >
              {k.emoji} {k.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">名前</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
              placeholder="例: 定期券"
              className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">金額</label>
            <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-2.5 shadow-sm">
              <span className="text-lg text-muted">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={draft.amount}
                onChange={(e) => onChangeDraft({ ...draft, amount: e.target.value })}
                placeholder="0"
                className="flex-1 text-lg font-bold outline-none min-w-0"
              />
            </div>
          </div>
          {draft.kind !== "revenue" && (
            <div>
              <label className="block text-xs text-muted mb-1">科目</label>
              <div className="grid grid-cols-3 gap-2">
                {categoriesForKind(draft.kind).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChangeDraft({ ...draft, category: c.id })}
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
          )}
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={!valid}
          className="w-full mt-5 py-3 rounded-xl bg-accent text-white font-bold shadow-sm disabled:opacity-40"
        >
          {draft.id ? "更新する" : "追加する"}
        </button>
      </div>
    </div>
  );
}

function AnnualReportModal({
  year,
  summary,
  canGoNext,
  onShiftYear,
  onExportSummary,
  onExportTransactions,
  onClose,
}: {
  year: string;
  summary: AnnualSummary;
  canGoNext: boolean;
  onShiftYear: (delta: number) => void;
  onExportSummary: () => void;
  onExportTransactions: () => void;
  onClose: () => void;
}) {
  const nonZeroCategories = summary.expenseByCategory.filter((c) => c.amount > 0);
  const nonZeroPurchaseCategories = summary.purchaseByCategory.filter((c) => c.amount > 0);

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">確定申告用 年間集計</h2>
          <button type="button" onClick={onClose} className="text-muted text-2xl leading-none px-2">
            ×
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            type="button"
            onClick={() => onShiftYear(-1)}
            className="w-9 h-9 rounded-full bg-white shadow-sm text-lg text-muted hover:text-accent-deep"
            aria-label="前の年"
          >
            ‹
          </button>
          <span className="text-lg font-semibold min-w-[6rem] text-center">{year}年</span>
          <button
            type="button"
            onClick={() => onShiftYear(1)}
            disabled={!canGoNext}
            className="w-9 h-9 rounded-full bg-white shadow-sm text-lg text-muted hover:text-accent-deep disabled:opacity-30 disabled:hover:text-muted"
            aria-label="次の年"
          >
            ›
          </button>
        </div>

        <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>売上(収入)金額</span>
            <span className="font-semibold tabular-nums text-income">{formatYen(summary.revenueTotal)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>仕入高</span>
            <span className="font-semibold tabular-nums">{formatYen(summary.purchaseTotal)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>経費合計</span>
            <span className="font-semibold tabular-nums">{formatYen(summary.expenseTotal)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm bg-black/[0.02]">
            <span className="font-semibold">差引金額(所得金額)</span>
            <span
              className={`font-bold tabular-nums ${summary.profit >= 0 ? "text-income" : "text-loss"}`}
            >
              {formatSigned(summary.profit)}
            </span>
          </div>
        </div>

        {nonZeroPurchaseCategories.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-muted mb-2">仕入の科目別内訳</p>
            <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden">
              {nonZeroPurchaseCategories.map(({ category, amount }) => (
                <div key={category.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="w-6 text-center">{category.emoji}</span>
                  <span className="flex-1 min-w-0 truncate">{category.label}</span>
                  <span className="tabular-nums text-muted">{formatYen(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nonZeroCategories.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-muted mb-2">経費の科目別内訳</p>
            <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden">
              {nonZeroCategories.map(({ category, amount }) => (
                <div key={category.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="w-6 text-center">{category.emoji}</span>
                  <span className="flex-1 min-w-0 truncate">{category.label}</span>
                  <span className="tabular-nums text-muted">{formatYen(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onExportSummary}
            className="w-full py-3 rounded-xl bg-accent text-white font-bold shadow-sm"
          >
            📤 確定申告用の科目別CSVを書き出す
          </button>
          <button
            type="button"
            onClick={onExportTransactions}
            className="w-full py-3 rounded-xl bg-white text-accent-deep font-semibold shadow-sm"
          >
            📤 年間の取引明細CSVを書き出す
          </button>
        </div>
      </div>
    </div>
  );
}

const CALC_KEYS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  ["C", "0", ".", "+"],
] as const;

function CalculatorModal({
  expr,
  onChange,
  onApply,
  onClose,
}: {
  expr: string;
  onChange: (expr: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const preview = evaluateExpression(expr);

  function press(key: string) {
    onChange(pressKey(expr, key));
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-xs sm:rounded-3xl rounded-t-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">🧮 電卓</h2>
          <button type="button" onClick={onClose} className="text-muted text-2xl leading-none px-2">
            ×
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted min-h-[1.25rem] truncate flex-1 text-right">{expr || "0"}</p>
            <button
              type="button"
              onClick={() => press("back")}
              aria-label="1文字削除"
              className="text-muted text-lg leading-none shrink-0"
            >
              ⌫
            </button>
          </div>
          <p className="text-3xl font-bold tabular-nums truncate text-right">
            {preview != null ? formatYen(preview) : "¥0"}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {CALC_KEYS.map((row) =>
            row.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className={`py-3 rounded-xl text-lg font-semibold shadow-sm ${
                  key === "C" ? "bg-white text-red-500" : "bg-white"
                }`}
              >
                {key}
              </button>
            )),
          )}
        </div>

        <button
          type="button"
          onClick={onApply}
          disabled={preview == null}
          className="w-full py-3 rounded-xl bg-accent text-white font-bold shadow-sm disabled:opacity-40"
        >
          = この金額を入力する
        </button>
      </div>
    </div>
  );
}
