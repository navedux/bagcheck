import { describe, expect, it } from "vitest";
import { clampDataMode, nansenBaseAllowed } from "./env";
import { domainLogoUrl, logoUrl } from "./logo";
import { allowOrigin } from "./origin";
import { clientKey } from "./rate-limit";
import { parseFollowing, parseSeen } from "./storage";
import { watchOkSchema } from "./validate";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

describe("clampDataMode", () => {
  it("keeps the mode that was set, including live on Vercel", () => {
    expect(clampDataMode("live", true)).toBe("live");
    expect(clampDataMode("sim", true)).toBe("sim");
    expect(clampDataMode("snapshot", true)).toBe("snapshot");
    expect(clampDataMode("live", false)).toBe("live");
  });
});

describe("nansenBaseAllowed", () => {
  it("locks the key to https://api.nansen.ai/api/v1", () => {
    expect(nansenBaseAllowed("https://api.nansen.ai/api/v1")).toBe(true);
    expect(nansenBaseAllowed("https://api.nansen.ai/api/v1/")).toBe(true);
    expect(nansenBaseAllowed("https://evil.example/api/v1")).toBe(false);
    expect(nansenBaseAllowed("http://api.nansen.ai/api/v1")).toBe(false);
    expect(nansenBaseAllowed("https://api.nansen.ai.evil.example/api/v1")).toBe(false);
    expect(nansenBaseAllowed("https://api.nansen.ai/api/v2")).toBe(false);
  });
});

describe("clientKey", () => {
  it("prefers Vercel's IP over a spoofed X-Forwarded-For first hop", () => {
    const request = new Request("http://localhost/api/check", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        "x-vercel-forwarded-for": "9.9.9.9",
      },
    });
    expect(clientKey(request, true)).toBe("9.9.9.9");
  });

  it("ignores a client-sent Vercel IP header when not on Vercel", () => {
    const request = new Request("http://localhost/api/check", {
      headers: {
        "x-forwarded-for": "10.0.0.1",
        "x-vercel-forwarded-for": "6.6.6.6",
      },
    });
    expect(clientKey(request, false)).toBe("10.0.0.1");
  });

  it("uses the last X-Forwarded-For hop when no platform IP is set", () => {
    const request = new Request("http://localhost/api/check", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(clientKey(request)).toBe("10.0.0.1");
  });
});

describe("allowOrigin", () => {
  it("allows missing Origin (curl, warmup) and same-host browser calls", () => {
    expect(allowOrigin(new Request("http://localhost:3000/api/check"))).toBe(true);
    expect(
      allowOrigin(
        new Request("http://localhost:3000/api/check", {
          headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a foreign Origin", () => {
    expect(
      allowOrigin(
        new Request("http://localhost:3000/api/watch", {
          headers: { origin: "https://evil.example", host: "localhost:3000" },
        }),
      ),
    ).toBe(false);
  });
});

describe("parseFollowing", () => {
  it("drops invalid addresses, sanitizes symbols, and caps at 20", () => {
    const raw = JSON.stringify([
      { chain: "ethereum", address: WETH, symbol: "🌱 WETH extra" },
      { chain: "ethereum", address: "not-an-address", symbol: "NOPE" },
      { chain: "ethereum", address: WETH, symbol: "DUP" },
      ...Array.from({ length: 25 }, (_, i) => ({
        chain: "ethereum",
        address: `0x${(i + 1).toString(16).padStart(40, "0")}`,
        symbol: "X",
      })),
    ]);
    const items = parseFollowing(raw);
    expect(items).toHaveLength(20);
    expect(items[0]?.symbol).toBe("WETH extra".slice(0, 12));
    expect(items.every((item) => item.address.startsWith("0x"))).toBe(true);
  });
});

describe("parseSeen", () => {
  it("does not pollute Object.prototype from localStorage JSON", () => {
    const raw =
      '{"__proto__":{"verdict":"quiet","at":1},"constructor":{"verdict":"quiet","at":1}}';
    const seen = parseSeen(raw);
    expect(Object.getPrototypeOf(seen)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(seen, "__proto__")).toBe(false);
    expect(({} as { verdict?: string }).verdict).toBeUndefined();
  });

  it("keeps a real chain:address stamp", () => {
    const key = `ethereum:${WETH}`;
    const seen = parseSeen(JSON.stringify({ [key]: { verdict: "quiet", at: 12 } }));
    expect(seen[key]).toEqual({ verdict: "quiet", at: 12 });
  });
});

describe("watchOkSchema", () => {
  it("rejects a forged watch payload", () => {
    expect(
      watchOkSchema.safeParse({
        ok: true,
        data: [{ chain: "ethereum", address: WETH, symbol: "WETH" }],
      }).success,
    ).toBe(false);
    expect(
      watchOkSchema.safeParse({
        ok: true,
        data: [
          {
            chain: "ethereum",
            address: WETH,
            symbol: "WETH",
            verdict: "quiet",
            stale: false,
            volumeUsd: 248_000_000,
            history: [{ day: "2026-09-19", verdict: "quiet" }],
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("logo URLs", () => {
  it("only interpolates allowlisted chain domains", () => {
    expect(domainLogoUrl("solana.com")).toContain("img.logo.dev/solana.com");
    expect(domainLogoUrl("evil.com")).not.toContain("evil.com");
    expect(logoUrl("PEPE<script>")).not.toContain("<");
    expect(logoUrl("PEPE<script>")).toContain("/crypto/PEPEscript");
  });

  it("maps wrapped natives to the underlying ticker", () => {
    expect(logoUrl("WSOL")).toContain("/crypto/SOL");
    expect(logoUrl("WETH")).toContain("/crypto/ETH");
    expect(logoUrl("WBTC")).toContain("/crypto/BTC");
    expect(logoUrl("PEPE")).toContain("/crypto/PEPE");
  });
});
