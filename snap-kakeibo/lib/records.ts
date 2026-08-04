import { idbGet, idbSet } from "./idb";

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

function normalize(parsed: unknown): Record[] {
  if (!Array.isArray(parsed)) return [];
  // Older records saved before income tracking existed have no `kind`.
  return parsed.map((r: Record) => ({ ...r, kind: r.kind ?? "expense" }));
}

export async function loadRecords(ledgerId: string): Promise<Record[]> {
  if (typeof window === "undefined") return [];
  const key = `${STORAGE_PREFIX}:${ledgerId}`;
  try {
    const fromIdb = await idbGet(key);
    if (fromIdb !== null) return normalize(JSON.parse(fromIdb));

    // Not in IndexedDB yet: this device may still have data sitting in
    // localStorage from before photos were moved there (either this
    // ledger's own namespaced key, or — for the very first ledger — the
    // flat key used before multiple ledgers existed). Adopt it into
    // IndexedDB and clear it out of localStorage so that small, easily
    // exhausted quota is freed up rather than left holding photos forever.
    let raw = window.localStorage.getItem(key);
    if (raw === null && ledgerId === "1") {
      raw = window.localStorage.getItem(LEGACY_KEY);
    }
    if (raw === null) return [];

    const records = normalize(JSON.parse(raw));
    await idbSet(key, JSON.stringify(records));
    window.localStorage.removeItem(key);
    if (ledgerId === "1") window.localStorage.removeItem(LEGACY_KEY);
    return records;
  } catch {
    return [];
  }
}

// "ok": saved everything, including photos.
// "photos-dropped": storage was full even in IndexedDB, so photos were
//   stripped out and only the amount/category/date/etc. was saved —
//   nothing numeric was lost. Should be rare given IndexedDB's much larger
//   quota compared to localStorage.
// "failed": couldn't save even without photos (should be extremely rare).
export type SaveResult = "ok" | "photos-dropped" | "failed";

export async function saveRecords(ledgerId: string, records: Record[]): Promise<SaveResult> {
  if (typeof window === "undefined") return "ok";
  const key = `${STORAGE_PREFIX}:${ledgerId}`;
  try {
    await idbSet(key, JSON.stringify(records));
    return "ok";
  } catch {
    try {
      const withoutPhotos = records.map((r) => ({ ...r, thumbnail: null }));
      await idbSet(key, JSON.stringify(withoutPhotos));
      return "photos-dropped";
    } catch {
      return "failed";
    }
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
