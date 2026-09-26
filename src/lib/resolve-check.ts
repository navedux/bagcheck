import "server-only";

import { FEATURED } from "../../data/featured";
import { MemoryCache } from "./cache";
import { ColdGate } from "./cold-gate";
import { dataMode, env } from "./env";
import { getLiveSnapshot } from "./live-snapshot";
import { WALLET_READS, walletRows } from "./wallet";
import { getLeanSnapshot, getWalletSnapshot, type LeanToken, type WalletSnapshot } from "./wallet-snapshot";
import { nansen, type CallResult } from "./nansen";
import { sim, simDaily, simHistory } from "./sim/client";
import { sanitizeSymbol } from "./sanitize";
import {
  checkedToken,
  getBoardSnapshot,
  getSnapshot,
  toCheckedToken,
  toSinceRead,
} from "./snapshot";
import {
  CHAINS,
  type BoardRow,
  type Chain,
  type CheckedToken,
  type CohortFlows,
  type DataMode,
  type EarlyExit,
  type Holding,
  type WalletKind,
  type WalletRead,
  type WalletRow,
  type WatchRow,
  type ScreenerToken,
  type TokenSnapshot,
  type TokenStats,
  type TraderPrint,
  type TraderSides,
  type Verdict,
  type VerdictDay,
} from "./types";
import {
  EMPTY_SNAPSHOT_LINE,
  LIVE_AUTH,
  LIVE_BUSY,
  LIVE_NOT_FOUND,
  LIVE_UNAVAILABLE,
  WALLET_NOT_IN_DEMO,
} from "./copy";
import { normalizeAddress } from "./validate";
import {
  EARLY_WINDOW_DAYS,
  RECENT_SELL_WINDOW_DAYS,
  earlyExitOverlap,
  flowShift,
  scoreVerdict,
} from "./verdict";
import {
  deploymentDayOf,
  earlyWindowFor,
  estimatedWindowVolume,
  holdingWindow,
  isPartialCoverage,
  last24hRange,
  recentWindow,
} from "./window";

export type ResolveError = {
  code: string;
  message: string;
};

export type ResolveResult =
  | { ok: true; data: CheckedToken }
  | { ok: false; error: ResolveError };

export type WalletResult =
  | { ok: true; data: WalletRead }
  | { ok: false; error: ResolveError };

/**
 * The backend contract both lib/nansen.ts and lib/sim/client.ts implement.
 * The resolver fans out through this shape either way; only DATA_MODE picks.
 */
export type FlowBackend = {
  flowIntelligence: (
    chain: Chain,
    address: string,
    timeframe: "1d" | "1h",
  ) => Promise<CallResult<CohortFlows>>;
  tokenInformation: (
    chain: Chain,
    address: string,
  ) => Promise<CallResult<{ symbol: string | null; stats: TokenStats }>>;
  whoBoughtSold: (
    chain: Chain,
    address: string,
    side: "BUY" | "SELL",
    date: { from: string; to: string },
    perPage?: number,
  ) => Promise<CallResult<TraderPrint[]>>;
  historicalFlowSummary: (
    chain: Chain,
    address: string,
    dateRange: { from: string; to: string },
    entryDate: string,
  ) => Promise<CallResult<CohortFlows>>;
  tokenScreener: (chains: Chain[]) => Promise<CallResult<ScreenerToken[]>>;
};

