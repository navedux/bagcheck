import { describe, expect, it } from "vitest";
import { pasteLine } from "./copy";
import {
  classifyAddress,
  detectChain,
  pasteIssue,
  pasteIssueFor,
  pasteLiveIssue,
  resolvePasteChain,
} from "./validate";

const WSOL = "So11111111111111111111111111111111111111112";
const PEPE = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
const AERO = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const UNKNOWN_EVM = "0x0000000000000000000000000000000000000001";
const KNOWN = [
  { chain: "solana" as const, address: WSOL },
  { chain: "ethereum" as const, address: PEPE },
  { chain: "base" as const, address: AERO },
];

describe("classifyAddress", () => {
  it("reads empty, families, partials, and junk", () => {
    expect(classifyAddress("")).toBe("empty");
    expect(classifyAddress("   ")).toBe("empty");
    expect(classifyAddress(PEPE)).toBe("evm");
    expect(classifyAddress("0X6982508145454CE325DDBE47A25D4EC3D2311933")).toBe("evm");
    expect(classifyAddress("0x6982")).toBe("evm-partial");
    expect(classifyAddress(WSOL)).toBe("solana");
    expect(classifyAddress("DezX")).toBe("sol-partial");
    expect(classifyAddress("0xGHI")).toBe("invalid");
    expect(classifyAddress("hello!")).toBe("invalid");
    expect(classifyAddress(`0x${"aa".repeat(24)}`)).toBe("too-long");
  });
});

describe("pasteIssue", () => {
  it("accepts a matching complete mint", () => {
    expect(pasteIssue("solana", WSOL)).toBe("ok");
    expect(pasteIssue("ethereum", PEPE)).toBe("ok");
    expect(pasteIssue("base", PEPE)).toBe("ok");
  });

  it("flags the other family as soon as it is obvious", () => {
    expect(pasteIssue("solana", "0x")).toBe("chain-evm");
    expect(pasteIssue("solana", PEPE)).toBe("chain-evm");
    expect(pasteIssue("ethereum", WSOL)).toBe("chain-solana");
    expect(pasteIssue("base", WSOL)).toBe("chain-solana");
    expect(pasteIssue("ethereum", "DezX")).toBe("need-0x");
  });

  it("stays quiet while a matching mint is still incomplete", () => {
    expect(pasteIssue("solana", "So11")).toBe("incomplete");
    expect(pasteIssue("ethereum", "0x6982")).toBe("incomplete");
    expect(pasteLiveIssue(pasteIssue("solana", "So11"))).toBeNull();
    expect(pasteLiveIssue(pasteIssue("solana", "0x"))).toBe("chain-evm");
    expect(pasteLiveIssue(pasteIssue("ethereum", WSOL))).toBe("chain-solana");
  });

  it("flags junk and overflow", () => {
    expect(pasteIssue("solana", "%%%")).toBe("invalid");
    expect(pasteIssue("ethereum", "0xZZ")).toBe("invalid");
    expect(pasteIssue("solana", `0x${"aa".repeat(24)}`)).toBe("too-long");
  });
});

describe("detectChain", () => {
  it("reads solana, catalog ethereum, catalog base, and unknown evm", () => {
    expect(detectChain("", KNOWN)).toBeNull();
    expect(detectChain("So11", KNOWN)).toBeNull();
    expect(detectChain(WSOL, KNOWN)).toEqual({ chain: "solana", fromCatalog: false });
    expect(detectChain(PEPE, KNOWN)).toEqual({ chain: "ethereum", fromCatalog: true });
    expect(detectChain(AERO, KNOWN)).toEqual({ chain: "base", fromCatalog: true });
    expect(detectChain(UNKNOWN_EVM, KNOWN)).toEqual({
      chain: "ethereum",
      fromCatalog: false,
    });
  });
});

describe("pasteIssueFor", () => {
  it("lets auto accept either family and still flags junk", () => {
    expect(pasteIssueFor("auto", WSOL)).toBe("ok");
    expect(pasteIssueFor("auto", PEPE)).toBe("ok");
    expect(pasteIssueFor("auto", "0x6982")).toBe("incomplete");
    expect(pasteIssueFor("auto", "%%%")).toBe("invalid");
    expect(pasteIssueFor("solana", PEPE)).toBe("chain-evm");
    expect(resolvePasteChain("auto", WSOL, KNOWN)).toBe("solana");
    expect(resolvePasteChain("auto", AERO, KNOWN)).toBe("base");
    expect(resolvePasteChain("ethereum", WSOL, KNOWN)).toBe("ethereum");
  });
});

describe("pasteLine", () => {
  it("names the mismatch instead of a generic paste error", () => {
    expect(pasteLine("chain-evm")).toBe("That's an Ethereum or Base address. Switch the chain.");
    expect(pasteLine("chain-solana")).toBe("That's a Solana address. Switch the chain.");
    expect(pasteLine("need-0x")).toBe("Ethereum and Base addresses start with 0x.");
    expect(pasteLine("invalid")).toBe("That's not a token address.");
    expect(pasteLine("incomplete")).toBe("That address is incomplete.");
    expect(pasteLine("empty")).toBe("Paste a token address.");
    expect(pasteLine("too-long")).toBe("That address is too long.");
  });
});
