export class TranscriptUnavailableError extends Error {}

export function extractVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  if (parsed.hostname === "youtu.be") {
    return parsed.pathname.slice(1) || null;
  }

  if (parsed.hostname.endsWith("youtube.com")) {
    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/")[2] ?? null;
    }
    if (parsed.pathname.startsWith("/live/")) {
      return parsed.pathname.split("/")[2] ?? null;
    }
  }

  return null;
}

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
};

export async function fetchTranscript(videoId: string): Promise<string> {
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
    },
  });

  if (!watchRes.ok) {
    throw new TranscriptUnavailableError("動画ページを取得できませんでした。URLを確認してください。");
  }

  const html = await watchRes.text();
  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) {
    throw new TranscriptUnavailableError(
      "この動画には字幕(文字起こし)が見つかりませんでした。字幕がある動画をお試しください。",
    );
  }

  let tracks: CaptionTrack[];
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    throw new TranscriptUnavailableError("字幕情報の解析に失敗しました。");
  }

  if (tracks.length === 0) {
    throw new TranscriptUnavailableError("この動画には字幕(文字起こし)が見つかりませんでした。");
  }

  const track =
    tracks.find((t) => t.languageCode === "ja") ??
    tracks.find((t) => t.languageCode?.startsWith("ja")) ??
    tracks[0];

  const captionUrl = track.baseUrl.startsWith("http")
    ? track.baseUrl
    : `https://www.youtube.com${track.baseUrl}`;

  const captionRes = await fetch(`${captionUrl}&fmt=vtt`);
  if (!captionRes.ok) {
    throw new TranscriptUnavailableError("字幕データの取得に失敗しました。");
  }

  const vtt = await captionRes.text();
  const transcript = vttToPlainText(vtt);
  if (!transcript) {
    throw new TranscriptUnavailableError("字幕データが空でした。");
  }

  return transcript;
}

function vttToPlainText(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const textLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith("WEBVTT") ||
      line.startsWith("Kind:") ||
      line.startsWith("Language:") ||
      /^\d+$/.test(line) ||
      line.includes("-->")
    ) {
      continue;
    }
    const cleaned = line.replace(/<[^>]+>/g, "").trim();
    if (cleaned) textLines.push(cleaned);
  }

  const deduped = textLines.filter((line, i) => line !== textLines[i - 1]);
  return deduped.join(" ").replace(/\s+/g, " ").trim();
}
