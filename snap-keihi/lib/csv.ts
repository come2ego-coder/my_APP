import { CATEGORIES, ENTRY_KINDS, PURCHASE_CATEGORIES, getCategoryForKind } from "./categories";
import type { Record } from "./records";

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function kindLabel(kind: Record["kind"]): string {
  return ENTRY_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

function toCsv(rows: string[][]): string {
  // Leading U+FEFF (BOM) so Excel on Windows shows Japanese text correctly.
  return `﻿${rows.map((cols) => cols.map(escapeCell).join(",")).join("\r\n")}`;
}

// Builds a CSV of individual transactions, suitable for handing to an
// accountant or keeping as a detailed ledger alongside the tax return.
export function recordsToCsv(records: Record[]): string {
  const header = ["日付", "種別", "取引先", "金額", "科目", "メモ"];
  const rows = records.map((r) => [
    r.date,
    kindLabel(r.kind),
    r.partner,
    String(r.amount),
    getCategoryForKind(r.kind, r.category)?.label ?? "-",
    r.memo,
  ]);
  return toCsv([header, ...rows]);
}

export type AnnualSummary = {
  year: string;
  revenueTotal: number;
  purchaseTotal: number;
  purchaseByCategory: { category: (typeof PURCHASE_CATEGORIES)[number]; amount: number }[];
  expenseByCategory: { category: (typeof CATEGORIES)[number]; amount: number }[];
  expenseTotal: number;
  profit: number;
};

function sumByCategory<C extends { id: string }>(
  records: Record[],
  kind: Record["kind"],
  categories: C[],
): { category: C; amount: number }[] {
  const sums = new Map<string, number>();
  for (const r of records) {
    if (r.kind !== kind) continue;
    const key = r.category ?? categories[categories.length - 1].id;
    sums.set(key, (sums.get(key) ?? 0) + r.amount);
  }
  return categories.map((category) => ({ category, amount: sums.get(category.id) ?? 0 }));
}

export function computeAnnualSummary(records: Record[], year: string): AnnualSummary {
  const yearRecords = records.filter((r) => r.date.slice(0, 4) === year);
  const revenueTotal = yearRecords
    .filter((r) => r.kind === "revenue")
    .reduce((sum, r) => sum + r.amount, 0);
  const purchaseTotal = yearRecords
    .filter((r) => r.kind === "purchase")
    .reduce((sum, r) => sum + r.amount, 0);

  const purchaseByCategory = sumByCategory(yearRecords, "purchase", PURCHASE_CATEGORIES);
  const expenseByCategory = sumByCategory(yearRecords, "expense", CATEGORIES);
  const expenseTotal = expenseByCategory.reduce((sum, c) => sum + c.amount, 0);

  return {
    year,
    revenueTotal,
    purchaseTotal,
    purchaseByCategory,
    expenseByCategory,
    expenseTotal,
    profit: revenueTotal - purchaseTotal - expenseTotal,
  };
}

// A 収支内訳書-style report: one row per line item, in form order, so the
// totals can be copied straight onto the tax return.
export function annualSummaryToCsv(summary: AnnualSummary): string {
  const rows: string[][] = [
    ["科目", "金額"],
    ["売上（収入）金額", String(summary.revenueTotal)],
    ["仕入高", String(summary.purchaseTotal)],
    ...summary.expenseByCategory.map((c) => [c.category.label, String(c.amount)]),
    ["経費合計", String(summary.expenseTotal)],
    ["差引金額（所得金額）", String(summary.profit)],
  ];
  return toCsv(rows);
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
