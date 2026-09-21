import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIM_TOKENS } from "../../../data/sim-tokens";
import { CHAINS, type BoardRow } from "../types";
import {
  EARLY_WINDOW_DAYS,
  RECENT_SELL_WINDOW_DAYS,
  earlyExitOverlap,
  flowShift,
  scoreVerdict,
} from "../verdict";
import { deploymentDayOf, earlyWindowFor, recentWindow } from "../window";
import type { EarlyExit } from "../types";
import { createSimClient, simDaily } from "./client";

/**
 * Snapshot generator, not a test. Run with:
 *   pnpm refresh-snapshot
 *
 * Bakes the simulator's world at SNAPSHOT_EPOCH into data/snapshot/tokens.json:
 * today's stats, flows and traders, plus 90 days of daily flows so snapshot
 * mode can render history strips and since-you-bought windows from real rows.
 * The epoch is frozen so the committed fixture and the test suite stay stable;
 * re-baking always reproduces the same file.
 */
const REFRESH = process.env.REFRESH_SNAPSHOT === "1";
const SNAPSHOT_EPOCH = Date.parse("2026-09-19T12:00:00.000Z");

describe("refresh-snapshot", () => {
  it.skipIf(!REFRESH)(
    "writes data/snapshot/tokens.json from the sim at the frozen epoch",
    async () => {
      const client = createSimClient({ now: () => SNAPSHOT_EPOCH });
      const rows = [];
      for (const token of SIM_TOKENS) {
        const info = await client.tokenInformation(token.chain, token.address);
        const flows1d = await client.flowIntelligence(token.chain, token.address, "1d");
        const flows1h = await client.flowIntelligence(token.chain, token.address, "1h");
        const buyers = await client.whoBoughtSold(token.chain, token.address, "BUY");
        const sellers = await client.whoBoughtSold(token.chain, token.address, "SELL");
        if (!info.ok || !flows1d.ok || !flows1h.ok || !buyers.ok || !sellers.ok) {
          throw new Error(`sim failed for ${token.symbol}`);
        }
        const deployDay = deploymentDayOf(info.data.stats.tokenDeploymentDate);
        let earlyExit: EarlyExit | null = null;
        if (deployDay) {
          const early = earlyWindowFor(deployDay, EARLY_WINDOW_DAYS);
          const recent = recentWindow(new Date(SNAPSHOT_EPOCH), RECENT_SELL_WINDOW_DAYS);
          const [earlyBuyers, recentSellers] = await Promise.all([
            client.whoBoughtSold(token.chain, token.address, "BUY", early, 50),
            client.whoBoughtSold(token.chain, token.address, "SELL", recent, 10),
          ]);
          if (earlyBuyers.ok && recentSellers.ok) {
            earlyExit = earlyExitOverlap(token.chain, earlyBuyers.data, recentSellers.data);
          }
        }
        rows.push({
          chain: token.chain,
          address: token.address,
          symbol: token.symbol,
          stats: info.data.stats,
          flows1d: flows1d.data,
          flows1h: flows1h.data,
          traders: { buyers: buyers.data, sellers: sellers.data },
          earlyExit,
          daily: simDaily(token.chain, token.address, SNAPSHOT_EPOCH, 90),
        });
      }
      const file = path.resolve(process.cwd(), "data/snapshot/tokens.json");
      await writeFile(file, `${JSON.stringify(rows, null, 2)}\n`);

      // The Today board, baked the same way: sim screener ranked by shift.
      const screener = await client.tokenScreener([...CHAINS]);
      if (!screener.ok) throw new Error("sim screener failed");
      const boardRows: BoardRow[] = [];
      const candidates = screener.data
        .filter((row) => row.volumeUsd >= 1_000_000)
        .sort(
          (a, b) =>
            Math.abs(flowShift(b.netflowUsd, b.volumeUsd)) -
            Math.abs(flowShift(a.netflowUsd, a.volumeUsd)),
        )
        .slice(0, 12);
      for (const candidate of candidates) {
        const info = await client.tokenInformation(candidate.chain, candidate.address);
        const flows = await client.flowIntelligence(candidate.chain, candidate.address, "1d");
        if (!info.ok || !flows.ok) continue;
        boardRows.push({
          chain: candidate.chain,
          address: candidate.address,
          symbol: candidate.symbol,
          volumeUsd: candidate.volumeUsd,
          netflowUsd: candidate.netflowUsd,
          shift: flowShift(candidate.netflowUsd, candidate.volumeUsd),
          verdict: scoreVerdict(info.data.stats, flows.data).verdict,
        });
      }
      const boardFile = path.resolve(process.cwd(), "data/snapshot/board.json");
      await writeFile(boardFile, `${JSON.stringify(boardRows, null, 2)}\n`);

      expect(rows.length).toBe(SIM_TOKENS.length);
      expect(boardRows.length).toBeGreaterThan(0);
    },
  );
});
