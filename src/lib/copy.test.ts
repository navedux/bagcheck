import { describe, expect, it } from "vitest";
import { emptyBag } from "./bag";
import * as copyAll from "./copy";
import {
  ACTION_DATE_HINT,
  ACTION_NOTES_HINT,
  ACTION_RULE,
  BANNED_PHRASES,
  CHAIN_AUTO,
  CHAIN_AUTO_EVM,
  chainAutoHint,
  HOME_HEAD,
  HOME_NEXT,
  HOME_OR,
  FLOW_EMPTY,
  missingCopy,
  PASTE_CHAIN_EVM,
  PASTE_ERROR,
  STRIP_EMPTY,
  TRADERS_EMPTY_BUY,
  TRADERS_EMPTY_SELL,
  WATCH_ADD_EMPTY,
  WATCH_ADD_LOAD,
  WATCH_ADD_NONE,
  WATCH_ADD_SEARCH,
  pasteAutoLine,
  WATCH_LIST_EMPTY,
  watchAddListEmpty,
  pasteLine,
  PARTIAL_COVERAGE_LINE,
  RATE_LIMIT_HEAD,
  RATE_LIMIT_LINE,
  RULE_ECHO,
  SIGNAL_FORK_HINT,
  SIGNAL_LABEL,
  TOAST_DATE,
  TOAST_FOLLOW,
  TOAST_FOLLOW_FULL,
  TOAST_RULE,
  WATCH_ADD,
  WATCH_ADD_FULL,
  VERDICT_COPY,
  WINDOW_RAIL,
  WATCH_UNSET,
  copyContainsBannedPhrase,
  earlyExitLine,
  clockLine,
  FLOW_CAPTION,
  FLOW_HEAD,
  MONTH_SHORT,
  WEEKDAY_SHORT,
  flowNetLine,
  formatMonthYear,
  holdingLine,
  sinceYouBoughtLine,
  stabilityLine,
  watchStatus,
} from "./copy";
import type { Verdict } from "./types";

const verdicts = Object.keys(VERDICT_COPY) as Verdict[];

describe("punctuation", () => {
  it("never uses an em dash", () => {
    const strings: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === "string") strings.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(copyAll);
    for (const line of strings) {
      expect(line).not.toContain("\u2014");
    }
  });
});

const LEGACY_PHRASES = [
  "For a watcher",
  "For a holder",
  "chip",
  "Field is a bid",
  "Treat as late",
  "Nothing to act on",
] as const;

const PRODUCT_VERDICT_COPY: Record<Verdict, string> = {
  "still-bid": "Traders and whales are still adding.",
  "retail-pump": "Fresh wallets are the bid. Late, not strong.",
  distribution: "Flow is leaving toward exchanges.",
  split: "Traders and whales disagree.",
  quiet: "No meaningful cohort flow.",
  "too-thin": "Liquidity is below the floor for this method.",
};

