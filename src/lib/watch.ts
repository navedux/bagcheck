import type { SeenEntry } from "./storage";
import type { VerdictDay, WatchRow } from "./types";
import { normalizeAddress } from "./validate";

/**
 * Flip detection for the watchlist. Two honest signals:
 * - since-visit: the verdict differs from what you last saw (localStorage).
 * - recent: the strip's current run started within the last few days.
 */
export type FlipBadge =
  | { kind: "since-visit"; from: WatchRow["verdict"] }
  | { kind: "recent"; days: number };

export function daysBetween(day: string, now: Date): number {
  const then = Date.parse(`${day}T00:00:00.000Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - then) / 86_400_000));
}

/** Days since the current verdict run started, or null if it never changed. */
export function lastChangeDays(history: VerdictDay[], now: Date): number | null {
  const current = history.at(-1);
  if (!current || history.length < 2) return null;
  for (let i = history.length - 2; i >= 0; i -= 1) {
    const day = history[i];
    if (day && day.verdict !== current.verdict) {
      const first = history[i + 1];
      return first ? daysBetween(first.day, now) : null;
    }
  }
  return null;
}

/** A flip counts as fresh for three days. */
export const RECENT_FLIP_DAYS = 3;

export function flipBadge(
  row: WatchRow,
  seen: Record<string, SeenEntry>,
  now: Date,
): FlipBadge | null {
  const last = seen[`${row.chain}:${normalizeAddress(row.address)}`];
  if (last && last.verdict !== row.verdict) {
    return { kind: "since-visit", from: last.verdict };
  }
  const days = lastChangeDays(row.history, now);
  if (days !== null && days <= RECENT_FLIP_DAYS) {
    return { kind: "recent", days };
  }
  return null;
}
