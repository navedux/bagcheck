import { ON_VERCEL, env } from "./env";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function allowRequest(key: string, now = Date.now()): boolean {
  const windowMs = 60_000;
  const limit = env.RATE_LIMIT_PER_MIN;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/**
 * Client identity for the in-memory limiter and the cold-check gate. The
 * leftmost X-Forwarded-For hop is attacker-controlled. On Vercel, trust the
 * IP Vercel sets. Anywhere else a client can send `x-vercel-forwarded-for`
 * itself and rotate identities, so it is ignored there.
 */
export function clientKeyFromHeaders(headers: Headers, onVercel = ON_VERCEL): string {
  if (onVercel) {
    const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (vercel) return vercel;
  }
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

export function clientKey(request: Request, onVercel = ON_VERCEL): string {
  return clientKeyFromHeaders(request.headers, onVercel);
}
