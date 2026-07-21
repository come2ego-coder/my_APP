import { NextResponse } from "next/server";
import { getUser, isDbConfigured } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(request: Request) {
  if (!isDbConfigured() || !process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "サーバー保存が設定されていません。管理者に設定を依頼してください。" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { username, password } = (body ?? {}) as { username?: string; password?: string };
  const name = (username ?? "").trim();
  const user = await getUser(name);

  if (!user || !password || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "IDまたはパスワードが違います。" }, { status: 401 });
  }

  const res = NextResponse.json({ username: name });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
