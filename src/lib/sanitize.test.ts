import { describe, expect, it } from "vitest";
import { sanitizeAddress, sanitizeSymbol } from "./sanitize";

describe("sanitizeSymbol", () => {
  it("strips Nansen emoji decorations and collapses whitespace", () => {
    expect(sanitizeSymbol("🌱 PEPE")).toBe("PEPE");
    expect(sanitizeSymbol("🌱  TIGRINO")).toBe("TIGRINO");
  });

  it("keeps plain tickers and caps length", () => {
    expect(sanitizeSymbol("WETH")).toBe("WETH");
    expect(sanitizeSymbol("A".repeat(20))).toHaveLength(12);
  });
});

describe("sanitizeAddress", () => {
  it("strips bidi and control characters without changing a mint", () => {
    expect(sanitizeAddress("\u202e" + "So11111111111111111111111111111111111111112")).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(sanitizeAddress("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")).toBe(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    );
  });
});