export type ResolveDeps = {
  mode: () => DataMode;
  getSnapshot: typeof getSnapshot;
  flowIntelligence: FlowBackend["flowIntelligence"];
  tokenInformation: FlowBackend["tokenInformation"];
  whoBoughtSold: FlowBackend["whoBoughtSold"];
  historicalFlowSummary: FlowBackend["historicalFlowSummary"];
  tokenScreener: FlowBackend["tokenScreener"];
  /** Baked Today board for snapshot mode (and live fallback). */
  getBoard: () => BoardRow[];
  /**
   * Daily verdict history for the signal strip. Only the sim backend can
   * afford it (pure math); live returns nothing until a real history cache
   * exists. Snapshot mode reads baked daily rows instead.
   */
  history: (chain: Chain, address: string, now: Date) => VerdictDay[];
  now: () => number;
  /** Caps cold live checks per client and per instance. Absent in tests. */
  gate?: ColdGate;
  /** How long a finished live check is reused before Nansen is asked again. */
  resultTtlMs?: () => number;
  /** How long the early-exit read may hold the page before it is skipped. */
  earlyExitBudgetMs?: number;
  /** Wallet balances (live only). */
  walletBalance?: (kind: WalletKind, address: string) => Promise<CallResult<Holding[]>>;
  /** Saved sample wallet and per-token lean reads, for snapshot and fallback. */
  getWalletSnapshot?: (kind: WalletKind, address: string) => WalletSnapshot | null;
  getLeanSnapshot?: (chain: Chain, address: string) => LeanToken | null;
};

type LeanRead = { symbol: string; verdict: Verdict; stats: TokenStats };

export type ResolveOptions = {
  /** Rate-limit identity of the caller, for the cold-check gate. */
  client?: string;
};

const STALE_RESULT_TTL_MS = 60_000;
const DEFAULT_EARLY_EXIT_BUDGET_MS = 2_500;

const FEATURED_KEYS = new Set(
  FEATURED.map((item) => `${item.chain}:${normalizeAddress(item.address)}`),
);

function isFeatured(chain: Chain, address: string): boolean {
  return FEATURED_KEYS.has(`${chain}:${address}`);
}

/** Nansen's answer for an address it does not know: no symbol, no volume, no cap. */
function isUnknownToken(info: { symbol: string | null; stats: TokenStats }): boolean {
  const blankSymbol = !info.symbol || info.symbol.trim().length === 0;
  return (
    blankSymbol &&
    (info.stats.volume24hUsd ?? 0) === 0 &&
    (info.stats.marketCapUsd ?? 0) === 0
  );
}

function liveError(code: string): ResolveError {
  if (code === "not_found") {
    return { code, message: LIVE_NOT_FOUND };
  }
  if (code === "auth") {
    return { code, message: LIVE_AUTH };
  }
  return { code: "live_unavailable", message: LIVE_UNAVAILABLE };
}

