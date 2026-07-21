import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserData, setUserData } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/session";

async function requireUser(): Promise<string | null> {
  const jar = await cookies();
  return verifySessionCookieValue(jar.get(SESSION_COOKIE_NAME)?.value);
}

export async function GET() {
  const username = await requireUser();
  if (!username) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }
  const data = await getUserData(username);
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const username = await requireUser();
  if (!username) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { records, templates } = (body ?? {}) as { records?: unknown[]; templates?: unknown[] };
  await setUserData(username, { records: records ?? [], templates: templates ?? [] });
  return NextResponse.json({ ok: true });
}
