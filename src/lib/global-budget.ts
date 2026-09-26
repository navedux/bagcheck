/**
 * One daily credit budget shared by every server instance.
 *
 * The in-memory caps (DAILY_CALL_CAP, the cold gate) live inside a single
 * instance: when traffic makes Vercel start more instances, or an instance
 * restarts, each gets a fresh count. This counter lives in Upstash Redis
 * (Vercel's KV), so ten instances still spend at most the cap in a day.
 *
 * Each outbound Nansen call adds its credits to today's total first. Past the
 * cap the call is refused and the credits are handed back. If the store
 * cannot be reached the call is refused too: a store outage must never turn
 * into unbounded spend.
 */

export type BudgetStore = {
  /** Add `n` (may be negative) to `key` and return the new total. */
  incrBy(key: string, n: number): Promise<number>;
  get(key: string): Promise<number>;
};

export type Reservation = "ok" | "spent" | "unverified";

const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;
const SPENT_READ_MS = 30_000;

/** Upstash Redis over its REST API: plain fetch, no client library. */
export function upstashStore(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 1_500,
): BudgetStore {
  const base = url.replace(/\/+$/, "");

  async function run(commands: Array<Array<string | number>>): Promise<unknown[]> {
    const response = await fetchImpl(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands.map((command) => command.map(String))),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`budget_store_${response.status}`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length !== commands.length) {
      throw new Error("budget_store_shape");
    }
    return rows.map((row) => {
      if (!row || typeof row !== "object") throw new Error("budget_store_shape");
      if ("error" in row && row.error) throw new Error("budget_store_error");
      return (row as { result?: unknown }).result;
    });
  }

  return {
    async incrBy(key, n) {
      const [total] = await run([
        ["INCRBY", key, n],
        ["EXPIRE", key, DAY_TTL_SECONDS],
      ]);
      const value = Number(total);
      if (!Number.isFinite(value)) throw new Error("budget_store_shape");
      return value;
    },
    async get(key) {
      const [value] = await run([["GET", key]]);
      if (value === null || value === undefined) return 0;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error("budget_store_shape");
      return parsed;
    },
  };
}

export function createGlobalBudget(options: {
  store: BudgetStore;
  /** Credits allowed per UTC day, across every instance. */
  cap: () => number;
  now: () => number;
  prefix?: string;
}) {
  const prefix = options.prefix ?? "bagcheck:credits";
  let seen: { key: string; at: number; total: number } | null = null;

  function todayKey(): string {
    return `${prefix}:${new Date(options.now()).toISOString().slice(0, 10)}`;
  }

  return {
    /** Take `credits` from today's budget before a call goes out. */
    async reserve(credits: number): Promise<Reservation> {
      const key = todayKey();
      let total: number;
      try {
        total = await options.store.incrBy(key, credits);
      } catch {
        return "unverified";
      }
      seen = { key, at: options.now(), total };
      if (total > options.cap()) {
        try {
          await options.store.incrBy(key, -credits);
        } catch {
          // The overshoot stays counted; that only makes the cap stricter.
        }
        return "spent";
      }
      return "ok";
    },

    /** Hand credits back when a call failed before Nansen charged for it. */
    async refund(credits: number): Promise<void> {
      try {
        await options.store.incrBy(todayKey(), -credits);
      } catch {
        // A missed refund only makes the cap stricter.
      }
    },

    /** Whether today's budget is spent, from a read at most 30 seconds old. */
    async spent(): Promise<boolean> {
      const key = todayKey();
      const now = options.now();
      if (!seen || seen.key !== key || now - seen.at > SPENT_READ_MS) {
        try {
          seen = { key, at: now, total: await options.store.get(key) };
        } catch {
          return false;
        }
      }
      return seen.total >= options.cap();
    },
  };
}

export type GlobalBudget = ReturnType<typeof createGlobalBudget>;
