import { afterEach, describe, expect, it } from "vitest";
import { addFollow, parseFollowing } from "./storage";
import { addressFitsChain } from "./validate";
import {
  catalogSymbol,
  filterCatalog,
  mergeCatalog,
  parseCatalog,
  staticCatalog,
  tokenMatches,
} from "./watch-search";

const wsol = {
  chain: "solana" as const,
  address: "So11111111111111111111111111111111111111112",
  symbol: "WSOL",
  verdict: "still-bid" as const,
};

const pepe = {
  chain: "ethereum" as const,
  address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
  symbol: "PEPE",
  verdict: "distribution" as const,
};

describe("staticCatalog", () => {
  it("lists featured tokens with symbols and skips THIN", () => {
    const catalog = staticCatalog();
    expect(catalog.length).toBe(10);
    expect(catalog.some((token) => token.symbol === "WSOL")).toBe(true);
    expect(catalog.some((token) => token.symbol === "THIN")).toBe(false);
  });
});

describe("parseCatalog", () => {
  it("keeps valid rows and drops junk", () => {
    const rows = parseCatalog({
      ok: true,
      data: [
        wsol,
        { chain: "ethereum", address: "nope", symbol: "X", verdict: "quiet" },
        { ...pepe, extra: { nested: true } },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]?.symbol).toBe("PEPE");
  });

  it("returns empty on a bad envelope", () => {
    expect(parseCatalog(null)).toEqual([]);
    expect(parseCatalog({ ok: false })).toEqual([]);
    expect(parseCatalog({ ok: true, data: "nope" })).toEqual([]);
  });
});

describe("mergeCatalog", () => {
  it("overlays live verdicts onto the static set", () => {
    const live = [{ ...wsol, verdict: "quiet" as const }];
    const merged = mergeCatalog([wsol, pepe], live);
    expect(merged.find((token) => token.symbol === "WSOL")?.verdict).toBe("quiet");
    expect(merged.find((token) => token.symbol === "PEPE")?.verdict).toBe("distribution");
  });
});

describe("tokenMatches", () => {
  it("treats blank and whitespace as match-all", () => {
    expect(tokenMatches("", wsol)).toBe(true);
    expect(tokenMatches("   ", wsol)).toBe(true);
  });

  it("matches symbol, chain, and address without regex", () => {
    expect(tokenMatches("wso", wsol)).toBe(true);
    expect(tokenMatches("SOLANA", wsol)).toBe(true);
    expect(tokenMatches("so1111", wsol)).toBe(true);
    expect(tokenMatches("pepe", wsol)).toBe(false);
    expect(tokenMatches("(wsol", wsol)).toBe(false);
  });
});

describe("filterCatalog", () => {
  it("returns none when nothing matches", () => {
    expect(filterCatalog([wsol, pepe], "zzzz")).toEqual([]);
  });
});

describe("catalogSymbol", () => {
  it("returns TOKEN when the mint is not in the catalog", () => {
    expect(catalogSymbol([wsol], "ethereum", pepe.address)).toBe("TOKEN");
    expect(catalogSymbol([wsol], "solana", wsol.address)).toBe("WSOL");
  });
});

describe("addressFitsChain", () => {
  it("rejects a 0x mint on solana and a sol mint on evm", () => {
    expect(addressFitsChain("ethereum", pepe.address)).toBe(true);
    expect(addressFitsChain("base", pepe.address)).toBe(true);
    expect(addressFitsChain("solana", pepe.address)).toBe(false);
    expect(addressFitsChain("solana", wsol.address)).toBe(true);
    expect(addressFitsChain("ethereum", wsol.address)).toBe(false);
  });
});

describe("addFollow", () => {
  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it("adds, then reports exists, then full at 20", () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        clear: () => store.clear(),
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: globalThis.localStorage,
        dispatchEvent: () => true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });

    expect(addFollow(wsol)).toBe("added");
    expect(addFollow(wsol)).toBe("exists");
    for (let i = 1; i <= 19; i += 1) {
      expect(
        addFollow({
          chain: "ethereum",
          address: `0x${i.toString(16).padStart(40, "0")}`,
          symbol: "X",
        }),
      ).toBe("added");
    }
    expect(addFollow(pepe)).toBe("full");
    expect(parseFollowing(store.get("hold-check.following") ?? "[]")).toHaveLength(20);
  });
});
