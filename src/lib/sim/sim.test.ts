import { describe, expect, it } from "vitest";
import { FEATURED } from "../../../data/featured";
import { SIM_TOKENS } from "../../../data/sim-tokens";
import { createResolver } from "../resolve-check";
import { getBoardSnapshot, getSnapshot } from "../snapshot";
import { scoreVerdict } from "../verdict";
import type { Chain, Verdict } from "../types";
import { createSimClient, simHistory } from "./client";
import {
  dailyFlows,
  dayIndexOf,
  dayVolumeUsd,
  profileFor,
  regimeAt,
} from "./regime";

const NOW = Date.parse("2026-09-19T12:00:00.000Z");
const TODAY = dayIndexOf(NOW);

function simResolver(now = NOW) {
  const client = createSimClient({ now: () => now });
  return createResolver({
    mode: () => "sim",
    getSnapshot,
    getBoard: getBoardSnapshot,
    flowIntelligence: client.flowIntelligence,
    tokenInformation: client.tokenInformation,
    whoBoughtSold: client.whoBoughtSold,
    historicalFlowSummary: client.historicalFlowSummary,
    tokenScreener: client.tokenScreener,
    history: (chain, address, at) => simHistory(chain, address, at.getTime()),
    now: () => now,
  });
}

describe("sim client", () => {
  it("anchors WSOL to the Sep 19 live volume scale", async () => {
    const client = createSimClient({ now: () => NOW });
    const info = await client.tokenInformation(
      "solana",
      "So11111111111111111111111111111111111111112",
    );
    if (!info.ok) throw new Error("info failed");
    expect(info.data.stats.volume24hUsd).toBeGreaterThan(3_000_000_000);
    expect(info.data.stats.liquidityUsd).toBe(0);
  });

  it("is deterministic for the same token and day", async () => {
    const a = createSimClient({ now: () => NOW });
    const b = createSimClient({ now: () => NOW });
    const first = await a.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    const second = await b.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    expect(first).toEqual(second);
  });

  it("produces different flows on different days", async () => {
    const earlier = createSimClient({
      now: () => NOW - 86_400_000,
    });
    const later = createSimClient({ now: () => NOW });
    const a = await earlier.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    const b = await later.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    expect(a).not.toEqual(b);
  });

  it("serves a stable early-buyer pool that recent sellers overlap", async () => {
    const client = createSimClient({ now: () => NOW });
    // PEPE is scripted into a distribution segment at this epoch.
    const pepe = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
    const info = await client.tokenInformation("ethereum", pepe);
    if (!info.ok) throw new Error("info failed");
    const deployDay = info.data.stats.tokenDeploymentDate;
    if (!deployDay) throw new Error("no deployment date");

    const early = await client.whoBoughtSold("ethereum", pepe, "BUY", {
      from: deployDay,
      to: deployDay,
    }, 50);
    const recent = await client.whoBoughtSold("ethereum", pepe, "SELL", {
      from: "2026-09-12",
      to: "2026-09-19",
    }, 10);
    if (!early.ok || !recent.ok) throw new Error("wbs failed");

    // The pool is stable across calls.
    const again = await client.whoBoughtSold("ethereum", pepe, "BUY", {
      from: deployDay,
      to: deployDay,
    }, 50);
    if (!again.ok) throw new Error("wbs failed");
    expect(again.data.map((row) => row.address)).toEqual(
      early.data.map((row) => row.address),
    );

    // In a distribution regime, some top sellers are early buyers.
    const pool = new Set(early.data.map((row) => row.address));
    const overlap = recent.data.filter((row) => pool.has(row.address)).length;
    expect(overlap).toBeGreaterThan(0);
  });

  it("sums real daily flows over a holding window", async () => {
    const client = createSimClient({ now: () => NOW });
    const chain: Chain = "ethereum";
    const address = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const registry = SIM_TOKENS.find(
      (row) => row.chain === chain && row.address === address,
    );
    if (!registry) throw new Error("expected WETH in registry");

    const result = await client.historicalFlowSummary(
      chain,
      address,
      { from: "2026-09-10", to: "2026-09-19" },
      "2026-09-10",
    );
    if (!result.ok) throw new Error("expected ok");

    const seed = `${chain}:${address}`;
    const profile = profileFor(seed, {
      symbol: registry.symbol,
      script: registry.script,
      market: registry.market,
    });
    let expected = 0;
    for (
      let day = dayIndexOf(Date.parse("2026-09-10"));
      day <= dayIndexOf(Date.parse("2026-09-19"));
      day += 1
    ) {
      expected += dailyFlows(profile, seed, day).smartTraderNetFlowUsd;
    }
    expect(result.data.smartTraderNetFlowUsd).toBe(expected);
    expect(result.data.smartTraderNetFlowUsd).not.toBe(0);
  });

  it("zeroes uncovered cohorts before label coverage start", async () => {
    const client = createSimClient({ now: () => NOW });
    const result = await client.historicalFlowSummary(
      "ethereum",
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      { from: "2024-12-01", to: "2024-12-20" },
      "2024-12-01",
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.whaleNetFlowUsd).toBe(0);
    expect(result.data.exchangeNetFlowUsd).toBe(0);
    expect(result.data.publicFigureNetFlowUsd).toBeNull();
  });
});

