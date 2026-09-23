import live from "../../data/snapshot/live.json";
import { sanitizeSymbol } from "./sanitize";
import { tokenKey } from "./snapshot";
import type { Chain, TokenSnapshot, TraderSides } from "./types";
import { normalizeAddress } from "./validate";

/**
 * Real Nansen reads for the featured tokens, captured with
 * `pnpm refresh-live-snapshot`. Snapshot mode and the live fallback serve
 * these first, so the public demo shows Nansen data rather than the sim.
 * No daily history: a live capture is one day, not ninety.
 */
const emptyTraders: TraderSides = { buyers: [], sellers: [] };

const ROWS: TokenSnapshot[] = (live as unknown as TokenSnapshot[]).map((row) => ({
  ...row,
  chain: row.chain as Chain,
  address: normalizeAddress(row.address),
  symbol: sanitizeSymbol(row.symbol),
  traders: row.traders ?? emptyTraders,
  earlyExit: row.earlyExit ?? null,
  daily: [],
}));

const BY_KEY = new Map(ROWS.map((row) => [tokenKey(row.chain, row.address), row]));

export function getLiveSnapshot(chain: Chain, address: string): TokenSnapshot | null {
  return BY_KEY.get(tokenKey(chain, address)) ?? null;
}

export const LIVE_SNAPSHOT_COUNT = ROWS.length;
