import type { CohortFlows } from "../types";
import { pick, rngFor } from "./prng";

/**
 * The simulator's market model.
 *
 * Every token has a profile (volume scale, liquidity, holders) derived purely
 * from its chain:address seed, and a regime schedule. Known tokens (the
 * featured set plus the THIN floor fixture) run an explicit cyclic regime
 * script anchored to SCRIPT_EPOCH_DAY so the demo is stable and reviewable.
 * Unknown tokens get a seeded regime walk, so any pasted address resolves.
 *
 * Flows are generated as a fraction of the token's own daily volume, so
 * normalized scores land in the regime's band no matter how volume drifts.
 * Regime bands are tuned so each regime maps to one verdict with margin
 * against T = 0.06 and T_quiet = 0.01 after +/-8% daily jitter.
 */
export type Regime = "accumulation" | "distribution" | "retail" | "split" | "quiet";

/** 2026-09-01 UTC as a day index. Regime scripts anchor here. */
export const SCRIPT_EPOCH_DAY = 20697;
export const SCRIPT_SEGMENT_DAYS = 4;
export const SIM_HISTORY_DAYS = 90;

const SEEDED_REGIMES: readonly Regime[] = [
  "accumulation",
  "distribution",
  "retail",
  "split",
  "quiet",
];

export type ProfileInput = {
  symbol: string;
  script: readonly Regime[] | null;
  thin?: boolean;
  market?: {
    volumeUsd: number;
    marketCapUsd: number;
    liquidityUsd: number;
    totalHolders: number;
    deployedDaysAgo: number;
  };
};

export type SimProfile = {
  symbol: string;
  thin: boolean;
  baseVolumeUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  totalHolders: number;
  deployedDaysAgo: number;
  script: readonly Regime[] | null;
  segmentDays: number;
  segmentOffset: number;
};

export function dayIndexOf(timestampMs: number): number {
  return Math.floor(timestampMs / 86_400_000);
}

export function isoDay(dayIndex: number): string {
  return new Date(dayIndex * 86_400_000).toISOString().slice(0, 10);
}

function generatedSymbol(rng: () => number): string {
  let symbol = "";
  for (let i = 0; i < 4; i += 1) {
    symbol += String.fromCharCode(65 + Math.floor(rng() * 26));
  }
  return symbol;
}

export function profileFor(seed: string, known?: ProfileInput): SimProfile {
  const rng = rngFor("profile", seed);
  if (known?.thin) {
    const baseVolumeUsd = pick(rng, 2_000, 8_000);
    const marketCapUsd = pick(rng, 300_000, 1_200_000);
    const liquidityUsd = pick(rng, 5_000, 20_000);
    const totalHolders = 300 + Math.floor(rng() * 4_000);
    const deployedDaysAgo = 45 + Math.floor(rng() * 400);
    return {
      symbol: known.symbol,
      thin: true,
      baseVolumeUsd,
      marketCapUsd,
      liquidityUsd,
      totalHolders,
      deployedDaysAgo,
      script: known.script,
      segmentDays: SCRIPT_SEGMENT_DAYS,
      segmentOffset: 0,
    };
  }
  if (known) {
    if (known.market) {
      return {
        symbol: known.symbol,
        thin: false,
        baseVolumeUsd: known.market.volumeUsd,
        marketCapUsd: known.market.marketCapUsd,
        liquidityUsd: known.market.liquidityUsd,
        totalHolders: known.market.totalHolders,
        deployedDaysAgo: known.market.deployedDaysAgo,
        script: known.script,
        segmentDays: SCRIPT_SEGMENT_DAYS,
        segmentOffset: 0,
      };
    }
    const baseVolumeUsd = 10 ** pick(rng, 6.7, 8.4);
    const marketCapUsd = baseVolumeUsd * pick(rng, 4, 44);
    const liquidityUsd = Math.max(30_000, baseVolumeUsd * pick(rng, 0.04, 0.34));
    const totalHolders = 400 + Math.floor(rng() * 300_000);
    const deployedDaysAgo = 45 + Math.floor(rng() * 650);
    return {
      symbol: known.symbol,
      thin: false,
      baseVolumeUsd,
      marketCapUsd,
      liquidityUsd,
      totalHolders,
      deployedDaysAgo,
      script: known.script,
      segmentDays: SCRIPT_SEGMENT_DAYS,
      segmentOffset: 0,
    };
  }
  const thin = rng() < 0.3;
  const baseVolumeUsd = thin ? pick(rng, 1_000, 8_000) : 10 ** pick(rng, 4.7, 7.9);
  const marketCapUsd = baseVolumeUsd * pick(rng, 3, 33);
  const liquidityUsd = thin
    ? pick(rng, 5_000, 20_000)
    : Math.max(30_000, baseVolumeUsd * pick(rng, 0.03, 0.33));
  const totalHolders = 100 + Math.floor(rng() * 80_000);
  const deployedDaysAgo = 10 + Math.floor(rng() * 500);
  const symbol = generatedSymbol(rng);
  const segmentDays = 4 + Math.floor(rng() * 6);
  const segmentOffset = Math.floor(rng() * 9);
  return {
    symbol,
    thin,
    baseVolumeUsd,
    marketCapUsd,
    liquidityUsd,
    totalHolders,
    deployedDaysAgo,
    script: null,
    segmentDays,
    segmentOffset,
  };
}

