import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_WALLET_CAPTURE } from "../../data/featured";
import { MemoryCache } from "./cache";
import type { Env } from "./env";
import { Ledger } from "./ledger";
import { createNansenClient } from "./nansen";
import { WALLET_READS, walletRows } from "./wallet";
import type { WalletSnapshot } from "./wallet-snapshot";

/**
 * Sample wallet capture, not a test. Run with:
 *   pnpm refresh-sample-wallet
 *
 * One balance call plus token information and 24h flows for the top
 * holdings (about 11 credits). Writes data/snapshot/wallet.json.
 */
const REFRESH = process.env.REFRESH_WALLET === "1";

function localKey(): string {
  const text = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const line = text.split("\n").find((row) => row.startsWith("NANSEN_API_KEY="));
  const key = line?.slice("NANSEN_API_KEY=".length).trim();
  if (!key) throw new Error("NANSEN_API_KEY missing in .env.local");
  return key;
}

describe("refresh-sample-wallet", () => {
  it.skipIf(!REFRESH)(
    "writes data/snapshot/wallet.json from live Nansen reads",
    async () => {
      const env: Env = {
        DATA_MODE: "live",
        NANSEN_API_KEY: localKey(),
        NANSEN_BASE_URL: "https://api.nansen.ai/api/v1",
        CACHE_TTL_SECONDS: 900,
        RATE_LIMIT_PER_MIN: 30,
        DAILY_CALL_CAP: 60,
        COLD_CHECKS_PER_CLIENT_HOUR: 10,
        COLD_CHECKS_PER_HOUR: 60,
        ALLOWED_ORIGINS: "http://localhost:3000",
      };
      const api = createNansenClient({
        fetch,
        getEnv: () => env,
        cache: new MemoryCache(),
        ledger: new Ledger(true),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
      });
      const { kind, address } = SAMPLE_WALLET_CAPTURE;
      const balance = await api.walletBalance(kind, address);
      if (!balance.ok) throw new Error(`balance failed: ${balance.error.code}`);
      const top = walletRows(balance.data);
      const lean: WalletSnapshot["lean"] = [];
      for (const row of top.slice(0, WALLET_READS)) {
        const [info, flows] = await Promise.all([
          api.tokenInformation(row.chain, row.address),
          api.flowIntelligence(row.chain, row.address, "1d"),
        ]);
        if (!info.ok || !flows.ok) continue;
        lean.push({
          chain: row.chain,
          address: row.address,
          symbol: info.data.symbol ?? row.symbol,
          stats: info.data.stats,
          flows1d: flows.data,
        });
      }
      const snapshot: WalletSnapshot = {
        kind,
        address,
        capturedAt: new Date().toISOString(),
        holdings: top,
        lean,
      };
      const file = path.resolve(process.cwd(), "data/snapshot/wallet.json");
      writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
      console.log(`sample wallet: ${top.length} rows, ${lean.length} read`);
      expect(top.length).toBeGreaterThan(0);
    },
    120_000,
  );
});
