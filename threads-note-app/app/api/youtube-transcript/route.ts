import { NextResponse } from "next/server";
import { extractVideoId, fetchTranscript, TranscriptUnavailableError } from "@/lib/youtube";

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

  const { url } = (body ?? {}) as { url?: string };
  if (!url || !url.trim()) {
    return NextResponse.json({ error: "YouTubeの動画URLを入力してください。" }, { status: 400 });
  }

  const videoId = extractVideoId(url.trim());
  if (!videoId) {
    return NextResponse.json(
      { error: "YouTubeの動画URLとして認識できませんでした。URLを確認してください。" },
      { status: 400 },
    );
  }

  try {
    const transcript = await fetchTranscript(videoId);
    return NextResponse.json({ transcript });
  } catch (error) {
    if (error instanceof TranscriptUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json(
      { error: `文字起こしの取得中にエラーが発生しました: ${message}` },
      { status: 500 },
    );
  }
}
