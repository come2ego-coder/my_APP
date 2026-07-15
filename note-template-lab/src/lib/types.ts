export interface GenreCut {
  label: string;
  description: string;
}

export interface Analysis {
  titlePatterns: string[];
  openingPatterns: string[];
  structureSteps: string[];
  reasons: string[];
  originalTitles: string[];
}

export type ArticleMode = "ai" | "custom";

export interface GeneratedArticle {
  title: string;
  body: string;
  advice: string;
}

export interface ArticleHistoryItem {
  id: string;
  genre: string;
  cutLabel: string;
  title: string;
  createdAt: string;
}

export interface ArticleHistoryDetail extends ArticleHistoryItem {
  cutDescription: string;
  analysis: Analysis;
  mode: ArticleMode;
  userInput: string | null;
  body: string;
  advice: string;
}
