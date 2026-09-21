export const CHAINS = ["solana", "ethereum", "base"] as const;
export type Chain = (typeof CHAINS)[number];
export type ChainChoice = "auto" | Chain;

/** Official domains per chain: Logo.dev domain lookup keys for chain marks. */
export const CHAIN_DOMAIN: Record<Chain, string> = {
  solana: "solana.com",
  ethereum: "ethereum.org",
  base: "base.org",
};

export type DataMode = "snapshot" | "sim" | "live";

export type Verdict =
  | "too-thin"
  | "still-bid"
  | "retail-pump"
  | "distribution"
  | "split"
  | "quiet";

export type BagRule = "fold-on-distribution" | "fold-on-retail-pump" | "off";

/**
 * The easy word the 24h chip translates to, given whether the visitor
 * set an entry date. Derived in verdict.ts, phrased in copy.ts.
 */
export type Signal = "buy" | "hold" | "sell" | "dont-buy" | "wait" | "no-read";

export type CohortFlows = {
  smartTraderNetFlowUsd: number;
  whaleNetFlowUsd: number;
  publicFigureNetFlowUsd: number | null;
  exchangeNetFlowUsd: number;
  freshWalletsNetFlowUsd: number;
};

export type TokenStats = {
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  totalHolders: number | null;
  tokenDeploymentDate: string | null;
};

export type ScoreBreakdown = {
  ref: number;
  refKind: "volume" | "marketCap" | "one";
  st: number;
  wh: number;
  fr: number;
  ex: number;
  bid: number;
  retail: number;
  dist: number;
};

/** One cohort on the 24h in/out bridge. usd is signed: arriving +, leaving -. */
export type FlowCohort = "traders" | "whales" | "fresh" | "figures" | "exchanges";

export type FlowLeg = {
  key: FlowCohort;
  usd: number;
  share: number;
  side: "in" | "out";
};

export type FlowBridge = {
  legs: FlowLeg[];
  ins: FlowLeg[];
  outs: FlowLeg[];
  inUsd: number;
  outUsd: number;
  netUsd: number;
  inShare: number;
  outShare: number;
  netShare: number;
};

export type TraderPrint = {
  address: string;
  boughtVolumeUsd: number;
  soldVolumeUsd: number;
};

export type TraderSides = {
  buyers: TraderPrint[];
  sellers: TraderPrint[];
};

/**
 * Insider-exit read: how many of this week's top sellers were among the
 * token's earliest buyers. Addresses only: never labels.
 */
export type EarlyExit = {
  sellers: number;
  earlyBuyers: number;
  overlap: number;
  windowDays: number;
  earlyDays: number;
};

export type SinceWindow = {
  entryDate: string;
  volumeWindowUsd: number;
  flows: CohortFlows;
  partialCoverage: boolean;
};

/** One simulated day: the flows and the volume they normalize against. */
export type DayFlows = {
  day: string;
  volumeUsd: number;
  flows: CohortFlows;
};

/** One day's verdict, oldest to newest. Drives the signal strip. */
export type VerdictDay = {
  day: string;
  verdict: Verdict;
};

export type SinceRead = {
  entryDate: string;
  verdict: Verdict;
  breakdown: ScoreBreakdown;
  line: string;
  partialCoverage: boolean;
};

export type TokenSnapshot = {
  chain: Chain;
  address: string;
  symbol: string;
  stats: TokenStats;
  flows1d: CohortFlows;
  flows1h: CohortFlows | null;
  traders: TraderSides;
  earlyExit: EarlyExit | null;
  daily: DayFlows[];
};

export type CheckedToken = TokenSnapshot & {
  verdict: Verdict;
  breakdown: ScoreBreakdown;
  source: "live" | "snapshot" | "sim";
  stale: boolean;
  since: SinceRead | null;
  history: VerdictDay[];
};

export type FollowItem = {
  chain: Chain;
  address: string;
  symbol: string;
};

/** Lean row for the home watchlist: no daily flows, just the read. */
export type WatchRow = {
  chain: Chain;
  address: string;
  symbol: string;
  verdict: Verdict;
  stale: boolean;
  history: VerdictDay[];
  volumeUsd: number | null;
};

/** One row of screener output: a token and its 24h market-wide net flow. */
export type ScreenerToken = {
  chain: Chain;
  address: string;
  symbol: string;
  volumeUsd: number;
  netflowUsd: number;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
};

/**
 * One row of the Today board: a mover with its verdict. Shift is netflow as
 * a signed fraction of 24h volume, so a major and a memecoin compare fairly.
 */
export type BoardRow = {
  chain: Chain;
  address: string;
  symbol: string;
  volumeUsd: number;
  netflowUsd: number;
  shift: number;
  verdict: Verdict;
};
