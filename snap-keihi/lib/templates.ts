import type { PaymentMethod } from "./categories";

export type RecurringTemplate = {
  id: string;
  name: string;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
};

const STORAGE_KEY = "snap-keihi:templates";

export function loadTemplates(): RecurringTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t: RecurringTemplate) => ({
      ...t,
      paymentMethod: t.paymentMethod ?? "personal",
    }));
  } catch {
    return [];
  }
}

export function saveTemplates(templates: RecurringTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // localStorage full or unavailable; fail silently, nothing to recover here.
  }
}
