export type Category = {
  id: string;
  label: string;
  emoji: string;
  color: string;
};

// Matches the expense line items on the 収支内訳書(一般用), in the same
// order they appear on the form, so a category subtotal maps 1:1 onto a
// line when filling out the actual tax return.
export const CATEGORIES: Category[] = [
  { id: "taxes", label: "租税公課", emoji: "🧾", color: "#8a8a94" },
  { id: "shipping", label: "荷造運賃", emoji: "📦", color: "#5cae8f" },
  { id: "utilities", label: "水道光熱費", emoji: "💡", color: "#d6a94d" },
  { id: "travel", label: "旅費交通費", emoji: "🚃", color: "#4d8fd6" },
  { id: "communication", label: "通信費", emoji: "📱", color: "#e05c7a" },
  { id: "advertising", label: "広告宣伝費", emoji: "📣", color: "#c9633e" },
  { id: "entertainment", label: "接待交際費", emoji: "🍻", color: "#c98a3e" },
  { id: "insurance", label: "損害保険料", emoji: "🛡️", color: "#6c8ed6" },
  { id: "repairs", label: "修繕費", emoji: "🔧", color: "#7a8a9a" },
  { id: "supplies", label: "消耗品費", emoji: "🖊️", color: "#a06cd5" },
  { id: "depreciation", label: "減価償却費", emoji: "🏚️", color: "#9a8064" },
  { id: "welfare", label: "福利厚生費", emoji: "🎗️", color: "#e0819a" },
  { id: "wages", label: "給料賃金", emoji: "👥", color: "#4f8f7d" },
  { id: "outsourcing", label: "外注工賃", emoji: "🤝", color: "#8f6fd6" },
  { id: "interest", label: "利子割引料", emoji: "💹", color: "#3f9ea0" },
  { id: "rent", label: "地代家賃", emoji: "🏠", color: "#d68f4d" },
  { id: "baddebt", label: "貸倒金", emoji: "⚠️", color: "#c25c5c" },
  { id: "misc", label: "雑費", emoji: "📎", color: "#8a8a94" },
];

export const DEFAULT_CATEGORY_ID = "misc";

export function getCategory(id: string | undefined | null): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export type EntryKind = "revenue" | "purchase" | "expense";

export const ENTRY_KINDS: { id: EntryKind; label: string; emoji: string }[] = [
  { id: "revenue", label: "売上", emoji: "💰" },
  { id: "purchase", label: "仕入", emoji: "🛒" },
  { id: "expense", label: "経費", emoji: "🧾" },
];

export function partnerLabel(kind: EntryKind): string {
  if (kind === "revenue") return "取引先";
  if (kind === "purchase") return "仕入先";
  return "支払先";
}
