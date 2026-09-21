/** UTC month grid for the bought-on calendar. Days are ISO `YYYY-MM-DD`. */

export function isoUtcDay(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.toISOString().slice(0, 10);
}

export function parseIsoDay(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return {
    year: year ?? 1970,
    month: (month ?? 1) - 1,
    day: day ?? 1,
  };
}

export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function isoInRange(iso: string, min: string, max: string): boolean {
  return iso >= min && iso <= max;
}

/** Sunday-first cells. Empty pads are null. */
export function monthGrid(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const pad = first.getUTCDay();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < pad; i += 1) cells.push(null);
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(isoUtcDay(year, monthIndex, day));
  }
  return cells;
}

export function canShiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
  min: string,
  max: string,
): boolean {
  const next = shiftMonth(year, monthIndex, delta);
  if (delta < 0) {
    const last = isoUtcDay(next.year, next.month + 1, 0);
    return last >= min;
  }
  const first = isoUtcDay(next.year, next.month, 1);
  return first <= max;
}
