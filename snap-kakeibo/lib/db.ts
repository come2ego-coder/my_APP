import { Redis } from "@upstash/redis";

export type StoredUser = {
  username: string;
  passwordHash: string;
};

export type UserData = {
  records: unknown[];
  templates: unknown[];
};

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getUser(username: string): Promise<StoredUser | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string>(`user:${username}`);
  if (!raw) return null;
  return JSON.parse(raw) as StoredUser;
}

export async function createUser(username: string, passwordHash: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("DB not configured");
  await redis.set(`user:${username}`, JSON.stringify({ username, passwordHash }));
}

export async function getUserData(username: string): Promise<UserData> {
  const redis = getRedis();
  if (!redis) return { records: [], templates: [] };
  const raw = await redis.get<string>(`data:${username}`);
  if (!raw) return { records: [], templates: [] };
  const parsed = JSON.parse(raw) as Partial<UserData>;
  return { records: parsed.records ?? [], templates: parsed.templates ?? [] };
}

export async function setUserData(username: string, data: UserData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("DB not configured");
  await redis.set(`data:${username}`, JSON.stringify(data));
}
