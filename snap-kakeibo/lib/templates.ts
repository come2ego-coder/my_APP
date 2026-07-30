import type { EntryKind } from "./categories";

export type RecurringTemplate = {
  id: string;
  name: string;
  amount: number;
  category: string;
  kind: EntryKind;
};

const STORAGE_PREFIX = "snap-kakeibo:templates";
// Key used before multiple ledgers existed; migrated into the first ledger.
const LEGACY_KEY = "snap-kakeibo:templates";

export function loadTemplates(ledgerId: string): RecurringTemplate[] {
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplates(ledgerId: string, templates: RecurringTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}:${ledgerId}`, JSON.stringify(templates));
  } catch {
    // localStorage full or unavailable; fail silently, nothing to recover here.
  }
}
