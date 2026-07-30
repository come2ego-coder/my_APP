export type Ledger = {
  id: string;
  name: string;
};

const LEDGERS_KEY = "snap-kakeibo:ledgers";
const CURRENT_KEY = "snap-kakeibo:currentLedger";

const DEFAULT_LEDGERS: Ledger[] = [
  { id: "1", name: "その一" },
  { id: "2", name: "その二" },
];

export function loadLedgers(): Ledger[] {
  if (typeof window === "undefined") return DEFAULT_LEDGERS;
  try {
    const raw = window.localStorage.getItem(LEDGERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall through to defaults
  }
  saveLedgers(DEFAULT_LEDGERS);
  return DEFAULT_LEDGERS;
}

export function saveLedgers(ledgers: Ledger[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEDGERS_KEY, JSON.stringify(ledgers));
  } catch {
    // localStorage full or unavailable; fail silently, nothing to recover here.
  }
}

export function loadCurrentLedgerId(fallbackId: string): string {
  if (typeof window === "undefined") return fallbackId;
  try {
    return window.localStorage.getItem(CURRENT_KEY) || fallbackId;
  } catch {
    return fallbackId;
  }
}

export function saveCurrentLedgerId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CURRENT_KEY, id);
  } catch {
    // best-effort; nothing to recover here.
  }
}
