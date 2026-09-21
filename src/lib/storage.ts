"use client";

import { emptyBag, bagTicketSchema, type BagTicket } from "./bag";
import { sanitizeSymbol } from "./sanitize";
import type { Chain, FollowItem, Verdict } from "./types";
import {
  FOLLOW_LIMIT,
  followItemSchema,
  normalizeAddress,
} from "./validate";

const FOLLOW_KEY = "hold-check.following";
const FOLLOW_EVENT = "hold-check-following";
const BAG_EVENT = "hold-check-bag";
const SEEN_KEY = "hold-check.seen";
const SEEN_EVENT = "hold-check-seen";
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SEEN_KEY_RE =
  /^(solana|ethereum|base):(0x[a-f0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;

function bagKey(chain: Chain, address: string): string {
  return `hold-check.bag.${chain}.${normalizeAddress(address)}`;
}

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string, eventName: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new Event(eventName));
}

export function subscribeFollow(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(FOLLOW_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(FOLLOW_EVENT, onStoreChange);
  };
}

export function subscribeBag(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(BAG_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(BAG_EVENT, onStoreChange);
  };
}

export function followSnapshot(): string {
  return readRaw(FOLLOW_KEY) ?? "[]";
}

export function bagSnapshot(chain: Chain, address: string): string {
  return readRaw(bagKey(chain, address)) ?? "";
}

function followKeyOf(item: { chain: Chain; address: string }): string {
  return `${item.chain}:${normalizeAddress(item.address)}`;
}

export function parseFollowing(raw: string): FollowItem[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const items: FollowItem[] = [];
    for (const item of parsed) {
      const result = followItemSchema.safeParse(item);
      if (!result.success) continue;
      const address = normalizeAddress(result.data.address);
      const key = `${result.data.chain}:${address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        chain: result.data.chain,
        address,
        symbol: sanitizeSymbol(result.data.symbol) || "TOKEN",
      });
      if (items.length >= FOLLOW_LIMIT) break;
    }
    return items;
  } catch {
    return [];
  }
}

export function parseBag(raw: string): BagTicket {
  if (!raw) return emptyBag;
  try {
    const parsed = bagTicketSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyBag;
  } catch {
    return emptyBag;
  }
}

export function saveBag(chain: Chain, address: string, ticket: BagTicket): void {
  writeRaw(bagKey(chain, address), JSON.stringify(ticket), BAG_EVENT);
}

export type FollowResult = "added" | "removed" | "exists" | "full" | "failed";

function writeFollow(next: FollowItem[]): boolean {
  try {
    writeRaw(FOLLOW_KEY, JSON.stringify(next), FOLLOW_EVENT);
    return true;
  } catch {
    return false;
  }
}

export function addFollow(item: FollowItem): FollowResult {
  const current = parseFollowing(followSnapshot());
  const key = followKeyOf(item);
  if (current.some((row) => followKeyOf(row) === key)) return "exists";
  if (current.length >= FOLLOW_LIMIT) return "full";
  const next: FollowItem[] = [
    {
      chain: item.chain,
      address: normalizeAddress(item.address),
      symbol: sanitizeSymbol(item.symbol) || "TOKEN",
    },
    ...current,
  ];
  return writeFollow(next) ? "added" : "failed";
}

export function toggleFollow(item: FollowItem): FollowItem[] {
  const key = followKeyOf(item);
  const current = parseFollowing(followSnapshot());
  const exists = current.some((row) => followKeyOf(row) === key);
  if (!exists && current.length >= FOLLOW_LIMIT) return current;
  const next = exists
    ? current.filter((row) => followKeyOf(row) !== key)
    : [{ ...item, address: normalizeAddress(item.address), symbol: sanitizeSymbol(item.symbol) || "TOKEN" }, ...current];
  return writeFollow(next) ? next : current;
}

export function isFollowing(chain: Chain, address: string, raw = followSnapshot()): boolean {
  const key = `${chain}:${normalizeAddress(address)}`;
  return parseFollowing(raw).some((item) => followKeyOf(item) === key);
}

export type SeenEntry = { verdict: Verdict; at: number };

const VERDICTS: readonly Verdict[] = [
  "too-thin",
  "still-bid",
  "retail-pump",
  "distribution",
  "split",
  "quiet",
];

export function seenSnapshot(): string {
  return readRaw(SEEN_KEY) ?? "{}";
}

export function parseSeen(raw: string): Record<string, SeenEntry> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Object.create(null) as Record<string, SeenEntry>;
    }
    const out = Object.create(null) as Record<string, SeenEntry>;
    for (const [key, value] of Object.entries(parsed)) {
      if (DANGEROUS_KEYS.has(key) || !SEEN_KEY_RE.test(key)) continue;
      if (!value || typeof value !== "object") continue;
      const entry = value as Partial<SeenEntry>;
      if (
        typeof entry.verdict === "string" &&
        VERDICTS.includes(entry.verdict as Verdict) &&
        typeof entry.at === "number" &&
        Number.isFinite(entry.at)
      ) {
        out[key] = { verdict: entry.verdict as Verdict, at: entry.at };
      }
    }
    return out;
  } catch {
    return Object.create(null) as Record<string, SeenEntry>;
  }
}

/** Stamp the verdicts the user has just seen, keyed by chain:address. */
export function markSeen(
  rows: readonly { chain: Chain; address: string; verdict: Verdict }[],
  at: number,
): void {
  if (typeof window === "undefined") return;
  const next = parseSeen(seenSnapshot());
  for (const row of rows) {
    const key = `${row.chain}:${normalizeAddress(row.address)}`;
    if (DANGEROUS_KEYS.has(key) || !SEEN_KEY_RE.test(key)) continue;
    next[key] = {
      verdict: row.verdict,
      at,
    };
  }
  writeRaw(SEEN_KEY, JSON.stringify(next), SEEN_EVENT);
}
