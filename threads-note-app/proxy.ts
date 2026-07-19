import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "app_access";
const PUBLIC_PATHS = ["/login", "/api/login"];

export function proxy(request: NextRequest) {
  const password = process.env.APP_ACCESS_PASSWORD;
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  if (password && request.cookies.get(COOKIE_NAME)?.value === password) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
