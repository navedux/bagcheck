import { describe, expect, it } from "vitest";
import { HAS_SIM_FIXTURE } from "../test/fixture";
import { FEATURED, TRY_TOKENS } from "../../data/featured";
import { getSnapshot } from "./snapshot";
import type {
  CohortFlows,
  Signal,
  TokenStats,
  TraderPrint,
  Verdict,
  VerdictDay,
} from "./types";
import {
  T,
  T_QUIET,
  UNTRACKED_LIQUIDITY_VOLUME_FLOOR_USD,
  EARLY_WINDOW_DAYS,
  RECENT_SELL_WINDOW_DAYS,
  earlyExitOverlap,
  flipCount,
  flowBridge,
  flowShift,
  runLengthDays,
  scoreVerdict,
  signalFor,
} from "./verdict";

const liquid: TokenStats = {
  volume24hUsd: 1_000_000,
  marketCapUsd: 10_000_000,
  liquidityUsd: 500_000,
  totalHolders: 1000,
  tokenDeploymentDate: "2024-01-01",
};

const zeroFlows: CohortFlows = {
  smartTraderNetFlowUsd: 0,
  whaleNetFlowUsd: 0,
  publicFigureNetFlowUsd: 0,
  exchangeNetFlowUsd: 0,
  freshWalletsNetFlowUsd: 0,
};

describe("scoreVerdict", () => {
  it("returns too-thin before scoring when liquidity is under the floor", () => {
    const result = scoreVerdict(
      { ...liquid, liquidityUsd: 24_999 },
      { ...zeroFlows, smartTraderNetFlowUsd: 200_000 },
    );
    expect(result.verdict).toBe("too-thin");
  });

  it("returns too-thin when 24h volume is under the floor", () => {
    const result = scoreVerdict({ ...liquid, volume24hUsd: 9_999 }, zeroFlows);
    expect(result.verdict).toBe("too-thin");
  });

  it("scores wrapped-native style tokens with untracked liquidity on volume alone", () => {
    // Live Sep 19: WSOL reported liquidity_usd 0 with $4.8B 24h volume.
    const result = scoreVerdict(
      { ...liquid, liquidityUsd: 0, volume24hUsd: 4_800_000_000 },
      { ...zeroFlows, smartTraderNetFlowUsd: 900_000_000 },
    );
    expect(result.verdict).not.toBe("too-thin");
  });

  it("still floors untracked-liquidity tokens on a stricter volume bar", () => {
    const result = scoreVerdict(
      { ...liquid, liquidityUsd: 0, volume24hUsd: UNTRACKED_LIQUIDITY_VOLUME_FLOOR_USD - 1 },
      zeroFlows,
    );
    expect(result.verdict).toBe("too-thin");
  });

  it("returns still-bid when bid clears T and dist stays small", () => {
    const result = scoreVerdict(liquid, {
      ...zeroFlows,
      smartTraderNetFlowUsd: 50_000,
      whaleNetFlowUsd: 10_000,
      exchangeNetFlowUsd: 8_000,
    });
    expect(result.breakdown.bid).toBeGreaterThanOrEqual(T);
    expect(result.verdict).toBe("still-bid");
  });

  it("returns retail-pump when fresh wallets dominate", () => {
    const result = scoreVerdict(liquid, {
      ...zeroFlows,
      freshWalletsNetFlowUsd: 80_000,
      smartTraderNetFlowUsd: 5_000,
    });
    expect(result.verdict).toBe("retail-pump");
  });

  it("returns retail-pump when fresh wallets outsize a real bid", () => {
    // Live Sep 19: PEPE had retail at 0.81 of volume with bid at 0.075.
    // Both large still means retail-led; quiet would be a credibility bug.
    const result = scoreVerdict(liquid, {
      ...zeroFlows,
      freshWalletsNetFlowUsd: 810_000,
      smartTraderNetFlowUsd: 25_000,
    });
    expect(result.verdict).toBe("retail-pump");
  });

  it("returns distribution when exchange load clears T", () => {
    const result = scoreVerdict(liquid, {
      ...zeroFlows,
      exchangeNetFlowUsd: 90_000,
    });
    expect(result.breakdown.dist).toBeGreaterThanOrEqual(T);
    expect(result.verdict).toBe("distribution");
  });

  it("returns distribution when traders exit and exchanges load", () => {
    const result = scoreVerdict(liquid, {
      ...zeroFlows,
      smartTraderNetFlowUsd: -80_000,
      exchangeNetFlowUsd: 20_000,
    });
    expect(result.verdict).toBe("distribution");
  });

  it("returns split when traders and whales disagree above T/2", () => {
    const result = scoreVerdict(liquid, {
      ...zeroFlows,
      smartTraderNetFlowUsd: 40_000,
      whaleNetFlowUsd: -80_000,
    });
    expect(result.verdict).toBe("split");
  });

  it("returns quiet when every normalized flow is below T_quiet", () => {
    const result = scoreVerdict(liquid, {
      ...zeroFlows,
      smartTraderNetFlowUsd: 2_000,
      exchangeNetFlowUsd: 1_000,
    });
    expect(Math.abs(result.breakdown.st)).toBeLessThan(T_QUIET);
    expect(result.verdict).toBe("quiet");
  });

  it.skipIf(!HAS_SIM_FIXTURE)("scores the thin fixture as too-thin", () => {
    const snapshot = getSnapshot(
      "ethereum",
      "0x1111111111111111111111111111111111111111",
    );
    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error("missing thin fixture");
    expect(scoreVerdict(snapshot.stats, snapshot.flows1d).verdict).toBe("too-thin");
  });

  it("maps every verdict for looking and holding", () => {
    const looking: Record<Verdict, Signal> = {
      "still-bid": "buy",
      "retail-pump": "wait",
      distribution: "dont-buy",
      split: "wait",
      quiet: "wait",
      "too-thin": "no-read",
    };
    const holding: Record<Verdict, Signal> = {
      "still-bid": "hold",
      "retail-pump": "hold",
      distribution: "sell",
      split: "wait",
      quiet: "hold",
      "too-thin": "no-read",
    };
    for (const verdict of Object.keys(looking) as Verdict[]) {
      expect(signalFor(verdict, false)).toBe(looking[verdict]);
      expect(signalFor(verdict, true)).toBe(holding[verdict]);
    }
  });

  it.skipIf(!HAS_SIM_FIXTURE)("gives the featured snapshots their expected chips", () => {
    expect(FEATURED).toHaveLength(10);
    const verdicts = FEATURED.map((item) => {
      const snapshot = getSnapshot(item.chain, item.address);
      expect(snapshot).not.toBeNull();
      if (!snapshot) throw new Error("missing snapshot");
      const scored = scoreVerdict(snapshot.stats, snapshot.flows1d);
      expect(scored.verdict).toBe(item.expectedVerdict);
      return scored.verdict;
    });
    expect(new Set(verdicts).size).toBeGreaterThanOrEqual(3);
  });

  it("keeps first-visit starters inside the featured set", () => {
    for (const starter of TRY_TOKENS) {
      expect(
        FEATURED.some(
          (item) => item.chain === starter.chain && item.address === starter.address,
        ),
      ).toBe(true);
    }
    expect(new Set(TRY_TOKENS.map((item) => item.expectedVerdict)).size).toBe(3);
  });
});

