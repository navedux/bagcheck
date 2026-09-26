import type { BagTicket } from "./bag";
import type {
  Chain,
  ChainChoice,
  CohortFlows,
  EarlyExit,
  FlowCohort,
  SavedWhy,
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
  "still-bid": "Smart traders and whales are still buying.",
  "retail-pump": "New wallets are doing all the buying. Nobody big is in.",
  distribution: "Tokens are heading to exchanges. That's usually someone selling.",
  split: "Smart traders and whales are pulling opposite ways.",
  quiet: "Nobody's moving much either way.",
  "too-thin": "Too little trading to tell anything.",
};

export const SIGNAL_LABEL: Record<Signal, string> = {
  buy: "Looks good",
  hold: "Hold",
  sell: "Time to go",
  "dont-buy": "Stay away",
  wait: "Wait",
  "no-read": "Can't tell",
};

export const SIGNAL_FORK_HINT = "Already holding? Add the day you bought.";
export const RULE_ECHO = "Your rule: sell.";

export const VERDICT_LABEL: Record<Verdict, string> = {
  "still-bid": "Still buying",
  "retail-pump": "Retail rush",
  distribution: "Cashing out",
  split: "Mixed",
  quiet: "Quiet",
  "too-thin": "Too small",
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
  "Nansen's whale and exchange tags start on 11 Mar 2025, so this window only counts what was tagged.";

export const TRADERS_HEAD = "Biggest buyers and sellers today";
export const TRADERS_CAPTION = "Top wallets by DEX volume in the last 24 hours.";
export const TRADERS_EMPTY_BUY = "No big buyers today.";
export const TRADERS_EMPTY_SELL = "No big sellers today.";
export const FLOW_EMPTY = "Nothing moved enough to draw.";
export const STRIP_EMPTY = "No 30-day field yet.";

export const EMPTY_SNAPSHOT_HEAD = "Not in this demo.";
export const EMPTY_SNAPSHOT_LINE =
  "This demo only has the featured tokens saved. Run it with a Nansen key to check anything.";

export const RATE_LIMIT_HEAD = "Easy there.";
export const RATE_LIMIT_LINE = "Give it a minute, then try again.";

export const MISSING_CHAIN_HEAD = "That chain is not supported.";
export const MISSING_CHAIN_LINE = "Bagcheck reads Solana, Ethereum, and Base.";
export const MISSING_ADDRESS_HEAD = "That's not a token address.";
export const MISSING_TOKEN_HEAD = "Never heard of it.";
export const MISSING_LIVE_HEAD = "Couldn't check that one.";
export const BUSY_HEAD = "Slow down a little.";
export const LIVE_NOT_FOUND =
  "Nansen has nothing on this token on this chain. Double-check the chain, or try another one.";
export const LIVE_AUTH = "Nansen did not accept the request. Try again later.";
export const LIVE_UNAVAILABLE = "Nansen isn't answering right now. Try again in a minute.";
export const WALLET_NOT_IN_DEMO =
  "This demo only has one sample wallet saved. Run it with a Nansen key to check any wallet.";
export const LIVE_BUSY =
  "You've checked a lot of new tokens this hour. The featured ones still work, or come back in a bit.";

export const STALE_REASON =
  "Couldn't reach Nansen, so this is the last saved read.";
export const STALE_CREDITS = "Today's live checks are used up, so this is the last saved read.";
export const SAVED_SAMPLE = "Saved data, not live. It uses no credits.";

/** The line under a saved read, by why it isn't live. */
export function staleReason(why?: SavedWhy): string {
  if (why === "credits") return STALE_CREDITS;
  if (why === "sample") return SAVED_SAMPLE;
  return STALE_REASON;
}

export const OUT_OF_CREDITS_HEAD = "Out of live checks for today.";
export const OUT_OF_CREDITS_LINE =
  "Bagcheck reads Nansen live on a shared daily budget, and today's credits are spent. Live checks come back at midnight UTC.";

/** The out-of-credits line with how long until midnight UTC. */
export function outOfCreditsLine(hoursLeft: number): string {
  const when = hoursLeft <= 1 ? "in under an hour" : `in about ${hoursLeft} hours`;
  return `Bagcheck reads Nansen live on a shared daily budget, and today's credits are spent. Live checks come back at midnight UTC, ${when}.`;
}

export const SAVED_TRY_HEAD = "Try it with saved data";
export const SAVED_TRY_LINE = "Real Nansen reads we saved earlier. Opening them uses no credits.";
export const SAVED_WALLET = "Sample wallet";
export const SAVED_MISSING_HEAD = "No saved read for this one.";
export const SAVED_MISSING_LINE = "Saved data covers a few tokens and one sample wallet. Pick one below.";
export const LIVE_PAUSED = "Live checks are used up for today. They come back at midnight UTC.";
export const LIVE_PAUSED_LINK = "Try it with saved data";

export const HOME_EYEBROW = "Before you buy. While you hold.";
export const HOME_HEAD = "Who's buying your bag?";
export const HOME_NEXT =
  "Paste a token. We check who bought and sold it on Nansen in the last 24 hours (whales, smart traders, new wallets, exchanges) and tell you straight.";
export const HOME_OR = "Or try one";
export const HOME_AGAIN = "Check another bag";
export const PASTE_PLACEHOLDER = "Paste a token address";
export const PASTE_SUBMIT = "Check";
export const PASTE_MODE_TOKEN = "Token";
export const PASTE_MODE_WALLET = "Wallet";
export const PASTE_MODE_LABEL = "What are you pasting?";
export const WALLET_PLACEHOLDER = "Paste a wallet address";
export const WALLET_SUBMIT = "Check bags";
export const WALLET_EMPTY = "Paste a wallet address.";
export const WALLET_INVALID = "That's not a Solana, Ethereum, or Base wallet.";
export const WALLET_HINT_EVM = "Checks Ethereum and Base together.";
export const WALLET_HINT_SOL = "Solana wallet.";
export const HOME_NEXT_WALLET =
  "Paste your wallet. We look at your biggest bags and tell you which ones people are cashing out of.";
export const WALLET_SAMPLE = "Try a sample wallet";
export const WALLET_EYEBROW = "Your bags, checked";
export const WALLET_ASSUME = "Answers assume you hold these. Last 24 hours of Nansen wallet flow.";
export const WALLET_ADD_ALL = "Add all to bags";
export const WALLET_ADDED_ALL = "In your bags";
export const WALLET_COL_VALUE = "Value";
export const WALLET_CHECK = "Check";
export const WALLET_FOOT =
  "Your 10 biggest holdings on Solana, Ethereum, and Base worth $10 or more, stablecoins left out. The top 5 are read automatically; tap Check for the rest.";
export const WALLET_EMPTY_HEAD = "Nothing we can read here.";
export const WALLET_EMPTY_LINE =
  "We only check Solana, Ethereum, and Base tokens worth $10 or more, and this wallet has none right now.";
export const WALLET_LOADING = "Asking Nansen what's in this wallet…";
export const WALLET_NATIVE = "Read through WETH";
export const WALLET_BAD_HEAD = "That's not a wallet address.";

export function walletAddedLine(count: number): string {
  if (count === 0) return "Those are already in your bags.";
  return count === 1 ? "Added 1 to your bags." : `Added ${count} to your bags.`;
}

/** The headline on a wallet page: how many of the read bags are cashing out. */
export function walletSummary(verdicts: (Verdict | null)[]): string {
  const read = verdicts.filter((verdict): verdict is Verdict => verdict !== null);
  const n = read.length;
  if (n === 0) return "Couldn't read any of your bags right now.";
  const out = read.filter((verdict) => verdict === "distribution").length;
  const bags = n === 1 ? "bag" : "bags";
  if (out === 0) {
    return n === 1
      ? "Your biggest bag isn't cashing out."
      : `None of your ${n} biggest ${bags} are cashing out.`;
  }
  if (out === n) {
    return n === 1 ? "Your biggest bag is cashing out." : `All ${n} of your biggest bags are cashing out.`;
  }
  return `${out} of your ${n} biggest bags ${out === 1 ? "is" : "are"} cashing out.`;
}
export const PASTE_ERROR = "Paste a token address from Solana, Ethereum, or Base.";
export const PASTE_EMPTY = "Paste a token address.";
export const PASTE_INCOMPLETE = "That address is incomplete.";
export const PASTE_INVALID = "That's not a token address.";
export const PASTE_TOO_LONG = "That address is too long.";
export const PASTE_NEED_0X = "Ethereum and Base addresses start with 0x.";
export const PASTE_CHAIN_EVM = "That's an Ethereum or Base address. Switch the chain.";
export const PASTE_CHAIN_SOL = "That's a Solana address. Switch the chain.";
export const PASTE_PENDING = "Checking";
export const CHECK_LOADING = "Asking Nansen who's been buying and selling…";
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
  | "credits"
  | "not-saved"
  | "unavailable";

export function missingKindFromCode(code: string): MissingKind {
  if (code === "not_in_snapshot") return "snapshot";
  if (code === "not_found") return "not-found";
  if (code === "busy") return "busy";
  if (code === "out_of_credits") return "credits";
  if (code === "not_saved") return "not-saved";
  return "unavailable";
}

export function missingCopy(kind: MissingKind): { title: string; reason: string } {
  if (kind === "chain") return { title: MISSING_CHAIN_HEAD, reason: MISSING_CHAIN_LINE };
  if (kind === "address") return { title: MISSING_ADDRESS_HEAD, reason: PASTE_ERROR };
  if (kind === "rate") return { title: RATE_LIMIT_HEAD, reason: RATE_LIMIT_LINE };
  if (kind === "not-found") return { title: MISSING_TOKEN_HEAD, reason: LIVE_NOT_FOUND };
  if (kind === "unavailable") return { title: MISSING_LIVE_HEAD, reason: LIVE_UNAVAILABLE };
  if (kind === "busy") return { title: BUSY_HEAD, reason: LIVE_BUSY };
  if (kind === "credits") return { title: OUT_OF_CREDITS_HEAD, reason: OUT_OF_CREDITS_LINE };
  if (kind === "not-saved") return { title: SAVED_MISSING_HEAD, reason: SAVED_MISSING_LINE };
  return { title: EMPTY_SNAPSHOT_HEAD, reason: EMPTY_SNAPSHOT_LINE };
}

export const WATCH_HEAD = "Your bags";
export const WATCH_READING = "Checking…";
export const WATCH_LIST_EMPTY = "Nothing here yet. Add what you hold, or what you're eyeing.";
export const WATCH_ADD = "Add tokens";
export const WATCH_ADD_TITLE = "Add to your bags";
export const WATCH_ADD_SEARCH = "Search featured tokens or paste";
export const WATCH_ADD_EMPTY = "Nothing matches. Paste the address below instead.";
export const WATCH_ADD_NONE = "Paste a token address below.";
export const WATCH_ADD_LOAD = "Loading tokens…";
export const WATCH_ADD_FAIL = "Showing the featured tokens for now.";
export const WATCH_ADD_ON = "In your bags";
export const WATCH_PIN = "Add to bags";
export const WATCH_REMOVE = "Remove from your bags";
export const WATCH_REMOVE_SHORT = "Remove";
export const WATCH_ADD_ACTION = "Add";
export const WATCH_ADD_FULL = "That's 20. Remove one to add another.";
export const WATCH_ADD_PASTE = "Or paste a token address";
export const WATCH_ADD_CLOSE = "Close";
export const WATCH_ADD_RETRY = "Try again";
export const WATCH_LIST_FAIL = "Couldn't refresh your bags. Open one to check it.";

export function watchAddListEmpty(
  query: string,
  load: "loading" | "ok" | "fallback",
): string {
  if (query.trim()) return WATCH_ADD_EMPTY;
  if (load === "loading") return WATCH_ADD_LOAD;
  return WATCH_ADD_NONE;
}

export const COL_STRIP = "30 days";
export const COL_SIGNAL = "Right now";
export const COL_SHIFT = "Shift";
export const BOARD_HEAD = "Today";
export const BOARD_CAPTION = "Open a row. Ranked by flow shift as a share of 24h volume.";

export function flipSinceVisitLine(from: Verdict): string {
  return `Was ${VERDICT_LABEL[from].toLowerCase()} last time you looked.`;
}

export function flipRecentLine(days: number): string {
  if (days <= 0) return "Changed today.";
  if (days === 1) return "Changed yesterday.";
  return `Changed ${days}d ago.`;
}

export const ACTION_HEAD = "On this token";
export const ACTION_DATE = "Bought on";
export const ACTION_DATE_HINT =
  "If you already hold it, the answer is about keeping it, not buying it.";
export const ACTION_DATE_EMPTY = "Not holding yet";
export const ACTION_DATE_ADD = "Add buy date";
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
export const ACTION_FOLLOW = "Your bags";
export const ACTION_FOLLOW_ON = "In your bags";
export const ACTION_FOLLOW_OFF = "Not in your bags";
export const ACTION_NOTES = "Size and cost";
export const ACTION_NOTES_HINT = "Only saved on this device. They don't change the answer.";
export const ACTION_COPY = "Copy link";
export const WINDOW_RAIL =
  "You hold it, so the answer is about keeping it. Same data, different question.";
export const CLOCK_24H = "Last 24 hours.";
export const SCORE_MARK = "Net buying or selling as a share of the day's volume. Past the tick (6%) it counts.";
export const SCORE_LABELS = {
  bid: "Big buyers",
  retail: "New wallets",
  dist: "Exchanges",
} as const;
export const COL_SINCE = "Since you bought";
export const FLOW_HEAD = "Where the money went today";
export const FLOW_IN = "In";
export const FLOW_OUT = "Out";
export const FLOW_NET = "Net";
export const FLOW_CAPTION = "Net buying and selling by group, as a share of the day's volume.";
export const FLOW_LABEL: Record<FlowCohort, string> = {
  traders: "Smart traders",
  whales: "Whales",
  fresh: "New wallets",
  figures: "Public figures",
  exchanges: "Exchanges",
};

export function flowNetLine(signedUsd: string, signedPct: string): string {
  return `Net ${signedUsd}, ${signedPct} of the day's volume.`;
}

export const TOAST_DATE = "Buy date saved.";
export const TOAST_DATE_CLEARED = "Buy date cleared.";
export const TOAST_RULE = "Rule saved on this device.";
export const TOAST_FOLLOW = "Added to your bags.";
export const TOAST_UNFOLLOW = "Removed from your bags.";
export const TOAST_FOLLOW_FULL = "That's 20 bags. Remove one first.";
export const TOAST_FOLLOW_FAIL = "Couldn't save on this device.";
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
    return `Same story for ${Math.min(runDays, windowDays)} days.`;
  }
  if (runDays === 1) {
    return `Changed today. ${ordinalWord(flips)} change in ${windowDays} days.`;
  }
  return `Same for ${runDays} days. ${ordinalWord(flips)} change in ${windowDays} days.`;
}

