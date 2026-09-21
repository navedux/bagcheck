import type { Chain, Verdict } from "../src/lib/types";

export type FeaturedMint = {
  chain: Chain;
  address: string;
  expectedVerdict: Exclude<Verdict, "too-thin">;
};

/**
 * Top 10 by ~30d volume (CoinMarketCap monthly ranking, mid-Aug to mid-Sep 2026)
 * that Hold Check can actually check: solana, ethereum, or base.
 * BTC / USDT / XRP / BNB are omitted (no v1 mint). Flows in the snapshot are
 * synthetic fixtures, not live Nansen rows.
 */
export const FEATURED: readonly FeaturedMint[] = [
  {
    chain: "ethereum",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    expectedVerdict: "quiet",
  },
  {
    chain: "ethereum",
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    expectedVerdict: "still-bid",
  },
  {
    chain: "solana",
    address: "So11111111111111111111111111111111111111112",
    expectedVerdict: "still-bid",
  },
  {
    chain: "ethereum",
    address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    expectedVerdict: "distribution",
  },
  {
    chain: "ethereum",
    address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    expectedVerdict: "distribution",
  },
  {
    chain: "ethereum",
    address: "0x514910771af9ca656af840dff83e8264ecf986ca",
    expectedVerdict: "split",
  },
  {
    chain: "solana",
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    expectedVerdict: "retail-pump",
  },
  {
    chain: "solana",
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    expectedVerdict: "still-bid",
  },
  {
    chain: "base",
    address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    expectedVerdict: "still-bid",
  },
  {
    chain: "base",
    address: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    expectedVerdict: "quiet",
  },
];

/**
 * First-visit starters: three named tokens, three different chips.
 * Addresses stay in FEATURED so a starter always resolves.
 */
export const TRY_TOKENS = [
  {
    symbol: "WSOL",
    chain: "solana",
    address: "So11111111111111111111111111111111111111112",
    expectedVerdict: "still-bid",
  },
  {
    symbol: "PEPE",
    chain: "ethereum",
    address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    expectedVerdict: "distribution",
  },
  {
    symbol: "BONK",
    chain: "solana",
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    expectedVerdict: "retail-pump",
  },
] as const satisfies readonly {
  symbol: string;
  chain: Chain;
  address: string;
  expectedVerdict: FeaturedMint["expectedVerdict"];
}[];