export function createResolver(deps: ResolveDeps) {
  const results = new MemoryCache(2_000);
  const inflight = new Map<string, Promise<ResolveResult>>();

  /**
   * Live checks are cached whole, so repeat clicks on one token cost nothing.
   * A new token (or new entry date) is a cold check and must pass the gate;
   * past the gate, the caller gets the snapshot if there is one.
   */
  async function resolveCheck(
    chain: Chain,
    address: string,
    entryDate?: string,
    options: ResolveOptions = {},
  ): Promise<ResolveResult> {
    const addr = normalizeAddress(address);
    if (deps.mode() !== "live") return computeCheck(chain, addr, entryDate);

    const key = `${chain}:${addr}:${entryDate ?? ""}`;
    const now = deps.now();
    const cached = results.get<ResolveResult>(key, now);
    if (cached) return cached;
    const pending = inflight.get(key);
    if (pending) return pending;

    const exempt = isFeatured(chain, addr) && !entryDate;
    if (deps.gate && !deps.gate.admit(options.client ?? "anon", now, exempt)) {
      const snap = deps.getSnapshot(chain, addr);
      if (snap) {
        return {
          ok: true,
          data: { ...checkedToken(snap, entryDate, new Date(now)), stale: true },
        };
      }
      return { ok: false, error: { code: "busy", message: LIVE_BUSY } };
    }

    const request = computeCheck(chain, addr, entryDate).then((result) => {
      if (result.ok) {
        const ttl = result.data.stale
          ? STALE_RESULT_TTL_MS
          : (deps.resultTtlMs?.() ?? STALE_RESULT_TTL_MS);
        results.set(key, result, ttl, deps.now());
      } else {
        // Failures are remembered too, so retrying a bad token is free.
        const ttl = result.error.code === "not_found" ? 30 * 60_000 : 2 * 60_000;
        results.set(key, result, ttl, deps.now());
      }
      return result;
    });
    inflight.set(key, request);
    try {
      return await request;
    } finally {
      inflight.delete(key);
    }
  }

  const leans = new MemoryCache(4_000);
  const wallets = new MemoryCache(1_000);
  const walletInflight = new Map<string, Promise<WalletResult>>();

  /** Any read already paid for, or saved: full check, lean read, snapshots. */
  function peekLean(chain: Chain, addr: string): LeanRead | null {
    const now = deps.now();
    const full = results.get<ResolveResult>(`${chain}:${addr}:`, now);
    if (full?.ok) {
      return { symbol: full.data.symbol, verdict: full.data.verdict, stats: full.data.stats };
    }
    const lean = leans.get<LeanRead>(`${chain}:${addr}`, now);
    if (lean) return lean;
    const snap = deps.getSnapshot(chain, addr);
    if (snap) {
      return { symbol: snap.symbol, verdict: scoreVerdict(snap.stats, snap.flows1d).verdict, stats: snap.stats };
    }
    const saved = deps.getLeanSnapshot?.(chain, addr);
    if (saved) {
      return { symbol: saved.symbol, verdict: scoreVerdict(saved.stats, saved.flows1d).verdict, stats: saved.stats };
    }
    return null;
  }

  /**
   * The cheap read: token information and 24h flows, two calls, enough for
   * the verdict. Unknown tokens stop after the first call. Not gated here;
   * callers spend the gate.
   */
  async function leanRead(chain: Chain, addr: string): Promise<LeanRead | null> {
    const seen = peekLean(chain, addr);
    if (seen || deps.mode() !== "live") return seen;
    const info = await deps.tokenInformation(chain, addr);
    if (!info.ok || isUnknownToken(info.data)) return null;
    const flows = await deps.flowIntelligence(chain, addr, "1d");
    if (!flows.ok) return null;
    const read: LeanRead = {
      symbol: sanitizeSymbol(info.data.symbol ?? "") || "TOKEN",
      verdict: scoreVerdict(info.data.stats, flows.data).verdict,
      stats: info.data.stats,
    };
    leans.set(`${chain}:${addr}`, read, deps.resultTtlMs?.() ?? STALE_RESULT_TTL_MS, deps.now());
    return read;
  }

  /**
   * One row on the home list. Live mode uses the lean read (2 credits, not 7)
   * and spends the caller's cold budget only when nothing is cached.
   */
  async function resolveWatchRow(
    chain: Chain,
    address: string,
    options: ResolveOptions = {},
  ): Promise<WatchRow | null> {
    const addr = normalizeAddress(address);
    if (deps.mode() !== "live") {
      const result = await resolveCheck(chain, addr, undefined, options);
      if (!result.ok) return null;
      const { symbol, verdict, stale, history, stats } = result.data;
      return { chain, address: addr, symbol, verdict, stale, history, volumeUsd: stats.volume24hUsd };
    }
    let read = peekLean(chain, addr);
    if (!read) {
      const exempt = isFeatured(chain, addr);
      if (deps.gate && !deps.gate.admit(options.client ?? "anon", deps.now(), exempt)) return null;
      read = await leanRead(chain, addr);
    }
    if (!read) return null;
    return {
      chain,
      address: addr,
      symbol: read.symbol,
      verdict: read.verdict,
      stale: false,
      history: [],
      volumeUsd: read.stats.volume24hUsd,
    };
  }

  function fromWalletSnapshot(snap: WalletSnapshot, stale: boolean): WalletRead {
    const rows: WalletRow[] = walletRows(snap.holdings).map((row) => ({
      ...row,
      verdict: peekLean(row.chain, row.address)?.verdict ?? null,
    }));
    return {
      kind: snap.kind,
      address: snap.address,
      rows,
      readCount: rows.filter((row) => row.verdict !== null).length,
      source: "snapshot",
      stale,
    };
  }

  /**
   * A wallet: one balance call, then lean reads for the biggest holdings.
   * One cold wallet spends one unit of the caller's cold budget and about
   * 1 + 2 x WALLET_READS credits. Cached whole, like a check.
   */
  async function resolveWallet(
    kind: WalletKind,
    address: string,
    options: ResolveOptions = {},
  ): Promise<WalletResult> {
    const addr = kind === "evm" ? address.toLowerCase() : address;
    const saved = deps.getWalletSnapshot?.(kind, addr) ?? null;
    if (deps.mode() !== "live" || !deps.walletBalance) {
      return saved
        ? { ok: true, data: fromWalletSnapshot(saved, false) }
        : { ok: false, error: { code: "not_in_snapshot", message: WALLET_NOT_IN_DEMO } };
    }

    const key = `wallet:${kind}:${addr}`;
    const cached = wallets.get<WalletResult>(key, deps.now());
    if (cached) return cached;
    const pending = walletInflight.get(key);
    if (pending) return pending;
    if (deps.gate && !deps.gate.admit(options.client ?? "anon", deps.now(), false)) {
      return saved
        ? { ok: true, data: fromWalletSnapshot(saved, true) }
        : { ok: false, error: { code: "busy", message: LIVE_BUSY } };
    }

    const balanceFn = deps.walletBalance;
    const request = (async (): Promise<WalletResult> => {
      const balance = await balanceFn(kind, addr);
      if (!balance.ok) {
        if (saved) return { ok: true, data: fromWalletSnapshot(saved, true) };
        return { ok: false, error: liveError(balance.error.code) };
      }
      const top = walletRows(balance.data);
      const reads = await Promise.all(
        top.map((row, index) =>
          index < WALLET_READS
            ? leanRead(row.chain, row.address)
            : Promise.resolve(peekLean(row.chain, row.address)),
        ),
      );
      const rows: WalletRow[] = top.map((row, index) => ({
        ...row,
        verdict: reads[index]?.verdict ?? null,
      }));
      return {
        ok: true,
        data: {
          kind,
          address: addr,
          rows,
          readCount: Math.min(top.length, WALLET_READS),
          source: "live",
          stale: false,
        },
      };
    })().then((result) => {
      const ttl = result.ok && !result.data.stale
        ? (deps.resultTtlMs?.() ?? STALE_RESULT_TTL_MS)
        : 2 * 60_000;
      wallets.set(key, result, ttl, deps.now());
      return result;
    });
    walletInflight.set(key, request);
    try {
      return await request;
    } finally {
      walletInflight.delete(key);
    }
  }

  /** A finished check without spending anything: cache, then snapshot. */
  function peekCheck(chain: Chain, address: string): CheckedToken | null {
    const addr = normalizeAddress(address);
    const cached = results.get<ResolveResult>(`${chain}:${addr}:`, deps.now());
    if (cached?.ok) return cached.data;
    const snap = deps.getSnapshot(chain, addr);
    return snap ? checkedToken(snap, undefined, new Date(deps.now())) : null;
  }

  async function computeCheck(
    chain: Chain,
    addr: string,
    entryDate?: string,
  ): Promise<ResolveResult> {
    const snap = deps.getSnapshot(chain, addr);
    const now = new Date(deps.now());
    const mode = deps.mode();

    if (mode === "snapshot") {
      if (!snap) {
        return { ok: false, error: { code: "not_in_snapshot", message: EMPTY_SNAPSHOT_LINE } };
      }
      return { ok: true, data: checkedToken(snap, entryDate, now) };
    }

    // Token information goes first and alone. Nansen answers an unknown
    // address with 200 and an empty token, so without this gate every junk
    // paste would still pay for the five flow and trader calls.
    const info = await deps.tokenInformation(chain, addr);
    if (!info.ok) {
      if (snap) {
        return { ok: true, data: { ...checkedToken(snap, entryDate, now), stale: true } };
      }
      return { ok: false, error: liveError(info.error.code) };
    }
    if (isUnknownToken(info.data)) {
      return { ok: false, error: liveError("not_found") };
    }

    const range = last24hRange(now);
    const hold = entryDate ? holdingWindow(entryDate, now) : null;
    const [flows1d, flows1h, buyers, sellers, historical] = await Promise.all([
      deps.flowIntelligence(chain, addr, "1d"),
      deps.flowIntelligence(chain, addr, "1h"),
      deps.whoBoughtSold(chain, addr, "BUY", range),
      deps.whoBoughtSold(chain, addr, "SELL", range),
      entryDate && hold
        ? deps.historicalFlowSummary(
            chain,
            addr,
            { from: hold.from, to: hold.to },
            entryDate,
          )
        : Promise.resolve(null),
    ]);

    if (flows1d.ok) {
      const rawSymbol = info.data.symbol?.trim();
      const symbol = sanitizeSymbol(
        rawSymbol && rawSymbol.length > 0 ? rawSymbol : snap?.symbol ?? "TOKEN",
      );
      const traders: TraderSides = {
        buyers: buyers.ok ? buyers.data : (snap?.traders.buyers ?? []),
        sellers: sellers.ok ? sellers.data : (snap?.traders.sellers ?? []),
      };
      const earlyFallback = snap?.earlyExit ?? null;
      const earlyExit = await withinBudget(
        resolveEarlyExit(
          chain,
          addr,
          info.data.stats.tokenDeploymentDate,
          now,
          deps,
          earlyFallback,
        ),
        deps.earlyExitBudgetMs ?? DEFAULT_EARLY_EXIT_BUDGET_MS,
        earlyFallback,
      );
      const token: TokenSnapshot = {
        chain,
        address: addr,
        symbol,
        stats: info.data.stats,
        flows1d: flows1d.data,
        flows1h: flows1h.ok ? flows1h.data : null,
        traders,
        earlyExit,
        daily: mode === "sim" ? simDaily(chain, addr, now.getTime(), 30) : [],
      };
      const history = deps.history(chain, addr, now);
      let since = null;
      if (entryDate && historical && historical.ok) {
        const windowDays = holdingWindow(entryDate, now).days;
        since = toSinceRead(
          {
            entryDate,
            volumeWindowUsd: estimatedWindowVolume(
              info.data.stats.volume24hUsd,
              windowDays,
            ),
            flows: historical.data,
            partialCoverage: isPartialCoverage(entryDate),
          },
          info.data.stats.liquidityUsd,
        );
      } else if (entryDate && snap) {
        since = checkedToken(snap, entryDate, now).since;
      }
      return {
        ok: true,
        data: toCheckedToken(
          token,
          mode === "sim" ? "sim" : "live",
          false,
          since,
          history,
        ),
      };
    }

    if (snap) {
      return { ok: true, data: { ...checkedToken(snap, entryDate, now), stale: true } };
    }

    return {
      ok: false,
      error: liveError(flows1d.ok ? "upstream" : flows1d.error.code),
    };
  }

  async function listFeaturedChecked(): Promise<CheckedToken[]> {
    if (deps.mode() === "live") {
      // Never fan out ten cold checks for a catalog. Warm rows or snapshot.
      return FEATURED.map((item) => peekCheck(item.chain, item.address)).filter(
        (row): row is CheckedToken => row !== null,
      );
    }
    const rows = await Promise.all(
      FEATURED.map((item) => resolveCheck(item.chain, item.address)),
    );
    return rows.filter((row): row is { ok: true; data: CheckedToken } => row.ok).map(
      (row) => row.data,
    );
  }

  /**
   * Verdict from the two cheapest calls only, for board rows. A failed row
   * is dropped from the board rather than shown with a made-up chip.
   */
  async function leanVerdict(chain: Chain, address: string): Promise<Verdict | null> {
    const [info, flows] = await Promise.all([
      deps.tokenInformation(chain, address),
      deps.flowIntelligence(chain, address, "1d"),
    ]);
    if (!info.ok || !flows.ok) return null;
    return scoreVerdict(info.data.stats, flows.data).verdict;
  }

  /** The Today board: biggest absolute flow shifts, chips attached. */
  async function listBoard(): Promise<BoardRow[]> {
    // The board is deferred in v1. Live would spend ~25 credits per refresh
    // on a panel nobody sees, so live serves the baked board too.
    if (deps.mode() !== "sim") {
      return deps.getBoard();
    }
    const screener = await deps.tokenScreener([...CHAINS]);
    if (!screener.ok) return deps.getBoard();
    const candidates = screener.data
      .filter((row) => row.volumeUsd >= 1_000_000)
      .sort(
        (a, b) =>
          Math.abs(flowShift(b.netflowUsd, b.volumeUsd)) -
          Math.abs(flowShift(a.netflowUsd, a.volumeUsd)),
      )
      .slice(0, BOARD_SIZE);
    const rows = await Promise.all(
      candidates.map(async (row) => {
        const verdict = await leanVerdict(row.chain, row.address);
        if (verdict === null) return null;
        return {
          chain: row.chain,
          address: row.address,
          symbol: row.symbol,
          volumeUsd: row.volumeUsd,
          netflowUsd: row.netflowUsd,
          shift: flowShift(row.netflowUsd, row.volumeUsd),
          verdict,
        } satisfies BoardRow;
      }),
    );
    return rows.filter((row): row is BoardRow => row !== null);
  }

  return {
    resolveCheck,
    peekCheck,
    listFeaturedChecked,
    listBoard,
    resolveWatchRow,
    resolveWallet,
  };
}

