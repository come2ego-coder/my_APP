export type Visit = {
  date: string; // YYYY-MM-DD
  createdAt: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  stamps: number; // current stamps toward the next reward
  totalStamps: number; // lifetime stamps earned, never decreases
  rewardsRedeemed: number;
  visits: Visit[]; // one entry per stamp added, newest last
  createdAt: number;
};

const STORAGE_KEY = "snap-point:customers";

export function loadCustomers(): Customer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c: Partial<Customer>) => ({
      id: c.id ?? crypto.randomUUID(),
      name: c.name ?? "",
      phone: c.phone ?? "",
      stamps: c.stamps ?? 0,
      totalStamps: c.totalStamps ?? c.stamps ?? 0,
      rewardsRedeemed: c.rewardsRedeemed ?? 0,
      visits: c.visits ?? [],
      createdAt: c.createdAt ?? Date.now(),
    }));
  } catch {
    return [];
  }
}

export function saveCustomers(customers: Customer[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  } catch {
    // localStorage full or unavailable; fail silently, nothing to recover here.
  }
}

export function newCustomer(name: string, phone: string): Customer {
  return {
    id: crypto.randomUUID(),
    name,
    phone,
    stamps: 0,
    totalStamps: 0,
    rewardsRedeemed: 0,
    visits: [],
    createdAt: Date.now(),
  };
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function lastVisit(customer: Customer): Visit | null {
  return customer.visits.length ? customer.visits[customer.visits.length - 1] : null;
}
