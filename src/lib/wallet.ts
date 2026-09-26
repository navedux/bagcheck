import type { Holding } from "./types";

/** A wallet page reads the biggest holdings; the rest wait for a click. */
export const WALLET_ROWS = 10;
export const WALLET_READS = 5;
export const WALLET_MIN_USD = 10;

const STABLES = new Set([
  "USDC", "USDT", "DAI", "USDE", "USDS", "FDUSD", "PYUSD", "USD1", "TUSD", "BUSD",
  "FRAX", "LUSD", "GHO", "CRVUSD", "USDB", "USDBC", "USDC.E", "EURC", "USDG", "RLUSD",
]);

/** Nobody holds a stablecoin as a bag; its flows say nothing about it. */
export function isStablecoin(symbol: string): boolean {
  return STABLES.has(symbol.trim().toUpperCase());
}

/**
 * The rows a wallet page shows: no dust, no stablecoins, native ETH merged
 * into WETH on the same chain, biggest first, capped.
 */
export function walletRows(holdings: Holding[]): Holding[] {
  const merged = new Map<string, Holding>();
  for (const row of holdings) {
    if (isStablecoin(row.symbol)) continue;
    const key = `${row.chain}:${row.address}`;
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...(existing.native ? row : existing),
        amount: existing.amount + row.amount,
        valueUsd: existing.valueUsd + row.valueUsd,
        native: existing.native && row.native,
      });
    } else {
      merged.set(key, row);
    }
  }
  return [...merged.values()]
    .filter((row) => row.valueUsd >= WALLET_MIN_USD)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, WALLET_ROWS);
}
