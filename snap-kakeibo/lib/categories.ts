export type Category = {
  id: string;
  label: string;
  emoji: string;
  color: string;
};

export const CATEGORIES: Category[] = [
  { id: "food", label: "食費", emoji: "🍙", color: "#e8895c" },
  { id: "daily", label: "日用品", emoji: "🧻", color: "#5cae8f" },
  { id: "transport", label: "交通", emoji: "🚃", color: "#4d8fd6" },
  { id: "entertainment", label: "娯楽", emoji: "🎮", color: "#a06cd5" },
  { id: "medical", label: "医療", emoji: "💊", color: "#e05c7a" },
  { id: "beauty", label: "衣服・美容", emoji: "👗", color: "#d6a94d" },
  { id: "social", label: "交際費", emoji: "🍻", color: "#c98a3e" },
  { id: "housing", label: "住居・光熱費", emoji: "🏠", color: "#6c8ed6" },
  { id: "other", label: "その他", emoji: "📦", color: "#8a8a94" },
];

export const DEFAULT_CATEGORY_ID = "other";

export function getCategory(id: string | undefined | null): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
