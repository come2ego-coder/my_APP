export type Record = {
  id: string;
  date: string; // YYYY-MM-DD
  store: string;
  amount: number;
  category: string;
  memo: string;
  thumbnail: string | null; // small data URL, for the list view only
  createdAt: number;
  kind: "expense" | "income";
  templateId?: string; // set if this entry was created from a recurring template
};

const STORAGE_PREFIX = "snap-kakeibo:records";
// Key used before multiple ledgers existed; migrated into the first ledger.
const LEGACY_KEY = "snap-kakeibo:records";

export function loadRecords(ledgerId: string): Record[] {
  if (typeof window === "undefined") return [];
  try {
    const key = `${STORAGE_PREFIX}:${ledgerId}`;
    let raw = window.localStorage.getItem(key);
    // Only the first ledger inherits pre-multi-ledger data; a brand new
    // ledger with no key yet should start empty, not clone the legacy data.
    if (raw === null && ledgerId === "1") {
      raw = window.localStorage.getItem(LEGACY_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Older records saved before income tracking existed have no `kind`.
    return parsed.map((r: Record) => ({ ...r, kind: r.kind ?? "expense" }));
  } catch {
    return [];
  }
}

export function saveRecords(ledgerId: string, records: Record[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}:${ledgerId}`, JSON.stringify(records));
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