/**
 * The insider-exit line under the traders panel. Factual overlap between
 * this week's top sellers and the token's earliest buyers. Never "insider".
 */
export function earlyExitLine(earlyExit: EarlyExit): string {
  const { overlap, sellers, earlyDays } = earlyExit;
  if (overlap === 0) {
    return `None of this week's ${sellers} biggest sellers got in early.`;
  }
  if (overlap === 1) {
    return `1 of this week's ${sellers} biggest sellers got in during the first ${earlyDays} days.`;
  }
  return `${overlap} of this week's ${sellers} biggest sellers got in during the first ${earlyDays} days. Early money is leaving.`;
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
      return `Since you bought on ${when}, ${shown}x more went to exchanges than smart traders bought.`;
    }
    return `Since you bought on ${when}, tokens have been heading to exchanges.`;
  }
  if (verdict === "still-bid") {
    return `Since you bought on ${when}, the big buyers have kept buying.`;
  }
  if (verdict === "retail-pump") {
    return `Since you bought on ${when}, new wallets have done most of the buying.`;
  }
  if (verdict === "split") {
    return `Since you bought on ${when}, smart traders and whales have pulled opposite ways.`;
  }
  if (verdict === "too-thin") {
    return `Since you bought on ${when}, too little has traded to tell.`;
  }
  return `Since you bought on ${when}, not much has moved.`;
}

export const WALLET_HELD = "In your wallet";
export const WALLET_HELD_HINT = "In your wallet. Add the day you bought to see what changed since.";

export function watchStatus(ticket: BagTicket): string {
  if (ticket.entryDate) return formatEntryDay(ticket.entryDate);
  return ticket.held ? WALLET_HELD : WATCH_UNSET;
}

export function hourTick(stats: TokenStats, flows: CohortFlows): string {
  const { ref } = sizeReference(stats);
  const net = (3 * flows.smartTraderNetFlowUsd + 1.5 * flows.whaleNetFlowUsd) / ref;
  if (Math.abs(net) < 0.01) return "Last hour: quiet.";
  if (net > 0) return "Last hour: big buyers adding.";
  return "Last hour: big buyers leaving.";
}
