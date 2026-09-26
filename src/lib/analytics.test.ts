import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "./site";

const client = { page: vi.fn(), track: vi.fn() };
const createTracwell = vi.fn(() => client);
vi.mock("tracwell", () => ({ createTracwell }));

/** A minimal browser at `href`, enough for lib/analytics. */
function browser(href: string, gpc = false) {
  const url = new URL(href);
  vi.stubGlobal("document", {});
  vi.stubGlobal("navigator", { globalPrivacyControl: gpc });
  vi.stubGlobal("window", {
    location: {
      get href() {
        return url.toString();
      },
      get origin() {
        return url.origin;
      },
    },
  });
  return (next: string) => {
    const moved = new URL(next, url);
    url.pathname = moved.pathname;
    url.search = moved.search;
  };
}

async function load() {
  vi.resetModules();
  return import("./analytics");
}

const TOKEN = {
  chain: "solana",
  symbol: "BONK",
  flow: "distribution",
  answer: "dont-buy",
  holding: false,
  data: "live",
  saved_reason: null,
} as const;

beforeEach(() => {
  createTracwell.mockClear();
  client.page.mockClear();
  client.track.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analytics", () => {
  it("makes one private client on the public site, with Do Not Track on and page views manual", async () => {
    const go = browser(`${SITE_URL}/`);
    const { track, trackPage } = await load();
    trackPage();
    go("/t/solana/abc");
    trackPage();
    track("token_checked", TOKEN);
    expect(createTracwell).toHaveBeenCalledTimes(1);
    expect(createTracwell).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionMode: "private",
        consent: "granted",
        respectDoNotTrack: true,
        autoTrackPageViews: false,
      }),
    );
    expect(client.page).toHaveBeenCalledTimes(2);
    expect(client.track).toHaveBeenCalledWith("token_checked", TOKEN);
  });

  it("sends nothing while a wallet or a buy date is in the URL", async () => {
    const go = browser(`${SITE_URL}/w/evm/0xabc`);
    const { track, trackPage } = await load();
    trackPage();
    track("bag_added", { chain: "base", from: "check" });
    go("/t/solana/abc?entryDate=2026-08-03");
    trackPage();
    track("token_checked", { ...TOKEN, holding: true, answer: "sell" });
    expect(client.page).not.toHaveBeenCalled();
    expect(client.track).not.toHaveBeenCalled();
  });

  it("stays off away from the public site", async () => {
    browser("http://localhost:3000/");
    const { track, trackPage } = await load();
    trackPage();
    track("wallet_check_started", { kind: "evm" });
    expect(createTracwell).not.toHaveBeenCalled();
  });

  it("stays off under Global Privacy Control", async () => {
    browser(`${SITE_URL}/`, true);
    const { trackPage } = await load();
    trackPage();
    expect(createTracwell).not.toHaveBeenCalled();
  });

  it("does nothing during server rendering", async () => {
    const { track, trackPage } = await load();
    trackPage();
    track("buy_date_added", { chain: "ethereum" });
    expect(createTracwell).not.toHaveBeenCalled();
  });

  it("knows which URLs are private", async () => {
    const { shareableUrl } = await load();
    expect(shareableUrl(new URL(`${SITE_URL}/t/base/0xabc?saved=1`))).toBe(true);
    expect(shareableUrl(new URL(`${SITE_URL}/w/solana/abc`))).toBe(false);
    expect(shareableUrl(new URL(`${SITE_URL}/t/base/0xabc?entryDate=2026-08-03`))).toBe(false);
  });
});
