import { Redis } from "@upstash/redis";

const DEFAULT_DAILY_LIMIT = 100;

export async function checkDailyLimit(
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return { ok: true };
  }

  const limit = Number(process.env.DAILY_GENERATION_LIMIT) || DEFAULT_DAILY_LIMIT;
  const redis = new Redis({ url, token });
  const today = new Date().toISOString().slice(0, 10);
  const redisKey = `${key}:${today}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, 60 * 60 * 24 * 2);
  }

  if (count > limit) {
    return {
      ok: false,
      error: "本日の利用回数の上限に達しました。日本時間の深夜0時にリセットされます。",
    };
  }

  return { ok: true };
}