describe("verdict copy", () => {
  it("covers every verdict", () => {
    expect(verdicts.sort()).toEqual(
      ["distribution", "quiet", "retail-pump", "split", "still-bid", "too-thin"].sort(),
    );
  });

  it("matches the product-contract why sentence for each verdict", () => {
    for (const verdict of verdicts) {
      expect(VERDICT_COPY[verdict]).toBe(PRODUCT_VERDICT_COPY[verdict]);
    }
  });

  it("contains no banned imperative phrases", () => {
    for (const verdict of verdicts) {
      const line = VERDICT_COPY[verdict];
      expect(copyContainsBannedPhrase(line)).toBe(false);
    }
  });

  it("flags a banned phrase when present", () => {
    expect(copyContainsBannedPhrase("Sell now, this is over")).toBe(true);
    expect(BANNED_PHRASES.includes("sell now")).toBe(true);
  });

  it("keeps since-you-bought lines descriptive", () => {
    const line = sinceYouBoughtLine("2026-08-03", "distribution", {
      ref: 1,
      refKind: "volume",
      st: 0.05,
      wh: 0,
      fr: 0,
      ex: 0.12,
      bid: 0.15,
      retail: 0,
      dist: 0.12,
    });
    expect(line).toContain("Aug 3");
    expect(copyContainsBannedPhrase(line)).toBe(false);
    expect(copyContainsBannedPhrase(PARTIAL_COVERAGE_LINE)).toBe(false);
  });

  it("tells a first visit they get one signal", () => {
    expect(HOME_HEAD).toBe("A buy, hold, or sell signal.");
    expect(HOME_NEXT.toLowerCase()).toContain("signal");
    expect(HOME_OR.toLowerCase()).toContain("try");
  });

  it("keeps action and toast lines descriptive", () => {
    expect(ACTION_DATE_HINT).toBe(
      "Turns a buy signal into a hold signal, and don't-buy into a sell signal.",
    );
    expect(ACTION_RULE).toBe("Rule");
    expect(WINDOW_RAIL).toBe(
      "Holding changes the word, not the read: buy becomes hold, don't-buy becomes sell.",
    );
    for (const line of [
      HOME_HEAD,
      HOME_NEXT,
      HOME_OR,
      ACTION_DATE_HINT,
      ACTION_NOTES_HINT,
      PASTE_ERROR,
      PASTE_CHAIN_EVM,
      pasteLine("chain-solana"),
      pasteLine("invalid"),
      WINDOW_RAIL,
      TOAST_DATE,
      TOAST_RULE,
      TOAST_FOLLOW,
      TOAST_FOLLOW_FULL,
      WATCH_ADD,
      WATCH_ADD_FULL,
      RATE_LIMIT_HEAD,
      RATE_LIMIT_LINE,
    ]) {
      expect(copyContainsBannedPhrase(line)).toBe(false);
    }
  });

  it("excludes legacy watcher, holder, and chip phrasing", () => {
    const lines = [
      ...Object.values(VERDICT_COPY),
      HOME_HEAD,
      HOME_NEXT,
      HOME_OR,
      WINDOW_RAIL,
      SIGNAL_FORK_HINT,
      RULE_ECHO,
      ACTION_NOTES_HINT,
      holdingLine("2026-08-03"),
    ];
    for (const line of lines) {
      for (const phrase of LEGACY_PHRASES) {
        expect(line).not.toContain(phrase);
      }
    }
  });

  it("names empty list, search, flow, traders, and missing pages", () => {
    expect(WATCH_LIST_EMPTY).toBe("No tokens on your list yet.");
    expect(WATCH_ADD_SEARCH).toContain("featured");
    expect(WATCH_ADD_EMPTY).toContain("token address");
    expect(watchAddListEmpty("", "loading")).toBe(WATCH_ADD_LOAD);
    expect(watchAddListEmpty("", "ok")).toBe(WATCH_ADD_NONE);
    expect(watchAddListEmpty("zzzz", "ok")).toBe(WATCH_ADD_EMPTY);
    expect(FLOW_EMPTY.toLowerCase()).toContain("flow");
    expect(STRIP_EMPTY.toLowerCase()).toContain("30-day");
    expect(TRADERS_EMPTY_BUY.toLowerCase()).toContain("buyers");
    expect(TRADERS_EMPTY_SELL.toLowerCase()).toContain("sellers");
    expect(missingCopy("address").title).toBe("That is not a token address.");
    expect(missingCopy("address").reason).toBe(PASTE_ERROR);
    expect(missingCopy("chain").title).toContain("chain");
    expect(missingCopy("snapshot").reason).toContain("featured tokens");
    expect(missingCopy("not-found").title).toBe("No read for this token.");
  });

  it("names auto chain detection without locking a guess", () => {
    expect(CHAIN_AUTO).toBe("Auto");
    expect(chainAutoHint(null)).toContain("token address");
    expect(chainAutoHint({ chain: "solana", fromCatalog: false })).toContain("Solana");
    expect(chainAutoHint({ chain: "base", fromCatalog: true })).toContain("Base");
    expect(chainAutoHint({ chain: "ethereum", fromCatalog: false })).toBe(CHAIN_AUTO_EVM);
    expect(pasteAutoLine("auto", { chain: "ethereum", fromCatalog: false }, "ok")).toBe(
      CHAIN_AUTO_EVM,
    );
    expect(pasteAutoLine("ethereum", { chain: "ethereum", fromCatalog: false }, "ok")).toBe(
      null,
    );
    expect(copyContainsBannedPhrase(CHAIN_AUTO_EVM)).toBe(false);
  });

  it("marks an empty watch row as not holding", () => {
    expect(WATCH_UNSET).toBe("Not holding");
    expect(watchStatus(emptyBag)).toBe(WATCH_UNSET);
    expect(watchStatus({ ...emptyBag, entryDate: "2026-08-03" })).toContain("Aug 3");
    expect(
      watchStatus({ ...emptyBag, rule: "fold-on-retail-pump" }),
    ).toBe(WATCH_UNSET);
  });
});

