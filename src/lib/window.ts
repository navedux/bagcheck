export const LABEL_COVERAGE_START = "2025-03-11";
export const MAX_HOLD_DAYS = 90;

export function utcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function holdingWindow(entryDate: string, now: Date) {
  const entry = new Date(`${entryDate}T00:00:00.000Z`);
  const today = utcDay(now);
  const minFrom = new Date(today);
  minFrom.setUTCDate(minFrom.getUTCDate() - MAX_HOLD_DAYS);
  const from = entry > minFrom ? entry : minFrom;
  const days = Math.max(
    1,
    Math.round((today.getTime() - from.getTime()) / 86_400_000),
  );
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
    days,
  };
}

/**
 * The 24h who-bought-sold range, floored to the hour. The range is part of
 * the cache key, so an unrounded clock makes every request a cold call.
 */
export function last24hRange(now: Date) {
  const hour = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
  const to = new Date(hour).toISOString();
  const from = new Date(hour - 86_400_000).toISOString();
  return { from, to };
}

export function isPartialCoverage(entryDate: string): boolean {
  return entryDate < LABEL_COVERAGE_START;
}

export function estimatedWindowVolume(
  volume24hUsd: number | null,
  days: number,
): number {
  return Math.max((volume24hUsd ?? 0) * days, 1);
}

/**
 * Nansen returns deployment as "2023-04-14 14:51:35" (space, no zone).
 * Normalize to a UTC day. Returns null when absent or unparsable.
 */
export function deploymentDayOf(raw: string | null): string | null {
  if (!raw) return null;
  const isoish = raw.trim().replace(" ", "T");
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(isoish) ? isoish : `${isoish}Z`;
  const time = Date.parse(withZone);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

/** First `earlyDays` of the token's life, as a date range. */
export function earlyWindowFor(deploymentDay: string, earlyDays: number) {
  const from = new Date(`${deploymentDay}T00:00:00.000Z`);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + earlyDays);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** The last `days` ending today, as a date range. */
export function recentWindow(now: Date, days: number) {
  const to = utcDay(now);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