describe("history stability", () => {
  const days = (verdicts: Verdict[]): VerdictDay[] =>
    verdicts.map((verdict, i) => ({
      day: `2026-09-${String(i + 1).padStart(2, "0")}`,
      verdict,
    }));

  it("counts the current run back from the newest day", () => {
    const history = days(["quiet", "quiet", "distribution", "distribution", "distribution"]);
    expect(runLengthDays(history)).toBe(3);
  });

  it("is 1 when the read flipped today and 0 with no history", () => {
    expect(runLengthDays(days(["quiet", "distribution"]))).toBe(1);
    expect(runLengthDays([])).toBe(0);
  });

  it("counts flips across the window", () => {
    expect(flipCount(days(["quiet", "quiet", "distribution", "still-bid"]))).toBe(2);
    expect(flipCount(days(["quiet", "quiet"]))).toBe(0);
    expect(flipCount([])).toBe(0);
  });
});

describe("earlyExitOverlap", () => {
  const print = (address: string): TraderPrint => ({
    address,
    boughtVolumeUsd: 1000,
    soldVolumeUsd: 1000,
  });

  it("counts recent sellers found in the early pool", () => {
    const early = [print("0xAAA"), print("0xBBB"), print("0xCCC")];
    const sellers = [print("0xaaa"), print("0xDDD")];
    const result = earlyExitOverlap("ethereum", early, sellers);
    expect(result.overlap).toBe(1);
    expect(result.sellers).toBe(2);
    expect(result.earlyBuyers).toBe(3);
    expect(result.windowDays).toBe(RECENT_SELL_WINDOW_DAYS);
    expect(result.earlyDays).toBe(EARLY_WINDOW_DAYS);
  });

  it("keeps solana addresses case-sensitive", () => {
    const early = [print("SoLanaABC")];
    const sellers = [print("solanaabc")];
    expect(earlyExitOverlap("solana", early, sellers).overlap).toBe(0);
    expect(earlyExitOverlap("solana", early, [print("SoLanaABC")]).overlap).toBe(1);
  });

  it("reports zero overlap honestly", () => {
    const result = earlyExitOverlap("base", [print("0xAAA")], [print("0xDDD")]);
    expect(result.overlap).toBe(0);
  });
});

