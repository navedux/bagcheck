import { FEATURED } from "../../data/featured";
import tokens from "../../data/snapshot/tokens.json";
import board from "../../data/snapshot/board.json";
import { sinceYouBoughtLine } from "./copy";
import { sanitizeSymbol } from "./sanitize";
import type {
  BoardRow,
  Chain,
  CheckedToken,
  CohortFlows,
  DayFlows,
  SinceRead,
  SinceWindow,
  TokenSnapshot,
  TraderSides,
  VerdictDay,
} from "./types";
import { normalizeAddress } from "./validate";
import { scoreVerdict } from "./verdict";
import {
  estimatedWindowVolume,
  holdingWindow,
  isPartialCoverage,
} from "./window";

const emptyTraders: TraderSides = { buyers: [], sellers: [] };

/** History strips show the last 30 days. */
export const HISTORY_DAYS = 30;

const SNAPSHOTS: TokenSnapshot[] = (tokens as TokenSnapshot[]).map((row) => ({
  ...row,
  address: normalizeAddress(row.address),
  symbol: sanitizeSymbol(row.symbol),
  chain: row.chain as Chain,
  traders: row.traders ?? emptyTraders,
  earlyExit: row.earlyExit ?? null,
  daily: (row.daily ?? []) as DayFlows[],
}));

export function tokenKey(chain: Chain, address: string): string {
  return `${chain}:${normalizeAddress(address)}`;
}

export function getSnapshot(
  chain: Chain,
  address: string,
): TokenSnapshot | null {
  const key = tokenKey(chain, address);
  return SNAPSHOTS.find((row) => tokenKey(row.chain, row.address) === key) ?? null;
}

export function listFeaturedSnapshots(): TokenSnapshot[] {
  return FEATURED.map((item) => getSnapshot(item.chain, item.address)).filter(
    (row): row is TokenSnapshot => row !== null,
  );
}

/** The Today board baked at the frozen epoch. */
export function getBoardSnapshot(): BoardRow[] {
  return (board as BoardRow[]).map((row) => ({
    ...row,
    symbol: sanitizeSymbol(row.symbol),
  }));
}

function coveredOnly(flows: CohortFlows): CohortFlows {
  return {
    smartTraderNetFlowUsd: flows.smartTraderNetFlowUsd,
    whaleNetFlowUsd: 0,
    publicFigureNetFlowUsd: null,
    exchangeNetFlowUsd: 0,
    freshWalletsNetFlowUsd: flows.freshWalletsNetFlowUsd,
  };
}

function scoreDay(day: DayFlows, liquidityUsd: number | null): VerdictDay {
  const scored = scoreVerdict(
    {
      volume24hUsd: day.volumeUsd,
      marketCapUsd: null,
      liquidityUsd,
      totalHolders: null,
      tokenDeploymentDate: null,
    },
    day.flows,
  );
  return { day: day.day, verdict: scored.verdict };
}

export function historyFromDaily(
  daily: DayFlows[],
  liquidityUsd: number | null,
  days = HISTORY_DAYS,
): VerdictDay[] {
  return daily.slice(-days).map((day) => scoreDay(day, liquidityUsd));
}

export function sinceWindowFor(
  snapshot: TokenSnapshot,
  entryDate: string,
  now: Date,
): SinceWindow {
  const window = holdingWindow(entryDate, now);
  const partial = isPartialCoverage(entryDate);

  if (snapshot.daily.length > 0) {
    const rows = snapshot.daily.filter(
      (day) => day.day >= window.from && day.day <= window.to,
    );
    if (rows.length > 0) {
      const flows: CohortFlows = {
        smartTraderNetFlowUsd: 0,
        whaleNetFlowUsd: 0,
        publicFigureNetFlowUsd: 0,
        exchangeNetFlowUsd: 0,
        freshWalletsNetFlowUsd: 0,
      };
      let volumeWindowUsd = 0;
      for (const row of rows) {
        volumeWindowUsd += row.volumeUsd;
        flows.smartTraderNetFlowUsd += row.flows.smartTraderNetFlowUsd;
        flows.whaleNetFlowUsd += row.flows.whaleNetFlowUsd;
        flows.publicFigureNetFlowUsd =
          (flows.publicFigureNetFlowUsd ?? 0) + (row.flows.publicFigureNetFlowUsd ?? 0);
        flows.exchangeNetFlowUsd += row.flows.exchangeNetFlowUsd;
        flows.freshWalletsNetFlowUsd += row.flows.freshWalletsNetFlowUsd;
      }
      return {
        entryDate,
        volumeWindowUsd: Math.max(volumeWindowUsd, 1),
        flows: partial ? coveredOnly(flows) : flows,
        partialCoverage: partial,
      };
    }
  }

  return {
    entryDate,
    volumeWindowUsd: estimatedWindowVolume(snapshot.stats.volume24hUsd, window.days),
    flows: partial ? coveredOnly(snapshot.flows1d) : snapshot.flows1d,
    partialCoverage: partial,
  };
}

export function toSinceRead(window: SinceWindow, liquidityUsd: number | null): SinceRead {
  const scored = scoreVerdict(
    {
      volume24hUsd: window.volumeWindowUsd,
      marketCapUsd: null,
      liquidityUsd,
      totalHolders: null,
      tokenDeploymentDate: null,
    },
    window.flows,
  );
  return {
    entryDate: window.entryDate,
    verdict: scored.verdict,
    breakdown: scored.breakdown,
    line: sinceYouBoughtLine(window.entryDate, scored.verdict, scored.breakdown),
    partialCoverage: window.partialCoverage,
  };
}

export function toCheckedToken(
  snapshot: TokenSnapshot,
  source: CheckedToken["source"],
  stale: boolean,
  since: SinceRead | null = null,
  history: VerdictDay[] | null = null,
): CheckedToken {
  const scored = scoreVerdict(snapshot.stats, snapshot.flows1d);
  return {
    chain: snapshot.chain,
    address: snapshot.address,
    symbol: snapshot.symbol,
    stats: snapshot.stats,
    flows1d: snapshot.flows1d,
    flows1h: snapshot.flows1h,
    traders: snapshot.traders,
    earlyExit: snapshot.earlyExit,
    daily: snapshot.daily,
    verdict: scored.verdict,
    breakdown: scored.breakdown,
    source,
    stale,
    since,
    history: history ?? historyFromDaily(snapshot.daily, snapshot.stats.liquidityUsd),
  };
}

export function checkedToken(
  snapshot: TokenSnapshot,
  entryDate?: string,
  now = new Date(),
): CheckedToken {
  const since = entryDate
    ? toSinceRead(sinceWindowFor(snapshot, entryDate, now), snapshot.stats.liquidityUsd)
    : null;
  return toCheckedToken(snapshot, "snapshot", false, since);
}
