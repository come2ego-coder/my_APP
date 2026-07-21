import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "snap_kakeibo_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function sign(value: string): string {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSessionCookieValue(username: string): string {
  const payload = `${username}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionCookieValue(cookieValue: string | undefined): string | null {
  if (!cookieValue || !process.env.AUTH_SECRET) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [username, ts, sig] = parts;
  const payload = `${username}.${ts}`;
  const expected = sign(payload);
  if (expected.length !== sig.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const ageSeconds = (Date.now() - Number(ts)) / 1000;
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > SESSION_MAX_AGE) return null;
  return username;
}