export function regimeAt(profile: SimProfile, seed: string, dayIndex: number): Regime {
  if (profile.script && profile.script.length > 0) {
    const segment = Math.floor((dayIndex - SCRIPT_EPOCH_DAY) / SCRIPT_SEGMENT_DAYS);
    const length = profile.script.length;
    const index = ((segment % length) + length) % length;
    return profile.script[index] ?? "quiet";
  }
  const segment = Math.floor((dayIndex + profile.segmentOffset) / profile.segmentDays);
  const index = Math.floor(rngFor("regime", seed, segment)() * SEEDED_REGIMES.length);
  return SEEDED_REGIMES[index] ?? "quiet";
}

function segmentKeyOf(profile: SimProfile, dayIndex: number): string {
  if (profile.script && profile.script.length > 0) {
    return `s${Math.floor((dayIndex - SCRIPT_EPOCH_DAY) / SCRIPT_SEGMENT_DAYS)}`;
  }
  return `u${Math.floor((dayIndex + profile.segmentOffset) / profile.segmentDays)}`;
}

/** Normalized cohort bands, as a fraction of the token's own daily volume. */
const REGIME_FLOW: Record<
  Regime,
  {
    st: readonly [number, number];
    wh: readonly [number, number];
    fr: readonly [number, number];
    ex: readonly [number, number];
  }
> = {
  accumulation: { st: [0.045, 0.09], wh: [0.02, 0.06], fr: [-0.01, 0.02], ex: [-0.02, 0.01] },
  distribution: { st: [-0.07, -0.03], wh: [-0.03, 0.01], fr: [0.01, 0.04], ex: [0.05, 0.1] },
  retail: { st: [-0.008, 0.005], wh: [-0.008, 0.005], fr: [0.07, 0.12], ex: [0, 0.03] },
  split: { st: [0.035, 0.04], wh: [-0.075, -0.058], fr: [-0.01, 0.01], ex: [-0.01, 0.015] },
  quiet: { st: [-0.006, 0.006], wh: [-0.006, 0.006], fr: [-0.006, 0.006], ex: [-0.006, 0.006] },
};

export function dayVolumeUsd(profile: SimProfile, seed: string, dayIndex: number): number {
  const regime = regimeAt(profile, seed, dayIndex);
  const drift = pick(rngFor("vol", seed, dayIndex), 0.8, 1.3);
  const active = regime === "distribution" || regime === "retail" ? 1.25 : 1;
  return Math.round(profile.baseVolumeUsd * drift * active);
}

function segmentValue(
  seed: string,
  segmentKey: string,
  range: readonly [number, number],
): number {
  return pick(rngFor("seg", seed, segmentKey), range[0], range[1]);
}

export function dailyFlows(
  profile: SimProfile,
  seed: string,
  dayIndex: number,
): CohortFlows {
  const regime = regimeAt(profile, seed, dayIndex);
  const ranges = REGIME_FLOW[regime];
  const segmentKey = segmentKeyOf(profile, dayIndex);
  const volume = dayVolumeUsd(profile, seed, dayIndex);
  const cohort = (name: string, range: readonly [number, number]): number => {
    const base = segmentValue(seed, `${segmentKey}:${name}`, range);
    const jitter = pick(rngFor("day", seed, dayIndex, name), 0.92, 1.08);
    return Math.round(base * jitter * volume);
  };
  return {
    smartTraderNetFlowUsd: cohort("st", ranges.st),
    whaleNetFlowUsd: cohort("wh", ranges.wh),
    publicFigureNetFlowUsd: cohort("pf", [-0.004, 0.004]),
    exchangeNetFlowUsd: cohort("ex", ranges.ex),
    freshWalletsNetFlowUsd: cohort("fr", ranges.fr),
  };
}
