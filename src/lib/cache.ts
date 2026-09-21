import { createHash } from "node:crypto";

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function cacheKey(parts: unknown): string {
  return createHash("sha256").update(canonicalJson(parts)).digest("hex");
}

export class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string, now: number): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number, now: number): void {
    this.store.set(key, { value, expiresAt: now + ttlMs });
  }
}

/**
 * Cache lifetimes are the credit budget. The chip is a 24h read, so minutes
 * of staleness are free while every cold call costs credits. All TTLs scale
 * off CACHE_TTL_SECONDS (the flows-1d base, default 900s): a cold check
 * costs 7 credits, then nothing for a quarter hour.
 */
export function ttlMs(baseSeconds: number) {
  const base = baseSeconds * 1000;
  return {
    flows1d: base,
    flows1h: Math.min(base, 300_000),
    info: base * 4,
    wbs: base * 2,
    screener: base,
    since: 86_400_000,
  } as const;
}
