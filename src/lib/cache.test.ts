import { describe, expect, it } from "vitest";
import { MemoryCache, cacheKey, canonicalJson } from "./cache";

describe("cache", () => {
  it("hashes canonical JSON so key order does not matter", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(cacheKey({ path: "a", body: { z: 1, a: 2 } })).toBe(
      cacheKey({ body: { a: 2, z: 1 }, path: "a" }),
    );
  });

  it("expires entries after ttl", () => {
    const cache = new MemoryCache();
    cache.set("k", 1, 100, 0);
    expect(cache.get<number>("k", 50)).toBe(1);
    expect(cache.get<number>("k", 100)).toBeUndefined();
  });
});
