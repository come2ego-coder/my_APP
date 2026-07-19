export type CtaOption = {
  id: string;
  label: string;
  text: string;
};

export const CTA_OPTIONS: CtaOption[] = [
  { id: "none", label: "なし", text: "" },
  { id: "follow", label: "フォローをお願いする", text: "フォローをお願いします" },
  { id: "comment", label: "コメントを促す", text: "コメントで教えてください" },
  { id: "link", label: "プロフィールのリンクに誘導", text: "詳しくはプロフィールのリンクから" },
  { id: "custom", label: "自由入力", text: "" },
];
