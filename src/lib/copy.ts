import type { BagTicket } from "./bag";
import type {
  Chain,
  ChainChoice,
  CohortFlows,
  EarlyExit,
  FlowCohort,
  ScoreBreakdown,
  Signal,
  TokenStats,
  Verdict,
} from "./types";
import type { ChainGuess, PasteIssue, PasteProblem } from "./validate";
import { sizeReference } from "./verdict";

export const BANNED_PHRASES = [
  "buy now",
  "sell now",
  "get out",
  "ape in",
  "to the moon",
  "guaranteed",
  "safe to hold",
  "smart money is dcaing",
] as const;

export const VERDICT_COPY: Record<Verdict, string> = {
  "still-bid": "Traders and whales are still adding.",
  "retail-pump": "Fresh wallets are the bid. Late, not strong.",
  distribution: "Flow is leaving toward exchanges.",
  split: "Traders and whales disagree.",
  quiet: "No meaningful cohort flow.",
  "too-thin": "Liquidity is below the floor for this method.",
};

export const SIGNAL_LABEL: Record<Signal, string> = {
  buy: "Buy signal",
  hold: "Hold signal",
  sell: "Sell signal",
  "dont-buy": "Don't buy signal",
  wait: "Wait",
  "no-read": "No read",
};

export const SIGNAL_FORK_HINT = "Holding this? Add the day you bought.";
export const RULE_ECHO = "Your rule: sell.";

export const VERDICT_LABEL: Record<Verdict, string> = {
  "still-bid": "Still bid",
  "retail-pump": "Retail pump",
  distribution: "Distribution",
  split: "Split",
  quiet: "Quiet",
  "too-thin": "Too thin",
};

/** Single-cell marks for the 30-day signal strip. */
export const VERDICT_TICK: Record<Verdict, string> = {
  "still-bid": "⌃",
  "retail-pump": "ˆ",
  distribution: "⌄",
  split: "×",
  quiet: "-",
  "too-thin": "·",
};

export const ATTRIBUTION_LABEL = "Powered by Nansen API";
export const ATTRIBUTION_HREF = "https://nansen.ai";

/**
 * Footer mode label. In sim the data is generated locally, so the credit
 * names the engine the sim stands in for rather than claiming the source.
 */
export const MODE_PREFIX: Record<"live" | "sim" | "snapshot", string> = {
  live: "Live",
  sim: "Simulated flows",
  snapshot: "Snapshot",
};

export const MODE_CREDIT: Record<"live" | "sim" | "snapshot", string> = {
  live: ATTRIBUTION_LABEL,
  sim: "Built on Nansen API",
  snapshot: ATTRIBUTION_LABEL,
};

export const PARTIAL_COVERAGE_LINE =
  "Whale, public figure, and exchange labels start 11 Mar 2025. This window only uses covered cohorts.";

export const TRADERS_CAPTION = "Top wallets by net DEX volume. Addresses only, no labels.";
export const TRADERS_EMPTY_BUY = "No buyers in this window.";
export const TRADERS_EMPTY_SELL = "No sellers in this window.";
export const FLOW_EMPTY = "No cohort flow to plot.";
export const STRIP_EMPTY = "No 30-day field yet.";

export const EMPTY_SNAPSHOT_HEAD = "Not in this demo.";
export const EMPTY_SNAPSHOT_LINE =
  "This demo has saved reads for the featured tokens only. Run it locally with a Nansen key to check any token.";

export const RATE_LIMIT_HEAD = "Too many checks.";
export const RATE_LIMIT_LINE = "Wait a minute, then try again.";

export const MISSING_CHAIN_HEAD = "That chain is not supported.";
export const MISSING_CHAIN_LINE = "Hold Check reads Solana, Ethereum, and Base.";
export const MISSING_ADDRESS_HEAD = "That is not a token address.";
export const MISSING_TOKEN_HEAD = "No read for this token.";
export const MISSING_LIVE_HEAD = "Could not read this token.";
export const BUSY_HEAD = "Hourly limit reached.";
export const LIVE_NOT_FOUND =
  "Nansen has no flow data for this token on this chain. Check the chain, or try another token.";