describe("signal copy", () => {
  it("names trade verbs as signals and leaves wait and no read plain", () => {
    expect(SIGNAL_LABEL.buy).toBe("Buy signal");
    expect(SIGNAL_LABEL.hold).toBe("Hold signal");
    expect(SIGNAL_LABEL.sell).toBe("Sell signal");
    expect(SIGNAL_LABEL["dont-buy"]).toBe("Don't buy signal");
    expect(SIGNAL_LABEL.wait).toBe("Wait");
    expect(SIGNAL_LABEL["no-read"]).toBe("No read");
  });

  it("allows signal nouns and still flags orders", () => {
    expect(copyContainsBannedPhrase("Sell signal.")).toBe(false);
    expect(copyContainsBannedPhrase("Buy signal.")).toBe(false);
    expect(copyContainsBannedPhrase("Don't buy signal.")).toBe(false);
    expect(copyContainsBannedPhrase(RULE_ECHO)).toBe(false);
    expect(copyContainsBannedPhrase("Sell now, this is over")).toBe(true);
  });

  it("frames holding without watcher/holder labels", () => {
    expect(holdingLine("2026-08-03")).toBe("Holding since Aug 3.");
    expect(SIGNAL_FORK_HINT.toLowerCase()).toContain("holding this");
    expect(copyContainsBannedPhrase(holdingLine("2026-08-03"))).toBe(false);
  });

  it("stamps one 24h clock on the word", () => {
    expect(clockLine()).toBe("Last 24 hours.");
    expect(clockLine("2026-08-03")).toBe("Last 24 hours. Holding since Aug 3.");
    expect(copyContainsBannedPhrase(clockLine("2026-08-03"))).toBe(false);
  });

  it("names calendar months without a locale guess", () => {
    expect(WEEKDAY_SHORT).toHaveLength(7);
    expect(MONTH_SHORT[8]).toBe("Sep");
    expect(formatMonthYear(2026, 8)).toBe("Sep 2026");
  });

  it("names the 24h in/out bridge without orders", () => {
    expect(FLOW_HEAD).toBe("In and out, 24h");
    expect(flowNetLine("+$540k", "+9.0%")).toBe(
      "Net +$540k. +9.0% of 24h volume.",
    );
    expect(copyContainsBannedPhrase(FLOW_CAPTION)).toBe(false);
    expect(copyContainsBannedPhrase(flowNetLine("+$540k", "+9.0%"))).toBe(false);
  });
});

describe("stability lines", () => {
  it("reads unchanged, new-today, and aged runs", () => {
    expect(stabilityLine(30, 0, 30)).toBe("Unchanged for 30 days.");
    expect(stabilityLine(1, 3, 30)).toBe("New read today. Third flip in 30 days.");
    expect(stabilityLine(6, 2, 30)).toBe("This read is 6 days old. Second flip in 30 days.");
    expect(stabilityLine(0, 0, 30)).toBe("");
  });

  it("falls back to numeric ordinals past ten", () => {
    expect(stabilityLine(1, 12, 30)).toBe("New read today. 12th flip in 30 days.");
  });

  it("stays descriptive", () => {
    expect(copyContainsBannedPhrase(stabilityLine(6, 2, 30))).toBe(false);
  });
});

describe("early-exit lines", () => {
  const ee = (overlap: number) => ({
    sellers: 10,
    earlyBuyers: 50,
    overlap,
    windowDays: 7,
    earlyDays: 10,
  });

  it("reads zero, one and many overlaps", () => {
    expect(earlyExitLine(ee(0))).toBe(
      "None of the top 10 sellers this week were early buyers.",
    );
    expect(earlyExitLine(ee(1))).toBe(
      "1 of the top 10 sellers this week bought in the token's first 10 days.",
    );
    expect(earlyExitLine(ee(4))).toBe(
      "4 of the top 10 sellers this week bought in the token's first 10 days.",
    );
  });

  it("stays factual, never says insider", () => {
    for (const n of [0, 1, 5]) {
      expect(earlyExitLine(ee(n)).toLowerCase()).not.toContain("insider");
      expect(copyContainsBannedPhrase(earlyExitLine(ee(n)))).toBe(false);
    }
  });
});