/** Resolve within `ms`, or give the fallback. The work keeps running and
 * warms the cache for the next visit. */
function withinBudget<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** The Today board caps at twelve rows. */
export const BOARD_SIZE = 12;

/**
 * Insider-exit read: top sellers this week vs the token's earliest buyers.
 * Two extra who-bought-sold calls when the deployment date is known; any
 * failure degrades to the snapshot's baked value, then to omission.
 */
async function resolveEarlyExit(
  chain: Chain,
  addr: string,
  deploymentRaw: string | null,
  now: Date,
  deps: ResolveDeps,
  fallback: EarlyExit | null,
): Promise<EarlyExit | null> {
  const deployDay = deploymentDayOf(deploymentRaw);
  if (!deployDay) return fallback;
  const early = earlyWindowFor(deployDay, EARLY_WINDOW_DAYS);
  const recent = recentWindow(now, RECENT_SELL_WINDOW_DAYS);
  const [earlyBuyers, recentSellers] = await Promise.all([
    deps.whoBoughtSold(chain, addr, "BUY", early, 50),
    deps.whoBoughtSold(chain, addr, "SELL", recent, 10),
  ]);
  if (
    earlyBuyers.ok &&
    recentSellers.ok &&
    earlyBuyers.data.length > 0 &&
    recentSellers.data.length > 0
  ) {
    return earlyExitOverlap(chain, earlyBuyers.data, recentSellers.data);
  }
  return fallback;
}

