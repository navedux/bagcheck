import { describe, expect, it } from "vitest";
import type { CallResult } from "./nansen";
import { createResolver } from "./resolve-check";
import { getSnapshot } from "./snapshot";
import type {
  Chain,
  CohortFlows,
  DataMode,
  TokenStats,
  TraderPrint,
} from "./types";

function ok<T>(data: T): CallResult<T> {
  return { ok: true, data, cacheHit: false };
}

function fail(code: "upstream" | "not_found" | "auth"): CallResult<never> {
  return { ok: false, error: { code, path: "tgm/flow-intelligence", status: 500 } };
}

const stillBidFlows: CohortFlows = {
  smartTraderNetFlowUsd: 50000,
  whaleNetFlowUsd: 10000,
  publicFigureNetFlowUsd: 0,
  exchangeNetFlowUsd: 8000,
  freshWalletsNetFlowUsd: 5000,
};

const liquid: TokenStats = {
  volume24hUsd: 1_000_000,
  marketCapUsd: 50_000_000,
  liquidityUsd: 800_000,
  totalHolders: 12_000,
  tokenDeploymentDate: "2020-12-01",
};

function resolver(overrides: {
  mode?: DataMode;
  info?: CallResult<{ symbol: string | null; stats: TokenStats }>;
  flows1d?: CallResult<CohortFlows>;
  flows1h?: CallResult<CohortFlows>;
  buyers?: CallResult<TraderPrint[]>;
  sellers?: CallResult<TraderPrint[]>;
  historical?: CallResult<CohortFlows>;
}) {
  return createResolver({
    mode: () => overrides.mode ?? "snapshot",
    getSnapshot,
    flowIntelligence: async (_c: Chain, _a: string, timeframe) =>
      timeframe === "1h"
        ? (overrides.flows1h ?? ok(stillBidFlows))
        : (overrides.flows1d ?? ok(stillBidFlows)),
    tokenInformation: async () => overrides.info ?? ok({ symbol: "WSOL", stats: liquid }),
    whoBoughtSold: async (_c, _a, side) =>
      side === "BUY"
        ? (overrides.buyers ?? ok([]))
        : (overrides.sellers ?? ok([])),
    historicalFlowSummary: async () => overrides.historical ?? ok(stillBidFlows),
    tokenScreener: async () => ok([]),
    getBoard: () => [],
    history: () => [],
    now: () => Date.parse("2026-09-19T12:00:00.000Z"),
  });
}

describe("resolveCheck", () => {
  it("serves featured snapshots without live calls", async () => {
    const { resolveCheck } = resolver({ mode: "snapshot" });
    const result = await resolveCheck(
      "solana",
      "So11111111111111111111111111111111111111112",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.verdict).toBe("still-bid");
    expect(result.data.source).toBe("snapshot");
    expect(result.data.stale).toBe(false);
  });

  it("returns the public empty state for an unknown snapshot token", async () => {
    const { resolveCheck } = resolver({ mode: "snapshot" });
    const result = await resolveCheck(
      "ethereum",
      "0x0000000000000000000000000000000000000001",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected miss");
    expect(result.error.code).toBe("not_in_snapshot");
  });

  it("returns a live chip for an unknown token when Nansen answers", async () => {
    const { resolveCheck } = resolver({ mode: "live" });
    const result = await resolveCheck(
      "ethereum",
      "0x0000000000000000000000000000000000000001",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.source).toBe("live");
    expect(result.data.verdict).toBe("still-bid");
  });

  it("falls back to a stale snapshot when live fails", async () => {
    const { resolveCheck } = resolver({
      mode: "live",
      info: fail("upstream"),
      flows1d: fail("upstream"),
    });
    const result = await resolveCheck(
      "solana",
      "So11111111111111111111111111111111111111112",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.source).toBe("snapshot");
    expect(result.data.stale).toBe(true);
    expect(result.data.verdict).toBe("still-bid");
  });

  it("adds a since-you-bought line that can reframe PEPE", async () => {
    const { resolveCheck } = resolver({ mode: "snapshot" });
    const day = await resolveCheck(
      "ethereum",
      "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    );
    const since = await resolveCheck(
      "ethereum",
      "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      "2026-08-03",
    );
    expect(day.ok && day.data.verdict).toBe("distribution");
    expect(since.ok && since.data.verdict).toBe("distribution");
    if (!since.ok || !since.data.since) throw new Error("expected since");
    // The window reframes the day read: distribution today, quiet all window.
    expect(since.data.since.verdict).toBe("quiet");
    expect(since.data.since.verdict).not.toBe(since.data.verdict);
    expect(since.data.since.partialCoverage).toBe(false);
    expect(since.data.since.line).toContain("Aug 3");
  });

  it("degrades pre-Mar 11 windows honestly", async () => {
    const { resolveCheck } = resolver({ mode: "snapshot" });
    const result = await resolveCheck(
      "ethereum",
      "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      "2024-12-01",
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !result.data.since) throw new Error("expected since");
    expect(result.data.since.partialCoverage).toBe(true);
    expect(result.data.since.breakdown.ex).toBe(0);
  });

  it("scores the thin fixture as too-thin", async () => {
    const { resolveCheck } = resolver({ mode: "snapshot" });
    const result = await resolveCheck(
      "ethereum",
      "0x1111111111111111111111111111111111111111",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.verdict).toBe("too-thin");
  });
});
