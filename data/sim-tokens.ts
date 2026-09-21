import type { Regime } from "../src/lib/sim/regime";
import type { Chain } from "../src/lib/types";

/**
 * The simulator's known world: the featured set plus the THIN floor fixture.
 *
 * `script` is a cyclic regime schedule indexed by 4-day segments anchored to
 * SCRIPT_EPOCH_DAY (2026-09-01). Script position 4 covers Sep 17-20, 2026 and
 * matches `expectedVerdict` in data/featured.ts, so the demo's opening state
 * is stable while history still shows flips. Any address not listed here gets
 * a fully seed-derived profile and regime walk.
 */
/** Sep 19 2026 market scale. WSOL and WETH volume are the live Nansen ticks from the spec. */
export type SimMarket = {
  volumeUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  totalHolders: number;
  deployedDaysAgo: number;
};

export type SimToken = {
  chain: Chain;
  address: string;
  symbol: string;
  script: readonly Regime[];
  market?: SimMarket;
  thin?: boolean;
};

export const SIM_TOKENS: readonly SimToken[] = [
  {
    chain: "ethereum",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    symbol: "USDC",
    script: ["accumulation", "quiet", "distribution", "quiet", "quiet", "accumulation"],
    market: {
      volumeUsd: 18_400_000_000,
      marketCapUsd: 41_200_000_000,
      liquidityUsd: 2_100_000_000,
      totalHolders: 2_800_000,
      deployedDaysAgo: 2500,
    },
  },
  {
    chain: "ethereum",
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    symbol: "WETH",
    script: ["quiet", "distribution", "accumulation", "quiet", "accumulation", "accumulation"],
    market: {
      volumeUsd: 248_000_000,
      marketCapUsd: 392_000_000_000,
      liquidityUsd: 0,
      totalHolders: 1_100_000,
      deployedDaysAgo: 2800,
    },
  },
  {
    chain: "solana",
    address: "So11111111111111111111111111111111111111112",
    symbol: "WSOL",
    script: ["distribution", "quiet", "retail", "accumulation", "accumulation", "quiet"],
    market: {
      volumeUsd: 4_800_000_000,
      marketCapUsd: 96_000_000_000,
      liquidityUsd: 0,
      totalHolders: 2_400_000,
      deployedDaysAgo: 1900,
    },
  },
  {
    chain: "ethereum",
    address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    symbol: "WBTC",
    script: ["accumulation", "quiet", "accumulation", "quiet", "distribution", "accumulation"],
    market: {
      volumeUsd: 620_000_000,
      marketCapUsd: 22_400_000_000,
      liquidityUsd: 180_000_000,
      totalHolders: 180_000,
      deployedDaysAgo: 2400,
    },
  },
  {
    chain: "ethereum",
    address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    symbol: "PEPE",
    script: ["retail", "accumulation", "quiet", "split", "distribution", "distribution"],
    market: {
      volumeUsd: 350_000_000,
      marketCapUsd: 4_800_000_000,
      liquidityUsd: 42_000_000,
      totalHolders: 720_000,
      deployedDaysAgo: 1180,
    },
  },
  {
    chain: "ethereum",
    address: "0x514910771af9ca656af840dff83e8264ecf986ca",
    symbol: "LINK",
    script: ["quiet", "accumulation", "distribution", "accumulation", "split", "quiet"],
    market: {
      volumeUsd: 210_000_000,
      marketCapUsd: 11_600_000_000,
      liquidityUsd: 95_000_000,
      totalHolders: 810_000,
      deployedDaysAgo: 2700,
    },
  },
  {
    chain: "solana",
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    script: ["quiet", "distribution", "accumulation", "quiet", "retail", "quiet"],
    market: {
      volumeUsd: 92_000_000,
      marketCapUsd: 1_400_000_000,
      liquidityUsd: 18_000_000,
      totalHolders: 980_000,
      deployedDaysAgo: 1020,
    },
  },
  {
    chain: "solana",
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    script: ["split", "quiet", "distribution", "quiet", "accumulation", "accumulation"],
    market: {
      volumeUsd: 48_000_000,
      marketCapUsd: 1_900_000_000,
      liquidityUsd: 22_000_000,
      totalHolders: 640_000,
      deployedDaysAgo: 690,
    },
  },
  {
    chain: "base",
    address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    symbol: "AERO",
    script: ["quiet", "retail", "quiet", "distribution", "accumulation", "quiet"],
    market: {
      volumeUsd: 36_000_000,
      marketCapUsd: 780_000_000,
      liquidityUsd: 28_000_000,
      totalHolders: 210_000,
      deployedDaysAgo: 780,
    },
  },
  {
    chain: "base",
    address: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    symbol: "BRETT",
    script: ["distribution", "quiet", "accumulation", "quiet", "quiet", "retail"],
    market: {
      volumeUsd: 14_000_000,
      marketCapUsd: 240_000_000,
      liquidityUsd: 9_500_000,
      totalHolders: 160_000,
      deployedDaysAgo: 860,
    },
  },
  {
    chain: "ethereum",
    address: "0x1111111111111111111111111111111111111111",
    symbol: "THIN",
    script: ["accumulation"],
    thin: true,
  },
];