describe("flowShift", () => {
  it("normalizes net flow by volume, signed", () => {
    expect(flowShift(60_000, 1_000_000)).toBeCloseTo(0.06);
    expect(flowShift(-30_000, 1_000_000)).toBeCloseTo(-0.03);
    expect(flowShift(1_000, 0)).toBe(1_000);
  });
});

describe("flowBridge", () => {
  it("treats exchange deposits as out and withdrawals as in", () => {
    const deposits = flowBridge(
      { ...zeroFlows, exchangeNetFlowUsd: 90_000 },
      1_000_000,
    );
    expect(deposits.outs[0]?.key).toBe("exchanges");
    expect(deposits.outs[0]?.usd).toBe(-90_000);
    expect(deposits.netUsd).toBe(-90_000);

    const withdrawals = flowBridge(
      { ...zeroFlows, exchangeNetFlowUsd: -90_000 },
      1_000_000,
    );
    expect(withdrawals.ins[0]?.key).toBe("exchanges");
    expect(withdrawals.ins[0]?.usd).toBe(90_000);
    expect(withdrawals.netUsd).toBe(90_000);
  });

  it("splits arriving and leaving cohorts and nets them", () => {
    const result = flowBridge(
      {
        smartTraderNetFlowUsd: 300_000,
        whaleNetFlowUsd: 150_000,
        publicFigureNetFlowUsd: 20_000,
        exchangeNetFlowUsd: -100_000,
        freshWalletsNetFlowUsd: -30_000,
      },
      6_000_000,
    );
    expect(result.inUsd).toBe(570_000);
    expect(result.outUsd).toBe(30_000);
    expect(result.netUsd).toBe(540_000);
    expect(result.netShare).toBeCloseTo(0.09);
    expect(result.ins.map((leg) => leg.key)).toEqual([
      "traders",
      "whales",
      "exchanges",
      "figures",
    ]);
    expect(result.outs.map((leg) => leg.key)).toEqual(["fresh"]);
  });

  it("drops a missing public-figure series and empty crumbs", () => {
    const result = flowBridge(
      { ...zeroFlows, publicFigureNetFlowUsd: null, smartTraderNetFlowUsd: 10_000 },
      100_000,
    );
    expect(result.legs.some((leg) => leg.key === "figures")).toBe(false);
    expect(result.legs).toHaveLength(1);
  });

  it("returns no legs when every cohort is empty", () => {
    expect(flowBridge(zeroFlows, 1_000_000).legs).toEqual([]);
  });
});

describe("live recalibration (Sep 23)", () => {
  it("calls exchange deposits distribution even when fresh wallets buy", () => {
    // LINK live Sep 23: exchanges +53% of volume, fresh +24%.
    const { verdict } = scoreVerdict(liquid, {
      ...zeroFlows,
      exchangeNetFlowUsd: 530_000,
      freshWalletsNetFlowUsd: 240_000,
    });
    expect(verdict).toBe("distribution");
  });

  it("treats fresh-wallet flow above a day of volume as transfer noise", () => {
    // WETH live Sep 23: fresh flow 336% of volume, nothing else moving.
    const { verdict, breakdown } = scoreVerdict(liquid, {
      ...zeroFlows,
      freshWalletsNetFlowUsd: 3_360_000,
    });
    expect(breakdown.retail).toBe(0);
    expect(verdict).toBe("quiet");
  });

  it("still calls a plausible fresh-wallet bid a retail pump", () => {
    const { verdict } = scoreVerdict(liquid, {
      ...zeroFlows,
      freshWalletsNetFlowUsd: 160_000,
    });
    expect(verdict).toBe("retail-pump");
  });
});
