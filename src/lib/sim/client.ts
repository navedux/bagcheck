import "server-only";

import { SIM_TOKENS } from "../../../data/sim-tokens";
import type { CallResult } from "../nansen";
import { historyFromDaily } from "../snapshot";
import {
  CHAINS,
  type Chain,
  type CohortFlows,
  type DayFlows,
  type ScreenerToken,
  type TokenStats,
  type TraderPrint,
  type VerdictDay,
} from "../types";
import { normalizeAddress } from "../validate";
import { isPartialCoverage } from "../window";
import {
  SIM_HISTORY_DAYS,
  dailyFlows,
  dayIndexOf,
  dayVolumeUsd,
  isoDay,
  profileFor,
  regimeAt,
  type ProfileInput,
  type Regime,
  type SimProfile,
} from "./regime";
import { rngFor } from "./prng";
import { EARLY_WINDOW_DAYS } from "../verdict";

/** Market-wide net flow from cohort flows: arrivals minus exchange load. */
function netflowOf(flows: CohortFlows): number {
  return Math.round(
    (flows.smartTraderNetFlowUsd +
      flows.whaleNetFlowUsd +
      flows.freshWalletsNetFlowUsd -
      flows.exchangeNetFlowUsd) * 1.2,
  );
}

/**
 * Deterministic in-app market simulator. Implements the same backend
 * interface as lib/nansen.ts so resolve-check swaps backends by DATA_MODE
 * without changing shape. No cache, no ledger: every call is pure math over
 * (chain, address, day).
 */
function ok<T>(data: T): CallResult<T> {
  return { ok: true, data, cacheHit: false };
}

function knownToken(chain: Chain, address: string): ProfileInput | undefined {
  const found = SIM_TOKENS.find(
    (row) => row.chain === chain && normalizeAddress(row.address) === address,
  );
  return found
    ? {
        symbol: found.symbol,
        script: found.script,
        thin: found.thin,
        market: found.market,
      }
    : undefined;
}

function fakeAddress(chain: Chain, rng: () => number): string {
  if (chain === "solana") {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let out = "";
    for (let i = 0; i < 44; i += 1) {
      out += alphabet[Math.floor(rng() * alphabet.length)];
    }
    return out;
  }
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 40; i += 1) {
    out += hex[Math.floor(rng() * 16)];
  }
  return out;
}

function scaleFlows(flows: CohortFlows, fraction: number): CohortFlows {
  return {
    smartTraderNetFlowUsd: Math.round(flows.smartTraderNetFlowUsd * fraction),
    whaleNetFlowUsd: Math.round(flows.whaleNetFlowUsd * fraction),
    publicFigureNetFlowUsd:
      flows.publicFigureNetFlowUsd === null
        ? null
        : Math.round(flows.publicFigureNetFlowUsd * fraction),
    exchangeNetFlowUsd: Math.round(flows.exchangeNetFlowUsd * fraction),
    freshWalletsNetFlowUsd: Math.round(flows.freshWalletsNetFlowUsd * fraction),
  };
}

