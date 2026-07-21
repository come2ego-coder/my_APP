import { NextResponse } from "next/server";
import { createUser, getUser, isDbConfigured, setUserData } from "@/lib/db";
import { hashPassword } from "@/lib/password";
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

  const { username, password, records, templates } = (body ?? {}) as {
    username?: string;
    password?: string;
    records?: unknown[];
    templates?: unknown[];
  };

  const name = (username ?? "").trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) {
    return NextResponse.json(
      { error: "IDは半角英数字とアンダースコアで3〜32文字にしてください。" },
      { status: 400 },
    );
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "パスワードは6文字以上にしてください。" }, { status: 400 });
  }

  const existing = await getUser(name);
  if (existing) {
    return NextResponse.json({ error: "そのIDはすでに使われています。" }, { status: 409 });
  }

  await createUser(name, hashPassword(password));
  await setUserData(name, { records: records ?? [], templates: templates ?? [] });

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