function backend(): FlowBackend {
  return dataMode() === "sim" ? sim : nansen;
}

export const {
  resolveCheck,
  peekCheck,
  listFeaturedChecked,
  listBoard,
  resolveWatchRow,
  resolveWallet,
} = createResolver({
  mode: () => dataMode(),
  // Real Nansen captures first; the sim fixture only for tokens not captured.
  getSnapshot: (chain, address) =>
    getLiveSnapshot(chain, address) ?? getSnapshot(chain, address),
  gate: new ColdGate(() => ({
    perClientPerHour: env.COLD_CHECKS_PER_CLIENT_HOUR,
    globalPerHour: env.COLD_CHECKS_PER_HOUR,
  })),
  resultTtlMs: () => env.CACHE_TTL_SECONDS * 1000,
  getBoard: getBoardSnapshot,
  flowIntelligence: (chain, address, timeframe) =>
    backend().flowIntelligence(chain, address, timeframe),
  tokenInformation: (chain, address) => backend().tokenInformation(chain, address),
  whoBoughtSold: (chain, address, side, date, perPage) =>
    backend().whoBoughtSold(chain, address, side, date, perPage),
  historicalFlowSummary: (chain, address, dateRange, entryDate) =>
    backend().historicalFlowSummary(chain, address, dateRange, entryDate),
  tokenScreener: (chains) => backend().tokenScreener(chains),
  history: (chain, address, now) =>
    dataMode() === "sim" ? simHistory(chain, address, now.getTime()) : [],
  now: () => Date.now(),
  walletBalance: (kind, address) => nansen.walletBalance(kind, address),
  getWalletSnapshot,
  getLeanSnapshot,
});
