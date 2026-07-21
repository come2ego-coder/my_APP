import type { PaymentMethod } from "./categories";

export type Record = {
  id: string;
  date: string; // YYYY-MM-DD
  payee: string; // 支払先(店名・取引先)
  amount: number;
  category: string;
  memo: string;
  thumbnail: string | null; // small data URL, for the list view only
  createdAt: number;
  paymentMethod: PaymentMethod;
  reimbursed: boolean; // only meaningful when paymentMethod === "personal"
  templateId?: string; // set if this entry was created from a recurring template
};

const STORAGE_KEY = "snap-keihi:records";

export function loadRecords(): Record[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: Record) => ({
      ...r,
      paymentMethod: r.paymentMethod ?? "personal",
      reimbursed: r.reimbursed ?? false,
    }));
  } catch {
    return [];
  }
}

export function saveRecords(records: Record[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage full or unavailable; fail silently, nothing to recover here.
  }
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
