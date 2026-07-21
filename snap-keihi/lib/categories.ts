export type Category = {
  id: string;
  label: string;
  emoji: string;
  color: string;
};

export const CATEGORIES: Category[] = [
  { id: "transport", label: "交通費", emoji: "🚃", color: "#4d8fd6" },
  { id: "entertainment", label: "交際費", emoji: "🍻", color: "#c98a3e" },
  { id: "meeting", label: "会議費", emoji: "☕", color: "#a06cd5" },
  { id: "supplies", label: "消耗品費", emoji: "📦", color: "#5cae8f" },
  { id: "communication", label: "通信費", emoji: "📱", color: "#e05c7a" },
  { id: "accommodation", label: "出張・宿泊費", emoji: "🏨", color: "#e8895c" },
  { id: "books", label: "書籍・研修費", emoji: "📚", color: "#d6a94d" },
  { id: "fees", label: "諸会費", emoji: "🎫", color: "#2f9e9e" },
  { id: "other", label: "雑費", emoji: "📎", color: "#8a8a94" },
];

export const DEFAULT_CATEGORY_ID = "other";

export function getCategory(id: string | undefined | null): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export type PaymentMethod = "personal" | "company";

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; emoji: string }[] = [
  { id: "personal", label: "立替（個人払い）", emoji: "💳" },
  { id: "company", label: "法人カード", emoji: "🏢" },
];