describe("sim resolver", () => {
  it("matches every featured token's expected verdict today", async () => {
    const { resolveCheck } = simResolver();
    for (const item of FEATURED) {
      const result = await resolveCheck(item.chain, item.address);
      if (!result.ok) throw new Error(`expected ok for ${item.address}`);
      expect(result.data.verdict).toBe(item.expectedVerdict);
      expect(result.data.source).toBe("sim");
    }
  });

  it("shows at least three distinct chips across the featured set", async () => {
    const { listFeaturedChecked } = simResolver();
    const rows = await listFeaturedChecked();
    const verdicts = new Set(rows.map((row) => row.verdict));
    expect(verdicts.size).toBeGreaterThanOrEqual(3);
  });

  it("resolves any pasted address, not just the featured set", async () => {
    const { resolveCheck } = simResolver();
    const result = await resolveCheck(
      "ethereum",
      "0x00000000000000000000000000000000deadbeef",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.symbol).toMatch(/^[A-Z]{4}$/);
    expect(result.data.source).toBe("sim");
  });

  it("keeps the floor fixture too-thin", async () => {
    const { resolveCheck } = simResolver();
    const result = await resolveCheck(
      "ethereum",
      "0x1111111111111111111111111111111111111111",
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.verdict).toBe("too-thin");
  });

  it("produces verdict variety over 60 days of featured history", () => {
    const seen = new Set<Verdict>();
    for (const token of SIM_TOKENS) {
      const seed = `${token.chain}:${token.address}`;
      const profile = profileFor(seed, {
        symbol: token.symbol,
        script: token.script,
        thin: token.thin,
        market: token.market,
      });
      for (let day = TODAY - 59; day <= TODAY; day += 1) {
        const stats = {
          volume24hUsd: dayVolumeUsd(profile, seed, day),
          marketCapUsd: profile.marketCapUsd,
          liquidityUsd: profile.liquidityUsd,
          totalHolders: profile.totalHolders,
          tokenDeploymentDate: null,
        };
        const { verdict } = scoreVerdict(stats, dailyFlows(profile, seed, day));
        seen.add(verdict);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("keeps each scripted regime stable within its segment", () => {
    const expected: Record<string, Verdict> = {
      accumulation: "still-bid",
      distribution: "distribution",
      retail: "retail-pump",
      split: "split",
      quiet: "quiet",
    };
    for (const token of SIM_TOKENS) {
      if (token.thin) continue;
      const seed = `${token.chain}:${token.address}`;
      const profile = profileFor(seed, {
        symbol: token.symbol,
        script: token.script,
        market: token.market,
      });
      for (let day = TODAY - 89; day <= TODAY; day += 1) {
        const regime = regimeAt(profile, seed, day);
        const stats = {
          volume24hUsd: dayVolumeUsd(profile, seed, day),
          marketCapUsd: profile.marketCapUsd,
          liquidityUsd: profile.liquidityUsd,
          totalHolders: profile.totalHolders,
          tokenDeploymentDate: null,
        };
        const { verdict } = scoreVerdict(stats, dailyFlows(profile, seed, day));
        expect(verdict, `${token.symbol} day ${day} regime ${regime}`).toBe(
          expected[regime],
        );
      }
    }
  });
});

describe("sim board", () => {
  it("serves a ranked board with verdicts, deterministic within a day", async () => {
    const a = simResolver();
    const b = simResolver();
    const [boardA, boardB] = await Promise.all([a.listBoard(), b.listBoard()]);
    expect(boardA).toEqual(boardB);
    expect(boardA.length).toBeGreaterThan(0);
    expect(boardA.length).toBeLessThanOrEqual(12);
    for (let i = 1; i < boardA.length; i += 1) {
      expect(Math.abs(boardA[i]!.shift)).toBeLessThanOrEqual(
        Math.abs(boardA[i - 1]!.shift) + 1e-9,
      );
    }
    for (const row of boardA) {
      expect(row.verdict).not.toBe("too-thin");
      expect(row.symbol.length).toBeGreaterThan(0);
    }
  });

  it("churns movers across days", async () => {
    const today = await simResolver().listBoard();
    const tomorrow = await simResolver(NOW + 86_400_000).listBoard();
    const key = (rows: typeof today) =>
      rows.map((row) => `${row.chain}:${row.address}`).join(",");
    expect(key(today)).not.toBe(key(tomorrow));
  });

  it("bakes a non-empty board into the snapshot", () => {
    const baked = getBoardSnapshot();
    expect(baked.length).toBeGreaterThan(0);
    for (const row of baked) {
      expect(Math.abs(row.shift)).toBeGreaterThan(0);
    }
  });
});
