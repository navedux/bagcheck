import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURED } from "../../data/featured";
import { MemoryCache } from "./cache";
import type { Env } from "./env";
import { Ledger } from "./ledger";
import { createNansenClient } from "./nansen";
import type { EarlyExit, TokenSnapshot } from "./types";
import {
  EARLY_WINDOW_DAYS,
  RECENT_SELL_WINDOW_DAYS,
  earlyExitOverlap,
} from "./verdict";
import { deploymentDayOf, earlyWindowFor, last24hRange, recentWindow } from "./window";

/**
 * Live snapshot capture, not a test. Run with:
 *   pnpm refresh-live-snapshot
 *
 * Reads the key from .env.local, calls Nansen once per featured token
 * (about 7 credits each), and writes data/snapshot/live.json. Only the
 * parsed fields are kept: stats, cohort flows, trader addresses and volumes.
 * No labels leave the parser.
 */
const REFRESH = process.env.REFRESH_LIVE === "1";

function localEnv(): Env {
  const file = path.resolve(process.cwd(), ".env.local");
  const vars = Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  if (!vars.NANSEN_API_KEY) throw new Error("NANSEN_API_KEY missing in .env.local");
  return {
    DATA_MODE: "live",
    NANSEN_API_KEY: vars.NANSEN_API_KEY,
    NANSEN_BASE_URL: "https://api.nansen.ai/api/v1",
    CACHE_TTL_SECONDS: 900,
    RATE_LIMIT_PER_MIN: 30,
    DAILY_CALL_CAP: 200,
    COLD_CHECKS_PER_CLIENT_HOUR: 10,
    COLD_CHECKS_PER_HOUR: 60,
    ALLOWED_ORIGINS: "http://localhost:3000",
  };
}

describe("refresh-live-snapshot", () => {
  it.skipIf(!REFRESH)(
    "writes data/snapshot/live.json from live Nansen reads",
    async () => {
      const env = localEnv();
      const api = createNansenClient({
        fetch,
        getEnv: () => env,
        cache: new MemoryCache(),
        ledger: new Ledger(true),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
      });
      const now = new Date();
      const rows: TokenSnapshot[] = [];
      for (const item of FEATURED) {
        const range = last24hRange(now);
        const [info, flows1d, flows1h, buyers, sellers] = await Promise.all([
          api.tokenInformation(item.chain, item.address),
          api.flowIntelligence(item.chain, item.address, "1d"),
          api.flowIntelligence(item.chain, item.address, "1h"),
          api.whoBoughtSold(item.chain, item.address, "BUY", range),
          api.whoBoughtSold(item.chain, item.address, "SELL", range),
        ]);
        if (!info.ok || !flows1d.ok) {
          console.warn(`skip ${item.chain}:${item.address}`);
          continue;
        }
        let earlyExit: EarlyExit | null = null;
        const deployDay = deploymentDayOf(info.data.stats.tokenDeploymentDate);
        if (deployDay) {
          const [early, recent] = await Promise.all([
            api.whoBoughtSold(
              item.chain,
              item.address,
              "BUY",
              earlyWindowFor(deployDay, EARLY_WINDOW_DAYS),
              50,
            ),
            api.whoBoughtSold(
              item.chain,
              item.address,
              "SELL",
              recentWindow(now, RECENT_SELL_WINDOW_DAYS),
              10,
            ),
          ]);
          if (early.ok && recent.ok && early.data.length > 0 && recent.data.length > 0) {
            earlyExit = earlyExitOverlap(item.chain, early.data, recent.data);
          }
        }
        rows.push({
          chain: item.chain,
          address: item.address,
          symbol: info.data.symbol ?? "TOKEN",
          stats: info.data.stats,
          flows1d: flows1d.data,
          flows1h: flows1h.ok ? flows1h.data : null,
          traders: {
            buyers: buyers.ok ? buyers.data : [],
            sellers: sellers.ok ? sellers.data : [],
          },
          earlyExit,
          daily: [],
        });
      }
      const file = path.resolve(process.cwd(), "data/snapshot/live.json");
      writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
      console.log(`live snapshot: ${rows.length}/${FEATURED.length} tokens, captured ${now.toISOString()}`);
      expect(rows.length).toBeGreaterThan(0);
    },
    180_000,
  );
});
