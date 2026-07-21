"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  categoriesForKind,
  defaultCategoryForKind,
  type EntryKind,
  getCategoryForKind,
} from "@/lib/categories";
import { dataUrlToBase64, resizeImage } from "@/lib/image";
import {
  type Record as KakeiboRecord,
  loadRecords,
  monthKey,
  saveRecords,
  todayStr,
} from "@/lib/records";
import { type RecurringTemplate, loadTemplates, saveTemplates } from "@/lib/templates";

type Draft = {
  id: string | null;
  date: string;
  store: string;
  amount: string;
  category: string;
  memo: string;
  thumbnail: string | null;
  kind: EntryKind;
  templateId?: string;
  kindLocked?: boolean;
  splits?: { category: string; amount: string }[];
};

function emptyDraft(kind: EntryKind = "expense"): Draft {
  return {
    id: null,
    date: todayStr(),
    store: "",
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
  category: string;
  kind: EntryKind;
};

function emptyTemplateDraft(kind: EntryKind = "expense"): TemplateDraft {
  return { id: null, name: "", amount: "", category: defaultCategoryForKind(kind), kind };
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
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => todayStr().slice(0, 7));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeNotice, setAnalyzeNotice] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(emptyTemplateDraft());
  const [authUser, setAuthUser] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setRecords(loadRecords());
    setTemplates(loadTemplates());
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        const me = await meRes.json();
        if (cancelled || !me.username) return;
        setAuthUser(me.username);
        const dataRes = await fetch("/api/data");
        if (!cancelled && dataRes.ok) {
          const data = await dataRes.json();
          const serverRecords: KakeiboRecord[] = data.records ?? [];
          // The server never stores photos (too large to sync). Keep this
          // device's cached photo for any record it already recognizes.
          setRecords((prev) => {
            const localThumbnails = new Map(prev.map((r) => [r.id, r.thumbnail]));
            return serverRecords.map((r) => ({
              ...r,
              thumbnail: r.thumbnail ?? localThumbnails.get(r.id) ?? null,
            }));
          });
          setTemplates(data.templates ?? []);
        }
      } catch {
        // no server session available; stay in local-only mode
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveRecords(records);
    saveTemplates(templates);
    if (!authUser) return;
    const timer = setTimeout(() => {
      // Photos stay on-device only: they're too large to bundle into every
      // sync request, so the server only ever gets the record metadata.
      const syncRecords = records.map((r) => ({ ...r, thumbnail: null }));
      fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: syncRecords, templates }),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [records, templates, hydrated, authUser]);

  async function handleLogout() {
    setAuthUser(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort; the cookie is short-lived anyway
    }
  }

  const currentMonth = todayStr().slice(0, 7);

  const monthRecords = useMemo(
    () =>
      records
        .filter((r) => monthKey(r.date) === viewMonth)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [records, viewMonth],
  );

  const monthExpenseTotal = useMemo(
    () => monthRecords.filter((r) => r.kind === "expense").reduce((sum, r) => sum + r.amount, 0),
    [monthRecords],
  );
  const monthIncomeTotal = useMemo(
    () => monthRecords.filter((r) => r.kind === "income").reduce((sum, r) => sum + r.amount, 0),
    [monthRecords],
  );
  const monthBalance = monthIncomeTotal - monthExpenseTotal;

  const prevMonthExpenseTotal = useMemo(() => {
    const prev = shiftMonth(viewMonth, -1);
    return records
      .filter((r) => monthKey(r.date) === prev && r.kind === "expense")
      .reduce((sum, r) => sum + r.amount, 0);
  }, [records, viewMonth]);

  const categoryBreakdown = useMemo(() => {
    const sums = new Map<string, number>();
    for (const r of monthRecords) {
      if (r.kind !== "expense") continue;
      sums.set(r.category, (sums.get(r.category) ?? 0) + r.amount);
    }
    const max = Math.max(1, ...sums.values());
    return CATEGORIES.map((c) => ({ category: c, amount: sums.get(c.id) ?? 0 }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((x) => ({
        ...x,
        pct: Math.round((x.amount / Math.max(1, monthExpenseTotal)) * 100),
        barPct: (x.amount / max) * 100,
      }));
  }, [monthRecords, monthExpenseTotal]);

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
    setDraft(emptyDraft("expense"));
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
      store: template.name,
      amount: String(template.amount),
      category: template.category,
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
        resizeImage(file, 720, 0.62),
      ]);

      setDraft({ ...emptyDraft("expense"), thumbnail, kindLocked: true });
      setAnalyzing(true);

      const { mimeType, data } = dataUrlToBase64(analysisImage);
      // A hung request must never leave the modal spinning forever, so give
      // up and surface an error after 45s regardless of what the server does.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      let res: Response;
      try {
        res = await fetch("/api/analyze-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: data, mimeType }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const result = await res.json();

      if (!res.ok) {
        setAnalyzeNotice(result.error || "読み取りに失敗しました。手入力で保存できます。");
        return;
      }

      const breakdown: { category?: string; amount?: number }[] = Array.isArray(result.breakdown)
        ? result.breakdown
        : [];
      const [first, ...rest] = breakdown;

      setDraft((cur) =>
        cur
          ? {
              ...cur,
              store: result.store || "",
              date: result.date || cur.date,
              amount: first?.amount != null ? String(first.amount) : "",
              category: first?.category || defaultCategoryForKind("expense"),
              memo: result.memo || "",
              splits: rest.map((r) => ({
                category: r.category || defaultCategoryForKind("expense"),
                amount: String(r.amount ?? 0),
              })),
            }
          : cur,
      );

      if (!first) {
        setAnalyzeNotice("金額を読み取れませんでした。手入力してください。");
      } else if (rest.length > 0) {
        setAnalyzeNotice(
          `カテゴリが混在していたため、${breakdown.length}件に自動で分けました。内容を確認してください。`,
        );
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setAnalyzeNotice(
        isTimeout
          ? "読み取りに時間がかかりすぎました。もう一度お試しください。"
          : "画像の処理に失敗しました。手入力で保存できます。",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSave() {
    if (!draft) return;
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) return;

    const splitRecords: KakeiboRecord[] = (draft.splits ?? []).map((s) => ({
      id: crypto.randomUUID(),
      date: draft.date,
      store: draft.store.trim(),
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
                store: draft.store.trim(),
                amount,
                category: draft.category,
                memo: draft.memo.trim(),
                kind: draft.kind,
              }
            : r,
        ),
        ...splitRecords,
      ]);
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

  function openTemplateManager() {
    setTemplateDraft(emptyTemplateDraft());
    setShowTemplateManager(true);
  }

  function selectTemplateForEdit(t: RecurringTemplate) {
    setTemplateDraft({ id: t.id, name: t.name, amount: String(t.amount), category: t.category, kind: t.kind });
  }

  function saveTemplateDraft() {
    const amount = Number(templateDraft.amount);
    if (!templateDraft.name.trim() || !Number.isFinite(amount) || amount <= 0) return;
    if (templateDraft.id) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateDraft.id
            ? { ...t, name: templateDraft.name.trim(), amount, category: templateDraft.category, kind: templateDraft.kind }
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

  const diff = monthExpenseTotal - prevMonthExpenseTotal;

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pb-28 pt-6 sm:pt-10">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold text-accent-deep tracking-wide">📷 パシャ家計簿</h1>
        <p className="mt-1 text-sm text-muted">レシートを撮るだけ。入力はほぼなし。</p>
      </header>

      <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted">
        {authUser ? (
          <>
            <span>👤 {authUser} としてログイン中</span>
            <button type="button" onClick={handleLogout} className="text-accent-deep underline">
              ログアウト
            </button>
          </>
        ) : (
          <>
            <span>未ログイン(この端末だけに保存中)</span>
            <Link href="/login" className="text-accent-deep underline">
              アカウントを作る
            </Link>
          </>
        )}
      </div>

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
        <p className="text-sm text-muted">今月の支出</p>
        <p className="text-4xl font-bold text-accent-deep mt-1">{formatYen(monthExpenseTotal)}</p>
        {prevMonthExpenseTotal > 0 && (
          <p className="text-xs text-muted mt-1">
            先月比 {diff >= 0 ? "+" : ""}
            {formatYen(diff)}
          </p>
        )}
        <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-black/5">
          <div>
            <p className="text-xs text-muted">収入</p>
            <p className="text-lg font-semibold text-income tabular-nums">{formatYen(monthIncomeTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">収支</p>
            <p className={`text-lg font-semibold tabular-nums ${monthBalance >= 0 ? "text-income" : "text-red-500"}`}>
              {monthBalance >= 0 ? "+" : ""}
              {formatYen(monthBalance)}
            </p>
          </div>
        </div>
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

      <section className="bg-card rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-muted">定期・予定</p>
          <button type="button" onClick={openTemplateManager} className="text-xs text-accent-deep underline">
            管理
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-xs text-muted">
            家賃やサブスク、給与などの固定項目を登録しておくと、毎月ワンタップで記録できます。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {templates.map((t) => {
              const cat = getCategoryForKind(t.kind, t.category);
              const paidRecord = monthRecords.find((r) => r.templateId === t.id);
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-center">{cat.emoji}</span>
                  <span className="flex-1 min-w-0 truncate">{t.name}</span>
                  <span
                    className={`shrink-0 tabular-nums ${t.kind === "income" ? "text-income" : "text-muted"}`}
                  >
                    {t.kind === "income" ? "+" : ""}
                    {formatYen(t.amount)}
                  </span>
                  {paidRecord ? (
                    <button
                      type="button"
                      onClick={() => openEdit(paidRecord)}
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
              右下のボタンでレシートを撮る(PayPayなどの支払い完了画面のスクリーンショットでもOK)!
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
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${r.kind === "income" ? "text-income" : ""}`}
                    >
                      {r.kind === "income" ? "+" : ""}
                      {formatYen(r.amount)}
                    </span>
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
            aria-label="レシートを撮る・写真を選ぶ"
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
  const categoryOptions = categoriesForKind(draft.kind);
  const splits = draft.splits ?? [];

  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitCategory, setSplitCategory] = useState(
    categoryOptions.find((c) => c.id !== draft.category)?.id ?? categoryOptions[0].id,
  );
  const [showFullImage, setShowFullImage] = useState(false);

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

        {!draft.kindLocked && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => switchKind("expense")}
              className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                draft.kind === "expense"
                  ? "border-accent bg-accent/10 text-accent-deep"
                  : "border-transparent bg-white text-foreground/70"
              }`}
            >
              支出
            </button>
            <button
              type="button"
              onClick={() => switchKind("income")}
              className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                draft.kind === "income"
                  ? "border-income bg-income/10 text-income"
                  : "border-transparent bg-white text-foreground/70"
              }`}
            >
              収入
            </button>
          </div>
        )}

        {draft.thumbnail && (
          <div className="flex justify-center mb-3">
            <button type="button" onClick={() => setShowFullImage(true)} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.thumbnail}
                alt=""
                className="h-32 rounded-xl object-cover shadow-sm"
              />
              <span className="block text-center text-xs text-accent-deep underline mt-1">
                タップで拡大
              </span>
            </button>
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

          {splits.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {splits.map((s, i) => {
                const cat = getCategoryForKind(draft.kind, s.category);
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
              <label className="block text-xs text-muted mb-1">{draft.kind === "income" ? "内容" : "店名"}</label>
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

      {showFullImage && draft.thumbnail && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
          onClick={() => setShowFullImage(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.thumbnail}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            type="button"
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
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
  const categoryOptions = categoriesForKind(draft.kind);

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">定期・予定を管理</h2>
          <button type="button" onClick={onClose} className="text-muted text-2xl leading-none px-2">
            ×
          </button>
        </div>

        {templates.length > 0 && (
          <div className="bg-card rounded-2xl shadow-sm divide-y divide-black/5 overflow-hidden mb-4">
            {templates.map((t) => {
              const cat = getCategoryForKind(t.kind, t.category);
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <span className="w-6 text-center">{cat.emoji}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">{t.name}</span>
                    <span className={`text-sm tabular-nums ${t.kind === "income" ? "text-income" : ""}`}>
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

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => onNew("expense")}
            className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
              draft.kind === "expense"
                ? "border-accent bg-accent/10 text-accent-deep"
                : "border-transparent bg-white text-foreground/70"
            }`}
          >
            固定の支出
          </button>
          <button
            type="button"
            onClick={() => onNew("income")}
            className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
              draft.kind === "income"
                ? "border-income bg-income/10 text-income"
                : "border-transparent bg-white text-foreground/70"
            }`}
          >
            固定の収入
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">名前</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
              placeholder={draft.kind === "income" ? "例: 給与" : "例: 家賃"}
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
              {categoryOptions.map((c) => (
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
