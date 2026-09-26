import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  ABOUT_DESCRIPTION,
  ABOUT_TITLE,
  APP_FEATURES,
  ATTRIBUTION_HREF,
  copyContainsBannedPhrase,
  SHARE_DESCRIPTION,
  SIGNAL_LABEL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  VERDICT_LABEL,
} from "./copy";
import { CRAWL_BLOCKED, INDEXED_PATHS, PREVIEW_BOTS, SITE_URL } from "./site";
import { aboutStructuredData, homeStructuredData, jsonLdText } from "./structured-data";
import type { Verdict } from "./types";
import {
  EARLY_WINDOW_DAYS,
  LIQUIDITY_FLOOR_USD,
  RECENT_SELL_WINDOW_DAYS,
  signalFor,
  T,
  T_QUIET,
  VOLUME_FLOOR_USD,
} from "./verdict";
import { LABEL_COVERAGE_START, MAX_HOLD_DAYS } from "./window";

const llms = readFileSync(path.resolve(__dirname, "../../public/llms.txt"), "utf8");
const EM_DASH = String.fromCharCode(0x2014);
const VERDICTS: Verdict[] = ["still-bid", "retail-pump", "distribution", "split", "quiet", "too-thin"];

const usd = (value: number) => `$${value.toLocaleString("en-US")}`;
const pct = (value: number) => `${Math.round(value * 100)}%`;

describe("llms.txt", () => {
  it("quotes the thresholds the read actually uses", () => {
    expect(llms).toContain(`passes ${pct(T)} of the day's volume`);
    expect(llms).toContain(`Under ${pct(T_QUIET)} is quiet`);
    expect(llms).toContain(`under ${usd(LIQUIDITY_FLOOR_USD)} in liquidity`);
    expect(llms).toContain(`${usd(VOLUME_FLOOR_USD)} a day in volume`);
    expect(llms).toContain(`up to ${MAX_HOLD_DAYS} days back`);
    expect(llms).toContain(`last ${RECENT_SELL_WINDOW_DAYS} days`);
    expect(llms).toContain(`first ${EARLY_WINDOW_DAYS} days`);
    expect(llms).toContain(`start on ${LABEL_COVERAGE_START}`);
  });

  it("lists each answer the way the app maps it", () => {
    for (const verdict of VERDICTS) {
      const row = `| ${VERDICT_LABEL[verdict]} | ${SIGNAL_LABEL[signalFor(verdict, false)]} | ${SIGNAL_LABEL[signalFor(verdict, true)]} |`;
      expect(llms).toContain(row);
    }
  });

  it("says it isn't advice, isn't Nansen's, and flags the referral link", () => {
    expect(llms).toContain("not financial advice");
    expect(llms).toContain("not an official Nansen product");
    expect(llms).toContain(`(${ATTRIBUTION_HREF}): the data source (the author's referral link)`);
    expect(copyContainsBannedPhrase(llms)).toBe(false);
    expect(llms).not.toContain(EM_DASH);
  });

  it("links to the public site", () => {
    for (const link of llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
      const url = link[1]!;
      if (url.includes("vercel.app")) expect(url.startsWith(SITE_URL)).toBe(true);
    }
  });
});

describe("robots.txt", () => {
  const { rules, sitemap: map } = robots();
  const list = Array.isArray(rules) ? rules : [rules];
  const everyone = list.find((rule) => [rule.userAgent].flat().includes("*"));
  const previews = list.find((rule) => [rule.userAgent].flat().includes("Twitterbot"));

  it("keeps crawlers off the API and the pages that spend credits", () => {
    expect([everyone?.disallow].flat()).toEqual([...CRAWL_BLOCKED]);
  });

  it("lets link previews fetch a shared check, but not the API", () => {
    expect([previews?.userAgent].flat()).toEqual([...PREVIEW_BOTS]);
    expect([previews?.disallow].flat()).toEqual(["/api/"]);
  });

  it("points at the sitemap on the public domain", () => {
    expect(map).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap", () => {
  it("lists only the pages meant for search, on the public domain", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(INDEXED_PATHS.map((p) => (p === "/" ? `${SITE_URL}/` : `${SITE_URL}${p}`)));
    for (const url of urls) {
      expect(CRAWL_BLOCKED.some((blocked) => url.includes(blocked))).toBe(false);
    }
  });
});

describe("structured data", () => {
  it("claims no ratings or reviews", () => {
    const text = JSON.stringify([homeStructuredData(), aboutStructuredData()]);
    expect(text).not.toMatch(/aggregateRating|"review"|ratingValue/i);
  });

  it("can't close its script tag", () => {
    const text = jsonLdText({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

describe("search copy", () => {
  const lines = [SITE_TITLE, SITE_DESCRIPTION, SHARE_DESCRIPTION, ABOUT_TITLE, ABOUT_DESCRIPTION, ...APP_FEATURES];

  it("stays descriptive", () => {
    for (const line of lines) {
      expect(copyContainsBannedPhrase(line)).toBe(false);
      expect(line).not.toContain(EM_DASH);
    }
    expect(SITE_DESCRIPTION).toContain("Not financial advice");
    expect(ABOUT_DESCRIPTION).toContain("Not financial advice");
  });

  it("fits search results", () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
    expect(`${ABOUT_TITLE} · Bagcheck`.length).toBeLessThanOrEqual(60);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(ABOUT_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });
});
