import wallet from "../../data/snapshot/wallet.json";
import { sanitizeAddress, sanitizeSymbol } from "./sanitize";
import { tokenKey } from "./snapshot";
import type { Chain, CohortFlows, Holding, TokenStats, WalletKind } from "./types";

/**
 * One sample wallet captured live with `pnpm refresh-live-snapshot`: its
 * balances, plus token info and 24h flows for the holdings that were read.
 * Snapshot mode serves it so the wallet page works without a key.
 */
export type LeanToken = {
  chain: Chain;
  address: string;
  symbol: string;
  stats: TokenStats;
  flows1d: CohortFlows;
};

export type WalletSnapshot = {
  kind: WalletKind;
  address: string;
  capturedAt: string;
  holdings: Holding[];
  lean: LeanToken[];
};

const RAW = wallet as unknown as Partial<WalletSnapshot>;

const SNAPSHOT: WalletSnapshot | null =
  RAW && RAW.kind && RAW.address && Array.isArray(RAW.holdings)
    ? {
        kind: RAW.kind,
        address: sanitizeAddress(RAW.address),
        capturedAt: RAW.capturedAt ?? "",
        holdings: RAW.holdings.map((row) => ({
          ...row,
          symbol: sanitizeSymbol(row.symbol) || "TOKEN",
          address: sanitizeAddress(row.address),
        })),
        lean: (RAW.lean ?? []).map((row) => ({
          ...row,
          symbol: sanitizeSymbol(row.symbol) || "TOKEN",
          address: sanitizeAddress(row.address),
        })),
      }
    : null;

const LEAN = new Map((SNAPSHOT?.lean ?? []).map((row) => [tokenKey(row.chain, row.address), row]));

function walletKey(kind: WalletKind, address: string): string {
  return `${kind}:${kind === "evm" ? address.toLowerCase() : address}`;
}

export function getWalletSnapshot(kind: WalletKind, address: string): WalletSnapshot | null {
  if (!SNAPSHOT) return null;
  return walletKey(SNAPSHOT.kind, SNAPSHOT.address) === walletKey(kind, address)
    ? SNAPSHOT
    : null;
}

export function getLeanSnapshot(chain: Chain, address: string): LeanToken | null {
  return LEAN.get(tokenKey(chain, address)) ?? null;
}

export const SAMPLE_WALLET: { kind: WalletKind; address: string } | null = SNAPSHOT
  ? { kind: SNAPSHOT.kind, address: SNAPSHOT.address }
  : null;
