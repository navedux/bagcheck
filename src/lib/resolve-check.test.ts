import { describe, expect, it } from "vitest";
import { HAS_SIM_FIXTURE } from "../test/fixture";
import type { CallResult } from "./nansen";
import { ColdGate } from "./cold-gate";
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
  it.skipIf(!HAS_SIM_FIXTURE)("serves featured snapshots without live calls", async () => {
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

  it.skipIf(!HAS_SIM_FIXTURE)("falls back to a stale snapshot when live fails", async () => {
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

  it.skipIf(!HAS_SIM_FIXTURE)("adds a since-you-bought line that can reframe PEPE", async () => {
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

  it.skipIf(!HAS_SIM_FIXTURE)("degrades pre-Mar 11 windows honestly", async () => {
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

  it.skipIf(!HAS_SIM_FIXTURE)("scores the thin fixture as too-thin", async () => {
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

describe("live credit guard", () => {
  const PEPE = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
  const unknown = (n: number) => `0x${n.toString(16).padStart(40, "a")}`;

  function counted(gateLimits?: { perClientPerHour: number; globalPerHour: number }) {
    let calls = 0;
    const flows = async () => {
      calls += 1;
      return ok(stillBidFlows);
    };
    const r = createResolver({
      mode: () => "live",
      getSnapshot,
      flowIntelligence: flows,
      tokenInformation: async () => ok({ symbol: "TKN", stats: liquid }),
      whoBoughtSold: async () => ok([]),
      historicalFlowSummary: async () => ok(stillBidFlows),
      tokenScreener: async () => ok([]),
      getBoard: () => [],
      history: () => [],
      now: () => Date.parse("2026-09-19T12:00:00.000Z"),
      resultTtlMs: () => 900_000,
      gate: gateLimits ? new ColdGate(() => gateLimits) : undefined,
    });
    return { ...r, calls: () => calls };
  }

  it("reuses a finished check instead of calling again", async () => {
    const r = counted();
    await r.resolveCheck("ethereum", unknown(1));
    const after = r.calls();
    await r.resolveCheck("ethereum", unknown(1));
    expect(r.calls()).toBe(after);
  });

  it("shares one request between identical concurrent checks", async () => {
    const r = counted();
    await Promise.all([
      r.resolveCheck("ethereum", unknown(2)),
      r.resolveCheck("ethereum", unknown(2)),
      r.resolveCheck("ethereum", unknown(2)),
    ]);
    expect(r.calls()).toBe(2);
  });

  it("stops a client that streams new tokens", async () => {
    const r = counted({ perClientPerHour: 2, globalPerHour: 100 });
    expect((await r.resolveCheck("ethereum", unknown(3), undefined, { client: "x" })).ok).toBe(true);
    expect((await r.resolveCheck("ethereum", unknown(4), undefined, { client: "x" })).ok).toBe(true);
    const blocked = await r.resolveCheck("ethereum", unknown(5), undefined, { client: "x" });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("expected busy");
    expect(blocked.error.code).toBe("busy");
    expect(r.calls()).toBe(4);
  });

  it.skipIf(!HAS_SIM_FIXTURE)("falls back to the snapshot when a gated token has one", async () => {
    const r = counted({ perClientPerHour: 1, globalPerHour: 1 });
    await r.resolveCheck("ethereum", unknown(6), undefined, { client: "x" });
    const result = await r.resolveCheck("ethereum", PEPE, undefined, { client: "x" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.stale).toBe(true);
  });

  it("stops at token information for an address Nansen does not know", async () => {
    let flowCalls = 0;
    const r = createResolver({
      mode: () => "live",
      getSnapshot,
      flowIntelligence: async () => {
        flowCalls += 1;
        return ok(stillBidFlows);
      },
      tokenInformation: async () =>
        ok({
          symbol: null,
          stats: { ...liquid, volume24hUsd: 0, marketCapUsd: 0, liquidityUsd: 0 },
        }),
      whoBoughtSold: async () => ok([]),
      historicalFlowSummary: async () => ok(stillBidFlows),
      tokenScreener: async () => ok([]),
      getBoard: () => [],
      history: () => [],
      now: () => Date.parse("2026-09-19T12:00:00.000Z"),
    });
    const result = await r.resolveCheck("ethereum", unknown(8));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not found");
    expect(result.error.code).toBe("not_found");
    expect(flowCalls).toBe(0);
  });

  it.skipIf(!HAS_SIM_FIXTURE)("peeks without calling Nansen", () => {
    const r = counted();
    expect(r.peekCheck("ethereum", PEPE)).not.toBeNull();
    expect(r.peekCheck("ethereum", unknown(7))).toBeNull();
    expect(r.calls()).toBe(0);
  });
});

describe("snapshot without daily rows", () => {
  it.skipIf(!HAS_SIM_FIXTURE)("does not invent a since-you-bought read", async () => {
    const snap = getSnapshot("ethereum", "0x6982508145454ce325ddbe47a25d4ec3d2311933");
    if (!snap) throw new Error("fixture missing");
    const r = createResolver({
      mode: () => "snapshot",
      getSnapshot: () => ({ ...snap, daily: [] }),
      flowIntelligence: async () => ok(stillBidFlows),
      tokenInformation: async () => ok({ symbol: "PEPE", stats: liquid }),
      whoBoughtSold: async () => ok([]),
      historicalFlowSummary: async () => ok(stillBidFlows),
      tokenScreener: async () => ok([]),
      getBoard: () => [],
      history: () => [],
      now: () => Date.parse("2026-09-19T12:00:00.000Z"),
    });
    const result = await r.resolveCheck("ethereum", snap.address, "2026-09-01");
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.since).toBeNull();
  });
});

describe("wallet resolver", () => {
  const WALLET = "0x00000000000000000000000000000000000000aa";
  const tokens = Array.from({ length: 8 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "b")}`);

  function walletResolver(opts: { gate?: { perClientPerHour: number; globalPerHour: number } } = {}) {
    let balanceCalls = 0;
    let infoCalls = 0;
    const r = createResolver({
      mode: () => "live",
      getSnapshot: () => null,
      flowIntelligence: async () => ok({ ...stillBidFlows, exchangeNetFlowUsd: 900_000 }),
      tokenInformation: async () => {
        infoCalls += 1;
        return ok({ symbol: "TKN", stats: liquid });
      },
      whoBoughtSold: async () => ok([]),
      historicalFlowSummary: async () => ok(stillBidFlows),
      tokenScreener: async () => ok([]),
      getBoard: () => [],
      history: () => [],
      now: () => Date.parse("2026-09-19T12:00:00.000Z"),
      resultTtlMs: () => 900_000,
      gate: opts.gate ? new ColdGate(() => opts.gate!) : undefined,
      walletBalance: async () => {
        balanceCalls += 1;
        return ok(
          tokens.map((address, i) => ({
            chain: "ethereum" as const,
            address,
            symbol: `T${i}`,
            amount: 1,
            priceUsd: 1,
            valueUsd: 1000 - i,
            native: false,
          })),
        );
      },
    });
    return { ...r, balanceCalls: () => balanceCalls, infoCalls: () => infoCalls };
  }

  it("reads only the top holdings and caches the wallet", async () => {
    const r = walletResolver();
    const first = await r.resolveWallet("evm", WALLET);
    if (!first.ok) throw new Error("expected ok");
    expect(first.data.rows).toHaveLength(8);
    expect(first.data.readCount).toBe(5);
    expect(first.data.rows.slice(0, 5).every((row) => row.verdict === "distribution")).toBe(true);
    expect(first.data.rows.slice(5).every((row) => row.verdict === null)).toBe(true);
    expect(r.infoCalls()).toBe(5);
    await r.resolveWallet("evm", WALLET.toUpperCase().replace("0X", "0x"));
    expect(r.balanceCalls()).toBe(1);
  });

  it("spends one cold unit per wallet and stops a stream of wallets", async () => {
    const r = walletResolver({ gate: { perClientPerHour: 1, globalPerHour: 100 } });
    expect((await r.resolveWallet("evm", WALLET, { client: "x" })).ok).toBe(true);
    const second = await r.resolveWallet("evm", "0x00000000000000000000000000000000000000bb", { client: "x" });
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("expected busy");
    expect(second.error.code).toBe("busy");
    expect(r.balanceCalls()).toBe(1);
  });

  it("reuses a wallet's lean reads for the home list", async () => {
    const r = walletResolver({ gate: { perClientPerHour: 1, globalPerHour: 100 } });
    await r.resolveWallet("evm", WALLET, { client: "x" });
    const before = r.infoCalls();
    const row = await r.resolveWatchRow("ethereum", tokens[0]!, { client: "x" });
    expect(row?.verdict).toBe("distribution");
    expect(r.infoCalls()).toBe(before);
  });

  it("serves only the saved sample wallet outside live mode", async () => {
    const r = createResolver({
      mode: () => "snapshot",
      getSnapshot: () => null,
      flowIntelligence: async () => ok(stillBidFlows),
      tokenInformation: async () => ok({ symbol: "TKN", stats: liquid }),
      whoBoughtSold: async () => ok([]),
      historicalFlowSummary: async () => ok(stillBidFlows),
      tokenScreener: async () => ok([]),
      getBoard: () => [],
      history: () => [],
      now: () => Date.parse("2026-09-19T12:00:00.000Z"),
      getWalletSnapshot: () => null,
    });
    const result = await r.resolveWallet("evm", WALLET);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not in demo");
    expect(result.error.code).toBe("not_in_snapshot");
  });
});

describe("live mode never passes saved reads off as live", () => {
  it("calls Nansen for a featured list row even though a snapshot exists", async () => {
    let calls = 0;
    const PEPE = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
    const r = createResolver({
      mode: () => "live",
      getSnapshot: () => ({
        chain: "ethereum",
        address: PEPE,
        symbol: "PEPE",
        stats: liquid,
        flows1d: stillBidFlows,
        flows1h: null,
        traders: { buyers: [], sellers: [] },
        earlyExit: null,
        daily: [],
      }),
      flowIntelligence: async () => {
        calls += 1;
        return ok({ ...stillBidFlows, smartTraderNetFlowUsd: 0, whaleNetFlowUsd: 0, exchangeNetFlowUsd: 900_000 });
      },
      tokenInformation: async () => ok({ symbol: "PEPE", stats: liquid }),
      whoBoughtSold: async () => ok([]),
      historicalFlowSummary: async () => ok(stillBidFlows),
      tokenScreener: async () => ok([]),
      getBoard: () => [],
      history: () => [],
      now: () => Date.parse("2026-09-19T12:00:00.000Z"),
      resultTtlMs: () => 900_000,
    });
    const row = await r.resolveWatchRow("ethereum", PEPE);
    expect(calls).toBe(1);
    expect(row?.verdict).toBe("distribution");
    expect(row?.stale).toBe(false);
  });

  it("falls back to the saved read, marked stale, when the live read fails", async () => {
    const PEPE = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
    const r = createResolver({
      mode: () => "live",
      getSnapshot,
      flowIntelligence: async () => fail("upstream"),
      tokenInformation: async () => fail("upstream"),
      whoBoughtSold: async () => ok([]),
      historicalFlowSummary: async () => ok(stillBidFlows),
      tokenScreener: async () => ok([]),
      getBoard: () => [],
      history: () => [],
      now: () => Date.parse("2026-09-19T12:00:00.000Z"),
    });
    const row = await r.resolveWatchRow("ethereum", PEPE);
    if (getSnapshot("ethereum", PEPE)) {
      expect(row?.stale).toBe(true);
    } else {
      expect(row).toBeNull();
    }
  });
});
