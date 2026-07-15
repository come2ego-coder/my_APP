const API_BASE = process.env.TYPEFULLY_API_BASE || "https://api.typefully.com";
const PLATFORM_KEY = process.env.TYPEFULLY_PLATFORM_KEY || "threads";

// Creates a DRAFT only (never publishes). publish_at is fixed to "next-free-slot"
// so Typefully just slots it into the next open queue spot; the user still has to
// open Typefully and confirm/publish it manually.
export async function createDraft({ content, socialSetId, apiKey }) {
  const url = `${API_BASE}/v2/social-sets/${socialSetId}/drafts`;

  const body = {
    platforms: {
      [PLATFORM_KEY]: {
        enabled: true,
        posts: [{ text: content }],
      },
    },
    publish_at: "next-free-slot",
    share: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!res.ok) {
    const message = data?.error || data?.message || rawText || `HTTP ${res.status}`;
    throw new Error(`Typefully APIエラー (${res.status}): ${message}`);
  }

  return data;
}
