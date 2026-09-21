import type {
  Chain,
  CohortFlows,
  EarlyExit,
  FlowBridge,
  FlowCohort,
  FlowLeg,
  ScoreBreakdown,
  Signal,
  TokenStats,
  TraderPrint,
  Verdict,
  VerdictDay,
} from "./types";

/**
 * Positive exchange_net_flow_usd is treated as tokens moving onto exchanges
 * (sell pressure). OpenAPI for historical-token-flow-summary says
 * deposit-to-exchange is positive. Still unverified on two live tokens
 * (spec 2.3). Flip this constant, not the formula.
 */
export const EXCHANGE_SIGN = 1 as const;

/** Frozen Sep 23 against the featured snapshot set. */
export const T = 0.06;
export const T_QUIET = 0.01;
export const LIQUIDITY_FLOOR_USD = 25_000;
export const VOLUME_FLOOR_USD = 10_000;
/**
 * Nansen reports liquidity_usd as 0 for wrapped natives and CEX-heavy majors
 * (verified live Sep 19: WSOL $4.8B vol, WETH $248M vol, both liquidity 0).
 * Untracked liquidity is not zero liquidity, so those tokens floor on volume
 * alone at a stricter bar.
 */
export const UNTRACKED_LIQUIDITY_VOLUME_FLOOR_USD = 250_000;

export function isTooThin(stats: TokenStats): boolean {
  const volume = stats.volume24hUsd;
  if (volume == null) return true;
  const liquidity = stats.liquidityUsd;
  if (liquidity == null || liquidity <= 0) {
    return volume < UNTRACKED_LIQUIDITY_VOLUME_FLOOR_USD;
  }
  return liquidity < LIQUIDITY_FLOOR_USD || volume < VOLUME_FLOOR_USD;
}

export function sizeReference(stats: TokenStats): {
  ref: number;
  refKind: ScoreBreakdown["refKind"];
} {
  const volume = stats.volume24hUsd;
  const sizeRef = Math.max(volume ?? 0, 1);
  const fallbackRef = Math.max(stats.marketCapUsd ?? 0, 1);
  if (volume != null && volume > VOLUME_FLOOR_USD) {
    return { ref: sizeRef, refKind: "volume" };
  }
  if (stats.marketCapUsd != null && stats.marketCapUsd > 0) {
    return { ref: fallbackRef, refKind: "marketCap" };
  }
  return { ref: 1, refKind: "one" };
}

export function scoreVerdict(
  stats: TokenStats,
  flows: CohortFlows,
): { verdict: Verdict; breakdown: ScoreBreakdown } {
  const { ref, refKind } = sizeReference(stats);
  const n = (flowUsd: number) => flowUsd / ref;
  const st = n(flows.smartTraderNetFlowUsd);
  const wh = n(flows.whaleNetFlowUsd);
  const fr = n(flows.freshWalletsNetFlowUsd);
  const ex = n(flows.exchangeNetFlowUsd) * EXCHANGE_SIGN;
  const bid = 3 * st + 1.5 * wh;
  const retail = fr;
  const dist = ex - Math.min(st, 0);

  const breakdown: ScoreBreakdown = {
    ref,
    refKind,
    st,
    wh,
    fr,
    ex,
    bid,
    retail,
    dist,
  };

  if (isTooThin(stats)) {
    return { verdict: "too-thin", breakdown };
  }
  if (bid >= T && dist < T / 2 && retail < bid) {
    return { verdict: "still-bid", breakdown };
  }
  // Retail leads when fresh wallets clear T and outsize the smart bid. Live
  // data Sep 19: real pumps often carry both (PEPE retail 0.81, bid 0.075),
  // so "bid absent" alone under-called retail-led days.
  if (retail >= T && retail > bid) {
    return { verdict: "retail-pump", breakdown };
  }
  if (dist >= T || (st < -T && ex > 0)) {
    return { verdict: "distribution", breakdown };
  }
  if (signsDisagree(st, wh) && Math.abs(st) >= T / 2 && Math.abs(wh) >= T / 2) {
    return { verdict: "split", breakdown };
  }
  return { verdict: "quiet", breakdown };
}

function signsDisagree(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  return Math.sign(a) !== Math.sign(b);
}