export const LIVE_AUTH = "Nansen did not accept the request. Try again later.";
export const LIVE_UNAVAILABLE = "Nansen is not responding right now. Try again in a minute.";
export const LIVE_BUSY =
  "Too many new tokens from your network this hour. Try a featured token, or come back later.";

export const STALE_REASON =
  "Live read unavailable. Showing the last saved read.";

export const HOME_EYEBROW = "One token. One signal.";
export const HOME_HEAD = "A buy, hold, or sell signal.";
export const HOME_NEXT =
  "Paste a token address. One signal from 24 hours of Nansen cohort flow: traders, whales, fresh wallets, exchanges.";
export const HOME_OR = "Or try one of these";
export const HOME_AGAIN = "Check another token";
export const PASTE_PLACEHOLDER = "Token address";
export const PASTE_ERROR = "Paste a token address on Solana, Ethereum, or Base.";
export const PASTE_EMPTY = "Paste a token address.";
export const PASTE_INCOMPLETE = "That address is incomplete.";
export const PASTE_INVALID = "That is not a token address.";
export const PASTE_TOO_LONG = "That address is too long.";
export const PASTE_NEED_0X = "Ethereum and Base addresses start with 0x.";
export const PASTE_CHAIN_EVM = "That token address is for Ethereum or Base. Switch the chain.";
export const PASTE_CHAIN_SOL = "That token address is for Solana. Switch the chain.";
export const PASTE_PENDING = "Checking";
export const CHECK_LOADING = "Reading 24h cohort flow from Nansen.";
export const CHAIN_AUTO = "Auto";
export const CHAIN_MENU = "Chain";
export const CHAIN_AUTO_HINT = "Read from the token address.";
export const CHAIN_AUTO_EVM = "Ethereum or Base. Switch if this is Base.";
export const CHAIN_LABEL: Record<Chain, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  base: "Base",
};

export function chainAutoHint(guess: ChainGuess | null): string {
  if (!guess) return CHAIN_AUTO_HINT;
  if (guess.chain === "solana") return "This address is Solana.";
  if (guess.fromCatalog) {
    return guess.chain === "base" ? "This address is Base." : "This address is Ethereum.";
  }
  return CHAIN_AUTO_EVM;
}

export function pasteAutoLine(
  choice: ChainChoice,
  guess: ChainGuess | null,
  issue: PasteIssue,
): string | null {
  if (choice !== "auto" || issue !== "ok") return null;
  return chainAutoHint(guess);
}

export function pasteLine(issue: PasteProblem): string {
  if (issue === "empty") return PASTE_EMPTY;
  if (issue === "incomplete") return PASTE_INCOMPLETE;
  if (issue === "too-long") return PASTE_TOO_LONG;
  if (issue === "need-0x") return PASTE_NEED_0X;
  if (issue === "chain-evm") return PASTE_CHAIN_EVM;
  if (issue === "chain-solana") return PASTE_CHAIN_SOL;
  return PASTE_INVALID;
}

export type MissingKind =
  | "chain"
  | "address"
  | "snapshot"
  | "rate"
  | "not-found"
  | "busy"
  | "unavailable";

export function missingKindFromCode(code: string): MissingKind {
  if (code === "not_in_snapshot") return "snapshot";
  if (code === "not_found") return "not-found";
  if (code === "busy") return "busy";
  return "unavailable";
}

export function missingCopy(kind: MissingKind): { title: string; reason: string } {
  if (kind === "chain") return { title: MISSING_CHAIN_HEAD, reason: MISSING_CHAIN_LINE };
  if (kind === "address") return { title: MISSING_ADDRESS_HEAD, reason: PASTE_ERROR };
  if (kind === "rate") return { title: RATE_LIMIT_HEAD, reason: RATE_LIMIT_LINE };
  if (kind === "not-found") return { title: MISSING_TOKEN_HEAD, reason: LIVE_NOT_FOUND };
  if (kind === "unavailable") return { title: MISSING_LIVE_HEAD, reason: LIVE_UNAVAILABLE };
  if (kind === "busy") return { title: BUSY_HEAD, reason: LIVE_BUSY };
  return { title: EMPTY_SNAPSHOT_HEAD, reason: EMPTY_SNAPSHOT_LINE };
}

