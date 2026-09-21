import { env } from "./env";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function allowRequest(key: string, now = Date.now()): boolean {
  const windowMs = 60_000;
  const limit = env.RATE_LIMIT_PER_MIN;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/**
 * Client identity for the in-memory limiter. The leftmost X-Forwarded-For
 * hop is attacker-controlled; prefer the IP Vercel sets, then the rightmost
 * forwarded hop (the one the trusted proxy appended).
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  return "local";
}

export function clientKey(request: Request): string {
  return clientKeyFromHeaders(request.headers);
}
