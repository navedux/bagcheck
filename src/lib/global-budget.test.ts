import { describe, expect, it, vi } from "vitest";
import { createGlobalBudget, upstashStore, type BudgetStore } from "./global-budget";

function memoryStore(fail = false): BudgetStore & { values: Map<string, number>; gets: number } {
  const values = new Map<string, number>();
  const store = {
    values,
    gets: 0,
    async incrBy(key: string, n: number) {
      if (fail) throw new Error("down");
      const next = (values.get(key) ?? 0) + n;
      values.set(key, next);
      return next;
    },
    async get(key: string) {
      store.gets += 1;
      if (fail) throw new Error("down");
      return values.get(key) ?? 0;
    },
  };
  return store;
}

const NOON = Date.parse("2026-09-26T12:00:00.000Z");

describe("global credit budget", () => {
  it("lets calls through until the cap, then refuses and hands the credits back", async () => {
    const store = memoryStore();
    const budget = createGlobalBudget({ store, cap: () => 10, now: () => NOON });
    expect(await budget.reserve(7)).toBe("ok");
    expect(await budget.reserve(3)).toBe("ok");
    expect(await budget.reserve(1)).toBe("spent");
    expect(store.values.get("bagcheck:credits:2026-09-26")).toBe(10);
  });

  it("refuses when the store can't be reached, so an outage can't turn into spend", async () => {
    const budget = createGlobalBudget({ store: memoryStore(true), cap: () => 10, now: () => NOON });
    expect(await budget.reserve(1)).toBe("unverified");
  });

  it("refunds credits for calls Nansen never charged", async () => {
    const store = memoryStore();
    const budget = createGlobalBudget({ store, cap: () => 10, now: () => NOON });
    await budget.reserve(5);
    await budget.refund(5);
    expect(store.values.get("bagcheck:credits:2026-09-26")).toBe(0);
  });

  it("counts each UTC day separately", async () => {
    const store = memoryStore();
    let now = NOON;
    const budget = createGlobalBudget({ store, cap: () => 5, now: () => now });
    expect(await budget.reserve(5)).toBe("ok");
    expect(await budget.reserve(1)).toBe("spent");
    now = Date.parse("2026-09-27T00:00:01.000Z");
    expect(await budget.reserve(1)).toBe("ok");
  });

  it("reports spent from a recent read without asking the store every time", async () => {
    const store = memoryStore();
    let now = NOON;
    const budget = createGlobalBudget({ store, cap: () => 5, now: () => now });
    expect(await budget.spent()).toBe(false);
    await store.incrBy("bagcheck:credits:2026-09-26", 5);
    expect(await budget.spent()).toBe(false); // cached for 30 s
    now += 31_000;
    expect(await budget.spent()).toBe(true);
    expect(store.gets).toBe(2);
  });
});

describe("upstash store", () => {
  it("sends INCRBY and EXPIRE as one authenticated pipeline", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([{ result: 12 }, { result: 1 }]), { status: 200 }),
    );
    const store = upstashStore("https://kv.example.upstash.io/", "secret", fetchImpl as unknown as typeof fetch);
    expect(await store.incrBy("k", 5)).toBe(12);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://kv.example.upstash.io/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(JSON.parse(String(init.body))).toEqual([
      ["INCRBY", "k", "5"],
      ["EXPIRE", "k", "172800"],
    ]);
  });

  it("throws on an error row or a bad status, so the budget reads it as unverified", async () => {
    const errorRow = upstashStore(
      "https://kv.example",
      "t",
      (async () => new Response(JSON.stringify([{ error: "WRONGTYPE" }, { result: 1 }]))) as unknown as typeof fetch,
    );
    await expect(errorRow.incrBy("k", 1)).rejects.toThrow();
    const badStatus = upstashStore(
      "https://kv.example",
      "t",
      (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch,
    );
    await expect(badStatus.get("k")).rejects.toThrow();
  });

  it("reads a missing key as zero", async () => {
    const store = upstashStore(
      "https://kv.example",
      "t",
      (async () => new Response(JSON.stringify([{ result: null }]))) as unknown as typeof fetch,
    );
    expect(await store.get("k")).toBe(0);
  });
});