export function signalFor(verdict: Verdict, holding: boolean): Signal {
  if (verdict === "too-thin") return "no-read";
  if (verdict === "split") return "wait";
  if (!holding) {
    if (verdict === "still-bid") return "buy";
    if (verdict === "distribution") return "dont-buy";
    return "wait";
  }
  if (verdict === "distribution") return "sell";
  return "hold";
}

/** Days the current read has held, counting back from the newest day. */
export function runLengthDays(history: VerdictDay[]): number {
  const last = history[history.length - 1]?.verdict;
  if (last === undefined) return 0;
  let run = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.verdict !== last) break;
    run += 1;
  }
  return run;
}

/** Verdict changes across the window. */
export function flipCount(history: VerdictDay[]): number {
  let flips = 0;
  for (let i = 1; i < history.length; i += 1) {
    if (history[i]?.verdict !== history[i - 1]?.verdict) flips += 1;
  }
  return flips;
}

/** Insider-exit windows: first 10 days of the token's life vs the last 7. */
export const EARLY_WINDOW_DAYS = 10;
export const RECENT_SELL_WINDOW_DAYS = 7;

/**
 * Net flow as a signed fraction of 24h volume. The board ranks by its
 * absolute value, so a major and a memecoin compare by relative pressure.
 */
export function flowShift(netflowUsd: number, volumeUsd: number): number {
  return netflowUsd / Math.max(volumeUsd, 1);
}

/** Drop noise so the bridge does not draw a band for a rounding crumb. */
const FLOW_BAND_FLOOR_USD = 1;

/**
 * Map 24h cohort nets onto an in/out bridge. Positive usd is capital
 * arriving. Exchange deposits (positive raw, EXCHANGE_SIGN +1) are leaving.
 */
export function flowBridge(flows: CohortFlows, ref: number): FlowBridge {
  const denom = Math.max(ref, 1);
  const raw: { key: FlowCohort; usd: number }[] = [
    { key: "traders", usd: flows.smartTraderNetFlowUsd },
    { key: "whales", usd: flows.whaleNetFlowUsd },
    { key: "fresh", usd: flows.freshWalletsNetFlowUsd },
    { key: "exchanges", usd: -EXCHANGE_SIGN * flows.exchangeNetFlowUsd },
  ];
  if (flows.publicFigureNetFlowUsd != null) {
    raw.push({ key: "figures", usd: flows.publicFigureNetFlowUsd });
  }

  const legs: FlowLeg[] = raw
    .filter((row) => Math.abs(row.usd) >= FLOW_BAND_FLOOR_USD)
    .map((row) => ({
      key: row.key,
      usd: row.usd,
      share: row.usd / denom,
      side: row.usd >= 0 ? ("in" as const) : ("out" as const),
    }))
    .sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd));

  const ins = legs.filter((leg) => leg.side === "in");
  const outs = legs.filter((leg) => leg.side === "out");
  const inUsd = ins.reduce((sum, leg) => sum + leg.usd, 0);
  const outUsd = outs.reduce((sum, leg) => sum + Math.abs(leg.usd), 0);
  const netUsd = inUsd - outUsd;

  return {
    legs,
    ins,
    outs,
    inUsd,
    outUsd,
    netUsd,
    inShare: inUsd / denom,
    outShare: outUsd / denom,
    netShare: netUsd / denom,
  };
}

/**
 * Count of this week's top sellers that also appear among the earliest
 * buyers. EVM addresses are case-insensitive; solana base58 is not.
 */
export function earlyExitOverlap(
  chain: Chain,
  earlyBuyers: TraderPrint[],
  recentSellers: TraderPrint[],
): EarlyExit {
  const norm = (address: string) =>
    chain === "solana" ? address : address.toLowerCase();
  const pool = new Set(earlyBuyers.map((row) => norm(row.address)));
  const overlap = recentSellers.filter((row) => pool.has(norm(row.address))).length;
  return {
    sellers: recentSellers.length,
    earlyBuyers: earlyBuyers.length,
    overlap,
    windowDays: RECENT_SELL_WINDOW_DAYS,
    earlyDays: EARLY_WINDOW_DAYS,
  };
}
