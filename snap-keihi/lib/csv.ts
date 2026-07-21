import { getCategory, PAYMENT_METHODS } from "./categories";
import type { Record } from "./records";

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Builds a CSV for the given records, suitable for handing to accounting.
// Includes a UTF-8 BOM so Excel on Windows shows Japanese text correctly.
export function recordsToCsv(records: Record[]): string {
  const header = ["日付", "支払先", "金額", "カテゴリ", "支払方法", "精算状況", "メモ"];
  const rows = records.map((r) => {
    const category = getCategory(r.category).label;
    const paymentLabel = PAYMENT_METHODS.find((p) => p.id === r.paymentMethod)?.label ?? "";
    const status = r.paymentMethod === "company" ? "精算不要" : r.reimbursed ? "精算済み" : "未精算";
    return [r.date, r.payee, String(r.amount), category, paymentLabel, status, r.memo];
  });
  const lines = [header, ...rows].map((cols) => cols.map(escapeCell).join(","));
  return `﻿${lines.join("\r\n")}`;
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
