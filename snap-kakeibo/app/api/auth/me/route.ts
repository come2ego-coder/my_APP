import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/session";

export async function GET() {
  const jar = await cookies();
  const username = verifySessionCookieValue(jar.get(SESSION_COOKIE_NAME)?.value);
  return NextResponse.json({ username });
}