export const WATCH_HEAD = "Your list";
export const WATCH_READING = "Reading…";
export const WATCH_LIST_EMPTY = "No tokens on your list yet.";
export const WATCH_ADD = "Add tokens";
export const WATCH_ADD_TITLE = "Add to your list";
export const WATCH_ADD_SEARCH = "Search featured tokens or paste";
export const WATCH_ADD_EMPTY = "No tokens match that search. Paste a token address below.";
export const WATCH_ADD_NONE = "Paste a token address below.";
export const WATCH_ADD_LOAD = "Reading tokens.";
export const WATCH_ADD_FAIL = "Showing the featured set. Live catalog did not load.";
export const WATCH_ADD_ON = "On your list";
export const WATCH_PIN = "Add to list";
export const WATCH_REMOVE = "Remove from your list";
export const WATCH_REMOVE_SHORT = "Remove";
export const WATCH_ADD_ACTION = "Add";
export const WATCH_ADD_FULL = "Your list is full. Remove one to add another.";
export const WATCH_ADD_PASTE = "Or paste a token address";
export const WATCH_ADD_CLOSE = "Close";
export const WATCH_ADD_RETRY = "Try again";
export const WATCH_LIST_FAIL = "Could not refresh your list. Open a row to read it.";

export function watchAddListEmpty(
  query: string,
  load: "loading" | "ok" | "fallback",
): string {
  if (query.trim()) return WATCH_ADD_EMPTY;
  if (load === "loading") return WATCH_ADD_LOAD;
  return WATCH_ADD_NONE;
}

export const COL_STRIP = "30 days";
export const COL_SIGNAL = "Signal";
export const COL_SHIFT = "Shift";
export const BOARD_HEAD = "Today";
export const BOARD_CAPTION = "Open a row. Ranked by flow shift as a share of 24h volume.";

export function flipSinceVisitLine(from: Verdict): string {
  return `Was ${VERDICT_LABEL[from]} on your last visit.`;
}

export function flipRecentLine(days: number): string {
  if (days <= 0) return "Flipped today.";
  if (days === 1) return "Flipped yesterday.";
  return `Flipped ${days}d ago.`;
}

export const ACTION_HEAD = "On this token";
export const ACTION_DATE = "Bought on";
export const ACTION_DATE_HINT =
  "Turns a buy signal into a hold signal, and don't-buy into a sell signal.";
export const ACTION_DATE_EMPTY = "Not holding";
export const ACTION_DATE_CLEAR = "Clear";
export const ACTION_DATE_PREV = "Previous month";
export const ACTION_DATE_NEXT = "Next month";
export const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatMonthYear(year: number, monthIndex: number): string {
  const month = MONTH_SHORT[monthIndex];
  return month ? `${month} ${year}` : `${year}`;
}
export const ACTION_RULE = "Rule";
export const ACTION_FOLLOW = "Home list";
export const ACTION_FOLLOW_ON = "Pinned";
export const ACTION_FOLLOW_OFF = "Not pinned";
export const ACTION_NOTES = "Size and cost";
export const ACTION_NOTES_HINT = "Stored on this device. They do not change the signal.";
export const ACTION_COPY = "Copy link";
export const WINDOW_RAIL =
  "Holding changes the word, not the read: buy becomes hold, don't-buy becomes sell.";
export const CLOCK_24H = "Last 24 hours.";
export const SCORE_MARK = "Net flow as a share of 24h volume. The tick is the 6% line.";
export const COL_SINCE = "Since you bought";
export const FLOW_HEAD = "In and out, 24h";
export const FLOW_IN = "In";
export const FLOW_OUT = "Out";
export const FLOW_NET = "Net";
export const FLOW_CAPTION = "Cohort net flow as a share of 24h volume.";
export const FLOW_LABEL: Record<FlowCohort, string> = {
  traders: "Traders",
  whales: "Whales",
  fresh: "Fresh",
  figures: "Figures",
  exchanges: "Exchanges",
};

export function flowNetLine(signedUsd: string, signedPct: string): string {
  return `Net ${signedUsd}. ${signedPct} of 24h volume.`;
}

