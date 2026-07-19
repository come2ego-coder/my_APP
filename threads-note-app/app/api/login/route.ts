import { NextResponse } from "next/server";

const COOKIE_NAME = "app_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

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

  const { password } = (body ?? {}) as { password?: string };
  const correctPassword = process.env.APP_ACCESS_PASSWORD;

  if (!correctPassword) {
    return NextResponse.json(
      { error: "サーバーにAPP_ACCESS_PASSWORDが設定されていません。" },
      { status: 500 },
    );
  }

  if (!password || password !== correctPassword) {
    return NextResponse.json({ error: "パスワードが正しくありません。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, correctPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