export function createSimClient(deps: { now: () => number }) {
  function world(chain: Chain, address: string): { seed: string; profile: SimProfile } {
    const addr = normalizeAddress(address);
    const seed = `${chain}:${addr}`;
    return { seed, profile: profileFor(seed, knownToken(chain, addr)) };
  }

  /**
   * The token's first-days buyer pool. Stable per token: seeded only by the
   * token, so recent windows can draw from the same addresses and the
   * insider-exit overlap is a real property of the simulated world.
   */
  function earlyPool(chain: Chain, seed: string, profile: SimProfile): TraderPrint[] {
    const today = dayIndexOf(deps.now());
    const deployDay = today - profile.deployedDaysAgo;
    const earlyVolume = dayVolumeUsd(profile, seed, deployDay + 2);
    const rng = rngFor("early-pool", seed);
    const prints: TraderPrint[] = [];
    for (let i = 0; i < 50; i += 1) {
      const amount = Math.round(earlyVolume * (0.01 + rng() * 0.12));
      prints.push({
        address: fakeAddress(chain, rng),
        boughtVolumeUsd: amount,
        soldVolumeUsd: Math.round(amount * rng() * 0.2),
      });
    }
    prints.sort((a, b) => b.boughtVolumeUsd - a.boughtVolumeUsd);
    return prints;
  }

  /** How much of a recent sell window comes from the early pool, by regime. */
  const OVERLAP_SHARE: Record<Regime, [number, number]> = {
    distribution: [0.3, 0.6],
    accumulation: [0, 0.1],
    retail: [0.05, 0.2],
    split: [0.1, 0.3],
    quiet: [0.1, 0.25],
  };

  return {
    async flowIntelligence(
      chain: Chain,
      address: string,
      timeframe: "1d" | "1h",
    ): Promise<CallResult<CohortFlows>> {
      const { seed, profile } = world(chain, address);
      const today = dayIndexOf(deps.now());
      const flows = dailyFlows(profile, seed, today);
      if (timeframe === "1d") return ok(flows);
      const fraction = rngFor("tick", seed, today)() * 0.05 + 0.03;
      return ok(scaleFlows(flows, fraction));
    },

    async tokenInformation(
      chain: Chain,
      address: string,
    ): Promise<CallResult<{ symbol: string | null; stats: TokenStats }>> {
      const { seed, profile } = world(chain, address);
      const today = dayIndexOf(deps.now());
      const stats: TokenStats = {
        volume24hUsd: dayVolumeUsd(profile, seed, today),
        marketCapUsd: Math.round(profile.marketCapUsd),
        liquidityUsd: Math.round(profile.liquidityUsd),
        totalHolders: profile.totalHolders,
        tokenDeploymentDate: isoDay(today - profile.deployedDaysAgo),
      };
      return ok({ symbol: profile.symbol, stats });
    },

    async whoBoughtSold(
      chain: Chain,
      address: string,
      side: "BUY" | "SELL",
      date?: { from: string; to: string },
      perPage = 3,
    ): Promise<CallResult<TraderPrint[]>> {
      const { seed, profile } = world(chain, address);
      const today = dayIndexOf(deps.now());
      const deployDay = today - profile.deployedDaysAgo;
      const fromDay = date ? dayIndexOf(Date.parse(date.from)) : today - 1;

      // A range starting inside the token's first days asks for the early pool.
      if (fromDay <= deployDay + EARLY_WINDOW_DAYS) {
        return ok(earlyPool(chain, seed, profile).slice(0, Math.max(perPage, 1)));
      }

      const volume = dayVolumeUsd(profile, seed, today);
      const rng = rngFor("wbs", seed, side, fromDay);
      const count = Math.max(3, Math.min(perPage, 10));
      const pool = earlyPool(chain, seed, profile);
      const [lo, hi] = OVERLAP_SHARE[regimeAt(profile, seed, today)];
      const share = side === "SELL" ? lo + rng() * (hi - lo) : rng() * 0.1;
      const overlapCount = Math.round(share * count);

      const prints: TraderPrint[] = [];
      for (let i = 0; i < count; i += 1) {
        const amount = Math.round(volume * (0.02 + rng() * 0.1));
        const other = Math.round(amount * rng() * 0.25);
        const fromPool = i < overlapCount;
        prints.push({
          address: fromPool ? pool[i % pool.length]!.address : fakeAddress(chain, rng),
          boughtVolumeUsd: side === "BUY" ? amount : other,
          soldVolumeUsd: side === "SELL" ? amount : other,
        });
      }
      prints.sort((a, b) =>
        side === "BUY"
          ? b.boughtVolumeUsd - a.boughtVolumeUsd
          : b.soldVolumeUsd - a.soldVolumeUsd,
      );
      return ok(prints);
    },

    async historicalFlowSummary(
      chain: Chain,
      address: string,
      dateRange: { from: string; to: string },
      entryDate: string,
    ): Promise<CallResult<CohortFlows>> {
      const { seed, profile } = world(chain, address);
      const toDay = dayIndexOf(Date.parse(dateRange.to));
      const fromDay = Math.max(
        dayIndexOf(Date.parse(dateRange.from)),
        toDay - SIM_HISTORY_DAYS,
      );
      const sum: CohortFlows = {
        smartTraderNetFlowUsd: 0,
        whaleNetFlowUsd: 0,
        publicFigureNetFlowUsd: 0,
        exchangeNetFlowUsd: 0,
        freshWalletsNetFlowUsd: 0,
      };
      for (let day = fromDay; day <= toDay; day += 1) {
        const flows = dailyFlows(profile, seed, day);
        sum.smartTraderNetFlowUsd += flows.smartTraderNetFlowUsd;
        sum.whaleNetFlowUsd += flows.whaleNetFlowUsd;
        sum.publicFigureNetFlowUsd =
          (sum.publicFigureNetFlowUsd ?? 0) + (flows.publicFigureNetFlowUsd ?? 0);
        sum.exchangeNetFlowUsd += flows.exchangeNetFlowUsd;
        sum.freshWalletsNetFlowUsd += flows.freshWalletsNetFlowUsd;
      }
      if (isPartialCoverage(entryDate)) {
        sum.whaleNetFlowUsd = 0;
        sum.exchangeNetFlowUsd = 0;
        sum.publicFigureNetFlowUsd = null;
      }
      return ok(sum);
    },

    /**
     * The board universe: the featured set plus eight daily movers. Movers
     * are unknown addresses seeded by the day, so the board churns daily
     * while every row still resolves to a full check in the sim world.
     */
    async tokenScreener(chains: Chain[]): Promise<CallResult<ScreenerToken[]>> {
      const today = dayIndexOf(deps.now());
      const rowFor = (chain: Chain, address: string): ScreenerToken => {
        const addr = normalizeAddress(address);
        const seed = `${chain}:${addr}`;
        const profile = profileFor(seed, knownToken(chain, addr));
        const volume = dayVolumeUsd(profile, seed, today);
        return {
          chain,
          address: addr,
          symbol: profile.symbol,
          volumeUsd: volume,
          netflowUsd: netflowOf(dailyFlows(profile, seed, today)),
          liquidityUsd: Math.round(profile.liquidityUsd),
          marketCapUsd: Math.round(profile.marketCapUsd),
        };
      };

      const rows: ScreenerToken[] = [];
      for (const token of SIM_TOKENS) {
        if (token.thin || !chains.includes(token.chain)) continue;
        rows.push(rowFor(token.chain, token.address));
      }
      const rng = rngFor("movers", today);
      const movers: ScreenerToken[] = [];
      for (let i = 0; i < 16; i += 1) {
        const chain = CHAINS[Math.floor(rng() * CHAINS.length)] ?? "ethereum";
        if (!chains.includes(chain)) continue;
        movers.push(rowFor(chain, fakeAddress(chain, rng)));
      }
      movers.sort(
        (a, b) =>
          Math.abs(b.netflowUsd / Math.max(b.volumeUsd, 1)) -
          Math.abs(a.netflowUsd / Math.max(a.volumeUsd, 1)),
      );
      rows.push(...movers.slice(0, 8));
      return ok(rows);
    },
  };
}

export const sim = createSimClient({ now: () => Date.now() });

/** Ninety days of daily flows ending today, oldest first. Pure and cheap. */
export function simDaily(
  chain: Chain,
  address: string,
  nowMs: number,
  days = SIM_HISTORY_DAYS,
): DayFlows[] {
  const addr = normalizeAddress(address);
  const seed = `${chain}:${addr}`;
  const profile = profileFor(seed, knownToken(chain, addr));
  const today = dayIndexOf(nowMs);
  const rows: DayFlows[] = [];
  for (let day = today - (days - 1); day <= today; day += 1) {
    rows.push({
      day: isoDay(day),
      volumeUsd: dayVolumeUsd(profile, seed, day),
      flows: dailyFlows(profile, seed, day),
    });
  }
  return rows;
}

/** The last 30 daily verdicts for the signal strip. */
export function simHistory(
  chain: Chain,
  address: string,
  nowMs: number,
  days = 30,
): VerdictDay[] {
  const addr = normalizeAddress(address);
  const seed = `${chain}:${addr}`;
  const profile = profileFor(seed, knownToken(chain, addr));
  return historyFromDaily(simDaily(chain, addr, nowMs, days), profile.liquidityUsd, days);
}
