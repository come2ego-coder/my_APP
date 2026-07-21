"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  DEFAULT_CATEGORY_ID,
  getCategory,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/categories";
import { downloadCsv, recordsToCsv } from "@/lib/csv";
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
  payee: string;
  amount: string;
  category: string;
  memo: string;
  thumbnail: string | null;
  paymentMethod: PaymentMethod;
  reimbursed: boolean;
  templateId?: string;
  splits?: { category: string; amount: string }[];
};

function emptyDraft(paymentMethod: PaymentMethod = "personal"): Draft {
  return {
    id: null,
    date: todayStr(),
    payee: "",
    amount: "",
    category: DEFAULT_CATEGORY_ID,
    memo: "",
    thumbnail: null,
    paymentMethod,
    reimbursed: false,
  };
}

type TemplateDraft = {
  id: string | null;
  name: string;
  amount: string;
  category: string;
  paymentMethod: PaymentMethod;
};

function emptyTemplateDraft(paymentMethod: PaymentMethod = "personal"): TemplateDraft {
  return { id: null, name: "", amount: "", category: DEFAULT_CATEGORY_ID, paymentMethod };
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
  const [records, setRecords] = useState<KeihiRecord[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => todayStr().slice(0, 7));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeNotice, setAnalyzeNotice] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(emptyTemplateDraft());
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
  const pendingTotal = useMemo(
    () =>
      monthRecords
        .filter((r) => r.paymentMethod === "personal" && !r.reimbursed)
        .reduce((sum, r) => sum + r.amount, 0),
    [monthRecords],
  );
  const settledTotal = useMemo(
    () =>
      monthRecords
        .filter((r) => r.paymentMethod === "personal" && r.reimbursed)
        .reduce((sum, r) => sum + r.amount, 0),
    [monthRecords],
  );
  const companyTotal = useMemo(
    () => monthRecords.filter((r) => r.paymentMethod === "company").reduce((sum, r) => sum + r.amount, 0),
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
      .map((x) => ({
        ...x,
        pct: Math.round((x.amount / Math.max(1, monthTotal)) * 100),
        barPct: (x.amount / max) * 100,
      }));
  }, [monthRecords, monthTotal]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: KeihiRecord[] }[] = [];
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

  function openEdit(record: KeihiRecord) {
    setAnalyzeNotice(null);
    setDraft({
      id: record.id,
      date: record.date,
      payee: record.payee,
      amount: String(record.amount),
      category: record.category,
      memo: record.memo,
      thumbnail: record.thumbnail,
      paymentMethod: record.paymentMethod,
      reimbursed: record.reimbursed,
      templateId: record.templateId,
    });
  }

  function openFromTemplate(template: RecurringTemplate) {
    setAnalyzeNotice(null);
    const isCurrentMonth = viewMonth === currentMonth;
    setDraft({
      id: null,
      date: isCurrentMonth ? todayStr() : `${viewMonth}-01`,
      payee: template.name,
      amount: String(template.amount),
      category: template.category,
      memo: "",
      thumbnail: null,
      paymentMethod: template.paymentMethod,
      reimbursed: false,
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
              payee: result.payee || "",
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
      payee: draft.payee.trim(),
      amount: Number(s.amount),
      category: s.category,
      memo: draft.memo.trim(),
      thumbnail: draft.thumbnail,
      createdAt: Date.now(),
      paymentMethod: draft.paymentMethod,
      reimbursed: draft.paymentMethod === "personal" ? draft.reimbursed : false,
    }));

    if (draft.id) {
      setRecords((prev) => [
        ...prev.map((r) =>
          r.id === draft.id
            ? {
                ...r,
                date: draft.date,
                payee: draft.payee.trim(),
                amount,
                category: draft.category,
                memo: draft.memo.trim(),
                paymentMethod: draft.paymentMethod,
                reimbursed: draft.paymentMethod === "personal" ? draft.reimbursed : false,
              }
            : r,
        ),
        ...splitRecords,
      ]);
    } else {
      const newRecord: KeihiRecord = {
        id: crypto.randomUUID(),
        date: draft.date,
        payee: draft.payee.trim(),
        amount,
        category: draft.category,
        memo: draft.memo.trim(),
        thumbnail: draft.thumbnail,
        createdAt: Date.now(),
        paymentMethod: draft.paymentMethod,
        reimbursed: draft.paymentMethod === "personal" ? draft.reimbursed : false,
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

  function toggleReimbursed(id: string) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, reimbursed: !r.reimbursed } : r)));
  }

  function handleExportCsv() {
    const sorted = [...monthRecords].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt,
    );
    const csv = recordsToCsv(sorted);
    downloadCsv(`経費_${viewMonth}.csv`, csv);
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
      category: t.category,
      paymentMethod: t.paymentMethod,
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
                category: templateDraft.category,
                paymentMethod: templateDraft.paymentMethod,
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
          category: templateDraft.category,
          paymentMethod: templateDraft.paymentMethod,
        },
      ]);
    }
    setTemplateDraft(emptyTemplateDraft());
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (templateDraft.id === id) setTemplateDraft(emptyTemplateDraft());
  }

  const diff = monthTotal - prevMonthTotal;

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pb-28 pt-6 sm:pt-10">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold text-accent-deep tracking-wide">💼 パシャ経費</h1>
        <p className="mt-1 text-sm text-muted">領収書を撮るだけ。精算もスムーズに。</p>
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
        <p className="text-sm text-muted">今月の経費合計</p>
        <p className="text-4xl font-bold text-accent-deep mt-1">{formatYen(monthTotal)}</p>
        {prevMonthTotal > 0 && (
          <p className="text-xs text-muted mt-1">
            先月比 {diff >= 0 ? "+" : ""}
            {formatYen(diff)}
          </p>
        )}
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-black/5">
          <div>
            <p className="text-xs text-muted">要精算</p>
            <p className="text-lg font-semibold text-pending tabular-nums">{formatYen(pendingTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">精算済み</p>
            <p className="text-lg font-semibold text-settled tabular-nums">{formatYen(settledTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">法人カード</p>
            <p className="text-lg font-semibold tabular-nums">{formatYen(companyTotal)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={monthRecords.length === 0}
          className="mt-4 text-xs text-accent-deep underline disabled:opacity-30 disabled:no-underline"
        >
          📤 この月をCSVで書き出す
        </button>
      </section>

      {categoryBreakdown.length > 0 && (
        <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-muted mb-3">カテゴリ別</p>
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

      <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-muted">よく使う項目</p>
          <button type="button" onClick={openTemplateManager} className="text-xs text-accent-deep underline">
            管理
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-xs text-muted">
            定期券や毎月の通信費など、よく使う項目を登録しておくと毎月ワンタップで記録できます。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {templates.map((t) => {
              const cat = getCategory(t.category);
              const addedRecord = monthRecords.find((r) => r.templateId === t.id);
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-center">{cat.emoji}</span>
                  <span className="flex-1 min-w-0 truncate">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">{formatYen(t.amount)}</span>
                  {addedRecord ? (
                    <button
                      type="button"
                      onClick={() => openEdit(addedRecord)}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-settled/10 text-settled font-medium"
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
        {groupedByDate.map((group) => (
          <div key={group.date}>
            <p className="text-xs text-muted mb-1.5 px-1">
              {group.date.slice(5).replace("-", "/")}
            </p>
            <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden">
              {group.items.map((r) => {
                const cat = getCategory(r.category);
                return (
                  <div key={r.id} className="w-full flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
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
                          {r.payee || cat.label}
                        </span>
                        <span className="block text-xs text-muted truncate">
                          {cat.emoji} {cat.label}
                          {r.memo ? ` ・ ${r.memo}` : ""}
                        </span>
                      </span>
                    </button>
                    <span className="shrink-0 flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{formatYen(r.amount)}</span>
                      {r.paymentMethod === "company" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-muted">
                          🏢 法人
                        </span>
                      ) : r.reimbursed ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-settled/10 text-settled">
                          ✓ 精算済み
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleReimbursed(r.id)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-pending/10 text-pending font-medium"
                        >
                          未精算
                        </button>
                      )}
                    </span>
                  </div>
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
          onNew={(paymentMethod) => setTemplateDraft(emptyTemplateDraft(paymentMethod))}
          onClose={() => setShowTemplateManager(false)}
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

  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitCategory, setSplitCategory] = useState(
    CATEGORIES.find((c) => c.id !== draft.category)?.id ?? CATEGORIES[0].id,
  );

  function switchPaymentMethod(paymentMethod: PaymentMethod) {
    if (paymentMethod === draft.paymentMethod) return;
    onChange({ ...draft, paymentMethod, reimbursed: paymentMethod === "personal" ? draft.reimbursed : false });
  }

  function confirmSplit() {
    const splitAmt = Number(splitAmount);
    const current = Number(draft.amount) || 0;
    if (!Number.isFinite(splitAmt) || splitAmt <= 0 || splitAmt >= current) return;
    onChange({
      ...draft,
      amount: String(current - splitAmt),
      splits: [...splits, { category: splitCategory, amount: splitAmount }],
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
            <label className="block text-xs text-muted mb-1">支払方法</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => switchPaymentMethod(p.id)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    draft.paymentMethod === p.id
                      ? "border-accent bg-accent/10 text-accent-deep"
                      : "border-transparent bg-white text-foreground/70"
                  }`}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>

          {draft.paymentMethod === "personal" && (
            <div>
              <label className="block text-xs text-muted mb-1">精算状況</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, reimbursed: false })}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    !draft.reimbursed
                      ? "border-pending bg-pending/10 text-pending"
                      : "border-transparent bg-white text-foreground/70"
                  }`}
                >
                  未精算
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, reimbursed: true })}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    draft.reimbursed
                      ? "border-settled bg-settled/10 text-settled"
                      : "border-transparent bg-white text-foreground/70"
                  }`}
                >
                  精算済み
                </button>
              </div>
            </div>
          )}

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

          {splits.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {splits.map((s, i) => {
                const cat = getCategory(s.category);
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

          {showSplitForm ? (
            <div className="bg-white rounded-xl p-3 shadow-sm flex flex-col gap-2">
              <p className="text-xs text-muted">別カテゴリに分ける金額</p>
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
                value={splitCategory}
                onChange={(e) => setSplitCategory(e.target.value)}
                className="text-sm rounded-lg border border-black/10 px-2 py-1.5 bg-white"
              >
                {CATEGORIES.map((c) => (
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
              ✂️ 別のカテゴリに分ける
            </button>
          )}

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
              <label className="block text-xs text-muted mb-1">支払先</label>
              <input
                type="text"
                value={draft.payee}
                onChange={(e) => onChange({ ...draft, payee: e.target.value })}
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
  onNew: (paymentMethod: PaymentMethod) => void;
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
              const cat = getCategory(t.category);
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <span className="w-6 text-center">{cat.emoji}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">{t.name}</span>
                    <span className="text-sm tabular-nums">{formatYen(t.amount)}</span>
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

        <div className="grid grid-cols-2 gap-2 mb-3">
          {PAYMENT_METHODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onNew(p.id)}
              className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                draft.paymentMethod === p.id
                  ? "border-accent bg-accent/10 text-accent-deep"
                  : "border-transparent bg-white text-foreground/70"
              }`}
            >
              {p.emoji} {p.label}
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
          <div>
            <label className="block text-xs text-muted mb-1">カテゴリ</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
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