export const TOAST_DATE = "Holding window set.";
export const TOAST_DATE_CLEARED = "Holding window cleared.";
export const TOAST_RULE = "Rule saved on this device.";
export const TOAST_FOLLOW = "Pinned on home.";
export const TOAST_UNFOLLOW = "Removed from home.";
export const TOAST_FOLLOW_FULL = "List is full. Twenty tokens is the cap.";
export const TOAST_FOLLOW_FAIL = "Could not save on this device.";
export const TOAST_COPIED = "Link copied.";

export const WATCH_UNSET = ACTION_DATE_EMPTY;

export function reasonFor(verdict: Verdict): string {
  return VERDICT_COPY[verdict];
}

export function holdingLine(entryDate: string): string {
  return `Holding since ${formatEntryDay(entryDate)}.`;
}

export function clockLine(entryDate?: string): string {
  if (!entryDate) return CLOCK_24H;
  return `${CLOCK_24H} ${holdingLine(entryDate)}`;
}

export function copyContainsBannedPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some((phrase) => lower.includes(phrase));
}

const ORDINAL_WORDS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth",
] as const;

export function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n - 1] ?? `${n}th`;
}

/**
 * The stability caption under the 30-day strip: how long the current read
 * has held and how often it flips. Credibility texture, not a claim.
 */
export function stabilityLine(
  runDays: number,
  flips: number,
  windowDays: number,
): string {
  if (runDays <= 0) return "";
  if (flips === 0) {
    return `Unchanged for ${Math.min(runDays, windowDays)} days.`;
  }
  if (runDays === 1) {
    return `New read today. ${ordinalWord(flips)} flip in ${windowDays} days.`;
  }
  return `This read is ${runDays} days old. ${ordinalWord(flips)} flip in ${windowDays} days.`;
}

/**
 * The insider-exit line under the traders panel. Factual overlap between
 * this week's top sellers and the token's earliest buyers. Never "insider".
 */
export function earlyExitLine(earlyExit: EarlyExit): string {
  const { overlap, sellers, earlyDays } = earlyExit;
  if (overlap === 0) {
    return `None of the top ${sellers} sellers this week were early buyers.`;
  }
  if (overlap === 1) {
    return `1 of the top ${sellers} sellers this week bought in the token's first ${earlyDays} days.`;
  }
  return `${overlap} of the top ${sellers} sellers this week bought in the token's first ${earlyDays} days.`;
}

export function formatEntryDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function sinceYouBoughtLine(
  entryDate: string,
  verdict: Verdict,
  breakdown: ScoreBreakdown,
): string {
  const when = formatEntryDay(entryDate);
  if (verdict === "distribution") {
    const added = Math.max(breakdown.st, 0);
    if (breakdown.ex > 0 && added > 0) {
      const ratio = breakdown.ex / added;
      const shown = ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1);
      return `Since you bought on ${when}, exchanges took in ${shown}x more than traders added.`;
    }
    return `Since you bought on ${when}, flow has been leaving toward exchanges.`;
  }
  if (verdict === "still-bid") {
    return `Since you bought on ${when}, cohorts have still been adding.`;
  }
  if (verdict === "retail-pump") {
    return `Since you bought on ${when}, fresh wallets have been the bid.`;
  }
  if (verdict === "split") {
    return `Since you bought on ${when}, traders and whales have disagreed.`;
  }
  if (verdict === "too-thin") {
    return `Since you bought on ${when}, the window is still too thin to read.`;
  }
  return `Since you bought on ${when}, cohort flow has been quiet.`;
}

export function watchStatus(ticket: BagTicket): string {
  return ticket.entryDate ? formatEntryDay(ticket.entryDate) : WATCH_UNSET;
}

export function hourTick(stats: TokenStats, flows: CohortFlows): string {
  const { ref } = sizeReference(stats);
  const net = (3 * flows.smartTraderNetFlowUsd + 1.5 * flows.whaleNetFlowUsd) / ref;
  if (Math.abs(net) < 0.01) return "Last hour: quiet.";
  if (net > 0) return "Last hour: cohorts adding.";
  return "Last hour: cohorts leaving.";
}
