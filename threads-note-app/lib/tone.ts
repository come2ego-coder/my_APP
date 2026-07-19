export type ToneOption = {
  id: string;
  label: string;
  instruction: string;
};

export const TONE_OPTIONS: ToneOption[] = [
  {
    id: "friendly",
    label: "親しみやすい",
    instruction:
      "話し言葉に近い、自然でフレンドリーな日本語。「〜だよね」「〜なんだよね」など、独り言や気づきを話すような気軽なトーン。上から目線や説教くさい言い方は避け、あくまで自分の体験として話す。",
  },
  {
    id: "gentle",
    label: "優しい",
    instruction:
      "柔らかく優しい言葉選び。断定的な言い方は避け、読み手を気遣うような寄り添う語りかけのトーン。「〜かもしれないですね」「〜だといいですよね」のような柔らかい言い回しを使う。",
  },
  {
    id: "polite",
    label: "丁寧",
    instruction:
      "丁寧な「です・ます」調。礼儀正しく落ち着いた言葉選びで、くだけすぎない書き方。ただし堅苦しくなりすぎないようにする。",
  },
  {
    id: "business",
    label: "ビジネスっぽい",
    instruction:
      "簡潔で論理的な「です・ます」調。結論を先に述べ、要点を整理して伝えるビジネス文書のような書き方。装飾的な表現は控える。",
  },
  {
    id: "instructor",
    label: "講師系",
    instruction:
      "教える立場としての分かりやすい説明口調。「〜ですね」「〜していきましょう」のように読み手を導くような丁寧な語りかけ。ただし上から目線にならないよう、寄り添う姿勢を保つ。",
  },
];
