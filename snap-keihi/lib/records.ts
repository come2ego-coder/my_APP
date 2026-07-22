import type { EntryKind } from "./categories";

export type Record = {
  id: string;
  date: string; // YYYY-MM-DD
  partner: string; // 取引先・仕入先・支払先
  amount: number;
  category: string | null; // meaningful when kind is "expense" or "purchase"
  memo: string;
  thumbnail: string | null; // compressed data URL; used for the list icon and the zoomed-in view
  createdAt: number;
  kind: EntryKind;
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
    return parsed.map((r: Record & { payee?: string }) => {
      const kind: EntryKind = r.kind ?? "expense";
      let category = r.category ?? null;
      if (kind === "revenue") category = null;
      else if (kind === "expense") category = category ?? "misc";
      else if (kind === "purchase") category = category ?? "ingredients";
      return { ...r, partner: r.partner ?? r.payee ?? "", kind, category };
    });
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

export function yearKey(dateStr: string): string {
  return dateStr.slice(0, 4); // YYYY
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
