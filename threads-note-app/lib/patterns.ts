export type Pattern = {
  id: string;
  label: string;
  description: string;
  example: string;
};

export const PATTERNS: Pattern[] = [
  {
    id: "dev-log",
    label: "開発ログ",
    description: "今日AIでやったことを事実ベースでサラッと。",
    example: "今日はAIに「広告消すボタン作って」って頼んだら30分でできた",
  },
  {
    id: "before-after",
    label: "ビフォーアフター",
    description: "変化・成長を感情ベースで。",
    example: "3ヶ月前はAIって言葉すら怖かった私が、今は自分でアプリ作ってる",
  },
  {
    id: "demo",
    label: "実演",
    description: "アプリの中身を見せて興味を引く。",
    example: "このアプリ、こんな人に役立つと思って作った",
  },
  {
    id: "struggle",
    label: "失敗・つまずき",
    description: "共感を生むリアルな苦労話。",
    example: "同じエラー3回直してもらった。心折れかけたけど続けられた",
  },
  {
    id: "question",
    label: "問いかけ",
    description: "コメントを誘発する一言。",
    example: "50代でアプリ作るって聞いたら、どう思う?",
  },
];
