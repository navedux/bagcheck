import "server-only";

import { FEATURED } from "../../data/featured";
import { dataMode } from "./env";
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
  type ScreenerToken,
  type TokenSnapshot,
  type TokenStats,
  type TraderPrint,
  type TraderSides,
  type Verdict,
  type VerdictDay,
} from "./types";
import { EMPTY_SNAPSHOT_LINE, LIVE_AUTH, LIVE_NOT_FOUND, LIVE_UNAVAILABLE } from "./copy";
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
};

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
  async function resolveCheck(
    chain: Chain,
    address: string,
    entryDate?: string,
  ): Promise<ResolveResult> {
    const addr = normalizeAddress(address);
    const snap = deps.getSnapshot(chain, addr);
    const now = new Date(deps.now());
    const mode = deps.mode();

    if (mode === "snapshot") {
      if (!snap) {
        return { ok: false, error: { code: "not_in_snapshot", message: EMPTY_SNAPSHOT_LINE } };
      }
      return { ok: true, data: checkedToken(snap, entryDate, now) };
    }

    const range = last24hRange(now);
    const hold = entryDate ? holdingWindow(entryDate, now) : null;
    const [info, flows1d, flows1h, buyers, sellers, historical] = await Promise.all([
      deps.tokenInformation(chain, addr),
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

    if (info.ok && flows1d.ok) {
      const rawSymbol = info.data.symbol?.trim();
      const symbol = sanitizeSymbol(
        rawSymbol && rawSymbol.length > 0 ? rawSymbol : snap?.symbol ?? "TOKEN",
      );
      const traders: TraderSides = {
        buyers: buyers.ok ? buyers.data : (snap?.traders.buyers ?? []),
        sellers: sellers.ok ? sellers.data : (snap?.traders.sellers ?? []),
      };
      const earlyExit = await resolveEarlyExit(
        chain,
        addr,
        info.data.stats.tokenDeploymentDate,
        now,
        deps,
        snap?.earlyExit ?? null,
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

    const failed = !info.ok ? info.error : !flows1d.ok ? flows1d.error : null;
    return {
      ok: false,
      error: liveError(failed?.code ?? "upstream"),
    };
  }

  async function listFeaturedChecked(): Promise<CheckedToken[]> {
    const results = await Promise.all(
      FEATURED.map((item) => resolveCheck(item.chain, item.address)),
    );
    return results.filter((row): row is { ok: true; data: CheckedToken } => row.ok).map(
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
    if (deps.mode() === "snapshot") {
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

  return { resolveCheck, listFeaturedChecked, listBoard };
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

export const { resolveCheck, listFeaturedChecked, listBoard } = createResolver({
  mode: () => dataMode(),
  getSnapshot,
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
});
