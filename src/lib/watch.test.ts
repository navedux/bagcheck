import { describe, expect, it } from "vitest";
import type { VerdictDay, WatchRow } from "./types";
import { daysBetween, flipBadge, lastChangeDays } from "./watch";

const NOW = new Date(Date.UTC(2026, 8, 19, 12));

function history(run: string[]): VerdictDay[] {
  const last = Date.UTC(2026, 8, 19);
  return run.map((verdict, i) => ({
    day: new Date(last - (run.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    verdict: verdict as VerdictDay["verdict"],
  }));
}

function row(verdict: WatchRow["verdict"], run: string[]): WatchRow {
  return {
    chain: "ethereum",
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    symbol: "WETH",
    verdict,
    stale: false,
    history: history(run),
    volumeUsd: 248_000_000,
  };
}

describe("lastChangeDays", () => {
  it("returns days since the current run started", () => {
    // run ends today (2026-09-19); the quiet run started on 2026-09-17
    expect(lastChangeDays(history(["still-bid", "quiet", "quiet", "quiet"]), NOW)).toBe(2);
  });

  it("returns null when the verdict never changed in the window", () => {
    expect(lastChangeDays(history(["quiet", "quiet", "quiet"]), NOW)).toBeNull();
  });

  it("returns 0 for a flip today", () => {
    expect(lastChangeDays(history(["quiet", "distribution"]), NOW)).toBe(0);
  });
});

describe("flipBadge", () => {
  it("prefers the since-visit signal when the verdict moved", () => {
    const badge = flipBadge(
      row("distribution", ["quiet", "quiet", "distribution"]),
      { "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { verdict: "still-bid", at: 1 } },
      NOW,
    );
    expect(badge).toEqual({ kind: "since-visit", from: "still-bid" });
  });

  it("flags a recent strip flip when nothing was seen before", () => {
    const run = Array.from({ length: 18 }, () => "quiet");
    run.push("distribution");
    const badge = flipBadge(row("distribution", run), {}, NOW);
    expect(badge).toEqual({ kind: "recent", days: 0 });
  });

  it("stays quiet for an old flip", () => {
    const run = ["distribution", ...Array.from({ length: 18 }, () => "quiet")];
    const badge = flipBadge(row("quiet", run), {}, NOW);
    expect(badge).toBeNull();
  });

  it("falls back to strip recency when the seen verdict matches", () => {
    const badge = flipBadge(
      row("quiet", ["distribution", "quiet", "quiet"]),
      { "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { verdict: "quiet", at: 1 } },
      NOW,
    );
    expect(badge).toEqual({ kind: "recent", days: 1 });
  });

  it("shows nothing when seen matches and no flip is recent", () => {
    const run = ["distribution", ...Array.from({ length: 18 }, () => "quiet")];
    const badge = flipBadge(
      row("quiet", run),
      { "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { verdict: "quiet", at: 1 } },
      NOW,
    );
    expect(badge).toBeNull();
  });
});

describe("daysBetween", () => {
  it("counts whole UTC days", () => {
    expect(daysBetween("2026-09-17", NOW)).toBe(2);
    expect(daysBetween("2026-09-19", NOW)).toBe(0);
  });
});
