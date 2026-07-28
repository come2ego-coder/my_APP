export type Settings = {
  goal: number; // stamps needed for a reward
  reward: string; // what the customer gets, shown as free text
  shopName: string;
};

const STORAGE_KEY = "snap-point:settings";

export const DEFAULT_SETTINGS: Settings = {
  goal: 10,
  reward: "1品サービス",
  shopName: "うちの店",
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      goal: Number(parsed.goal) > 0 ? Number(parsed.goal) : DEFAULT_SETTINGS.goal,
      reward: typeof parsed.reward === "string" && parsed.reward ? parsed.reward : DEFAULT_SETTINGS.reward,
      shopName:
        typeof parsed.shopName === "string" && parsed.shopName ? parsed.shopName : DEFAULT_SETTINGS.shopName,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable; fail silently, nothing to recover here.
  }
}
