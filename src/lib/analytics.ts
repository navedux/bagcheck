import { createTracwell, type TracwellClient } from "tracwell";
import { SITE_URL } from "./site";
import type { Chain, SavedWhy, Signal, Verdict, WalletKind } from "./types";

/** Tracwell's public project key: it names the site to the collector and is safe in the browser. */
const PROJECT_KEY = "tw_live_219a87e2c79341429d639d8783b68454";

/** Completed outcomes worth counting, and the only properties each one sends. */
export type AnalyticsEvents = {
  token_checked: {
    chain: Chain;
    symbol: string;
    flow: Verdict;
    answer: Signal;
    holding: boolean;
    data: "live" | "saved";
    saved_reason: SavedWhy | null;
  };
  buy_date_added: { chain: Chain };
  bag_added: { chain: Chain; from: BagSource };
  wallet_check_started: { kind: WalletKind };
};

export type BagSource = "check" | "list" | "search" | "paste";

/**
 * Tracwell sends the page URL with every page view and event. Two things in a
 * Bagcheck URL stay private: a pasted wallet (/w/...) and the day you bought
 * (?entryDate=). Nothing is sent while the URL holds either.
 */
export function shareableUrl(url: URL): boolean {
  return !url.pathname.startsWith("/w/") && !url.searchParams.has("entryDate");
}

/** Only the public site reports, never localhost, previews, or forks. Global Privacy Control opts out. */
export function analyticsAllowed(origin: string, globalPrivacyControl: boolean): boolean {
  return origin === new URL(SITE_URL).origin && !globalPrivacyControl;
}

let client: TracwellClient | null | undefined;

/** The one browser client, made on first use after the document exists. */
function analytics(): TracwellClient | null {
  if (client !== undefined) return client;
  if (typeof document === "undefined") return null;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  client = analyticsAllowed(window.location.origin, gpc)
    ? createTracwell({
        projectKey: PROJECT_KEY,
        // No cookies, nothing stored on the device, no identity.
        collectionMode: "private",
        consent: "granted",
        respectDoNotTrack: true,
        // Page views go through trackPage, which skips private URLs.
        autoTrackPageViews: false,
      })
    : null;
  return client;
}

function currentUrl(): URL | null {
  return typeof window === "undefined" ? null : new URL(window.location.href);
}

export function trackPage(): void {
  const url = currentUrl();
  if (!url || !shareableUrl(url)) return;
  analytics()?.page();
}

export function track<Name extends keyof AnalyticsEvents>(name: Name, properties: AnalyticsEvents[Name]): void {
  const url = currentUrl();
  if (!url || !shareableUrl(url)) return;
  analytics()?.track(name, properties);
}
