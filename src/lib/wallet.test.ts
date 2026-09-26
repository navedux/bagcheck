import { describe, expect, it } from "vitest";
import { walletSummary } from "./copy";
import { NATIVE_EVM, WRAPPED_NATIVE, balanceResponseSchema, holdingsFromBalance } from "./nansen-schema";
import type { Holding } from "./types";
import { isStablecoin, walletRows, WALLET_ROWS } from "./wallet";
import { walletKindFor, walletParamsSchema } from "./validate";

const h = (over: Partial<Holding>): Holding => ({
  chain: "ethereum",
  address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
  symbol: "PEPE",
  amount: 1,
  priceUsd: 1,
  valueUsd: 100,
  native: false,
  ...over,
});

describe("balance parsing", () => {
  const payload = balanceResponseSchema.parse({
    pagination: { page: 1, per_page: 10, is_last_page: true },
    data: [
      { chain: "ethereum", address: "0xw", token_address: NATIVE_EVM, token_symbol: "ETH", token_name: "Ether", token_amount: 2, price_usd: 3000, value_usd: 6000 },
      { chain: "base", address: "0xw", token_address: NATIVE_EVM, token_symbol: "ETH", token_amount: 1, price_usd: 3000, value_usd: 3000 },
      { chain: "arbitrum", address: "0xw", token_address: "0x912ce59144191c1204e64559fe8253a0e49e6548", token_symbol: "ARB", token_amount: 5, price_usd: 1, value_usd: 5 },
      { chain: "ethereum", address: "0xw", token_address: "0x6982508145454CE325DDBE47A25D4EC3D2311933", token_symbol: "🐸 PEPE", token_amount: 9, price_usd: 1, value_usd: 9 },
    ],
  });
  const rows = holdingsFromBalance(payload);

  it("reads native ETH through WETH on the same chain", () => {
    expect(rows[0]).toMatchObject({ chain: "ethereum", address: WRAPPED_NATIVE.ethereum, native: true });
    expect(rows[1]).toMatchObject({ chain: "base", address: WRAPPED_NATIVE.base, native: true });
  });

  it("drops unsupported chains, lowercases EVM, sanitizes symbols", () => {
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ address: "0x6982508145454ce325ddbe47a25d4ec3d2311933", symbol: "PEPE" });
  });
});

describe("wallet rows", () => {
  it("merges native ETH into WETH, drops stables and dust, sorts, caps", () => {
    const weth = WRAPPED_NATIVE.ethereum;
    const rows = walletRows([
      h({ address: weth, symbol: "WETH", valueUsd: 400 }),
      h({ address: weth, symbol: "ETH", valueUsd: 100, native: true }),
      h({ address: "0xusdc", symbol: "USDC", valueUsd: 9000 }),
      h({ address: "0xdust", symbol: "DUST", valueUsd: 3 }),
      h({ address: "0xpepe", symbol: "PEPE", valueUsd: 50 }),
    ]);
    expect(rows.map((row) => row.symbol)).toEqual(["WETH", "PEPE"]);
    expect(rows[0]).toMatchObject({ valueUsd: 500, native: false });
    const many = walletRows(Array.from({ length: 30 }, (_, i) => h({ address: `0x${i}`, valueUsd: 20 + i })));
    expect(many).toHaveLength(WALLET_ROWS);
    expect(many[0]?.valueUsd).toBe(49);
  });

  it("knows the common stablecoins", () => {
    expect(isStablecoin("usdc")).toBe(true);
    expect(isStablecoin("USD1")).toBe(true);
    expect(isStablecoin("PEPE")).toBe(false);
  });
});

describe("wallet summary", () => {
  it("counts bags cashing out among the ones read", () => {
    expect(walletSummary(["distribution", "quiet", "distribution", null])).toBe(
      "2 of your 3 biggest bags are cashing out.",
    );
    expect(walletSummary(["quiet", "retail-pump"])).toBe("None of your 2 biggest bags are cashing out.");
    expect(walletSummary(["distribution"])).toBe("Your biggest bag is cashing out.");
    expect(walletSummary(["distribution", "distribution"])).toBe("All 2 of your biggest bags are cashing out.");
    expect(walletSummary([null])).toBe("Couldn't read any of your bags right now.");
  });
});

describe("wallet params", () => {
  it("accepts a wallet that matches its kind and rejects the rest", () => {
    expect(walletParamsSchema.safeParse({ kind: "evm", address: "0xfbeedcfe378866dab6abbafd8b2986f5c1768737" }).success).toBe(true);
    expect(walletParamsSchema.safeParse({ kind: "solana", address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" }).success).toBe(true);
    expect(walletParamsSchema.safeParse({ kind: "solana", address: "0xfbeedcfe378866dab6abbafd8b2986f5c1768737" }).success).toBe(false);
    expect(walletParamsSchema.safeParse({ kind: "evm", address: "<script>" }).success).toBe(false);
    expect(walletParamsSchema.safeParse({ kind: "btc", address: "bc1q" }).success).toBe(false);
    expect(walletKindFor(" 0xfbeedcfe378866dab6abbafd8b2986f5c1768737 ")).toBe("evm");
    expect(walletKindFor("nope")).toBeNull();
  });
});

describe("amount formatting", () => {
  it("reads billions and fractions", async () => {
    const { formatCount } = await import("./format");
    expect(formatCount(5_241_900_000)).toBe("5.2B");
    expect(formatCount(183.4)).toBe("183");
    expect(formatCount(0.3512)).toBe("0.35");
    expect(formatCount(2.46)).toBe("2.5");
  });
});

describe("wallet bags are held", () => {
  it("answers as a holder without a buy date", async () => {
    const { isHolding, emptyBag } = await import("./bag");
    const { watchStatus } = await import("./copy");
    expect(isHolding(emptyBag)).toBe(false);
    expect(isHolding({ ...emptyBag, held: true })).toBe(true);
    expect(isHolding({ ...emptyBag, entryDate: "2026-09-01" })).toBe(true);
    expect(watchStatus({ ...emptyBag, held: true })).toBe("In your wallet");
    expect(watchStatus({ ...emptyBag, held: true, entryDate: "2026-09-01" })).toBe("Sep 1");
  });
});
