import { GoogleGenAI, ApiError } from "@google/genai";
import { NextResponse } from "next/server";

const GENERATE_SYSTEM_PROMPT = `あなたはYouTube動画の文字起こしをもとに、note記事やデジタルコンテンツとして
配布・販売できる解説コンテンツを作成するライターです。

以下のルールに従ってください。
- 入力された文字起こし(【冒頭】【本編】【最後に】に分かれています)の内容を元に、
  読者が実践できる形でノウハウを整理し直す
- 元の構成にとらわれず、読みやすい独自の見出し構成に組み直してよい(見出しは## を使う)
- 口調は丁寧だが親しみやすい「です・ます」調
- 動画の中の重要なポイント・手順・注意点は漏らさず盛り込む
- 単なる要約ではなく、それ単体で読み物として通用する文章に仕上げる
- AIっぽい機械的な言い回しや不自然な絵文字の多用は避ける
- 出力は本文のみ。前置きや後書きの説明("以下がコンテンツです"等)は書かない`;

const IMPROVE_SYSTEM_PROMPT = `あなたはnote記事やデジタルコンテンツの編集者です。
既存のコンテンツ本文の一部について、改善指示と追加情報を反映して書き直します。

- 「改善したい箇所」に指定された部分を中心に、内容を充実させたり、わかりやすく書き直したりする
- 「追加したい情報」があれば、該当する箇所に自然に組み込む
- 指示されていない他の部分は、内容を変えずにそのまま保持する
- 文体・見出し構成は元のコンテンツに揃える
- 出力は改善後のコンテンツ本文全体。前置きや後書きの説明は書かない`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません(JSONとして読み込めませんでした)。" },
      { status: 400 },
    );
  }

  const { transcript, previousContent, targetExcerpt, additionalInfo } = (body ?? {}) as {
    transcript?: string;
    previousContent?: string;
    targetExcerpt?: string;
    additionalInfo?: string;
  };

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "サーバーにGEMINI_API_KEYが設定されていません。.envファイルを確認してください。" },
      { status: 500 },
    );
  }

  const isImprovement = !!previousContent && !!previousContent.trim();

  let systemInstruction: string;
  let userPrompt: string;

  if (isImprovement) {
    if (!targetExcerpt || !targetExcerpt.trim()) {
      return NextResponse.json(
        { error: "改善したい箇所を入力してください。" },
        { status: 400 },
      );
    }
    systemInstruction = IMPROVE_SYSTEM_PROMPT;
    userPrompt = `現在のコンテンツ本文:
${previousContent!.trim()}

改善したい箇所(この部分を中心に書き直してください):
${targetExcerpt.trim()}

追加したい情報(あれば組み込んでください):
${additionalInfo?.trim() || "(なし)"}

上記を反映した、コンテンツ本文全体を出力してください。`;
  } else {
    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { error: "整えた文字起こしのテキストを入力してください。" },
        { status: 400 },
      );
    }
    systemInstruction = GENERATE_SYSTEM_PROMPT;
    userPrompt = `以下は、YouTube動画の文字起こしを整えたものです。

${transcript.trim()}

この内容をもとに、コンテンツを作成してください。`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
      contents: userPrompt,
      config: {
        systemInstruction,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "AIからテキストの応答が得られませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ content: text.trim() });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          { error: "APIキーが無効です。GEMINI_API_KEYの設定を確認してください。" },
          { status: 401 },
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "アクセスが集中しているか、無料枠の上限に達しました。しばらく待ってからもう一度お試しください。" },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `AIとの通信でエラーが発生しました: ${error.message}` },
        { status: error.status || 500 },
      );
    }
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json(
      { error: `予期しないエラーが発生しました: ${message}` },
      { status: 500 },
    );
  }
}
